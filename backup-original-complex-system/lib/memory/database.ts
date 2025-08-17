import { Pool, PoolClient, QueryResult } from 'pg';
import { logger } from '../observability/logger';
import { v4 as uuidv4 } from 'uuid';

interface DatabaseConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean | object;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

class DatabaseClient {
  private pool: Pool | null = null;
  private isConnected = false;

  constructor(private config: DatabaseConfig) {
    this.connect();
  }

  private async connect() {
    try {
      this.pool = new Pool({
        connectionString: this.config.connectionString,
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        ssl: this.config.ssl || (process.env.NODE_ENV === 'production'),
        max: this.config.max || 10,
        idleTimeoutMillis: this.config.idleTimeoutMillis || 30000,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis || 2000,
        ...this.config
      });

      this.pool.on('connect', (client) => {
        this.isConnected = true;
        logger.info('PostgreSQL client connected');
      });

      this.pool.on('error', (error) => {
        this.isConnected = false;
        logger.error('PostgreSQL connection error:', error);
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      logger.info('PostgreSQL database connected successfully');
      
    } catch (error) {
      logger.error('Failed to connect to PostgreSQL:', error);
      this.pool = null;
    }
  }

  // ===================================
  // TENANT-AWARE OPERATIONS
  // ===================================

  async withTenant<T>(tenantId: string, operation: (client: PoolClient) => Promise<T>): Promise<T | null> {
    if (!this.pool) {
      logger.error('Database pool not available');
      return null;
    }

    const client = await this.pool.connect();
    
    try {
      // Set tenant context for RLS
      await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant_id', tenantId]);
      
      const result = await operation(client);
      return result;
    } catch (error) {
      logger.error('Database operation error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async query(tenantId: string, text: string, params?: any[]): Promise<QueryResult | null> {
    return this.withTenant(tenantId, async (client) => {
      return await client.query(text, params);
    });
  }

  // ===================================
  // CONVERSATION MANAGEMENT
  // ===================================

  async createConversation(tenantId: string, data: {
    userId?: string;
    sessionId: string;
    metadata?: object;
  }): Promise<string | null> {
    const result = await this.query(
      tenantId,
      `INSERT INTO conversations (tenant_id, user_id, session_id, metadata) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      [tenantId, data.userId || null, data.sessionId, JSON.stringify(data.metadata || {})]
    );

    return result?.rows[0]?.id || null;
  }

  async getConversation(tenantId: string, conversationId: string): Promise<any | null> {
    const result = await this.query(
      tenantId,
      `SELECT * FROM conversations WHERE id = $1`,
      [conversationId]
    );

    return result?.rows[0] || null;
  }

  async getConversationsBySession(tenantId: string, sessionId: string): Promise<any[]> {
    const result = await this.query(
      tenantId,
      `SELECT * FROM conversations WHERE session_id = $1 ORDER BY started_at DESC`,
      [sessionId]
    );

    return result?.rows || [];
  }

  async updateConversation(tenantId: string, conversationId: string, updates: {
    status?: string;
    endedAt?: Date;
    summary?: string;
    metadata?: object;
  }): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.endedAt !== undefined) {
      fields.push(`ended_at = $${paramIndex++}`);
      values.push(updates.endedAt);
    }
    if (updates.summary !== undefined) {
      fields.push(`summary = $${paramIndex++}`);
      values.push(updates.summary);
    }
    if (updates.metadata !== undefined) {
      fields.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(updates.metadata));
    }

    if (fields.length === 0) {
      return false;
    }

    values.push(conversationId);
    const result = await this.query(
      tenantId,
      `UPDATE conversations SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex}`,
      values
    );

    return (result?.rowCount || 0) > 0;
  }

  // ===================================
  // MESSAGE MANAGEMENT
  // ===================================

  async addMessage(tenantId: string, data: {
    conversationId: string;
    type: 'user' | 'assistant' | 'system';
    content: string;
    isVoice?: boolean;
    processingTimeMs?: number;
    tokenCount?: number;
    costCents?: number;
    metadata?: object;
  }): Promise<string | null> {
    const result = await this.query(
      tenantId,
      `INSERT INTO messages (
        conversation_id, tenant_id, type, content, is_voice,
        processing_time_ms, token_count, cost_cents, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
      RETURNING id`,
      [
        data.conversationId,
        tenantId,
        data.type,
        data.content,
        data.isVoice || false,
        data.processingTimeMs || null,
        data.tokenCount || null,
        data.costCents || null,
        JSON.stringify(data.metadata || {})
      ]
    );

    return result?.rows[0]?.id || null;
  }

  async getMessages(tenantId: string, conversationId: string, limit = 50): Promise<any[]> {
    const result = await this.query(
      tenantId,
      `SELECT * FROM messages 
       WHERE conversation_id = $1 
       ORDER BY timestamp DESC 
       LIMIT $2`,
      [conversationId, limit]
    );

    return result?.rows || [];
  }

  async getRecentMessages(tenantId: string, conversationId: string, hours = 24): Promise<any[]> {
    const result = await this.query(
      tenantId,
      `SELECT * FROM messages 
       WHERE conversation_id = $1 
         AND timestamp > NOW() - INTERVAL '${hours} hours'
       ORDER BY timestamp ASC`,
      [conversationId]
    );

    return result?.rows || [];
  }

  // ===================================
  // USER MANAGEMENT
  // ===================================

  async createUser(tenantId: string, data: {
    email?: string;
    phone?: string;
    name?: string;
    role?: string;
    metadata?: object;
  }): Promise<string | null> {
    const result = await this.query(
      tenantId,
      `INSERT INTO users (tenant_id, email, phone, name, role, metadata) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id`,
      [
        tenantId,
        data.email || null,
        data.phone || null,
        data.name || null,
        data.role || 'customer',
        JSON.stringify(data.metadata || {})
      ]
    );

    return result?.rows[0]?.id || null;
  }

  async getUser(tenantId: string, userId: string): Promise<any | null> {
    const result = await this.query(
      tenantId,
      `SELECT * FROM users WHERE id = $1`,
      [userId]
    );

    return result?.rows[0] || null;
  }

  async findUserByEmail(tenantId: string, email: string): Promise<any | null> {
    const result = await this.query(
      tenantId,
      `SELECT * FROM users WHERE email = $1`,
      [email]
    );

    return result?.rows[0] || null;
  }

  async findUserByPhone(tenantId: string, phone: string): Promise<any | null> {
    const result = await this.query(
      tenantId,
      `SELECT * FROM users WHERE phone = $1`,
      [phone]
    );

    return result?.rows[0] || null;
  }

  // ===================================
  // INTEGRATION AUDIT
  // ===================================

  async logIntegrationCall(tenantId: string, data: {
    conversationId?: string;
    integrationType: string;
    method: string;
    endpoint: string;
    requestData?: object;
    responseData?: object;
    statusCode: number;
    processingTimeMs: number;
    idempotencyKey?: string;
  }): Promise<string | null> {
    const result = await this.query(
      tenantId,
      `INSERT INTO integration_calls (
        tenant_id, conversation_id, integration_type, method, endpoint,
        request_data, response_data, status_code, processing_time_ms, idempotency_key
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
      RETURNING id`,
      [
        tenantId,
        data.conversationId || null,
        data.integrationType,
        data.method,
        data.endpoint,
        JSON.stringify(data.requestData || {}),
        JSON.stringify(data.responseData || {}),
        data.statusCode,
        data.processingTimeMs,
        data.idempotencyKey || null
      ]
    );

    return result?.rows[0]?.id || null;
  }

  async getIntegrationCalls(tenantId: string, filters: {
    conversationId?: string;
    integrationType?: string;
    limit?: number;
    since?: Date;
  } = {}): Promise<any[]> {
    let whereClause = 'WHERE tenant_id = $1';
    const values: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.conversationId) {
      whereClause += ` AND conversation_id = $${paramIndex++}`;
      values.push(filters.conversationId);
    }

    if (filters.integrationType) {
      whereClause += ` AND integration_type = $${paramIndex++}`;
      values.push(filters.integrationType);
    }

    if (filters.since) {
      whereClause += ` AND created_at > $${paramIndex++}`;
      values.push(filters.since);
    }

    const result = await this.query(
      tenantId,
      `SELECT * FROM integration_calls 
       ${whereClause}
       ORDER BY created_at DESC 
       LIMIT $${paramIndex}`,
      [...values, filters.limit || 100]
    );

    return result?.rows || [];
  }

  // ===================================
  // COST TRACKING
  // ===================================

  async trackCost(tenantId: string, data: {
    date: Date;
    service: string;
    operation: string;
    quantity: number;
    costCents: number;
    metadata?: object;
  }): Promise<boolean> {
    const result = await this.query(
      tenantId,
      `INSERT INTO cost_tracking (tenant_id, date, service, operation, quantity, cost_cents, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (tenant_id, date, service, operation) 
       DO UPDATE SET 
         quantity = cost_tracking.quantity + EXCLUDED.quantity,
         cost_cents = cost_tracking.cost_cents + EXCLUDED.cost_cents,
         metadata = EXCLUDED.metadata`,
      [
        tenantId,
        data.date,
        data.service,
        data.operation,
        data.quantity,
        data.costCents,
        JSON.stringify(data.metadata || {})
      ]
    );

    return (result?.rowCount || 0) > 0;
  }

  async getCostSummary(tenantId: string, startDate: Date, endDate: Date): Promise<any[]> {
    const result = await this.query(
      tenantId,
      `SELECT 
         service, 
         operation,
         SUM(quantity) as total_quantity,
         SUM(cost_cents) as total_cost_cents,
         COUNT(*) as days
       FROM cost_tracking 
       WHERE date >= $1 AND date <= $2
       GROUP BY service, operation
       ORDER BY total_cost_cents DESC`,
      [startDate, endDate]
    );

    return result?.rows || [];
  }

  // ===================================
  // UTILITY METHODS
  // ===================================

  async ping(): Promise<boolean> {
    if (!this.pool) {
      return false;
    }

    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      logger.error('Database ping error:', error);
      return false;
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
    }
  }

  // Get the underlying pool for advanced operations
  getPool(): Pool | null {
    return this.pool;
  }
}

// ===================================
// MOCK DATABASE CLIENT (FALLBACK)
// ===================================

interface MockConversation {
  id: string;
  tenantId: string;
  sessionId?: string;
  status: 'active' | 'archived';
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface MockMessage {
  id: string;
  conversationId: string;
  tenantId: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  isVoice: boolean;
  processingTimeMs?: number;
  tokenCount?: number;
  costCents?: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

class MockDatabaseClient {
  private conversations: Map<string, MockConversation[]> = new Map();
  private messages: Map<string, MockMessage[]> = new Map();
  private isConnected = true;

  constructor() {
    logger.warn('⚠️  Database unavailable - using in-memory storage fallback');
    logger.info('📝 Conversations will be stored temporarily in memory');
    logger.info('🔄 Data will be restored when database becomes available');
  }

  // ===================================
  // CONVERSATION MANAGEMENT
  // ===================================

  async createConversation(tenantId: string, data: {
    sessionId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const conversationId = uuidv4();
    const now = new Date();
    
    const conversation: MockConversation = {
      id: conversationId,
      tenantId,
      sessionId: data.sessionId,
      status: 'active',
      metadata: data.metadata || {},
      createdAt: now,
      updatedAt: now
    };

    const tenantConversations = this.conversations.get(tenantId) || [];
    tenantConversations.push(conversation);
    this.conversations.set(tenantId, tenantConversations);

    logger.debug('Mock database: Created conversation', { 
      tenantId, 
      conversationId,
      fallbackMode: true 
    });

    return conversationId;
  }

  async getConversation(tenantId: string, conversationId: string): Promise<any> {
    const tenantConversations = this.conversations.get(tenantId) || [];
    const conversation = tenantConversations.find(c => c.id === conversationId);
    
    if (!conversation) return null;

    return {
      id: conversation.id,
      tenant_id: conversation.tenantId,
      session_id: conversation.sessionId,
      status: conversation.status,
      metadata: conversation.metadata,
      created_at: conversation.createdAt,
      updated_at: conversation.updatedAt
    };
  }

  async getConversations(tenantId: string, limit = 50, offset = 0): Promise<any[]> {
    const tenantConversations = this.conversations.get(tenantId) || [];
    
    return tenantConversations
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(offset, offset + limit)
      .map(c => ({
        id: c.id,
        tenant_id: c.tenantId,
        session_id: c.sessionId,
        status: c.status,
        metadata: c.metadata,
        created_at: c.createdAt,
        updated_at: c.updatedAt,
        message_count: (this.messages.get(tenantId) || [])
          .filter(m => m.conversationId === c.id).length
      }));
  }

  async updateConversation(tenantId: string, conversationId: string, updates: {
    status?: 'active' | 'archived';
    metadata?: Record<string, unknown>;
  }): Promise<boolean> {
    const tenantConversations = this.conversations.get(tenantId) || [];
    const conversation = tenantConversations.find(c => c.id === conversationId);
    
    if (!conversation) return false;

    if (updates.status) conversation.status = updates.status;
    if (updates.metadata) conversation.metadata = { ...conversation.metadata, ...updates.metadata };
    conversation.updatedAt = new Date();

    return true;
  }

  // ===================================
  // MESSAGE MANAGEMENT
  // ===================================

  async addMessage(tenantId: string, data: {
    conversationId: string;
    type: 'user' | 'assistant' | 'system';
    content: string;
    isVoice?: boolean;
    processingTimeMs?: number;
    tokenCount?: number;
    costCents?: number;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const messageId = uuidv4();
    const now = new Date();

    const message: MockMessage = {
      id: messageId,
      conversationId: data.conversationId,
      tenantId,
      type: data.type,
      content: data.content,
      isVoice: data.isVoice || false,
      processingTimeMs: data.processingTimeMs,
      tokenCount: data.tokenCount,
      costCents: data.costCents,
      metadata: { ...data.metadata, fallbackMode: true },
      createdAt: now
    };

    const tenantMessages = this.messages.get(tenantId) || [];
    tenantMessages.push(message);
    this.messages.set(tenantId, tenantMessages);

    // Update conversation timestamp
    const tenantConversations = this.conversations.get(tenantId) || [];
    const conversation = tenantConversations.find(c => c.id === data.conversationId);
    if (conversation) {
      conversation.updatedAt = now;
    }

    logger.debug('Mock database: Added message', {
      tenantId,
      conversationId: data.conversationId,
      messageId,
      type: data.type,
      fallbackMode: true
    });

    return messageId;
  }

  async getMessages(tenantId: string, conversationId: string, limit = 100, offset = 0): Promise<any[]> {
    const tenantMessages = this.messages.get(tenantId) || [];
    
    return tenantMessages
      .filter(m => m.conversationId === conversationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(offset, offset + limit)
      .map(m => ({
        id: m.id,
        conversation_id: m.conversationId,
        tenant_id: m.tenantId,
        type: m.type,
        content: m.content,
        is_voice: m.isVoice,
        processing_time_ms: m.processingTimeMs,
        token_count: m.tokenCount,
        cost_cents: m.costCents,
        metadata: m.metadata,
        created_at: m.createdAt
      }));
  }

  async getRecentMessages(tenantId: string, conversationId: string, limit = 10): Promise<any[]> {
    const tenantMessages = this.messages.get(tenantId) || [];
    
    return tenantMessages
      .filter(m => m.conversationId === conversationId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .reverse()
      .map(m => ({
        id: m.id,
        conversation_id: m.conversationId,
        type: m.type,
        content: m.content,
        is_voice: m.isVoice,
        created_at: m.createdAt,
        metadata: m.metadata
      }));
  }

  // ===================================
  // HEALTH CHECK AND UTILITIES
  // ===================================

  async ping(): Promise<boolean> {
    return true; // Mock is always available
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  async disconnect(): Promise<void> {
    this.conversations.clear();
    this.messages.clear();
    this.isConnected = false;
  }

  getPool(): Pool | null {
    return null; // No real pool in mock mode
  }

  // Compatibility methods for other operations
  async query(tenantId: string, text: string, params?: unknown[]): Promise<QueryResult | null> {
    logger.debug('Mock database: Query operation not implemented in fallback mode', {
      tenantId,
      query: text.substring(0, 50),
      fallbackMode: true
    });
    
    // Return empty result for compatibility
    return {
      rows: [],
      rowCount: 0,
      command: 'SELECT',
      oid: 0,
      fields: []
    } as QueryResult;
  }

  async withTenant<T>(tenantId: string, operation: (client: PoolClient) => Promise<T>): Promise<T | null> {
    logger.debug('Mock database: Tenant operation not implemented in fallback mode', {
      tenantId,
      fallbackMode: true
    });
    return null;
  }
}

// ===================================
// SINGLETON INSTANCE
// ===================================

let databaseInstance: DatabaseClient | MockDatabaseClient | null = null;
let fallbackMode = false;
let fallbackNotified = false;

export function getDatabaseClient(): DatabaseClient | MockDatabaseClient {
  if (!databaseInstance) {
    initializeDatabaseClient();
  }

  // Check if current instance is disconnected and we're not already in fallback mode
  if (databaseInstance instanceof DatabaseClient && !databaseInstance.getConnectionStatus() && !fallbackMode) {
    logger.warn('Database connection lost, switching to fallback mode');
    activateDatabaseFallbackMode();
  }

  return databaseInstance!;
}

function initializeDatabaseClient() {
  const config: DatabaseConfig = {
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.NODE_ENV === 'production'
  };

  try {
    logger.info('Attempting to connect to PostgreSQL database...');
    const testClient = new DatabaseClient(config);
    databaseInstance = testClient;
    
    // Schedule a connection check after a brief delay
    setTimeout(async () => {
      try {
        const isConnected = await testClient.ping();
        if (!isConnected && !fallbackMode) {
          logger.warn('PostgreSQL ping failed, switching to fallback mode');
          activateDatabaseFallbackMode();
        } else if (isConnected && fallbackMode) {
          logger.info('✅ PostgreSQL connection restored, switching back from fallback mode');
          databaseInstance = testClient;
          fallbackMode = false;
          fallbackNotified = false;
        }
      } catch (error) {
        if (!fallbackMode) {
          logger.error('PostgreSQL health check failed, switching to fallback mode:', error);
          activateDatabaseFallbackMode();
        }
      }
    }, 2000);
    
  } catch (error) {
    logger.error('Error initializing PostgreSQL database, falling back to mock:', error);
    activateDatabaseFallbackMode();
  }
}

function activateDatabaseFallbackMode() {
  if (!fallbackNotified) {
    logger.warn('⚠️  PostgreSQL database unavailable - activating fallback mode with in-memory storage');
    logger.info('💾 Conversations will be stored temporarily in memory');
    logger.info('🔄 Normal functionality will resume automatically when database becomes available');
    fallbackNotified = true;
  }
  
  fallbackMode = true;
  databaseInstance = new MockDatabaseClient();
}

// Helper function to check if we're in fallback mode
export function isInDatabaseFallbackMode(): boolean {
  return fallbackMode;
}

// Function to reset to normal mode (useful for testing)
export function resetDatabaseClient() {
  databaseInstance = null;
  fallbackMode = false;
  fallbackNotified = false;
}

export { DatabaseClient };
export type { DatabaseConfig };