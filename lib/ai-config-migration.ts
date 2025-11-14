// ============================================================================
// AI Configuration Migration - V1 to V2
// ============================================================================

import { AIConfigV1, AIConfigV2, ProviderConfig, ModelConfig } from './ai-config-types-v2';
import { BUILT_IN_PROVIDERS, BUILT_IN_MODELS } from './ai-config-constants-v2';

/**
 * 检测配置版本
 */
export function detectConfigVersion(config: any): 1 | 2 {
  if (config && config.version === 2) {
    return 2;
  }
  return 1;
}

/**
 * 将V1配置迁移到V2
 */
export function migrateToV2(v1Config: AIConfigV1): AIConfigV2 {
  // 深拷贝内置配置
  const providers: ProviderConfig[] = JSON.parse(JSON.stringify(BUILT_IN_PROVIDERS));
  const models: ModelConfig[] = JSON.parse(JSON.stringify(BUILT_IN_MODELS));
  
  // 1. 迁移当前Provider的认证信息
  const activeProvider = providers.find(p => p.id === v1Config.provider);
  if (activeProvider) {
    activeProvider.apiKey = v1Config.apiKey;
    activeProvider.region = v1Config.region;
    activeProvider.accessKeyId = v1Config.accessKeyId;
    activeProvider.secretAccessKey = v1Config.secretAccessKey;
  }
  
  // 2. 处理禁用的内置Providers
  if (v1Config.disabledProviders) {
    v1Config.disabledProviders.forEach(disabledId => {
      const provider = providers.find(p => p.id === disabledId);
      if (provider) {
        provider.enabled = false;
      }
    });
  }
  
  // 3. 迁移自定义Providers和Models
  if (v1Config.customProviders) {
    v1Config.customProviders.forEach(cp => {
      // 添加自定义Provider
      providers.push({
        id: cp.id,
        name: cp.name,
        type: 'custom',
        baseURL: cp.baseURL,
        apiKey: cp.apiKey,
        enabled: cp.enabled,
        isBuiltIn: false,
      });
      
      // 添加自定义Provider的Models
      cp.models.forEach(m => {
        models.push({
          id: `${cp.id}-${m.id}`,
          name: m.name,
          providerId: cp.id,
          parameters: m.parameters,
          enabled: true,
          isBuiltIn: false,
        });
      });
    });
  }
  
  // 4. 更新当前激活Model的参数
  if (v1Config.parameters) {
    const activeModel = models.find(m => 
      m.providerId === v1Config.provider && m.name === v1Config.model
    );
    if (activeModel) {
      activeModel.parameters = {
        temperature: v1Config.parameters.temperature ?? activeModel.parameters.temperature,
        maxTokens: v1Config.parameters.maxTokens ?? activeModel.parameters.maxTokens,
        topP: v1Config.parameters.topP ?? activeModel.parameters.topP,
      };
    }
  }
  
  // 5. 确定激活的Model ID
  const activeModelId = models.find(m => 
    m.providerId === v1Config.provider && m.name === v1Config.model
  )?.id || models[0].id;
  
  return {
    version: 2,
    providers,
    models,
    activeProviderId: v1Config.provider,
    activeModelId,
  };
}

/**
 * 获取默认V2配置（从环境变量）
 */
export function getDefaultV2Config(): AIConfigV2 {
  const providers = JSON.parse(JSON.stringify(BUILT_IN_PROVIDERS));
  const models = JSON.parse(JSON.stringify(BUILT_IN_MODELS));
  
  // 从环境变量设置Bedrock配置
  const bedrockProvider = providers.find((p: ProviderConfig) => p.id === 'bedrock');
  if (bedrockProvider) {
    bedrockProvider.region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
    bedrockProvider.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    bedrockProvider.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  }
  
  return {
    version: 2,
    providers,
    models,
    activeProviderId: 'bedrock',
    activeModelId: 'bedrock-claude-sonnet-4-5',
  };
}