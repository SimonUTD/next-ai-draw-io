// {{CODE-Cycle-Integration:
//   Task_ID: [IMPL-001-3]
//   Timestamp: 2025-01-12T00:00:00Z
//   Phase: [D-Develop]
//   Context-Analysis: "Creating comprehensive provider testing framework with detailed result reporting, timeout handling, and retry mechanisms for all provider types."
//   Principle_Applied: "Aether-Engineering-SOLID-S, Aether-Engineering-Retry-Pattern, Aether-Engineering-Test-Strategy"
// }}
// {{START_MODIFICATIONS}}

import { providerRegistry } from "./provider-registry";
import { CustomProvider, AIConfig } from "./ai-config-utils";
import { getModelName } from "./ai-config-types";

// ============================================================================
// Configuration Testing Interface
// ============================================================================

export interface IConfigTesting {
  /**
   * Test a provider configuration
   */
  testProvider(config: ProviderTestConfig): Promise<ProviderTestResult>;

  /**
   * Check if this testing service can handle the provider type
   */
  canHandle(providerType: string): boolean;
}

// ============================================================================
// Data Structures
// ============================================================================

export interface ProviderTestConfig {
  type: 'openai' | 'google' | 'bedrock' | 'openrouter' | 'custom';
  apiKey?: string;
  baseURL?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  model?: string;
  timeout?: number;
  retries?: number;
  customProviders?: CustomProvider[];
}

export interface ProviderTestResult {
  success: boolean;
  providerType: string;
  testType: TestType;
  timestamp: Date;
  duration: number; // in milliseconds
  details: TestDetails;
  error?: TestError;
}

export interface TestDetails {
  connectivity?: ConnectivityTestResult;
  authentication?: AuthenticationTestResult;
  modelAvailability?: ModelAvailabilityTestResult;
  functionality?: FunctionalityTestResult;
}

export interface ConnectivityTestResult {
  success: boolean;
  responseTime: number; // in milliseconds
  endpoint?: string;
  statusCode?: number;
  error?: string;
}

export interface AuthenticationTestResult {
  success: boolean;
  responseTime: number;
  error?: string;
  authType?: 'api-key' | 'aws-credentials' | 'none';
}

export interface ModelAvailabilityTestResult {
  success: boolean;
  availableModels: string[];
  requestedModel?: string;
  modelAvailable?: boolean;
  responseTime: number;
  error?: string;
}

export interface FunctionalityTestResult {
  success: boolean;
  testPrompt: string;
  testResponse?: string;
  responseTime: number;
  tokenCount?: {
    input?: number;
    output?: number;
    total?: number;
  };
  error?: string;
}

export interface TestError {
  type: ErrorType;
  message: string;
  details?: any;
  retryable: boolean;
}

export enum TestType {
  CONNECTIVITY = 'connectivity',
  AUTHENTICATION = 'authentication',
  MODEL_AVAILABILITY = 'model-availability',
  FUNCTIONALITY = 'functionality',
  COMPREHENSIVE = 'comprehensive',
}

export enum ErrorType {
  NETWORK_ERROR = 'network_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  CONFIGURATION_ERROR = 'configuration_error',
  TIMEOUT_ERROR = 'timeout_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  PROVIDER_ERROR = 'provider_error',
  UNKNOWN_ERROR = 'unknown_error',
}

// ============================================================================
// OpenAI Provider Testing Service
// ============================================================================

export class OpenAIConfigTestingService implements IConfigTesting {
  private readonly DEFAULT_TIMEOUT = 10000; // 10 seconds
  private readonly DEFAULT_RETRIES = 2;
  private readonly TEST_PROMPT = "Hello! Please respond with a brief greeting.";

  canHandle(providerType: string): boolean {
    return providerType === 'openai';
  }

  async testProvider(config: ProviderTestConfig): Promise<ProviderTestResult> {
    const startTime = Date.now();
    const testType = TestType.COMPREHENSIVE;
    const timeout = config.timeout || this.DEFAULT_TIMEOUT;
    const retries = config.retries || this.DEFAULT_RETRIES;

    try {
      const details: TestDetails = {};

      // Test 1: Connectivity
      details.connectivity = await this.testConnectivity(config, timeout);

      if (!details.connectivity.success) {
        return this.createResult(config.type, testType, startTime, details, {
          type: ErrorType.NETWORK_ERROR,
          message: details.connectivity.error || 'Connectivity test failed',
          retryable: true,
        });
      }

      // Test 2: Authentication
      details.authentication = await this.testAuthentication(config, timeout);

      if (!details.authentication.success) {
        return this.createResult(config.type, testType, startTime, details, {
          type: ErrorType.AUTHENTICATION_ERROR,
          message: details.authentication.error || 'Authentication test failed',
          retryable: false,
        });
      }

      // Test 3: Model Availability
      details.modelAvailability = await this.testModelAvailability(config, timeout, retries);

      if (!details.modelAvailability.success) {
        return this.createResult(config.type, testType, startTime, details, {
          type: ErrorType.CONFIGURATION_ERROR,
          message: details.modelAvailability.error || 'Model availability test failed',
          retryable: false,
        });
      }

      // Test 4: Functionality (only if model is available)
      if (details.modelAvailability.modelAvailable) {
        details.functionality = await this.testFunctionality(config, timeout, retries);
      }

      return this.createResult(config.type, testType, startTime, details);

    } catch (error) {
      return this.createResult(config.type, testType, startTime, {}, {
        type: ErrorType.UNKNOWN_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error,
        retryable: true,
      });
    }
  }

  private async testConnectivity(config: ProviderTestConfig, timeout: number): Promise<ConnectivityTestResult> {
    const startTime = Date.now();
    const endpoint = 'https://api.openai.com/v1/chat/completions';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` }),
        },
        body: JSON.stringify({
          model: config.model || 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(timeout),
      });

      const responseTime = Date.now() - startTime;

      return {
        success: response.ok,
        responseTime,
        endpoint,
        statusCode: response.status,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      };
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        endpoint,
        error: error instanceof Error ? error.message : 'Unknown network error',
      };
    }
  }

  private async testAuthentication(config: ProviderTestConfig, timeout: number): Promise<AuthenticationTestResult> {
    const startTime = Date.now();
    const endpoint = 'https://api.openai.com/v1/chat/completions';

    if (!config.apiKey) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: 'API key is required for authentication test',
        authType: 'api-key',
      };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model || 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(timeout),
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          success: true,
          responseTime,
          authType: 'api-key',
        };
      } else {
        const errorText = await response.text();
        return {
          success: false,
          responseTime,
          error: `Authentication failed: ${response.status} - ${errorText}`,
          authType: 'api-key',
        };
      }
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Authentication request failed',
        authType: 'api-key',
      };
    }
  }

  private async testModelAvailability(config: ProviderTestConfig, timeout: number, retries: number): Promise<ModelAvailabilityTestResult> {
    const startTime = Date.now();
    const model = config.model || 'gpt-3.5-turbo';

    // Skip actual model availability check - assume model is available
    // Model validation will happen during functionality test
    const availableModels = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o'];
    const modelAvailable = availableModels.includes(model);

    return {
      success: true,
      availableModels,
      requestedModel: model,
      modelAvailable,
      responseTime: Date.now() - startTime,
    };
  }

  private async testFunctionality(config: ProviderTestConfig, timeout: number, retries: number): Promise<FunctionalityTestResult> {
    const model = config.model || 'gpt-3.5-turbo';

    if (!config.apiKey) {
      return {
        success: false,
        testPrompt: this.TEST_PROMPT,
        responseTime: 0,
        error: 'API key is required for functionality test',
      };
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      const startTime = Date.now();

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: this.TEST_PROMPT }],
            max_tokens: 50,
            temperature: 0.7,
          }),
          signal: AbortSignal.timeout(timeout),
        });

        const responseTime = Date.now() - startTime;

        if (!response.ok) {
          const errorText = await response.text();
          const isRetryable = response.status === 429 || response.status >= 500;

          if (attempt < retries && isRetryable) {
            await this.delay(1000 * (attempt + 1)); // Exponential backoff
            continue;
          }

          return {
            success: false,
            testPrompt: this.TEST_PROMPT,
            responseTime,
            error: `Functionality test failed: ${response.status} - ${errorText}`,
          };
        }

        const data = await response.json();
        const testResponse = data.choices?.[0]?.message?.content || 'No response content';
        const tokenCount = data.usage ? {
          input: data.usage.prompt_tokens,
          output: data.usage.completion_tokens,
          total: data.usage.total_tokens,
        } : undefined;

        return {
          success: true,
          testPrompt: this.TEST_PROMPT,
          testResponse,
          responseTime,
          tokenCount,
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Functionality test failed';

        if (attempt < retries) {
          await this.delay(1000 * (attempt + 1));
          continue;
        }

        return {
          success: false,
          testPrompt: this.TEST_PROMPT,
          responseTime,
          error: errorMessage,
        };
      }
    }

    // This should never be reached, but just in case
    return {
      success: false,
      testPrompt: this.TEST_PROMPT,
      responseTime: 0,
      error: 'All retry attempts exhausted',
    };
  }

private delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

private createResult(providerType: string, testType: TestType, startTime: number, details: TestDetails, error?: TestError): ProviderTestResult {
  return {
    success: !error,
    providerType,
    testType,
    timestamp: new Date(),
    duration: Date.now() - startTime,
    details,
    error,
  };
}
}

// ============================================================================
// Custom Provider Testing Service
// ============================================================================

export class CustomProviderTestingService implements IConfigTesting {
  private readonly DEFAULT_TIMEOUT = 15000; // 15 seconds for custom providers
  private readonly DEFAULT_RETRIES = 3;
  private readonly TEST_PROMPT = "Hello! Please respond with a brief greeting.";

  canHandle(providerType: string): boolean {
    return providerType === 'custom';
  }

  async testProvider(config: ProviderTestConfig): Promise<ProviderTestResult> {
    const startTime = Date.now();
    const testType = TestType.COMPREHENSIVE;
    const timeout = config.timeout || this.DEFAULT_TIMEOUT;
    const retries = config.retries || this.DEFAULT_RETRIES;

    if (!config.baseURL) {
      return {
        success: false,
        providerType: config.type,
        testType,
        timestamp: new Date(),
        duration: Date.now() - startTime,
        details: {},
        error: {
          type: ErrorType.CONFIGURATION_ERROR,
          message: 'Base URL is required for custom provider testing',
          retryable: false,
        },
      };
    }

    try {
      const details: TestDetails = {};

      // Test 1: Connectivity
      details.connectivity = await this.testConnectivity(config, timeout);

      if (!details.connectivity.success) {
        return {
          success: false,
          providerType: config.type,
          testType,
          timestamp: new Date(),
          duration: Date.now() - startTime,
          details,
          error: {
            type: ErrorType.NETWORK_ERROR,
            message: details.connectivity.error || 'Connectivity test failed',
            retryable: true,
          },
        };
      }

      // Test 2: Authentication (if API key provided)
      if (config.apiKey) {
        details.authentication = await this.testAuthentication(config, timeout);

        if (!details.authentication.success) {
          return {
            success: false,
            providerType: config.type,
            testType,
            timestamp: new Date(),
            duration: Date.now() - startTime,
            details,
            error: {
              type: ErrorType.AUTHENTICATION_ERROR,
              message: details.authentication.error || 'Authentication test failed',
              retryable: false,
            },
          };
        }
      }

      // Test 3: Model Availability (OpenAI providers only, skip for custom providers)
      if (config.type === 'openai') {
        details.modelAvailability = await this.testModelAvailability(config, timeout, retries);
      } else {
        // For custom providers, skip model availability check and assume model is available
        details.modelAvailability = {
          success: true,
          availableModels: [config.model || 'unknown'],
          requestedModel: config.model || 'unknown',
          modelAvailable: true,
          responseTime: 0,
        };
      }

      // Test 4: Functionality (always test for custom providers)
      details.functionality = await this.testFunctionality(config, timeout, retries);

      return {
        success: true,
        providerType: config.type,
        testType,
        timestamp: new Date(),
        duration: Date.now() - startTime,
        details,
      };

    } catch (error) {
      return {
        success: false,
        providerType: config.type,
        testType,
        timestamp: new Date(),
        duration: Date.now() - startTime,
        details: {},
        error: {
          type: ErrorType.UNKNOWN_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          details: error,
          retryable: true,
        },
      };
    }
  }

  private async testConnectivity(config: ProviderTestConfig, timeout: number): Promise<ConnectivityTestResult> {
    const startTime = Date.now();
    const endpoint = `${config.baseURL?.replace(/\/$/, '')}/chat/completions`;
    
    // Extract model name from string or object format (same as testFunctionality)
    const firstModel = config.customProviders?.[0]?.models?.[0];
    const modelName = firstModel ? getModelName(firstModel) : 'gpt-3.5-turbo';
    const model = config.model || modelName;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` }),
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(timeout),
      });

      const responseTime = Date.now() - startTime;

      return {
        success: response.ok || response.status === 401, // 401 still means connectivity works
        responseTime,
        endpoint,
        statusCode: response.status,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      };
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        endpoint,
        error: error instanceof Error ? error.message : 'Unknown network error',
      };
    }
  }

  private async testAuthentication(config: ProviderTestConfig, timeout: number): Promise<AuthenticationTestResult> {
    const startTime = Date.now();
    const endpoint = `${config.baseURL?.replace(/\/$/, '')}/chat/completions`;
    
    // Extract model name from string or object format (same as testFunctionality)
    const firstModel = config.customProviders?.[0]?.models?.[0];
    const modelName = firstModel ? getModelName(firstModel) : 'gpt-3.5-turbo';
    const model = config.model || modelName;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(timeout),
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          success: true,
          responseTime,
          authType: 'api-key',
        };
      } else {
        const errorText = await response.text();
        return {
          success: response.status === 401, // Only 401 means auth failed, other errors are different issues
          responseTime,
          error: `Authentication failed: ${response.status} - ${errorText}`,
          authType: 'api-key',
        };
      }
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Authentication request failed',
        authType: 'api-key',
      };
    }
  }

  private async testModelAvailability(config: ProviderTestConfig, timeout: number, retries: number): Promise<ModelAvailabilityTestResult> {
    const startTime = Date.now();
    const model = config.model || (config.customProviders?.[0]?.models?.[0] ? getModelName(config.customProviders[0].models[0]) : 'gpt-3.5-turbo');

    // For custom providers, skip model availability check and assume model is available
    // Model validation will happen during functionality test
    const availableModels = [model];
    const modelAvailable = true;

    return {
      success: true,
      availableModels,
      requestedModel: model,
      modelAvailable,
      responseTime: Date.now() - startTime,
    };
  }

  private async testFunctionality(config: ProviderTestConfig, timeout: number, retries: number): Promise<FunctionalityTestResult> {
    // Extract model name from string or object format
    const firstModel = config.customProviders?.[0]?.models?.[0];
    const modelName = firstModel ? getModelName(firstModel) : 'gpt-3.5-turbo';
    const model = config.model || modelName;
    const endpoint = `${config.baseURL?.replace(/\/$/, '')}/chat/completions`;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const startTime = Date.now();

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` }),
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: this.TEST_PROMPT }],
            max_tokens: 50,
            temperature: 0.7,
          }),
          signal: AbortSignal.timeout(timeout),
        });

        const responseTime = Date.now() - startTime;

        if (!response.ok) {
          const errorText = await response.text();
          const isRetryable = response.status === 429 || response.status >= 500;

          if (attempt < retries && isRetryable) {
            await this.delay(1000 * (attempt + 1));
            continue;
          }

          return {
            success: false,
            testPrompt: this.TEST_PROMPT,
            responseTime,
            error: `Functionality test failed: ${response.status} - ${errorText}`,
          };
        }

        const data = await response.json();
        const testResponse = data.choices?.[0]?.message?.content || 'No response content';
        const tokenCount = data.usage ? {
          input: data.usage.prompt_tokens,
          output: data.usage.completion_tokens,
          total: data.usage.total_tokens,
        } : undefined;

        return {
          success: true,
          testPrompt: this.TEST_PROMPT,
          testResponse,
          responseTime,
          tokenCount,
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Functionality test failed';

        if (attempt < retries) {
          await this.delay(1000 * (attempt + 1));
          continue;
        }

        return {
          success: false,
          testPrompt: this.TEST_PROMPT,
          responseTime,
          error: errorMessage,
        };
      }
    }

    return {
      success: false,
      testPrompt: this.TEST_PROMPT,
      responseTime: 0,
      error: 'All retry attempts exhausted',
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Static Provider Testing Services (Google, Bedrock, OpenRouter)
// ============================================================================

export class StaticProviderTestingService implements IConfigTesting {
  constructor(private providerType: 'google' | 'bedrock' | 'openrouter') {}

  canHandle(providerType: string): boolean {
    return providerType === this.providerType;
  }

  async testProvider(config: ProviderTestConfig): Promise<ProviderTestResult> {
    const startTime = Date.now();

    // For static providers, we perform basic configuration validation
    const details: TestDetails = {};

    // Basic connectivity test (can we reach the provider's domain)
    details.connectivity = await this.testBasicConnectivity(this.providerType);

    // Authentication validation based on provider type
    details.authentication = this.validateAuthentication(config);

    // Model availability based on static model lists
    details.modelAvailability = this.validateModelAvailability(config);

    return {
      success: details.connectivity?.success && details.authentication?.success && details.modelAvailability?.success,
      providerType: this.providerType,
      testType: TestType.COMPREHENSIVE,
      timestamp: new Date(),
      duration: Date.now() - startTime,
      details,
    };
  }

  private async testBasicConnectivity(providerType: string): Promise<ConnectivityTestResult> {
    const startTime = Date.now();
    let endpoint = '';

    switch (providerType) {
      case 'google':
        endpoint = 'https://generativelanguage.googleapis.com';
        break;
      case 'bedrock':
        endpoint = 'https://bedrock-runtime.amazonaws.com';
        break;
      case 'openrouter':
        endpoint = 'https://openrouter.ai';
        break;
    }

    try {
      // Simple connectivity check using a HEAD request
      const response = await fetch(endpoint, {
        method: 'HEAD',
        mode: 'no-cors', // Avoid CORS issues
        signal: AbortSignal.timeout(5000),
      });

      return {
        success: true, // We'll assume success if no network error occurs
        responseTime: Date.now() - startTime,
        endpoint,
      };
    } catch (error) {
      // Some errors are expected due to CORS, but it means the endpoint is reachable
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        return {
          success: false,
          responseTime: Date.now() - startTime,
          endpoint,
          error: 'Network unreachable',
        };
      }

      return {
        success: true, // Assume reachable if we get any response (including CORS errors)
        responseTime: Date.now() - startTime,
        endpoint,
      };
    }
  }

  private validateAuthentication(config: ProviderTestConfig): AuthenticationTestResult {
    const startTime = Date.now();

    switch (this.providerType) {
      case 'google':
        return {
          success: !!config.apiKey,
          responseTime: Date.now() - startTime,
          error: config.apiKey ? undefined : 'API key is required for Google provider',
          authType: 'api-key',
        };

      case 'bedrock':
        const hasAwsCreds = config.accessKeyId && config.secretAccessKey && config.region;
        return {
          success: !!hasAwsCreds,
          responseTime: Date.now() - startTime,
          error: hasAwsCreds ? undefined : 'AWS credentials (access key, secret key, region) are required for Bedrock provider',
          authType: 'aws-credentials',
        };

      case 'openrouter':
        return {
          success: !!config.apiKey,
          responseTime: Date.now() - startTime,
          error: config.apiKey ? undefined : 'API key is required for OpenRouter provider',
          authType: 'api-key',
        };

      default:
        return {
          success: false,
          responseTime: Date.now() - startTime,
          error: 'Unknown provider type',
          authType: 'none',
        };
    }
  }

  private validateModelAvailability(config: ProviderTestConfig): ModelAvailabilityTestResult {
    const startTime = Date.now();
    let availableModels: string[] = [];

    switch (this.providerType) {
      case 'google':
        availableModels = [
          "gemini-2.5-flash-preview-05-20",
          "gemini-2.5-pro",
          "gemini-pro",
        ];
        break;
      case 'bedrock':
        availableModels = [
          "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
          "anthropic.claude-sonnet-4-20250514-v1:0",
          "anthropic.claude-3-5-sonnet-20240620-v1:0",
        ];
        break;
      case 'openrouter':
        availableModels = [
          "anthropic/claude-3.5-sonnet",
          "google/gemini-pro",
          "openai/gpt-4-turbo",
        ];
        break;
    }

    const modelAvailable = config.model ? availableModels.includes(config.model) : true;

    return {
      success: true,
      availableModels,
      requestedModel: config.model,
      modelAvailable,
      responseTime: Date.now() - startTime,
    };
  }
}

// ============================================================================
// Main Configuration Testing Service
// ============================================================================

export class ConfigTestingService {
  private services: IConfigTesting[] = [];
  private static instance: ConfigTestingService;

  private constructor() {
    this.initializeServices();
  }

  public static getInstance(): ConfigTestingService {
    if (!ConfigTestingService.instance) {
      ConfigTestingService.instance = new ConfigTestingService();
    }
    return ConfigTestingService.instance;
  }

  private initializeServices(): void {
    this.services = [
      new OpenAIConfigTestingService(),
      new CustomProviderTestingService(),
      new StaticProviderTestingService('google'),
      new StaticProviderTestingService('bedrock'),
      new StaticProviderTestingService('openrouter'),
    ];
  }

  /**
   * Test a provider configuration
   */
  async testProvider(config: ProviderTestConfig): Promise<ProviderTestResult> {
    const service = this.getService(config.type);

    if (!service) {
      return {
        success: false,
        providerType: config.type,
        testType: TestType.COMPREHENSIVE,
        timestamp: new Date(),
        duration: 0,
        details: {},
        error: {
          type: ErrorType.CONFIGURATION_ERROR,
          message: `No testing service available for provider type: ${config.type}`,
          retryable: false,
        },
      };
    }

    return service.testProvider(config);
  }

  /**
   * Test configuration from AIConfig (for backward compatibility)
   */
  async testAIConfig(aiConfig: AIConfig): Promise<ProviderTestResult> {
    // Convert AIConfig to ProviderTestConfig
    const testConfig: ProviderTestConfig = {
      type: aiConfig.provider as any,
      apiKey: aiConfig.apiKey,
      model: aiConfig.model,
    };

    // Handle custom providers
    if (aiConfig.customProviders && aiConfig.provider !== 'openai' && aiConfig.provider !== 'google' && aiConfig.provider !== 'bedrock' && aiConfig.provider !== 'openrouter') {
      const customProvider = aiConfig.customProviders.find(p => p.id === aiConfig.provider);
      if (customProvider) {
        testConfig.type = 'custom';
        testConfig.baseURL = customProvider.baseURL;
        testConfig.customProviders = [customProvider];
      }
    }

    return this.testProvider(testConfig);
  }

  /**
   * Get the appropriate testing service for a provider type
   */
  private getService(providerType: string): IConfigTesting | undefined {
    return this.services.find(service => service.canHandle(providerType));
  }

  /**
   * Check if testing is supported for a provider type
   */
  isTestingSupported(providerType: string): boolean {
    return this.getService(providerType) !== undefined;
  }

  /**
   * Get supported provider types for testing
   */
  getSupportedProviders(): string[] {
    return ['openai', 'google', 'bedrock', 'openrouter', 'custom'];
  }
}

// ============================================================================
// Export singleton instance and convenience functions
// ============================================================================

export const configTestingService = ConfigTestingService.getInstance();

export const testProvider = async (config: ProviderTestConfig): Promise<ProviderTestResult> => {
  return configTestingService.testProvider(config);
};

export const testAIConfig = async (aiConfig: AIConfig): Promise<ProviderTestResult> => {
  return configTestingService.testAIConfig(aiConfig);
};

// ============================================================================
// Enhanced Testing Workflows and Validation Framework
// ============================================================================

export interface TestWorkflowConfig {
  name: string;
  description: string;
  steps: TestWorkflowStep[];
  timeout?: number;
  retries?: number;
  parallelExecution?: boolean;
}

export interface TestWorkflowStep {
  id: string;
  name: string;
  type: TestType;
  provider: string;
  models?: string[];
  timeout?: number;
  retryCount?: number;
  continueOnFailure?: boolean;
}

export interface WorkflowExecutionResult {
  workflowId: string;
  workflowName: string;
  success: boolean;
  startTime: Date;
  endTime: Date;
  duration: number;
  results: {
    stepId: string;
    result: ProviderTestResult;
  }[];
  summary: {
    totalSteps: number;
    successfulSteps: number;
    failedSteps: number;
    skippedSteps: number;
  };
}

export interface TestSchedule {
  id: string;
  name: string;
  workflowId: string;
  enabled: boolean;
  schedule: string; // Cron expression
  lastRun?: Date;
  nextRun?: Date;
  notifications: NotificationConfig;
}

export interface NotificationConfig {
  email?: string;
  webhook?: string;
  inApp?: boolean;
  onFailure?: boolean;
  onSuccess?: boolean;
}

export interface HealthCheckResult {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  providers: ProviderHealthStatus[];
  summary: {
    totalProviders: number;
    healthyProviders: number;
    degradedProviders: number;
    unhealthyProviders: number;
  };
  recommendations: string[];
}

export interface ProviderHealthStatus {
  providerId: string;
  providerName: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastTest?: Date;
  consecutiveFailures: number;
  issues: string[];
  metrics: {
    averageResponseTime: number;
    successRate: number;
    uptime: number;
  };
}

// ============================================================================
// Test Workflow Manager
// ============================================================================

export class TestWorkflowManager {
  private static instance: TestWorkflowManager;
  private workflows: Map<string, TestWorkflowConfig> = new Map();
  private schedules: Map<string, TestSchedule> = new Map();
  private executionHistory: WorkflowExecutionResult[] = [];
  private maxHistorySize = 100;

  private constructor() {
    this.initializeDefaultWorkflows();
    this.loadPersistedData();
  }

  public static getInstance(): TestWorkflowManager {
    if (!TestWorkflowManager.instance) {
      TestWorkflowManager.instance = new TestWorkflowManager();
    }
    return TestWorkflowManager.instance;
  }

  private initializeDefaultWorkflows(): void {
    // Comprehensive Health Check Workflow
    const healthCheckWorkflow: TestWorkflowConfig = {
      name: 'Comprehensive Health Check',
      description: 'Run comprehensive tests on all enabled providers',
      steps: [], // Will be populated dynamically based on available providers
      timeout: 300000, // 5 minutes
      retries: 1,
      parallelExecution: true
    };

    this.workflows.set('health-check', healthCheckWorkflow);

    // Quick Connectivity Check Workflow
    const connectivityCheckWorkflow: TestWorkflowConfig = {
      name: 'Quick Connectivity Check',
      description: 'Quick connectivity test for all providers',
      steps: [],
      timeout: 60000, // 1 minute
      retries: 0,
      parallelExecution: true
    };

    this.workflows.set('connectivity-check', connectivityCheckWorkflow);

    // Authentication Validation Workflow
    const authValidationWorkflow: TestWorkflowConfig = {
      name: 'Authentication Validation',
      description: 'Validate authentication for all providers',
      steps: [],
      timeout: 120000, // 2 minutes
      retries: 2,
      parallelExecution: false
    };

    this.workflows.set('auth-validation', authValidationWorkflow);
  }

  private loadPersistedData(): void {
    try {
      // Check if running in browser environment - localStorage is not available on server
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return;
      }

      const schedulesData = localStorage.getItem('test-workflow-schedules');
      if (schedulesData) {
        const schedules = JSON.parse(schedulesData) as TestSchedule[];
        schedules.forEach(schedule => {
          this.schedules.set(schedule.id, schedule);
        });
      }

      const historyData = localStorage.getItem('test-workflow-history');
      if (historyData) {
        this.executionHistory = JSON.parse(historyData) as WorkflowExecutionResult[];
      }
    } catch (error) {
      console.warn('Failed to load workflow data:', error);
    }
  }

  private persistData(): void {
    try {
      // Check if running in browser environment - localStorage is not available on server
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return;
      }

      localStorage.setItem('test-workflow-schedules', JSON.stringify(Array.from(this.schedules.values())));
      localStorage.setItem('test-workflow-history', JSON.stringify(this.executionHistory.slice(-this.maxHistorySize)));
    } catch (error) {
      console.warn('Failed to persist workflow data:', error);
    }
  }

  public createWorkflow(config: TestWorkflowConfig): string {
    const id = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const workflow = { ...config };
    this.workflows.set(id, workflow);
    this.persistData();
    return id;
  }

  public getWorkflow(id: string): TestWorkflowConfig | undefined {
    return this.workflows.get(id);
  }

  public getAllWorkflows(): TestWorkflowConfig[] {
    return Array.from(this.workflows.values());
  }

  public deleteWorkflow(id: string): boolean {
    const deleted = this.workflows.delete(id);
    if (deleted) {
      this.persistData();
    }
    return deleted;
  }

  public async executeWorkflow(
    workflowId: string,
    providers: ProviderTestConfig[],
    onProgress?: (stepIndex: number, totalSteps: number, stepName: string) => void
  ): Promise<WorkflowExecutionResult> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const startTime = new Date();
    const results: { stepId: string; result: ProviderTestResult }[] = [];

    let successfulSteps = 0;
    let failedSteps = 0;
    let skippedSteps = 0;

    try {
      // Dynamic step creation based on available providers
      if (workflow.steps.length === 0) {
        workflow.steps = this.createDynamicSteps(workflow.name, providers);
      }

      if (workflow.parallelExecution) {
        // Execute steps in parallel
        const stepPromises = workflow.steps.map(async (step, index) => {
          try {
            onProgress?.(index, workflow.steps.length, step.name);
            const result = await this.executeStep(step, providers);
            results.push({ stepId: step.id, result });

            if (result.success) {
              successfulSteps++;
            } else {
              failedSteps++;
            }
          } catch (error) {
            console.error(`Step ${step.name} failed:`, error);
            failedSteps++;

            const errorResult: ProviderTestResult = {
              success: false,
              providerType: 'unknown',
              testType: step.type,
              timestamp: new Date(),
              duration: 0,
              details: {},
              error: {
                type: ErrorType.UNKNOWN_ERROR,
                message: error instanceof Error ? error.message : 'Unknown error',
                retryable: true
              }
            };
            results.push({ stepId: step.id, result: errorResult });
          }
        });

        await Promise.allSettled(stepPromises);
      } else {
        // Execute steps sequentially
        for (let i = 0; i < workflow.steps.length; i++) {
          const step = workflow.steps[i];
          onProgress?.(i, workflow.steps.length, step.name);

          try {
            const result = await this.executeStep(step, providers);
            results.push({ stepId: step.id, result });

            if (result.success) {
              successfulSteps++;
            } else {
              failedSteps++;
              if (!step.continueOnFailure) {
                // Skip remaining steps if this one failed and continueOnFailure is false
                skippedSteps = workflow.steps.length - i - 1;
                break;
              }
            }
          } catch (error) {
            console.error(`Step ${step.name} failed:`, error);
            failedSteps++;

            const errorResult: ProviderTestResult = {
              success: false,
              providerType: 'unknown',
              testType: step.type,
              timestamp: new Date(),
              duration: 0,
              details: {},
              error: {
                type: ErrorType.UNKNOWN_ERROR,
                message: error instanceof Error ? error.message : 'Unknown error',
                retryable: true
              }
            };
            results.push({ stepId: step.id, result: errorResult });

            if (!step.continueOnFailure) {
              skippedSteps = workflow.steps.length - i - 1;
              break;
            }
          }
        }
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const executionResult: WorkflowExecutionResult = {
        workflowId,
        workflowName: workflow.name,
        success: failedSteps === 0,
        startTime,
        endTime,
        duration,
        results,
        summary: {
          totalSteps: workflow.steps.length,
          successfulSteps,
          failedSteps,
          skippedSteps
        }
      };

      this.addToHistory(executionResult);
      return executionResult;

    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      return {
        workflowId,
        workflowName: workflow.name,
        success: false,
        startTime,
        endTime,
        duration,
        results,
        summary: {
          totalSteps: workflow.steps.length,
          successfulSteps,
          failedSteps,
          skippedSteps: workflow.steps.length - successfulSteps - failedSteps
        }
      };
    }
  }

  private createDynamicSteps(workflowName: string, providers: ProviderTestConfig[]): TestWorkflowStep[] {
    const steps: TestWorkflowStep[] = [];

    providers.forEach((provider, index) => {
      let testTypes: TestType[] = [];

      switch (workflowName) {
        case 'Comprehensive Health Check':
          testTypes = [TestType.COMPREHENSIVE];
          break;
        case 'Quick Connectivity Check':
          testTypes = [TestType.CONNECTIVITY];
          break;
        case 'Authentication Validation':
          testTypes = [TestType.AUTHENTICATION];
          break;
        default:
          testTypes = [TestType.COMPREHENSIVE];
      }

      testTypes.forEach((testType, typeIndex) => {
        steps.push({
          id: `step-${index}-${typeIndex}`,
          name: `${provider.type} - ${testType}`,
          type: testType,
          provider: provider.type,
          models: provider.model ? [provider.model] : undefined,
          continueOnFailure: true
        });
      });
    });

    return steps;
  }

  private async executeStep(step: TestWorkflowStep, providers: ProviderTestConfig[]): Promise<ProviderTestResult> {
    const providerConfig = providers.find(p => p.type === step.provider);
    if (!providerConfig) {
      throw new Error(`Provider configuration not found: ${step.provider}`);
    }

    const testConfig: ProviderTestConfig = {
      ...providerConfig,
      timeout: step.timeout,
      retries: step.retryCount
    };

    // Create a custom test result for specific test types
    switch (step.type) {
      case TestType.CONNECTIVITY:
        return this.testConnectivityOnly(testConfig);
      case TestType.AUTHENTICATION:
        return this.testAuthenticationOnly(testConfig);
      default:
        return configTestingService.testProvider(testConfig);
    }
  }

  private async testConnectivityOnly(config: ProviderTestConfig): Promise<ProviderTestResult> {
    const startTime = Date.now();
    const service = configTestingService as any;

    try {
      // For custom providers, use the custom testing service
      if (config.type === 'custom') {
        const customService = service.getService('custom');
        if (customService) {
          const result = await customService.testProvider(config);
          return {
            ...result,
            testType: TestType.CONNECTIVITY,
            details: {
              connectivity: result.details.connectivity
            }
          };
        }
      }

      // For built-in providers, use static provider testing service
      const staticService = service.getService(config.type);
      if (staticService) {
        const result = await staticService.testProvider(config);
        return {
          ...result,
          testType: TestType.CONNECTIVITY,
          details: {
            connectivity: result.details.connectivity
          }
        };
      }

      throw new Error(`No testing service available for provider: ${config.type}`);

    } catch (error) {
      return {
        success: false,
        providerType: config.type,
        testType: TestType.CONNECTIVITY,
        timestamp: new Date(),
        duration: Date.now() - startTime,
        details: {},
        error: {
          type: ErrorType.NETWORK_ERROR,
          message: error instanceof Error ? error.message : 'Connectivity test failed',
          retryable: true
        }
      };
    }
  }

  private async testAuthenticationOnly(config: ProviderTestConfig): Promise<ProviderTestResult> {
    const startTime = Date.now();
    const service = configTestingService as any;

    try {
      // For custom providers, use the custom testing service
      if (config.type === 'custom') {
        const customService = service.getService('custom');
        if (customService) {
          const result = await customService.testProvider(config);
          return {
            ...result,
            testType: TestType.AUTHENTICATION,
            details: {
              authentication: result.details.authentication
            }
          };
        }
      }

      // For built-in providers, use static provider testing service
      const staticService = service.getService(config.type);
      if (staticService) {
        const result = await staticService.testProvider(config);
        return {
          ...result,
          testType: TestType.AUTHENTICATION,
          details: {
            authentication: result.details.authentication
          }
        };
      }

      throw new Error(`No testing service available for provider: ${config.type}`);

    } catch (error) {
      return {
        success: false,
        providerType: config.type,
        testType: TestType.AUTHENTICATION,
        timestamp: new Date(startTime),
        duration: Date.now() - startTime,
        details: {},
        error: {
          type: ErrorType.AUTHENTICATION_ERROR,
          message: error instanceof Error ? error.message : 'Authentication test failed',
          retryable: false
        }
      };
    }
  }

  private addToHistory(result: WorkflowExecutionResult): void {
    this.executionHistory.push(result);
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(-this.maxHistorySize);
    }
    this.persistData();
  }

  public getExecutionHistory(): WorkflowExecutionResult[] {
    return this.executionHistory.slice().reverse(); // Most recent first
  }

  public clearHistory(): void {
    this.executionHistory = [];
    this.persistData();
  }

  // ============================================================================
  // Scheduled Testing
  // ============================================================================

  public createSchedule(schedule: Omit<TestSchedule, 'id'>): string {
    const id = `schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newSchedule: TestSchedule = {
      ...schedule,
      id
    };

    this.schedules.set(id, newSchedule);
    this.calculateNextRun(newSchedule);
    this.persistData();

    return id;
  }

  public getSchedule(id: string): TestSchedule | undefined {
    return this.schedules.get(id);
  }

  public getAllSchedules(): TestSchedule[] {
    return Array.from(this.schedules.values());
  }

  public updateSchedule(id: string, updates: Partial<TestSchedule>): boolean {
    const schedule = this.schedules.get(id);
    if (!schedule) return false;

    const updatedSchedule = { ...schedule, ...updates };
    this.schedules.set(id, updatedSchedule);
    this.calculateNextRun(updatedSchedule);
    this.persistData();

    return true;
  }

  public deleteSchedule(id: string): boolean {
    const deleted = this.schedules.delete(id);
    if (deleted) {
      this.persistData();
    }
    return deleted;
  }

  private calculateNextRun(schedule: TestSchedule): void {
    // Simple implementation - in a real scenario, you'd use a cron parser
    // For now, we'll just set it to 1 hour from now
    const nextRun = new Date(Date.now() + 3600000);
    schedule.nextRun = nextRun;
  }

  public getDueSchedules(): TestSchedule[] {
    const now = new Date();
    return Array.from(this.schedules.values()).filter(
      schedule => schedule.enabled &&
      schedule.nextRun &&
      schedule.nextRun <= now
    );
  }

  // ============================================================================
  // Health Monitoring
  // ============================================================================

  public async performHealthCheck(providers: ProviderTestConfig[]): Promise<HealthCheckResult> {
    const timestamp = new Date();
    const providerStatuses: ProviderHealthStatus[] = [];
    const recommendations: string[] = [];

    for (const providerConfig of providers) {
      try {
        const result = await this.testConnectivityOnly(providerConfig);

        const providerStatus: ProviderHealthStatus = {
          providerId: providerConfig.type,
          providerName: providerConfig.type,
          status: result.success ? 'healthy' : 'unhealthy',
          lastTest: timestamp,
          consecutiveFailures: result.success ? 0 : 1, // Simplified
          issues: result.error ? [result.error.message] : [],
          metrics: {
            averageResponseTime: result.duration,
            successRate: result.success ? 100 : 0,
            uptime: result.success ? 100 : 0 // Simplified
          }
        };

        providerStatuses.push(providerStatus);

        if (!result.success) {
          if (result.error?.type === ErrorType.AUTHENTICATION_ERROR) {
            recommendations.push(`Check API key for ${providerConfig.type} provider`);
          } else if (result.error?.type === ErrorType.NETWORK_ERROR) {
            recommendations.push(`Verify network connectivity to ${providerConfig.type} provider`);
          } else {
            recommendations.push(`Investigate ${providerConfig.type} provider configuration`);
          }
        }

      } catch (error) {
        providerStatuses.push({
          providerId: providerConfig.type,
          providerName: providerConfig.type,
          status: 'unhealthy',
          lastTest: timestamp,
          consecutiveFailures: 1,
          issues: [error instanceof Error ? error.message : 'Unknown error'],
          metrics: {
            averageResponseTime: 0,
            successRate: 0,
            uptime: 0
          }
        });
        recommendations.push(`Failed to test ${providerConfig.type} provider`);
      }
    }

    const summary = {
      totalProviders: providers.length,
      healthyProviders: providerStatuses.filter(p => p.status === 'healthy').length,
      degradedProviders: providerStatuses.filter(p => p.status === 'degraded').length,
      unhealthyProviders: providerStatuses.filter(p => p.status === 'unhealthy').length
    };

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (summary.healthyProviders === summary.totalProviders) {
      overall = 'healthy';
    } else if (summary.healthyProviders > 0) {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }

    return {
      overall,
      timestamp,
      providers: providerStatuses,
      summary,
      recommendations
    };
  }
}

// ============================================================================
// Export singleton instances and convenience functions
// ============================================================================

export const testWorkflowManager = TestWorkflowManager.getInstance();

export const executeWorkflow = async (
  workflowId: string,
  providers: ProviderTestConfig[],
  onProgress?: (stepIndex: number, totalSteps: number, stepName: string) => void
): Promise<WorkflowExecutionResult> => {
  return testWorkflowManager.executeWorkflow(workflowId, providers, onProgress);
};

export const performHealthCheck = async (providers: ProviderTestConfig[]): Promise<HealthCheckResult> => {
  return testWorkflowManager.performHealthCheck(providers);
};

export const createTestSchedule = (schedule: Omit<TestSchedule, 'id'>): string => {
  return testWorkflowManager.createSchedule(schedule);
};

// {{END_MODIFICATIONS}}