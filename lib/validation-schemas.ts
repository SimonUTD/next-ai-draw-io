// {{CODE-Cycle-Integration:
//   Task_ID: [#T002]
//   Timestamp: 2025-11-12T08:35:00Z
//   Phase: D-Develop
//   Context-Analysis: "Creating comprehensive Zod validation schemas for all new provider-based data models."
//   Principle_Applied: "Aether-Engineering-SOLID-S, Aether-Engineering-DRY"
// }}
// {{START_MODIFICATIONS}}

import { z } from 'zod';
import type {
  ProviderConfig,
  ModelConfig,
  UserPreferences,
  ConfigurationSystem,
  LegacyAIConfig,
  LegacyCustomProvider,
  ProviderAuthentication,
  ProviderCapabilities,
  ModelCapabilities,
  ProviderMetadata,
  ModelMetadata,
  ModelParameters,
  MigrationResult
} from './types/provider-config';

// ============================================================================
// Base Validation Schemas
// ============================================================================

/**
 * URL validation with HTTPS requirement and SSRF protection
 */
const secureUrlSchema = z.string()
  .min(1, 'URL cannot be empty')
  .url('Invalid URL format')
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:';
      } catch {
        return false;
      }
    },
    {
      message: 'URL must use HTTPS protocol',
    }
  )
  .refine(
    (url) => {
      try {
        const hostname = new URL(url).hostname.toLowerCase();
        // Block internal addresses for SSRF protection
        const blockedPatterns = [
          'localhost',
          /^127\./,
          /^192\.168\./,
          /^10\./,
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
        ];

        return !blockedPatterns.some(pattern =>
          typeof pattern === 'string' ? hostname === pattern : pattern.test(hostname)
        );
      } catch {
        return false;
      }
    },
    {
      message: 'URL cannot point to internal network addresses',
    }
  );

/**
 * API key validation schema
 */
const apiKeySchema = z.string()
  .min(1, 'API key cannot be empty')
  .max(500, 'API key too long')
  .refine(
    (key) => /^[a-zA-Z0-9\-_\.]+$/.test(key),
    {
      message: 'API key contains invalid characters',
    }
  );

/**
 * Provider type validation
 */
const providerTypeSchema = z.enum(['openai', 'google', 'bedrock', 'openrouter', 'custom'], {
  errorMap: (issue, ctx) => {
    if (issue.code === z.ZodIssueCode.invalid_enum_value) {
      return { message: 'Provider type must be one of: openai, google, bedrock, openrouter, custom' };
    }
    return { message: ctx.defaultError };
  },
});

/**
 * Model type validation
 */
const modelTypeSchema = z.enum(['chat', 'completion', 'embedding', 'multimodal'], {
  errorMap: (issue, ctx) => {
    if (issue.code === z.ZodIssueCode.invalid_enum_value) {
      return { message: 'Model type must be one of: chat, completion, embedding, multimodal' };
    }
    return { message: ctx.defaultError };
  },
});

/**
 * Test status validation
 */
const testStatusSchema = z.enum(['success', 'failure', 'pending', 'untested'], {
  errorMap: (issue, ctx) => {
    if (issue.code === z.ZodIssueCode.invalid_enum_value) {
      return { message: 'Test status must be one of: success, failure, pending, untested' };
    }
    return { message: ctx.defaultError };
  },
});

// ============================================================================
// Authentication Schema
// ============================================================================

/**
 * Provider authentication validation schema
 */
export const ProviderAuthenticationSchema: z.ZodSchema<ProviderAuthentication> = z.object({
  apiKey: z.string().min(1, 'API key cannot be empty').optional(),
  baseUrl: secureUrlSchema.optional(),
  channel: z.string().min(1, 'Channel cannot be empty').max(100, 'Channel too long').optional(),
  region: z.string().min(1, 'Region cannot be empty').max(50, 'Region too long').optional(),
  accessKeyId: z.string().min(1, 'AWS access key ID cannot be empty').max(200, 'Access key ID too long').optional(),
  secretAccessKey: z.string().min(1, 'AWS secret access key cannot be empty').max(200, 'Secret access key too long').optional(),
  customHeaders: z.record(z.string(), z.string()).optional(),
  timeout: z.number().min(100, 'Timeout must be at least 100ms').max(300000, 'Timeout cannot exceed 5 minutes').optional(),
}).strict();

// ============================================================================
// Capabilities Schema
// ============================================================================

/**
 * Provider capabilities validation schema
 */
export const ProviderCapabilitiesSchema: z.ZodSchema<ProviderCapabilities> = z.object({
  streaming: z.boolean(),
  tools: z.boolean(),
  images: z.boolean(),
  reasoning: z.boolean(),
  modelDiscovery: z.boolean(),
  configurationTesting: z.boolean(),
}).strict();

/**
 * Model capabilities validation schema
 */
export const ModelCapabilitiesSchema: z.ZodSchema<ModelCapabilities> = z.object({
  contextWindow: z.number().min(1, 'Context window must be positive').max(2000000, 'Context window too large').optional(),
  inputCost: z.number().min(0, 'Input cost cannot be negative').max(1000, 'Input cost too high').optional(),
  outputCost: z.number().min(0, 'Output cost cannot be negative').max(1000, 'Output cost too high').optional(),
  maxOutputTokens: z.number().min(1, 'Max output tokens must be positive').max(2000000, 'Max output tokens too large').optional(),
  supportedFeatures: z.array(z.string()).min(1, 'At least one supported feature required'),
  modelType: modelTypeSchema,
  languages: z.array(z.string().min(2, 'Language code too short').max(10, 'Language code too long')).min(1, 'At least one language required'),
}).strict();

// ============================================================================
// Metadata Schemas
// ============================================================================

/**
 * Provider metadata validation schema
 */
export const ProviderMetadataSchema: z.ZodSchema<ProviderMetadata> = z.object({
  lastTested: z.date().optional(),
  testStatus: testStatusSchema,
  errorCount: z.number().min(0, 'Error count cannot be negative').max(100, 'Error count too high'),
  lastError: z.string().max(1000, 'Error message too long').optional(),
  averageResponseTime: z.number().min(0, 'Response time cannot be negative').max(60000, 'Response time too high').optional(),
  reliabilityScore: z.number().min(0, 'Reliability score must be 0-100').max(100, 'Reliability score must be 0-100').optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.string().max(50, 'Version too long').optional(),
}).strict();

/**
 * Model metadata validation schema
 */
export const ModelMetadataSchema: z.ZodSchema<ModelMetadata> = z.object({
  contextWindow: z.number().min(1, 'Context window must be positive').max(2000000, 'Context window too large').optional(),
  inputCost: z.number().min(0, 'Input cost cannot be negative').max(1000, 'Input cost too high').optional(),
  outputCost: z.number().min(0, 'Output cost cannot be negative').max(1000, 'Output cost too high').optional(),
  maxOutputTokens: z.number().min(1, 'Max output tokens must be positive').max(2000000, 'Max output tokens too large').optional(),
  capabilities: z.array(z.string()).min(1, 'At least one capability required'),
  family: z.string().max(100, 'Model family too long').optional(),
  releaseDate: z.date().optional(),
  deprecated: z.boolean().optional(),
  replacementModelId: z.string().max(100, 'Replacement model ID too long').optional(),
  trainingDataCutoff: z.date().optional(),
}).strict();

// ============================================================================
// Parameters Schema
// ============================================================================

/**
 * Model parameters validation schema
 */
export const ModelParametersSchema: z.ZodSchema<ModelParameters> = z.object({
  temperature: z.number().min(0, 'Temperature must be 0-2').max(2, 'Temperature must be 0-2').optional(),
  maxTokens: z.number().min(1, 'Max tokens must be positive').max(2000000, 'Max tokens too large').optional(),
  topP: z.number().min(0, 'Top-p must be 0-1').max(1, 'Top-p must be 0-1').optional(),
  topK: z.number().min(1, 'Top-k must be positive').max(1000, 'Top-k too large').optional(),
  frequencyPenalty: z.number().min(-2, 'Frequency penalty must be -2 to 2').max(2, 'Frequency penalty must be -2 to 2').optional(),
  presencePenalty: z.number().min(-2, 'Presence penalty must be -2 to 2').max(2, 'Presence penalty must be -2 to 2').optional(),
  stopSequences: z.array(z.string().max(100, 'Stop sequence too long')).max(10, 'Too many stop sequences').optional(),
  systemPrompt: z.string().max(10000, 'System prompt too long').optional(),
  customParameters: z.record(z.any()).optional(),
}).strict();

// ============================================================================
// Main Configuration Schemas
// ============================================================================

/**
 * Model configuration validation schema
 */
export const ModelConfigSchema: z.ZodSchema<ModelConfig> = z.object({
  id: z.string().min(1, 'Model ID cannot be empty').max(100, 'Model ID too long'),
  name: z.string().min(1, 'Model name cannot be empty').max(200, 'Model name too long'),
  providerId: z.string().min(1, 'Provider ID cannot be empty').max(100, 'Provider ID too long'),
  enabled: z.boolean(),
  parameters: ModelParametersSchema,
  metadata: ModelMetadataSchema,
  priority: z.number().min(1, 'Priority must be positive').max(100, 'Priority too high').optional(),
  tags: z.array(z.string().max(50, 'Tag too long')).max(10, 'Too many tags').optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  isDefault: z.boolean().optional(),
}).strict()
.refine(
  (data) => {
    // Validate that context window in metadata doesn't exceed max output tokens
    if (data.metadata.contextWindow && data.parameters.maxTokens) {
      return data.parameters.maxTokens <= data.metadata.contextWindow;
    }
    return true;
  },
  {
    message: 'Max tokens cannot exceed context window size',
    path: ['parameters', 'maxTokens'],
  }
);

/**
 * Provider configuration validation schema
 */
export const ProviderConfigSchema: z.ZodSchema<ProviderConfig> = z.object({
  id: z.string().min(1, 'Provider ID cannot be empty').max(100, 'Provider ID too long'),
  name: z.string().min(1, 'Provider name cannot be empty').max(200, 'Provider name too long'),
  type: providerTypeSchema,
  enabled: z.boolean(),
  authentication: ProviderAuthenticationSchema,
  models: z.array(ModelConfigSchema).min(1, 'Provider must have at least one model'),
  capabilities: ProviderCapabilitiesSchema,
  metadata: ProviderMetadataSchema,
  priority: z.number().min(1, 'Priority must be positive').max(100, 'Priority too high').optional(),
  tags: z.array(z.string().max(50, 'Tag too long')).max(10, 'Too many tags').optional(),
  description: z.string().max(1000, 'Description too long').optional(),
}).strict()
.refine(
  (data) => {
    // Validate authentication requirements based on provider type
    switch (data.type) {
      case 'bedrock':
        return !!(data.authentication.accessKeyId && data.authentication.secretAccessKey && data.authentication.region);
      case 'openai':
      case 'google':
      case 'openrouter':
        return !!data.authentication.apiKey;
      case 'custom':
        return !!data.authentication.baseUrl;
      default:
        return false;
    }
  },
  {
    message: 'Provider authentication requirements not met for provider type',
    path: ['authentication'],
  }
)
.refine(
  (data) => {
    // Validate that all models belong to this provider
    return data.models.every(model => model.providerId === data.id);
  },
  {
    message: 'All models must have providerId matching their parent provider',
    path: ['models'],
  }
);

/**
 * User preferences validation schema
 */
export const UserPreferencesSchema: z.ZodSchema<UserPreferences> = z.object({
  defaultProviderId: z.string().min(1, 'Default provider ID cannot be empty').max(100, 'Default provider ID too long'),
  defaultModelId: z.string().min(1, 'Default model ID cannot be empty').max(100, 'Default model ID too long'),
  autoSwitch: z.boolean(),
  fallbackEnabled: z.boolean(),
  fallbackProviderId: z.string().max(100, 'Fallback provider ID too long').optional(),
  fallbackModelId: z.string().max(100, 'Fallback model ID too long').optional(),
  maxRetries: z.number().min(0, 'Max retries cannot be negative').max(10, 'Max retries too high').optional(),
  timeout: z.number().min(1000, 'Timeout must be at least 1 second').max(300000, 'Timeout cannot exceed 5 minutes').optional(),
  preferStreaming: z.boolean().optional(),
  language: z.string().max(10, 'Language code too long').optional(),
  theme: z.enum(['light', 'dark', 'auto']).optional(),
  notifications: z.object({
    providerErrors: z.boolean(),
    modelSwitches: z.boolean(),
    testResults: z.boolean(),
  }).optional(),
  performance: z.object({
    maxConcurrentRequests: z.number().min(1, 'Max concurrent requests must be positive').max(20, 'Max concurrent requests too high'),
    requestQueueing: z.boolean(),
    cacheResponses: z.boolean(),
  }).optional(),
}).strict()
.refine(
  (data) => {
    // If fallback is enabled, both fallback provider and model must be specified
    if (data.fallbackEnabled) {
      return !!(data.fallbackProviderId && data.fallbackModelId);
    }
    return true;
  },
  {
    message: 'Both fallbackProviderId and fallbackModelId must be specified when fallback is enabled',
    path: ['fallbackEnabled'],
  }
);

/**
 * Complete configuration system validation schema
 */
export const ConfigurationSystemSchema: z.ZodSchema<ConfigurationSystem> = z.object({
  providers: z.array(ProviderConfigSchema).min(1, 'At least one provider is required'),
  userPreferences: UserPreferencesSchema,
  version: z.string().min(1, 'Version cannot be empty').max(20, 'Version too long'),
  lastMigrated: z.date().optional(),
  metadata: z.object({
    createdAt: z.date(),
    updatedAt: z.date(),
    exportSource: z.string().max(100, 'Export source too long').optional(),
    checksum: z.string().max(64, 'Checksum too long').optional(),
  }).strict(),
}).strict()
.refine(
  (data) => {
    // Validate that default provider and model exist in the configuration
    const defaultProviderExists = data.providers.some(p => p.id === data.userPreferences.defaultProviderId);
    if (!defaultProviderExists) {
      return false;
    }

    const defaultModelExists = data.providers.some(p =>
      p.models.some(m => m.id === data.userPreferences.defaultModelId)
    );
    if (!defaultModelExists) {
      return false;
    }

    // If fallback is configured, validate it exists
    if (data.userPreferences.fallbackEnabled && data.userPreferences.fallbackProviderId) {
      const fallbackProviderExists = data.providers.some(p => p.id === data.userPreferences.fallbackProviderId);
      if (!fallbackProviderExists) {
        return false;
      }

      if (data.userPreferences.fallbackModelId) {
        const fallbackModelExists = data.providers.some(p =>
          p.models.some(m => m.id === data.userPreferences.fallbackModelId)
        );
        if (!fallbackModelExists) {
          return false;
        }
      }
    }

    return true;
  },
  {
    message: 'Default provider/model references must exist in the configuration',
  }
);

// ============================================================================
// Legacy and Migration Schemas
// ============================================================================

/**
 * Legacy custom provider validation schema
 */
export const LegacyCustomProviderSchema: z.ZodSchema<LegacyCustomProvider> = z.object({
  id: z.string().min(1, 'Legacy custom provider ID cannot be empty'),
  name: z.string().min(1, 'Legacy custom provider name cannot be empty'),
  type: z.enum(['openai-compatible', 'custom-api']),
  baseURL: secureUrlSchema,
  models: z.array(z.string()).min(1, 'Legacy custom provider must have at least one model'),
  apiKey: z.string().optional(),
  customEndpoint: z.boolean().optional(),
}).strict();

/**
 * Legacy AIConfig validation schema
 */
export const LegacyAIConfigSchema: z.ZodSchema<LegacyAIConfig> = z.object({
  provider: z.string().min(1, 'Legacy provider cannot be empty'),
  model: z.string().min(1, 'Legacy model cannot be empty'),
  apiKey: z.string().optional(),
  parameters: z.object({
    temperature: z.number().min(0, 'Temperature must be 0-2').max(2, 'Temperature must be 0-2').optional(),
    maxTokens: z.number().min(1, 'Max tokens must be positive').optional(),
    topP: z.number().min(0, 'Top-p must be 0-1').max(1, 'Top-p must be 0-1').optional(),
  }).optional(),
  customProviders: z.array(LegacyCustomProviderSchema).optional(),
}).strict();

/**
 * Migration result validation schema
 */
export const MigrationResultSchema: z.ZodSchema<MigrationResult> = z.object({
  success: z.boolean(),
  providersMigrated: z.number().min(0, 'Providers migrated cannot be negative'),
  modelsMigrated: z.number().min(0, 'Models migrated cannot be negative'),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
  migratedAt: z.date(),
  backupCreated: z.boolean(),
  rollbackAvailable: z.boolean(),
}).strict();

// ============================================================================
// Validation Utility Functions
// ============================================================================

/**
 * Validate provider configuration with detailed error reporting
 */
export function validateProviderConfig(data: unknown): {
  success: boolean;
  data?: ProviderConfig;
  errors: string[];
} {
  const result = ProviderConfigSchema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: [],
    };
  }

  return {
    success: false,
    errors: result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`),
  };
}

/**
 * Validate model configuration with detailed error reporting
 */
export function validateModelConfig(data: unknown): {
  success: boolean;
  data?: ModelConfig;
  errors: string[];
} {
  const result = ModelConfigSchema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: [],
    };
  }

  return {
    success: false,
    errors: result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`),
  };
}

/**
 * Validate user preferences with detailed error reporting
 */
export function validateUserPreferences(data: unknown): {
  success: boolean;
  data?: UserPreferences;
  errors: string[];
} {
  const result = UserPreferencesSchema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: [],
    };
  }

  return {
    success: false,
    errors: result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`),
  };
}

/**
 * Validate complete configuration system with detailed error reporting
 */
export function validateConfigurationSystem(data: unknown): {
  success: boolean;
  data?: ConfigurationSystem;
  errors: string[];
} {
  const result = ConfigurationSystemSchema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: [],
    };
  }

  return {
    success: false,
    errors: result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`),
  };
}

/**
 * Validate legacy AI config for migration compatibility
 */
export function validateLegacyAIConfig(data: unknown): {
  success: boolean;
  data?: LegacyAIConfig;
  errors: string[];
} {
  const result = LegacyAIConfigSchema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: [],
    };
  }

  return {
    success: false,
    errors: result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`),
  };
}

// {{END_MODIFICATIONS}}