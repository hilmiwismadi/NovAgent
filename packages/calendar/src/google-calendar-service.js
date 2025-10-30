/**
 * Google Calendar Service
 * Handles all Google Calendar API operations
 */

import { google } from 'googleapis';
import { TokenManager } from './token-manager.js';

export class GoogleCalendarService {
  constructor() {
    this.calendar = null;
    this.tokenManager = new TokenManager();
    this.isEnabled = process.env.GOOGLE_CALENDAR_ENABLED === 'true';
  }

  /**
   * Initialize Google Calendar API
   */
  async initialize() {
    if (!this.isEnabled) {
      console.log('[Calendar] Google Calendar integration is disabled');
      return false;
    }

    try {
      // Initialize token manager
      const tokenManagerInitialized = await this.tokenManager.initialize();
      if (!tokenManagerInitialized) {
        console.log('[Calendar] Token manager initialization failed');
        return false;
      }

      // Get authenticated client
      this.auth = await this.tokenManager.getAuthClient();

      // Initialize calendar API
      this.calendar = google.calendar({ version: 'v3', auth: this.auth });

      console.log('[Calendar] Google Calendar API initialized successfully');
      return true;
    } catch (error) {
      console.error('[Calendar] Failed to initialize Google Calendar API:', error);
      return false;
    }
  }

  /**
   * Create a calendar event
   * @param {Object} eventData - Event details
   * @returns {Object} Created event with ID
   */
  async createEvent(eventData) {
    if (!this.isEnabled || !this.calendar) {
      console.log('[Calendar] Calendar service not initialized');
      return null;
    }

    try {
      const {
        summary,           // Event title
        description,       // Event description
        start,            // Start datetime (ISO string or Date object)
        end,              // End datetime (ISO string or Date object)
        location,         // Location/venue
        attendees = [],   // Array of email addresses
        reminders = {     // Reminder settings
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },  // 1 day before
            { method: 'popup', minutes: 60 }        // 1 hour before
          ]
        }
      } = eventData;

      // Helper to format date for Google Calendar API in local timezone
      const formatDateTimeLocal = (date) => {
        if (!(date instanceof Date)) return date;
        // Format as YYYY-MM-DDTHH:mm:ss without Z suffix
        // This tells Google Calendar to interpret in the specified timeZone
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
      };

      const event = {
        summary,
        description,
        location,
        start: {
          dateTime: formatDateTimeLocal(start),
          timeZone: 'Asia/Jakarta'
        },
        end: {
          dateTime: formatDateTimeLocal(end),
          timeZone: 'Asia/Jakarta'
        },
        attendees: attendees.map(email => ({ email })),
        reminders
      };

      let response;
      try {
        // Ensure we have a fresh auth client
        this.auth = await this.tokenManager.getAuthClient();

        response = await this.calendar.events.insert({
          calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
          resource: event,
          sendUpdates: 'all' // Send email notifications
        });
      } catch (error) {
        // If auth error, try to force refresh and retry once
        if (error.message.includes('unauthorized') || error.message.includes('invalid_token') ||
            error.message.includes('invalid_grant') || error.message.includes('invalid_client')) {
          console.log('[Calendar] Authentication error, attempting token refresh...');
          try {
            await this.tokenManager.refreshToken();
            this.auth = await this.tokenManager.getAuthClient();
            console.log('[Calendar] Token refreshed successfully, retrying event creation...');
            response = await this.calendar.events.insert({
              calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
              resource: event,
              sendUpdates: 'all'
            });
          } catch (refreshError) {
            console.error('[Calendar] Token refresh failed:', refreshError.message);
            throw new Error('Calendar authentication failed - please refresh OAuth credentials');
          }
        } else {
          throw error;
        }
      }

      console.log(`[Calendar] Created event: ${response.data.id} - ${summary}`);
      return {
        id: response.data.id,
        htmlLink: response.data.htmlLink,
        summary: response.data.summary,
        start: response.data.start,
        end: response.data.end
      };
    } catch (error) {
      console.error('[Calendar] Error creating event:', error.message);
      throw error;
    }
  }

  /**
   * Update an existing calendar event
   * @param {string} eventId - Google Calendar event ID
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated event
   */
  async updateEvent(eventId, updates) {
    if (!this.isEnabled || !this.calendar) {
      return null;
    }

    try {
      // Get existing event first
      const existingEvent = await this.calendar.events.get({
        calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
        eventId
      });

      // Merge updates
      const updatedEvent = {
        ...existingEvent.data,
        ...updates
      };

      // Handle datetime updates
      if (updates.start) {
        updatedEvent.start = {
          dateTime: updates.start instanceof Date ? updates.start.toISOString() : updates.start,
          timeZone: 'Asia/Jakarta'
        };
      }

      if (updates.end) {
        updatedEvent.end = {
          dateTime: updates.end instanceof Date ? updates.end.toISOString() : updates.end,
          timeZone: 'Asia/Jakarta'
        };
      }

      const response = await this.calendar.events.update({
        calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
        eventId,
        resource: updatedEvent,
        sendUpdates: 'all'
      });

      console.log(`[Calendar] Updated event: ${eventId}`);
      return {
        id: response.data.id,
        summary: response.data.summary,
        start: response.data.start,
        end: response.data.end
      };
    } catch (error) {
      console.error(`[Calendar] Error updating event ${eventId}:`, error.message);
      throw error;
    }
  }

  /**
   * Delete a calendar event
   * @param {string} eventId - Google Calendar event ID
   * @returns {boolean} Success status
   */
  async deleteEvent(eventId) {
    if (!this.isEnabled || !this.calendar) {
      return false;
    }

    try {
      await this.calendar.events.delete({
        calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
        eventId,
        sendUpdates: 'all'
      });

      console.log(`[Calendar] Deleted event: ${eventId}`);
      return true;
    } catch (error) {
      console.error(`[Calendar] Error deleting event ${eventId}:`, error.message);
      return false;
    }
  }

  /**
   * Get event by ID
   * @param {string} eventId - Google Calendar event ID
   * @returns {Object} Event data
   */
  async getEvent(eventId) {
    if (!this.isEnabled || !this.calendar) {
      return null;
    }

    try {
      const response = await this.calendar.events.get({
        calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
        eventId
      });

      return response.data;
    } catch (error) {
      console.error(`[Calendar] Error getting event ${eventId}:`, error.message);
      return null;
    }
  }

  /**
   * List upcoming events
   * @param {Object} options - Query options
   * @returns {Array} List of events
   */
  async listUpcomingEvents(options = {}) {
    if (!this.isEnabled || !this.calendar) {
      return [];
    }

    try {
      const {
        maxResults = 10,
        timeMin = new Date().toISOString(),
        timeMax = null
      } = options;

      const params = {
        calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
        timeMin,
        maxResults,
        singleEvents: true,
        orderBy: 'startTime'
      };

      if (timeMax) {
        params.timeMax = timeMax;
      }

      const response = await this.calendar.events.list(params);

      return response.data.items || [];
    } catch (error) {
      console.error('[Calendar] Error listing events:', error.message);
      return [];
    }
  }

  /**
   * Check if event exists and hasn't been modified
   * @param {string} eventId - Google Calendar event ID
   * @param {Date} lastKnownDate - Last known event date from database
   * @returns {Object} { exists, modified, currentDate }
   */
  async checkEventStatus(eventId, lastKnownDate) {
    if (!this.isEnabled || !this.calendar) {
      return { exists: false, modified: false, currentDate: null };
    }

    try {
      const event = await this.getEvent(eventId);

      if (!event) {
        return { exists: false, modified: false, currentDate: null };
      }

      const currentDate = new Date(event.start.dateTime || event.start.date);
      const modified = lastKnownDate && currentDate.getTime() !== new Date(lastKnownDate).getTime();

      return {
        exists: true,
        modified,
        currentDate,
        event
      };
    } catch (error) {
      console.error(`[Calendar] Error checking event status ${eventId}:`, error.message);
      return { exists: false, modified: false, currentDate: null };
    }
  }
}

export default GoogleCalendarService;
