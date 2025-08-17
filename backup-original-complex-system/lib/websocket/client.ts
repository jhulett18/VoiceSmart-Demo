'use client';

import { logger } from '../observability/logger';

interface VoiceWebSocketConfig {
  url: string;
  tenantId: string;
  sessionId: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
}

interface VoiceMessage {
  type: string;
  sessionId: string;
  conversationId?: string;
  data?: any;
  timestamp: number;
  messageId: string;
}

type MessageHandler = (message: VoiceMessage) => void;
type ConnectionHandler = () => void;
type ErrorHandler = (error: Error) => void;

class VoiceWebSocketClient {
  private ws: WebSocket | null = null;
  private config: VoiceWebSocketConfig;
  private messageHandlers = new Map<string, MessageHandler[]>();
  private connectionHandlers: ConnectionHandler[] = [];
  private disconnectionHandlers: ConnectionHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];
  
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private isManualClose = false;
  private lastPingTime = 0;

  constructor(config: VoiceWebSocketConfig) {
    this.config = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 5,
      pingInterval: 30000,
      ...config
    };
  }

  // ===================================
  // CONNECTION MANAGEMENT
  // ===================================

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.isManualClose = false;
        const wsUrl = `${this.config.url}?tenantId=${this.config.tenantId}&sessionId=${this.config.sessionId}`;
        
        logger.debug('Connecting to voice WebSocket', {
          url: wsUrl,
          tenantId: this.config.tenantId,
          sessionId: this.config.sessionId
        });

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          logger.info('Voice WebSocket connected');
          this.reconnectAttempts = 0;
          this.startPingInterval();
          this.notifyConnectionHandlers();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onclose = (event) => {
          this.handleClose(event);
        };

        this.ws.onerror = (event) => {
          logger.error('Voice WebSocket error:', event);
          const error = new Error('WebSocket connection error');
          this.notifyErrorHandlers(error);
          reject(error);
        };

      } catch (error) {
        logger.error('Failed to create WebSocket connection:', error);
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.isManualClose = true;
    this.stopPingInterval();
    this.stopReconnectTimer();

    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }

    logger.info('Voice WebSocket manually disconnected');
  }

  reconnect(): void {
    if (this.isManualClose) {
      return;
    }

    if (this.reconnectAttempts >= (this.config.maxReconnectAttempts || 5)) {
      logger.error('Max reconnection attempts reached');
      const error = new Error('Failed to reconnect after maximum attempts');
      this.notifyErrorHandlers(error);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval! * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    logger.info('Attempting to reconnect', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.config.maxReconnectAttempts,
      delay
    });

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        logger.error('Reconnection failed:', error);
        this.reconnect(); // Try again
      });
    }, delay);
  }

  // ===================================
  // MESSAGE HANDLING
  // ===================================

  private handleMessage(event: MessageEvent): void {
    try {
      const message: VoiceMessage = JSON.parse(event.data);
      
      logger.debug('Received WebSocket message', {
        type: message.type,
        messageId: message.messageId,
        timestamp: message.timestamp
      });

      // Handle system messages
      switch (message.type) {
        case 'pong':
          this.handlePong();
          break;
        case 'connection_established':
          logger.info('WebSocket connection established', message.data);
          break;
        case 'error':
          logger.error('Server error:', message.data);
          const error = new Error(message.data?.error || 'Unknown server error');
          this.notifyErrorHandlers(error);
          break;
        default:
          // Notify message handlers
          this.notifyMessageHandlers(message.type, message);
      }

    } catch (error) {
      logger.error('Failed to parse WebSocket message:', error);
    }
  }

  private handleClose(event: CloseEvent): void {
    this.stopPingInterval();

    logger.warn('Voice WebSocket closed', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean
    });

    this.notifyDisconnectionHandlers();

    // Attempt reconnection if not manually closed
    if (!this.isManualClose && event.code !== 1000) {
      this.reconnect();
    }
  }

  private handlePong(): void {
    const now = Date.now();
    const latency = now - this.lastPingTime;
    
    logger.debug('Received pong', { latency });
  }

  // ===================================
  // MESSAGE SENDING
  // ===================================

  send(message: Omit<VoiceMessage, 'sessionId' | 'timestamp' | 'messageId'>): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('Cannot send message - WebSocket not connected');
      return false;
    }

    try {
      const fullMessage: VoiceMessage = {
        ...message,
        sessionId: this.config.sessionId,
        timestamp: Date.now(),
        messageId: this.generateMessageId()
      };

      this.ws.send(JSON.stringify(fullMessage));
      
      logger.debug('Sent WebSocket message', {
        type: message.type,
        messageId: fullMessage.messageId
      });

      return true;
    } catch (error) {
      logger.error('Failed to send WebSocket message:', error);
      return false;
    }
  }

  sendAudioChunk(audioData: ArrayBuffer): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      // Send binary audio data directly
      this.ws.send(audioData);
      return true;
    } catch (error) {
      logger.error('Failed to send audio chunk:', error);
      return false;
    }
  }

  startAudioSession(conversationId?: string): boolean {
    return this.send({
      type: 'audio_start',
      conversationId,
      data: { startTime: Date.now() }
    });
  }

  endAudioSession(conversationId?: string): boolean {
    return this.send({
      type: 'audio_end',
      conversationId,
      data: { endTime: Date.now() }
    });
  }

  sendTranscript(transcript: string, isFinal: boolean, confidence?: number, conversationId?: string): boolean {
    return this.send({
      type: isFinal ? 'transcript_final' : 'transcript_partial',
      conversationId,
      data: {
        transcript,
        confidence: confidence || 1.0,
        isFinal
      }
    });
  }

  // ===================================
  // EVENT HANDLERS
  // ===================================

  onMessage(messageType: string, handler: MessageHandler): void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType)!.push(handler);
  }

  onConnect(handler: ConnectionHandler): void {
    this.connectionHandlers.push(handler);
  }

  onDisconnect(handler: ConnectionHandler): void {
    this.disconnectionHandlers.push(handler);
  }

  onError(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  offMessage(messageType: string, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private notifyMessageHandlers(messageType: string, message: VoiceMessage): void {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          logger.error('Error in message handler:', error);
        }
      });
    }
  }

  private notifyConnectionHandlers(): void {
    this.connectionHandlers.forEach(handler => {
      try {
        handler();
      } catch (error) {
        logger.error('Error in connection handler:', error);
      }
    });
  }

  private notifyDisconnectionHandlers(): void {
    this.disconnectionHandlers.forEach(handler => {
      try {
        handler();
      } catch (error) {
        logger.error('Error in disconnection handler:', error);
      }
    });
  }

  private notifyErrorHandlers(error: Error): void {
    this.errorHandlers.forEach(handler => {
      try {
        handler(error);
      } catch (handlerError) {
        logger.error('Error in error handler:', handlerError);
      }
    });
  }

  // ===================================
  // PING/PONG MANAGEMENT
  // ===================================

  private startPingInterval(): void {
    this.stopPingInterval();

    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.lastPingTime = Date.now();
        this.send({ type: 'ping' });
      }
    }, this.config.pingInterval!);
  }

  private stopPingInterval(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private stopReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ===================================
  // UTILITY METHODS
  // ===================================

  private generateMessageId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  getConnectionState(): string {
    if (!this.ws) return 'DISCONNECTED';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'CONNECTING';
      case WebSocket.OPEN: return 'CONNECTED';
      case WebSocket.CLOSING: return 'CLOSING';
      case WebSocket.CLOSED: return 'DISCONNECTED';
      default: return 'UNKNOWN';
    }
  }

  getConnectionInfo(): {
    state: string;
    reconnectAttempts: number;
    config: VoiceWebSocketConfig;
  } {
    return {
      state: this.getConnectionState(),
      reconnectAttempts: this.reconnectAttempts,
      config: this.config
    };
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export { VoiceWebSocketClient };
export type { VoiceWebSocketConfig, VoiceMessage, MessageHandler, ConnectionHandler, ErrorHandler };