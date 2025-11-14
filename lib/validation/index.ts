// {{CODE-Cycle-Integration:
//   Task_ID: [IMPL-VALIDATION-MODULE]
//   Timestamp: 2025-01-12T12:45:00Z
//   Phase: D-Develop
//   Context-Analysis: "Creating barrel export file for validation module to provide clean public API"
//   Principle_Applied: "Aether-Engineering-SOLID-S, Aether-Engineering-KISS"
// }}
// {{START_MODIFICATIONS}}

// ============================================================================
// Main Validation Service
// ============================================================================

export {
  ProviderValidationService,
  providerValidationService,
} from './provider-validation';

// ============================================================================
// Validation Functions (Legacy Compatibility)
// ============================================================================

export {
  validateCustomProvider,
  validateCustomProviderBoolean,
  validateProviderConfig,
  validateModelConfig,
  validateModelParameters,
  validateLegacyAIConfig,
  validateUserPreferences,
  validateConfigurationSystem,
} from './provider-validation';

// ============================================================================
// Re-export Zod Schemas
// ============================================================================

export {
  // Authentication Schemas
  ProviderAuthenticationSchema,

  // Capabilities Schemas
  ProviderCapabilitiesSchema,
  ModelCapabilitiesSchema,

  // Metadata Schemas
  ProviderMetadataSchema,
  ModelMetadataSchema,

  // Parameters Schemas
  ModelParametersSchema,

  // Main Configuration Schemas
  ModelConfigSchema,
  ProviderConfigSchema,
  UserPreferencesSchema,
  ConfigurationSystemSchema,

  // Legacy and Migration Schemas
  LegacyCustomProviderSchema,
  LegacyAIConfigSchema,
  MigrationResultSchema,
} from '../validation-schemas';

// ============================================================================
// Type Exports
// ============================================================================

export type {
  ProviderConfig,
  ModelConfig,
  UserPreferences,
  ConfigurationSystem,
  LegacyAIConfig,
  LegacyCustomProvider,
  ProviderAuthentication,
  ModelParameters,
  ProviderCapabilities,
  ModelCapabilities,
  ProviderMetadata,
  ModelMetadata,
} from '../types/provider-config';

// {{END_MODIFICATIONS}}