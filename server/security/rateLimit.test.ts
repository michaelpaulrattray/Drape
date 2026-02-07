import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit, getClientIp, rateLimitError, RATE_LIMITS } from './rateLimit';

describe('Rate Limiting', () => {
  beforeEach(() => {
    // Reset the rate limit store between tests by waiting for cleanup
    vi.useFakeTimers();
  });

  describe('checkRateLimit', () => {
    it('should allow first request', () => {
      const result = checkRateLimit('test-ip-1', {
        windowMs: 60000,
        maxRequests: 5,
        keyPrefix: 'test',
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should track requests within window', () => {
      const config = {
        windowMs: 60000,
        maxRequests: 3,
        keyPrefix: 'test2',
      };

      // First request
      let result = checkRateLimit('test-ip-2', config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);

      // Second request
      result = checkRateLimit('test-ip-2', config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);

      // Third request
      result = checkRateLimit('test-ip-2', config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);

      // Fourth request - should be blocked
      result = checkRateLimit('test-ip-2', config);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset after window expires', () => {
      const config = {
        windowMs: 1000, // 1 second window
        maxRequests: 1,
        keyPrefix: 'test3',
      };

      // First request - allowed
      let result = checkRateLimit('test-ip-3', config);
      expect(result.allowed).toBe(true);

      // Second request - blocked
      result = checkRateLimit('test-ip-3', config);
      expect(result.allowed).toBe(false);

      // Advance time past window
      vi.advanceTimersByTime(1100);

      // Third request - should be allowed (new window)
      result = checkRateLimit('test-ip-3', config);
      expect(result.allowed).toBe(true);
    });

    it('should track different IPs separately', () => {
      const config = {
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'test4',
      };

      // IP 1 - allowed
      let result = checkRateLimit('ip-a', config);
      expect(result.allowed).toBe(true);

      // IP 1 again - blocked
      result = checkRateLimit('ip-a', config);
      expect(result.allowed).toBe(false);

      // IP 2 - allowed (different IP)
      result = checkRateLimit('ip-b', config);
      expect(result.allowed).toBe(true);
    });
  });

  describe('getClientIp', () => {
    it('should extract IP from X-Forwarded-For header', () => {
      const req = {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1',
        },
        ip: '127.0.0.1',
      };

      expect(getClientIp(req)).toBe('192.168.1.1');
    });

    it('should extract IP from X-Real-IP header', () => {
      const req = {
        headers: {
          'x-real-ip': '192.168.1.2',
        },
        ip: '127.0.0.1',
      };

      expect(getClientIp(req)).toBe('192.168.1.2');
    });

    it('should fall back to req.ip', () => {
      const req = {
        headers: {},
        ip: '127.0.0.1',
      };

      expect(getClientIp(req)).toBe('127.0.0.1');
    });

    it('should return unknown for missing IP', () => {
      const req = {
        headers: {},
      };

      expect(getClientIp(req)).toBe('unknown');
    });
  });

  describe('rateLimitError', () => {
    it('should format seconds correctly', () => {
      expect(rateLimitError(30000)).toBe('Too many requests. Please try again in 30 seconds.');
    });

    it('should format minutes correctly', () => {
      expect(rateLimitError(120000)).toBe('Too many requests. Please try again in 2 minutes.');
    });

    it('should use singular minute', () => {
      expect(rateLimitError(60000)).toBe('Too many requests. Please try again in 1 minute.');
    });
  });

  describe('RATE_LIMITS config', () => {
    it('should have newsletter config', () => {
      expect(RATE_LIMITS.newsletter).toBeDefined();
      expect(RATE_LIMITS.newsletter.maxRequests).toBe(5);
      expect(RATE_LIMITS.newsletter.windowMs).toBe(60 * 60 * 1000);
    });

    it('should have waitlist config', () => {
      expect(RATE_LIMITS.waitlist).toBeDefined();
      expect(RATE_LIMITS.waitlist.maxRequests).toBe(5);
    });

    it('should have generation config', () => {
      expect(RATE_LIMITS.generation).toBeDefined();
      expect(RATE_LIMITS.generation.maxRequests).toBe(10);
      expect(RATE_LIMITS.generation.windowMs).toBe(60 * 1000);
    });

    it('should have billing config with strict limits', () => {
      expect(RATE_LIMITS.billing).toBeDefined();
      expect(RATE_LIMITS.billing.maxRequests).toBe(3);
    });
  });
});
