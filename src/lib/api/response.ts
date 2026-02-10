import { NextRequest, NextResponse } from 'next/server';

/**
 * Standardized API Response Utilities
 *
 * Provides consistent response formats across all API routes:
 * - Success responses: { data, meta? }
 * - Error responses: { error: { code, message, details? } }
 */

// ============================================================================
// Types
// ============================================================================

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'BAD_REQUEST'
  | 'INTERNAL_ERROR'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'DATABASE_ERROR';

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, string | string[]>;
}

export interface ApiErrorResponse {
  error: ApiError;
  requestId?: string;
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

// ============================================================================
// Error Response Helpers
// ============================================================================

const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  BAD_REQUEST: 400,
  INTERNAL_ERROR: 500,
  EXTERNAL_SERVICE_ERROR: 502,
  DATABASE_ERROR: 500,
};

/**
 * Generate a unique request ID for tracing
 */
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a standardized error response
 */
export function apiError(
  code: ErrorCode,
  message: string,
  details?: Record<string, string | string[]>
): NextResponse<ApiErrorResponse> {
  const requestId = generateRequestId();
  const status = ERROR_STATUS_MAP[code];

  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details && { details }),
      },
      requestId,
    },
    {
      status,
      headers: {
        'X-Request-Id': requestId,
      },
    }
  );
}

// ============================================================================
// Common Error Responses
// ============================================================================

/**
 * 401 Unauthorized - User not authenticated
 */
export function unauthorized(message = 'Authentication required'): NextResponse<ApiErrorResponse> {
  return apiError('UNAUTHORIZED', message);
}

/**
 * 403 Forbidden - User lacks permission
 */
export function forbidden(message = 'You do not have permission to access this resource'): NextResponse<ApiErrorResponse> {
  return apiError('FORBIDDEN', message);
}

/**
 * 404 Not Found - Resource doesn't exist
 */
export function notFound(resource = 'Resource'): NextResponse<ApiErrorResponse> {
  return apiError('NOT_FOUND', `${resource} not found`);
}

/**
 * 400 Validation Error - Invalid input data
 */
export function validationError(
  message: string,
  details?: Record<string, string | string[]>
): NextResponse<ApiErrorResponse> {
  return apiError('VALIDATION_ERROR', message, details);
}

/**
 * 400 Bad Request - General client error
 */
export function badRequest(message: string): NextResponse<ApiErrorResponse> {
  return apiError('BAD_REQUEST', message);
}

/**
 * 409 Conflict - Resource already exists or state conflict
 */
export function conflict(message: string): NextResponse<ApiErrorResponse> {
  return apiError('CONFLICT', message);
}

/**
 * 429 Rate Limited - Too many requests
 */
export function rateLimited(
  message = 'Too many requests',
  retryAfter?: number
): NextResponse<ApiErrorResponse> {
  const response = apiError('RATE_LIMITED', message);

  if (retryAfter) {
    response.headers.set('Retry-After', retryAfter.toString());
  }

  return response;
}

/**
 * 500 Internal Error - Server-side error
 * Note: Never expose internal error details to clients in production
 */
export function internalError(
  message = 'An unexpected error occurred'
): NextResponse<ApiErrorResponse> {
  return apiError('INTERNAL_ERROR', message);
}

/**
 * 502 External Service Error - Third-party API failure
 */
export function externalServiceError(
  service: string,
  message?: string
): NextResponse<ApiErrorResponse> {
  return apiError(
    'EXTERNAL_SERVICE_ERROR',
    message || `Failed to communicate with ${service}`
  );
}

/**
 * 500 Database Error - Supabase/database errors
 * Sanitizes error messages for security
 */
export function databaseError(error: { code?: string; message?: string }): NextResponse<ApiErrorResponse> {
  // Check for specific database error codes
  if (error.code === '23505') {
    return conflict('A record with this identifier already exists');
  }

  if (error.code === '23503') {
    return badRequest('Referenced record does not exist');
  }

  if (error.code === '42501') {
    return forbidden('Database permission denied');
  }

  // Log the actual error for debugging (server-side only)
  console.error('Database error:', error);

  // Return generic message to client
  return apiError('DATABASE_ERROR', 'A database error occurred');
}

// ============================================================================
// Success Response Helpers
// ============================================================================

/**
 * Create a standardized success response
 */
export function apiSuccess<T>(
  data: T,
  status = 200
): NextResponse<ApiSuccessResponse<T>> {
  const requestId = generateRequestId();

  return NextResponse.json(
    { data },
    {
      status,
      headers: {
        'X-Request-Id': requestId,
      },
    }
  );
}

/**
 * Create a paginated success response
 */
export function apiSuccessPaginated<T>(
  data: T[],
  pagination: PaginationMeta
): NextResponse<ApiSuccessResponse<T[]>> {
  const requestId = generateRequestId();

  return NextResponse.json(
    {
      data,
      meta: pagination,
    },
    {
      status: 200,
      headers: {
        'X-Request-Id': requestId,
      },
    }
  );
}

/**
 * 201 Created - Resource successfully created
 */
export function created<T>(data: T): NextResponse<ApiSuccessResponse<T>> {
  return apiSuccess(data, 201);
}

/**
 * 204 No Content - Successful operation with no response body
 */
export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

// ============================================================================
// Validation Helpers
// ============================================================================

interface ValidationRule {
  field: string;
  value: unknown;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'email' | 'uuid';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: unknown) => string | null;
}

/**
 * Validate request body fields
 * Returns null if valid, or an error response if invalid
 */
export function validateRequest(
  rules: ValidationRule[]
): NextResponse<ApiErrorResponse> | null {
  const errors: Record<string, string[]> = {};

  for (const rule of rules) {
    const fieldErrors: string[] = [];
    const { field, value, required, type, minLength, maxLength, min, max, pattern, custom } = rule;

    // Required check
    if (required && (value === undefined || value === null || value === '')) {
      fieldErrors.push(`${field} is required`);
      errors[field] = fieldErrors;
      continue;
    }

    // Skip other validations if value is empty and not required
    if (value === undefined || value === null || value === '') {
      continue;
    }

    // Type check
    if (type) {
      switch (type) {
        case 'string':
          if (typeof value !== 'string') {
            fieldErrors.push(`${field} must be a string`);
          }
          break;
        case 'number':
          if (typeof value !== 'number' || isNaN(value)) {
            fieldErrors.push(`${field} must be a number`);
          }
          break;
        case 'boolean':
          if (typeof value !== 'boolean') {
            fieldErrors.push(`${field} must be a boolean`);
          }
          break;
        case 'array':
          if (!Array.isArray(value)) {
            fieldErrors.push(`${field} must be an array`);
          }
          break;
        case 'object':
          if (typeof value !== 'object' || Array.isArray(value)) {
            fieldErrors.push(`${field} must be an object`);
          }
          break;
        case 'email':
          // Stricter email validation - requires proper TLD (min 2 chars)
          if (typeof value !== 'string' || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) {
            fieldErrors.push(`${field} must be a valid email address`);
          }
          break;
        case 'uuid':
          if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
            fieldErrors.push(`${field} must be a valid UUID`);
          }
          break;
      }
    }

    // String length validation
    if (typeof value === 'string') {
      if (minLength !== undefined && value.length < minLength) {
        fieldErrors.push(`${field} must be at least ${minLength} characters`);
      }
      if (maxLength !== undefined && value.length > maxLength) {
        fieldErrors.push(`${field} must be at most ${maxLength} characters`);
      }
      if (pattern && !pattern.test(value)) {
        fieldErrors.push(`${field} format is invalid`);
      }
    }

    // Number range validation
    if (typeof value === 'number') {
      if (min !== undefined && value < min) {
        fieldErrors.push(`${field} must be at least ${min}`);
      }
      if (max !== undefined && value > max) {
        fieldErrors.push(`${field} must be at most ${max}`);
      }
    }

    // Custom validation
    if (custom) {
      const customError = custom(value);
      if (customError) {
        fieldErrors.push(customError);
      }
    }

    if (fieldErrors.length > 0) {
      errors[field] = fieldErrors;
    }
  }

  if (Object.keys(errors).length > 0) {
    const firstError = Object.values(errors)[0][0];
    return validationError(firstError, errors);
  }

  return null;
}

// ============================================================================
// Error Handling Wrapper
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Wrap a route handler with standardized error handling
 * Supports both simple handlers and handlers with route params
 */
export function withErrorHandling<
  TRequest extends NextRequest | Request,
  TContext = any
>(
  handler: (request: TRequest, context?: TContext) => Promise<NextResponse<any>>
): (request: TRequest, context?: TContext) => Promise<NextResponse<any>> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      console.error('Unhandled API error:', error);

      // Check for specific error types
      if (error instanceof SyntaxError) {
        return badRequest('Invalid JSON in request body');
      }

      return internalError();
    }
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */
