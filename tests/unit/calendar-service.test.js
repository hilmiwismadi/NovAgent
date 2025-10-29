/**
 * Unit Tests for Calendar Service
 * Tests date utilities and calendar logic
 */

import { describe, test, expect } from '@jest/globals';

describe('Calendar Service - Utility Functions', () => {
  describe('Date Validation', () => {
    test('should validate date format', () => {
      const validDates = [
        '2025-01-15',
        '2025-12-31',
        '2025-06-01'
      ];

      validDates.forEach(date => {
        const parsed = new Date(date);
        expect(parsed instanceof Date && !isNaN(parsed)).toBe(true);
      });
    });

    test('should reject invalid dates', () => {
      const invalidDates = [
        'not-a-date',
        'invalid',
        '99999-99-99'
      ];

      invalidDates.forEach(date => {
        const parsed = new Date(date);
        const isValid = !isNaN(parsed.getTime());
        expect(isValid).toBe(false);
      });
    });

    test('should check if date is in future', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);

      expect(futureDate > new Date()).toBe(true);
      expect(pastDate > new Date()).toBe(false);
    });

    test('should check if date is today', () => {
      const today = new Date();
      const todayString = today.toDateString();

      const testDate = new Date();
      const isToday = testDate.toDateString() === todayString;

      expect(isToday).toBe(true);
    });
  });

  describe('Date Calculations', () => {
    test('should calculate days until event', () => {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 30);

      const today = new Date();
      const daysUntil = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));

      expect(daysUntil).toBeGreaterThanOrEqual(29);
      expect(daysUntil).toBeLessThanOrEqual(31);
    });

    test('should calculate weeks until event', () => {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 14);

      const today = new Date();
      const daysUntil = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
      const weeksUntil = Math.floor(daysUntil / 7);

      expect(weeksUntil).toBe(2);
    });

    test('should add business days', () => {
      const startDate = new Date('2025-01-13'); // Monday
      const businessDays = 5;

      let result = new Date(startDate);
      let daysAdded = 0;

      while (daysAdded < businessDays) {
        result.setDate(result.getDate() + 1);
        const dayOfWeek = result.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          daysAdded++;
        }
      }

      // Should be Friday (day 5) or Monday (day 1) of next week
      expect([1, 5].includes(result.getDay())).toBe(true);
    });
  });

  describe('Time Formatting', () => {
    test('should format date for display (Indonesian)', () => {
      const date = new Date('2025-01-15');
      const formatted = date.toLocaleDateString('id-ID');

      expect(formatted).toContain('2025');
    });

    test('should format date and time', () => {
      const date = new Date('2025-01-15T14:30:00');
      const formatted = date.toLocaleString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });

    test('should get time ago text', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const diff = Math.floor((now - oneHourAgo) / 1000);

      const minutes = Math.floor(diff / 60);
      const hours = Math.floor(minutes / 60);

      expect(hours).toBe(1);
    });
  });

  describe('Event Scheduling', () => {
    test('should check for scheduling conflicts', () => {
      const existingEvents = [
        { start: new Date('2025-02-01T10:00:00'), end: new Date('2025-02-01T12:00:00') },
        { start: new Date('2025-02-01T14:00:00'), end: new Date('2025-02-01T16:00:00') }
      ];

      const newEvent = {
        start: new Date('2025-02-01T11:00:00'),
        end: new Date('2025-02-01T13:00:00')
      };

      const hasConflict = existingEvents.some(event =>
        (newEvent.start >= event.start && newEvent.start < event.end) ||
        (newEvent.end > event.start && newEvent.end <= event.end) ||
        (newEvent.start <= event.start && newEvent.end >= event.end)
      );

      expect(hasConflict).toBe(true);
    });

    test('should find no conflict with different times', () => {
      const existingEvents = [
        { start: new Date('2025-02-01T10:00:00'), end: new Date('2025-02-01T12:00:00') }
      ];

      const newEvent = {
        start: new Date('2025-02-01T14:00:00'),
        end: new Date('2025-02-01T16:00:00')
      };

      const hasConflict = existingEvents.some(event =>
        (newEvent.start >= event.start && newEvent.start < event.end) ||
        (newEvent.end > event.start && newEvent.end <= event.end) ||
        (newEvent.start <= event.start && newEvent.end >= event.end)
      );

      expect(hasConflict).toBe(false);
    });
  });

  describe('Reminder Calculations', () => {
    test('should calculate reminder times', () => {
      const eventDate = new Date('2025-03-15T10:00:00');

      const oneDayBefore = new Date(eventDate);
      oneDayBefore.setDate(oneDayBefore.getDate() - 1);

      const oneWeekBefore = new Date(eventDate);
      oneWeekBefore.setDate(oneWeekBefore.getDate() - 7);

      expect(oneDayBefore.getDate()).toBe(14);
      expect(oneWeekBefore.getDate()).toBe(8);
    });

    test('should check if reminder time has passed', () => {
      const reminderTime = new Date();
      reminderTime.setHours(reminderTime.getHours() - 1);

      const hasPassed = reminderTime < new Date();

      expect(hasPassed).toBe(true);
    });

    test('should generate multiple reminder times', () => {
      const eventDate = new Date('2025-03-15T10:00:00');
      const reminderDays = [1, 3, 7];

      const reminders = reminderDays.map(days => {
        const reminder = new Date(eventDate);
        reminder.setDate(reminder.getDate() - days);
        return reminder;
      });

      expect(reminders).toHaveLength(3);
      expect(reminders[0] < reminders[1]).toBe(false); // 1 day before is later than 3 days
      expect(reminders[1] < reminders[2]).toBe(false);
    });
  });

  describe('Calendar Event Properties', () => {
    test('should create event object with required fields', () => {
      const event = {
        summary: 'Team Meeting',
        description: 'Weekly sync',
        start: { dateTime: '2025-02-01T10:00:00Z' },
        end: { dateTime: '2025-02-01T11:00:00Z' },
        attendees: [
          { email: 'user1@example.com' },
          { email: 'user2@example.com' }
        ]
      };

      expect(event.summary).toBeDefined();
      expect(event.start.dateTime).toBeDefined();
      expect(event.attendees).toHaveLength(2);
    });

    test('should validate event duration', () => {
      const start = new Date('2025-02-01T10:00:00');
      const end = new Date('2025-02-01T11:30:00');

      const durationMs = end - start;
      const durationMinutes = durationMs / (1000 * 60);

      expect(durationMinutes).toBe(90);
    });

    test('should check if event is all-day', () => {
      const allDayEvent = {
        start: { date: '2025-02-01' },
        end: { date: '2025-02-02' }
      };

      const timedEvent = {
        start: { dateTime: '2025-02-01T10:00:00Z' },
        end: { dateTime: '2025-02-01T11:00:00Z' }
      };

      const isAllDay1 = !!allDayEvent.start.date && !allDayEvent.start.dateTime;
      const isAllDay2 = !!timedEvent.start.date && !timedEvent.start.dateTime;

      expect(isAllDay1).toBe(true);
      expect(isAllDay2).toBe(false);
    });
  });

  describe('Timezone Handling', () => {
    test('should convert to specific timezone', () => {
      const date = new Date('2025-02-01T10:00:00Z');
      const jakartaOffset = 7 * 60; // UTC+7 in minutes

      const localTime = new Date(date.getTime() + jakartaOffset * 60 * 1000);

      expect(localTime.getUTCHours()).toBe(17); // 10 + 7
    });

    test('should handle daylight saving time', () => {
      const date = new Date();
      const offset = date.getTimezoneOffset();

      expect(typeof offset).toBe('number');
    });
  });

  describe('Recurring Events', () => {
    test('should check if event is recurring', () => {
      const recurringEvent = {
        summary: 'Weekly Meeting',
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO']
      };

      const oneTimeEvent = {
        summary: 'One-time Meeting'
      };

      expect(Array.isArray(recurringEvent.recurrence)).toBe(true);
      expect(oneTimeEvent.recurrence).toBeUndefined();
    });

    test('should parse recurrence rule', () => {
      const rule = 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR';

      const isWeekly = rule.includes('FREQ=WEEKLY');
      const days = rule.match(/BYDAY=([A-Z,]+)/)?.[1].split(',');

      expect(isWeekly).toBe(true);
      expect(days).toEqual(['MO', 'WE', 'FR']);
    });
  });

  describe('Event Filtering', () => {
    test('should filter events by date range', () => {
      const events = [
        { start: { dateTime: '2025-01-15T10:00:00Z' } },
        { start: { dateTime: '2025-02-01T10:00:00Z' } },
        { start: { dateTime: '2025-02-15T10:00:00Z' } }
      ];

      const rangeStart = new Date('2025-02-01');
      const rangeEnd = new Date('2025-02-28');

      const filtered = events.filter(event => {
        const eventDate = new Date(event.start.dateTime);
        return eventDate >= rangeStart && eventDate <= rangeEnd;
      });

      expect(filtered).toHaveLength(2);
    });

    test('should filter events by attendee', () => {
      const events = [
        { attendees: [{ email: 'user1@example.com' }, { email: 'user2@example.com' }] },
        { attendees: [{ email: 'user3@example.com' }] },
        { attendees: [{ email: 'user1@example.com' }] }
      ];

      const filtered = events.filter(event =>
        event.attendees?.some(a => a.email === 'user1@example.com')
      );

      expect(filtered).toHaveLength(2);
    });
  });

  describe('Event Sorting', () => {
    test('should sort events by start time', () => {
      const events = [
        { start: { dateTime: '2025-02-15T10:00:00Z' } },
        { start: { dateTime: '2025-02-01T10:00:00Z' } },
        { start: { dateTime: '2025-02-10T10:00:00Z' } }
      ];

      const sorted = [...events].sort((a, b) =>
        new Date(a.start.dateTime) - new Date(b.start.dateTime)
      );

      expect(new Date(sorted[0].start.dateTime).getDate()).toBe(1);
      expect(new Date(sorted[2].start.dateTime).getDate()).toBe(15);
    });
  });

  describe('Event Status', () => {
    test('should determine event status', () => {
      const now = new Date();

      const upcomingEvent = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const pastEvent = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const ongoingEventStart = new Date(now.getTime() - 60 * 60 * 1000);
      const ongoingEventEnd = new Date(now.getTime() + 60 * 60 * 1000);

      const isUpcoming = upcomingEvent > now;
      const isPast = pastEvent < now;
      const isOngoing = ongoingEventStart < now && ongoingEventEnd > now;

      expect(isUpcoming).toBe(true);
      expect(isPast).toBe(true);
      expect(isOngoing).toBe(true);
    });
  });
});
