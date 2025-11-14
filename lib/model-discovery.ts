// {{CODE-Cycle-Integration:
//   Task_ID: [IMPL-001-2]
//   Timestamp: 2025-01-12T00:00:00Z
//   Phase: [D-Develop]
//   Context-Analysis: "Analyzing existing MODEL_OPTIONS from ai-config-utils.ts and implementing automatic model fetching for OpenAI-compatible providers with 24-hour caching."
//   Principle_Applied: "Aether-Engineering-SOLID-S, Aether-Engineering-DRY, Aether-Engineering-Cache-Pattern"
// }}
// {{START_MODIFICATIONS}}

import { CustomProvider } from "./ai-config-utils";

// ============================================================================
// Model Discovery Interface
// ============================================================================

export interface IModelDiscovery {
  /**
   * Fetch available models from a provider
   */
  fetchModels(providerConfig: ProviderConfig): Promise<ModelDiscoveryResult>;

  /**
   * Check if this discovery service can handle the provider type
   */
  canHandle(providerType: string): boolean;
}

// ============================================================================
// Data Structures
// ============================================================================

export interface ProviderConfig {
  type: 'openai' | 'google' | 'bedrock' | 'openrouter' | 'custom';
  apiKey?: string;
  baseURL?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  customEndpoint?: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  contextWindow?: number;
  maxTokens?: number;
  inputCost?: number;
  outputCost?: number;
  capabilities?: string[];
  created?: string;
  ownedBy?: string;
}

export interface ModelDiscoveryResult {
  success: boolean;
  models: ModelInfo[];
  error?: string;
  providerType: string;
  timestamp: Date;
  cached: boolean;
}

export interface CacheEntry {
  models: ModelInfo[];
  timestamp: Date;
  ttl: number;
}

export interface ModelDiscoveryCache {
  [providerKey: string]: CacheEntry;
}

// ============================================================================
// OpenAI-Compatible Model Discovery Service
// ============================================================================

export class OpenAIModelDiscoveryService implements IModelDiscovery {
  private readonly MODELS_ENDPOINT = '/chat/completions';
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  canHandle(providerType: string): boolean {
    return providerType === 'openai' || providerType === 'custom';
  }

  async fetchModels(providerConfig: ProviderConfig): Promise<ModelDiscoveryResult> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(providerConfig);

    try {
      // Check cache first
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        return {
          ...cachedResult,
          cached: true,
        };
      }

      // Fetch from API
      const models = await this.fetchFromAPI(providerConfig);

      const result: ModelDiscoveryResult = {
        success: true,
        models,
        providerType: providerConfig.type,
        timestamp: new Date(),
        cached: false,
      };

      // Cache the result
      this.addToCache(cacheKey, models);

      console.log(`Model discovery for ${providerConfig.type} completed in ${Date.now() - startTime}ms`);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      return {
        success: false,
        models: [],
        error: errorMessage,
        providerType: providerConfig.type,
        timestamp: new Date(),
        cached: false,
      };
    }
  }

  private async fetchFromAPI(providerConfig: ProviderConfig): Promise<ModelInfo[]> {
    if (!providerConfig.baseURL) {
      throw new Error('Base URL is required for model discovery');
    }

    const modelsEndpoint = `${providerConfig.baseURL.replace(/\/$/, '')}${this.MODELS_ENDPOINT}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (providerConfig.apiKey) {
      headers['Authorization'] = `Bearer ${providerConfig.apiKey}`;
    }

    const response = await fetch(modelsEndpoint, {
      method: 'GET',
      headers,
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Handle different response formats
    if (data.data && Array.isArray(data.data)) {
      // OpenAI API format
      return data.data.map(this.transformOpenAIModel);
    } else if (Array.isArray(data)) {
      // Direct array format
      return data.map(this.transformGenericModel);
    } else {
      throw new Error('Unexpected response format from models API');
    }
  }

  private transformOpenAIModel(model: any): ModelInfo {
    return {
      id: model.id || model.model,
      name: model.id || model.model,
      description: model.object || 'AI Model',
      contextWindow: model.context_length,
      maxTokens: model.max_tokens,
      ownedBy: model.owned_by || 'unknown',
      created: model.created ? new Date(model.created * 1000).toISOString() : undefined,
      capabilities: this.inferCapabilities(model.id || model.model),
    };
  }

  private transformGenericModel(model: any): ModelInfo {
    const modelId = model.id || model.model || model.name;
    return {
      id: modelId,
      name: modelId,
      description: model.description || 'AI Model',
      contextWindow: model.context_length || model.contextWindow,
      maxTokens: model.max_tokens || model.maxTokens,
      capabilities: this.inferCapabilities(modelId),
    };
  }

  private inferCapabilities(modelId: string): string[] {
    const capabilities: string[] = [];

    // Infer capabilities based on model name patterns
    if (modelId.toLowerCase().includes('gpt')) {
      capabilities.push('chat', 'reasoning');
      if (modelId.toLowerCase().includes('vision') || modelId.toLowerCase().includes('image')) {
        capabilities.push('vision', 'images');
      }
    }

    if (modelId.toLowerCase().includes('claude')) {
      capabilities.push('chat', 'reasoning', 'tools');
    }

    if (modelId.toLowerCase().includes('gemini')) {
      capabilities.push('chat', 'reasoning', 'vision', 'tools');
    }

    if (modelId.toLowerCase().includes('embedding')) {
      capabilities.push('embeddings');
    }

    if (capabilities.length === 0) {
      capabilities.push('chat'); // Default capability
    }

    return capabilities;
  }

  private generateCacheKey(providerConfig: ProviderConfig): string {
    // Create a cache key based on provider configuration
    // Note: We don't include the API key in the cache key for security
    const keyParts = [
      providerConfig.type,
      providerConfig.baseURL || '',
      providerConfig.region || '',
    ];
    return keyParts.join(':').toLowerCase();
  }

  private getFromCache(cacheKey: string): ModelDiscoveryResult | null {
    try {
      // Check if running in browser environment - localStorage is not available on server
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return null;
      }

      const cacheData = localStorage.getItem('model-discovery-cache');
      if (!cacheData) {
        return null;
      }

      const cache: ModelDiscoveryCache = JSON.parse(cacheData);
      const entry = cache[cacheKey];

      if (!entry) {
        return null;
      }

      // Check if cache entry is still valid
      const now = new Date().getTime();
      const entryTime = new Date(entry.timestamp).getTime();

      if (now - entryTime > entry.ttl) {
        // Cache expired, remove it
        delete cache[cacheKey];
        localStorage.setItem('model-discovery-cache', JSON.stringify(cache));
        return null;
      }

      return {
        success: true,
        models: entry.models,
        providerType: 'cached',
        timestamp: entry.timestamp,
        cached: true,
      };
    } catch (error) {
      console.warn('Failed to read from model discovery cache:', error);
      return null;
    }
  }

  private addToCache(cacheKey: string, models: ModelInfo[]): void {
    try {
      // Check if running in browser environment - localStorage is not available on server
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return;
      }

      const cacheData = localStorage.getItem('model-discovery-cache');
      const cache: ModelDiscoveryCache = cacheData ? JSON.parse(cacheData) : {};

      cache[cacheKey] = {
        models,
        timestamp: new Date(),
        ttl: this.CACHE_TTL,
      };

      localStorage.setItem('model-discovery-cache', JSON.stringify(cache));
    } catch (error) {
      console.warn('Failed to write to model discovery cache:', error);
    }
  }

  /**
   * Clear the model discovery cache
   */
  public clearCache(): void {
    try {
      // Check if running in browser environment - localStorage is not available on server
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return;
      }

      localStorage.removeItem('model-discovery-cache');
    } catch (error) {
      console.warn('Failed to clear model discovery cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { entries: number; totalSize: number } {
    try {
      // Check if running in browser environment - localStorage is not available on server
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return { entries: 0, totalSize: 0 };
      }

      const cacheData = localStorage.getItem('model-discovery-cache');
      if (!cacheData) {
        return { entries: 0, totalSize: 0 };
      }

      const cache: ModelDiscoveryCache = JSON.parse(cacheData);
      const entries = Object.keys(cache).length;
      const totalSize = cacheData.length;

      return { entries, totalSize };
    } catch (error) {
      console.warn('Failed to get cache stats:', error);
      return { entries: 0, totalSize: 0 };
    }
  }
}

// ============================================================================
// OpenRouter Model Discovery Service
// ============================================================================

export class OpenRouterModelDiscoveryService implements IModelDiscovery {
  private readonly MODELS_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

  canHandle(providerType: string): boolean {
    return providerType === 'openrouter';
  }

  async fetchModels(providerConfig: ProviderConfig): Promise<ModelDiscoveryResult> {
    try {
      const response = await fetch(this.MODELS_ENDPOINT, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(providerConfig.apiKey && { 'Authorization': `Bearer ${providerConfig.apiKey}` }),
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid response format from OpenRouter API');
      }

      const models = data.data.map((model: any) => ({
        id: model.id,
        name: model.name || model.id,
        description: model.description,
        contextWindow: model.context_length,
        maxTokens: model.max_tokens,
        inputCost: model.pricing?.prompt,
        outputCost: model.pricing?.completion,
        capabilities: this.inferOpenRouterCapabilities(model),
        ownedBy: model.top_provider || 'unknown',
      }));

      return {
        success: true,
        models,
        providerType: 'openrouter',
        timestamp: new Date(),
        cached: false,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      return {
        success: false,
        models: [],
        error: errorMessage,
        providerType: 'openrouter',
        timestamp: new Date(),
        cached: false,
      };
    }
  }

  private inferOpenRouterCapabilities(model: any): string[] {
    const capabilities: string[] = ['chat'];

    if (model.id.includes('claude')) {
      capabilities.push('reasoning', 'tools');
    }

    if (model.id.includes('vision') || model.id.includes('image')) {
      capabilities.push('vision', 'images');
    }

    if (model.id.includes('code')) {
      capabilities.push('code');
    }

    return capabilities;
  }
}

// ============================================================================
// Google and Bedrock Model Discovery (Static Lists)
// ============================================================================

export class StaticModelDiscoveryService implements IModelDiscovery {
  private static readonly MODELS = {
    google: [
      {
        id: "gemini-2.5-flash-preview-05-20",
        name: "Gemini 2.5 Flash (Preview)",
        description: "Fast and efficient model for quick responses",
        capabilities: ["chat", "reasoning", "vision", "tools"],
      },
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        description: "Advanced reasoning and problem-solving capabilities",
        capabilities: ["chat", "reasoning", "vision", "tools"],
      },
      {
        id: "gemini-pro",
        name: "Gemini Pro",
        description: "Versatile model for various tasks",
        capabilities: ["chat", "reasoning", "vision"],
      },
    ],
    bedrock: [
      {
        id: "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
        name: "Claude Sonnet 4.5",
        description: "Latest Claude model with enhanced reasoning",
        capabilities: ["chat", "reasoning", "tools"],
      },
      {
        id: "anthropic.claude-sonnet-4-20250514-v1:0",
        name: "Claude Sonnet 4",
        description: "Advanced reasoning and analysis capabilities",
        capabilities: ["chat", "reasoning", "tools"],
      },
      {
        id: "anthropic.claude-3-5-sonnet-20240620-v1:0",
        name: "Claude 3.5 Sonnet",
        description: "Balanced performance for general tasks",
        capabilities: ["chat", "reasoning", "tools"],
      },
    ],
  };

  constructor(private providerType: 'google' | 'bedrock') {}

  canHandle(providerType: string): boolean {
    return providerType === this.providerType;
  }

  async fetchModels(providerConfig: ProviderConfig): Promise<ModelDiscoveryResult> {
    const models = StaticModelDiscoveryService.MODELS[this.providerType];

    return {
      success: true,
      models,
      providerType: this.providerType,
      timestamp: new Date(),
      cached: false,
    };
  }
}

// ============================================================================
// Main Model Discovery Service
// ============================================================================

export class ModelDiscoveryService {
  private services: IModelDiscovery[] = [];
  private static instance: ModelDiscoveryService;

  private constructor() {
    this.initializeServices();
  }

  public static getInstance(): ModelDiscoveryService {
    if (!ModelDiscoveryService.instance) {
      ModelDiscoveryService.instance = new ModelDiscoveryService();
    }
    return ModelDiscoveryService.instance;
  }

  private initializeServices(): void {
    this.services = [
      new OpenAIModelDiscoveryService(),
      new OpenRouterModelDiscoveryService(),
      new StaticModelDiscoveryService('google'),
      new StaticModelDiscoveryService('bedrock'),
    ];
  }

  /**
   * Discover models for a given provider configuration
   */
  async discoverModels(providerConfig: ProviderConfig): Promise<ModelDiscoveryResult> {
    const service = this.getService(providerConfig.type);

    if (!service) {
      return {
        success: false,
        models: [],
        error: `No model discovery service available for provider type: ${providerConfig.type}`,
        providerType: providerConfig.type,
        timestamp: new Date(),
        cached: false,
      };
    }

    return service.fetchModels(providerConfig);
  }

  /**
   * Discover models for a custom provider
   */
  async discoverModelsForCustomProvider(customProvider: CustomProvider): Promise<ModelDiscoveryResult> {
    const providerConfig: ProviderConfig = {
      type: 'custom',
      apiKey: customProvider.apiKey,
      baseURL: customProvider.baseURL,
      customEndpoint: customProvider.customEndpoint,
    };

    return this.discoverModels(providerConfig);
  }

  /**
   * Get the appropriate discovery service for a provider type
   */
  private getService(providerType: string): IModelDiscovery | undefined {
    return this.services.find(service => service.canHandle(providerType));
  }

  /**
   * Check if model discovery is supported for a provider type
   */
  isDiscoverySupported(providerType: string): boolean {
    return this.getService(providerType) !== undefined;
  }

  /**
   * Get all cached model discovery results
   */
  getCachedResults(): { [providerKey: string]: ModelDiscoveryResult } {
    try {
      // Check if running in browser environment - localStorage is not available on server
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return {};
      }

      const cacheData = localStorage.getItem('model-discovery-cache');
      if (!cacheData) {
        return {};
      }

      const cache: ModelDiscoveryCache = JSON.parse(cacheData);
      const results: { [providerKey: string]: ModelDiscoveryResult } = {};

      Object.entries(cache).forEach(([key, entry]) => {
        results[key] = {
          success: true,
          models: entry.models,
          providerType: 'cached',
          timestamp: entry.timestamp,
          cached: true,
        };
      });

      return results;
    } catch (error) {
      console.warn('Failed to get cached results:', error);
      return {};
    }
  }

  /**
   * Clear all model discovery caches
   */
  clearAllCaches(): void {
    const openAIService = this.services.find(s => s instanceof OpenAIModelDiscoveryService) as OpenAIModelDiscoveryService;
    if (openAIService) {
      openAIService.clearCache();
    }
  }

  /**
   * Get cache statistics for all services
   */
  getCacheStatistics(): { [serviceName: string]: { entries: number; totalSize: number } } {
    const stats: { [serviceName: string]: { entries: number; totalSize: number } } = {};

    this.services.forEach(service => {
      if (service instanceof OpenAIModelDiscoveryService) {
        stats['openai-compatible'] = service.getCacheStats();
      }
    });

    return stats;
  }
}

// ============================================================================
// Export singleton instance and convenience functions
// ============================================================================

export const modelDiscoveryService = ModelDiscoveryService.getInstance();

export const discoverModels = async (providerConfig: ProviderConfig): Promise<ModelDiscoveryResult> => {
  return modelDiscoveryService.discoverModels(providerConfig);
};

export const discoverModelsForCustomProvider = async (customProvider: CustomProvider): Promise<ModelDiscoveryResult> => {
  return modelDiscoveryService.discoverModelsForCustomProvider(customProvider);
};

// {{END_MODIFICATIONS}}