// {{CODE-Cycle-Integration:
//   Task_ID: [IMPL-VALIDATION-MODULE]
//   Timestamp: 2025-01-12T12:30:00Z
//   Phase: D-Develop
//   Context-Analysis: "Extracting and consolidating validation logic from ai-config-utils.ts into dedicated module with Zod integration"
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
  ModelParameters
} from '../types/provider-config';

import {
  ProviderConfigSchema,
  ModelConfigSchema,
  UserPreferencesSchema,
  ConfigurationSystemSchema,
  LegacyAIConfigSchema,
  LegacyCustomProviderSchema,
  ModelParametersSchema
} from '../validation-schemas';

// ============================================================================
// Provider Validation Service Class
// ============================================================================

/**
 * Comprehensive validation service for AI provider configurations
 * Integrates Zod schemas with custom validation logic for enhanced security and usability
 */
export class ProviderValidationService {
  private static instance: ProviderValidationService;

  private constructor() {}

  /**
   * Get singleton instance of the validation service
   */
  public static getInstance(): ProviderValidationService {
    if (!ProviderValidationService.instance) {
      ProviderValidationService.instance = new ProviderValidationService();
    }
    return ProviderValidationService.instance;
  }

  // ============================================================================
  // URL and Security Validation
  // ============================================================================

  /**
   * Validate URL format with HTTPS requirement and SSRF protection
   */
  public validateURL(url: string): { success: boolean; error?: string } {
    if (!url || typeof url !== 'string') {
      return { success: false, error: 'URL is required and must be a string' };
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      return { success: false, error: 'URL cannot be empty' };
    }

    try {
      const parsedUrl = new URL(trimmedUrl);

      // Must use HTTPS
      if (parsedUrl.protocol !== 'https:') {
        return {
          success: false,
          error: 'Base URL must use HTTPS (e.g., https://api.example.com/v1)'
        };
      }

      // Prevent SSRF attacks - block internal addresses
      const hostname = parsedUrl.hostname.toLowerCase();
      if (this.isInternalHostname(hostname)) {
        return {
          success: false,
          error: 'Internal/private IP addresses are not allowed'
        };
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: 'Invalid URL format. Use format: https://api.example.com/v1'
      };
    }
  }

  /**
   * Check if hostname points to internal/private network
   */
  private isInternalHostname(hostname: string): boolean {
    return (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.17.') ||
      hostname.startsWith('172.18.') ||
      hostname.startsWith('172.19.') ||
      hostname.startsWith('172.20.') ||
      hostname.startsWith('172.21.') ||
      hostname.startsWith('172.22.') ||
      hostname.startsWith('172.23.') ||
      hostname.startsWith('172.24.') ||
      hostname.startsWith('172.25.') ||
      hostname.startsWith('172.26.') ||
      hostname.startsWith('172.27.') ||
      hostname.startsWith('172.28.') ||
      hostname.startsWith('172.29.') ||
      hostname.startsWith('172.30.') ||
      hostname.startsWith('172.31.')
    );
  }

  // ============================================================================
  // Legacy Custom Provider Validation
  // ============================================================================

  /**
   * Validate a custom provider configuration with detailed error messages
   * Prevents SSRF attacks and ensures valid configuration
   *
   * @param provider - The legacy custom provider configuration to validate
   * @returns Validation result with success flag and detailed error messages
   */
  public validateCustomProvider(provider: LegacyCustomProvider): {
    success: boolean;
    errors: Record<string, string>;
  } {
    const errors: Record<string, string> = {};

    // Validate name with detailed error
    const trimmedName = provider.name?.trim() || '';
    if (!trimmedName) {
      errors.name = 'Provider name is required';
    } else if (trimmedName.length < 2) {
      errors.name = 'Provider name must be at least 2 characters';
    }

    // Validate baseURL with detailed error
    if (!provider.baseURL) {
      errors.baseURL = 'Base URL is required';
    } else {
      const urlValidation = this.validateURL(provider.baseURL);
      if (!urlValidation.success) {
        errors.baseURL = urlValidation.error || 'Invalid base URL';
      }
    }

    // Validate models with detailed error
    if (!provider.models || provider.models.length === 0) {
      errors.models = 'At least one model name is required (comma-separated)';
    } else {
      // Check for invalid model names
      const invalidModels = provider.models.filter(m => !m || m.trim().length < 1);
      if (invalidModels.length > 0) {
        errors.models = 'Model names cannot be empty';
      }
    }

    return {
      success: Object.keys(errors).length === 0,
      errors
    };
  }

  // ============================================================================
  // Provider Configuration Validation (Zod-based)
  // ============================================================================

  /**
   * Validate provider configuration using Zod schemas
   * @param data - Provider configuration data to validate
   * @returns Validation result with success flag and detailed error messages
   */
  public validateProviderConfig(data: unknown): {
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

  // ============================================================================
  // Model Configuration Validation (Zod-based)
  // ============================================================================

  /**
   * Validate model configuration using Zod schemas
   * @param data - Model configuration data to validate
   * @returns Validation result with success flag and detailed error messages
   */
  public validateModelConfig(data: unknown): {
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

  // ============================================================================
  // Model Parameters Validation
  // ============================================================================

  /**
   * Validate model parameters with enhanced error reporting
   * @param data - Model parameters to validate
   * @returns Validation result with success flag and detailed error messages
   */
  public validateModelParameters(data: unknown): {
    success: boolean;
    data?: ModelParameters;
    errors: string[];
  } {
    const result = ModelParametersSchema.safeParse(data);

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

  // ============================================================================
  // Legacy AI Config Validation
  // ============================================================================

  /**
   * Validate legacy AI config for migration compatibility
   * @param data - Legacy AI configuration to validate
   * @returns Validation result with success flag and detailed error messages
   */
  public validateLegacyAIConfig(data: unknown): {
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

  // ============================================================================
  // User Preferences Validation
  // ============================================================================

  /**
   * Validate user preferences configuration
   * @param data - User preferences data to validate
   * @returns Validation result with success flag and detailed error messages
   */
  public validateUserPreferences(data: unknown): {
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

  // ============================================================================
  // Complete Configuration System Validation
  // ============================================================================

  /**
   * Validate complete configuration system with detailed error reporting
   * @param data - Configuration system data to validate
   * @returns Validation result with success flag and detailed error messages
   */
  public validateConfigurationSystem(data: unknown): {
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

  // ============================================================================
  // Batch Validation Utilities
  // ============================================================================

  /**
   * Validate multiple providers in batch
   * @param providers - Array of provider configurations to validate
   * @returns Batch validation results
   */
  public validateMultipleProviders(providers: unknown[]): {
    overall: boolean;
    results: Array<{
      index: number;
      success: boolean;
      errors: string[];
    }>;
  } {
    const results = providers.map((provider, index) => {
      const validation = this.validateProviderConfig(provider);
      return {
        index,
        success: validation.success,
        errors: validation.errors,
      };
    });

    return {
      overall: results.every(result => result.success),
      results,
    };
  }

  /**
   * Validate multiple models in batch
   * @param models - Array of model configurations to validate
   * @returns Batch validation results
   */
  public validateMultipleModels(models: unknown[]): {
    overall: boolean;
    results: Array<{
      index: number;
      success: boolean;
      errors: string[];
    }>;
  } {
    const results = models.map((model, index) => {
      const validation = this.validateModelConfig(model);
      return {
        index,
        success: validation.success,
        errors: validation.errors,
      };
    });

    return {
      overall: results.every(result => result.success),
      results,
    };
  }
}

// ============================================================================
// Singleton Instance and Convenience Functions
// ============================================================================

/**
 * Singleton instance of the provider validation service
 */
export const providerValidationService = ProviderValidationService.getInstance();

/**
 * Convenience function for validating custom providers (legacy compatibility)
 */
export function validateCustomProvider(provider: LegacyCustomProvider): {
  success: boolean;
  errors: Record<string, string>;
} {
  return providerValidationService.validateCustomProvider(provider);
}

/**
 * Convenience function for validating provider configurations
 */
export function validateProviderConfig(data: unknown): {
  success: boolean;
  data?: ProviderConfig;
  errors: string[];
} {
  return providerValidationService.validateProviderConfig(data);
}

/**
 * Convenience function for validating model configurations
 */
export function validateModelConfig(data: unknown): {
  success: boolean;
  data?: ModelConfig;
  errors: string[];
} {
  return providerValidationService.validateModelConfig(data);
}

/**
 * Convenience function for validating model parameters
 */
export function validateModelParameters(data: unknown): {
  success: boolean;
  data?: ModelParameters;
  errors: string[];
} {
  return providerValidationService.validateModelParameters(data);
}

/**
 * Convenience function for validating legacy AI configurations
 */
export function validateLegacyAIConfig(data: unknown): {
  success: boolean;
  data?: LegacyAIConfig;
  errors: string[];
} {
  return providerValidationService.validateLegacyAIConfig(data);
}

/**
 * Convenience function for validating user preferences
 */
export function validateUserPreferences(data: unknown): {
  success: boolean;
  data?: UserPreferences;
  errors: string[];
} {
  return providerValidationService.validateUserPreferences(data);
}

/**
 * Convenience function for validating complete configuration system
 */
export function validateConfigurationSystem(data: unknown): {
  success: boolean;
  data?: ConfigurationSystem;
  errors: string[];
} {
  return providerValidationService.validateConfigurationSystem(data);
}

/**
 * Boolean-only validation for backward compatibility
 * @deprecated Use validateCustomProvider instead for detailed error messages
 */
export function validateCustomProviderBoolean(provider: LegacyCustomProvider): boolean {
  return validateCustomProvider(provider).success;
}

// {{END_MODIFICATIONS}}