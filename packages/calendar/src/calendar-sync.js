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

      // Build description with conversation context
      const eventName = user.event || user.instansi || 'Event';
      const description = [
        `📋 Meeting - ${eventName}`,
        '',
        '👤 Contact:',
        `   Name: ${user.nama || 'N/A'}`,
        `   Organization: ${user.instansi || 'N/A'}`,
        `   WhatsApp: ${user.id}`,
        '',
        '🎫 Event Details:',
        `   Event: ${user.event || 'TBD'}`,
        `   Expected Capacity: ${user.capacity ? `${user.capacity.toLocaleString('id-ID')} pax` : 'TBD'}`,
        `   Ticket Price: ${user.ticketPrice ? `Rp ${user.ticketPrice.toLocaleString('id-ID')}` : 'TBD'}`,
        '',
        '💼 Discussion Topics:',
        `   - MoU and contract terms`,
        `   - Platform features and demo`,
        `   - Pricing negotiation`,
        `   - Timeline and implementation`,
        ''
      ];

      if (options.notes) {
        description.push('📝 Notes:', `   ${options.notes}`, '');
      }

      description.push('🔗 Quick Actions:', `   View in CRM: [Dashboard Link]`);

      const eventData = {
        summary: `📋 MoU Meeting: ${user.nama || user.id} - ${eventName}`,
        description: description.join('\n'),
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

      // Build detailed description with pricing context
      const eventName = user.event || user.instansi || 'Event';
      const description = [
        `🎫 Pembukaan Tiket - ${eventName}`,
        '',
        '📊 Ticket Information:',
        `   Ticket Price: ${user.ticketPrice ? `Rp ${user.ticketPrice.toLocaleString('id-ID')}` : 'TBD'}`,
        `   Expected Sales: ${user.capacity ? `${user.capacity.toLocaleString('id-ID')} tickets` : 'TBD'}`,
        `   Revenue Target: ${user.ticketPrice && user.capacity ? `Rp ${(user.ticketPrice * user.capacity).toLocaleString('id-ID')}` : 'TBD'}`,
        `   Pricing Scheme: ${user.pricingScheme || 'Standard'}`,
        '',
        '👤 Event Organizer:',
        `   Name: ${user.nama || 'N/A'}`,
        `   Organization: ${user.instansi || 'N/A'}`,
        `   Contact: ${user.id}`,
        ''
      ];

      // Add contact persons if available
      if (user.cpFirst || user.cpSecond) {
        description.push('📞 Contact Persons:');
        if (user.cpFirst) description.push(`   CP 1: ${user.cpFirst}`);
        if (user.cpSecond) description.push(`   CP 2: ${user.cpSecond}`);
        description.push('');
      }

      // Add social media if available
      if (user.igEventLink || user.igLink) {
        description.push('📱 Social Media:');
        if (user.igEventLink) description.push(`   Event IG: ${user.igEventLink}`);
        if (user.igLink) description.push(`   Organizer IG: ${user.igLink}`);
        description.push('');
      }

      description.push(
        '✅ Pre-Launch Checklist:',
        '   [ ] Platform setup complete',
        '   [ ] Payment gateway tested',
        '   [ ] Event page live',
        '   [ ] Marketing materials ready',
        '   [ ] Customer support prepared',
        ''
      );

      if (options.notes) {
        description.push('📝 Notes:', `   ${options.notes}`, '');
      }

      description.push('🔗 Dashboard: [View Event Details]');

      const eventData = {
        summary: `🎫 Pembukaan Tiket: ${eventName}`,
        description: description.join('\n'),
        start: ticketSaleDate,
        end: endDate,
        location: options.location || 'Online - NovaTix Platform',
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

      // Build comprehensive event description
      const eventName = user.event || user.instansi || 'Event Day';
      const venue = options.venue || user.eventDayVenue || 'TBD';

      const description = [
        `🎉 Hari Konser/Event - ${eventName}`,
        '',
        '📍 Venue Information:',
        `   Location: ${venue}`,
        `   Expected Attendance: ${user.capacity ? `${user.capacity.toLocaleString('id-ID')} attendees` : 'TBD'}`,
        `   Event Type: ${user.event || 'Concert/Event'}`,
        '',
        '🎫 Ticketing Summary:',
        `   Ticket Price: ${user.ticketPrice ? `Rp ${user.ticketPrice.toLocaleString('id-ID')}` : 'N/A'}`,
        `   Total Capacity: ${user.capacity ? `${user.capacity.toLocaleString('id-ID')} tickets` : 'TBD'}`,
        `   Expected Revenue: ${user.ticketPrice && user.capacity ? `Rp ${(user.ticketPrice * user.capacity).toLocaleString('id-ID')}` : 'TBD'}`,
        '',
        '👤 Event Organizer:',
        `   Organization: ${user.instansi || 'N/A'}`,
        `   PIC: ${user.pic || user.nama || 'N/A'}`,
        ''
      ];

      // Add contact persons
      if (user.cpFirst || user.cpSecond) {
        description.push('📞 On-Site Contacts:');
        if (user.cpFirst) description.push(`   CP 1: ${user.cpFirst}`);
        if (user.cpSecond) description.push(`   CP 2: ${user.cpSecond}`);
        description.push(`   WhatsApp: ${user.id}`);
        description.push('');
      }

      // Add social media
      if (user.igEventLink || user.igLink) {
        description.push('📱 Social Media:');
        if (user.igEventLink) description.push(`   Event IG: ${user.igEventLink}`);
        if (user.igLink) description.push(`   Organizer IG: ${user.igLink}`);
        description.push('');
      }

      // Add event day checklist
      description.push(
        '✅ Event Day Checklist:',
        '   [ ] Venue setup complete',
        '   [ ] Ticketing system operational',
        '   [ ] QR scanners ready',
        '   [ ] Staff briefed',
        '   [ ] Emergency protocols in place',
        '   [ ] Customer support on standby',
        ''
      );

      // Add technical requirements
      description.push(
        '⚙️ Technical Setup:',
        '   [ ] Internet connection verified',
        '   [ ] Backup devices ready',
        '   [ ] Payment gateway active',
        '   [ ] Real-time dashboard monitoring',
        ''
      );

      if (options.notes) {
        description.push('📝 Additional Notes:', `   ${options.notes}`, '');
      }

      description.push(
        '🔗 Resources:',
        '   Dashboard: [Real-time Event Monitoring]',
        '   Support: [Emergency Contact]'
      );

      const eventData = {
        summary: `🎉 Hari Konser: ${eventName}`,
        description: description.join('\n'),
        start: eventDayDate,
        end: endDate,
        location: venue,
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
