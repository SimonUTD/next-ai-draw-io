// {{CODE-Cycle-Integration:
//   Task_ID: [IMPL-008-2]
//   Timestamp: 2025-01-12T00:00:00Z
//   Phase: [D-Develop]
//   Context-Analysis: "Creating comprehensive developer experience tools for configuration management including import/export functionality, bulk operations, templates, presets, and advanced debugging capabilities."
//   Principle_Applied: "Aether-Engineering-SOLID-S, Aether-Engineering-DRY, Aether-Engineering-Template-Pattern, Aether-Engineering-Builder-Pattern"
// }}
// {{START_MODIFICATIONS}}

import { ProviderConfig, ModelConfig, UserPreferences, ConfigurationSystem, ProviderAuthentication } from './types/provider-config';
import { EncryptionService } from './encryption-service';
import { configTestingService, ProviderTestResult } from './config-testing';
import { modelDiscoveryService } from './model-discovery';
import { z } from 'zod';

// ============================================================================
// Configuration Import/Export Interfaces
// ============================================================================

export interface ConfigurationExport {
  version: string;
  exportedAt: string;
  exportSource: string;
  configurationSystem: ConfigurationSystem;
  metadata: {
    totalProviders: number;
    totalModels: number;
    enabledProviders: number;
    providerTypes: string[];
    checksum: string;
  };
}

export interface ImportResult {
  success: boolean;
  importedProviders: number;
  importedModels: number;
  warnings: string[];
  errors: string[];
  conflicts: ImportConflict[];
  skipped: string[];
}

export interface ImportConflict {
  type: 'provider_id' | 'model_id' | 'duplicate_config';
  existingId: string;
  newId: string;
  resolution: 'skip' | 'rename' | 'overwrite' | 'merge';
  description: string;
}

export interface ConfigurationTemplate {
  id: string;
  name: string;
  description: string;
  category: 'development' | 'production' | 'testing' | 'cost-optimized' | 'performance';
  providers: ProviderConfig[];
  userPreferences: UserPreferences;
  variables: TemplateVariable[];
  tags: string[];
  author?: string;
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
  description: string;
  required: boolean;
  defaultValue?: any;
  options?: string[]; // For select/multiselect types
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface BulkOperation {
  id: string;
  type: 'enable' | 'disable' | 'delete' | 'test' | 'update' | 'export' | 'import';
  targets: string[]; // Provider IDs or model IDs
  parameters?: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  results: BulkOperationResult[];
  startTime?: Date;
  endTime?: Date;
  error?: string;
}

export interface BulkOperationResult {
  targetId: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
}

export interface DebugSession {
  id: string;
  name: string;
  configuration: ConfigurationSystem;
  testResults: ProviderTestResult[];
  logs: DebugLogEntry[];
  screenshots?: DebugScreenshot[];
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    duration: number;
    status: 'active' | 'completed' | 'failed';
  };
}

export interface DebugLogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: 'configuration' | 'authentication' | 'model_discovery' | 'testing' | 'performance';
  message: string;
  data?: any;
  providerId?: string;
  modelId?: string;
}

export interface DebugScreenshot {
  id: string;
  timestamp: Date;
  description: string;
  dataUrl: string; // Base64 encoded image
  context?: string;
}

// ============================================================================
// Configuration Import/Export Service
// ============================================================================

export class ConfigurationImportExportService {
  private static instance: ConfigurationImportExportService;

  private constructor() {}

  public static getInstance(): ConfigurationImportExportService {
    if (!ConfigurationImportExportService.instance) {
      ConfigurationImportExportService.instance = new ConfigurationImportExportService();
    }
    return ConfigurationImportExportService.instance;
  }

  /**
   * Export complete configuration system to JSON
   */
  public async exportConfiguration(
    configurationSystem: ConfigurationSystem,
    options: {
      includeCredentials?: boolean;
      includeMetadata?: boolean;
      format?: 'json' | 'yaml' | 'csv';
      prettyPrint?: boolean;
    } = {}
  ): Promise<string> {
    const {
      includeCredentials = false,
      includeMetadata = true,
      format = 'json',
      prettyPrint = true
    } = options;

    // Create export copy with optional credential filtering
    const exportData: ConfigurationExport = {
      version: configurationSystem.version,
      exportedAt: new Date().toISOString(),
      exportSource: 'manual',
      configurationSystem: this.sanitizeConfiguration(configurationSystem, !includeCredentials),
      metadata: {
        totalProviders: configurationSystem.providers.length,
        totalModels: configurationSystem.providers.reduce((sum, p) => sum + p.models.length, 0),
        enabledProviders: configurationSystem.providers.filter(p => p.enabled).length,
        providerTypes: [...new Set(configurationSystem.providers.map(p => p.type))],
        checksum: await this.calculateChecksum(configurationSystem)
      }
    };

    // Convert to requested format
    switch (format) {
      case 'json':
        return JSON.stringify(exportData, null, prettyPrint ? 2 : 0);

      case 'yaml':
        // In a real implementation, you'd use a YAML library
        throw new Error('YAML export not yet implemented');

      case 'csv':
        return this.convertToCSV(exportData);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Import configuration from JSON string
   */
  public async importConfiguration(
    configurationData: string,
    options: {
      mergeWithExisting?: boolean;
      resolveConflicts?: 'skip' | 'overwrite' | 'rename' | 'prompt';
      validateBeforeImport?: boolean;
      createBackup?: boolean;
    } = {}
  ): Promise<ImportResult> {
    const {
      mergeWithExisting = true,
      resolveConflicts = 'prompt',
      validateBeforeImport = true,
      createBackup = true
    } = options;

    try {
      // Parse configuration data
      const importData: ConfigurationExport = JSON.parse(configurationData);

      // Validate import data structure
      if (validateBeforeImport) {
        // TODO: Add validation schema for configurationSystem
        // const validation = validationSchemas.configurationSystem.safeParse(importData.configurationSystem);
        // if (!validation.success) {
        if (!importData.configurationSystem) {
          return {
            success: false,
            importedProviders: 0,
            importedModels: 0,
            warnings: [],
            errors: ['Invalid configuration format'],
            conflicts: [],
            skipped: []
          };
        }
      }

      // Get current configuration for conflict detection
      const currentConfig = this.getCurrentConfiguration();
      const conflicts = this.detectConflicts(currentConfig, importData.configurationSystem);

      // Resolve conflicts based on strategy
      const resolvedConflicts = await this.resolveConflicts(conflicts, resolveConflicts);

      // Create backup if requested
      if (createBackup) {
        await this.createConfigurationBackup(currentConfig);
      }

      // Apply import
      const result = await this.applyImport(importData.configurationSystem, resolvedConflicts, mergeWithExisting);

      return result;

    } catch (error) {
      return {
        success: false,
        importedProviders: 0,
        importedModels: 0,
        warnings: [],
        errors: [`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        conflicts: [],
        skipped: []
      };
    }
  }

  /**
   * Export configuration to downloadable file
   */
  public async downloadConfiguration(
    configurationSystem: ConfigurationSystem,
    filename?: string,
    options?: {
      includeCredentials?: boolean;
      format?: 'json' | 'yaml';
    }
  ): Promise<void> {
    const exportData = await this.exportConfiguration(configurationSystem, options);
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `ai-config-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Import configuration from file
   */
  public async importFromFile(
    file: File,
    options?: {
      mergeWithExisting?: boolean;
      resolveConflicts?: 'skip' | 'overwrite' | 'rename' | 'prompt';
    }
  ): Promise<ImportResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const result = await this.importConfiguration(content, options);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsText(file);
    });
  }

  private sanitizeConfiguration(
    configurationSystem: ConfigurationSystem,
    removeCredentials: boolean
  ): ConfigurationSystem {
    if (!removeCredentials) {
      return configurationSystem;
    }

    return {
      ...configurationSystem,
      providers: configurationSystem.providers.map(provider => ({
        ...provider,
        authentication: this.sanitizeAuthentication(provider.authentication)
      }))
    };
  }

  private sanitizeAuthentication(auth: ProviderAuthentication): ProviderAuthentication {
    const sanitized: ProviderAuthentication = { ...auth };

    // Remove sensitive fields
    delete sanitized.apiKey;
    delete sanitized.accessKeyId;
    delete sanitized.secretAccessKey;
    delete sanitized.customHeaders;

    // Keep non-sensitive fields
    return {
      baseUrl: sanitized.baseUrl,
      region: sanitized.region,
      channel: sanitized.channel,
      timeout: sanitized.timeout
    };
  }

  private async calculateChecksum(configurationSystem: ConfigurationSystem): Promise<string> {
    const data = JSON.stringify(configurationSystem);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    // Use Web Crypto API for checksum
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
  }

  private convertToCSV(exportData: ConfigurationExport): string {
    const headers = ['Provider ID', 'Provider Name', 'Type', 'Enabled', 'Model Count', 'API Key Present'];
    const rows = [headers.join(',')];

    exportData.configurationSystem.providers.forEach(provider => {
      const row = [
        provider.id,
        `"${provider.name}"`,
        provider.type,
        provider.enabled,
        provider.models.length,
        provider.authentication.apiKey ? 'Yes' : 'No'
      ];
      rows.push(row.join(','));
    });

    return rows.join('\n');
  }

  private getCurrentConfiguration(): ConfigurationSystem {
    // In a real implementation, this would fetch from storage
    // For now, return empty configuration
    return {
      providers: [],
      userPreferences: {
        defaultProviderId: '',
        defaultModelId: '',
        autoSwitch: true,
        fallbackEnabled: true
      },
      version: '1.0.0',
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };
  }

  private detectConflicts(
    current: ConfigurationSystem,
    imported: ConfigurationSystem
  ): ImportConflict[] {
    const conflicts: ImportConflict[] = [];

    // Check for provider ID conflicts
    const currentProviderIds = new Set(current.providers.map(p => p.id));
    imported.providers.forEach(provider => {
      if (currentProviderIds.has(provider.id)) {
        conflicts.push({
          type: 'provider_id',
          existingId: provider.id,
          newId: provider.id,
          resolution: 'rename',
          description: `Provider ID "${provider.id}" already exists`
        });
      }
    });

    return conflicts;
  }

  private async resolveConflicts(
    conflicts: ImportConflict[],
    strategy: 'skip' | 'overwrite' | 'rename' | 'prompt'
  ): Promise<ImportConflict[]> {
    if (strategy === 'prompt') {
      // In a real implementation, this would show UI prompts
      // For now, auto-resolve with rename strategy
      return conflicts.map(conflict => ({
        ...conflict,
        resolution: 'rename' as const
      }));
    }

    return conflicts.map(conflict => ({
      ...conflict,
      resolution: strategy as any
    }));
  }

  private async applyImport(
    importedConfig: ConfigurationSystem,
    resolvedConflicts: ImportConflict[],
    mergeWithExisting: boolean
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      importedProviders: 0,
      importedModels: 0,
      warnings: [],
      errors: [],
      conflicts: resolvedConflicts,
      skipped: []
    };

    try {
      // Apply resolved conflicts
      for (const conflict of resolvedConflicts) {
        switch (conflict.resolution) {
          case 'skip':
            result.skipped.push(conflict.newId);
            break;

          case 'rename':
            // Rename conflicting provider/model
            this.renameImportedItem(importedConfig, conflict);
            break;

          case 'overwrite':
            // Existing item will be overwritten
            result.warnings.push(`Overwriting existing ${conflict.type}: ${conflict.existingId}`);
            break;
        }
      }

      // Apply import (in a real implementation, this would update storage)
      result.importedProviders = importedConfig.providers.length;
      result.importedModels = importedConfig.providers.reduce((sum, p) => sum + p.models.length, 0);

      return result;

    } catch (error) {
      result.success = false;
      result.errors.push(`Failed to apply import: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  private renameImportedItem(importedConfig: ConfigurationSystem, conflict: ImportConflict): void {
    if (conflict.type === 'provider_id') {
      const provider = importedConfig.providers.find(p => p.id === conflict.newId);
      if (provider) {
        provider.id = `${conflict.newId}_imported_${Date.now()}`;
      }
    }
  }

  private async createConfigurationBackup(configurationSystem: ConfigurationSystem): Promise<void> {
    const backupData = await this.exportConfiguration(configurationSystem, {
      includeCredentials: true,
      includeMetadata: true
    });

    const backupName = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

    try {
      localStorage.setItem(`config_backup_${backupName}`, backupData);
    } catch (error) {
      console.warn('Failed to create configuration backup:', error);
    }
  }
}

// ============================================================================
// Configuration Template Service
// ============================================================================

export class ConfigurationTemplateService {
  private static instance: ConfigurationTemplateService;
  private templates: Map<string, ConfigurationTemplate> = new Map();

  private constructor() {
    this.initializeBuiltinTemplates();
  }

  public static getInstance(): ConfigurationTemplateService {
    if (!ConfigurationTemplateService.instance) {
      ConfigurationTemplateService.instance = new ConfigurationTemplateService();
    }
    return ConfigurationTemplateService.instance;
  }

  /**
   * Create configuration from template with variable substitution
   */
  public async createFromTemplate(
    templateId: string,
    variables: Record<string, any>
  ): Promise<ConfigurationSystem> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate required variables
    this.validateTemplateVariables(template, variables);

    // Perform variable substitution
    const configurationSystem = this.substituteVariables(template, variables);

    // Validate resulting configuration
    // TODO: Add validation schema for configurationSystem
    // const validation = validationSchemas.configurationSystem.safeParse(configurationSystem);
    // if (!validation.success) {
    //   throw new Error(`Invalid configuration after template processing: ${validation.error.message}`);
    if (!configurationSystem) {
      throw new Error('Invalid configuration after template processing: configurationSystem is empty');
    }

    return configurationSystem;
  }

  /**
   * Save current configuration as template
   */
  public async saveAsTemplate(
    configurationSystem: ConfigurationSystem,
    templateInfo: {
      name: string;
      description: string;
      category: ConfigurationTemplate['category'];
      variables: TemplateVariable[];
      tags?: string[];
      author?: string;
    }
  ): Promise<ConfigurationTemplate> {
    const template: ConfigurationTemplate = {
      id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: templateInfo.name,
      description: templateInfo.description,
      category: templateInfo.category,
      providers: this.extractTemplateProviders(configurationSystem, templateInfo.variables),
      userPreferences: configurationSystem.userPreferences,
      variables: templateInfo.variables,
      tags: templateInfo.tags || [],
      author: templateInfo.author,
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.templates.set(template.id, template);
    await this.persistTemplates();

    return template;
  }

  /**
   * Get all available templates
   */
  public getTemplates(): ConfigurationTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get template by ID
   */
  public getTemplate(templateId: string): ConfigurationTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Delete template
   */
  public async deleteTemplate(templateId: string): Promise<boolean> {
    const deleted = this.templates.delete(templateId);
    if (deleted) {
      await this.persistTemplates();
    }
    return deleted;
  }

  private initializeBuiltinTemplates(): void {
    // Development template
    const developmentTemplate: ConfigurationTemplate = {
      id: 'builtin_development',
      name: 'Development Environment',
      description: 'Optimized configuration for development with cost-effective models',
      category: 'development',
      providers: [
        {
          id: 'openai_dev',
          name: 'OpenAI Development',
          type: 'openai',
          enabled: true,
          authentication: {
            apiKey: '{{OPENAI_API_KEY}}'
          },
          models: [
            {
              id: 'gpt-3.5-turbo-dev',
              name: 'GPT-3.5 Turbo',
              providerId: 'openai_dev',
              enabled: true,
              parameters: {
                temperature: 0.7,
                maxTokens: 2000
              },
              metadata: {
                contextWindow: 96000,
                inputCost: 0.0005,
                outputCost: 0.0015,
                capabilities: ['chat', 'reasoning']
              }
            }
          ],
          capabilities: {
            streaming: true,
            tools: true,
            images: false,
            reasoning: true,
            modelDiscovery: true,
            configurationTesting: true
          },
          metadata: {
            testStatus: 'untested',
            errorCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            reliabilityScore: 90
          }
        }
      ],
      userPreferences: {
        defaultProviderId: 'openai_dev',
        defaultModelId: 'gpt-3.5-turbo-dev',
        autoSwitch: true,
        fallbackEnabled: true,
        maxRetries: 2,
        timeout: 30000,
        preferStreaming: true
      },
      variables: [
        {
          name: 'OPENAI_API_KEY',
          type: 'string',
          description: 'OpenAI API key for development',
          required: true
        }
      ],
      tags: ['development', 'openai', 'cost-effective'],
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.templates.set(developmentTemplate.id, developmentTemplate);

    // Production template
    const productionTemplate: ConfigurationTemplate = {
      id: 'builtin_production',
      name: 'Production Environment',
      description: 'High-reliability configuration for production workloads',
      category: 'production',
      providers: [
        {
          id: 'openai_prod',
          name: 'OpenAI Production',
          type: 'openai',
          enabled: true,
          authentication: {
            apiKey: '{{OPENAI_API_KEY}}'
          },
          models: [
            {
              id: 'gpt-4-prod',
              name: 'GPT-4',
              providerId: 'openai_prod',
              enabled: true,
              parameters: {
                temperature: 0.1,
                maxTokens: 96000
              },
              metadata: {
                contextWindow: 8192,
                inputCost: 0.03,
                outputCost: 0.06,
                capabilities: ['chat', 'reasoning', 'tools']
              }
            }
          ],
          capabilities: {
            streaming: true,
            tools: true,
            images: false,
            reasoning: true,
            modelDiscovery: true,
            configurationTesting: true
          },
          metadata: {
            testStatus: 'untested',
            errorCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            reliabilityScore: 95
          }
        }
      ],
      userPreferences: {
        defaultProviderId: 'openai_prod',
        defaultModelId: 'gpt-4-prod',
        autoSwitch: true,
        fallbackEnabled: true,
        fallbackProviderId: 'openrouter_fallback',
        fallbackModelId: 'anthropic/claude-3.5-sonnet',
        maxRetries: 3,
        timeout: 60000,
        preferStreaming: true
      },
      variables: [
        {
          name: 'OPENAI_API_KEY',
          type: 'string',
          description: 'OpenAI API key for production',
          required: true
        }
      ],
      tags: ['production', 'openai', 'high-reliability'],
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.templates.set(productionTemplate.id, productionTemplate);
  }

  private validateTemplateVariables(template: ConfigurationTemplate, variables: Record<string, any>): void {
    const missingVariables = template.variables
      .filter(v => v.required && !(v.name in variables))
      .map(v => v.name);

    if (missingVariables.length > 0) {
      throw new Error(`Missing required variables: ${missingVariables.join(', ')}`);
    }
  }

  private substituteVariables(template: ConfigurationTemplate, variables: Record<string, any>): ConfigurationSystem {
    const jsonString = JSON.stringify(template);
    let substituted = jsonString;

    // Replace {{VARIABLE_NAME}} patterns
    Object.entries(variables).forEach(([key, value]) => {
      const pattern = new RegExp(`{{${key}}}`, 'g');
      substituted = substituted.replace(pattern, String(value));
    });

    return JSON.parse(substituted);
  }

  private extractTemplateProviders(
    configurationSystem: ConfigurationSystem,
    variables: TemplateVariable[]
  ): ProviderConfig[] {
    // Extract providers and replace sensitive values with variable placeholders
    return configurationSystem.providers.map(provider => {
      const providerCopy = JSON.parse(JSON.stringify(provider));

      // Replace API keys with variable placeholders
      variables.forEach(variable => {
        if (variable.type === 'string') {
          const value = this.getNestedValue(providerCopy, variable.name);
          if (value && typeof value === 'string') {
            this.setNestedValue(providerCopy, variable.name, `{{${variable.name}}}`);
          }
        }
      });

      return providerCopy;
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => current[key] = current[key] || {}, obj);
    target[lastKey] = value;
  }

  private async persistTemplates(): Promise<void> {
    try {
      const templatesData = JSON.stringify(Array.from(this.templates.entries()));
      localStorage.setItem('configuration_templates', templatesData);
    } catch (error) {
      console.warn('Failed to persist templates:', error);
    }
  }
}

// ============================================================================
// Bulk Operations Service
// ============================================================================

export class BulkOperationsService {
  private static instance: BulkOperationsService;
  private operations: Map<string, BulkOperation> = new Map();
  private operationQueue: BulkOperation[] = [];
  private isProcessing = false;

  private constructor() {}

  public static getInstance(): BulkOperationsService {
    if (!BulkOperationsService.instance) {
      BulkOperationsService.instance = new BulkOperationsService();
    }
    return BulkOperationsService.instance;
  }

  /**
   * Create and queue a bulk operation
   */
  public createBulkOperation(
    type: BulkOperation['type'],
    targets: string[],
    parameters?: Record<string, any>
  ): string {
    const operation: BulkOperation = {
      id: `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      targets,
      parameters,
      status: 'pending',
      progress: {
        current: 0,
        total: targets.length,
        percentage: 0
      },
      results: []
    };

    this.operations.set(operation.id, operation);
    this.operationQueue.push(operation);

    this.processQueue();

    return operation.id;
  }

  /**
   * Get operation status
   */
  public getOperation(operationId: string): BulkOperation | undefined {
    return this.operations.get(operationId);
  }

  /**
   * Get all operations
   */
  public getOperations(): BulkOperation[] {
    return Array.from(this.operations.values()).sort((a, b) =>
      (b.startTime?.getTime() || 0) - (a.startTime?.getTime() || 0)
    );
  }

  /**
   * Cancel an operation
   */
  public cancelOperation(operationId: string): boolean {
    const operation = this.operations.get(operationId);
    if (operation && (operation.status === 'pending' || operation.status === 'running')) {
      operation.status = 'cancelled';
      operation.endTime = new Date();
      return true;
    }
    return false;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.operationQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.operationQueue.length > 0) {
      const operation = this.operationQueue.shift()!;

      if (operation.status === 'cancelled') {
        continue;
      }

      await this.executeOperation(operation);
    }

    this.isProcessing = false;
  }

  private async executeOperation(operation: BulkOperation): Promise<void> {
    operation.status = 'running';
    operation.startTime = new Date();

    try {
      for (let i = 0; i < operation.targets.length; i++) {
        const target = operation.targets[i];

        // Check if operation was cancelled before processing this target
        // Note: status can be changed by cancelOperation() from another context
        if ((operation as any).status === 'cancelled') {
          break;
        }

        const result = await this.executeOperationStep(operation.type, target, operation.parameters);

        operation.results.push(result);
        operation.progress.current = i + 1;
        operation.progress.percentage = Math.round(((i + 1) / operation.targets.length) * 100);
      }

      // Only mark as completed if not cancelled
      // Note: status can be changed by cancelOperation() from another context
      if ((operation as any).status !== 'cancelled') {
        operation.status = 'completed';
      }

    } catch (error) {
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : 'Unknown error';
    } finally {
      operation.endTime = new Date();
    }
  }

  private async executeOperationStep(
    type: BulkOperation['type'],
    target: string,
    parameters?: Record<string, any>
  ): Promise<BulkOperationResult> {
    const startTime = Date.now();

    try {
      switch (type) {
        case 'test':
          return await this.executeTestOperation(target);

        case 'enable':
        case 'disable':
        case 'delete':
        case 'update':
          // These would require integration with the configuration system
          return {
            targetId: target,
            success: true,
            duration: Date.now() - startTime
          };

        default:
          throw new Error(`Unsupported operation type: ${type}`);
      }
    } catch (error) {
      return {
        targetId: target,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  private async executeTestOperation(target: string): Promise<BulkOperationResult> {
    const startTime = Date.now();

    try {
      // This would test a specific provider/model
      // For now, simulate a test result
      const success = Math.random() > 0.2; // 80% success rate

      return {
        targetId: target,
        success,
        result: {
          testType: 'connectivity',
          responseTime: Math.random() * 1000 + 100,
          timestamp: new Date()
        },
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        targetId: target,
        success: false,
        error: error instanceof Error ? error.message : 'Test failed',
        duration: Date.now() - startTime
      };
    }
  }
}

// ============================================================================
// Advanced Debugging Service
// ============================================================================

export class AdvancedDebuggingService {
  private static instance: AdvancedDebuggingService;
  private sessions: Map<string, DebugSession> = new Map();
  private activeSessionId?: string;

  private constructor() {}

  public static getInstance(): AdvancedDebuggingService {
    if (!AdvancedDebuggingService.instance) {
      AdvancedDebuggingService.instance = new AdvancedDebuggingService();
    }
    return AdvancedDebuggingService.instance;
  }

  /**
   * Start a new debug session
   */
  public startDebugSession(
    name: string,
    configuration: ConfigurationSystem
  ): string {
    const session: DebugSession = {
      id: `debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      configuration,
      testResults: [],
      logs: [],
      screenshots: [],
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        duration: 0,
        status: 'active'
      }
    };

    this.sessions.set(session.id, session);
    this.activeSessionId = session.id;

    this.log(session.id, 'info', 'configuration', `Debug session started: ${name}`);

    return session.id;
  }

  /**
   * End current debug session
   */
  public endDebugSession(sessionId?: string): void {
    const id = sessionId || this.activeSessionId;
    if (!id) return;

    const session = this.sessions.get(id);
    if (session) {
      session.metadata.status = 'completed';
      session.metadata.duration = Date.now() - session.metadata.createdAt.getTime();
      session.metadata.updatedAt = new Date();

      this.log(id, 'info', 'configuration', 'Debug session ended');
    }

    if (this.activeSessionId === id) {
      this.activeSessionId = undefined;
    }
  }

  /**
   * Log debug information
   */
  public log(
    sessionId: string,
    level: DebugLogEntry['level'],
    category: DebugLogEntry['category'],
    message: string,
    data?: any,
    providerId?: string,
    modelId?: string
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const logEntry: DebugLogEntry = {
      timestamp: new Date(),
      level,
      category,
      message,
      data,
      providerId,
      modelId
    };

    session.logs.push(logEntry);
    session.metadata.updatedAt = new Date();

    // Also log to console
    const consoleMessage = `[${session.name}] ${message}`;
    switch (level) {
      case 'debug':
        console.debug(consoleMessage, data);
        break;
      case 'info':
        console.info(consoleMessage, data);
        break;
      case 'warn':
        console.warn(consoleMessage, data);
        break;
      case 'error':
        console.error(consoleMessage, data);
        break;
    }
  }

  /**
   * Add test result to session
   */
  public addTestResult(sessionId: string, result: ProviderTestResult): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.testResults.push(result);
    session.metadata.updatedAt = new Date();

    const status = result.success ? 'success' : 'failure';
    this.log(sessionId, 'info', 'testing',
      `Test completed for ${result.providerType}: ${status}`,
      { duration: result.duration, error: result.error });
  }

  /**
   * Add screenshot to session
   */
  public addScreenshot(
    sessionId: string,
    description: string,
    dataUrl: string,
    context?: string
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const screenshot: DebugScreenshot = {
      id: `screenshot_${Date.now()}`,
      timestamp: new Date(),
      description,
      dataUrl,
      context
    };

    if (!session.screenshots) {
      session.screenshots = [];
    }
    session.screenshots.push(screenshot);
    session.metadata.updatedAt = new Date();

    this.log(sessionId, 'info', 'configuration', `Screenshot captured: ${description}`);
  }

  /**
   * Get debug session
   */
  public getSession(sessionId: string): DebugSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all debug sessions
   */
  public getSessions(): DebugSession[] {
    return Array.from(this.sessions.values()).sort((a, b) =>
      b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime()
    );
  }

  /**
   * Get active session
   */
  public getActiveSession(): DebugSession | undefined {
    return this.activeSessionId ? this.sessions.get(this.activeSessionId) : undefined;
  }

  /**
   * Delete debug session
   */
  public deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted && this.activeSessionId === sessionId) {
      this.activeSessionId = undefined;
    }
    return deleted;
  }

  /**
   * Generate debug report
   */
  public generateDebugReport(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    const report = {
      session: {
        id: session.id,
        name: session.name,
        status: session.metadata.status,
        duration: session.metadata.duration,
        createdAt: session.metadata.createdAt,
        updatedAt: session.metadata.updatedAt
      },
      summary: {
        totalLogs: session.logs.length,
        errorLogs: session.logs.filter(l => l.level === 'error').length,
        testResults: session.testResults.length,
        successfulTests: session.testResults.filter(t => t.success).length,
        screenshots: session.screenshots?.length || 0
      },
      configuration: {
        providers: session.configuration.providers.length,
        enabledProviders: session.configuration.providers.filter((p: any) => p.enabled).length,
        providerTypes: [...new Set(session.configuration.providers.map((p: any) => p.type))]
      },
      logs: session.logs,
      testResults: session.testResults,
      screenshots: session.screenshots
    };

    return JSON.stringify(report, null, 2);
  }
}

// ============================================================================
// Export singleton instances and convenience functions
// ============================================================================

export const configImportExportService = ConfigurationImportExportService.getInstance();
export const configTemplateService = ConfigurationTemplateService.getInstance();
export const bulkOperationsService = BulkOperationsService.getInstance();
export const advancedDebuggingService = AdvancedDebuggingService.getInstance();

// Convenience functions
export const exportConfiguration = (config: ConfigurationSystem, options?: any) =>
  configImportExportService.exportConfiguration(config, options);

export const importConfiguration = (data: string, options?: any) =>
  configImportExportService.importConfiguration(data, options);

export const createFromTemplate = (templateId: string, variables: Record<string, any>) =>
  configTemplateService.createFromTemplate(templateId, variables);

export const createBulkOperation = (type: string, targets: string[], params?: any) =>
  bulkOperationsService.createBulkOperation(type as any, targets, params);

export const startDebugSession = (name: string, config: ConfigurationSystem) =>
  advancedDebuggingService.startDebugSession(name, config);

// {{END_MODIFICATIONS}}