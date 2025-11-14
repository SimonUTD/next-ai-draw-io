// {{CODE-Cycle-Integration:
//   Task_ID: [#T002]
//   Timestamp: 2025-11-12T08:30:00Z
//   Phase: D-Develop
//   Context-Analysis: "Analyzed existing AIConfig structure and migration requirements. Creating new provider-based configuration interfaces."
//   Principle_Applied: "Aether-Engineering-SOLID-S, Aether-Engineering-KISS"
// }}
// {{START_MODIFICATIONS}}

/**
 * Provider-based configuration system
 * Replaces the model-centric AIConfig with a provider-centric architecture
 */

// ============================================================================
// Authentication Interfaces
// ============================================================================

export interface ProviderAuthentication {
  /** API key for authentication (encrypted storage) */
  apiKey?: string;
  /** Base URL for custom endpoints */
  baseUrl?: string;
  /** Channel identifier for providers requiring channel specification */
  channel?: string;
  /** AWS region for Bedrock provider */
  region?: string;
  /** AWS access key ID for Bedrock provider */
  accessKeyId?: string;
  /** AWS secret access key for Bedrock provider */
  secretAccessKey?: string;
  /** Custom headers for provider requests */
  customHeaders?: Record<string, string>;
  /** Timeout configuration in milliseconds */
  timeout?: number;
}

// ============================================================================
// Capabilities Interfaces
// ============================================================================

export interface ProviderCapabilities {
  /** Streaming chat completion support */
  streaming: boolean;
  /** Tool/function calling support */
  tools: boolean;
  /** Image generation/analysis support */
  images: boolean;
  /** Reasoning/chain-of-thought support */
  reasoning: boolean;
  /** Model discovery/API listing support */
  modelDiscovery: boolean;
  /** Configuration testing support */
  configurationTesting: boolean;
}

export interface ModelCapabilities {
  /** Context window size in tokens */
  contextWindow?: number;
  /** Input cost per 1M tokens (USD) */
  inputCost?: number;
  /** Output cost per 1M tokens (USD) */
  outputCost?: number;
  /** Maximum output tokens */
  maxOutputTokens?: number;
  /** Supported features */
  supportedFeatures: string[];
  /** Model type classification */
  modelType: 'chat' | 'completion' | 'embedding' | 'multimodal';
  /** Language support */
  languages: string[];
}

// ============================================================================
// Metadata Interfaces
// ============================================================================

export interface ProviderMetadata {
  /** Last configuration test timestamp */
  lastTested?: Date;
  /** Current test status */
  testStatus: 'success' | 'failure' | 'pending' | 'untested';
  /** Number of consecutive test failures */
  errorCount: number;
  /** Last error message from failed test */
  lastError?: string;
  /** Average response time in milliseconds */
  averageResponseTime?: number;
  /** Provider reliability score (0-100) */
  reliabilityScore?: number;
  /** Created timestamp */
  createdAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
  /** Provider version */
  version?: string;
}

export interface ModelMetadata {
  /** Context window size in tokens */
  contextWindow?: number;
  /** Input cost per 1M tokens (USD) */
  inputCost?: number;
  /** Output cost per 1M tokens (USD) */
  outputCost?: number;
  /** Maximum output tokens */
  maxOutputTokens?: number;
  /** Model capabilities list */
  capabilities: string[];
  /** Model family */
  family?: string;
  /** Release date */
  releaseDate?: Date;
  /** Deprecated status */
  deprecated?: boolean;
  /** Replacement model ID if deprecated */
  replacementModelId?: string;
  /** Training data cutoff */
  trainingDataCutoff?: Date;
}

// ============================================================================
// Main Configuration Interfaces
// ============================================================================

/**
 * Provider configuration interface
 * Central configuration for each AI provider with authentication and capabilities
 */
export interface ProviderConfig {
  /** Unique provider identifier */
  id: string;
  /** Human-readable provider name */
  name: string;
  /** Provider type */
  type: 'openai' | 'google' | 'bedrock' | 'openrouter' | 'custom';
  /** Provider enabled status */
  enabled: boolean;
  /** Authentication configuration */
  authentication: ProviderAuthentication;
  /** Array of available models for this provider */
  models: ModelConfig[];
  /** Provider capabilities */
  capabilities: ProviderCapabilities;
  /** Provider metadata and status */
  metadata: ProviderMetadata;
  /** Provider priority for fallback (lower number = higher priority) */
  priority?: number;
  /** Provider tags for categorization */
  tags?: string[];
  /** Provider description */
  description?: string;
}

/**
 * Model configuration interface
 * Individual model configuration linked to a provider
 */
export interface ModelConfig {
  /** Unique model identifier */
  id: string;
  /** Human-readable model name */
  name: string;
  /** Reference to parent provider */
  providerId: string;
  /** Model enabled status */
  enabled: boolean;
  /** Model parameters for generation */
  parameters: ModelParameters;
  /** Model metadata and capabilities */
  metadata: ModelMetadata;
  /** Model priority within provider */
  priority?: number;
  /** Model tags for categorization */
  tags?: string[];
  /** Model description */
  description?: string;
  /** Is this a default model for the provider */
  isDefault?: boolean;
}

/**
 * Model generation parameters
 * Configuration for model inference parameters
 */
export interface ModelParameters {
  /** Sampling temperature (0-2) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Nucleus sampling parameter (0-1) */
  topP?: number;
  /** Top-k sampling parameter */
  topK?: number;
  /** Frequency penalty (-2 to 2) */
  frequencyPenalty?: number;
  /** Presence penalty (-2 to 2) */
  presencePenalty?: number;
  /** Stop sequences */
  stopSequences?: string[];
  /** System prompt */
  systemPrompt?: string;
  /** Custom model-specific parameters */
  customParameters?: Record<string, any>;
}

/**
 * User preferences interface
 * User's default configuration selections and behavior settings
 */
export interface UserPreferences {
  /** Default provider ID for new conversations */
  defaultProviderId: string;
  /** Default model ID for new conversations */
  defaultModelId: string;
  /** Automatic provider switching on failure */
  autoSwitch: boolean;
  /** Fallback configuration enabled */
  fallbackEnabled: boolean;
  /** Fallback provider ID */
  fallbackProviderId?: string;
  /** Fallback model ID */
  fallbackModelId?: string;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Timeout duration in milliseconds */
  timeout?: number;
  /** Streaming response preference */
  preferStreaming?: boolean;
  /** Language preference */
  language?: string;
  /** Theme preference */
  theme?: 'light' | 'dark' | 'auto';
  /** Notification preferences */
  notifications?: {
    providerErrors: boolean;
    modelSwitches: boolean;
    testResults: boolean;
  };
  /** Performance preferences */
  performance?: {
    maxConcurrentRequests: number;
    requestQueueing: boolean;
    cacheResponses: boolean;
  };
}

// ============================================================================
// Configuration Collections
// ============================================================================

/**
 * Complete configuration system interface
 * Top-level configuration containing all providers, models, and preferences
 */
export interface ConfigurationSystem {
  /** Array of provider configurations */
  providers: ProviderConfig[];
  /** User preferences */
  userPreferences: UserPreferences;
  /** Configuration version for migration tracking */
  version: string;
  /** Last migration timestamp */
  lastMigrated?: Date;
  /** Configuration metadata */
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    exportSource?: string;
    checksum?: string;
  };
}

// ============================================================================
// Migration and Compatibility Interfaces
// ============================================================================

/**
 * Legacy AIConfig interface for migration compatibility
 * Represents the old model-centric configuration structure
 */
export interface LegacyAIConfig {
  provider: "openai" | "google" | "bedrock" | "openrouter" | string;
  model: string;
  apiKey?: string;
  parameters?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
  customProviders?: LegacyCustomProvider[];
}

/**
 * Legacy CustomProvider interface for migration compatibility
 */
export interface LegacyCustomProvider {
  id: string;
  name: string;
  type: 'openai-compatible' | 'custom-api';
  baseURL: string;
  models: string[];
  apiKey?: string;
  customEndpoint?: boolean;
}

/**
 * Migration result interface
 * Tracks the outcome of configuration migration operations
 */
export interface MigrationResult {
  /** Migration success status */
  success: boolean;
  /** Number of providers migrated */
  providersMigrated: number;
  /** Number of models migrated */
  modelsMigrated: number;
  /** Migration warnings */
  warnings: string[];
  /** Migration errors */
  errors: string[];
  /** Migration timestamp */
  migratedAt: Date;
  /** Backup created flag */
  backupCreated: boolean;
  /** Rollback available flag */
  rollbackAvailable: boolean;
}

// ============================================================================
// Type Guards and Utilities
// ============================================================================

/**
 * Type guard for ProviderConfig
 */
export function isProviderConfig(obj: any): obj is ProviderConfig {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    ['openai', 'google', 'bedrock', 'openrouter', 'custom'].includes(obj.type) &&
    typeof obj.enabled === 'boolean' &&
    obj.authentication &&
    Array.isArray(obj.models) &&
    obj.capabilities &&
    obj.metadata
  );
}

/**
 * Type guard for ModelConfig
 */
export function isModelConfig(obj: any): obj is ModelConfig {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.providerId === 'string' &&
    typeof obj.enabled === 'boolean' &&
    obj.parameters &&
    obj.metadata
  );
}

/**
 * Type guard for UserPreferences
 */
export function isUserPreferences(obj: any): obj is UserPreferences {
  return (
    obj &&
    typeof obj.defaultProviderId === 'string' &&
    typeof obj.defaultModelId === 'string' &&
    typeof obj.autoSwitch === 'boolean' &&
    typeof obj.fallbackEnabled === 'boolean'
  );
}

/**
 * Type guard for LegacyAIConfig
 */
export function isLegacyAIConfig(obj: any): obj is LegacyAIConfig {
  return (
    obj &&
    typeof obj.provider === 'string' &&
    typeof obj.model === 'string'
  );
}

// {{END_MODIFICATIONS}}