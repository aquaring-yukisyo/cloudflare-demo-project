/**
 * Test Helper Utilities
 * Provides common utilities for testing Cloudflare Worker applications
 */

/**
 * Generate a unique test key to avoid collisions between tests
 */
export function generateTestKey(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Generate a unique test email
 */
export function generateTestEmail(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
}

/**
 * Create test user data
 */
export function createTestUser(overrides?: { name?: string; email?: string }) {
  return {
    name: overrides?.name || `Test User ${Date.now()}`,
    email: overrides?.email || generateTestEmail('user'),
  };
}

/**
 * Wait for a specified amount of time (useful for async operations)
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate random text content for testing
 */
export function generateRandomText(length: number = 100): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate random binary data for testing
 */
export function generateRandomBinary(size: number = 1024): Uint8Array {
  const buffer = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    buffer[i] = Math.floor(Math.random() * 256);
  }
  return buffer;
}

/**
 * Assert that a response has the unified error format
 */
export function assertErrorFormat(data: any, expectedStatus?: number) {
  if (!data || typeof data !== 'object') {
    throw new Error('Response data is not an object');
  }

  const requiredFields = ['error', 'message', 'status', 'timestamp'];
  for (const field of requiredFields) {
    if (!(field in data)) {
      throw new Error(`Missing required error field: ${field}`);
    }
  }

  if (typeof data.error !== 'string') {
    throw new Error('error field must be a string');
  }

  if (typeof data.message !== 'string') {
    throw new Error('message field must be a string');
  }

  if (typeof data.status !== 'number') {
    throw new Error('status field must be a number');
  }

  if (typeof data.timestamp !== 'string') {
    throw new Error('timestamp field must be a string');
  }

  if (expectedStatus !== undefined && data.status !== expectedStatus) {
    throw new Error(`Expected status ${expectedStatus}, got ${data.status}`);
  }
}

/**
 * Assert that a response has valid JSON format
 */
export function assertValidJSON(response: Response) {
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error(`Expected JSON content-type, got: ${contentType}`);
  }
}

/**
 * Assert that a response has CORS headers
 */
export function assertCORSHeaders(response: Response) {
  const corsHeader = response.headers.get('access-control-allow-origin');
  if (!corsHeader) {
    throw new Error('Missing CORS header: access-control-allow-origin');
  }
}

/**
 * Create a mock Env object for testing
 * Note: This is a basic mock. For real tests, use Wrangler's unstable_dev
 */
export function createMockEnv(): any {
  return {
    DEMO_KV: {
      get: async () => null,
      put: async () => {},
      delete: async () => {},
      list: async () => ({ keys: [] }),
    },
    DEMO_DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => null,
          all: async () => ({ results: [] }),
          run: async () => ({ success: true }),
        }),
      }),
    },
    DEMO_BUCKET: {
      get: async () => null,
      put: async () => {},
      delete: async () => {},
      list: async () => ({ objects: [] }),
    },
  };
}
