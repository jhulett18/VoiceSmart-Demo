import { logger } from '../observability/logger';
import { getDatabaseClient } from '../memory/database';

interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account' | 'digital_wallet';
  last4?: string;
  brand?: string; // visa, mastercard, etc.
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  customerId: string;
  createdAt: Date;
}

interface PaymentIntent {
  id: string;
  amount: number; // in cents
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'processing' | 'succeeded' | 'canceled' | 'failed';
  customerId?: string;
  paymentMethodId?: string;
  description?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

interface Subscription {
  id: string;
  customerId: string;
  priceId: string;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Invoice {
  id: string;
  customerId: string;
  subscriptionId?: string;
  amount: number; // in cents
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  dueDate: Date;
  paidAt?: Date;
  description?: string;
  lineItems: InvoiceLineItem[];
  createdAt: Date;
}

interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitAmount: number; // in cents
  totalAmount: number; // in cents
}

interface RefundRequest {
  paymentIntentId: string;
  amount?: number; // in cents, if partial refund
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer' | 'other';
  metadata?: Record<string, any>;
}

interface PaymentPlan {
  id: string;
  name: string;
  amount: number; // in cents
  currency: string;
  interval: 'month' | 'year' | 'week';
  intervalCount: number;
  description?: string;
  features: string[];
  isActive: boolean;
}

class MockPaymentIntegration {
  private db = getDatabaseClient();
  private paymentMethods = new Map<string, PaymentMethod>();
  private paymentIntents = new Map<string, PaymentIntent>();
  private subscriptions = new Map<string, Subscription>();
  private invoices = new Map<string, Invoice>();
  private plans = new Map<string, PaymentPlan>();

  constructor() {
    this.seedMockData();
  }

  private seedMockData(): void {
    // Seed mock payment plans
    const mockPlans: PaymentPlan[] = [
      {
        id: 'plan_dental_cleaning',
        name: 'Dental Cleaning Package',
        amount: 15000, // $150.00
        currency: 'usd',
        interval: 'month',
        intervalCount: 6, // Every 6 months
        description: 'Bi-annual dental cleaning and examination',
        features: ['Professional cleaning', 'Oral examination', 'X-rays', 'Fluoride treatment'],
        isActive: true
      },
      {
        id: 'plan_auto_maintenance',
        name: 'Auto Maintenance Plan',
        amount: 9999, // $99.99
        currency: 'usd',
        interval: 'month',
        intervalCount: 3, // Every 3 months
        description: 'Quarterly vehicle maintenance package',
        features: ['Oil change', 'Brake inspection', 'Tire rotation', 'Fluid top-off'],
        isActive: true
      },
      {
        id: 'plan_gym_premium',
        name: 'Premium Gym Membership',
        amount: 7999, // $79.99
        currency: 'usd',
        interval: 'month',
        intervalCount: 1,
        description: 'Full access gym membership with personal training',
        features: ['24/7 gym access', '2 personal training sessions', 'Group classes', 'Nutrition consultation'],
        isActive: true
      }
    ];

    mockPlans.forEach(plan => {
      this.plans.set(plan.id, plan);
    });

    logger.info('Mock payment data seeded', {
      planCount: this.plans.size
    });
  }

  // ===================================
  // PAYMENT INTENT MANAGEMENT
  // ===================================

  async createPaymentIntent(
    tenantId: string,
    amount: number,
    currency: string = 'usd',
    options: {
      customerId?: string;
      description?: string;
      metadata?: Record<string, any>;
      conversationId?: string;
    } = {}
  ): Promise<{ success: boolean; paymentIntent?: PaymentIntent; error?: string }> {
    const startTime = Date.now();

    try {
      const paymentIntentId = `pi_mock_${Date.now()}`;
      const now = new Date();

      const paymentIntent: PaymentIntent = {
        id: paymentIntentId,
        amount,
        currency,
        status: 'requires_payment_method',
        customerId: options.customerId,
        description: options.description,
        metadata: options.metadata || {},
        createdAt: now,
        updatedAt: now
      };

      this.paymentIntents.set(paymentIntentId, paymentIntent);

      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId: options.conversationId,
        integrationType: 'payments',
        method: 'POST',
        endpoint: 'payment_intents.create',
        requestData: { amount, currency, options },
        responseData: { paymentIntentId, status: paymentIntent.status },
        statusCode: 200,
        processingTimeMs: processingTime
      });

      logger.info('Mock payment intent created', {
        tenantId,
        paymentIntentId,
        amount,
        currency,
        customerId: options.customerId
      });

      return { success: true, paymentIntent };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId: options.conversationId,
        integrationType: 'payments',
        method: 'POST',
        endpoint: 'payment_intents.create',
        requestData: { amount, currency, options },
        responseData: { error: error instanceof Error ? error.message : 'Unknown error' },
        statusCode: 500,
        processingTimeMs: processingTime
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async confirmPaymentIntent(
    tenantId: string,
    paymentIntentId: string,
    paymentMethodId: string,
    conversationId?: string
  ): Promise<{ success: boolean; paymentIntent?: PaymentIntent; error?: string }> {
    const startTime = Date.now();

    try {
      const paymentIntent = this.paymentIntents.get(paymentIntentId);
      if (!paymentIntent) {
        return { success: false, error: 'Payment intent not found' };
      }

      // Simulate payment processing
      const isSuccessful = Math.random() > 0.1; // 90% success rate

      paymentIntent.paymentMethodId = paymentMethodId;
      paymentIntent.status = isSuccessful ? 'succeeded' : 'failed';
      paymentIntent.updatedAt = new Date();

      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'payments',
        method: 'POST',
        endpoint: 'payment_intents.confirm',
        requestData: { paymentIntentId, paymentMethodId },
        responseData: { status: paymentIntent.status },
        statusCode: isSuccessful ? 200 : 400,
        processingTimeMs: processingTime
      });

      logger.info('Mock payment intent confirmed', {
        tenantId,
        paymentIntentId,
        status: paymentIntent.status,
        amount: paymentIntent.amount
      });

      return { success: isSuccessful, paymentIntent };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'payments',
        method: 'POST',
        endpoint: 'payment_intents.confirm',
        requestData: { paymentIntentId, paymentMethodId },
        responseData: { error: error instanceof Error ? error.message : 'Unknown error' },
        statusCode: 500,
        processingTimeMs: processingTime
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ===================================
  // PAYMENT METHOD MANAGEMENT
  // ===================================

  async createPaymentMethod(
    tenantId: string,
    customerId: string,
    paymentMethodData: {
      type: PaymentMethod['type'];
      cardData?: {
        number: string;
        expiryMonth: number;
        expiryYear: number;
        cvc: string;
      };
    },
    conversationId?: string
  ): Promise<{ success: boolean; paymentMethod?: PaymentMethod; error?: string }> {
    const startTime = Date.now();

    try {
      const paymentMethodId = `pm_mock_${Date.now()}`;
      
      let last4: string | undefined;
      let brand: string | undefined;
      let expiryMonth: number | undefined;
      let expiryYear: number | undefined;

      if (paymentMethodData.type === 'card' && paymentMethodData.cardData) {
        last4 = paymentMethodData.cardData.number.slice(-4);
        brand = this.detectCardBrand(paymentMethodData.cardData.number);
        expiryMonth = paymentMethodData.cardData.expiryMonth;
        expiryYear = paymentMethodData.cardData.expiryYear;
      }

      const paymentMethod: PaymentMethod = {
        id: paymentMethodId,
        type: paymentMethodData.type,
        last4,
        brand,
        expiryMonth,
        expiryYear,
        isDefault: false,
        customerId,
        createdAt: new Date()
      };

      this.paymentMethods.set(paymentMethodId, paymentMethod);

      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'payments',
        method: 'POST',
        endpoint: 'payment_methods.create',
        requestData: { customerId, type: paymentMethodData.type },
        responseData: { paymentMethodId },
        statusCode: 200,
        processingTimeMs: processingTime
      });

      return { success: true, paymentMethod };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'payments',
        method: 'POST',
        endpoint: 'payment_methods.create',
        requestData: { customerId },
        responseData: { error: error instanceof Error ? error.message : 'Unknown error' },
        statusCode: 500,
        processingTimeMs: processingTime
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getCustomerPaymentMethods(
    tenantId: string,
    customerId: string,
    conversationId?: string
  ): Promise<{ success: boolean; paymentMethods?: PaymentMethod[]; error?: string }> {
    const startTime = Date.now();

    try {
      const paymentMethods = Array.from(this.paymentMethods.values())
        .filter(pm => pm.customerId === customerId);

      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'payments',
        method: 'GET',
        endpoint: 'payment_methods.list',
        requestData: { customerId },
        responseData: { count: paymentMethods.length },
        statusCode: 200,
        processingTimeMs: processingTime
      });

      return { success: true, paymentMethods };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'payments',
        method: 'GET',
        endpoint: 'payment_methods.list',
        requestData: { customerId },
        responseData: { error: error instanceof Error ? error.message : 'Unknown error' },
        statusCode: 500,
        processingTimeMs: processingTime
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ===================================
  // SUBSCRIPTION MANAGEMENT
  // ===================================

  async createSubscription(
    tenantId: string,
    customerId: string,
    priceId: string,
    options: {
      paymentMethodId?: string;
      trialDays?: number;
      conversationId?: string;
    } = {}
  ): Promise<{ success: boolean; subscription?: Subscription; error?: string }> {
    const startTime = Date.now();

    try {
      const subscriptionId = `sub_mock_${Date.now()}`;
      const now = new Date();
      
      let trialStart: Date | undefined;
      let trialEnd: Date | undefined;
      
      if (options.trialDays && options.trialDays > 0) {
        trialStart = now;
        trialEnd = new Date(now.getTime() + options.trialDays * 24 * 60 * 60 * 1000);
      }

      const subscription: Subscription = {
        id: subscriptionId,
        customerId,
        priceId,
        status: trialStart ? 'trialing' : 'active',
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days
        trialStart,
        trialEnd,
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now
      };

      this.subscriptions.set(subscriptionId, subscription);

      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId: options.conversationId,
        integrationType: 'payments',
        method: 'POST',
        endpoint: 'subscriptions.create',
        requestData: { customerId, priceId, options },
        responseData: { subscriptionId, status: subscription.status },
        statusCode: 200,
        processingTimeMs: processingTime
      });

      logger.info('Mock subscription created', {
        tenantId,
        subscriptionId,
        customerId,
        priceId,
        status: subscription.status
      });

      return { success: true, subscription };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId: options.conversationId,
        integrationType: 'payments',
        method: 'POST',
        endpoint: 'subscriptions.create',
        requestData: { customerId, priceId, options },
        responseData: { error: error instanceof Error ? error.message : 'Unknown error' },
        statusCode: 500,
        processingTimeMs: processingTime
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ===================================
  // REFUND MANAGEMENT
  // ===================================

  async createRefund(
    tenantId: string,
    refundRequest: RefundRequest,
    conversationId?: string
  ): Promise<{ success: boolean; refundId?: string; amount?: number; error?: string }> {
    const startTime = Date.now();

    try {
      const paymentIntent = this.paymentIntents.get(refundRequest.paymentIntentId);
      if (!paymentIntent) {
        return { success: false, error: 'Payment intent not found' };
      }

      if (paymentIntent.status !== 'succeeded') {
        return { success: false, error: 'Payment intent not eligible for refund' };
      }

      const refundAmount = refundRequest.amount || paymentIntent.amount;
      const refundId = `re_mock_${Date.now()}`;

      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'payments',
        method: 'POST',
        endpoint: 'refunds.create',
        requestData: refundRequest,
        responseData: { refundId, amount: refundAmount },
        statusCode: 200,
        processingTimeMs: processingTime
      });

      logger.info('Mock refund created', {
        tenantId,
        refundId,
        paymentIntentId: refundRequest.paymentIntentId,
        amount: refundAmount
      });

      return { success: true, refundId, amount: refundAmount };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'payments',
        method: 'POST',
        endpoint: 'refunds.create',
        requestData: refundRequest,
        responseData: { error: error instanceof Error ? error.message : 'Unknown error' },
        statusCode: 500,
        processingTimeMs: processingTime
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ===================================
  // PLAN MANAGEMENT
  // ===================================

  async getAvailablePlans(
    tenantId: string,
    conversationId?: string
  ): Promise<{ success: boolean; plans?: PaymentPlan[]; error?: string }> {
    const startTime = Date.now();

    try {
      const plans = Array.from(this.plans.values()).filter(plan => plan.isActive);

      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'payments',
        method: 'GET',
        endpoint: 'plans.list',
        requestData: {},
        responseData: { count: plans.length },
        statusCode: 200,
        processingTimeMs: processingTime
      });

      return { success: true, plans };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'payments',
        method: 'GET',
        endpoint: 'plans.list',
        requestData: {},
        responseData: { error: error instanceof Error ? error.message : 'Unknown error' },
        statusCode: 500,
        processingTimeMs: processingTime
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ===================================
  // UTILITY METHODS
  // ===================================

  private detectCardBrand(cardNumber: string): string {
    const number = cardNumber.replace(/\D/g, '');
    
    if (number.startsWith('4')) return 'visa';
    if (number.startsWith('5') || number.startsWith('2')) return 'mastercard';
    if (number.startsWith('3')) return 'amex';
    if (number.startsWith('6')) return 'discover';
    
    return 'unknown';
  }

  formatAmountForVoice(amountCents: number, currency: string = 'usd'): string {
    const amount = amountCents / 100;
    
    if (currency.toLowerCase() === 'usd') {
      return `$${amount.toFixed(2)}`;
    }
    
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }

  formatPaymentMethodForVoice(paymentMethod: PaymentMethod): string {
    if (paymentMethod.type === 'card') {
      return `${paymentMethod.brand} card ending in ${paymentMethod.last4}`;
    }
    
    return `${paymentMethod.type}`;
  }

  formatPlanForVoice(plan: PaymentPlan): string {
    const amount = this.formatAmountForVoice(plan.amount, plan.currency);
    const interval = plan.intervalCount === 1 
      ? plan.interval 
      : `${plan.intervalCount} ${plan.interval}s`;
    
    return `${plan.name} - ${amount} per ${interval}`;
  }

  async getPaymentStats(tenantId: string): Promise<{
    totalPaymentIntents: number;
    successfulPayments: number;
    totalAmount: number;
    subscriptions: number;
  }> {
    const paymentIntents = Array.from(this.paymentIntents.values());
    const subscriptions = Array.from(this.subscriptions.values());
    
    const successfulPayments = paymentIntents.filter(pi => pi.status === 'succeeded');
    const totalAmount = successfulPayments.reduce((sum, pi) => sum + pi.amount, 0);

    return {
      totalPaymentIntents: paymentIntents.length,
      successfulPayments: successfulPayments.length,
      totalAmount,
      subscriptions: subscriptions.length
    };
  }
}

export { MockPaymentIntegration };
export type { 
  PaymentMethod, 
  PaymentIntent, 
  Subscription, 
  Invoice, 
  RefundRequest, 
  PaymentPlan 
};