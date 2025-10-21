/**
 * Calendar Package Index
 * Exports all calendar-related services
 */

export { GoogleCalendarService } from './google-calendar-service.js';
export { CalendarSyncService } from './calendar-sync.js';
export { ReminderScheduler } from './reminder-scheduler.js';

export default {
  GoogleCalendarService: () => import('./google-calendar-service.js').then(m => m.GoogleCalendarService),
  CalendarSyncService: () => import('./calendar-sync.js').then(m => m.CalendarSyncService),
  ReminderScheduler: () => import('./reminder-scheduler.js').then(m => m.ReminderScheduler)
};
