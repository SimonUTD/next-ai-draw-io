// {{CODE-Cycle-Integration:
//   Task_ID: [#T002]
//   Timestamp: 2025-11-12T08:40:00Z
//   Phase: D-Develop
//   Context-Analysis: "Implementing comprehensive migration engine for transitioning from AIConfig to ProviderConfig while preserving encryption."
//   Principle_Applied: "Aether-Engineering-SOLID-S, Aether-Engineering-SOLID-L"
// }}
// {{START_MODIFICATIONS}}

import type {
  ProviderConfig,
  ModelConfig,
  UserPreferences,
  ConfigurationSystem,
  LegacyAIConfig,
  LegacyCustomProvider,
  MigrationResult,
  ProviderAuthentication,
  ProviderCapabilities,
  ProviderMetadata,
  ModelMetadata,
  ModelParameters
} from './types/provider-config';

import {
  validateLegacyAIConfig,
  validateConfigurationSystem,
  validateProviderConfig,
  validateModelConfig
} from './validation-schemas';

// ============================================================================
// Migration Engine Interface
// ============================================================================

export interface IMigrationEngine {
  /**
   * Analyze existing configuration to determine migration requirements
   */
  analyzeExistingConfig(config: unknown): Promise<MigrationAnalysisResult>;

  /**
   * Migrate legacy AIConfig to new provider-based configuration
   */
  migrateToProviderConfig(config: LegacyAIConfig, options?: MigrationOptions): Promise<MigrationResult>;

  /**
   * Rollback a migration from backup
   */
  rollbackMigration(backupId: string): Promise<MigrationResult>;

  /**
   * Create backup of existing configuration
   */
  createBackup(config: any, backupId?: string): Promise<BackupResult>;

  /**
   * Restore configuration from backup
   */
  restoreFromBackup(backupId: string): Promise<MigrationResult>;

  /**
   * List available backups
   */
  listBackups(): Promise<BackupInfo[]>;

  /**
   * Validate migration result
   */
  validateMigrationResult(config: ConfigurationSystem): Promise<ValidationResult>;
}

// ============================================================================
// Migration Types and Interfaces
// ============================================================================

export interface MigrationOptions {
  /** Preserve original configuration format */
  preserveOriginal?: boolean;
  /** Create automatic backup */
  autoBackup?: boolean;
  /** Enable validation after migration */
  validateResult?: boolean;
  /** Migration timeout in milliseconds */
  timeout?: number;
  /** Dry run mode - analyze only, don't perform migration */
  dryRun?: boolean;
  /** Custom provider mappings */
  providerMappings?: Record<string, string>;
  /** Model mappings for renamed models */
  modelMappings?: Record<string, string>;
}

export interface MigrationAnalysisResult {
  /** Analysis success status */
  success: boolean;
  /** Configuration format detected */
  format: 'legacy' | 'provider-based' | 'unknown';
  /** Number of providers found */
  providerCount: number;
  /** Number of models found */
  modelCount: number;
  /** Migration complexity */
  complexity: 'simple' | 'moderate' | 'complex';
  /** Potential issues */
  warnings: string[];
  /** Migration errors */
  errors: string[];
  /** Estimated migration time in seconds */
  estimatedTime: number;
  /** Migration requirements */
  requirements: string[];
}

export interface BackupResult {
  success: boolean;
  backupId: string;
  backupPath?: string;
  timestamp: Date;
  size?: number;
  error?: string;
}

export interface BackupInfo {
  backupId: string;
  timestamp: Date;
  size: number;
  version: string;
  providerCount: number;
  modelCount: number;
}

export interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  validationDetails: {
    providersValid: number;
    providersInvalid: number;
    modelsValid: number;
    modelsInvalid: number;
    preferencesValid: boolean;
  };
}

// ============================================================================
// Migration Engine Implementation
// ============================================================================

export class MigrationEngine implements IMigrationEngine {
  private static readonly STORAGE_KEY = 'ai-config-backups';
  private static readonly MAX_BACKUPS = 10;
  private static readonly MIGRATION_VERSION = '1.0.0';

  /**
   * Analyze existing configuration to determine migration requirements
   */
  async analyzeExistingConfig(config: unknown): Promise<MigrationAnalysisResult> {
    const startTime = Date.now();

    try {
      // Try to validate as legacy config
      const legacyValidation = validateLegacyAIConfig(config);
      if (legacyValidation.success) {
        return this.analyzeLegacyConfig(legacyValidation.data!);
      }

      // Try to validate as provider-based config
      const providerValidation = validateConfigurationSystem(config);
      if (providerValidation.success) {
        return this.analyzeProviderConfig(providerValidation.data!);
      }

      // Unknown format
      return {
        success: false,
        format: 'unknown',
        providerCount: 0,
        modelCount: 0,
        complexity: 'simple',
        warnings: ['Configuration format is not recognized'],
        errors: ['Unable to determine configuration format'],
        estimatedTime: 0,
        requirements: [],
      };

    } catch (error) {
      return {
        success: false,
        format: 'unknown',
        providerCount: 0,
        modelCount: 0,
        complexity: 'simple',
        warnings: [],
        errors: [`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        estimatedTime: 0,
        requirements: [],
      };
    }
  }

  /**
   * Migrate legacy AIConfig to new provider-based configuration
   */
  async migrateToProviderConfig(
    legacyConfig: LegacyAIConfig,
    options: MigrationOptions = {}
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    let providersMigrated = 0;
    let modelsMigrated = 0;
    let backupCreated = false;

    try {
      // Validate input
      const validation = validateLegacyAIConfig(legacyConfig);
      if (!validation.success) {
        throw new Error(`Invalid legacy configuration: ${validation.errors.join(', ')}`);
      }

      // Create backup if requested
      if (options.autoBackup !== false) {
        const backupResult = await this.createBackup(legacyConfig);
        if (!backupResult.success) {
          throw new Error(`Failed to create backup: ${backupResult.error}`);
        }
        backupCreated = true;
      }

      if (options.dryRun) {
        return {
          success: true,
          providersMigrated: 1,
          modelsMigrated: 1,
          warnings: ['Dry run mode - no actual migration performed'],
          errors: [],
          migratedAt: new Date(),
          backupCreated,
          rollbackAvailable: backupCreated,
        };
      }

      // Perform migration
      const newConfig = await this.performMigration(legacyConfig, options, warnings);

      // Validate migration result if requested
      if (options.validateResult !== false) {
        const validationResult = validateConfigurationSystem(newConfig);
        if (!validationResult.success) {
          throw new Error(`Migration validation failed: ${validationResult.errors.join(', ')}`);
        }
      }

      // Count migrated items
      providersMigrated = newConfig.providers.length;
      modelsMigrated = newConfig.providers.reduce((sum, provider) => sum + provider.models.length, 0);

      return {
        success: true,
        providersMigrated,
        modelsMigrated,
        warnings,
        errors,
        migratedAt: new Date(),
        backupCreated,
        rollbackAvailable: backupCreated,
      };

    } catch (error) {
      errors.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

      return {
        success: false,
        providersMigrated,
        modelsMigrated,
        warnings,
        errors,
        migratedAt: new Date(),
        backupCreated,
        rollbackAvailable: backupCreated,
      };
    }
  }

  /**
   * Rollback a migration from backup
   */
  async rollbackMigration(backupId: string): Promise<MigrationResult> {
    try {
      const backupData = await this.getBackup(backupId);
      if (!backupData) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      // Store current config as backup before rollback
      const currentConfig = await this.getCurrentConfig();
      if (currentConfig) {
        await this.createBackup(currentConfig, `pre-rollback-${Date.now()}`);
      }

      // Restore from backup
      await this.restoreFromBackup(backupId);

      return {
        success: true,
        providersMigrated: 0,
        modelsMigrated: 0,
        warnings: ['Rollback completed successfully'],
        errors: [],
        migratedAt: new Date(),
        backupCreated: true,
        rollbackAvailable: true,
      };

    } catch (error) {
      return {
        success: false,
        providersMigrated: 0,
        modelsMigrated: 0,
        warnings: [],
        errors: [`Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        migratedAt: new Date(),
        backupCreated: false,
        rollbackAvailable: false,
      };
    }
  }

  /**
   * Create backup of existing configuration
   */
  async createBackup(config: any, backupId?: string): Promise<BackupResult> {
    try {
      const id = backupId || this.generateBackupId();
      const timestamp = new Date();
      const backupData = {
        id,
        timestamp,
        config,
        version: MigrationEngine.MIGRATION_VERSION,
      };

      // Store backup in localStorage
      const backups = await this.getAllBackups();
      backups[id] = backupData;

      // Maintain maximum backup limit
      const sortedBackups = Object.values(backups)
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      if (sortedBackups.length > MigrationEngine.MAX_BACKUPS) {
        const toDelete = sortedBackups.slice(0, sortedBackups.length - MigrationEngine.MAX_BACKUPS);
        toDelete.forEach(backup => delete backups[backup.id]);
      }

      localStorage.setItem(MigrationEngine.STORAGE_KEY, JSON.stringify(backups));

      return {
        success: true,
        backupId: id,
        timestamp,
        size: JSON.stringify(backupData).length,
      };

    } catch (error) {
      return {
        success: false,
        backupId: backupId || '',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Restore configuration from backup
   */
  async restoreFromBackup(backupId: string): Promise<MigrationResult> {
    try {
      const backup = await this.getBackup(backupId);
      if (!backup) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      // Store the restored configuration
      if (backup.config.providers) {
        // New format
        await this.storeProviderConfig(backup.config);
      } else {
        // Legacy format
        await this.storeLegacyConfig(backup.config);
      }

      return {
        success: true,
        providersMigrated: 0,
        modelsMigrated: 0,
        warnings: [`Configuration restored from backup ${backupId}`],
        errors: [],
        migratedAt: new Date(),
        backupCreated: false,
        rollbackAvailable: true,
      };

    } catch (error) {
      return {
        success: false,
        providersMigrated: 0,
        modelsMigrated: 0,
        warnings: [],
        errors: [`Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        migratedAt: new Date(),
        backupCreated: false,
        rollbackAvailable: false,
      };
    }
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<BackupInfo[]> {
    try {
      const backups = await this.getAllBackups();
      return Object.values(backups).map(backup => ({
        backupId: backup.id,
        timestamp: backup.timestamp,
        size: JSON.stringify(backup).length,
        version: backup.version,
        providerCount: backup.config.providers?.length || (backup.config.customProviders?.length || 0) + 1,
        modelCount: this.countModels(backup.config),
      }));

    } catch (error) {
      console.error('Failed to list backups:', error);
      return [];
    }
  }

  /**
   * Validate migration result
   */
  async validateMigrationResult(config: ConfigurationSystem): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let providersValid = 0;
    let providersInvalid = 0;
    let modelsValid = 0;
    let modelsInvalid = 0;

    try {
      // Validate overall structure
      const systemValidation = validateConfigurationSystem(config);
      if (!systemValidation.success) {
        errors.push(...systemValidation.errors);
        return {
          success: false,
          errors,
          warnings,
          validationDetails: {
            providersValid: 0,
            providersInvalid: 0,
            modelsValid: 0,
            modelsInvalid: 0,
            preferencesValid: false,
          },
        };
      }

      // Validate each provider
      for (const provider of config.providers) {
        const providerValidation = validateProviderConfig(provider);
        if (providerValidation.success) {
          providersValid++;

          // Validate each model
          for (const model of provider.models) {
            const modelValidation = validateModelConfig(model);
            if (modelValidation.success) {
              modelsValid++;
            } else {
              modelsInvalid++;
              errors.push(`Model ${model.id} validation failed: ${modelValidation.errors.join(', ')}`);
            }
          }
        } else {
          providersInvalid++;
          errors.push(`Provider ${provider.id} validation failed: ${providerValidation.errors.join(', ')}`);
        }
      }

      // Check for consistency
      const defaultProviderExists = config.providers.some(p => p.id === config.userPreferences.defaultProviderId);
      if (!defaultProviderExists) {
        errors.push('Default provider ID does not exist in providers list');
      }

      const defaultModelExists = config.providers.some(p =>
        p.models.some(m => m.id === config.userPreferences.defaultModelId)
      );
      if (!defaultModelExists) {
        errors.push('Default model ID does not exist in any provider');
      }

      return {
        success: errors.length === 0,
        errors,
        warnings,
        validationDetails: {
          providersValid,
          providersInvalid,
          modelsValid,
          modelsInvalid,
          preferencesValid: true,
        },
      };

    } catch (error) {
      errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        errors,
        warnings,
        validationDetails: {
          providersValid: 0,
          providersInvalid: 0,
          modelsValid: 0,
          modelsInvalid: 0,
          preferencesValid: false,
        },
      };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async analyzeLegacyConfig(config: LegacyAIConfig): Promise<MigrationAnalysisResult> {
    const warnings: string[] = [];
    const errors: string[] = [];
    let providerCount = 1; // Main provider
    let modelCount = 1;    // Main model

    // Count custom providers and models
    if (config.customProviders) {
      providerCount += config.customProviders.length;
      modelCount += config.customProviders.reduce((sum, provider) => sum + provider.models.length, 0);
    }

    // Analyze complexity
    let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
    if (config.customProviders && config.customProviders.length > 3) {
      complexity = 'complex';
    } else if (config.customProviders || config.parameters) {
      complexity = 'moderate';
    }

    // Generate warnings
    if (!config.apiKey && !config.customProviders?.some(cp => cp.apiKey)) {
      warnings.push('No API keys found in configuration');
    }

    if (config.parameters && config.parameters.temperature && config.parameters.temperature < 0) {
      warnings.push('Invalid temperature parameter detected');
    }

    return {
      success: true,
      format: 'legacy',
      providerCount,
      modelCount,
      complexity,
      warnings,
      errors,
      estimatedTime: this.calculateEstimatedTime(complexity, providerCount, modelCount),
      requirements: this.generateMigrationRequirements(config),
    };
  }

  private async analyzeProviderConfig(config: ConfigurationSystem): Promise<MigrationAnalysisResult> {
    const warnings: string[] = [];
    const errors: string[] = [];
    const providerCount = config.providers.length;
    const modelCount = config.providers.reduce((sum, provider) => sum + provider.models.length, 0);

    // Analyze complexity
    let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
    if (providerCount > 5 || modelCount > 20) {
      complexity = 'complex';
    } else if (providerCount > 1 || modelCount > 1) {
      complexity = 'moderate';
    }

    // Generate warnings
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
      providerCount,
      modelCount,
      complexity,
      warnings,
      errors,
      estimatedTime: 0, // No migration needed
      requirements: [],
    };
  }

  private async performMigration(
    legacyConfig: LegacyAIConfig,
    options: MigrationOptions,
    warnings: string[]
  ): Promise<ConfigurationSystem> {
    const providers: ProviderConfig[] = [];
    const now = new Date();

    // Create main provider
    const mainProvider = await this.createProviderFromLegacy(legacyConfig, now, options, warnings);
    providers.push(mainProvider);

    // Create custom providers
    if (legacyConfig.customProviders) {
      for (const customProvider of legacyConfig.customProviders) {
        const provider = await this.createCustomProviderFromLegacy(customProvider, now, warnings);
        providers.push(provider);
      }
    }

    // Create user preferences
    const userPreferences: UserPreferences = {
      defaultProviderId: mainProvider.id,
      defaultModelId: mainProvider.models[0]?.id || `${mainProvider.id}-default`,
      autoSwitch: false,
      fallbackEnabled: false,
      maxRetries: 3,
      timeout: 30000,
      preferStreaming: true,
      language: 'en',
      theme: 'auto',
      notifications: {
        providerErrors: true,
        modelSwitches: true,
        testResults: false,
      },
      performance: {
        maxConcurrentRequests: 3,
        requestQueueing: true,
        cacheResponses: true,
      },
    };

    return {
      providers,
      userPreferences,
      version: MigrationEngine.MIGRATION_VERSION,
      lastMigrated: now,
      metadata: {
        createdAt: now,
        updatedAt: now,
        exportSource: 'migration-engine',
      },
    };
  }

  private async createProviderFromLegacy(
    legacyConfig: LegacyAIConfig,
    now: Date,
    options: MigrationOptions,
    warnings: string[]
  ): Promise<ProviderConfig> {
    const providerId = this.mapProviderId(legacyConfig.provider, options.providerMappings);
    const providerName = this.getProviderDisplayName(legacyConfig.provider);

    // Determine provider type
    let providerType: ProviderConfig['type'] = 'custom';
    if (['openai', 'google', 'bedrock', 'openrouter'].includes(legacyConfig.provider)) {
      providerType = legacyConfig.provider as any;
    }

    // Create authentication
    const authentication: ProviderAuthentication = {
      apiKey: legacyConfig.apiKey,
    };

    // Add provider-specific authentication
    if (providerType === 'bedrock') {
      authentication.region = 'us-east-1'; // Default region
    }

    // Create model
    const model = await this.createModelFromLegacy(
      legacyConfig.model,
      providerId,
      legacyConfig.parameters,
      options.modelMappings,
      warnings
    );

    // Create capabilities
    const capabilities = this.getProviderCapabilities(providerType);

    // Create metadata
    const metadata: ProviderMetadata = {
      testStatus: 'untested',
      errorCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    return {
      id: providerId,
      name: providerName,
      type: providerType,
      enabled: true,
      authentication,
      models: [model],
      capabilities,
      metadata,
      priority: 1,
      description: `Migrated from legacy configuration`,
    };
  }

  private async createCustomProviderFromLegacy(
    legacyCustom: LegacyCustomProvider,
    now: Date,
    warnings: string[]
  ): Promise<ProviderConfig> {
    // Create model for each legacy custom provider model
    const models: ModelConfig[] = legacyCustom.models.map((modelName, index) =>
      this.createModelFromLegacy(
        modelName,
        legacyCustom.id,
        undefined,
        undefined,
        warnings,
        index === 0 // First model is default
      )
    );

    // Create authentication
    const authentication: ProviderAuthentication = {
      apiKey: legacyCustom.apiKey,
      baseUrl: legacyCustom.baseURL,
    };

    // Create capabilities for custom provider
    const capabilities: ProviderCapabilities = {
      streaming: true,
      tools: true,
      images: false,
      reasoning: false,
      modelDiscovery: !legacyCustom.customEndpoint,
      configurationTesting: true,
    };

    // Create metadata
    const metadata: ProviderMetadata = {
      testStatus: 'untested',
      errorCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    return {
      id: legacyCustom.id,
      name: legacyCustom.name,
      type: 'custom',
      enabled: true,
      authentication,
      models,
      capabilities,
      metadata,
      priority: 10, // Lower priority for custom providers
      description: `Migrated custom provider: ${legacyCustom.type}`,
    };
  }

  private createModelFromLegacy(
    modelName: string,
    providerId: string,
    legacyParameters?: { temperature?: number; maxTokens?: number; topP?: number },
    modelMappings?: Record<string, string>,
    warnings: string[] = [],
    isDefault: boolean = true
  ): ModelConfig {
    // Map model name if mapping provided
    const mappedName = modelMappings?.[modelName] || modelName;
    if (mappedName !== modelName) {
      warnings.push(`Model '${modelName}' mapped to '${mappedName}'`);
    }

    // Create parameters
    const parameters: ModelParameters = {
      temperature: legacyParameters?.temperature || 0.7,
      maxTokens: legacyParameters?.maxTokens,
      topP: legacyParameters?.topP,
    };

    // Create metadata
    const metadata: ModelMetadata = {
      capabilities: ['text-generation'],
    };

    return {
      id: `${providerId}-${mappedName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: mappedName,
      providerId,
      enabled: true,
      parameters,
      metadata,
      isDefault,
    };
  }

  private mapProviderId(provider: string, mappings?: Record<string, string>): string {
    if (mappings && mappings[provider]) {
      return mappings[provider];
    }
    return provider.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }

  private getProviderDisplayName(provider: string): string {
    const displayNames: Record<string, string> = {
      openai: 'OpenAI',
      google: 'Google AI',
      // bedrock: 'AWS Bedrock',
      openrouter: 'OpenRouter',
    };
    return displayNames[provider] || provider;
  }

  private getProviderCapabilities(providerType: ProviderConfig['type']): ProviderCapabilities {
    const capabilities: Record<ProviderConfig['type'], ProviderCapabilities> = {
      openai: {
        streaming: true,
        tools: true,
        images: true,
        reasoning: true,
        modelDiscovery: false,
        configurationTesting: true,
      },
      google: {
        streaming: true,
        tools: true,
        images: true,
        reasoning: true,
        modelDiscovery: false,
        configurationTesting: true,
      },
      bedrock: {
        streaming: true,
        tools: true,
        images: false,
        reasoning: true,
        modelDiscovery: false,
        configurationTesting: true,
      },
      openrouter: {
        streaming: true,
        tools: true,
        images: false,
        reasoning: true,
        modelDiscovery: false,
        configurationTesting: true,
      },
      custom: {
        streaming: true,
        tools: false,
        images: false,
        reasoning: false,
        modelDiscovery: true,
        configurationTesting: true,
      },
    };

    return capabilities[providerType];
  }

  private calculateEstimatedTime(
    complexity: 'simple' | 'moderate' | 'complex',
    providerCount: number,
    modelCount: number
  ): number {
    const baseTime = 5; // Base time in seconds
    const complexityMultiplier = complexity === 'simple' ? 1 : complexity === 'moderate' ? 2 : 4;
    return Math.ceil(baseTime * complexityMultiplier * (1 + providerCount * 0.5 + modelCount * 0.1));
  }

  private generateMigrationRequirements(config: LegacyAIConfig): string[] {
    const requirements: string[] = [
      'Valid API keys for all providers',
      'Network connectivity for provider testing',
      'Sufficient storage for configuration backup',
    ];

    if (config.customProviders && config.customProviders.length > 0) {
      requirements.push('HTTPS endpoints for all custom providers');
    }

    if (config.parameters) {
      requirements.push('Valid parameter ranges for all models');
    }

    return requirements;
  }

  private generateBackupId(): string {
    return `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getAllBackups(): Promise<Record<string, any>> {
    try {
      const backupsJson = localStorage.getItem(MigrationEngine.STORAGE_KEY);
      return backupsJson ? JSON.parse(backupsJson) : {};
    } catch {
      return {};
    }
  }

  private async getBackup(backupId: string): Promise<any> {
    try {
      const backups = await this.getAllBackups();
      return backups[backupId] || null;
    } catch {
      return null;
    }
  }

  private async getCurrentConfig(): Promise<any> {
    try {
      // Try to get provider config first
      const providerConfig = localStorage.getItem('ai-provider-config');
      if (providerConfig) {
        return JSON.parse(providerConfig);
      }

      // Try legacy config
      const legacyConfig = localStorage.getItem('ai-config');
      if (legacyConfig) {
        return JSON.parse(legacyConfig);
      }

      return null;
    } catch {
      return null;
    }
  }

  private countModels(config: any): number {
    if (config.providers) {
      // New format
      return config.providers.reduce((sum: number, provider: any) => sum + provider.models.length, 0);
    } else if (config.customProviders) {
      // Legacy format
      return config.customProviders.reduce((sum: number, provider: any) => sum + provider.models.length, 0) + 1;
    }
    return 1; // Single model in legacy format
  }

  private async storeProviderConfig(config: ConfigurationSystem): Promise<void> {
    localStorage.setItem('ai-provider-config', JSON.stringify(config));
  }

  private async storeLegacyConfig(config: LegacyAIConfig): Promise<void> {
    localStorage.setItem('ai-config', JSON.stringify(config));
  }
}

// ============================================================================
// Default Export
// ============================================================================

export const migrationEngine = new MigrationEngine();

// {{END_MODIFICATIONS}}