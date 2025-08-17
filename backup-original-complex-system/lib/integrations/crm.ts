import { logger } from '../observability/logger';
import { getDatabaseClient } from '../memory/database';

interface CRMCustomer {
  id: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  status: 'lead' | 'prospect' | 'customer' | 'churned';
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  customFields: Record<string, any>;
  notes: CRMNote[];
  interactions: CRMInteraction[];
}

interface CRMNote {
  id: string;
  content: string;
  createdAt: Date;
  createdBy: string;
  type: 'call' | 'email' | 'meeting' | 'other';
}

interface CRMInteraction {
  id: string;
  type: 'call' | 'email' | 'chat' | 'visit' | 'voice_ai';
  direction: 'inbound' | 'outbound';
  summary: string;
  duration?: number; // in minutes
  outcome?: string;
  createdAt: Date;
  metadata: Record<string, any>;
}

interface CRMSearchFilters {
  email?: string;
  phone?: string;
  name?: string;
  company?: string;
  status?: CRMCustomer['status'];
  tags?: string[];
  limit?: number;
}

interface CRMOpportunity {
  id: string;
  customerId: string;
  title: string;
  description?: string;
  value: number; // in cents
  stage: 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  probability: number; // 0-100
  expectedCloseDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

class MockCRMIntegration {
  private db = getDatabaseClient();
  private customers = new Map<string, CRMCustomer>();
  private opportunities = new Map<string, CRMOpportunity>();

  constructor() {
    this.seedMockData();
  }

  private seedMockData(): void {
    // Seed some mock customers for demo purposes
    const mockCustomers: Partial<CRMCustomer>[] = [
      {
        email: 'john.doe@email.com',
        phone: '+1-555-0123',
        firstName: 'John',
        lastName: 'Doe',
        status: 'customer',
        tags: ['dental-patient', 'recurring'],
        customFields: { lastCleaningDate: '2024-06-15', insuranceProvider: 'Blue Cross' }
      },
      {
        email: 'sarah.johnson@email.com',
        phone: '+1-555-0456',
        firstName: 'Sarah',
        lastName: 'Johnson',
        company: 'Johnson Auto Shop',
        status: 'prospect',
        tags: ['auto-repair', 'fleet-service'],
        customFields: { vehicleCount: 12, preferredContact: 'email' }
      },
      {
        email: 'mike.fitness@email.com',
        phone: '+1-555-0789',
        firstName: 'Mike',
        lastName: 'Thompson',
        status: 'lead',
        tags: ['fitness', 'personal-training'],
        customFields: { fitnessGoal: 'weight-loss', membershipType: 'trial' }
      }
    ];

    mockCustomers.forEach((customer, index) => {
      const id = `mock_customer_${index + 1}`;
      const now = new Date();
      
      this.customers.set(id, {
        id,
        email: customer.email || '',
        phone: customer.phone || '',
        firstName: customer.firstName || '',
        lastName: customer.lastName || '',
        company: customer.company,
        status: customer.status || 'lead',
        createdAt: new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date in last 30 days
        updatedAt: now,
        tags: customer.tags || [],
        customFields: customer.customFields || {},
        notes: [],
        interactions: []
      });
    });

    logger.info('Mock CRM data seeded', {
      customerCount: this.customers.size
    });
  }

  // ===================================
  // CUSTOMER MANAGEMENT
  // ===================================

  async searchCustomers(
    tenantId: string,
    filters: CRMSearchFilters,
    conversationId?: string
  ): Promise<{ success: boolean; customers?: CRMCustomer[]; error?: string }> {
    const startTime = Date.now();

    try {
      let results = Array.from(this.customers.values());

      // Apply filters
      if (filters.email) {
        results = results.filter(c => 
          c.email?.toLowerCase().includes(filters.email!.toLowerCase())
        );
      }
      
      if (filters.phone) {
        const cleanPhone = filters.phone.replace(/\D/g, '');
        results = results.filter(c => 
          c.phone?.replace(/\D/g, '').includes(cleanPhone)
        );
      }
      
      if (filters.name) {
        const nameLower = filters.name.toLowerCase();
        results = results.filter(c => 
          c.firstName?.toLowerCase().includes(nameLower) ||
          c.lastName?.toLowerCase().includes(nameLower) ||
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(nameLower)
        );
      }
      
      if (filters.company) {
        results = results.filter(c => 
          c.company?.toLowerCase().includes(filters.company!.toLowerCase())
        );
      }
      
      if (filters.status) {
        results = results.filter(c => c.status === filters.status);
      }
      
      if (filters.tags && filters.tags.length > 0) {
        results = results.filter(c => 
          filters.tags!.some(tag => c.tags.includes(tag))
        );
      }

      // Apply limit
      if (filters.limit) {
        results = results.slice(0, filters.limit);
      }

      const processingTime = Date.now() - startTime;

      // Log integration call
      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'crm',
        method: 'GET',
        endpoint: 'customers.search',
        requestData: { filters },
        responseData: { count: results.length },
        statusCode: 200,
        processingTimeMs: processingTime
      });

      logger.debug('CRM customer search completed', {
        tenantId,
        filters,
        resultCount: results.length,
        processingTimeMs: processingTime
      });

      return { success: true, customers: results };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'crm',
        method: 'GET',
        endpoint: 'customers.search',
        requestData: { filters },
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

  async getCustomer(
    tenantId: string,
    customerId: string,
    conversationId?: string
  ): Promise<{ success: boolean; customer?: CRMCustomer; error?: string }> {
    const startTime = Date.now();

    try {
      const customer = this.customers.get(customerId);
      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'crm',
        method: 'GET',
        endpoint: 'customers.get',
        requestData: { customerId },
        responseData: { found: !!customer },
        statusCode: customer ? 200 : 404,
        processingTimeMs: processingTime
      });

      if (customer) {
        return { success: true, customer };
      } else {
        return { success: false, error: 'Customer not found' };
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'crm',
        method: 'GET',
        endpoint: 'customers.get',
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

  async createCustomer(
    tenantId: string,
    customerData: Partial<CRMCustomer>,
    conversationId?: string
  ): Promise<{ success: boolean; customer?: CRMCustomer; error?: string }> {
    const startTime = Date.now();

    try {
      const customerId = `mock_customer_${Date.now()}`;
      const now = new Date();

      const customer: CRMCustomer = {
        id: customerId,
        email: customerData.email || '',
        phone: customerData.phone || '',
        firstName: customerData.firstName || '',
        lastName: customerData.lastName || '',
        company: customerData.company,
        status: customerData.status || 'lead',
        createdAt: now,
        updatedAt: now,
        tags: customerData.tags || [],
        customFields: customerData.customFields || {},
        notes: [],
        interactions: []
      };

      this.customers.set(customerId, customer);

      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'crm',
        method: 'POST',
        endpoint: 'customers.create',
        requestData: { customerData },
        responseData: { customerId },
        statusCode: 201,
        processingTimeMs: processingTime
      });

      logger.info('Mock CRM customer created', {
        tenantId,
        customerId,
        email: customer.email,
        name: `${customer.firstName} ${customer.lastName}`
      });

      return { success: true, customer };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'crm',
        method: 'POST',
        endpoint: 'customers.create',
        requestData: { customerData },
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

  async updateCustomer(
    tenantId: string,
    customerId: string,
    updates: Partial<CRMCustomer>,
    conversationId?: string
  ): Promise<{ success: boolean; customer?: CRMCustomer; error?: string }> {
    const startTime = Date.now();

    try {
      const customer = this.customers.get(customerId);
      if (!customer) {
        return { success: false, error: 'Customer not found' };
      }

      const updatedCustomer = {
        ...customer,
        ...updates,
        id: customerId, // Ensure ID doesn't change
        updatedAt: new Date()
      };

      this.customers.set(customerId, updatedCustomer);

      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'crm',
        method: 'PUT',
        endpoint: 'customers.update',
        requestData: { customerId, updates },
        responseData: { updated: true },
        statusCode: 200,
        processingTimeMs: processingTime
      });

      return { success: true, customer: updatedCustomer };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'crm',
        method: 'PUT',
        endpoint: 'customers.update',
        requestData: { customerId, updates },
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
  // INTERACTION TRACKING
  // ===================================

  async addInteraction(
    tenantId: string,
    customerId: string,
    interaction: Omit<CRMInteraction, 'id' | 'createdAt'>,
    conversationId?: string
  ): Promise<{ success: boolean; interactionId?: string; error?: string }> {
    const startTime = Date.now();

    try {
      const customer = this.customers.get(customerId);
      if (!customer) {
        return { success: false, error: 'Customer not found' };
      }

      const interactionId = `interaction_${Date.now()}`;
      const newInteraction: CRMInteraction = {
        ...interaction,
        id: interactionId,
        createdAt: new Date()
      };

      customer.interactions.push(newInteraction);
      customer.updatedAt = new Date();

      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'crm',
        method: 'POST',
        endpoint: 'interactions.create',
        requestData: { customerId, interaction },
        responseData: { interactionId },
        statusCode: 201,
        processingTimeMs: processingTime
      });

      logger.debug('CRM interaction added', {
        tenantId,
        customerId,
        interactionId,
        type: interaction.type
      });

      return { success: true, interactionId };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'crm',
        method: 'POST',
        endpoint: 'interactions.create',
        requestData: { customerId, interaction },
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

  async addNote(
    tenantId: string,
    customerId: string,
    note: Omit<CRMNote, 'id' | 'createdAt'>,
    conversationId?: string
  ): Promise<{ success: boolean; noteId?: string; error?: string }> {
    const startTime = Date.now();

    try {
      const customer = this.customers.get(customerId);
      if (!customer) {
        return { success: false, error: 'Customer not found' };
      }

      const noteId = `note_${Date.now()}`;
      const newNote: CRMNote = {
        ...note,
        id: noteId,
        createdAt: new Date()
      };

      customer.notes.push(newNote);
      customer.updatedAt = new Date();

      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'crm',
        method: 'POST',
        endpoint: 'notes.create',
        requestData: { customerId, note },
        responseData: { noteId },
        statusCode: 201,
        processingTimeMs: processingTime
      });

      return { success: true, noteId };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'crm',
        method: 'POST',
        endpoint: 'notes.create',
        requestData: { customerId, note },
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

  formatCustomerForVoice(customer: CRMCustomer): string {
    const name = customer.firstName && customer.lastName 
      ? `${customer.firstName} ${customer.lastName}`
      : customer.firstName || customer.lastName || 'Unknown';
    
    const company = customer.company ? ` from ${customer.company}` : '';
    const status = customer.status.charAt(0).toUpperCase() + customer.status.slice(1);
    
    return `${name}${company} (${status})`;
  }

  async getCustomerStats(tenantId: string): Promise<{
    totalCustomers: number;
    byStatus: Record<string, number>;
    recentInteractions: number;
  }> {
    const customers = Array.from(this.customers.values());
    const byStatus: Record<string, number> = {};
    
    customers.forEach(customer => {
      byStatus[customer.status] = (byStatus[customer.status] || 0) + 1;
    });

    const recentInteractions = customers.reduce((total, customer) => {
      const recentCount = customer.interactions.filter(
        interaction => interaction.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length;
      return total + recentCount;
    }, 0);

    return {
      totalCustomers: customers.length,
      byStatus,
      recentInteractions
    };
  }
}

export { MockCRMIntegration };
export type { 
  CRMCustomer, 
  CRMNote, 
  CRMInteraction, 
  CRMSearchFilters, 
  CRMOpportunity 
};