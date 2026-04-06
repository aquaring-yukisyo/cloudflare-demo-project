/**
 * Unit Tests for Input Sanitization
 * Requirement 10.1: Input value sanitization
 */

import { describe, it, expect } from 'vitest';
import { sanitizeString, sanitizeKey, sanitizeEmail, isValidEmail, isNonEmptyString } from './sanitize';

describe('sanitizeString', () => {
  it('should remove HTML tags', () => {
    expect(sanitizeString('<script>alert("xss")</script>')).toBe('alert("xss")');
    expect(sanitizeString('Hello <b>World</b>')).toBe('Hello World');
  });

  it('should remove null bytes', () => {
    expect(sanitizeString('Hello\0World')).toBe('HelloWorld');
  });

  it('should trim whitespace', () => {
    expect(sanitizeString('  Hello World  ')).toBe('Hello World');
  });

  it('should remove control characters', () => {
    expect(sanitizeString('Hello\x00\x01\x02World')).toBe('HelloWorld');
  });

  it('should handle empty strings', () => {
    expect(sanitizeString('')).toBe('');
    expect(sanitizeString('   ')).toBe('');
  });
});

describe('sanitizeKey', () => {
  it('should remove path traversal attempts', () => {
    expect(sanitizeKey('../../../etc/passwd')).toBe('etcpasswd');
    expect(sanitizeKey('..\\..\\windows\\system32')).toBe('windowssystem32');
  });

  it('should remove slashes', () => {
    expect(sanitizeKey('path/to/file')).toBe('pathtofile');
    expect(sanitizeKey('path\\to\\file')).toBe('pathtofile');
  });

  it('should remove null bytes and control characters', () => {
    expect(sanitizeKey('key\0name')).toBe('keyname');
    expect(sanitizeKey('key\x01name')).toBe('keyname');
  });

  it('should trim whitespace', () => {
    expect(sanitizeKey('  mykey  ')).toBe('mykey');
  });

  it('should handle normal keys', () => {
    expect(sanitizeKey('my-valid-key')).toBe('my-valid-key');
    expect(sanitizeKey('user_123')).toBe('user_123');
  });
});

describe('sanitizeEmail', () => {
  it('should convert to lowercase', () => {
    expect(sanitizeEmail('USER@EXAMPLE.COM')).toBe('user@example.com');
  });

  it('should remove HTML tags', () => {
    expect(sanitizeEmail('<script>user@example.com</script>')).toBe('user@example.com');
  });

  it('should trim whitespace', () => {
    expect(sanitizeEmail('  user@example.com  ')).toBe('user@example.com');
  });

  it('should remove null bytes and control characters', () => {
    expect(sanitizeEmail('user\0@example.com')).toBe('user@example.com');
  });
});

describe('isValidEmail', () => {
  it('should validate correct email formats', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('test.user@example.co.uk')).toBe(true);
    expect(isValidEmail('user+tag@example.com')).toBe(true);
  });

  it('should reject invalid email formats', () => {
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('invalid@')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('isNonEmptyString', () => {
  it('should return true for non-empty strings', () => {
    expect(isNonEmptyString('hello')).toBe(true);
    expect(isNonEmptyString('a')).toBe(true);
  });

  it('should return false for empty or whitespace strings', () => {
    expect(isNonEmptyString('')).toBe(false);
    expect(isNonEmptyString('   ')).toBe(false);
    expect(isNonEmptyString('\t\n')).toBe(false);
  });

  it('should return false for non-strings', () => {
    expect(isNonEmptyString(123 as any)).toBe(false);
    expect(isNonEmptyString(null as any)).toBe(false);
    expect(isNonEmptyString(undefined as any)).toBe(false);
  });
});
