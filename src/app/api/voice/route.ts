import { NextRequest, NextResponse } from 'next/server';
import { getEnhancedLLMClient } from '@/lib/llm/enhanced-client';
import { getDatabaseClient, isInDatabaseFallbackMode } from '@/lib/memory/database';
import { isInFallbackMode as isInVectorFallbackMode } from '@/lib/rag/vectorstore';
import { isInRedisFallbackMode } from '@/lib/memory/redis';
import { logger } from '@/lib/observability/logger';
import { z } from 'zod';

// Enhanced LLM client with retry logic, RAG, and cost tracking
const llmClient = getEnhancedLLMClient();
const db = getDatabaseClient();

const businessSystemPrompts = {
  dental: `You are a voice assistant for BrightSmile Dental Clinic. Keep responses conversational, concise (2-3 sentences max), and natural for voice interaction.

Key Information:
- Services: Routine cleanings, fillings, root canals, cosmetic dentistry, emergency care
- Hours: Monday-Friday 8AM-6PM, Saturday 9AM-3PM, Closed Sundays
- Phone: (555) 123-SMILE
- Insurance: Accept most major plans including Blue Cross, Aetna, Cigna, Delta Dental
- Emergency: Same-day emergency appointments available
- Scheduling: Regular cleanings need 2 weeks advance notice

Your role:
1. Answer questions about dental services and appointments
2. Provide helpful dental care information
3. Be empathetic about dental concerns
4. Keep responses brief and conversational for voice interaction
5. Always offer to help with scheduling when appropriate

Speak naturally as if you're having a phone conversation.`,

  auto: `You are a voice assistant for ProFix Auto Repair. Keep responses conversational, concise (2-3 sentences max), and natural for voice interaction.

Key Information:
- Services: Oil changes, brake repair, engine diagnostics, tire service, transmission repair, general maintenance
- Hours: Monday-Friday 7AM-7PM, Saturday 8AM-4PM, Closed Sundays
- Phone: (555) 456-AUTO
- Warranty: 12-month/12,000-mile warranty on all repairs
- Parts: Use OEM and high-quality aftermarket parts
- Estimates: Free estimates provided
- Pricing: Competitive pricing, payment plans for repairs over $500

Your role:
1. Answer questions about automotive services and repairs
2. Help with service scheduling and estimates
3. Explain repair processes simply
4. Be honest about costs and timelines
5. Keep responses brief and conversational for voice interaction

Speak naturally as if you're talking to a customer over the phone.`,

  fitness: `You are a voice assistant for PulsePoint Fitness Gym. Keep responses conversational, concise (2-3 sentences max), energetic, and natural for voice interaction.

Key Information:
- Services: Personal training, group classes, cardio equipment, weight training, nutrition counseling
- Hours: Monday-Friday 5AM-11PM, Weekends 6AM-10PM
- Phone: (555) 789-PULSE
- Classes: Yoga, spin, HIIT, pilates, strength training
- Membership: Monthly, annual (with discounts), day passes, student discounts available
- Trial: Free 3-day trial for new members
- Equipment: State-of-the-art cardio, free weights, resistance machines, functional training areas

Your role:
1. Answer questions about fitness programs and memberships
2. Help with class scheduling and membership inquiries
3. Provide motivational fitness advice
4. Be enthusiastic and encouraging
5. Keep responses brief and conversational for voice interaction

Speak energetically as if you're talking to someone who called the gym.`
};

// Validation schema
const VoiceRequestSchema = z.object({
  message: z.string().min(1),
  businessId: z.enum(['dental', 'auto', 'fitness']),
  tenantId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  sessionId: z.string().optional(),
  useRAG: z.boolean().optional().default(true),
  metadata: z.record(z.any()).optional()
});

// Tenant ID mapping for business IDs
const businessToTenantMap = {
  dental: '550e8400-e29b-41d4-a716-446655440001',
  auto: '550e8400-e29b-41d4-a716-446655440002',
  fitness: '550e8400-e29b-41d4-a716-446655440003'
};

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const validatedRequest = VoiceRequestSchema.parse(body);
    
    const { message, businessId, useRAG, metadata } = validatedRequest;
    const tenantId = validatedRequest.tenantId || businessToTenantMap[businessId];
    const conversationId = validatedRequest.conversationId;
    const sessionId = validatedRequest.sessionId || `session_${Date.now()}`;

    logger.info('Voice API request received', {
      tenantId,
      businessId,
      conversationId,
      sessionId,
      useRAG,
      messageLength: message.length
    });

    // Check if LLM client is configured
    if (!llmClient.isConfigured()) {
      logger.error('LLM client not configured');
      return NextResponse.json(
        { 
          response: "I'm sorry, but I'm not properly configured right now. Please try calling us directly at our phone number.",
          error: 'OpenAI API key not configured',
          metadata: { processingTimeMs: Date.now() - startTime }
        },
        { status: 500 }
      );
    }

    const businessPrompt = businessSystemPrompts[businessId];

    // Create or get conversation
    let dbConversationId = conversationId;
    if (!dbConversationId) {
      try {
        dbConversationId = await db.createConversation(tenantId, {
          sessionId,
          metadata: {
            source: 'voice_api',
            businessId,
            ...metadata
          }
        });
      } catch (error) {
        logger.warn('Failed to create conversation in database:', error);
      }
    }

    // Store user message
    if (dbConversationId) {
      try {
        await db.addMessage(tenantId, {
          conversationId: dbConversationId,
          type: 'user',
          content: message,
          isVoice: true,
          metadata: {
            source: 'voice_api',
            sessionId
          }
        });
      } catch (error) {
        logger.warn('Failed to store user message:', error);
      }
    }

    // Prepare messages for LLM
    const messages = [
      {
        role: 'system' as const,
        content: businessPrompt
      },
      {
        role: 'user' as const,
        content: message
      }
    ];

    // Get recent conversation history if available
    if (dbConversationId) {
      try {
        const recentMessages = await db.getRecentMessages(tenantId, dbConversationId, 2);
        
        // Add conversation history (excluding the current message)
        const historyMessages = recentMessages
          .filter(msg => msg.content !== message) // Exclude current message
          .slice(-4) // Last 4 messages max
          .map(msg => ({
            role: msg.type === 'user' ? 'user' as const : 'assistant' as const,
            content: msg.content
          }));

        if (historyMessages.length > 0) {
          // Insert history before the current user message
          messages.splice(-1, 0, ...historyMessages);
        }
      } catch (error) {
        logger.warn('Failed to retrieve conversation history:', error);
      }
    }

    // Call enhanced LLM with RAG support
    const llmResponse = await llmClient.completion({
      tenantId,
      conversationId: dbConversationId,
      messages,
      useRAG,
      ragQuery: message, // Use user message as RAG query
      maxTokens: 200, // Keep responses short for voice
      temperature: 0.7
    });

    // Store assistant response
    if (dbConversationId) {
      try {
        await db.addMessage(tenantId, {
          conversationId: dbConversationId,
          type: 'assistant',
          content: llmResponse.content,
          isVoice: true,
          processingTimeMs: llmResponse.processingTime,
          tokenCount: llmResponse.usage.totalTokens,
          costCents: llmResponse.costCents,
          metadata: {
            source: 'voice_api',
            model: llmResponse.model,
            ragSources: llmResponse.ragSources,
            sessionId
          }
        });
      } catch (error) {
        logger.warn('Failed to store assistant message:', error);
      }
    }

    const totalProcessingTime = Date.now() - startTime;

    // Check fallback status
    const fallbackStatus = {
      database: isInDatabaseFallbackMode(),
      vectorStore: isInVectorFallbackMode(), 
      redis: isInRedisFallbackMode()
    };
    
    const anyFallback = fallbackStatus.database || fallbackStatus.vectorStore || fallbackStatus.redis;

    logger.info('Voice API request completed', {
      tenantId,
      businessId,
      conversationId: dbConversationId,
      sessionId,
      totalTokens: llmResponse.usage.totalTokens,
      costCents: llmResponse.costCents,
      processingTimeMs: totalProcessingTime,
      ragSourcesCount: llmResponse.ragSources?.length || 0,
      fallbackMode: anyFallback,
      fallbackStatus
    });

    return NextResponse.json({
      response: llmResponse.content,
      metadata: {
        conversationId: dbConversationId,
        sessionId,
        processingTimeMs: totalProcessingTime,
        tokenUsage: llmResponse.usage,
        costCents: llmResponse.costCents,
        ragSources: llmResponse.ragSources,
        model: llmResponse.model,
        fallbackMode: anyFallback,
        fallbackStatus,
        ...(anyFallback && {
          notice: "System running in fallback mode - some features may be limited but core functionality is maintained"
        })
      }
    });

  } catch (error) {
    const totalProcessingTime = Date.now() - startTime;

    if (error instanceof z.ZodError) {
      logger.warn('Invalid voice API request:', error.errors);
      return NextResponse.json(
        { 
          response: "I'm sorry, but I didn't receive your message clearly. Could you please try again?",
          error: 'Invalid request format',
          details: error.errors,
          metadata: { processingTimeMs: totalProcessingTime }
        },
        { status: 400 }
      );
    }

    // Handle LLM-specific errors
    if (error && typeof error === 'object' && 'type' in error) {
      const llmError = error as any;
      
      logger.error('LLM error in voice API:', {
        type: llmError.type,
        message: llmError.message,
        retryable: llmError.retryable
      });

      let userMessage = "I'm sorry, I'm having technical difficulties right now.";
      
      switch (llmError.type) {
        case 'timeout':
          userMessage = "I'm sorry, that took too long to process. Please try asking again.";
          break;
        case 'rate_limit':
          userMessage = "I'm experiencing high demand right now. Please wait a moment and try again.";
          break;
        case 'quota_exceeded':
          userMessage = "I'm sorry, but the service is temporarily unavailable. Please try calling us directly.";
          break;
        default:
          userMessage = "I'm having trouble processing your request. Please try again or call us directly.";
      }

      return NextResponse.json(
        { 
          response: userMessage,
          error: 'LLM processing failed',
          metadata: { processingTimeMs: totalProcessingTime }
        },
        { status: 503 }
      );
    }

    logger.error('Voice API error:', error);
    return NextResponse.json(
      { 
        response: "I'm sorry, I'm having technical difficulties right now. Please try calling us directly or try again in a moment.",
        error: 'Failed to generate response',
        metadata: { processingTimeMs: totalProcessingTime }
      },
      { status: 500 }
    );
  }
}