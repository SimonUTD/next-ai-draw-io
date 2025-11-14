// ============================================================================
// AI Model Creation Functions
// ============================================================================

import { openai, createOpenAI } from "@ai-sdk/openai";
import { google, createGoogleGenerativeAI } from "@ai-sdk/google";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { providerRegistry, createModelFromConfig as newCreateModelFromConfig } from "./provider-registry";
import type { AIConfig, CustomProvider } from './ai-config-types';

/**
 * @deprecated Use the new ProviderRegistry system instead. This function is maintained for backward compatibility.
 * Create a model instance from configuration
 */
export function createModelFromConfig(config: AIConfig): any {
  // Log deprecation warning in development
  if (process.env.NODE_ENV === 'development') {
    console.warn('createModelFromConfig is deprecated. Consider using ProviderRegistry directly for new implementations.');
  }

  try {
    // Use the new ProviderRegistry system
    return newCreateModelFromConfig(config);
  } catch (error) {
    // Fallback to legacy implementation for maximum compatibility
    console.warn('ProviderRegistry failed, falling back to legacy implementation:', error);
    return createModelFromConfigLegacy(config);
  }
}

/**
 * Legacy implementation of createModelFromConfig for fallback compatibility
 */
function createModelFromConfigLegacy(config: AIConfig): any {
  switch (config.provider) {
    case "openai": {
      if (config.apiKey) {
        const customOpenAI = createOpenAI({
          apiKey: config.apiKey,
        });
        return customOpenAI(config.model);
      }
      return openai(config.model);
    }

    case "google": {
      if (config.apiKey) {
        const customGoogle = createGoogleGenerativeAI({
          apiKey: config.apiKey,
        });
        return customGoogle(config.model);
      }
      return google(config.model);
    }

    case "bedrock": {
      // Bedrock uses AWS credentials - check for region configuration
      const region = config.region || process.env.AWS_REGION;
      const accessKeyId = config.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
      const secretAccessKey = config.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;
      
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

    case "openrouter": {
      const openrouter = createOpenRouter({
        apiKey: config.apiKey || process.env.OPENROUTER_API_KEY,
      });
      return openrouter(config.model);
    }

    default: {
      // Handle custom providers
      if (config.customProviders) {
        const customProvider = config.customProviders.find(p => p.id === config.provider);
        if (customProvider) {
          if (customProvider.type === 'openai-compatible') {
            // Use standard OpenAI client for all OpenAI-compatible endpoints
            const customOpenAI = createOpenAI({
              apiKey: customProvider.apiKey || config.apiKey || '',
              baseURL: customProvider.baseURL,
            });
            return customOpenAI(config.model);
          } else if (customProvider.type === 'custom-api') {
            // For custom API types, we need to create a wrapper that implements the AI SDK interface
            throw new Error(`Custom API type '${customProvider.type}' is not supported in legacy mode. Please use the ProviderRegistry system.`);
          }
        } else {
          throw new Error(`Custom provider '${config.provider}' not found in customProviders array`);
        }
      }
      throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }
}