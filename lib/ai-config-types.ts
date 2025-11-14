// ============================================================================
// AI Configuration Types and Interfaces
// ============================================================================

/**
 * Model configuration with parameters
 */
export interface ModelConfig {
  id: string;
  name: string;
  parameters: {
    temperature: number;
    maxTokens?: number;
    topP?: number;
  };
}

/**
 * Custom provider configuration interface
 * Used for user-added custom AI providers
 */
export interface CustomProvider {
  id: string;
  name: string;
  type: 'openai-compatible';
  baseURL: string;
  apiKey?: string;
  enabled: boolean;
  models: ModelConfig[];
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
  disabledProviders?: string[]; // List of disabled built-in provider IDs
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
 * Utility functions for ModelConfig
 */
export function getModelName(model: ModelConfig): string {
  return model.name;
}

export function getModelParameters(model: ModelConfig) {
  return model.parameters;
}

/**
 * Migration helper: Convert legacy string models to ModelConfig
 */
export function migrateModels(models: any[]): ModelConfig[] {
  return models.map(m => {
    if (typeof m === 'string') {
      return {
        id: m,
        name: m,
        parameters: {
          temperature: 0.9,
          maxTokens: 96000,
          topP: 1
        }
      };
    }
    return m as ModelConfig;
  });
}