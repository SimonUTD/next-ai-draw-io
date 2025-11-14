# Provider与Model配置分离架构设计

## 问题描述

当前架构将Provider配置（API Key、Base URL）和Model配置混在一起，导致：
1. 修改模型参数时需要重新输入API Key
2. Provider的Base URL输错后无法单独修改
3. 内置Provider和自定义Provider的管理方式不一致

## 新架构设计

### 1. 核心概念分离

```
Provider (渠道)
├── id: string
├── name: string
├── type: 'openai' | 'google' | 'bedrock' | 'openrouter' | 'custom'
├── baseURL?: string (仅自定义Provider)
├── apiKey?: string (加密存储)
├── region?: string (AWS Bedrock)
├── enabled: boolean
└── metadata: { ... }

Model (模型)
├── id: string
├── name: string
├── providerId: string (关联到Provider)
├── parameters:
│   ├── temperature: number
│   ├── maxTokens?: number
│   └── topP?: number
└── enabled: boolean

ActiveConfig (当前激活配置)
├── providerId: string
└── modelId: string
```

### 2. 数据结构

#### ProviderConfig
```typescript
interface ProviderConfig {
  id: string;                    // 唯一标识
  name: string;                  // 显示名称
  type: ProviderType;            // 类型
  baseURL?: string;              // 自定义API端点
  apiKey?: string;               // API密钥（加密）
  region?: string;               // AWS区域
  accessKeyId?: string;          // AWS访问密钥
  secretAccessKey?: string;      // AWS密钥（加密）
  enabled: boolean;              // 是否启用
  isBuiltIn: boolean;            // 是否内置
  metadata?: Record<string, any>; // 扩展元数据
}

type ProviderType = 'openai' | 'google' | 'bedrock' | 'openrouter' | 'custom';
```

#### ModelConfig
```typescript
interface ModelConfig {
  id: string;                    // 唯一标识
  name: string;                  // 模型名称
  providerId: string;            // 所属Provider ID
  parameters: {
    temperature: number;
    maxTokens?: number;
    topP?: number;
  };
  enabled: boolean;              // 是否启用
  isBuiltIn: boolean;            // 是否内置
}
```

#### AIConfig (新版本)
```typescript
interface AIConfig {
  version: 2;                    // 配置版本号
  providers: ProviderConfig[];   // 所有Provider配置
  models: ModelConfig[];         // 所有Model配置
  activeProviderId: string;      // 当前激活的Provider
  activeModelId: string;         // 当前激活的Model
}
```

### 3. 内置Provider和Model

#### 内置Providers
```typescript
const BUILT_IN_PROVIDERS: ProviderConfig[] = [
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
```

#### 内置Models
```typescript
const BUILT_IN_MODELS: ModelConfig[] = [
  // OpenAI
  { id: 'openai-gpt4-turbo', name: 'gpt-4-turbo', providerId: 'openai', ... },
  { id: 'openai-gpt4', name: 'gpt-4', providerId: 'openai', ... },
  
  // Google
  { id: 'google-gemini-2.5-flash', name: 'gemini-2.5-flash-preview-05-20', providerId: 'google', ... },
  
  // Bedrock
  { id: 'bedrock-claude-sonnet-4-5', name: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0', providerId: 'bedrock', ... },
  
  // OpenRouter
  { id: 'openrouter-claude-3.5', name: 'anthropic/claude-3.5-sonnet', providerId: 'openrouter', ... },
];
```

### 4. 数据迁移策略

#### 从旧版本迁移
```typescript
function migrateFromV1(oldConfig: OldAIConfig): AIConfig {
  // 1. 迁移Provider配置
  const providers = [...BUILT_IN_PROVIDERS];
  
  // 迁移当前Provider的API Key
  const activeProvider = providers.find(p => p.id === oldConfig.provider);
  if (activeProvider) {
    activeProvider.apiKey = oldConfig.apiKey;
    activeProvider.region = oldConfig.region;
    activeProvider.accessKeyId = oldConfig.accessKeyId;
    activeProvider.secretAccessKey = oldConfig.secretAccessKey;
  }
  
  // 迁移自定义Providers
  if (oldConfig.customProviders) {
    oldConfig.customProviders.forEach(cp => {
      providers.push({
        id: cp.id,
        name: cp.name,
        type: 'custom',
        baseURL: cp.baseURL,
        apiKey: cp.apiKey,
        enabled: cp.enabled,
        isBuiltIn: false,
      });
    });
  }
  
  // 2. 迁移Model配置
  const models = [...BUILT_IN_MODELS];
  
  // 迁移自定义Provider的Models
  if (oldConfig.customProviders) {
    oldConfig.customProviders.forEach(cp => {
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
  
  // 3. 设置当前激活配置
  const activeModelId = models.find(m => 
    m.providerId === oldConfig.provider && m.name === oldConfig.model
  )?.id || models[0].id;
  
  return {
    version: 2,
    providers,
    models,
    activeProviderId: oldConfig.provider,
    activeModelId,
  };
}
```

### 5. UI组件设计

#### Provider管理界面
- 列表显示所有Providers（内置+自定义）
- 内置Provider：只能编辑API Key、启用/禁用
- 自定义Provider：可编辑所有字段、删除

#### Model管理界面
- 按Provider分组显示Models
- 内置Model：只能编辑参数、启用/禁用
- 自定义Model：可编辑所有字段、删除

#### 快速切换界面
- 两级选择：先选Provider，再选Model
- 只显示已启用的Provider和Model

### 6. API调用适配

```typescript
function getActiveConfig(config: AIConfig) {
  const provider = config.providers.find(p => p.id === config.activeProviderId);
  const model = config.models.find(m => m.id === config.activeModelId);
  
  return {
    provider,
    model,
    apiKey: provider?.apiKey,
    baseURL: provider?.baseURL,
    parameters: model?.parameters,
  };
}
```

### 7. 存储结构

```
localStorage:
  - aiConfig: AIConfig (完整配置，API Key已加密)
  - aiConfigVersion: number (配置版本号)
```

## 实施步骤

1. ✅ 创建新的类型定义
2. 创建数据迁移函数
3. 更新Context层，支持新的数据结构
4. 创建Provider管理组件
5. 创建Model管理组件
6. 更新快速切换组件
7. 更新API调用逻辑
8. 测试迁移和所有功能

## 向后兼容

- 自动检测旧版本配置并迁移
- 迁移后保留旧配置备份（7天）
- 提供回滚机制