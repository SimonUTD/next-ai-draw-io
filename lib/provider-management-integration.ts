// {{CODE-Cycle-Integration:
//   Task_ID: [IMPL-004]
//   Timestamp: 2025-11-12T11:15:00Z
//   Phase: [D-Develop]
//   Context-Analysis: "Creating integration layer between provider management components and ConfigTestingService for immediate validation feedback and test result management."
//   Principle_Applied: "Aether-Engineering-SOLID-S, Aether-Engineering-Integration-Patterns, Aether-Engineering-Test-Strategy"
// }}
// {{START_MODIFICATIONS}}

import { configTestingService, type ProviderTestResult } from "./config-testing";
import { type ProviderConfig } from "./types/provider-config";
import { EncryptionService } from "./encryption-service";

/**
 * Integration service for provider management with testing capabilities
 * Bridges the gap between provider configuration and validation testing
 */
export class ProviderManagementIntegration {
  private static instance: ProviderManagementIntegration;
  private testCache = new Map<string, { result: ProviderTestResult; timestamp: Date }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): ProviderManagementIntegration {
    if (!ProviderManagementIntegration.instance) {
      ProviderManagementIntegration.instance = new ProviderManagementIntegration();
    }
    return ProviderManagementIntegration.instance;
  }

  /**
   * Test a provider configuration with caching and error handling
   */
  async testProvider(
    provider: ProviderConfig,
    options: { forceRefresh?: boolean; timeout?: number } = {}
  ): Promise<ProviderTestResult> {
    const cacheKey = this.getCacheKey(provider);
    const cached = this.testCache.get(cacheKey);

    // Return cached result if available and not expired
    if (!options.forceRefresh && cached && this.isCacheValid(cached.timestamp)) {
      return cached.result;
    }

    try {
      // Decrypt API key if needed
      let decryptedApiKey = provider.authentication.apiKey;
      if (decryptedApiKey && EncryptionService.isAvailable()) {
        try {
          decryptedApiKey = await EncryptionService.decrypt(decryptedApiKey);
        } catch (error) {
          console.warn('Failed to decrypt API key for testing:', error);
          // Continue with encrypted key - some providers might still work
        }
      }

      // Convert provider config to test config
      const testConfig = this.convertProviderToTestConfig(provider, decryptedApiKey);

      // Set timeout if provided
      if (options.timeout) {
        testConfig.timeout = options.timeout;
      }

      // Perform the test
      const result = await configTestingService.testProvider(testConfig);

      // Cache the result
      this.testCache.set(cacheKey, { result, timestamp: new Date() });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Test failed';
      
      // Create a failure result
      const failureResult: ProviderTestResult = {
        success: false,
        providerType: provider.type,
        testType: 'comprehensive' as any,
        timestamp: new Date(),
        duration: 0,
        details: {},
        error: {
          type: 'unknown_error' as any,
          message: errorMessage,
          retryable: true,
        },
      };

      // Cache failure result for a shorter duration
      this.testCache.set(cacheKey, { result: failureResult, timestamp: new Date() });

      return failureResult;
    }
  }

  /**
   * Test multiple providers in parallel
   */
  async testMultipleProviders(
    providers: ProviderConfig[],
    options: { maxConcurrent?: number; forceRefresh?: boolean } = {}
  ): Promise<Map<string, ProviderTestResult>> {
    const maxConcurrent = options.maxConcurrent || 3;
    const results = new Map<string, ProviderTestResult>();

    // Process providers in batches
    for (let i = 0; i < providers.length; i += maxConcurrent) {
      const batch = providers.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(async (provider) => {
        const result = await this.testProvider(provider, options);
        return { providerId: provider.id, result };
      });

      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(({ providerId, result }) => {
        results.set(providerId, result);
      });
    }

    return results;
  }

  /**
   * Get cached test result for a provider
   */
  getCachedTestResult(provider: ProviderConfig): ProviderTestResult | null {
    const cacheKey = this.getCacheKey(provider);
    const cached = this.testCache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached.timestamp)) {
      return cached.result;
    }
    
    return null;
  }

  /**
   * Clear test cache for a specific provider or all providers
   */
  clearTestCache(provider?: ProviderConfig): void {
    if (provider) {
      const cacheKey = this.getCacheKey(provider);
      this.testCache.delete(cacheKey);
    } else {
      this.testCache.clear();
    }
  }

  /**
   * Get test cache statistics
   */
  getTestCacheStats(): {
    totalCached: number;
    validCache: number;
    expiredCache: number;
    cacheHitRate: number;
  } {
    const totalCached = this.testCache.size;
    let validCache = 0;
    let expiredCache = 0;

    const now = new Date();
    this.testCache.forEach(({ timestamp }) => {
      if (this.isCacheValid(timestamp)) {
        validCache++;
      } else {
        expiredCache++;
      }
    });

    return {
      totalCached,
      validCache,
      expiredCache,
      cacheHitRate: totalCached > 0 ? validCache / totalCached : 0,
    };
  }

  /**
   * Validate provider configuration before testing
   */
  validateProviderConfig(provider: ProviderConfig): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!provider.name.trim()) {
      errors.push('Provider name is required');
    }

    if (!provider.id.trim()) {
      errors.push('Provider ID is required');
    }

    // Provider-specific validation
    switch (provider.type) {
      case 'openai':
      case 'google':
      case 'openrouter':
        if (!provider.authentication.apiKey) {
          errors.push('API key is required for this provider type');
        }
        break;

      case 'bedrock':
        if (!provider.authentication.accessKeyId || !provider.authentication.secretAccessKey) {
          errors.push('AWS credentials are required for Bedrock provider');
        }
        if (!provider.authentication.region) {
          warnings.push('AWS region not specified, using default');
        }
        break;

      case 'custom':
        if (!provider.authentication.baseUrl) {
          errors.push('Base URL is required for custom providers');
        } else {
          try {
            new URL(provider.authentication.baseUrl);
            if (!provider.authentication.baseUrl.startsWith('https://')) {
              warnings.push('Base URL should use HTTPS for security');
            }
          } catch {
            errors.push('Invalid base URL format');
          }
        }
        break;
    }

    // Model validation
    if (provider.models.length === 0) {
      warnings.push('No models configured for this provider');
    } else {
      const enabledModels = provider.models.filter(m => m.enabled);
      if (enabledModels.length === 0) {
        warnings.push('No models are enabled for this provider');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get provider health summary
   */
  getProviderHealthSummary(providers: ProviderConfig[]): {
    total: number;
    healthy: number;
    unhealthy: number;
    unknown: number;
    lastTested: Date | null;
  } {
    let healthy = 0;
    let unhealthy = 0;
    let unknown = 0;
    let lastTested: Date | null = null;

    providers.forEach(provider => {
      const cachedResult = this.getCachedTestResult(provider);
      
      if (cachedResult) {
        if (cachedResult.success) {
          healthy++;
        } else {
          unhealthy++;
        }
        
        if (!lastTested || cachedResult.timestamp > lastTested) {
          lastTested = cachedResult.timestamp;
        }
      } else {
        unknown++;
      }
    });

    return {
      total: providers.length,
      healthy,
      unhealthy,
      unknown,
      lastTested,
    };
  }

  /**
   * Convert provider config to test config
   */
  private convertProviderToTestConfig(
    provider: ProviderConfig,
    decryptedApiKey?: string
  ) {
    const testConfig: any = {
      type: provider.type,
      timeout: provider.authentication.timeout || 10000,
      retries: 2,
    };

    // Add authentication
    if (decryptedApiKey) {
      testConfig.apiKey = decryptedApiKey;
    }

    if (provider.authentication.baseUrl) {
      testConfig.baseURL = provider.authentication.baseUrl;
    }

    if (provider.authentication.region) {
      testConfig.region = provider.authentication.region;
    }

    if (provider.authentication.accessKeyId) {
      testConfig.accessKeyId = provider.authentication.accessKeyId;
    }

    if (provider.authentication.secretAccessKey) {
      testConfig.secretAccessKey = provider.authentication.secretAccessKey;
    }

    // Add a model for testing
    const enabledModel = provider.models.find(m => m.enabled);
    if (enabledModel) {
      testConfig.model = enabledModel.name;
    } else if (provider.models.length > 0) {
      testConfig.model = provider.models[0].name;
    }

    return testConfig;
  }

  /**
   * Generate cache key for provider
   */
  private getCacheKey(provider: ProviderConfig): string {
    // Create a key based on provider ID and relevant config hash
    const configHash = [
      provider.id,
      provider.type,
      provider.authentication.apiKey ? 'has-key' : 'no-key',
      provider.authentication.baseUrl || '',
      provider.authentication.region || '',
      provider.authentication.accessKeyId ? 'has-aws-key' : 'no-aws-key',
    ].join('|');

    return `${provider.id}-${btoa(configHash).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16)}`;
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheValid(timestamp: Date): boolean {
    return Date.now() - timestamp.getTime() < this.CACHE_DURATION;
  }
}

// Export singleton instance
export const providerManagementIntegration = ProviderManagementIntegration.getInstance();

// {{END_MODIFICATIONS}}