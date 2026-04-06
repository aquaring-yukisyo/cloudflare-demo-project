/**
 * Environment bindings for Cloudflare Worker
 * This file defines the types for KV, D1, and R2 bindings
 */

export interface Env {
  // KV Namespace binding
  DEMO_KV: KVNamespace;
  
  // D1 Database binding
  DEMO_DB: D1Database;
  
  // R2 Bucket binding
  DEMO_BUCKET: R2Bucket;
}

/**
 * User data model for D1 database
 */
export interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

/**
 * Input type for creating a new user
 */
export interface CreateUserInput {
  name: string;
  email: string;
}

/**
 * Input type for updating an existing user
 */
export interface UpdateUserInput {
  name?: string;
  email?: string;
}

/**
 * Unified error response format
 */
export interface ErrorResponse {
  error: string;
  message: string;
  status: number;
  timestamp: string;
}

/**
 * Success response wrapper
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

/**
 * Health check response
 */
export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  services: {
    kv: boolean;
    d1: boolean;
    r2: boolean;
  };
  timestamp: string;
}

/**
 * API endpoint information
 */
export interface EndpointInfo {
  method: string;
  path: string;
  description: string;
}

/**
 * API information response
 */
export interface APIInfo {
  name: string;
  version: string;
  endpoints: EndpointInfo[];
}
