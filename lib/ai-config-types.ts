// ============================================================================
// AI Configuration Types and Interfaces
// ============================================================================

/**
 * Custom provider configuration interface
 * Used for user-added custom AI providers
 */
export interface CustomProvider {
  id: string; // User-defined ID
  name: string; // Display name
  type: 'openai-compatible' | 'custom-api';
  baseURL: string; // Custom API endpoint
  // Support both string models (legacy) and models with parameters (new)
  models: (string | {
    name: string;
    parameters: {
      temperature: number;
      maxTokens?: number;
      topP?: number;
    };
  })[];
  apiKey?: string; // Encrypted storage
  customEndpoint?: boolean; // Whether this uses a non-standard endpoint
}

/**
 * Legacy AI configuration interface
 * This is the original configuration format used by the application
 */
export interface AIConfig {
  provider: "openai" | "google" | "bedrock" | "openrouter" | string; // string for custom provider ID
  model: string;
  apiKey?: string; // Encrypted storage
  region?: string; // AWS region for Bedrock
  accessKeyId?: string; // AWS access key ID for Bedrock
  secretAccessKey?: string; // AWS secret access key for Bedrock
  parameters?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
  customProviders?: CustomProvider[]; // User-added custom providers
}

/**
 * Encryption result interface
 * Used for API key encryption/decryption operations
 */
export interface EncryptionResult {
  encrypted: string;
  iv: string;
  salt: string;
}

/**
 * Utility functions for handling CustomProvider models
 * Supports both legacy string models and new models with parameters
 */

/**
 * Extract model name from either string or object format
 */
export function getModelName(model: string | { name: string; parameters: any }): string {
  return typeof model === 'string' ? model : model.name;
}

/**
 * Extract model parameters from object format, or return defaults for string format
 */
export function getModelParameters(model: string | { name: string; parameters: any }): {
  temperature: number;
  maxTokens?: number;
  topP?: number;
} {
  if (typeof model === 'string') {
    return {
      temperature: 0,
      maxTokens: 96000,
      topP: 1
    };
  }
  return model.parameters;
}

/**
 * Convert models array to string array (for backward compatibility)
 */
export function modelsToStringArray(models: (string | { name: string; parameters: any })[]): string[] {
  return models.map(m => getModelName(m));
}