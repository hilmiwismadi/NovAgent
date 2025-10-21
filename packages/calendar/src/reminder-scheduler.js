/**
 * WhatsApp Reminder Scheduler
 * Sends WhatsApp reminders for upcoming events
 * Runs as a cron job checking daily
 */

import cron from 'node-cron';

export class ReminderScheduler {
  constructor(databaseService, whatsappClient) {
    this.db = databaseService;
    this.wa = whatsappClient;
    this.cronJob = null;
  }

  /**
   * Start the reminder scheduler
   * Runs daily at 9:00 AM
   */
  start() {
    // Run every day at 9:00 AM Jakarta time
    this.cronJob = cron.schedule('0 9 * * *', async () => {
      console.log('[Reminder] Running daily reminder check...');
      await this.checkAndSendReminders();
    }, {
      timezone: 'Asia/Jakarta'
    });

    console.log('[Reminder] Reminder scheduler started (daily at 9:00 AM)');
  }

  /**
   * Stop the reminder scheduler
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('[Reminder] Reminder scheduler stopped');
    }
  }

  /**
   * Check for upcoming events and send reminders
   */
  async checkAndSendReminders() {
    try {
      const users = await this.db.getAllUsers();
      let remindersSent = 0;

      const now = new Date();

      for (const user of users) {
        const reminders = this.parseRemindersSent(user.remindersSent);

        // Check Meeting Reminders (Flow 1)
        if (user.meetingDate) {
          const sent = await this.checkMeetingReminders(user, reminders, now);
          if (sent) remindersSent += sent;
        }

        // Check Ticket Sale Reminders (Flow 2)
        if (user.ticketSaleDate) {
          const sent = await this.checkTicketSaleReminders(user, reminders, now);
          if (sent) remindersSent += sent;
        }

        // Check Event Day Reminders (Flow 3)
        if (user.eventDayDate) {
          const sent = await this.checkEventDayReminders(user, reminders, now);
          if (sent) remindersSent += sent;
        }

        // Update reminders sent tracking
        if (Object.keys(reminders).length > 0) {
          await this.db.updateUser(user.id, {
            remindersSent: reminders
          });
        }
      }

      console.log(`[Reminder] Check complete: ${remindersSent} reminders sent`);
      return remindersSent;
    } catch (error) {
      console.error('[Reminder] Error checking reminders:', error);
      return 0;
    }
  }

  /**
   * Check and send meeting reminders
   */
  async checkMeetingReminders(user, reminders, now) {
    const meetingDate = new Date(user.meetingDate);
    const daysDiff = this.getDaysDifference(now, meetingDate);
    let sent = 0;

    // 1 day before reminder
    if (daysDiff === 1 && !reminders.meeting_1day) {
      await this.sendReminder(user, 'meeting', '1 day', meetingDate);
      reminders.meeting_1day = new Date().toISOString();
      sent++;
    }

    // Same day reminder (if meeting is later today)
    if (daysDiff === 0 && !reminders.meeting_sameday && this.isLaterToday(meetingDate, now)) {
      await this.sendReminder(user, 'meeting', 'today', meetingDate);
      reminders.meeting_sameday = new Date().toISOString();
      sent++;
    }

    return sent;
  }

  /**
   * Check and send ticket sale reminders
   */
  async checkTicketSaleReminders(user, reminders, now) {
    const saleDate = new Date(user.ticketSaleDate);
    const daysDiff = this.getDaysDifference(now, saleDate);
    let sent = 0;

    // 3 days before reminder
    if (daysDiff === 3 && !reminders.ticketSale_3days) {
      await this.sendReminder(user, 'ticketSale', '3 days', saleDate);
      reminders.ticketSale_3days = new Date().toISOString();
      sent++;
    }

    // 1 day before reminder
    if (daysDiff === 1 && !reminders.ticketSale_1day) {
      await this.sendReminder(user, 'ticketSale', '1 day', saleDate);
      reminders.ticketSale_1day = new Date().toISOString();
      sent++;
    }

    return sent;
  }

  /**
   * Check and send event day reminders
   */
  async checkEventDayReminders(user, reminders, now) {
    const eventDate = new Date(user.eventDayDate);
    const daysDiff = this.getDaysDifference(now, eventDate);
    let sent = 0;

    // 1 week before reminder
    if (daysDiff === 7 && !reminders.eventDay_7days) {
      await this.sendReminder(user, 'eventDay', '1 week', eventDate);
      reminders.eventDay_7days = new Date().toISOString();
      sent++;
    }

    // 1 day before reminder
    if (daysDiff === 1 && !reminders.eventDay_1day) {
      await this.sendReminder(user, 'eventDay', '1 day', eventDate);
      reminders.eventDay_1day = new Date().toISOString();
      sent++;
    }

    return sent;
  }

  /**
   * Send reminder message via WhatsApp
   */
  async sendReminder(user, type, timeframe, eventDate) {
    try {
      const message = this.formatReminderMessage(user, type, timeframe, eventDate);

      if (this.wa && this.wa.queueMessage) {
        this.wa.queueMessage(user.id, message);
        console.log(`[Reminder] Sent ${type} reminder to ${user.id} (${timeframe} before)`);
        return true;
      } else {
        console.log(`[Reminder] WhatsApp client not available, would send: ${message}`);
        return false;
      }
    } catch (error) {
      console.error(`[Reminder] Error sending reminder to ${user.id}:`, error);
      return false;
    }
  }

  /**
   * Format reminder message based on type
   */
  formatReminderMessage(user, type, timeframe, eventDate) {
    const dateStr = this.formatDate(eventDate);
    const timeStr = this.formatTime(eventDate);

    let message = `🔔 *Reminder: ${timeframe} before event*\n\n`;

    if (type === 'meeting') {
      message += `📅 *Meeting Appointment*\n`;
      message += `Date: ${dateStr}\n`;
      message += `Time: ${timeStr}\n`;
      if (user.meetingNotes) {
        message += `Notes: ${user.meetingNotes}\n`;
      }
      message += `\nJangan lupa ya! See you soon! 🤝`;
    } else if (type === 'ticketSale') {
      message += `🎫 *Ticket Sale Opens*\n`;
      message += `Event: ${user.event || 'Your Event'}\n`;
      message += `Opening Date: ${dateStr}\n`;
      message += `Opening Time: ${timeStr}\n`;
      message += `Ticket Price: Rp ${(user.ticketPrice || 0).toLocaleString('id-ID')}\n`;
      message += `\nSemua sudah siap? Let's launch! 🚀`;
    } else if (type === 'eventDay') {
      message += `🎉 *Event Day Coming Up!*\n`;
      message += `Event: ${user.event || 'Your Event'}\n`;
      message += `Date: ${dateStr}\n`;
      message += `Time: ${timeStr}\n`;
      message += `Venue: ${user.eventDayVenue || 'TBD'}\n`;
      message += `Expected Attendance: ${user.capacity || 'TBD'} pax\n`;
      if (user.eventDayNotes) {
        message += `Notes: ${user.eventDayNotes}\n`;
      }
      message += `\nGood luck with your event! 🎊`;
    }

    message += `\n\n_This is an automated reminder from NovaTix_`;

    return message;
  }

  /**
   * Parse remindersSent JSON field
   */
  parseRemindersSent(remindersSent) {
    if (!remindersSent) return {};
    if (typeof remindersSent === 'object') return remindersSent;
    try {
      return JSON.parse(remindersSent);
    } catch {
      return {};
    }
  }

  /**
   * Get days difference between two dates
   */
  getDaysDifference(date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000;
    const diffDays = Math.round((date2.getTime() - date1.getTime()) / oneDay);
    return diffDays;
  }

  /**
   * Check if event is later today
   */
  isLaterToday(eventDate, now) {
    return eventDate.toDateString() === now.toDateString() && eventDate.getTime() > now.getTime();
  }

  /**
   * Format date for display
   */
  formatDate(date) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('id-ID', options);
  }

  /**
   * Format time for display
   */
  formatTime(date) {
    const options = { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' };
    return date.toLocaleTimeString('id-ID', options) + ' WIB';
  }

  /**
   * Manual trigger for testing
   */
  async triggerManually() {
    console.log('[Reminder] Manual trigger initiated');
    return await this.checkAndSendReminders();
  }
}

export default ReminderScheduler;
