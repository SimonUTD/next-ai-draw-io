// ============================================================================
// Provider Management Functions
// ============================================================================

import { providerRegistry } from "./provider-registry";
import { modelDiscoveryService } from "./model-discovery";
import type { AIConfig, CustomProvider } from './ai-config-types';

/**
 * Discover available models for a provider
 * @param config - AI configuration
 * @returns Promise with model discovery result
 */
export async function discoverModelsForProvider(config: AIConfig) {
  try {
    // Handle different provider types
    if (config.provider === 'custom' && config.customProviders) {
      const customProvider = config.customProviders.find(p => p.id === config.provider);
      if (customProvider) {
        return await modelDiscoveryService.discoverModelsForCustomProvider(customProvider);
      }
    }

    // Built-in providers
    const providerConfig = {
      type: config.provider as any,
      apiKey: config.apiKey,
    };

    return await modelDiscoveryService.discoverModels(providerConfig);
  } catch (error) {
    console.error('Model discovery failed:', error);
    throw error;
  }
}

/**
 * Get available models for a provider type (static list for built-in providers)
 * @param providerType - Provider type
 * @param customProviders - Optional custom providers array
 * @returns Array of available model names
 */
export function getAvailableModels(providerType: string, customProviders?: CustomProvider[]): string[] {
  try {
    return providerRegistry.getAvailableModels(providerType, customProviders);
  } catch (error) {
    console.error('Failed to get available models:', error);
    // Fallback to static MODEL_OPTIONS
    return [];
  }
}

/**
 * Check if a provider type is supported
 * @param providerType - Provider type
 * @returns Boolean indicating support
 */
export function isProviderSupported(providerType: string): boolean {
  try {
    return providerRegistry.isProviderSupported(providerType);
  } catch (error) {
    console.error('Failed to check provider support:', error);
    // Fallback to basic check
    const builtInProviders = ["openai", "google", "bedrock", "openrouter"];
    return builtInProviders.includes(providerType) || providerType === 'custom';
  }
}

/**
 * Get all supported provider types
 * @returns Array of supported provider types
 */
export function getSupportedProviders(): string[] {
  try {
    return providerRegistry.getSupportedProviders();
  } catch (error) {
    console.error('Failed to get supported providers:', error);
    // Fallback to static list
    return ["openai", "google", "bedrock", "openrouter"];
  }
}

/**
 * Clear model discovery cache
 */
export function clearModelDiscoveryCache(): void {
  try {
    modelDiscoveryService.clearAllCaches();
  } catch (error) {
    console.error('Failed to clear model discovery cache:', error);
  }
}

/**
 * Get model discovery cache statistics
 * @returns Cache statistics object
 */
export function getModelDiscoveryCacheStats() {
  try {
    return modelDiscoveryService.getCacheStatistics();
  } catch (error) {
    console.error('Failed to get cache statistics:', error);
    return {};
  }
}

/**
 * Create a provider using the new registry system
 * @param config - AI configuration
 * @returns Provider instance
 */
export function createProviderFromConfig(config: AIConfig): any {
  try {
    return providerRegistry.createProvider(config);
  } catch (error) {
    console.error('Failed to create provider:', error);
    throw error;
  }
}