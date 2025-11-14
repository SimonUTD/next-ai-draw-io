// ============================================================================
// AI Configuration Adapter - V2 to Legacy Format
// ============================================================================

import { AIConfigV2 } from './ai-config-types-v2';

/**
 * 将V2配置转换为API路由可以使用的格式
 */
export function adaptV2ConfigForAPI(configV2: AIConfigV2): any {
  const activeProvider = configV2.providers.find(p => p.id === configV2.activeProviderId);
  const activeModel = configV2.models.find(m => m.id === configV2.activeModelId);
  
  if (!activeProvider || !activeModel) {
    throw new Error('Active provider or model not found');
  }
  
  // 构建customProviders数组（仅包含自定义Provider）
  const customProviders = configV2.providers
    .filter(p => p.type === 'custom')
    .map(p => ({
      id: p.id,
      name: p.name,
      type: 'openai-compatible' as const,
      baseURL: p.baseURL || '',
      apiKey: p.apiKey,
      enabled: p.enabled,
      models: configV2.models
        .filter(m => m.providerId === p.id)
        .map(m => ({
          id: m.id,
          name: m.name,
          parameters: m.parameters
        }))
    }));
  
  return {
    provider: activeProvider.id,
    model: activeModel.name,
    apiKey: activeProvider.apiKey,
    region: activeProvider.region,
    accessKeyId: activeProvider.accessKeyId,
    secretAccessKey: activeProvider.secretAccessKey,
    parameters: activeModel.parameters,
    customProviders,
  };
}