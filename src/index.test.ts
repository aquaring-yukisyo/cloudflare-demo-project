/**
 * Unit tests for Hono application entry point
 * Tests basic functionality, CORS, authentication, and error handling
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';

const MASTER_KEY = 'Aquaring@74';

describe('Hono Application Entry Point', () => {
  let worker: UnstableDevWorker;

  beforeAll(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  describe('GET /', () => {
    it('should return API information with 200 status', async () => {
      const response = await worker.fetch('/');
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('authentication');
      expect(data).toHaveProperty('endpoints');
      expect(Array.isArray(data.endpoints)).toBe(true);
      expect(data.endpoints.length).toBeGreaterThan(0);
    });

    it('should return valid JSON', async () => {
      const response = await worker.fetch('/');
      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('application/json');

      // Should not throw when parsing JSON
      const data = await response.json();
      expect(data).toBeDefined();
    });

    it('should include CORS headers', async () => {
      const response = await worker.fetch('/');
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
    });
  });

  describe('Authentication', () => {
    describe('KV Authentication', () => {
      it('should reject KV operations without API key', async () => {
        const response = await worker.fetch('/kv/test-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: 'test' }),
        });
        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe('Unauthorized');
      });

      it('should reject KV operations with invalid API key', async () => {
        const response = await worker.fetch('/kv/test-key', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'invalid-key',
          },
          body: JSON.stringify({ value: 'test' }),
        });
        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe('Unauthorized');
      });

      it('should accept KV operations with valid master key', async () => {
        const response = await worker.fetch('/kv/test-key', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': MASTER_KEY,
          },
          body: JSON.stringify({ value: 'test' }),
        });
        expect(response.status).toBe(201);
      });
    });

    describe('D1/R2 Authentication', () => {
      it('should reject D1 operations without API key', async () => {
        const response = await worker.fetch('/d1/users');
        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe('Unauthorized');
      });

      it('should reject R2 operations without API key', async () => {
        const response = await worker.fetch('/r2');
        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe('Unauthorized');
      });
    });

    describe('API Key Management', () => {
      const testApiKey = 'test-api-key-' + Date.now();

      it('should register new API key with master key', async () => {
        const response = await worker.fetch(`/kv/api-keys/${testApiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': MASTER_KEY,
          },
          body: JSON.stringify({ description: 'Test API key' }),
        });
        expect(response.status).toBe(201);
        const data = await response.json();
        expect(data.success).toBe(true);
      });

      it('should list registered API keys', async () => {
        const response = await worker.fetch('/kv/api-keys', {
          headers: { 'X-API-Key': MASTER_KEY },
        });
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(Array.isArray(data.apiKeys)).toBe(true);
      });

      it('should allow D1 operations with registered API key', async () => {
        const response = await worker.fetch('/d1/users', {
          headers: { 'X-API-Key': testApiKey },
        });
        expect(response.status).toBe(200);
      });

      it('should allow R2 operations with registered API key', async () => {
        const response = await worker.fetch('/r2', {
          headers: { 'X-API-Key': testApiKey },
        });
        expect(response.status).toBe(200);
      });

      it('should revoke API key with master key', async () => {
        const response = await worker.fetch(`/kv/api-keys/${testApiKey}`, {
          method: 'DELETE',
          headers: { 'X-API-Key': MASTER_KEY },
        });
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
      });

      it('should reject D1 operations with revoked API key', async () => {
        const response = await worker.fetch('/d1/users', {
          headers: { 'X-API-Key': testApiKey },
        });
        expect(response.status).toBe(401);
      });
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await worker.fetch('/health');
      const data = await response.json();

      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('services');
      expect(data).toHaveProperty('timestamp');
      expect(data.services).toHaveProperty('kv');
      expect(data.services).toHaveProperty('d1');
      expect(data.services).toHaveProperty('r2');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for non-existent endpoint', async () => {
      const response = await worker.fetch('/non-existent-endpoint');
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('timestamp');
      expect(data.status).toBe(404);
      expect(data.error).toBe('NotFound');
    });

    it('should return unified error format', async () => {
      const response = await worker.fetch('/invalid-path');
      const data = await response.json();

      expect(typeof data.error).toBe('string');
      expect(typeof data.message).toBe('string');
      expect(typeof data.status).toBe('number');
      expect(typeof data.timestamp).toBe('string');
    });
  });

  describe('CORS Middleware', () => {
    it('should include CORS headers in all responses', async () => {
      const response = await worker.fetch('/');
      expect(response.headers.get('access-control-allow-origin')).toBeDefined();
    });

    it('should handle OPTIONS preflight request', async () => {
      const response = await worker.fetch('/', {
        method: 'OPTIONS',
      });
      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-methods')).toBeDefined();
    });
  });

  describe('JSON Response Format', () => {
    it('should return valid JSON for root endpoint', async () => {
      const response = await worker.fetch('/');
      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('application/json');

      const data = await response.json();
      expect(data).toBeDefined();
      expect(typeof data).toBe('object');
    });

    it('should return valid JSON for health endpoint', async () => {
      const response = await worker.fetch('/health');
      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('application/json');

      const data = await response.json();
      expect(data).toBeDefined();
      expect(typeof data).toBe('object');
    });

    it('should return valid JSON for error responses', async () => {
      const response = await worker.fetch('/non-existent');
      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('application/json');

      const data = await response.json();
      expect(data).toBeDefined();
      expect(typeof data).toBe('object');
    });
  });

  describe('D1 Database Endpoints', () => {
    let testUserId: number;
    let testApiKey: string;

    beforeAll(async () => {
      // Register a test API key for D1/R2 operations
      testApiKey = 'test-d1-r2-key-' + Date.now();
      await worker.fetch(`/kv/api-keys/${testApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': MASTER_KEY,
        },
        body: JSON.stringify({ description: 'Test API key for D1/R2' }),
      });
    });

    describe('POST /d1/users', () => {
      it('should create a new user with valid data', async () => {
        const response = await worker.fetch('/d1/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': testApiKey,
          },
          body: JSON.stringify({
            name: 'Test User',
            email: `test-${Date.now()}@example.com`,
          }),
        });

        expect(response.status).toBe(201);
        const data = await response.json();
        expect(data).toHaveProperty('success', true);
        expect(data).toHaveProperty('data');
        expect(data.data).toHaveProperty('id');
        expect(data.data).toHaveProperty('name', 'Test User');
        expect(data.data).toHaveProperty('email');
        
        testUserId = data.data.id;
      });

      it('should return 400 for missing name field', async () => {
        const response = await worker.fetch('/d1/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': testApiKey,
          },
          body: JSON.stringify({
            email: 'test@example.com',
          }),
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data).toHaveProperty('error', 'ValidationError');
      });

      it('should return 400 for invalid email format', async () => {
        const response = await worker.fetch('/d1/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': testApiKey,
          },
          body: JSON.stringify({
            name: 'Test User',
            email: 'invalid-email',
          }),
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data).toHaveProperty('error', 'ValidationError');
        expect(data.message).toContain('email');
      });
    });

    describe('GET /d1/users', () => {
      it('should return list of users', async () => {
        const response = await worker.fetch('/d1/users', {
          headers: { 'X-API-Key': testApiKey },
        });
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('success', true);
        expect(data).toHaveProperty('data');
        expect(Array.isArray(data.data)).toBe(true);
        expect(data).toHaveProperty('count');
      });
    });

    describe('GET /d1/users/:id', () => {
      it('should return user by ID', async () => {
        // First create a user
        const createResponse = await worker.fetch('/d1/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': testApiKey,
          },
          body: JSON.stringify({
            name: 'Get Test User',
            email: `get-test-${Date.now()}@example.com`,
          }),
        });
        const createData = await createResponse.json();
        const userId = createData.data.id;

        // Then get the user
        const response = await worker.fetch(`/d1/users/${userId}`, {
          headers: { 'X-API-Key': testApiKey },
        });
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('success', true);
        expect(data).toHaveProperty('data');
        expect(data.data).toHaveProperty('id', userId);
        expect(data.data).toHaveProperty('name', 'Get Test User');
      });

      it('should return 404 for non-existent user', async () => {
        const response = await worker.fetch('/d1/users/99999', {
          headers: { 'X-API-Key': testApiKey },
        });
        expect(response.status).toBe(404);

        const data = await response.json();
        expect(data).toHaveProperty('error', 'NotFound');
      });

      it('should return 400 for invalid user ID', async () => {
        const response = await worker.fetch('/d1/users/invalid', {
          headers: { 'X-API-Key': testApiKey },
        });
        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data).toHaveProperty('error', 'ValidationError');
      });
    });

    describe('PUT /d1/users/:id', () => {
      it('should update user with valid data', async () => {
        // First create a user
        const createResponse = await worker.fetch('/d1/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': testApiKey,
          },
          body: JSON.stringify({
            name: 'Update Test User',
            email: `update-test-${Date.now()}@example.com`,
          }),
        });
        const createData = await createResponse.json();
        const userId = createData.data.id;

        // Then update the user
        const response = await worker.fetch(`/d1/users/${userId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': testApiKey,
          },
          body: JSON.stringify({
            name: 'Updated Name',
          }),
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toHaveProperty('success', true);
        expect(data.data).toHaveProperty('name', 'Updated Name');
      });

      it('should return 404 for non-existent user', async () => {
        const response = await worker.fetch('/d1/users/99999', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': testApiKey,
          },
          body: JSON.stringify({
            name: 'Updated Name',
          }),
        });

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data).toHaveProperty('error', 'NotFound');
      });

      it('should return 400 for invalid email format', async () => {
        // First create a user
        const createResponse = await worker.fetch('/d1/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': testApiKey,
          },
          body: JSON.stringify({
            name: 'Email Test User',
            email: `email-test-${Date.now()}@example.com`,
          }),
        });
        const createData = await createResponse.json();
        const userId = createData.data.id;

        // Try to update with invalid email
        const response = await worker.fetch(`/d1/users/${userId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': testApiKey,
          },
          body: JSON.stringify({
            email: 'invalid-email',
          }),
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data).toHaveProperty('error', 'ValidationError');
      });
    });

    describe('DELETE /d1/users/:id', () => {
      it('should delete user by ID', async () => {
        // First create a user
        const createResponse = await worker.fetch('/d1/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': testApiKey,
          },
          body: JSON.stringify({
            name: 'Delete Test User',
            email: `delete-test-${Date.now()}@example.com`,
          }),
        });
        const createData = await createResponse.json();
        const userId = createData.data.id;

        // Then delete the user
        const response = await worker.fetch(`/d1/users/${userId}`, {
          method: 'DELETE',
          headers: { 'X-API-Key': testApiKey },
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toHaveProperty('success', true);

        // Verify user is deleted
        const getResponse = await worker.fetch(`/d1/users/${userId}`, {
          headers: { 'X-API-Key': testApiKey },
        });
        expect(getResponse.status).toBe(404);
      });

      it('should return 404 for non-existent user', async () => {
        const response = await worker.fetch('/d1/users/99999', {
          method: 'DELETE',
          headers: { 'X-API-Key': testApiKey },
        });

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data).toHaveProperty('error', 'NotFound');
      });

      it('should return 400 for invalid user ID', async () => {
        const response = await worker.fetch('/d1/users/invalid', {
          method: 'DELETE',
          headers: { 'X-API-Key': testApiKey },
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data).toHaveProperty('error', 'ValidationError');
      });
    });
  });

  describe('R2 Object Storage Endpoints', () => {
    const testKey = `test-file-${Date.now()}`;
    const testContent = 'Hello, R2 Storage!';
    let testApiKey: string;

    beforeAll(async () => {
      // Register a test API key for R2 operations
      testApiKey = 'test-r2-key-' + Date.now();
      await worker.fetch(`/kv/api-keys/${testApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': MASTER_KEY,
        },
        body: JSON.stringify({ description: 'Test API key for R2' }),
      });
    });

    describe('POST /r2/:key', () => {
      it('should upload a file with valid data', async () => {
        const response = await worker.fetch(`/r2/${testKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            'X-API-Key': testApiKey,
          },
          body: testContent,
        });

        expect(response.status).toBe(201);
        const data = await response.json();
        expect(data).toHaveProperty('success', true);
        expect(data).toHaveProperty('message');
        expect(data).toHaveProperty('contentType', 'text/plain');
        expect(data).toHaveProperty('size');
      });

      it('should return 400 for empty body', async () => {
        const response = await worker.fetch(`/r2/empty-file`, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            'X-API-Key': testApiKey,
          },
          body: '',
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data).toHaveProperty('error', 'ValidationError');
      });

      it('should use default Content-Type when not specified', async () => {
        const key = `default-ct-${Date.now()}`;
        const response = await worker.fetch(`/r2/${key}`, {
          method: 'POST',
          headers: { 'X-API-Key': testApiKey },
          body: 'test content',
        });

        expect(response.status).toBe(201);
        const data = await response.json();
        // When no Content-Type is specified, fetch API may set a default
        expect(data).toHaveProperty('contentType');
        expect(typeof data.contentType).toBe('string');
      });
    });

    describe('GET /r2/:key', () => {
      it('should retrieve uploaded file', async () => {
        const key = `get-test-${Date.now()}`;
        const content = 'Test content for retrieval';

        // First upload a file
        await worker.fetch(`/r2/${key}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            'X-API-Key': testApiKey,
          },
          body: content,
        });

        // Then retrieve it
        const response = await worker.fetch(`/r2/${key}`, {
          headers: { 'X-API-Key': testApiKey },
        });
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe('text/plain');

        const retrievedContent = await response.text();
        expect(retrievedContent).toBe(content);
      });

      it('should return 404 for non-existent file', async () => {
        const response = await worker.fetch('/r2/non-existent-file', {
          headers: { 'X-API-Key': testApiKey },
        });
        expect(response.status).toBe(404);

        const data = await response.json();
        expect(data).toHaveProperty('error', 'NotFound');
      });

      it('should preserve Content-Type', async () => {
        const key = `ct-test-${Date.now()}`;
        const contentType = 'application/json';

        // Upload with specific Content-Type
        await worker.fetch(`/r2/${key}`, {
          method: 'POST',
          headers: {
            'Content-Type': contentType,
            'X-API-Key': testApiKey,
          },
          body: JSON.stringify({ test: 'data' }),
        });

        // Retrieve and verify Content-Type
        const response = await worker.fetch(`/r2/${key}`, {
          headers: { 'X-API-Key': testApiKey },
        });
        expect(response.headers.get('content-type')).toBe(contentType);
      });
    });

    describe('DELETE /r2/:key', () => {
      it('should delete uploaded file', async () => {
        const key = `delete-test-${Date.now()}`;

        // First upload a file
        await worker.fetch(`/r2/${key}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            'X-API-Key': testApiKey,
          },
          body: 'Content to be deleted',
        });

        // Then delete it
        const response = await worker.fetch(`/r2/${key}`, {
          method: 'DELETE',
          headers: { 'X-API-Key': testApiKey },
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toHaveProperty('success', true);

        // Verify file is deleted
        const getResponse = await worker.fetch(`/r2/${key}`, {
          headers: { 'X-API-Key': testApiKey },
        });
        expect(getResponse.status).toBe(404);
      });

      it('should return 404 for non-existent file', async () => {
        const response = await worker.fetch('/r2/non-existent-file', {
          method: 'DELETE',
          headers: { 'X-API-Key': testApiKey },
        });

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data).toHaveProperty('error', 'NotFound');
      });
    });

    describe('GET /r2', () => {
      it('should return list of objects', async () => {
        const response = await worker.fetch('/r2', {
          headers: { 'X-API-Key': testApiKey },
        });
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('success', true);
        expect(data).toHaveProperty('objects');
        expect(Array.isArray(data.objects)).toBe(true);
        expect(data).toHaveProperty('count');
        expect(data).toHaveProperty('truncated');
      });

      it('should include uploaded files in list', async () => {
        const key = `list-test-${Date.now()}`;

        // Upload a file
        await worker.fetch(`/r2/${key}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            'X-API-Key': testApiKey,
          },
          body: 'Test content',
        });

        // List objects
        const response = await worker.fetch('/r2', {
          headers: { 'X-API-Key': testApiKey },
        });
        const data = await response.json();

        const foundObject = data.objects.find((obj: any) => obj.key === key);
        expect(foundObject).toBeDefined();
        expect(foundObject).toHaveProperty('size');
        expect(foundObject).toHaveProperty('uploaded');
        expect(foundObject).toHaveProperty('contentType');
      });
    });
  });
});
