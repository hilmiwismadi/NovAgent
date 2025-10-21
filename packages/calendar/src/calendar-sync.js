/**
 * Calendar Sync Service
 * Handles bidirectional sync between database and Google Calendar
 * Supports 3 event flows: Meeting, Ticket Sale, Event D-Day
 */

import GoogleCalendarService from './google-calendar-service.js';

export class CalendarSyncService {
  constructor(databaseService) {
    this.db = databaseService;
    this.calendarService = new GoogleCalendarService();
    this.initialized = false;
  }

  /**
   * Initialize the sync service
   */
  async initialize() {
    this.initialized = await this.calendarService.initialize();
    return this.initialized;
  }

  /**
   * Create calendar event for Meeting Appointment (Flow 1)
   * @param {string} userId - User ID
   * @param {Date} meetingDate - Meeting date and time
   * @param {Object} options - Additional options (notes, duration)
   * @returns {Object} Created event data
   */
  async createMeetingEvent(userId, meetingDate, options = {}) {
    if (!this.initialized) {
      console.log('[Sync] Calendar service not initialized');
      return null;
    }

    try {
      const user = await this.db.getOrCreateUser(userId);

      // Calculate end time (default 1 hour)
      const duration = options.duration || 60; // minutes
      const endDate = new Date(meetingDate.getTime() + duration * 60 * 1000);

      const eventData = {
        summary: `Meeting: ${user.nama || user.id} - ${user.instansi || 'NovaTix Consultation'}`,
        description: `Meeting appointment with ${user.nama || user.id}\n` +
                    `Organization: ${user.instansi || 'N/A'}\n` +
                    `Event: ${user.event || 'TBD'}\n` +
                    `Notes: ${options.notes || 'Initial consultation'}\n\n` +
                    `WhatsApp: ${user.id}`,
        start: meetingDate,
        end: endDate,
        location: options.location || 'NovaTix Office / Video Call',
        attendees: options.attendees || [],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },  // 1 day before
            { method: 'popup', minutes: 30 }        // 30 min before
          ]
        }
      };

      const createdEvent = await this.calendarService.createEvent(eventData);

      if (createdEvent) {
        // Update database with calendar event ID
        await this.db.updateUser(userId, {
          meetingDate: meetingDate,
          meetingCalendarId: createdEvent.id,
          meetingNotes: options.notes || null
        });

        console.log(`[Sync] Created meeting event for ${userId}: ${createdEvent.id}`);
      }

      return createdEvent;
    } catch (error) {
      console.error('[Sync] Error creating meeting event:', error);
      throw error;
    }
  }

  /**
   * Create calendar event for Ticket Sale Start (Flow 2)
   * @param {string} userId - User ID
   * @param {Date} ticketSaleDate - Ticket sale start date
   * @param {Object} options - Additional options
   * @returns {Object} Created event data
   */
  async createTicketSaleEvent(userId, ticketSaleDate, options = {}) {
    if (!this.initialized) return null;

    try {
      const user = await this.db.getOrCreateUser(userId);

      // Ticket sale is usually an all-day event or specific time
      const endDate = options.endDate || new Date(ticketSaleDate.getTime() + 60 * 60 * 1000); // 1 hour

      const eventData = {
        summary: `🎫 Ticket Sale Opens: ${user.event || user.instansi || 'Event'}`,
        description: `Ticket sale starts for ${user.event || 'event'}\n` +
                    `Organizer: ${user.instansi || 'N/A'}\n` +
                    `Ticket Price: Rp ${(user.ticketPrice || 0).toLocaleString('id-ID')}\n` +
                    `Capacity: ${user.capacity || 'TBD'} pax\n` +
                    `Pricing Scheme: ${user.pricingScheme || 'TBD'}\n\n` +
                    `Contact: ${user.nama || user.id}\n` +
                    `WhatsApp: ${user.id}\n\n` +
                    `Notes: ${options.notes || 'Ticket sale launch'}`,
        start: ticketSaleDate,
        end: endDate,
        location: options.location || 'Online Platform',
        attendees: options.attendees || [],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 3 * 24 * 60 },  // 3 days before
            { method: 'email', minutes: 24 * 60 },      // 1 day before
            { method: 'popup', minutes: 60 }            // 1 hour before
          ]
        }
      };

      const createdEvent = await this.calendarService.createEvent(eventData);

      if (createdEvent) {
        await this.db.updateUser(userId, {
          ticketSaleDate: ticketSaleDate,
          ticketSaleCalendarId: createdEvent.id,
          ticketSaleNotes: options.notes || null
        });

        console.log(`[Sync] Created ticket sale event for ${userId}: ${createdEvent.id}`);
      }

      return createdEvent;
    } catch (error) {
      console.error('[Sync] Error creating ticket sale event:', error);
      throw error;
    }
  }

  /**
   * Create calendar event for Event D-Day (Flow 3)
   * @param {string} userId - User ID
   * @param {Date} eventDayDate - Event day date and time
   * @param {Object} options - Additional options (venue, duration)
   * @returns {Object} Created event data
   */
  async createEventDayEvent(userId, eventDayDate, options = {}) {
    if (!this.initialized) return null;

    try {
      const user = await this.db.getOrCreateUser(userId);

      // Event duration (default 4 hours)
      const duration = options.duration || 240; // minutes
      const endDate = new Date(eventDayDate.getTime() + duration * 60 * 1000);

      const eventData = {
        summary: `🎉 EVENT: ${user.event || user.instansi || 'Event Day'}`,
        description: `Event: ${user.event || 'TBD'}\n` +
                    `Organizer: ${user.instansi || user.nama || 'N/A'}\n` +
                    `Capacity: ${user.capacity || 'TBD'} attendees\n` +
                    `Ticket Price: Rp ${(user.ticketPrice || 0).toLocaleString('id-ID')}\n\n` +
                    `Venue: ${options.venue || 'TBD'}\n` +
                    `Instagram: ${user.igEventLink || user.igLink || 'N/A'}\n\n` +
                    `Contact Person 1: ${user.cpFirst || 'N/A'}\n` +
                    `Contact Person 2: ${user.cpSecond || 'N/A'}\n` +
                    `PIC: ${user.pic || 'N/A'}\n\n` +
                    `Notes: ${options.notes || ''}\n\n` +
                    `WhatsApp: ${user.id}`,
        start: eventDayDate,
        end: endDate,
        location: options.venue || user.eventDayVenue || 'TBD',
        attendees: options.attendees || [],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 7 * 24 * 60 },  // 1 week before
            { method: 'email', minutes: 24 * 60 },      // 1 day before
            { method: 'popup', minutes: 2 * 60 }        // 2 hours before
          ]
        }
      };

      const createdEvent = await this.calendarService.createEvent(eventData);

      if (createdEvent) {
        await this.db.updateUser(userId, {
          eventDayDate: eventDayDate,
          eventDayCalendarId: createdEvent.id,
          eventDayVenue: options.venue || null,
          eventDayNotes: options.notes || null
        });

        console.log(`[Sync] Created event day event for ${userId}: ${createdEvent.id}`);
      }

      return createdEvent;
    } catch (error) {
      console.error('[Sync] Error creating event day event:', error);
      throw error;
    }
  }

  /**
   * Update calendar event (any flow)
   * @param {string} calendarId - Google Calendar event ID
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated event
   */
  async updateCalendarEvent(calendarId, updates) {
    if (!this.initialized) return null;

    try {
      const updatedEvent = await this.calendarService.updateEvent(calendarId, updates);
      console.log(`[Sync] Updated calendar event: ${calendarId}`);
      return updatedEvent;
    } catch (error) {
      console.error('[Sync] Error updating calendar event:', error);
      throw error;
    }
  }

  /**
   * Delete calendar event (any flow)
   * @param {string} calendarId - Google Calendar event ID
   * @param {string} userId - User ID
   * @param {string} flowType - 'meeting', 'ticketSale', or 'eventDay'
   * @returns {boolean} Success status
   */
  async deleteCalendarEvent(calendarId, userId, flowType) {
    if (!this.initialized) return false;

    try {
      const success = await this.calendarService.deleteEvent(calendarId);

      if (success) {
        // Clear calendar ID from database
        const updateData = {};
        if (flowType === 'meeting') {
          updateData.meetingCalendarId = null;
        } else if (flowType === 'ticketSale') {
          updateData.ticketSaleCalendarId = null;
        } else if (flowType === 'eventDay') {
          updateData.eventDayCalendarId = null;
        }

        await this.db.updateUser(userId, updateData);
        console.log(`[Sync] Deleted ${flowType} event for ${userId}: ${calendarId}`);
      }

      return success;
    } catch (error) {
      console.error('[Sync] Error deleting calendar event:', error);
      return false;
    }
  }

  /**
   * Sync changes from Google Calendar to database
   * Checks for modified or deleted events
   * @returns {Object} Sync results
   */
  async syncFromGoogleCalendar() {
    if (!this.initialized) {
      return { synced: 0, updated: 0, deleted: 0 };
    }

    try {
      const users = await this.db.getAllUsers();
      let synced = 0, updated = 0, deleted = 0;

      for (const user of users) {
        // Check each flow type
        const flows = [
          { type: 'meeting', dateField: 'meetingDate', idField: 'meetingCalendarId' },
          { type: 'ticketSale', dateField: 'ticketSaleDate', idField: 'ticketSaleCalendarId' },
          { type: 'eventDay', dateField: 'eventDayDate', idField: 'eventDayCalendarId' }
        ];

        for (const flow of flows) {
          const calendarId = user[flow.idField];
          const dbDate = user[flow.dateField];

          if (calendarId && dbDate) {
            const status = await this.calendarService.checkEventStatus(calendarId, dbDate);

            if (!status.exists) {
              // Event was deleted in Google Calendar
              const updateData = {};
              updateData[flow.idField] = null;
              await this.db.updateUser(user.id, updateData);
              deleted++;
              console.log(`[Sync] Event deleted in Google Calendar: ${user.id} - ${flow.type}`);
            } else if (status.modified) {
              // Event was modified in Google Calendar
              const updateData = {};
              updateData[flow.dateField] = status.currentDate;
              await this.db.updateUser(user.id, updateData);
              updated++;
              console.log(`[Sync] Event updated from Google Calendar: ${user.id} - ${flow.type}`);
            }

            synced++;
          }
        }
      }

      console.log(`[Sync] Sync complete: ${synced} checked, ${updated} updated, ${deleted} deleted`);
      return { synced, updated, deleted };
    } catch (error) {
      console.error('[Sync] Error syncing from Google Calendar:', error);
      return { synced: 0, updated: 0, deleted: 0, error: error.message };
    }
  }

  /**
   * Batch sync all pending events to Google Calendar
   * Creates calendar events for users with dates but no calendar IDs
   * @returns {Object} Sync results
   */
  async syncToGoogleCalendar() {
    if (!this.initialized) {
      return { created: 0 };
    }

    try {
      const users = await this.db.getAllUsers();
      let created = 0;

      for (const user of users) {
        // Sync meeting events
        if (user.meetingDate && !user.meetingCalendarId) {
          await this.createMeetingEvent(user.id, new Date(user.meetingDate), {
            notes: user.meetingNotes
          });
          created++;
        }

        // Sync ticket sale events
        if (user.ticketSaleDate && !user.ticketSaleCalendarId) {
          await this.createTicketSaleEvent(user.id, new Date(user.ticketSaleDate), {
            notes: user.ticketSaleNotes
          });
          created++;
        }

        // Sync event day events
        if (user.eventDayDate && !user.eventDayCalendarId) {
          await this.createEventDayEvent(user.id, new Date(user.eventDayDate), {
            venue: user.eventDayVenue,
            notes: user.eventDayNotes
          });
          created++;
        }
      }

      console.log(`[Sync] Batch sync complete: ${created} events created`);
      return { created };
    } catch (error) {
      console.error('[Sync] Error batch syncing to Google Calendar:', error);
      return { created: 0, error: error.message };
    }
  }
}

export default CalendarSyncService;
