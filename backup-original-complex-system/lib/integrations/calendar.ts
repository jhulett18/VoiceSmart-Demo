import { google } from 'googleapis';
import { logger } from '../observability/logger';
import { getDatabaseClient } from '../memory/database';

interface CalendarConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  redirectUri?: string;
}

interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
  location?: string;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
}

interface AvailabilitySlot {
  start: string;
  end: string;
  available: boolean;
  eventTitle?: string;
}

interface CalendarIntegrationOptions {
  calendarId?: string;
  timeZone?: string;
  businessHours?: {
    start: string; // e.g., "09:00"
    end: string;   // e.g., "17:00"
    days: number[]; // 0=Sunday, 1=Monday, etc.
  };
}

class CalendarIntegration {
  private oauth2Client: any;
  private calendar: any;
  private db = getDatabaseClient();
  private config: CalendarConfig;
  private options: CalendarIntegrationOptions;

  constructor(config: CalendarConfig, options: CalendarIntegrationOptions = {}) {
    this.config = config;
    this.options = {
      calendarId: 'primary',
      timeZone: 'America/New_York',
      businessHours: {
        start: '09:00',
        end: '17:00',
        days: [1, 2, 3, 4, 5] // Monday-Friday
      },
      ...options
    };

    this.initializeAuth();
  }

  private initializeAuth(): void {
    try {
      this.oauth2Client = new google.auth.OAuth2(
        this.config.clientId,
        this.config.clientSecret,
        this.config.redirectUri || 'urn:ietf:wg:oauth:2.0:oob'
      );

      this.oauth2Client.setCredentials({
        refresh_token: this.config.refreshToken
      });

      this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      logger.info('Google Calendar integration initialized');
    } catch (error) {
      logger.error('Failed to initialize Google Calendar integration:', error);
      throw error;
    }
  }

  // ===================================
  // AUTHENTICATION METHODS
  // ===================================

  async testConnection(): Promise<boolean> {
    try {
      await this.calendar.calendars.get({
        calendarId: this.options.calendarId
      });
      return true;
    } catch (error) {
      logger.error('Calendar connection test failed:', error);
      return false;
    }
  }

  generateAuthUrl(scopes: string[] = ['https://www.googleapis.com/auth/calendar']): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  async exchangeCodeForTokens(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expiry_date: number;
  }> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    return tokens;
  }

  // ===================================
  // EVENT MANAGEMENT
  // ===================================

  async createEvent(
    tenantId: string,
    event: CalendarEvent,
    conversationId?: string
  ): Promise<{ success: boolean; eventId?: string; error?: string }> {
    const startTime = Date.now();

    try {
      logger.info('Creating calendar event', {
        tenantId,
        conversationId,
        summary: event.summary,
        start: event.start.dateTime
      });

      const response = await this.calendar.events.insert({
        calendarId: this.options.calendarId,
        resource: {
          ...event,
          start: {
            ...event.start,
            timeZone: event.start.timeZone || this.options.timeZone
          },
          end: {
            ...event.end,
            timeZone: event.end.timeZone || this.options.timeZone
          }
        }
      });

      const eventId = response.data.id;
      const processingTime = Date.now() - startTime;

      // Log integration call
      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'calendar',
        method: 'POST',
        endpoint: 'events.insert',
        requestData: { event },
        responseData: { eventId },
        statusCode: 200,
        processingTimeMs: processingTime,
        idempotencyKey: `create_event_${tenantId}_${Date.now()}`
      });

      logger.info('Calendar event created successfully', {
        tenantId,
        conversationId,
        eventId,
        processingTimeMs: processingTime
      });

      return { success: true, eventId };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      logger.error('Failed to create calendar event:', error);

      // Log failed integration call
      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'calendar',
        method: 'POST',
        endpoint: 'events.insert',
        requestData: { event },
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

  async getEvent(
    tenantId: string,
    eventId: string,
    conversationId?: string
  ): Promise<{ success: boolean; event?: CalendarEvent; error?: string }> {
    const startTime = Date.now();

    try {
      const response = await this.calendar.events.get({
        calendarId: this.options.calendarId,
        eventId
      });

      const event = response.data;
      const processingTime = Date.now() - startTime;

      // Log integration call
      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'calendar',
        method: 'GET',
        endpoint: 'events.get',
        requestData: { eventId },
        responseData: { found: true },
        statusCode: 200,
        processingTimeMs: processingTime
      });

      return { success: true, event };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'calendar',
        method: 'GET',
        endpoint: 'events.get',
        requestData: { eventId },
        responseData: { error: error instanceof Error ? error.message : 'Unknown error' },
        statusCode: 404,
        processingTimeMs: processingTime
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Event not found'
      };
    }
  }

  async updateEvent(
    tenantId: string,
    eventId: string,
    updates: Partial<CalendarEvent>,
    conversationId?: string
  ): Promise<{ success: boolean; error?: string }> {
    const startTime = Date.now();

    try {
      await this.calendar.events.patch({
        calendarId: this.options.calendarId,
        eventId,
        resource: updates
      });

      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'calendar',
        method: 'PATCH',
        endpoint: 'events.patch',
        requestData: { eventId, updates },
        responseData: { updated: true },
        statusCode: 200,
        processingTimeMs: processingTime
      });

      logger.info('Calendar event updated successfully', {
        tenantId,
        eventId,
        processingTimeMs: processingTime
      });

      return { success: true };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'calendar',
        method: 'PATCH',
        endpoint: 'events.patch',
        requestData: { eventId, updates },
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

  async deleteEvent(
    tenantId: string,
    eventId: string,
    conversationId?: string
  ): Promise<{ success: boolean; error?: string }> {
    const startTime = Date.now();

    try {
      await this.calendar.events.delete({
        calendarId: this.options.calendarId,
        eventId
      });

      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'calendar',
        method: 'DELETE',
        endpoint: 'events.delete',
        requestData: { eventId },
        responseData: { deleted: true },
        statusCode: 200,
        processingTimeMs: processingTime
      });

      logger.info('Calendar event deleted successfully', {
        tenantId,
        eventId,
        processingTimeMs: processingTime
      });

      return { success: true };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'calendar',
        method: 'DELETE',
        endpoint: 'events.delete',
        requestData: { eventId },
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
  // AVAILABILITY CHECKING
  // ===================================

  async checkAvailability(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    durationMinutes: number = 60,
    conversationId?: string
  ): Promise<{ success: boolean; availableSlots?: AvailabilitySlot[]; error?: string }> {
    const startTime = Date.now();

    try {
      // Get events in the date range
      const response = await this.calendar.events.list({
        calendarId: this.options.calendarId,
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      });

      const events = response.data.items || [];
      const availableSlots: AvailabilitySlot[] = [];

      // Generate time slots within business hours
      const current = new Date(startDate);
      while (current < endDate) {
        const dayOfWeek = current.getDay();
        
        // Check if it's a business day
        if (this.options.businessHours?.days.includes(dayOfWeek)) {
          const dayStart = new Date(current);
          const [startHour, startMinute] = this.options.businessHours.start.split(':');
          dayStart.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);

          const dayEnd = new Date(current);
          const [endHour, endMinute] = this.options.businessHours.end.split(':');
          dayEnd.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);

          // Generate slots for this day
          const slotStart = new Date(dayStart);
          while (slotStart < dayEnd) {
            const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);
            
            if (slotEnd <= dayEnd) {
              // Check if this slot conflicts with any existing events
              const hasConflict = events.some(event => {
                const eventStart = new Date(event.start?.dateTime || event.start?.date || '');
                const eventEnd = new Date(event.end?.dateTime || event.end?.date || '');
                
                return (slotStart < eventEnd && slotEnd > eventStart);
              });

              availableSlots.push({
                start: slotStart.toISOString(),
                end: slotEnd.toISOString(),
                available: !hasConflict,
                eventTitle: hasConflict ? events.find(event => {
                  const eventStart = new Date(event.start?.dateTime || event.start?.date || '');
                  const eventEnd = new Date(event.end?.dateTime || event.end?.date || '');
                  return (slotStart < eventEnd && slotEnd > eventStart);
                })?.summary : undefined
              });
            }

            slotStart.setMinutes(slotStart.getMinutes() + durationMinutes);
          }
        }

        current.setDate(current.getDate() + 1);
      }

      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'calendar',
        method: 'GET',
        endpoint: 'events.list',
        requestData: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
        responseData: { 
          eventCount: events.length,
          availableSlotCount: availableSlots.filter(s => s.available).length
        },
        statusCode: 200,
        processingTimeMs: processingTime
      });

      return { success: true, availableSlots };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      await this.db.logIntegrationCall(tenantId, {
        conversationId,
        integrationType: 'calendar',
        method: 'GET',
        endpoint: 'events.list',
        requestData: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
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

  async findNextAvailableSlot(
    tenantId: string,
    fromDate: Date,
    durationMinutes: number = 60,
    daysToSearch: number = 14,
    conversationId?: string
  ): Promise<{ success: boolean; nextSlot?: AvailabilitySlot; error?: string }> {
    const endDate = new Date(fromDate.getTime() + daysToSearch * 24 * 60 * 60 * 1000);
    
    const result = await this.checkAvailability(
      tenantId,
      fromDate,
      endDate,
      durationMinutes,
      conversationId
    );

    if (!result.success || !result.availableSlots) {
      return { success: false, error: result.error };
    }

    const nextAvailable = result.availableSlots.find(slot => slot.available);
    
    return {
      success: true,
      nextSlot: nextAvailable
    };
  }

  // ===================================
  // UTILITY METHODS
  // ===================================

  formatEventForVoice(event: CalendarEvent): string {
    const startTime = new Date(event.start.dateTime);
    const endTime = new Date(event.end.dateTime);
    
    const dateStr = startTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const startTimeStr = startTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    const endTimeStr = endTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    return `${event.summary} on ${dateStr} from ${startTimeStr} to ${endTimeStr}`;
  }

  formatAvailableSlots(slots: AvailabilitySlot[], limit: number = 3): string {
    const availableSlots = slots.filter(slot => slot.available).slice(0, limit);
    
    if (availableSlots.length === 0) {
      return "No available time slots found.";
    }

    const formattedSlots = availableSlots.map(slot => {
      const start = new Date(slot.start);
      const dateStr = start.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      });
      const timeStr = start.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      return `${dateStr} at ${timeStr}`;
    });

    if (formattedSlots.length === 1) {
      return `Available: ${formattedSlots[0]}`;
    } else if (formattedSlots.length === 2) {
      return `Available: ${formattedSlots[0]} or ${formattedSlots[1]}`;
    } else {
      return `Available: ${formattedSlots.slice(0, -1).join(', ')}, or ${formattedSlots[formattedSlots.length - 1]}`;
    }
  }
}

// ===================================
// MOCK CALENDAR INTEGRATION
// ===================================

class MockCalendarIntegration {
  private events = new Map<string, CalendarEvent>();
  private db = getDatabaseClient();

  async testConnection(): Promise<boolean> {
    return true;
  }

  async createEvent(
    tenantId: string,
    event: CalendarEvent,
    conversationId?: string
  ): Promise<{ success: boolean; eventId?: string; error?: string }> {
    const eventId = `mock_event_${Date.now()}`;
    this.events.set(eventId, { ...event, id: eventId });

    // Log mock integration call
    await this.db.logIntegrationCall(tenantId, {
      conversationId,
      integrationType: 'calendar',
      method: 'POST',
      endpoint: 'mock.events.create',
      requestData: { event },
      responseData: { eventId },
      statusCode: 200,
      processingTimeMs: 50 // Mock processing time
    });

    logger.info('Mock calendar event created', {
      tenantId,
      eventId,
      summary: event.summary
    });

    return { success: true, eventId };
  }

  async checkAvailability(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    durationMinutes: number = 60
  ): Promise<{ success: boolean; availableSlots?: AvailabilitySlot[]; error?: string }> {
    // Mock: Generate some available slots
    const slots: AvailabilitySlot[] = [];
    const current = new Date(startDate);
    
    while (current < endDate && slots.length < 10) {
      if (current.getDay() >= 1 && current.getDay() <= 5) { // Weekdays only
        const slotStart = new Date(current);
        slotStart.setHours(9 + Math.floor(Math.random() * 8), 0, 0, 0); // 9 AM to 5 PM
        
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);
        
        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          available: Math.random() > 0.3 // 70% chance of being available
        });
      }
      
      current.setDate(current.getDate() + 1);
    }

    return { success: true, availableSlots: slots };
  }

  formatEventForVoice(event: CalendarEvent): string {
    return `Mock event: ${event.summary}`;
  }

  formatAvailableSlots(slots: AvailabilitySlot[], limit: number = 3): string {
    const available = slots.filter(s => s.available).slice(0, limit);
    return `Mock available slots: ${available.length} found`;
  }
}

// ===================================
// FACTORY FUNCTION
// ===================================

export function createCalendarIntegration(useMock: boolean = false): CalendarIntegration | MockCalendarIntegration {
  if (useMock || !process.env.GOOGLE_CLIENT_ID) {
    logger.info('Using mock calendar integration');
    return new MockCalendarIntegration();
  }

  const config: CalendarConfig = {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN!
  };

  return new CalendarIntegration(config);
}

export { CalendarIntegration, MockCalendarIntegration };
export type { CalendarConfig, CalendarEvent, AvailabilitySlot, CalendarIntegrationOptions };