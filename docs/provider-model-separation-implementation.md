# Provider与Model分离 - 详细实现规范

## 文件修改清单

### 1. 类型定义文件

#### `lib/ai-config-types-v2.ts` (新建)

```typescript
// Provider类型
export type ProviderType = 'openai' | 'google' | 'bedrock' | 'openrouter' | 'custom';

// Provider配置
export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  baseURL?: string;              // 自定义Provider的API端点
  apiKey?: string;               // API密钥（加密存储）
  region?: string;               // AWS Bedrock区域
  accessKeyId?: string;          // AWS访问密钥
  secretAccessKey?: string;      // AWS密钥（加密）
  enabled: boolean;
  isBuiltIn: boolean;
  metadata?: Record<string, any>;
}

// Model配置
export interface ModelConfig {
  id: string;
  name: string;
  providerId: string;            // 关联的Provider ID
  parameters: {
    temperature: number;
    maxTokens?: number;
    topP?: number;
  };
  enabled: boolean;
  isBuiltIn: boolean;
}

// 新版AI配置
export interface AIConfigV2 {
  version: 2;
  providers: ProviderConfig[];
  models: ModelConfig[];
  activeProviderId: string;
  activeModelId: string;
}

// 旧版配置（用于迁移）
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
```

### 2. 常量定义文件

#### `lib/ai-config-constants-v2.ts` (新建)

```typescript
import { ProviderConfig, ModelConfig } from './ai-config-types-v2';

// 内置Providers
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

// 内置Models
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
```

### 3. 数据迁移文件

#### `lib/ai-config-migration.ts` (新建)

```typescript
import { AIConfigV1, AIConfigV2, ProviderConfig, ModelConfig } from './ai-config-types-v2';
import { BUILT_IN_PROVIDERS, BUILT_IN_MODELS } from './ai-config-constants-v2';

export function migrateToV2(v1Config: AIConfigV1): AIConfigV2 {
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

export function detectConfigVersion(config: any): 1 | 2 {
  if (config.version === 2) return 2;
  return 1;
}
```

### 4. Context更新

#### `contexts/ai-config-context.tsx` 修改要点

```typescript
// 新增接口方法
interface AIConfigContextType {
  config: AIConfigV2;
  
  // Provider管理
  updateProvider: (providerId: string, updates: Partial<ProviderConfig>) => Promise<void>;
  addProvider: (provider: Omit<ProviderConfig, 'id' | 'isBuiltIn'>) => Promise<void>;
  removeProvider: (providerId: string) => Promise<void>;
  toggleProvider: (providerId: string) => Promise<void>;
  
  // Model管理
  updateModel: (modelId: string, updates: Partial<ModelConfig>) => Promise<void>;
  addModel: (model: Omit<ModelConfig, 'id' | 'isBuiltIn'>) => Promise<void>;
  removeModel: (modelId: string) => Promise<void>;
  toggleModel: (modelId: string) => Promise<void>;
  
  // 激活配置
  setActiveConfig: (providerId: string, modelId: string) => Promise<void>;
  
  // 工具方法
  getActiveProvider: () => ProviderConfig | undefined;
  getActiveModel: () => ModelConfig | undefined;
  getProviderModels: (providerId: string) => ModelConfig[];
  
  resetToEnv: () => void;
  isUsingEnvConfig: boolean;
}

// 加载配置时自动迁移
useEffect(() => {
  const loadConfig = async () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsedConfig = JSON.parse(stored);
      const version = detectConfigVersion(parsedConfig);
      
      let finalConfig: AIConfigV2;
      if (version === 1) {
        // 迁移V1到V2
        finalConfig = migrateToV2(parsedConfig);
        // 备份旧配置
        localStorage.setItem(`${STORAGE_KEY}_v1_backup`, stored);
      } else {
        finalConfig = parsedConfig;
      }
      
      // 解密API Keys
      // ... 解密逻辑
      
      setConfig(finalConfig);
    }
  };
  loadConfig();
}, []);
```

### 5. UI组件

#### `components/provider-management-dialog.tsx` (新建)

Provider管理对话框，用于：
- 查看所有Providers
- 编辑Provider的API Key、Base URL等
- 启用/禁用Provider
- 删除自定义Provider

#### `components/model-management-dialog.tsx` (新建)

Model管理对话框，用于：
- 按Provider分组显示Models
- 编辑Model参数
- 添加自定义Model
- 启用/禁用Model
- 删除自定义Model

#### `components/model-config-dialog.tsx` 修改

简化为快速切换界面：
- 选择Provider
- 选择Model
- 显示当前配置摘要
- 提供到详细管理的入口

### 6. API调用适配

#### `app/api/chat/route.ts` 修改要点

```typescript
// 获取激活配置
const config = getStoredConfig(); // AIConfigV2
const provider = config.providers.find(p => p.id === config.activeProviderId);
const model = config.models.find(m => m.id === config.activeModelId);

// 根据Provider类型调用相应API
switch (provider.type) {
  case 'openai':
    // 使用provider.apiKey和model.name
    break;
  case 'google':
    // 使用provider.apiKey和model.name
    break;
  case 'bedrock':
    // 使用provider.region, accessKeyId, secretAccessKey和model.name
    break;
  case 'custom':
    // 使用provider.baseURL, apiKey和model.name
    break;
}
```

## 实施顺序

1. 创建新类型定义文件 (`ai-config-types-v2.ts`)
2. 创建常量定义文件 (`ai-config-constants-v2.ts`)
3. 创建迁移函数 (`ai-config-migration.ts`)
4. 更新Context (`ai-config-context.tsx`)
5. 创建Provider管理组件 (`provider-management-dialog.tsx`)
6. 创建Model管理组件 (`model-management-dialog.tsx`)
7. 更新快速切换组件 (`model-config-dialog.tsx`)
8. 更新API路由 (`app/api/chat/route.ts`)
9. 测试所有功能

## 测试检查清单

- [ ] 旧配置自动迁移到新结构
- [ ] 内置Provider可以编辑API Key
- [ ] 内置Provider可以启用/禁用
- [ ] 自定义Provider可以编辑所有字段
- [ ] 自定义Provider可以删除
- [ ] 内置Model可以编辑参数
- [ ] 内置Model可以启用/禁用
- [ ] 自定义Model可以添加/编辑/删除
- [ ] 快速切换功能正常
- [ ] API调用使用正确的配置
- [ ] 加密/解密功能正常
- [ ] 配置持久化正常