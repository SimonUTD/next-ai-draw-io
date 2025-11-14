// {{CODE-Cycle-Integration:
//   Task_ID: [#IMPL-003]
//   Timestamp: 2025-01-12T00:00:00Z
//   Phase: D-Develop
//   Context-Analysis: "Creating separated storage layer based on analysis requirements. Implementing provider and model storage with enhanced organization."
//   Principle_Applied: "Aether-Engineering-SOLID-S, Aether-Data-Organization"
// }}
// {{START_MODIFICATIONS}}

/**
 * Enhanced Storage Manager
 *
 * Provides separated storage for providers and models with enhanced organization,
 * validation, and performance optimization.
 *
 * Features:
 * - Separated provider and model storage
 * - CRUD operations with validation
 * - Performance optimization for large configuration sets
 * - Storage consistency checks
 * - Integration with encryption and versioning services
 */

import { EncryptionService } from './encryption-service';
import { ConfigurationVersioning } from './config-versioning';

// Re-export types from provider-config.ts for compatibility
export interface ProviderConfig {
  id: string;
  name: string;
  type: 'openai' | 'google' | 'bedrock' | 'openrouter' | 'custom';
  enabled: boolean;
  authentication: {
    apiKey?: string; // Encrypted
    baseUrl?: string;
    channel?: string;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
  models: ModelConfig[];
  capabilities: {
    streaming: boolean;
    tools: boolean;
    images: boolean;
    reasoning: boolean;
  };
  metadata: {
    lastTested?: Date;
    testStatus: 'success' | 'failure' | 'pending' | 'untested';
    errorCount: number;
    lastError?: string;
  };
}

export interface ModelConfig {
  id: string;
  name: string;
  providerId: string;
  enabled: boolean;
  parameters: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
  metadata: {
    contextWindow?: number;
    inputCost?: number;
    outputCost?: number;
    capabilities: string[];
  };
}

export interface UserPreferences {
  defaultProviderId: string;
  defaultModelId: string;
  autoSwitch: boolean;
  fallbackEnabled: boolean;
  fallbackProviderId?: string;
  fallbackModelId?: string;
}

export interface StorageStats {
  totalProviders: number;
  totalModels: number;
  enabledProviders: number;
  enabledModels: number;
  storageSize: number;
  lastModified: Date;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Base Storage Class with common functionality
 */
abstract class BaseStorage<T> {
  protected abstract readonly storageKey: string;
  protected abstract readonly itemType: string;

  protected loadData(): T[] {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return [];

      const data = JSON.parse(stored);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error(`Failed to load ${this.itemType} data:`, error);
      return [];
    }
  }

  protected saveData(data: T[]): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error(`Failed to save ${this.itemType} data:`, error);
      throw new Error(`${this.itemType} storage save failed`);
    }
  }

  protected abstract validateItem(item: T): ValidationResult;

  protected abstract getId(item: T): string;
}

/**
 * Provider Storage Manager
 */
export class ProviderStorage extends BaseStorage<ProviderConfig> {
  protected readonly storageKey = 'ai_providers';
  protected readonly itemType = 'provider';

  /**
   * Create or update a provider
   */
  async saveProvider(provider: ProviderConfig): Promise<void> {
    const validation = this.validateProvider(provider);
    if (!validation.isValid) {
      throw new Error(`Invalid provider configuration: ${validation.errors.join(', ')}`);
    }

    const providers = this.loadData();
    const existingIndex = providers.findIndex(p => p.id === provider.id);

    // Encrypt sensitive authentication data
    const providerToStore = await this.encryptProviderData(provider);

    if (existingIndex >= 0) {
      providers[existingIndex] = providerToStore;
    } else {
      providers.push(providerToStore);
    }

    this.saveData(providers);
    console.info(`Provider ${provider.name} saved successfully`);
  }

  /**
   * Get a provider by ID
   */
  async getProvider(id: string): Promise<ProviderConfig | null> {
    const providers = this.loadData();
    const provider = providers.find(p => p.id === id);

    if (!provider) return null;

    // Decrypt sensitive authentication data
    return await this.decryptProviderData(provider);
  }

  /**
   * Get all providers
   */
  async getAllProviders(): Promise<ProviderConfig[]> {
    const providers = this.loadData();
    const decryptedProviders = await Promise.all(
      providers.map(provider => this.decryptProviderData(provider))
    );
    return decryptedProviders;
  }

  /**
   * Get enabled providers only
   */
  async getEnabledProviders(): Promise<ProviderConfig[]> {
    const allProviders = await this.getAllProviders();
    return allProviders.filter(provider => provider.enabled);
  }

  /**
   * Delete a provider
   */
  deleteProvider(id: string): boolean {
    const providers = this.loadData();
    const filteredProviders = providers.filter(p => p.id !== id);

    if (filteredProviders.length === providers.length) {
      return false; // Provider not found
    }

    this.saveData(filteredProviders);
    console.info(`Provider ${id} deleted successfully`);
    return true;
  }

  /**
   * Get providers by type
   */
  async getProvidersByType(type: string): Promise<ProviderConfig[]> {
    const allProviders = await this.getAllProviders();
    return allProviders.filter(provider => provider.type === type);
  }

  /**
   * Update provider test status
   */
  async updateTestStatus(id: string, status: 'success' | 'failure' | 'pending', error?: string): Promise<void> {
    const providers = this.loadData();
    const providerIndex = providers.findIndex(p => p.id === id);

    if (providerIndex === -1) {
      throw new Error(`Provider ${id} not found`);
    }

    providers[providerIndex].metadata.testStatus = status;
    providers[providerIndex].metadata.lastTested = new Date();

    if (status === 'failure') {
      providers[providerIndex].metadata.errorCount++;
      providers[providerIndex].metadata.lastError = error;
    } else if (status === 'success') {
      providers[providerIndex].metadata.errorCount = 0;
      providers[providerIndex].metadata.lastError = undefined;
    }

    this.saveData(providers);
  }

  /**
   * Validate provider configuration
   */
  validateProvider(provider: ProviderConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!provider.id || provider.id.trim() === '') {
      errors.push('Provider ID is required');
    }
    if (!provider.name || provider.name.trim() === '') {
      errors.push('Provider name is required');
    }
    if (!provider.type) {
      errors.push('Provider type is required');
    }

    // ID format validation
    if (provider.id && !/^[a-zA-Z0-9_-]+$/.test(provider.id)) {
      errors.push('Provider ID must contain only alphanumeric characters, hyphens, and underscores');
    }

    // Authentication validation based on type
    if (provider.type === 'custom') {
      if (!provider.authentication.baseUrl) {
        errors.push('Base URL is required for custom providers');
      } else if (!this.isValidUrl(provider.authentication.baseUrl)) {
        errors.push('Base URL must be a valid HTTPS URL');
      }
    }

    // HTTPS validation for base URLs
    if (provider.authentication.baseUrl && !provider.authentication.baseUrl.startsWith('https://')) {
      warnings.push('Base URL should use HTTPS for security');
    }

    // Capabilities validation
    if (typeof provider.capabilities.streaming !== 'boolean') {
      warnings.push('Streaming capability should be explicitly set');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get storage statistics
   */
  getStats(): StorageStats {
    const providers = this.loadData();
    const enabledProviders = providers.filter(p => p.enabled);
    const storageSize = JSON.stringify(providers).length;

    return {
      totalProviders: providers.length,
      totalModels: providers.reduce((sum, p) => sum + (p.models?.length || 0), 0),
      enabledProviders: enabledProviders.length,
      enabledModels: enabledProviders.reduce((sum, p) => sum + (p.models?.filter(m => m.enabled).length || 0), 0),
      storageSize,
      lastModified: new Date()
    };
  }

  // Private helper methods

  protected validateItem(item: ProviderConfig): ValidationResult {
    return this.validateProvider(item);
  }

  protected getId(item: ProviderConfig): string {
    return item.id;
  }

  private async encryptProviderData(provider: ProviderConfig): Promise<ProviderConfig> {
    const encryptedProvider = { ...provider };

    // Encrypt sensitive authentication fields
    if (provider.authentication.apiKey) {
      encryptedProvider.authentication.apiKey = await EncryptionService.encrypt(provider.authentication.apiKey);
    }
    if (provider.authentication.secretAccessKey) {
      encryptedProvider.authentication.secretAccessKey = await EncryptionService.encrypt(provider.authentication.secretAccessKey);
    }
    if (provider.authentication.accessKeyId) {
      encryptedProvider.authentication.accessKeyId = await EncryptionService.encrypt(provider.authentication.accessKeyId);
    }

    return encryptedProvider;
  }

  private async decryptProviderData(provider: ProviderConfig): Promise<ProviderConfig> {
    const decryptedProvider = { ...provider };

    // Decrypt sensitive authentication fields
    if (provider.authentication.apiKey) {
      try {
        decryptedProvider.authentication.apiKey = await EncryptionService.decrypt(provider.authentication.apiKey);
      } catch (error) {
        console.error(`Failed to decrypt API key for provider ${provider.name}:`, error);
        decryptedProvider.authentication.apiKey = undefined;
      }
    }
    if (provider.authentication.secretAccessKey) {
      try {
        decryptedProvider.authentication.secretAccessKey = await EncryptionService.decrypt(provider.authentication.secretAccessKey);
      } catch (error) {
        console.error(`Failed to decrypt secret access key for provider ${provider.name}:`, error);
        decryptedProvider.authentication.secretAccessKey = undefined;
      }
    }
    if (provider.authentication.accessKeyId) {
      try {
        decryptedProvider.authentication.accessKeyId = await EncryptionService.decrypt(provider.authentication.accessKeyId);
      } catch (error) {
        console.error(`Failed to decrypt access key ID for provider ${provider.name}:`, error);
        decryptedProvider.authentication.accessKeyId = undefined;
      }
    }

    return decryptedProvider;
  }

  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }
}

/**
 * Model Storage Manager
 */
export class ModelStorage extends BaseStorage<ModelConfig> {
  protected readonly storageKey = 'ai_models';
  protected readonly itemType = 'model';

  /**
   * Create or update a model
   */
  saveModel(model: ModelConfig): void {
    const validation = this.validateModel(model);
    if (!validation.isValid) {
      throw new Error(`Invalid model configuration: ${validation.errors.join(', ')}`);
    }

    const models = this.loadData();
    const existingIndex = models.findIndex(m => m.id === model.id);

    if (existingIndex >= 0) {
      models[existingIndex] = model;
    } else {
      models.push(model);
    }

    this.saveData(models);
    console.info(`Model ${model.name} saved successfully`);
  }

  /**
   * Get a model by ID
   */
  getModel(id: string): ModelConfig | null {
    const models = this.loadData();
    return models.find(m => m.id === id) || null;
  }

  /**
   * Get all models
   */
  getAllModels(): ModelConfig[] {
    return this.loadData();
  }

  /**
   * Get models by provider ID
   */
  getModelsByProvider(providerId: string): ModelConfig[] {
    const models = this.loadData();
    return models.filter(model => model.providerId === providerId);
  }

  /**
   * Get enabled models only
   */
  getEnabledModels(): ModelConfig[] {
    const models = this.loadData();
    return models.filter(model => model.enabled);
  }

  /**
   * Delete a model
   */
  deleteModel(id: string): boolean {
    const models = this.loadData();
    const filteredModels = models.filter(m => m.id !== id);

    if (filteredModels.length === models.length) {
      return false; // Model not found
    }

    this.saveData(filteredModels);
    console.info(`Model ${id} deleted successfully`);
    return true;
  }

  /**
   * Delete models by provider ID
   */
  deleteModelsByProvider(providerId: string): number {
    const models = this.loadData();
    const filteredModels = models.filter(m => m.providerId !== providerId);
    const deletedCount = models.length - filteredModels.length;

    if (deletedCount > 0) {
      this.saveData(filteredModels);
      console.info(`Deleted ${deletedCount} models for provider ${providerId}`);
    }

    return deletedCount;
  }

  /**
   * Validate model configuration
   */
  validateModel(model: ModelConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!model.id || model.id.trim() === '') {
      errors.push('Model ID is required');
    }
    if (!model.name || model.name.trim() === '') {
      errors.push('Model name is required');
    }
    if (!model.providerId || model.providerId.trim() === '') {
      errors.push('Provider ID is required');
    }

    // Parameter validation
    if (model.parameters.temperature !== undefined) {
      if (model.parameters.temperature < 0 || model.parameters.temperature > 2) {
        errors.push('Temperature must be between 0 and 2');
      }
    }

    if (model.parameters.maxTokens !== undefined) {
      if (model.parameters.maxTokens <= 0) {
        errors.push('Max tokens must be greater than 0');
      }
      if (model.parameters.maxTokens > 1000000) {
        warnings.push('Very high max token limit may cause performance issues');
      }
    }

    if (model.parameters.topP !== undefined) {
      if (model.parameters.topP < 0 || model.parameters.topP > 1) {
        errors.push('Top P must be between 0 and 1');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Private helper methods

  protected validateItem(item: ModelConfig): ValidationResult {
    return this.validateModel(item);
  }

  protected getId(item: ModelConfig): string {
    return item.id;
  }
}

/**
 * User Preferences Storage Manager
 */
export class UserPreferencesStorage {
  private static readonly STORAGE_KEY = 'ai_user_preferences';

  /**
   * Save user preferences
   */
  savePreferences(preferences: UserPreferences): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(UserPreferencesStorage.STORAGE_KEY, JSON.stringify(preferences));
      console.info('User preferences saved successfully');
    } catch (error) {
      console.error('Failed to save user preferences:', error);
      throw new Error('User preferences save failed');
    }
  }

  /**
   * Get user preferences
   */
  getPreferences(): UserPreferences {
    if (typeof window === 'undefined') {
      return this.getDefaultPreferences();
    }

    try {
      const stored = localStorage.getItem(UserPreferencesStorage.STORAGE_KEY);
      if (!stored) {
        return this.getDefaultPreferences();
      }

      return { ...this.getDefaultPreferences(), ...JSON.parse(stored) };
    } catch (error) {
      console.error('Failed to load user preferences:', error);
      return this.getDefaultPreferences();
    }
  }

  /**
   * Reset preferences to defaults
   */
  resetPreferences(): void {
    this.savePreferences(this.getDefaultPreferences());
    console.info('User preferences reset to defaults');
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      defaultProviderId: 'bedrock',
      defaultModelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
      autoSwitch: false,
      fallbackEnabled: false
    };
  }
}

/**
 * Unified Storage Manager
 */
export class StorageManager {
  private static providerStorage = new ProviderStorage();
  private static modelStorage = new ModelStorage();
  private static preferencesStorage = new UserPreferencesStorage();

  /**
   * Get all storage managers
   */
  static get providers() {
    return this.providerStorage;
  }

  static get models() {
    return this.modelStorage;
  }

  static get preferences() {
    return this.preferencesStorage;
  }

  /**
   * Perform consistency check across all storage
   */
  static async performConsistencyCheck(): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      const providers = await this.providers.getAllProviders();
      const models = this.models.getAllModels();

      // Check for orphaned models (models without providers)
      const providerIds = new Set(providers.map(p => p.id));
      const orphanedModels = models.filter(m => !providerIds.has(m.providerId));

      if (orphanedModels.length > 0) {
        issues.push(`Found ${orphanedModels.length} orphaned models without corresponding providers`);
      }

      // Check for duplicate IDs
      const modelIds = models.map(m => m.id);
      const duplicateModelIds = modelIds.filter((id, index) => modelIds.indexOf(id) !== index);

      if (duplicateModelIds.length > 0) {
        issues.push(`Found duplicate model IDs: ${[...new Set(duplicateModelIds)].join(', ')}`);
      }

      // Check preferences validity
      const preferences = this.preferences.getPreferences();
      const defaultProviderExists = providerIds.has(preferences.defaultProviderId);

      if (!defaultProviderExists) {
        issues.push(`Default provider ${preferences.defaultProviderId} does not exist`);
      }

      if (preferences.fallbackEnabled && preferences.fallbackProviderId) {
        const fallbackProviderExists = providerIds.has(preferences.fallbackProviderId);
        if (!fallbackProviderExists) {
          issues.push(`Fallback provider ${preferences.fallbackProviderId} does not exist`);
        }
      }

      // Validate models exist for preferences
      const allModelIds = new Set(modelIds);
      if (!allModelIds.has(preferences.defaultModelId)) {
        issues.push(`Default model ${preferences.defaultModelId} does not exist`);
      }

      if (preferences.fallbackEnabled && preferences.fallbackModelId) {
        if (!allModelIds.has(preferences.fallbackModelId)) {
          issues.push(`Fallback model ${preferences.fallbackModelId} does not exist`);
        }
      }

    } catch (error) {
      issues.push(`Consistency check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Get comprehensive storage statistics
   */
  static async getComprehensiveStats(): Promise<StorageStats & { consistencyIssues: string[] }> {
    const providerStats = this.providers.getStats();
    const consistencyCheck = await this.performConsistencyCheck();

    return {
      ...providerStats,
      consistencyIssues: consistencyCheck.issues
    };
  }

  /**
   * Clear all storage data (for testing/reset purposes)
   */
  clearAllData(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.removeItem('ai_providers');
      localStorage.removeItem('ai_models');
      localStorage.removeItem('ai_user_preferences');
      console.info('All storage data cleared');
    } catch (error) {
      console.error('Failed to clear storage data:', error);
      throw new Error('Storage data clear failed');
    }
  }
}

// {{END_MODIFICATIONS}}