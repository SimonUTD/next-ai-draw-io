# AI模型界面配置功能 - 分析结果

## 项目概述

实现AI模型的界面配置功能，允许用户通过UI动态选择和配置AI模型（OpenAI、Google、AWS Bedrock、OpenRouter），实现配置优先级逻辑（UI配置优先于环境变量配置），支持模型参数调整和持久化存储。

## 核心需求

1. **UI界面配置**: 创建用户友好的配置界面
2. **配置优先级**: UI配置 > 环境变量配置 > 默认配置
3. **多提供商支持**: OpenAI, Google Gemini, AWS Bedrock, OpenRouter
4. **参数调整**: Temperature, Max Tokens等
5. **持久化存储**: localStorage
6. **向后兼容**: 不影响现有env配置方式

## 技术架构

### 配置管理架构

```
用户UI → ModelConfigDialog → AIConfigContext → localStorage
                                      ↓
                              ChatPanel (useAIConfig)
                                      ↓
                              API Route (接收config)
                                      ↓
                              动态创建AI Model实例
```

### 配置优先级逻辑

```
1. UI配置 (localStorage) - 用户在界面中设置的配置
2. 环境变量配置 (.env.local) - 开发者配置的默认值
3. 默认配置 (hardcoded) - 系统fallback配置
```

## 核心组件设计

### 1. AIConfigContext (contexts/ai-config-context.tsx)

**职责**: 管理AI配置状态，提供配置读写接口

**接口定义**:
```typescript
interface AIConfig {
  provider: 'openai' | 'google' | 'bedrock' | 'openrouter';
  model: string;
  apiKey?: string;
  parameters?: {
    temperature?: number;
    maxTokens?: number;
  };
}

interface AIConfigContextType {
  config: AIConfig;
  updateConfig: (config: Partial<AIConfig>) => void;
  resetToEnv: () => void;
  isUsingEnvConfig: boolean;
}
```

**实现要点**:
- 从localStorage读取配置（key: 'aiConfig'）
- 如果localStorage无配置，使用环境变量默认值
- updateConfig时保存到localStorage
- resetToEnv时清除localStorage配置

### 2. ModelConfigDialog (components/model-config-dialog.tsx)

**职责**: 提供用户配置界面

**UI结构**:
1. Provider选择器 (Select)
2. Model选择器 (Select, 根据provider动态更新)
3. API Key输入框 (Input, 可选)
4. Temperature滑块 (Slider, 0-2)
5. Max Tokens输入 (Input)
6. 保存/重置按钮

**交互逻辑**:
- 使用本地state暂存编辑中的配置
- 点击保存时才更新Context
- 点击重置时恢复环境变量配置
- 提供配置验证和错误提示

### 3. API Route修改 (app/api/chat/route.ts)

**修改点**:
1. 接收aiConfig参数
2. 实现配置优先级逻辑
3. 动态创建model实例
4. 错误处理

**实现示例**:
```typescript
const { messages, xml, aiConfig } = await req.json();

// 配置优先级
const effectiveConfig = aiConfig || getEnvConfig();

// 验证配置
if (!validateConfig(effectiveConfig)) {
  return Response.json({ error: 'Invalid AI configuration' }, { status: 400 });
}

// 动态创建model
const model = createModelFromConfig(effectiveConfig);
```

## 依赖组件

### 需要新建的UI组件

1. **Select组件** (components/ui/select.tsx)
   - 基于 @radix-ui/react-select
   - 用于Provider和Model选择

2. **Slider组件** (components/ui/slider.tsx)
   - 基于 @radix-ui/react-slider
   - 用于Temperature调整

### 可重用的现有组件

1. Dialog组件 - 配置面板容器
2. Button组件 - 保存/重置按钮
3. Input组件 - API Key输入
4. Context模式 - 参考diagram-context.tsx

## 实施计划

### Phase 1 - 基础组件 (必须)

1. 创建Select和Slider UI组件
2. 创建AIConfigContext和工具函数
3. 创建ModelConfigDialog组件

### Phase 2 - 集成 (必须)

4. 集成配置对话框到ChatPanel
5. 修改API Route支持动态模型配置
6. 修改ChatPanel发送消息时传递配置
7. 集成AIConfigProvider到应用根组件

### Phase 3 - 质量保证 (必须)

8. 添加配置验证和错误处理

## 技术细节

### 模型列表预定义

```typescript
const MODEL_OPTIONS = {
  openai: ['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
  google: ['gemini-2.5-flash-preview-05-20', 'gemini-2.5-pro', 'gemini-pro'],
  bedrock: [
    'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
    'anthropic.claude-sonnet-4-20250514-v1:0',
    'anthropic.claude-3-5-sonnet-20240620-v1:0'
  ],
  openrouter: [
    'anthropic/claude-3.5-sonnet',
    'google/gemini-pro',
    'openai/gpt-4-turbo'
  ]
};
```

### localStorage Schema

```json
{
  "aiConfig": {
    "provider": "bedrock",
    "model": "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
    "parameters": {
      "temperature": 0
    }
  }
}
```

### 配置验证规则

1. Provider必须是支持的提供商之一
2. Model必须在对应Provider的模型列表中
3. API Key格式验证（如果提供）
4. Temperature范围: 0-2
5. Max Tokens范围: 正整数

## 安全考虑

1. API Key在localStorage中存储（可选加密）
2. 敏感信息不记录到日志
3. 验证用户输入的配置有效性
4. 提供"使用环境变量"选项（不在UI暴露key）

## 向后兼容性

1. 默认使用环境变量配置
2. aiConfig参数可选
3. 不影响现有功能
4. 渐进式增强

## 潜在风险与缓解

### 风险1: localStorage配置损坏
**缓解**: 添加配置验证，损坏时回退到环境变量

### 风险2: API Key泄露
**缓解**: 提供"使用环境变量"选项，不强制在UI输入

### 风险3: 配置不兼容
**缓解**: 完善的配置验证和错误处理

### 风险4: 性能影响
**缓解**: localStorage读写性能良好，Context更新不会导致全局重渲染

## 成功标准

1. ✅ 用户能通过UI选择和配置AI模型
2. ✅ 配置优先级逻辑正确
3. ✅ 配置持久化到localStorage
4. ✅ 向后兼容现有env配置
5. ✅ 所有AI提供商都能正常工作
6. ✅ 错误处理完善
7. ✅ UI友好，操作直观
8. ✅ 不影响现有功能

## Clarifications

### 用户明确的设计决策 (2025-11-11)

**问题1: 第三方OpenAI兼容API配置**
- ✅ 选择: **1C - 预定义提供商 + 自定义提供商**
- 实现: 支持内置提供商(OpenAI/Google/Bedrock/OpenRouter) + 允许添加自定义OpenAI兼容API
- 自定义配置项: 自定义名称、baseURL、模型名称

**问题2: API Key存储安全**
- ✅ 选择: **2A - localStorage存储 + 简单加密**
- 实现: 使用localStorage存储，但不明文保存
- 加密方案: 使用简单的对称加密(如Base64 + XOR或AES-256-GCM)
- 读取时解密后使用，安全性可接受

**问题3: 配置优先级逻辑**
- ✅ 选择: **3A - UI配置完全覆盖env配置**
- 实现: UI配置存在时，完全使用UI配置；env配置仅作为fallback

**问题4: 模型选择UI位置**
- ✅ 选择: **4D - 设置对话框 + 快速切换下拉框**
- 实现:
  - 详细配置: 设置对话框(可配置API Key、参数等)
  - 快速切换: 聊天面板内嵌下拉框(快速切换已配置的模型)

**问题5: 自定义模型参数**
- ✅ 选择: **5B - 常用参数(temperature, maxTokens, topP)**
- 实现: 提供常用参数配置，满足大多数使用场景

### 更新后的技术架构

#### 加密工具函数设计

```typescript
// lib/ai-config-utils.ts
interface EncryptionConfig {
  algorithm: 'aes-256-gcm';
  keyDerivation: 'pbkdf2';
}

// 加密API Key
function encryptApiKey(apiKey: string): string;

// 解密API Key
function decryptApiKey(encrypted: string): string;

// 生成设备唯一密钥(基于浏览器指纹)
function getDeviceKey(): string;
```

#### 自定义提供商配置Schema

```typescript
interface CustomProvider {
  id: string; // 用户自定义ID
  name: string; // 显示名称
  type: 'openai-compatible';
  baseURL: string; // 自定义API端点
  models: string[]; // 可用模型列表
  apiKey?: string; // 加密存储
}

interface AIConfig {
  provider: 'openai' | 'google' | 'bedrock' | 'openrouter' | string; // string为自定义provider ID
  model: string;
  apiKey?: string; // 加密存储
  parameters?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
  customProviders?: CustomProvider[]; // 用户添加的自定义提供商
}
```

#### UI组件更新

**ModelConfigDialog** - 详细配置对话框:
- Provider选择器(内置 + 自定义)
- "添加自定义提供商"按钮
- Model选择器(动态)
- API Key输入(加密存储提示)
- 参数配置(temperature, maxTokens, topP)
- 保存/重置按钮

**ModelQuickSwitch** - 快速切换下拉框(新增):
- 显示当前选中的模型
- 下拉列表显示所有已配置的模型
- 点击切换，无需打开详细配置

### 更新后的实施计划

#### Phase 1 - 基础组件与工具
1. 创建加密工具函数(lib/ai-config-utils.ts)
2. 创建Select和Slider UI组件
3. 创建AIConfigContext(支持自定义提供商)

#### Phase 2 - UI组件
4. 创建ModelConfigDialog(详细配置)
5. 创建ModelQuickSwitch(快速切换)
6. 创建CustomProviderForm(添加自定义提供商)

#### Phase 3 - 集成
7. 集成配置对话框和快速切换到ChatPanel
8. 修改API Route支持自定义提供商
9. 修改ChatPanel发送消息时传递配置
10. 集成AIConfigProvider到应用根组件

#### Phase 4 - 质量保证
11. 添加配置验证和错误处理
12. 测试加密/解密功能
13. 测试自定义提供商功能

### 安全考虑(更新)

1. **API Key加密存储**:
   - 使用AES-256-GCM对称加密
   - 密钥基于设备指纹生成(不存储在localStorage)
   - 每次读取时解密，使用后不保留明文

2. **自定义提供商验证**:
   - baseURL格式验证(必须是HTTPS)
   - 防止SSRF攻击(限制内网地址)
   - 模型名称格式验证

3. **敏感信息处理**:
   - API Key不记录到日志
   - 错误信息不暴露完整Key
   - 提供"清除所有配置"功能

### 成功标准(更新)

1. ✅ 用户能通过UI选择内置和自定义AI模型
2. ✅ 支持添加第三方OpenAI兼容API
3. ✅ API Key加密存储到localStorage
4. ✅ 配置优先级逻辑正确(UI > env)
5. ✅ 提供详细配置对话框和快速切换下拉框
6. ✅ 支持temperature, maxTokens, topP参数配置
7. ✅ 向后兼容现有env配置
8. ✅ 所有AI提供商都能正常工作
9. ✅ 错误处理完善
10. ✅ UI友好，操作直观

## 建议: PROCEED

用户需求已完全明确，设计决策已确定，可以进入任务生成和执行阶段。
