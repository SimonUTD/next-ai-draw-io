// {{CODE-Cycle-Integration:
//   Task_ID: [#T002]
//   Timestamp: 2025-11-12T08:45:00Z
//   Phase: D-Develop
//   Context-Analysis: "Implementing backward compatibility layer to handle both legacy AIConfig and new ProviderConfig formats seamlessly."
//   Principle_Applied: "Aether-Engineering-SOLID-I, Aether-Engineering-DRY"
// }}
// {{START_MODIFICATIONS}}

import type {
  ProviderConfig,
  ModelConfig,
  UserPreferences,
  ConfigurationSystem,
  LegacyAIConfig,
  LegacyCustomProvider,
} from './types/provider-config';

import {
  validateLegacyAIConfig,
  validateConfigurationSystem,
} from './validation-schemas';

import { migrationEngine } from './migration-engine';

// ============================================================================
// Configuration Reader Interface
// ============================================================================

export interface IConfigReader {
  /**
   * Detect configuration format from raw data
   */
  detectFormat(data: unknown): ConfigFormat;

  /**
   * Read configuration and normalize to provider-based format
   */
  readConfig(data: unknown): Promise<ConfigReadResult>;

  /**
   * Convert between configuration formats
   */
  convertFormat(
    data: unknown,
    targetFormat: ConfigFormat,
    options?: ConversionOptions
  ): Promise<ConversionResult>;

  /**
   * Validate configuration format compatibility
   */
  validateCompatibility(format: ConfigFormat): CompatibilityResult;

  /**
   * Load configuration from localStorage with format detection
   */
  loadFromStorage(): Promise<ConfigReadResult>;

  /**
   * Save configuration to localStorage with format preservation
   */
  saveToStorage(
    config: ConfigurationSystem | LegacyAIConfig,
    format?: ConfigFormat
  ): Promise<{ success: boolean; error?: string }>;
}

// ============================================================================
// Types and Enums
// ============================================================================

export type ConfigFormat = 'legacy' | 'provider-based' | 'unknown';

export interface ConfigReadResult {
  success: boolean;
  format: ConfigFormat;
  config?: ConfigurationSystem | LegacyAIConfig;
  warnings: string[];
  errors: string[];
  migrationRequired: boolean;
  migrationAvailable: boolean;
}

export interface ConversionOptions {
  preserveOriginal?: boolean;
  createBackup?: boolean;
  validateResult?: boolean;
  migrationOptions?: any;
}

export interface ConversionResult {
  success: boolean;
  data?: any;
  fromFormat: ConfigFormat;
  toFormat: ConfigFormat;
  warnings: string[];
  errors: string[];
  migrationPerformed?: boolean;
}

export interface CompatibilityResult {
  compatible: boolean;
  version?: string;
  features: string[];
  limitations: string[];
  migrationRequired: boolean;
  migrationPath?: string[];
}

// ============================================================================
// Configuration Format Detector
// ============================================================================

export class ConfigFormatDetector {
  /**
   * Detect configuration format from raw data
   */
  static detectFormat(data: unknown): ConfigFormat {
    if (!data || typeof data !== 'object') {
      return 'unknown';
    }

    const obj = data as any;

    // Check for provider-based format
    if (
      obj.providers &&
      Array.isArray(obj.providers) &&
      obj.userPreferences &&
      obj.version
    ) {
      // Validate structure to be sure
      const validation = validateConfigurationSystem(obj);
      if (validation.success) {
        return 'provider-based';
      }
    }

    // Check for legacy format
    if (
      obj.provider &&
      obj.model &&
      typeof obj.provider === 'string' &&
      typeof obj.model === 'string'
    ) {
      // Validate structure to be sure
      const validation = validateLegacyAIConfig(obj);
      if (validation.success) {
        return 'legacy';
      }
    }

    return 'unknown';
  }

  /**
   * Get detailed format information
   */
  static getFormatInfo(format: ConfigFormat): {
    name: string;
    description: string;
    version?: string;
    features: string[];
    limitations: string[];
  } {
    const formatInfo: Record<ConfigFormat, any> = {
      legacy: {
        name: 'Legacy AIConfig',
        description: 'Model-centric configuration format',
        version: '0.x',
        features: [
          'Single provider configuration',
          'Basic model parameters',
          'Custom provider support',
          'Encrypted API key storage',
        ],
        limitations: [
          'No provider-level management',
          'API key duplication across models',
          'Limited CRUD operations',
          'No configuration testing',
          'Monolithic structure',
        ],
      },
      'provider-based': {
        name: 'Provider Configuration System',
        description: 'Provider-centric configuration with enhanced features',
        version: '1.0+',
        features: [
          'Multi-provider management',
          'Automatic model discovery',
          'Configuration testing',
          'Provider-level authentication',
          'Migration support',
          'Enhanced security',
          'Comprehensive validation',
        ],
        limitations: [
          'Requires migration from legacy format',
          'More complex structure',
        ],
      },
      unknown: {
        name: 'Unknown Format',
        description: 'Configuration format not recognized',
        features: [],
        limitations: [
          'Format not supported',
          'Requires manual inspection',
        ],
      },
    };

    return formatInfo[format];
  }
}

// ============================================================================
// Configuration Reader Implementation
// ============================================================================

export class CompatibilityLayer implements IConfigReader {
  private static readonly STORAGE_KEYS = {
    LEGACY: 'ai-config',
    PROVIDER_BASED: 'ai-provider-config',
    MIGRATION_MARKER: 'ai-config-migrated',
  } as const;

  private formatDetector = ConfigFormatDetector;

  /**
   * Detect configuration format from raw data
   */
  detectFormat(data: unknown): ConfigFormat {
    return this.formatDetector.detectFormat(data);
  }

  /**
   * Read configuration and normalize to provider-based format
   */
  async readConfig(data: unknown): Promise<ConfigReadResult> {
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Detect format
      const format = this.detectFormat(data);

      if (format === 'unknown') {
        return {
          success: false,
          format: 'unknown',
          warnings: [],
          errors: ['Unable to determine configuration format'],
          migrationRequired: false,
          migrationAvailable: false,
        };
      }

      // Read and validate configuration
      if (format === 'legacy') {
        return await this.readLegacyConfig(data as LegacyAIConfig);
      } else {
        return await this.readProviderConfig(data as ConfigurationSystem);
      }

    } catch (error) {
      errors.push(`Configuration read failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        format: 'unknown',
        warnings,
        errors,
        migrationRequired: false,
        migrationAvailable: false,
      };
    }
  }

  /**
   * Convert between configuration formats
   */
  async convertFormat(
    data: unknown,
    targetFormat: ConfigFormat,
    options: ConversionOptions = {}
  ): Promise<ConversionResult> {
    const sourceFormat = this.detectFormat(data);
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // No conversion needed
      if (sourceFormat === targetFormat) {
        return {
          success: true,
          data,
          fromFormat: sourceFormat,
          toFormat: targetFormat,
          warnings: ['No conversion needed - formats match'],
          errors: [],
        };
      }

      // Legacy to provider-based conversion
      if (sourceFormat === 'legacy' && targetFormat === 'provider-based') {
        return await this.convertLegacyToProvider(data as LegacyAIConfig, options);
      }

      // Provider-based to legacy conversion
      if (sourceFormat === 'provider-based' && targetFormat === 'legacy') {
        return await this.convertProviderToLegacy(data as ConfigurationSystem, options);
      }

      errors.push(`Conversion from ${sourceFormat} to ${targetFormat} is not supported`);
      return {
        success: false,
        fromFormat: sourceFormat,
        toFormat: targetFormat,
        warnings,
        errors,
      };

    } catch (error) {
      errors.push(`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        fromFormat: sourceFormat,
        toFormat: targetFormat,
        warnings,
        errors,
      };
    }
  }

  /**
   * Validate configuration format compatibility
   */
  validateCompatibility(format: ConfigFormat): CompatibilityResult {
    const formatInfo = this.formatDetector.getFormatInfo(format);

    if (format === 'legacy') {
      return {
        compatible: true,
        version: formatInfo.version,
        features: formatInfo.features,
        limitations: formatInfo.limitations,
        migrationRequired: true,
        migrationPath: ['analyze-legacy', 'migrate-to-provider', 'validate-result'],
      };
    }

    if (format === 'provider-based') {
      return {
        compatible: true,
        version: formatInfo.version,
        features: formatInfo.features,
        limitations: formatInfo.limitations,
        migrationRequired: false,
      };
    }

    return {
      compatible: false,
      features: [],
      limitations: ['Format not recognized'],
      migrationRequired: true,
      migrationPath: ['manual-inspection', 'format-correction'],
    };
  }

  /**
   * Load configuration from localStorage with format detection
   */
  async loadFromStorage(): Promise<ConfigReadResult> {
    try {
      // Try provider-based format first
      const providerConfigData = localStorage.getItem(CompatibilityLayer.STORAGE_KEYS.PROVIDER_BASED);
      if (providerConfigData) {
        const config = JSON.parse(providerConfigData);
        return await this.readConfig(config);
      }

      // Try legacy format
      const legacyConfigData = localStorage.getItem(CompatibilityLayer.STORAGE_KEYS.LEGACY);
      if (legacyConfigData) {
        const config = JSON.parse(legacyConfigData);
        return await this.readConfig(config);
      }

      return {
        success: false,
        format: 'unknown',
        warnings: [],
        errors: ['No configuration found in storage'],
        migrationRequired: false,
        migrationAvailable: false,
      };

    } catch (error) {
      return {
        success: false,
        format: 'unknown',
        warnings: [],
        errors: [`Storage read failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        migrationRequired: false,
        migrationAvailable: false,
      };
    }
  }

  /**
   * Save configuration to localStorage with format preservation
   */
  async saveToStorage(
    config: ConfigurationSystem | LegacyAIConfig,
    format?: ConfigFormat
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const detectedFormat = format || this.detectFormat(config);

      if (detectedFormat === 'provider-based') {
        localStorage.setItem(
          CompatibilityLayer.STORAGE_KEYS.PROVIDER_BASED,
          JSON.stringify(config)
        );
        // Clean up legacy config if exists
        localStorage.removeItem(CompatibilityLayer.STORAGE_KEYS.LEGACY);
      } else if (detectedFormat === 'legacy') {
        localStorage.setItem(
          CompatibilityLayer.STORAGE_KEYS.LEGACY,
          JSON.stringify(config)
        );
      } else {
        return {
          success: false,
          error: 'Cannot save configuration in unknown format',
        };
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async readLegacyConfig(config: LegacyAIConfig): Promise<ConfigReadResult> {
    const warnings: string[] = [];

    // Validate legacy configuration
    const validation = validateLegacyAIConfig(config);
    if (!validation.success) {
      return {
        success: false,
        format: 'legacy',
        warnings: [],
        errors: validation.errors,
        migrationRequired: true,
        migrationAvailable: true,
      };
    }

    // Add warnings for common legacy issues
    if (!config.apiKey && !config.customProviders?.some(cp => cp.apiKey)) {
      warnings.push('No API keys found in legacy configuration');
    }

    if (config.customProviders && config.customProviders.length > 0) {
      warnings.push(`Found ${config.customProviders.length} custom providers that will be migrated`);
    }

    return {
      success: true,
      format: 'legacy',
      config,
      warnings,
      errors: [],
      migrationRequired: true,
      migrationAvailable: true,
    };
  }

  private async readProviderConfig(config: ConfigurationSystem): Promise<ConfigReadResult> {
    const warnings: string[] = [];

    // Validate provider configuration
    const validation = validateConfigurationSystem(config);
    if (!validation.success) {
      return {
        success: false,
        format: 'provider-based',
        warnings: [],
        errors: validation.errors,
        migrationRequired: false,
        migrationAvailable: false,
      };
    }

    // Check for potential issues
    const enabledProviders = config.providers.filter(p => p.enabled);
    if (enabledProviders.length === 0) {
      warnings.push('No providers are enabled');
    }

    const enabledModels = config.providers.flatMap(p => p.models.filter(m => m.enabled));
    if (enabledModels.length === 0) {
      warnings.push('No models are enabled');
    }

    return {
      success: true,
      format: 'provider-based',
      config,
      warnings,
      errors: [],
      migrationRequired: false,
      migrationAvailable: false,
    };
  }

  private async convertLegacyToProvider(
    legacyConfig: LegacyAIConfig,
    options: ConversionOptions
  ): Promise<ConversionResult> {
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Create backup if requested
      if (options.createBackup) {
        await migrationEngine.createBackup(legacyConfig);
        warnings.push('Backup created before migration');
      }

      // Perform migration
      const migrationResult = await migrationEngine.migrateToProviderConfig(
        legacyConfig,
        options.migrationOptions
      );

      if (!migrationResult.success) {
        errors.push(...migrationResult.errors);
        return {
          success: false,
          fromFormat: 'legacy',
          toFormat: 'provider-based',
          warnings,
          errors,
        };
      }

      warnings.push(...migrationResult.warnings);

      // Validate result if requested
      if (options.validateResult) {
        const validationResult = await migrationEngine.validateMigrationResult(
          migrationResult as any
        );
        if (!validationResult.success) {
          errors.push(...validationResult.errors);
        }
        warnings.push(...validationResult.warnings);
      }

      return {
        success: errors.length === 0,
        data: migrationResult,
        fromFormat: 'legacy',
        toFormat: 'provider-based',
        warnings,
        errors,
        migrationPerformed: true,
      };

    } catch (error) {
      errors.push(`Migration conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        fromFormat: 'legacy',
        toFormat: 'provider-based',
        warnings,
        errors,
      };
    }
  }

  private async convertProviderToLegacy(
    providerConfig: ConfigurationSystem,
    options: ConversionOptions
  ): Promise<ConversionResult> {
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Find default provider and model
      const defaultProvider = providerConfig.providers.find(
        p => p.id === providerConfig.userPreferences.defaultProviderId
      );

      if (!defaultProvider) {
        throw new Error('Default provider not found in configuration');
      }

      const defaultModel = defaultProvider.models.find(
        m => m.id === providerConfig.userPreferences.defaultModelId
      );

      if (!defaultModel) {
        throw new Error('Default model not found in configuration');
      }

      // Convert to legacy format
      const legacyConfig: LegacyAIConfig = {
        provider: this.mapLegacyProviderType(defaultProvider.type),
        model: defaultModel.name,
        apiKey: defaultProvider.authentication.apiKey,
        parameters: {
          temperature: defaultModel.parameters.temperature,
          maxTokens: defaultModel.parameters.maxTokens,
          topP: defaultModel.parameters.topP,
        },
        customProviders: this.convertCustomProviders(providerConfig.providers, defaultProvider.id),
      };

      // Create backup if requested
      if (options.createBackup) {
        await migrationEngine.createBackup(providerConfig);
        warnings.push('Backup created before conversion');
      }

      warnings.push('Provider configuration converted to legacy format (data loss may occur)');
      warnings.push('Multiple providers and models may not be preserved in legacy format');

      return {
        success: true,
        data: legacyConfig,
        fromFormat: 'provider-based',
        toFormat: 'legacy',
        warnings,
        errors,
        migrationPerformed: true,
      };

    } catch (error) {
      errors.push(`Provider to legacy conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        fromFormat: 'provider-based',
        toFormat: 'legacy',
        warnings,
        errors,
      };
    }
  }

  private mapLegacyProviderType(providerType: string): string {
    const typeMapping: Record<string, string> = {
      openai: 'openai',
      google: 'google',
      bedrock: 'bedrock',
      openrouter: 'openrouter',
      custom: 'custom',
    };
    return typeMapping[providerType] || providerType;
  }

  private convertCustomProviders(providers: ProviderConfig[], excludeProviderId: string): LegacyCustomProvider[] {
    return providers
      .filter(p => p.id !== excludeProviderId && p.type === 'custom')
      .map(provider => ({
        id: provider.id,
        name: provider.name,
        type: 'openai-compatible' as const,
        baseURL: provider.authentication.baseUrl || '',
        models: provider.models.map(m => m.name),
        apiKey: provider.authentication.apiKey,
        customEndpoint: true,
      }));
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a unified configuration reader with backward compatibility
 */
export function createConfigReader(): IConfigReader {
  return new CompatibilityLayer();
}

/**
 * Load and auto-migrate configuration if needed
 */
export async function loadAndMigrateConfig(
  autoMigrate: boolean = true,
  migrationOptions?: any
): Promise<ConfigReadResult> {
  const reader = createConfigReader();

  // Load from storage
  const result = await reader.loadFromStorage();

  // Auto-migrate if needed and requested
  if (result.success && result.migrationRequired && autoMigrate) {
    const migrationResult = await reader.convertFormat(
      result.config!,
      'provider-based',
      {
        createBackup: true,
        validateResult: true,
        migrationOptions,
      }
    );

    if (migrationResult.success) {
      // Save migrated configuration
      await reader.saveToStorage(migrationResult.data, 'provider-based');

      return {
        ...result,
        config: migrationResult.data,
        format: 'provider-based',
        migrationRequired: false,
        migrationAvailable: false,
        warnings: [...result.warnings, ...migrationResult.warnings],
      };
    } else {
      return {
        ...result,
        errors: [...result.errors, ...migrationResult.errors],
      };
    }
  }

  return result;
}

/**
 * Check if migration is needed for stored configuration
 */
export async function isMigrationNeeded(): Promise<boolean> {
  const reader = createConfigReader();
  const result = await reader.loadFromStorage();
  return result.migrationRequired || false;
}

/**
 * Get configuration format information
 */
export function getConfigurationFormatInfo(format: ConfigFormat) {
  return ConfigFormatDetector.getFormatInfo(format);
}

// ============================================================================
// Default Export
// ============================================================================

export const compatibilityLayer = new CompatibilityLayer();

// {{END_MODIFICATIONS}}