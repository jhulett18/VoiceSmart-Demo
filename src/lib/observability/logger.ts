import pino from 'pino';

interface LoggerConfig {
  level?: string;
  environment?: string;
  service?: string;
  redactPaths?: string[];
}

class Logger {
  private pino: pino.Logger;

  constructor(config: LoggerConfig = {}) {
    const {
      level = process.env.LOG_LEVEL || 'info',
      environment = process.env.NODE_ENV || 'development',
      service = process.env.OTEL_SERVICE_NAME || 'voicesmart-demo',
      redactPaths = [
        'password',
        'apiKey',
        'token',
        'authorization',
        'secret',
        'key',
        'credentials'
      ]
    } = config;

    const isDevelopment = environment === 'development';

    try {
      this.pino = pino({
        level,
        redact: {
          paths: redactPaths,
          censor: '[REDACTED]'
        },
        formatters: {
          level: (label) => ({ level: label }),
          bindings: () => ({
            service,
            environment,
            pid: process.pid,
            hostname: process.env.HOSTNAME || 'localhost'
          })
        },
        timestamp: pino.stdTimeFunctions.isoTime
        // Removed pino-pretty transport to prevent worker crashes
        // Raw JSON logs are more stable for high-volume logging
      });
    } catch (error) {
      // Fallback to basic console logging if pino fails
      console.warn('Failed to initialize pino logger, falling back to console:', error);
      this.pino = pino({
        level: 'info',
        timestamp: pino.stdTimeFunctions.isoTime
      });
    }
  }

  // ===================================
  // CORE LOGGING METHODS
  // ===================================

  trace(msg: string, obj?: object): void {
    this.pino.trace(obj, msg);
  }

  debug(msg: string, obj?: object): void {
    this.pino.debug(obj, msg);
  }

  info(msg: string, obj?: object): void {
    try {
      this.pino.info(obj, msg);
    } catch (error) {
      console.info(`[INFO] ${msg}`, obj || '');
    }
  }

  warn(msg: string, obj?: object): void {
    this.pino.warn(obj, msg);
  }

  error(msg: string, obj?: object | Error): void {
    try {
      if (obj instanceof Error) {
        this.pino.error({
          error: {
            name: obj.name,
            message: obj.message,
            stack: obj.stack
          }
        }, msg);
      } else {
        this.pino.error(obj, msg);
      }
    } catch (error) {
      console.error(`[ERROR] ${msg}`, obj || '');
    }
  }

  fatal(msg: string, obj?: object | Error): void {
    if (obj instanceof Error) {
      this.pino.fatal({
        error: {
          name: obj.name,
          message: obj.message,
          stack: obj.stack
        }
      }, msg);
    } else {
      this.pino.fatal(obj, msg);
    }
  }

  // ===================================
  // VOICE-SPECIFIC LOGGING
  // ===================================

  voiceInteraction(data: {
    tenantId: string;
    conversationId: string;
    sessionId: string;
    event: 'started' | 'recording' | 'processing' | 'responding' | 'completed' | 'error';
    duration?: number;
    tokenCount?: number;
    costCents?: number;
    metadata?: object;
  }): void {
    this.info('Voice interaction event', {
      component: 'voice',
      ...data
    });
  }

  llmRequest(data: {
    tenantId: string;
    conversationId: string;
    model: string;
    tokens: { prompt: number; completion: number; total: number };
    duration: number;
    costCents: number;
    success: boolean;
    error?: string;
  }): void {
    this.info('LLM API request', {
      component: 'llm',
      ...data
    });
  }

  integrationCall(data: {
    tenantId: string;
    conversationId?: string;
    integration: string;
    method: string;
    endpoint: string;
    statusCode: number;
    duration: number;
    success: boolean;
    idempotencyKey?: string;
    error?: string;
  }): void {
    this.info('Integration API call', {
      component: 'integration',
      ...data
    });
  }

  databaseOperation(data: {
    tenantId: string;
    operation: string;
    table: string;
    duration: number;
    success: boolean;
    rowCount?: number;
    error?: string;
  }): void {
    this.debug('Database operation', {
      component: 'database',
      ...data
    });
  }

  cacheOperation(data: {
    tenantId: string;
    operation: 'hit' | 'miss' | 'set' | 'delete';
    key: string;
    duration?: number;
    success: boolean;
    error?: string;
  }): void {
    this.debug('Cache operation', {
      component: 'cache',
      ...data
    });
  }

  // ===================================
  // PERFORMANCE TRACKING
  // ===================================

  performanceMetric(data: {
    tenantId: string;
    metric: string;
    value: number;
    unit: string;
    labels?: Record<string, string>;
  }): void {
    this.info('Performance metric', {
      component: 'metrics',
      ...data
    });
  }

  rateLimitHit(data: {
    tenantId: string;
    identifier: string;
    limit: number;
    current: number;
    windowSeconds: number;
  }): void {
    this.warn('Rate limit exceeded', {
      component: 'rate_limit',
      ...data
    });
  }

  // ===================================
  // SECURITY & AUDIT
  // ===================================

  securityEvent(data: {
    tenantId?: string;
    event: 'auth_success' | 'auth_failure' | 'permission_denied' | 'suspicious_activity';
    userId?: string;
    ip?: string;
    userAgent?: string;
    details?: object;
  }): void {
    this.warn('Security event', {
      component: 'security',
      ...data
    });
  }

  auditLog(data: {
    tenantId: string;
    userId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    success: boolean;
    ip?: string;
    userAgent?: string;
    metadata?: object;
  }): void {
    this.info('Audit log entry', {
      component: 'audit',
      ...data
    });
  }

  // ===================================
  // UTILITY METHODS
  // ===================================

  child(bindings: object): Logger {
    const childPino = this.pino.child(bindings);
    const childLogger = Object.create(this);
    childLogger.pino = childPino;
    return childLogger;
  }

  flush(): void {
    this.pino.flush();
  }

  level(level: string): void {
    this.pino.level = level;
  }

  // Get the underlying pino instance for advanced usage
  getPino(): pino.Logger {
    return this.pino;
  }
}

// ===================================
// SINGLETON INSTANCE
// ===================================

let loggerInstance: Logger | null = null;

export function getLogger(): Logger {
  if (!loggerInstance) {
    loggerInstance = new Logger();
  }
  return loggerInstance;
}

// Export the default logger instance
export const logger = getLogger();

export { Logger };
export type { LoggerConfig };