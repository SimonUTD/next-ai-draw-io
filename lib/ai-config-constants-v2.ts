// ============================================================================
// AI Configuration Constants V2
// ============================================================================

import { ProviderConfig, ModelConfig } from './ai-config-types-v2';

/**
 * 内置Providers配置
 */
export const BUILT_IN_PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'google',
    name: 'Google Gemini',
    type: 'google',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'bedrock',
    name: 'AWS Bedrock',
    type: 'bedrock',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    type: 'openrouter',
    enabled: true,
    isBuiltIn: true,
  }
];

/**
 * 内置Models配置
 */
export const BUILT_IN_MODELS: ModelConfig[] = [
  // OpenAI Models
  {
    id: 'openai-gpt4-turbo',
    name: 'gpt-4-turbo',
    providerId: 'openai',
    parameters: { temperature: 0.7, maxTokens: 4096, topP: 1 },
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'openai-gpt4',
    name: 'gpt-4',
    providerId: 'openai',
    parameters: { temperature: 0.7, maxTokens: 8192, topP: 1 },
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'openai-gpt35-turbo',
    name: 'gpt-3.5-turbo',
    providerId: 'openai',
    parameters: { temperature: 0.7, maxTokens: 4096, topP: 1 },
    enabled: true,
    isBuiltIn: true,
  },
  
  // Google Models
  {
    id: 'google-gemini-2.5-flash',
    name: 'gemini-2.5-flash-preview-05-20',
    providerId: 'google',
    parameters: { temperature: 0.9, maxTokens: 96000, topP: 1 },
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'google-gemini-2.5-pro',
    name: 'gemini-2.5-pro',
    providerId: 'google',
    parameters: { temperature: 0.9, maxTokens: 96000, topP: 1 },
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'google-gemini-pro',
    name: 'gemini-pro',
    providerId: 'google',
    parameters: { temperature: 0.9, maxTokens: 32000, topP: 1 },
    enabled: true,
    isBuiltIn: true,
  },
  
  // Bedrock Models
  {
    id: 'bedrock-claude-sonnet-4-5',
    name: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
    providerId: 'bedrock',
    parameters: { temperature: 0, maxTokens: 8192, topP: 1 },
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'bedrock-claude-sonnet-4',
    name: 'anthropic.claude-sonnet-4-20250514-v1:0',
    providerId: 'bedrock',
    parameters: { temperature: 0, maxTokens: 8192, topP: 1 },
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'bedrock-claude-3-5-sonnet',
    name: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    providerId: 'bedrock',
    parameters: { temperature: 0, maxTokens: 8192, topP: 1 },
    enabled: true,
    isBuiltIn: true,
  },
  
  // OpenRouter Models
  {
    id: 'openrouter-claude-3.5-sonnet',
    name: 'anthropic/claude-3.5-sonnet',
    providerId: 'openrouter',
    parameters: { temperature: 0.7, maxTokens: 8192, topP: 1 },
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'openrouter-gemini-pro',
    name: 'google/gemini-pro',
    providerId: 'openrouter',
    parameters: { temperature: 0.7, maxTokens: 32000, topP: 1 },
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'openrouter-gpt4-turbo',
    name: 'openai/gpt-4-turbo',
    providerId: 'openrouter',
    parameters: { temperature: 0.7, maxTokens: 4096, topP: 1 },
    enabled: true,
    isBuiltIn: true,
  },
];