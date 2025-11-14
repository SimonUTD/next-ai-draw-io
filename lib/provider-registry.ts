// {{CODE-Cycle-Integration:
//   Task_ID: [IMPL-001-1]
//   Timestamp: 2025-01-12T00:00:00Z
//   Phase: [D-Develop]
//   Context-Analysis: "Analyzed existing ai-config-utils.ts provider creation patterns (lines 169-255). Extracting provider factory logic while maintaining compatibility with all existing AI SDKs."
//   Principle_Applied: "Aether-Engineering-SOLID-S, Aether-Engineering-DRY, Aether-Engineering-OCP"
// }}
// {{START_MODIFICATIONS}}

import { openai, createOpenAI } from "@ai-sdk/openai";
import { google, createGoogleGenerativeAI } from "@ai-sdk/google";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { CustomProvider, AIConfig, ModelConfig } from "./ai-config-types";

// ============================================================================
// Abstract Factory Interface for Provider Creation
// ============================================================================

export interface IProviderFactory {
  /**
   * Create a provider instance for the given configuration
   */
  createProvider(config: AIConfig, customProvider?: CustomProvider): any;

  /**
   * Validate provider-specific configuration
   */
  validateConfig(config: AIConfig, customProvider?: CustomProvider): boolean;

  /**
   * Get supported models for this provider type
   */
  getSupportedModels(): string[];

  /**
   * Check if this factory handles the given provider type
   */
  canHandle(providerType: string): boolean;
}

// ============================================================================
// Built-in Provider Factories
// ============================================================================

export class OpenAIProviderFactory implements IProviderFactory {
  canHandle(providerType: string): boolean {
    return providerType === "openai";
  }

  createProvider(config: AIConfig): any {
    if (config.apiKey) {
      const customOpenAI = createOpenAI({
        apiKey: config.apiKey,
      });
      return customOpenAI(config.model);
    }
    return openai(config.model);
  }

  validateConfig(config: AIConfig): boolean {
    // OpenAI-specific validation logic
    if (!config.model || typeof config.model !== 'string') {
      return false;
    }

    // Temperature range validation for OpenAI (0-2)
    if (config.parameters?.temperature !== undefined) {
      return config.parameters.temperature >= 0 && config.parameters.temperature <= 2;
    }

    return true;
  }

  getSupportedModels(): string[] {
    return ["gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"];
  }
}

export class GoogleProviderFactory implements IProviderFactory {
  canHandle(providerType: string): boolean {
    return providerType === "google";
  }

  createProvider(config: AIConfig): any {
    if (config.apiKey) {
      const customGoogle = createGoogleGenerativeAI({
        apiKey: config.apiKey,
      });
      return customGoogle(config.model);
    }
    return google(config.model);
  }

  validateConfig(config: AIConfig): boolean {
    // Google-specific validation logic
    if (!config.model || typeof config.model !== 'string') {
      return false;
    }

    // Temperature range validation for Google (0-2)
    if (config.parameters?.temperature !== undefined) {
      return config.parameters.temperature >= 0 && config.parameters.temperature <= 2;
    }

    return true;
  }

  getSupportedModels(): string[] {
    return [
      "gemini-2.5-flash-preview-05-20",
      "gemini-2.5-pro",
      "gemini-pro",
    ];
  }
}

export class BedrockProviderFactory implements IProviderFactory {
  canHandle(providerType: string): boolean {
    return providerType === "bedrock";
  }

  createProvider(config: AIConfig): any {
    // Check if AWS credentials are provided in config or environment
    const region = (config as any).region || process.env.AWS_REGION;
    const accessKeyId = (config as any).accessKeyId || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = (config as any).secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;
    
    if (!region) {
      throw new Error('AWS region is required for Bedrock provider. Please set AWS_REGION environment variable or provide region in configuration.');
    }
    
    // Create Bedrock provider with AWS configuration
    const bedrockConfig: any = {
      model: config.model,
    };
    
    // Add AWS credentials if available
    if (accessKeyId && secretAccessKey) {
      bedrockConfig.accessKeyId = accessKeyId;
      bedrockConfig.secretAccessKey = secretAccessKey;
    }
    
    if (region) {
      bedrockConfig.region = region;
    }
    
    return bedrock(bedrockConfig);
  }

  validateConfig(config: AIConfig): boolean {
    // Bedrock-specific validation logic
    if (!config.model || typeof config.model !== 'string') {
      return false;
    }

    // Validate AWS region is available (either in config or environment)
    const region = (config as any).region || process.env.AWS_REGION;
    if (!region) {
      return false;
    }

    // Temperature range validation for Bedrock (0-1)
    if (config.parameters?.temperature !== undefined) {
      return config.parameters.temperature >= 0 && config.parameters.temperature <= 1;
    }

    return true;
  }

  getSupportedModels(): string[] {
    return [
      "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
      "anthropic.claude-sonnet-4-20250514-v1:0",
      "anthropic.claude-3-5-sonnet-20240620-v1:0",
    ];
  }
}

export class OpenRouterProviderFactory implements IProviderFactory {
  canHandle(providerType: string): boolean {
    return providerType === "openrouter";
  }

  createProvider(config: AIConfig): any {
    const openrouter = createOpenRouter({
      apiKey: config.apiKey || process.env.OPENROUTER_API_KEY,
    });
    return openrouter(config.model);
  }

  validateConfig(config: AIConfig): boolean {
    // OpenRouter-specific validation logic
    if (!config.model || typeof config.model !== 'string') {
      return false;
    }

    // Temperature range validation for OpenRouter (0-2)
    if (config.parameters?.temperature !== undefined) {
      return config.parameters.temperature >= 0 && config.parameters.temperature <= 2;
    }

    return true;
  }

  getSupportedModels(): string[] {
    return [
      "anthropic/claude-3.5-sonnet",
      "google/gemini-pro",
      "openai/gpt-4-turbo",
    ];
  }
}

export class CustomProviderFactory implements IProviderFactory {
  canHandle(providerType: string): boolean {
    // This factory handles any provider that's not a built-in one
    const builtInProviders = ["openai", "google", "bedrock", "openrouter"];
    return !builtInProviders.includes(providerType);
  }

  createProvider(config: AIConfig, customProvider?: CustomProvider): any {
    if (!customProvider) {
      throw new Error(`Custom provider configuration not found for: ${config.provider}`);
    }

    // Use the official @ai-sdk/openai-compatible package
    const provider = createOpenAICompatible({
      name: customProvider.name,
      apiKey: customProvider.apiKey || config.apiKey || '',
      baseURL: customProvider.baseURL,
    });
    
    return provider(config.model);
  }

  validateConfig(config: AIConfig, customProvider?: CustomProvider): boolean {
    if (!customProvider) {
      return false;
    }

    // Custom provider validation logic
    if (!config.model || typeof config.model !== 'string') {
      return false;
    }

    // Validate that the model exists in the custom provider's model list
    const modelExists = customProvider.models.some(
      m => m.id === config.model || m.name === config.model
    );
    
    if (!modelExists) {
      return false;
    }

    return true;
  }

  getSupportedModels(): string[] {
    // Custom providers have dynamic model lists, so we return an empty array
    // The actual models are determined by custom provider configuration
    return [];
  }
}

// ============================================================================
// Provider Registry - Central Coordinator
// ============================================================================

export class ProviderRegistry {
  private factories: Map<string, IProviderFactory> = new Map();
  private static instance: ProviderRegistry;

  private constructor() {
    this.initializeFactories();
  }

  /**
   * Get singleton instance of ProviderRegistry
   */
  public static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  /**
   * Initialize all built-in provider factories
   */
  private initializeFactories(): void {
    const factories: IProviderFactory[] = [
      new OpenAIProviderFactory(),
      new GoogleProviderFactory(),
      new BedrockProviderFactory(),
      new OpenRouterProviderFactory(),
      new CustomProviderFactory(),
    ];

    factories.forEach(factory => {
      this.registerFactory(factory);
    });
  }

  /**
   * Register a new provider factory
   */
  public registerFactory(factory: IProviderFactory): void {
    // For custom providers, we use the factory class name as the key
    // The actual provider type determination is handled by the factory's canHandle method
    const factoryName = factory.constructor.name;
    this.factories.set(factoryName, factory);
  }

  /**
   * Create a provider instance based on the configuration
   */
  public createProvider(config: AIConfig): any {
    const factory = this.getFactory(config.provider);

    if (!factory) {
      throw new Error(`No factory found for provider: ${config.provider}`);
    }

    // For custom providers, find the custom provider configuration
    let customProvider: CustomProvider | undefined;
    if (factory instanceof CustomProviderFactory && config.customProviders) {
      customProvider = config.customProviders.find(p => p.id === config.provider);
    }

    // Validate the configuration before creating the provider
    if (!factory.validateConfig(config, customProvider)) {
      throw new Error(`Invalid configuration for provider: ${config.provider}`);
    }

    return factory.createProvider(config, customProvider);
  }

  /**
   * Get the appropriate factory for a provider type
   */
  private getFactory(providerType: string): IProviderFactory | undefined {
    const factories = Array.from(this.factories.values());
    for (const factory of factories) {
      if (factory.canHandle(providerType)) {
        return factory;
      }
    }
    return undefined;
  }

  /**
   * Validate a configuration
   */
  public validateConfig(config: AIConfig): boolean {
    const factory = this.getFactory(config.provider);

    if (!factory) {
      return false;
    }

    // For custom providers, find the custom provider configuration
    let customProvider: CustomProvider | undefined;
    if (factory instanceof CustomProviderFactory && config.customProviders) {
      customProvider = config.customProviders.find(p => p.id === config.provider);
    }

    return factory.validateConfig(config, customProvider);
  }

  /**
   * Get available models for a provider type
   */
  public getAvailableModels(providerType: string, customProviders?: CustomProvider[]): string[] {
    const factory = this.getFactory(providerType);

    if (!factory) {
      return [];
    }

    // For custom providers, return models from the custom provider configuration
    if (factory instanceof CustomProviderFactory && customProviders) {
      const customProvider = customProviders.find(p => p.id === providerType);
      return customProvider?.models.map(m => m.name) || [];
    }

    return factory.getSupportedModels();
  }

  /**
   * Get all supported provider types
   */
  public getSupportedProviders(): string[] {
    return ["openai", "google", "bedrock", "openrouter"];
  }

  /**
   * Check if a provider type is supported
   */
  public isProviderSupported(providerType: string): boolean {
    const factory = this.getFactory(providerType);
    return factory !== undefined;
  }

  /**
   * Get factory instance for a provider type (useful for testing)
   */
  public getFactoryInstance(providerType: string): IProviderFactory | undefined {
    return this.getFactory(providerType);
  }
}

// ============================================================================
// Convenience Functions for Backward Compatibility
// ============================================================================

/**
 * Create a model instance from configuration - maintained for backward compatibility
 * This function now uses ProviderRegistry internally
 */
export function createModelFromConfig(config: AIConfig): any {
  const registry = ProviderRegistry.getInstance();
  return registry.createProvider(config);
}

/**
 * Validate configuration - maintained for backward compatibility
 * This function now uses ProviderRegistry internally
 */
export function validateConfig(config: AIConfig): boolean {
  const registry = ProviderRegistry.getInstance();
  return registry.validateConfig(config);
}

// ============================================================================
// Export registry instance and factory classes
// ============================================================================

export const providerRegistry = ProviderRegistry.getInstance();

// Factory classes are already exported above - no need to re-export

// {{END_MODIFICATIONS}}