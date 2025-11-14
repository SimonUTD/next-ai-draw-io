// ============================================================================
// AI Configuration Types V2 - Provider与Model分离架构
// ============================================================================

/**
 * Provider类型定义
 */
export type ProviderType = 'openai' | 'google' | 'bedrock' | 'openrouter' | 'custom';

/**
 * Provider配置接口
 * 存储渠道级别的配置信息（API Key、Base URL等）
 */
export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  baseURL?: string;
  apiKey?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  enabled: boolean;
  isBuiltIn: boolean;
  metadata?: Record<string, any>;
}

/**
 * Model配置接口
 * 存储模型级别的配置信息（参数等）
 */
export interface ModelConfig {
  id: string;
  name: string;
  providerId: string;
  parameters: {
    temperature: number;
    maxTokens?: number;
    topP?: number;
  };
  enabled: boolean;
  isBuiltIn: boolean;
}

/**
 * 新版AI配置接口（V2）
 */
export interface AIConfigV2 {
  version: 2;
  providers: ProviderConfig[];
  models: ModelConfig[];
  activeProviderId: string;
  activeModelId: string;
}

/**
 * 旧版AI配置接口（V1）- 用于数据迁移
 */
export interface AIConfigV1 {
  provider: string;
  model: string;
  apiKey?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  parameters?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
  customProviders?: Array<{
    id: string;
    name: string;
    type: 'openai-compatible';
    baseURL: string;
    apiKey?: string;
    enabled: boolean;
    models: Array<{
      id: string;
      name: string;
      parameters: {
        temperature: number;
        maxTokens?: number;
        topP?: number;
      };
    }>;
  }>;
  disabledProviders?: string[];
}