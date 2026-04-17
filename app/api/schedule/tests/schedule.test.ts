import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import the actual route handlers
import { POST as importHandler } from '../import/route';
import { POST as exportHandler } from '../export/route';
import {validateEmail} from '../utils/validation';

describe('Schedule API Routes', () => {

  // =====================
  // /api/schedule/import
  // =====================
  describe('POST /api/schedule/import', () => {

    it('returns success when valid JSON is sent', async () => {
      // 1. Build a fake Request with valid body
      const body = {
        config: { academic_year: '2026', semester: 1, columns: [] },
        teachers: [],
        students: [],
        rooms: [],
      };
      const request = new Request('http://localhost/api/schedule/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      // 2. Call the handler directly
      const response = await importHandler(request);
      const json = await response.json();

      // 3. Assert
      expect(response.status).toBe(200);
      expect(json.message).toBe('Import successful');
      expect(json.data.config.academic_year).toBe('2026');
    });

    it('returns 400 when required sections are missing', async () => {
      const request = new Request('http://localhost/api/schedule/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: {} }), // missing teachers, students, rooms
      });

      const response = await importHandler(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain('Missing required sections');
    });

    it('returns 400 when body is not valid JSON', async () => {
      const request = new Request('http://localhost/api/schedule/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'this is not json!!!',
      });

      const response = await importHandler(request);
      expect(response.status).toBe(400);
    });

    // Test with empty body
    it('returns 400 when body is empty object', async () => {
      const request = new Request('http://localhost/api/schedule/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const response = await importHandler(request);
      expect(response.status).toBe(400);
    });
  });

  // =====================
  // /api/schedule/export
  // =====================
  describe('POST /api/schedule/export', () => {

    it('returns a valid export response', async () => {
      const body = {
        config: { academic_year: '2026', semester: 1, columns: [] },
        _rawState: {
          Monday: {
            '1': {
              subject: 'Math',
              teacher: 'T001',
              room: 'A101',
              class: '1',
            },
          },
        },
      };

      const request = new Request('http://localhost/api/schedule/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const response = await exportHandler(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json).toBeDefined();
    });

    it('handles export with no schedule data', async () => {
      const request = new Request('http://localhost/api/schedule/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: {}, _rawState: {} }),
      });
      const response = await exportHandler(request);
      expect(response.status).toBe(200);
    });
  });

  describe('validateEmail', () => {
    it('accepts valid emails', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.th')).toBe(true);
    });

    it('rejects invalid emails', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail('not-an-email')).toBe(false);
      expect(validateEmail('test@.com')).toBe(false);
      expect(validateEmail('@domain.com')).toBe(false);
    });
  });
});