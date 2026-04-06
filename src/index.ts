/**
 * Cloudflare Worker Entry Point
 * Hono framework-based API integrating KV, D1, and R2 storage services
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, ErrorResponse } from './env';
import { sanitizeString, sanitizeKey, sanitizeEmail, isValidEmail, isNonEmptyString } from './utils/sanitize';

// Initialize Hono application with Env type
const app = new Hono<{ Bindings: Env }>();

/**
 * CORS Middleware
 * Requirement 1.4: Configure CORS headers appropriately
 */
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposeHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400,
  credentials: false,
}));

/**
 * Request Logging Middleware (Development)
 */
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${c.req.method} ${c.req.url} - ${c.res.status} (${ms}ms)`);
});

/**
 * Authentication Constants
 */
const KV_MASTER_KEY = 'Aquaring@74';
const API_KEY_PREFIX = 'api_key:';

/**
 * Authentication Middleware for KV Operations
 * Requires fixed master key: Aquaring@74
 */
const kvAuthMiddleware = async (c: any, next: any) => {
  const apiKey = c.req.header('X-API-Key');
  
  if (!apiKey || apiKey !== KV_MASTER_KEY) {
    const errorResponse: ErrorResponse = {
      error: 'Unauthorized',
      message: 'Invalid or missing API key for KV operations',
      status: 401,
      timestamp: new Date().toISOString(),
    };
    return c.json(errorResponse, 401);
  }
  
  await next();
};

/**
 * Authentication Middleware for D1 and R2 Operations
 * Validates API key against keys stored in KV with prefix 'api_key:'
 */
const d1R2AuthMiddleware = async (c: any, next: any) => {
  const apiKey = c.req.header('X-API-Key');
  
  if (!apiKey) {
    const errorResponse: ErrorResponse = {
      error: 'Unauthorized',
      message: 'Missing API key',
      status: 401,
      timestamp: new Date().toISOString(),
    };
    return c.json(errorResponse, 401);
  }
  
  try {
    // Check if API key exists in KV storage
    const storedKey = await c.env.DEMO_KV.get(`${API_KEY_PREFIX}${apiKey}`);
    
    if (!storedKey) {
      const errorResponse: ErrorResponse = {
        error: 'Unauthorized',
        message: 'Invalid API key',
        status: 401,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 401);
    }
    
    // API key is valid, proceed to next handler
    await next();
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: 'InternalServerError',
      message: 'Failed to validate API key',
      status: 500,
      timestamp: new Date().toISOString(),
    };
    return c.json(errorResponse, 500);
  }
};

/**
 * Root Endpoint - API Information
 * Requirement 5.1: Return list of available API endpoints
 */
app.get('/', (c) => {
  return c.json({
    name: 'Cloudflare Demo Project',
    version: '1.0.0',
    description: 'Demo API integrating KV, D1, and R2 storage services',
    authentication: {
      kv: 'Requires master key in X-API-Key header',
      d1_r2: 'Requires registered API key in X-API-Key header',
    },
    endpoints: [
      { method: 'GET', path: '/', description: 'API information' },
      { method: 'GET', path: '/health', description: 'Health check' },
      { method: 'POST', path: '/kv/api-keys/:key', description: 'Register API key for D1/R2 access (requires master key)', auth: 'master' },
      { method: 'GET', path: '/kv/api-keys', description: 'List all registered API keys (requires master key)', auth: 'master' },
      { method: 'DELETE', path: '/kv/api-keys/:key', description: 'Revoke API key (requires master key)', auth: 'master' },
      { method: 'POST', path: '/kv/:key', description: 'Store key-value pair (requires master key)', auth: 'master' },
      { method: 'GET', path: '/kv/:key', description: 'Get value by key (requires master key)', auth: 'master' },
      { method: 'DELETE', path: '/kv/:key', description: 'Delete key (requires master key)', auth: 'master' },
      { method: 'GET', path: '/kv', description: 'List all keys (requires master key)', auth: 'master' },
      { method: 'POST', path: '/d1/users', description: 'Create user (requires API key)', auth: 'api_key' },
      { method: 'GET', path: '/d1/users', description: 'Get all users (requires API key)', auth: 'api_key' },
      { method: 'GET', path: '/d1/users/:id', description: 'Get user by ID (requires API key)', auth: 'api_key' },
      { method: 'PUT', path: '/d1/users/:id', description: 'Update user (requires API key)', auth: 'api_key' },
      { method: 'DELETE', path: '/d1/users/:id', description: 'Delete user (requires API key)', auth: 'api_key' },
      { method: 'POST', path: '/r2/:key', description: 'Upload file (requires API key)', auth: 'api_key' },
      { method: 'GET', path: '/r2/:key', description: 'Download file (requires API key)', auth: 'api_key' },
      { method: 'DELETE', path: '/r2/:key', description: 'Delete file (requires API key)', auth: 'api_key' },
      { method: 'GET', path: '/r2', description: 'List all objects (requires API key)', auth: 'api_key' },
    ],
  });
});

/**
 * Health Check Endpoint
 * Requirement 5.2: Check connection status of KV, D1, and R2
 */
app.get('/health', async (c) => {
  const services = {
    kv: false,
    d1: false,
    r2: false,
  };

  try {
    // Check KV availability
    await c.env.DEMO_KV.get('health-check');
    services.kv = true;
  } catch (error) {
    console.error('KV health check failed:', error);
  }

  try {
    // Check D1 availability
    await c.env.DEMO_DB.prepare('SELECT 1').first();
    services.d1 = true;
  } catch (error) {
    console.error('D1 health check failed:', error);
  }

  try {
    // Check R2 availability
    await c.env.DEMO_BUCKET.head('health-check');
    services.r2 = true;
  } catch (error) {
    console.error('R2 health check failed:', error);
  }

  const allHealthy = services.kv && services.d1 && services.r2;

  return c.json({
    status: allHealthy ? 'healthy' : 'unhealthy',
    services,
    timestamp: new Date().toISOString(),
  }, allHealthy ? 200 : 503);
});

/**
 * KV Storage Endpoints
 * Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 * Authentication: Requires master key 'Aquaring@74' in X-API-Key header
 */

/**
 * POST /kv/api-keys/:key - Register API key for D1/R2 access
 * Special endpoint to register API keys that can be used for D1 and R2 operations
 */
app.post('/kv/api-keys/:key', kvAuthMiddleware, async (c) => {
  try {
    const rawKey = c.req.param('key');
    
    // Sanitize key
    const key = sanitizeKey(rawKey);
    if (!isNonEmptyString(key)) {
      const errorResponse: ErrorResponse = {
        error: 'ValidationError',
        message: 'API key cannot be empty after sanitization',
        status: 400,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 400);
    }

    const body = await c.req.json();
    
    // Validate request body
    if (!body || typeof body.description !== 'string') {
      const errorResponse: ErrorResponse = {
        error: 'ValidationError',
        message: 'Request body must contain a "description" field of type string',
        status: 400,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 400);
    }

    const description = sanitizeString(body.description);

    // Store API key with prefix
    await c.env.DEMO_KV.put(`${API_KEY_PREFIX}${key}`, description);

    return c.json({
      success: true,
      message: `API key "${key}" registered successfully`,
      description: description,
      timestamp: new Date().toISOString(),
    }, 201);
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: 'InternalServerError',
      message: error instanceof Error ? error.message : 'Failed to register API key',
      status: 500,
      timestamp: new Date().toISOString(),
    };
    return c.json(errorResponse, 500);
  }
});

/**
 * DELETE /kv/api-keys/:key - Revoke API key
 * Remove API key from KV storage
 */
app.delete('/kv/api-keys/:key', kvAuthMiddleware, async (c) => {
  try {
    const rawKey = c.req.param('key');
    
    // Sanitize key
    const key = sanitizeKey(rawKey);
    if (!isNonEmptyString(key)) {
      const errorResponse: ErrorResponse = {
        error: 'ValidationError',
        message: 'API key cannot be empty after sanitization',
        status: 400,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 400);
    }
    
    // Check if API key exists
    const value = await c.env.DEMO_KV.get(`${API_KEY_PREFIX}${key}`);
    if (value === null) {
      const errorResponse: ErrorResponse = {
        error: 'NotFound',
        message: `API key "${key}" not found`,
        status: 404,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 404);
    }

    // Delete API key
    await c.env.DEMO_KV.delete(`${API_KEY_PREFIX}${key}`);

    return c.json({
      success: true,
      message: `API key "${key}" revoked successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: 'InternalServerError',
      message: error instanceof Error ? error.message : 'Failed to revoke API key',
      status: 500,
      timestamp: new Date().toISOString(),
    };
    return c.json(errorResponse, 500);
  }
});

/**
 * GET /kv/api-keys - List all registered API keys
 * Returns list of API keys (without the prefix) and their descriptions
 */
app.get('/kv/api-keys', kvAuthMiddleware, async (c) => {
  try {
    const list = await c.env.DEMO_KV.list({ prefix: API_KEY_PREFIX });
    
    const apiKeys = await Promise.all(
      list.keys.map(async (k) => {
        const key = k.name.replace(API_KEY_PREFIX, '');
        const description = await c.env.DEMO_KV.get(k.name);
        return {
          key,
          description,
        };
      })
    );

    return c.json({
      success: true,
      apiKeys,
      count: apiKeys.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: 'InternalServerError',
      message: error instanceof Error ? error.message : 'Failed to list API keys',
      status: 500,
      timestamp: new Date().toISOString(),
    };
    return c.json(errorResponse, 500);
  }
});

/**
 * POST /kv/:key - Store key-value pair
 * Requirement 2.1: Store key and value in KV storage
 */
app.post('/kv/:key', kvAuthMiddleware, async (c) => {
  try {
    const rawKey = c.req.param('key');
    const body = await c.req.json();
    
    // Validate request body
    if (!body || typeof body.value !== 'string') {
      const errorResponse: ErrorResponse = {
        error: 'ValidationError',
        message: 'Request body must contain a "value" field of type string',
        status: 400,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 400);
    }

    // Sanitize key (Requirement 10.1)
    const key = sanitizeKey(rawKey);
    if (!isNonEmptyString(key)) {
      const errorResponse: ErrorResponse = {
        error: 'ValidationError',
        message: 'Key cannot be empty after sanitization',
        status: 400,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 400);
    }

    // Sanitize value (Requirement 10.1)
    const value = sanitizeString(body.value);

    // Store in KV
    await c.env.DEMO_KV.put(key, value);

    return c.json({
      success: true,
      message: `Key "${key}" stored successfully`,
      timestamp: new Date().toISOString(),
    }, 201);
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: 'InternalServerError',
      message: error instanceof Error ? error.message : 'Failed to store key-value pair',
      status: 500,
      timestamp: new Date().toISOString(),
    };
    return c.json(errorResponse, 500);
  }
});

/**
 * GET /kv/:key - Get value by key
 * Requirement 2.2: Retrieve value from KV storage
 * Requirement 2.5: Return 404 for non-existent keys
 */
app.get('/kv/:key', kvAuthMiddleware, async (c) => {
  try {
    const rawKey = c.req.param('key');
    
    // Sanitize key (Requirement 10.1)
    const key = sanitizeKey(rawKey);
    if (!isNonEmptyString(key)) {
      const errorResponse: ErrorResponse = {
        error: 'ValidationError',
        message: 'Key cannot be empty after sanitization',
        status: 400,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 400);
    }

    const value = await c.env.DEMO_KV.get(key);

    if (value === null) {
      const errorResponse: ErrorResponse = {
        error: 'NotFound',
        message: `Key "${key}" not found`,
        status: 404,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 404);
    }

    return c.json({
      key,
      value,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: 'InternalServerError',
      message: error instanceof Error ? error.message : 'Failed to retrieve value',
      status: 500,
      timestamp: new Date().toISOString(),
    };
    return c.json(errorResponse, 500);
  }
});

/**
 * DELETE /kv/:key - Delete key
 * Requirement 2.3: Delete key from KV storage
 */
app.delete('/kv/:key', kvAuthMiddleware, async (c) => {
  try {
    const rawKey = c.req.param('key');
    
    // Sanitize key (Requirement 10.1)
    const key = sanitizeKey(rawKey);
    if (!isNonEmptyString(key)) {
      const errorResponse: ErrorResponse = {
        error: 'ValidationError',
        message: 'Key cannot be empty after sanitization',
        status: 400,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 400);
    }
    
    // Check if key exists before deleting
    const value = await c.env.DEMO_KV.get(key);
    if (value === null) {
      const errorResponse: ErrorResponse = {
        error: 'NotFound',
        message: `Key "${key}" not found`,
        status: 404,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 404);
    }

    await c.env.DEMO_KV.delete(key);

    return c.json({
      success: true,
      message: `Key "${key}" deleted successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: 'InternalServerError',
      message: error instanceof Error ? error.message : 'Failed to delete key',
      status: 500,
      timestamp: new Date().toISOString(),
    };
    return c.json(errorResponse, 500);
  }
});

/**
 * GET /kv - List all keys
 * Requirement 2.4: Return list of all keys in KV storage
 */
app.get('/kv', kvAuthMiddleware, async (c) => {
  try {
    const list = await c.env.DEMO_KV.list();
    const keys = list.keys.map(k => k.name);

    return c.json({
      keys,
      count: keys.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: 'InternalServerError',
      message: error instanceof Error ? error.message : 'Failed to list keys',
      status: 500,
      timestamp: new Date().toISOString(),
    };
    return c.json(errorResponse, 500);
  }
});

/**
 * D1 Database Endpoints
 * Requirements 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 10.2
 * Authentication: Requires valid API key registered in KV storage
 */

/**
 * POST /d1/users - Create user
 * Requirement 3.2: Insert new user record in D1 database
 * Requirement 10.2: Use prepared statements for SQL injection prevention
 */
app.post('/d1/users', d1R2AuthMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    
    // Validate request body
    if (!body || typeof body.name !== 'string' || typeof body.email !== 'string') {
      const errorResponse: ErrorResponse = {
        error: 'ValidationError',
        message: 'Request body must contain "name" and "email" fields of type string',
        status: 400,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 400);
    }

    // Sanitize inputs (Requirement 10.1)
    const name = sanitizeString(body.name);
    const email = sanitizeEmail(body.email);

    // Validate sanitized inputs are not empty
    if (!isNonEmptyString(name)) {
      const errorResponse: ErrorResponse = {
        error: 'ValidationError',
        message: 'Name cannot be empty',
        status: 400,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 400);
    }

    if (!isNonEmptyString(email)) {
      const errorResponse: ErrorResponse = {
        error: 'ValidationError',
        message: 'Email cannot be empty',
        status: 400,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 400);
    }

    // Validate email format (basic validation)
    if (!isValidEmail(email)) {
      const errorResponse: ErrorResponse = {
        error: 'ValidationError',
        message: 'Invalid email format',
        status: 400,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 400);
    }

    // Insert user using prepared statement
    const result = await c.env.DEMO_DB.prepare(
      'INSERT INTO users (name, email) VALUES (?, ?)'
    ).bind(name, email).run();

    if (!result.success) {
      const errorResponse: ErrorResponse = {
        error: 'DatabaseError',
        message: 'Failed to create user',
        status: 500,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 500);
    }

    // Retrieve the created user
    const user = await c.env.DEMO_DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(result.meta.last_row_id).first();

    return c.json({
      success: true,
      data: user,
      timestamp: new Date().toISOString(),
    }, 201);
  } catch (error) {
    // Handle SQL errors (e.g., unique constraint violation)
    const errorMessage = error instanceof Error ? error.message : 'Failed to create user';
    const isConstraintError = errorMessage.includes('UNIQUE') || errorMessage.includes('constraint');
    
    const errorResponse: ErrorResponse = {
      error: isConstraintError ? 'ConflictError' : 'InternalServerError',
      message: isConstraintError ? 'User with this email already exists' : errorMessage,
      status: isConstraintError ? 409 : 500,
      timestamp: new Date().toISOString(),
    };
    return c.json(errorResponse, isConstraintError ? 409 : 500);
  }
});

/**
 * GET /d1/users - Get all users
 * Requirement 3.3: Retrieve all users from D1 database
 */
app.get('/d1/users', d1R2AuthMiddleware, async (c) => {
  try {
    const result = await c.env.DEMO_DB.prepare(
      'SELECT * FROM users ORDER BY created_at DESC'
    ).all();

    return c.json({
      success: true,
      data: result.results,
      count: result.results.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: 'InternalServerError',
      message: error instanceof Error ? error.message : 'Failed to retrieve users',
      status: 500,
      timestamp: new Date().toISOString(),
    };
    return c.json(errorResponse, 500);
  }
});

/**
 * GET /d1/users/:id - Get user by ID
 * Requirement 3.4: Retrieve specific user from D1 database
 */
app.get('/d1/users/:id', d1R2AuthMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    
    // Validate ID is a number
    const userId = parseInt(id, 10);
    if (isNaN(userId) || userId <= 0) {
      const errorResponse: ErrorResponse = {
        error: 'ValidationError',
        message: 'User ID must be a positive integer',
        status: 400,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 400);
    }

    const user = await c.env.DEMO_DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(userId).first();

    if (!user) {
      const errorResponse: ErrorResponse = {
        error: 'NotFound',
        message: `User with id ${userId} not found`,
        status: 404,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 404);
    }

    return c.json({
      success: true,
      data: user,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: 'InternalServerError',
      message: error instanceof Error ? error.message : 'Failed to retrieve user',
      status: 500,
      timestamp: new Date().toISOString(),
    };
    return c.json(errorResponse, 500);
  }
});

/**
 * PUT /d1/users/:id - Update user
 * Requirement 3.5: Update user in D1 database
 * Requirement 10.2: Use prepared statements for SQL injection prevention
 */
app.put('/d1/users/:id', d1R2AuthMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    
    // Validate ID is a number
    const userId = parseInt(id, 10);
    if (isNaN(userId) || userId <= 0) {
      const errorResponse: ErrorResponse = {
        error: 'ValidationError',
        message: 'User ID must be a positive integer',
        status: 400,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 400);
    }

    // Validate request body
    if (!body || (typeof body.name !== 'string' && typeof body.email !== 'string')) {
      const errorResponse: ErrorResponse = {
        error: 'ValidationError',
        message: 'Request body must contain at least one of "name" or "email" fields',
        status: 400,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 400);
    }

    // Sanitize inputs (Requirement 10.1)
    let name: string | undefined;
    let email: string | undefined;

    if (body.name !== undefined) {
      name = sanitizeString(body.name);
      if (!isNonEmptyString(name)) {
        const errorResponse: ErrorResponse = {
          error: 'ValidationError',
          message: 'Name cannot be empty',
          status: 400,
          timestamp: new Date().toISOString(),
        };
        return c.json(errorResponse, 400);
      }
    }

    if (body.email !== undefined) {
      email = sanitizeEmail(body.email);
      if (!isNonEmptyString(email)) {
        const errorResponse: ErrorResponse = {
          error: 'ValidationError',
          message: 'Email cannot be empty',
          status: 400,
          timestamp: new Date().toISOString(),
        };
        return c.json(errorResponse, 400);
      }
      // Validate email format
      if (!isValidEmail(email)) {
        const errorResponse: ErrorResponse = {
          error: 'ValidationError',
          message: 'Invalid email format',
          status: 400,
          timestamp: new Date().toISOString(),
        };
        return c.json(errorResponse, 400);
      }
    }

    // Check if user exists
    const existingUser = await c.env.DEMO_DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(userId).first();

    if (!existingUser) {
      const errorResponse: ErrorResponse = {
        error: 'NotFound',
        message: `User with id ${userId} not found`,
        status: 404,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 404);
    }

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: any[] = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }
    
    values.push(userId);

    const result = await c.env.DEMO_DB.prepare(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    if (!result.success) {
      const errorResponse: ErrorResponse = {
        error: 'DatabaseError',
        message: 'Failed to update user',
        status: 500,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 500);
    }

    // Retrieve the updated user
    const updatedUser = await c.env.DEMO_DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(userId).first();

    return c.json({
      success: true,
      data: updatedUser,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Handle SQL errors (e.g., unique constraint violation)
    const errorMessage = error instanceof Error ? error.message : 'Failed to update user';
    const isConstraintError = errorMessage.includes('UNIQUE') || errorMessage.includes('constraint');
    
    const errorResponse: ErrorResponse = {
      error: isConstraintError ? 'ConflictError' : 'InternalServerError',
      message: isConstraintError ? 'User with this email already exists' : errorMessage,
      status: isConstraintError ? 409 : 500,
      timestamp: new Date().toISOString(),
    };
    return c.json(errorResponse, isConstraintError ? 409 : 500);
  }
});

/**
 * DELETE /d1/users/:id - Delete user
 * Requirement 3.6: Delete user from D1 database
 */
app.delete('/d1/users/:id', d1R2AuthMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    
    // Validate ID is a number
    const userId = parseInt(id, 10);
    if (isNaN(userId) || userId <= 0) {
      const errorResponse: ErrorResponse = {
        error: 'ValidationError',
        message: 'User ID must be a positive integer',
        status: 400,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 400);
    }

    // Check if user exists
    const existingUser = await c.env.DEMO_DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(userId).first();

    if (!existingUser) {
      const errorResponse: ErrorResponse = {
        error: 'NotFound',
        message: `User with id ${userId} not found`,
        status: 404,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 404);
    }

    const result = await c.env.DEMO_DB.prepare(
      'DELETE FROM users WHERE id = ?'
    ).bind(userId).run();

    if (!result.success) {
      const errorResponse: ErrorResponse = {
        error: 'DatabaseError',
        message: 'Failed to delete user',
        status: 500,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 500);
    }

    return c.json({
      success: true,
      message: `User with id ${userId} deleted successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: 'InternalServerError',
      message: error instanceof Error ? error.message : 'Failed to delete user',
      status: 500,
      timestamp: new Date().toISOString(),
    };
    return c.json(errorResponse, 500);
  }
});

/**
 * R2 Object Storage Endpoints
 * Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 * Authentication: Requires valid API key registered in KV storage
 */

/**
 * POST /r2/:key - Upload file
 * Requirement 4.1: Upload file to R2 bucket
 * Requirement 4.5: Set Content-Type appropriately
 */
app.post('/r2/:key', d1R2AuthMiddleware, async (c) => {
  try {
    const rawKey = c.req.param('key');
    
    // Sanitize key (Requirement 10.1)
    const key = sanitizeKey(rawKey);
    if (!isNonEmptyString(key)) {
      const errorResponse: ErrorResponse = {
        error: 'ValidationError',
        message: 'Key cannot be empty after sanitization',
        status: 400,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 400);
    }
    
    // Get request body as ArrayBuffer
    const body = await c.req.arrayBuffer();
    
    if (!body || body.byteLength === 0) {
      const errorResponse: ErrorResponse = {
        error: 'ValidationError',
        message: 'Request body cannot be empty',
        status: 400,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 400);
    }

    // Get Content-Type from request header, default to application/octet-stream
    const contentType = c.req.header('Content-Type') || 'application/octet-stream';

    // Upload to R2 with Content-Type metadata
    await c.env.DEMO_BUCKET.put(key, body, {
      httpMetadata: {
        contentType: contentType,
      },
    });

    return c.json({
      success: true,
      message: `File "${key}" uploaded successfully`,
      contentType: contentType,
      size: body.byteLength,
      timestamp: new Date().toISOString(),
    }, 201);
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: 'InternalServerError',
      message: error instanceof Error ? error.message : 'Failed to upload file',
      status: 500,
      timestamp: new Date().toISOString(),
    };
    return c.json(errorResponse, 500);
  }
});

/**
 * GET /r2/:key - Download file
 * Requirement 4.2: Retrieve file from R2 bucket
 * Requirement 4.5: Return file with appropriate Content-Type
 * Requirement 4.6: Return 404 for non-existent files
 */
app.get('/r2/:key', d1R2AuthMiddleware, async (c) => {
  try {
    const rawKey = c.req.param('key');
    
    // Sanitize key (Requirement 10.1)
    const key = sanitizeKey(rawKey);
    if (!isNonEmptyString(key)) {
      const errorResponse: ErrorResponse = {
        error: 'ValidationError',
        message: 'Key cannot be empty after sanitization',
        status: 400,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 400);
    }
    
    // Get object from R2
    const object = await c.env.DEMO_BUCKET.get(key);

    if (object === null) {
      const errorResponse: ErrorResponse = {
        error: 'NotFound',
        message: `File "${key}" not found`,
        status: 404,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 404);
    }

    // Get Content-Type from object metadata
    const contentType = object.httpMetadata?.contentType || 'application/octet-stream';

    // Return file with appropriate headers
    return new Response(object.body, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': object.size.toString(),
        'ETag': object.httpEtag,
        'Last-Modified': object.uploaded.toUTCString(),
      },
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: 'InternalServerError',
      message: error instanceof Error ? error.message : 'Failed to retrieve file',
      status: 500,
      timestamp: new Date().toISOString(),
    };
    return c.json(errorResponse, 500);
  }
});

/**
 * DELETE /r2/:key - Delete file
 * Requirement 4.3: Delete file from R2 bucket
 * Requirement 4.6: Return 404 for non-existent files
 */
app.delete('/r2/:key', d1R2AuthMiddleware, async (c) => {
  try {
    const rawKey = c.req.param('key');
    
    // Sanitize key (Requirement 10.1)
    const key = sanitizeKey(rawKey);
    if (!isNonEmptyString(key)) {
      const errorResponse: ErrorResponse = {
        error: 'ValidationError',
        message: 'Key cannot be empty after sanitization',
        status: 400,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 400);
    }
    
    // Check if object exists before deleting
    const object = await c.env.DEMO_BUCKET.head(key);
    
    if (object === null) {
      const errorResponse: ErrorResponse = {
        error: 'NotFound',
        message: `File "${key}" not found`,
        status: 404,
        timestamp: new Date().toISOString(),
      };
      return c.json(errorResponse, 404);
    }

    // Delete object from R2
    await c.env.DEMO_BUCKET.delete(key);

    return c.json({
      success: true,
      message: `File "${key}" deleted successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: 'InternalServerError',
      message: error instanceof Error ? error.message : 'Failed to delete file',
      status: 500,
      timestamp: new Date().toISOString(),
    };
    return c.json(errorResponse, 500);
  }
});

/**
 * GET /r2 - List all objects
 * Requirement 4.4: Return list of all objects in R2 bucket
 */
app.get('/r2', d1R2AuthMiddleware, async (c) => {
  try {
    // List objects in R2 bucket
    const listed = await c.env.DEMO_BUCKET.list();
    
    // Map objects to a simplified format
    const objects = listed.objects.map(obj => ({
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded.toISOString(),
      etag: obj.etag,
      httpEtag: obj.httpEtag,
      contentType: obj.httpMetadata?.contentType || 'application/octet-stream',
    }));

    return c.json({
      success: true,
      objects: objects,
      count: objects.length,
      truncated: listed.truncated,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: 'InternalServerError',
      message: error instanceof Error ? error.message : 'Failed to list objects',
      status: 500,
      timestamp: new Date().toISOString(),
    };
    return c.json(errorResponse, 500);
  }
});

/**
 * 404 Handler - Not Found
 * Requirement 6.2: Return 404 for non-existent endpoints
 */
app.notFound((c) => {
  const errorResponse: ErrorResponse = {
    error: 'NotFound',
    message: `Endpoint ${c.req.method} ${c.req.path} not found`,
    status: 404,
    timestamp: new Date().toISOString(),
  };
  return c.json(errorResponse, 404);
});

/**
 * Global Error Handler
 * Requirement 6.3, 6.4: Handle unexpected errors with unified JSON format
 */
app.onError((err, c) => {
  console.error('Error:', err);

  // Extract status code from error if available
  const statusCode = 'status' in err && typeof err.status === 'number' ? err.status : 500;

  const errorResponse: ErrorResponse = {
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred',
    status: statusCode,
    timestamp: new Date().toISOString(),
  };

  return c.json(errorResponse, statusCode as 500);
});

/**
 * Export Worker
 * Requirement 1.1: Process HTTP requests using Hono framework
 */
export default app;
