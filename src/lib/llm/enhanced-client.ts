import OpenAI from 'openai';
import pRetry from 'p-retry';
import pTimeout from 'p-timeout';
import { logger } from '../observability/logger';
import { getDatabaseClient } from '../memory/database';
import { getDocumentIngestionService } from '../rag/document-ingestion';

interface LLMConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

interface LLMRequest {
  tenantId: string;
  conversationId?: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  useRAG?: boolean;
  ragQuery?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: any[];
  toolChoice?: any;
}

interface LLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  ragSources?: Array<{
    title: string;
    documentId: string;
    chunkIndex: number;
  }>;
  processingTime: number;
  costCents: number;
  toolCalls?: any[];
  finishReason: string;
}

interface LLMError extends Error {
  type: 'timeout' | 'rate_limit' | 'quota_exceeded' | 'invalid_request' | 'server_error' | 'network_error';
  retryable: boolean;
  details?: any;
}

class EnhancedLLMClient {
  private client: OpenAI | null = null;
  private config: LLMConfig;
  private db = getDatabaseClient();
  private ragService = getDocumentIngestionService();

  // Pricing per 1K tokens (in cents) - update these based on current OpenAI pricing
  private pricing = {
    'gpt-4o-mini': { input: 0.015, output: 0.06 },
    'gpt-4o': { input: 0.5, output: 1.5 },
    'gpt-4': { input: 3, output: 6 },
    'gpt-3.5-turbo': { input: 0.1, output: 0.2 }
  };

  constructor(config: Partial<LLMConfig> = {}) {
    this.config = {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-4o-mini',
      maxTokens: 200,
      temperature: 0.7,
      timeout: 30000, // 30 seconds
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };

    if (this.config.apiKey) {
      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        timeout: this.config.timeout,
        maxRetries: 0 // We handle retries ourselves
      });

      logger.info('Enhanced LLM client initialized', {
        model: this.config.model,
        timeout: this.config.timeout,
        retryAttempts: this.config.retryAttempts
      });
    } else {
      logger.warn('OpenAI API key not provided - LLM functionality disabled');
    }
  }

  // ===================================
  // ENHANCED COMPLETION METHOD
  // ===================================

  async completion(request: LLMRequest): Promise<LLMResponse> {
    if (!this.client) {
      throw this.createError('invalid_request', 'OpenAI client not initialized', false);
    }

    const startTime = Date.now();

    try {
      logger.debug('Starting LLM completion', {
        tenantId: request.tenantId,
        conversationId: request.conversationId,
        messageCount: request.messages.length,
        useRAG: request.useRAG,
        model: this.config.model
      });

      // Enhance messages with RAG context if requested
      const enhancedMessages = await this.enhanceWithRAG(request);

      // Execute with retry logic and timeout
      const response = await this.executeWithRetry(async () => {
        return await pTimeout(
          this.client!.chat.completions.create({
            model: request.model || this.config.model,
            messages: enhancedMessages.messages,
            max_tokens: request.maxTokens || this.config.maxTokens,
            temperature: request.temperature ?? this.config.temperature,
            tools: request.tools,
            tool_choice: request.toolChoice,
            stream: false
          }),
          { milliseconds: this.config.timeout }
        );
      });

      const processingTime = Date.now() - startTime;
      const usage = response.usage!;
      const content = response.choices[0]?.message?.content || '';
      const toolCalls = response.choices[0]?.message?.tool_calls;
      const finishReason = response.choices[0]?.finish_reason || 'stop';

      // Calculate cost
      const costCents = this.calculateCost(
        response.model,
        usage.prompt_tokens,
        usage.completion_tokens
      );

      const llmResponse: LLMResponse = {
        content,
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens
        },
        model: response.model,
        ragSources: enhancedMessages.ragSources,
        processingTime,
        costCents,
        toolCalls,
        finishReason
      };

      // Log completion and track costs
      await Promise.all([
        this.logCompletion(request, llmResponse),
        this.trackCost(request.tenantId, llmResponse)
      ]);

      logger.info('LLM completion successful', {
        tenantId: request.tenantId,
        conversationId: request.conversationId,
        model: response.model,
        totalTokens: usage.total_tokens,
        costCents,
        processingTimeMs: processingTime,
        ragSources: enhancedMessages.ragSources?.length || 0
      });

      return llmResponse;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('LLM completion failed', {
        tenantId: request.tenantId,
        conversationId: request.conversationId,
        processingTimeMs: processingTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Convert to our error format
      throw this.convertError(error);
    }
  }

  // ===================================
  // RAG ENHANCEMENT
  // ===================================

  private async enhanceWithRAG(request: LLMRequest): Promise<{
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    ragSources?: Array<{ title: string; documentId: string; chunkIndex: number }>;
  }> {
    if (!request.useRAG) {
      return { messages: request.messages };
    }

    try {
      // Determine query for RAG - use explicit ragQuery or last user message
      const ragQuery = request.ragQuery || 
        request.messages.filter(m => m.role === 'user').pop()?.content ||
        '';

      if (!ragQuery.trim()) {
        logger.warn('RAG requested but no query available', {
          tenantId: request.tenantId
        });
        return { messages: request.messages };
      }

      // Get relevant context from RAG
      const ragContext = await this.ragService.getRelevantContext(
        request.tenantId,
        ragQuery,
        undefined, // No document type filter
        1500 // Max tokens for context
      );

      if (ragContext.context && ragContext.sources.length > 0) {
        // Enhance system message with RAG context
        const enhancedMessages = [...request.messages];
        const systemMessageIndex = enhancedMessages.findIndex(m => m.role === 'system');

        const ragPrompt = `\n\nRelevant company information for your response:\n\n${ragContext.context}\n\nUse this information to provide accurate, specific answers about our services, policies, and procedures. If the user's question relates to information in this context, cite the relevant details. If the information needed is not in the context, respond based on your general knowledge while being clear about what information you have access to.`;

        if (systemMessageIndex >= 0) {
          enhancedMessages[systemMessageIndex].content += ragPrompt;
        } else {
          enhancedMessages.unshift({
            role: 'system',
            content: `You are a helpful business assistant.${ragPrompt}`
          });
        }

        logger.debug('Enhanced messages with RAG context', {
          tenantId: request.tenantId,
          contextTokens: ragContext.tokenCount,
          sourceCount: ragContext.sources.length
        });

        return {
          messages: enhancedMessages,
          ragSources: ragContext.sources
        };
      }

      return { messages: request.messages };

    } catch (error) {
      logger.error('RAG enhancement failed:', error);
      // Continue without RAG if it fails
      return { messages: request.messages };
    }
  }

  // ===================================
  // RETRY & ERROR HANDLING
  // ===================================

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    return pRetry(operation, {
      retries: this.config.retryAttempts,
      minTimeout: this.config.retryDelay,
      maxTimeout: this.config.retryDelay * 8,
      factor: 2,
      randomize: true,
      onFailedAttempt: (error) => {
        logger.warn('LLM request failed, retrying', {
          attempt: error.attemptNumber,
          retriesLeft: error.retriesLeft,
          error: error.message
        });
      },
      shouldRetry: (error) => {
        const llmError = this.convertError(error);
        return llmError.retryable;
      }
    });
  }

  private convertError(error: any): LLMError {
    if (error instanceof pTimeout.TimeoutError) {
      return this.createError('timeout', 'Request timeout', true, { timeout: this.config.timeout });
    }

    if (error?.error?.type) {
      // OpenAI API error
      const apiError = error.error;
      
      switch (apiError.type) {
        case 'insufficient_quota':
          return this.createError('quota_exceeded', apiError.message, false, apiError);
        case 'rate_limit_exceeded':
          return this.createError('rate_limit', apiError.message, true, apiError);
        case 'invalid_request_error':
          return this.createError('invalid_request', apiError.message, false, apiError);
        case 'server_error':
          return this.createError('server_error', apiError.message, true, apiError);
        default:
          return this.createError('server_error', apiError.message, true, apiError);
      }
    }

    if (error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND') {
      return this.createError('network_error', 'Network connection failed', true, error);
    }

    // Unknown error
    return this.createError('server_error', error?.message || 'Unknown error', true, error);
  }

  private createError(type: LLMError['type'], message: string, retryable: boolean, details?: any): LLMError {
    const error = new Error(message) as LLMError;
    error.type = type;
    error.retryable = retryable;
    error.details = details;
    return error;
  }

  // ===================================
  // COST CALCULATION & TRACKING
  // ===================================

  private calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const modelPricing = this.pricing[model as keyof typeof this.pricing];
    if (!modelPricing) {
      logger.warn('Unknown model for cost calculation', { model });
      return 0;
    }

    const promptCost = (promptTokens / 1000) * modelPricing.input;
    const completionCost = (completionTokens / 1000) * modelPricing.output;
    
    return Math.round((promptCost + completionCost) * 100) / 100; // Round to 2 decimal places
  }

  private async trackCost(tenantId: string, response: LLMResponse): Promise<void> {
    try {
      await this.db.trackCost(tenantId, {
        date: new Date(),
        service: 'openai',
        operation: 'chat_completion',
        quantity: response.usage.totalTokens,
        costCents: response.costCents,
        metadata: {
          model: response.model,
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          processingTimeMs: response.processingTime
        }
      });
    } catch (error) {
      logger.error('Failed to track LLM cost:', error);
    }
  }

  private async logCompletion(request: LLMRequest, response: LLMResponse): Promise<void> {
    logger.llmRequest({
      tenantId: request.tenantId,
      conversationId: request.conversationId || '',
      model: response.model,
      tokens: {
        prompt: response.usage.promptTokens,
        completion: response.usage.completionTokens,
        total: response.usage.totalTokens
      },
      duration: response.processingTime,
      costCents: response.costCents,
      success: true
    });
  }

  // ===================================
  // TOOL HANDLING
  // ===================================

  async completionWithTools(
    request: LLMRequest & { tools: any[]; toolChoice?: any }
  ): Promise<LLMResponse & { requiresToolCall: boolean }> {
    const response = await this.completion(request);
    
    const requiresToolCall = response.toolCalls && response.toolCalls.length > 0;
    
    if (requiresToolCall) {
      logger.info('LLM requested tool calls', {
        tenantId: request.tenantId,
        conversationId: request.conversationId,
        toolCallCount: response.toolCalls?.length
      });
    }

    return {
      ...response,
      requiresToolCall: !!requiresToolCall
    };
  }

  // ===================================
  // UTILITY METHODS
  // ===================================

  isConfigured(): boolean {
    return !!this.client;
  }

  getConfig(): LLMConfig {
    return { ...this.config };
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      await this.client.models.list();
      return true;
    } catch (error) {
      logger.error('LLM connection test failed:', error);
      return false;
    }
  }

  // Calculate cost estimate for a given token count
  estimateCost(model: string, promptTokens: number, completionTokens: number): number {
    return this.calculateCost(model, promptTokens, completionTokens);
  }

  // Get available models (cached)
  private modelCache: string[] | null = null;
  private modelCacheExpiry: number = 0;

  async getAvailableModels(): Promise<string[]> {
    if (this.modelCache && Date.now() < this.modelCacheExpiry) {
      return this.modelCache;
    }

    if (!this.client) {
      return [];
    }

    try {
      const response = await this.client.models.list();
      this.modelCache = response.data
        .filter(model => model.id.startsWith('gpt'))
        .map(model => model.id)
        .sort();
      this.modelCacheExpiry = Date.now() + 300000; // Cache for 5 minutes
      
      return this.modelCache;
    } catch (error) {
      logger.error('Failed to fetch available models:', error);
      return [];
    }
  }
}

// ===================================
// SINGLETON INSTANCE
// ===================================

let enhancedLLMInstance: EnhancedLLMClient | null = null;

export function getEnhancedLLMClient(): EnhancedLLMClient {
  if (!enhancedLLMInstance) {
    enhancedLLMInstance = new EnhancedLLMClient();
  }
  return enhancedLLMInstance;
}

export { EnhancedLLMClient };
export type { LLMConfig, LLMRequest, LLMResponse, LLMError };