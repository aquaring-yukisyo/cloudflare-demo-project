/**
 * Integration Tests for Input Validation and Sanitization
 * Requirements 6.1, 6.2, 6.3, 10.1, 10.3
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { unstable_dev, UnstableDevWorker } from 'wrangler';

const MASTER_KEY = 'Aquaring@74';

describe('Input Validation and Sanitization', () => {
  let worker: UnstableDevWorker;
  let testApiKey: string;

  beforeAll(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
    });
    
    // Register a test API key for D1/R2 operations
    testApiKey = 'test-validation-key-' + Date.now();
    await worker.fetch(`/kv/api-keys/${testApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': MASTER_KEY,
      },
      body: JSON.stringify({ description: 'Test API key for validation tests' }),
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  describe('KV Endpoint Validation', () => {
    it('should return 400 for invalid request body', async () => {
      const response = await worker.fetch('/kv/testkey', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': MASTER_KEY,
        },
        body: JSON.stringify({ invalid: 'field' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('ValidationError');
      expect(data.message).toContain('value');
    });

    it('should sanitize key with dangerous characters', async () => {
      const response = await worker.fetch('/kv/test..key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': MASTER_KEY,
        },
        body: JSON.stringify({ value: 'test' }),
      });

      // Should succeed after sanitization
      expect(response.status).toBe(201);
    });

    it('should sanitize HTML in values', async () => {
      const response = await worker.fetch('/kv/htmltest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': MASTER_KEY,
        },
        body: JSON.stringify({ value: '<script>alert("xss")</script>Hello' }),
      });

      expect(response.status).toBe(201);

      // Retrieve and verify sanitization
      const getResponse = await worker.fetch('/kv/htmltest', {
        headers: { 'X-API-Key': MASTER_KEY },
      });
      const data = await getResponse.json();
      expect(data.value).not.toContain('<script>');
      expect(data.value).toContain('Hello');
    });
  });

  describe('D1 User Endpoint Validation', () => {
    it('should return 400 for missing required fields', async () => {
      const response = await worker.fetch('/d1/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': testApiKey,
        },
        body: JSON.stringify({ name: 'Test User' }), // missing email
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('ValidationError');
    });

    it('should return 400 for invalid email format', async () => {
      const response = await worker.fetch('/d1/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': testApiKey,
        },
        body: JSON.stringify({ name: 'Test User', email: 'invalid-email' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('ValidationError');
      expect(data.message).toContain('email');
    });

    it('should sanitize HTML in user name', async () => {
      const uniqueEmail = `john-${Date.now()}@example.com`;
      const response = await worker.fetch('/d1/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': testApiKey,
        },
        body: JSON.stringify({
          name: '<script>alert("xss")</script>John Doe',
          email: uniqueEmail,
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.data.name).not.toContain('<script>');
      expect(data.data.name).toContain('John Doe');
    });

    it('should return 400 for invalid user ID', async () => {
      const response = await worker.fetch('/d1/users/invalid-id', {
        headers: { 'X-API-Key': testApiKey },
      });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('ValidationError');
      expect(data.message).toContain('positive integer');
    });

    it('should return 400 for negative user ID', async () => {
      const response = await worker.fetch('/d1/users/-1', {
        headers: { 'X-API-Key': testApiKey },
      });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('ValidationError');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await worker.fetch('/d1/users/999999', {
        headers: { 'X-API-Key': testApiKey },
      });
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('NotFound');
    });
  });

  describe('R2 Endpoint Validation', () => {
    it('should return 400 for empty file upload', async () => {
      const response = await worker.fetch('/r2/testfile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-API-Key': testApiKey,
        },
        body: new ArrayBuffer(0),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('ValidationError');
      expect(data.message).toContain('empty');
    });

    it('should sanitize key with dangerous characters', async () => {
      const testData = new TextEncoder().encode('test file content');
      const response = await worker.fetch('/r2/test..file', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'X-API-Key': testApiKey,
        },
        body: testData,
      });

      // Should succeed after sanitization
      expect(response.status).toBe(201);
    });

    it('should return 404 for non-existent file', async () => {
      const response = await worker.fetch('/r2/nonexistent-file', {
        headers: { 'X-API-Key': testApiKey },
      });
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('NotFound');
    });
  });

  describe('Error Response Format', () => {
    it('should return unified error format for 404', async () => {
      const response = await worker.fetch('/nonexistent-endpoint');
      expect(response.status).toBe(404);
      const data = await response.json();
      
      // Verify unified error format (Requirement 6.4)
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('timestamp');
      expect(data.error).toBe('NotFound');
      expect(data.status).toBe(404);
    });

    it('should return unified error format for validation errors', async () => {
      const response = await worker.fetch('/kv/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': MASTER_KEY,
        },
        body: JSON.stringify({ invalid: 'data' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      
      // Verify unified error format
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('timestamp');
      expect(data.error).toBe('ValidationError');
      expect(data.status).toBe(400);
    });
  });

  describe('Endpoint Existence', () => {
    it('should return 404 for non-existent endpoints (Requirement 6.2)', async () => {
      const response = await worker.fetch('/this-does-not-exist');
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('NotFound');
      expect(data.message).toContain('not found');
    });

    it('should return 404 for invalid HTTP methods', async () => {
      const response = await worker.fetch('/', { method: 'PATCH' });
      expect(response.status).toBe(404);
    });
  });
});
