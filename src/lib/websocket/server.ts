import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { parse } from 'url';
import { logger } from '../observability/logger';
import { getRedisClient } from '../memory/redis';
import { getDatabaseClient } from '../memory/database';

interface ClientConnection {
  id: string;
  tenantId: string;
  sessionId: string;
  conversationId?: string;
  lastActivity: Date;
  metadata: {
    userAgent?: string;
    ip?: string;
    businessType?: string;
  };
}

interface VoiceMessage {
  type: 'audio_chunk' | 'audio_start' | 'audio_end' | 'transcript_partial' | 'transcript_final' | 'response_start' | 'response_chunk' | 'response_end' | 'error' | 'ping' | 'pong';
  sessionId: string;
  conversationId?: string;
  data?: any;
  timestamp: number;
  messageId: string;
}

class VoiceWebSocketServer {
  private wss: WebSocketServer | null = null;
  private server: any = null;
  private clients = new Map<string, { ws: WebSocket; connection: ClientConnection }>();
  private redis = getRedisClient();
  private db = getDatabaseClient();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(private config: {
    port: number;
    host: string;
    pingInterval?: number;
    maxConnections?: number;
  }) {}

  start(): void {
    try {
      // Create HTTP server for WebSocket upgrade
      this.server = createServer();
      
      // Create WebSocket server
      this.wss = new WebSocketServer({
        server: this.server,
        path: '/voice',
        perMessageDeflate: {
          // Enable compression for text messages
          zlibDeflateOptions: {
            level: 3,
          },
        },
        maxPayload: 16 * 1024 * 1024, // 16MB max for audio chunks
      });

      this.setupWebSocketHandlers();
      this.startHeartbeat();

      // Start HTTP server
      this.server.listen(this.config.port, this.config.host, () => {
        logger.info('Voice WebSocket server started', {
          host: this.config.host,
          port: this.config.port,
          path: '/voice'
        });
      });

    } catch (error) {
      logger.error('Failed to start WebSocket server:', error);
      throw error;
    }
  }

  private setupWebSocketHandlers(): void {
    if (!this.wss) return;

    this.wss.on('connection', (ws: WebSocket, request) => {
      this.handleConnection(ws, request);
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error:', error);
    });
  }

  private async handleConnection(ws: WebSocket, request: any): Promise<void> {
    try {
      // Parse connection parameters
      const url = parse(request.url, true);
      const tenantId = url.query.tenantId as string;
      const sessionId = url.query.sessionId as string;

      if (!tenantId || !sessionId) {
        logger.warn('WebSocket connection rejected - missing parameters', {
          tenantId,
          sessionId,
          ip: this.getClientIP(request)
        });
        ws.close(1008, 'Missing required parameters');
        return;
      }

      // Check connection limits
      if (this.clients.size >= (this.config.maxConnections || 1000)) {
        logger.warn('WebSocket connection rejected - max connections reached', {
          currentConnections: this.clients.size,
          limit: this.config.maxConnections
        });
        ws.close(1013, 'Server overloaded');
        return;
      }

      // Create client connection
      const clientId = `${tenantId}_${sessionId}_${Date.now()}`;
      const connection: ClientConnection = {
        id: clientId,
        tenantId,
        sessionId,
        lastActivity: new Date(),
        metadata: {
          userAgent: request.headers['user-agent'],
          ip: this.getClientIP(request)
        }
      };

      // Store client
      this.clients.set(clientId, { ws, connection });

      logger.info('WebSocket client connected', {
        clientId,
        tenantId,
        sessionId,
        totalConnections: this.clients.size,
        ip: connection.metadata.ip
      });

      // Set up message handlers
      ws.on('message', (data) => {
        this.handleMessage(clientId, data);
      });

      ws.on('close', (code, reason) => {
        this.handleDisconnection(clientId, code, reason);
      });

      ws.on('error', (error) => {
        logger.error('WebSocket client error:', {
          clientId,
          error: error.message
        });
      });

      ws.on('pong', () => {
        this.updateClientActivity(clientId);
      });

      // Send welcome message
      this.sendMessage(clientId, {
        type: 'connection_established',
        sessionId,
        data: { clientId, serverTime: Date.now() },
        timestamp: Date.now(),
        messageId: this.generateMessageId()
      });

      // Store session in Redis
      await this.redis.setSession(tenantId, sessionId, {
        clientId,
        connectedAt: new Date().toISOString(),
        status: 'connected'
      }, 3600); // 1 hour TTL

    } catch (error) {
      logger.error('Error handling WebSocket connection:', error);
      ws.close(1011, 'Internal server error');
    }
  }

  private async handleMessage(clientId: string, data: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    this.updateClientActivity(clientId);

    try {
      let message: VoiceMessage;

      // Handle both text and binary messages
      if (data instanceof Buffer) {
        // Binary audio data
        message = {
          type: 'audio_chunk',
          sessionId: client.connection.sessionId,
          data: data,
          timestamp: Date.now(),
          messageId: this.generateMessageId()
        };
      } else {
        // Text message (JSON)
        message = JSON.parse(data.toString());
      }

      logger.debug('Received WebSocket message', {
        clientId,
        messageType: message.type,
        sessionId: message.sessionId,
        dataSize: message.data ? JSON.stringify(message.data).length : 0
      });

      await this.processMessage(clientId, message);

    } catch (error) {
      logger.error('Error processing WebSocket message:', {
        clientId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      this.sendError(clientId, 'Invalid message format');
    }
  }

  private async processMessage(clientId: string, message: VoiceMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { tenantId, sessionId } = client.connection;

    switch (message.type) {
      case 'ping':
        this.sendMessage(clientId, {
          type: 'pong',
          sessionId,
          timestamp: Date.now(),
          messageId: this.generateMessageId()
        });
        break;

      case 'audio_start':
        logger.debug('Audio recording started', {
          clientId,
          tenantId,
          sessionId
        });

        // Update session status
        await this.redis.setSession(tenantId, sessionId, {
          clientId,
          status: 'recording',
          recordingStarted: new Date().toISOString()
        }, 3600);
        break;

      case 'audio_chunk':
        // Forward audio chunk to speech recognition service
        await this.processAudioChunk(clientId, message);
        break;

      case 'audio_end':
        logger.debug('Audio recording ended', {
          clientId,
          tenantId,
          sessionId
        });

        // Update session status
        await this.redis.setSession(tenantId, sessionId, {
          clientId,
          status: 'processing',
          recordingEnded: new Date().toISOString()
        }, 3600);
        break;

      case 'transcript_final':
        await this.processTranscript(clientId, message);
        break;

      default:
        logger.warn('Unknown message type received', {
          clientId,
          messageType: message.type
        });
    }
  }

  private async processAudioChunk(clientId: string, message: VoiceMessage): Promise<void> {
    // For now, we'll just acknowledge receipt
    // In a full implementation, this would:
    // 1. Forward to speech recognition service
    // 2. Stream partial transcripts back
    // 3. Detect voice activity

    const client = this.clients.get(clientId);
    if (!client) return;

    logger.debug('Processing audio chunk', {
      clientId,
      chunkSize: message.data?.length || 0,
      sessionId: message.sessionId
    });

    // Store audio metadata in Redis for session tracking
    await this.redis.set(
      client.connection.tenantId,
      `audio_activity:${message.sessionId}`,
      JSON.stringify({
        lastChunk: Date.now(),
        chunkCount: await this.incrementAudioChunkCount(client.connection.tenantId, message.sessionId)
      }),
      300 // 5 minute TTL
    );
  }

  private async processTranscript(clientId: string, message: VoiceMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { tenantId, sessionId } = client.connection;

    logger.info('Processing final transcript', {
      clientId,
      tenantId,
      sessionId,
      transcript: message.data?.transcript?.substring(0, 100) + '...'
    });

    try {
      // Create or get conversation
      let conversationId = client.connection.conversationId;
      if (!conversationId) {
        conversationId = await this.db.createConversation(tenantId, {
          sessionId,
          metadata: {
            source: 'websocket',
            clientId
          }
        });
        
        if (conversationId) {
          client.connection.conversationId = conversationId;
        }
      }

      // Store user message
      if (conversationId && message.data?.transcript) {
        await this.db.addMessage(tenantId, {
          conversationId,
          type: 'user',
          content: message.data.transcript,
          isVoice: true,
          metadata: {
            source: 'websocket',
            confidence: message.data.confidence || 1.0
          }
        });
      }

      // Send acknowledgment
      this.sendMessage(clientId, {
        type: 'transcript_received',
        sessionId,
        conversationId,
        data: { messageId: message.messageId },
        timestamp: Date.now(),
        messageId: this.generateMessageId()
      });

    } catch (error) {
      logger.error('Error processing transcript:', error);
      this.sendError(clientId, 'Failed to process transcript');
    }
  }

  private handleDisconnection(clientId: string, code: number, reason: Buffer): void {
    const client = this.clients.get(clientId);
    if (client) {
      logger.info('WebSocket client disconnected', {
        clientId,
        tenantId: client.connection.tenantId,
        sessionId: client.connection.sessionId,
        code,
        reason: reason.toString(),
        duration: Date.now() - client.connection.lastActivity.getTime()
      });

      // Update session status in Redis
      this.redis.setSession(client.connection.tenantId, client.connection.sessionId, {
        clientId,
        status: 'disconnected',
        disconnectedAt: new Date().toISOString()
      }, 86400); // Keep for 24 hours for debugging

      this.clients.delete(clientId);
    }
  }

  // ===================================
  // MESSAGE SENDING METHODS
  // ===================================

  private sendMessage(clientId: string, message: VoiceMessage): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error('Failed to send WebSocket message:', {
        clientId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private sendError(clientId: string, errorMessage: string): void {
    this.sendMessage(clientId, {
      type: 'error',
      sessionId: this.clients.get(clientId)?.connection.sessionId || '',
      data: { error: errorMessage },
      timestamp: Date.now(),
      messageId: this.generateMessageId()
    });
  }

  sendToSession(tenantId: string, sessionId: string, message: Omit<VoiceMessage, 'sessionId' | 'timestamp' | 'messageId'>): void {
    // Find client by session
    for (const [clientId, client] of this.clients.entries()) {
      if (client.connection.tenantId === tenantId && client.connection.sessionId === sessionId) {
        this.sendMessage(clientId, {
          ...message,
          sessionId,
          timestamp: Date.now(),
          messageId: this.generateMessageId()
        });
        break;
      }
    }
  }

  // ===================================
  // UTILITY METHODS
  // ===================================

  private startHeartbeat(): void {
    const interval = this.config.pingInterval || 30000; // 30 seconds

    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeat();
    }, interval);

    logger.debug('Started WebSocket heartbeat', { interval });
  }

  private performHeartbeat(): void {
    const now = Date.now();
    const timeout = 60000; // 1 minute timeout

    for (const [clientId, client] of this.clients.entries()) {
      const timeSinceLastActivity = now - client.connection.lastActivity.getTime();

      if (timeSinceLastActivity > timeout) {
        logger.warn('Client connection timeout', {
          clientId,
          timeSinceLastActivity
        });
        client.ws.terminate();
        this.clients.delete(clientId);
      } else if (client.ws.readyState === WebSocket.OPEN) {
        // Send ping
        client.ws.ping();
      }
    }
  }

  private updateClientActivity(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.connection.lastActivity = new Date();
    }
  }

  private getClientIP(request: any): string {
    return request.headers['x-forwarded-for']?.split(',')[0] ||
           request.headers['x-real-ip'] ||
           request.connection.remoteAddress ||
           'unknown';
  }

  private generateMessageId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private async incrementAudioChunkCount(tenantId: string, sessionId: string): Promise<number> {
    const key = `audio_chunks:${sessionId}`;
    const result = await this.redis.getClient()?.incr(this.redis['getTenantKey'](tenantId, key));
    return result || 1;
  }

  // ===================================
  // SERVER MANAGEMENT
  // ===================================

  getConnectionStats(): {
    totalConnections: number;
    connectionsByTenant: Record<string, number>;
    uptime: number;
  } {
    const connectionsByTenant: Record<string, number> = {};

    for (const client of this.clients.values()) {
      const tenantId = client.connection.tenantId;
      connectionsByTenant[tenantId] = (connectionsByTenant[tenantId] || 0) + 1;
    }

    return {
      totalConnections: this.clients.size,
      connectionsByTenant,
      uptime: process.uptime()
    };
  }

  async stop(): Promise<void> {
    logger.info('Stopping WebSocket server');

    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all client connections
    for (const [clientId, client] of this.clients.entries()) {
      client.ws.close(1001, 'Server shutdown');
    }
    this.clients.clear();

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }

    // Close HTTP server
    if (this.server) {
      this.server.close();
    }

    logger.info('WebSocket server stopped');
  }
}

// ===================================
// SINGLETON INSTANCE
// ===================================

let wsServerInstance: VoiceWebSocketServer | null = null;

export function getVoiceWebSocketServer(): VoiceWebSocketServer {
  if (!wsServerInstance) {
    const config = {
      port: parseInt(process.env.WS_PORT || '3001'),
      host: process.env.WS_HOST || 'localhost',
      pingInterval: 30000,
      maxConnections: 1000
    };

    wsServerInstance = new VoiceWebSocketServer(config);
  }

  return wsServerInstance;
}

export { VoiceWebSocketServer };
export type { ClientConnection, VoiceMessage };