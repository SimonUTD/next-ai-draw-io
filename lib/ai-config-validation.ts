// ============================================================================
// AI Configuration Validation Functions
// ============================================================================

import { MODEL_OPTIONS, BUILT_IN_PROVIDERS } from './ai-config-constants';
import type { CustomProvider, AIConfig } from './ai-config-types';
import { getModelName } from './ai-config-types';

// Import from validation module
import {
  validateCustomProvider as validateCustomProviderNew,
  validateCustomProviderBoolean as validateCustomProviderBooleanNew,
  validateLegacyAIConfig,
} from './validation';

/**
 * @deprecated Use the new ProviderRegistry system instead. This function is maintained for backward compatibility.
 * Validate AI configuration
 */
export function validateConfig(config: AIConfig): boolean {
  // Log deprecation warning in development
  if (process.env.NODE_ENV === 'development') {
    console.warn('validateConfig is deprecated. Consider using ProviderRegistry directly for new implementations.');
  }

  try {
    // Use the new validation system
    const result = validateLegacyAIConfig(config);
    if (!result.success) {
      console.warn('New validation failed, errors:', result.errors);
      throw new Error(`Validation failed: ${result.errors.join(', ')}`);
    }
    return true;
  } catch (error) {
    // Fallback to legacy implementation for maximum compatibility
    console.warn('New validation failed, falling back to legacy implementation:', error);
    return validateConfigLegacy(config);
  }
}

/**
 * Generate consistent provider ID based on name (same as in model-quick-switch.tsx)
 */
function generateConsistentProviderId(providerName: string): string {
  return providerName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-');
}

/**
 * Legacy implementation of validateConfig for fallback compatibility
 */
function validateConfigLegacy(config: AIConfig): boolean {
  // Check if it's a built-in provider
  const isBuiltIn = BUILT_IN_PROVIDERS.includes(config.provider as any);

  if (isBuiltIn) {
    // Validate model exists in provider's model list
    const models = MODEL_OPTIONS[config.provider as keyof typeof MODEL_OPTIONS];
    if (!models.includes(config.model)) {
      return false;
    }
  } else {
    // For custom providers, check if it exists in customProviders
    if (!config.customProviders) {
      return false;
    }
    // First try direct ID match
    let customProvider = config.customProviders.find(p => p.id === config.provider);

    // If not found, try matching by consistent name-based ID
    if (!customProvider) {
      customProvider = config.customProviders.find(p => {
        const consistentId = generateConsistentProviderId(p.name);
        return consistentId === config.provider;
      });
    }

    if (!customProvider) {
      return false;
    }
    // Validate model exists in custom provider's model list
    const modelExists = customProvider.models.some(m => {
      // Handle both string and object model formats
      const modelName = typeof m === 'string' ? m : m.name;
      return modelName === config.model;
    });

    if (!modelExists) {
      return false;
    }
  }

  // Validate parameters if provided
  if (config.parameters) {
    if (
      config.parameters.temperature !== undefined &&
      (config.parameters.temperature < 0 || config.parameters.temperature > 2)
    ) {
      return false;
    }

    if (
      config.parameters.maxTokens !== undefined &&
      config.parameters.maxTokens <= 0
    ) {
      return false;
    }

    if (
      config.parameters.topP !== undefined &&
      (config.parameters.topP < 0 || config.parameters.topP > 1)
    ) {
      return false;
    }
  }

  return true;
}

/**
 * @deprecated This function is now re-exported from the dedicated validation module.
 * The actual implementation has been moved to ./validation/provider-validation.ts for better maintainability.
 *
 * Validate a custom provider configuration with detailed error messages
 * Prevents SSRF attacks and ensures valid configuration
 *
 * @param provider - The provider configuration to validate
 * @returns Validation result with success flag and detailed error messages
 */
export function validateCustomProvider(provider: CustomProvider): {
  success: boolean;
  errors: Record<string, string>
} {
  // Convert to LegacyCustomProvider format for compatibility
  const legacyProvider = {
    id: provider.id,
    name: provider.name,
    type: provider.type,
    baseURL: provider.baseURL,
    models: provider.models.map(model => getModelName(model)),
    apiKey: provider.apiKey,
    customEndpoint: provider.customEndpoint,
  };

  return validateCustomProviderNew(legacyProvider);
}

/**
 * @deprecated Use validateCustomProvider instead for detailed error messages.
 * This function is now re-exported from the dedicated validation module.
 * Legacy boolean-only validation for backward compatibility.
 *
 * @param provider - The provider configuration to validate
 * @returns Simple boolean validation result
 */
export function validateCustomProviderBoolean(provider: CustomProvider): boolean {
  return validateCustomProviderBooleanNew({
    id: provider.id,
    name: provider.name,
    type: provider.type,
    baseURL: provider.baseURL,
    models: provider.models.map(model => getModelName(model)),
    apiKey: provider.apiKey,
    customEndpoint: provider.customEndpoint,
  });
}