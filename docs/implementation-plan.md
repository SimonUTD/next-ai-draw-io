# 第三方大模型渠道管理功能实现计划

## 一、问题分析

### 当前存在的问题

1. **技术实现错误**
   - 未使用 `@ai-sdk/openai-compatible` 包实现第三方 OpenAI 兼容 API
   - `provider-registry.ts` 中的自定义实现不符合 AI SDK 最佳实践

2. **数据结构不完整**
   - `CustomProvider` 类型缺少：
     - 启用/禁用状态字段
     - 每个模型的独立参数配置
   - 模型只是简单的字符串数组，无法配置参数

3. **功能缺失**
   - 无法测试配置是否正确
   - 无法校验模型是否可用
   - 无法设置渠道启用/禁用
   - 快速切换显示所有渠道（包括未启用的）

## 二、实施方案

### 1. 安装依赖包

```bash
npm install @ai-sdk/openai-compatible
```

### 2. 重构数据结构

#### 2.1 更新 `lib/ai-config-types.ts`

```typescript
// 模型配置接口
export interface ModelConfig {
  id: string;                    // 模型ID
  name: string;                  // 显示名称
  parameters: {
    temperature: number;         // 温度参数 0-2
    maxTokens?: number;          // 最大token数
    topP?: number;               // Top P 参数 0-1
  };
}

// 自定义渠道配置
export interface CustomProvider {
  id: string;                    // 渠道唯一ID
  name: string;                  // 渠道显示名称
  type: 'openai-compatible';     // 固定为 openai-compatible
  baseURL: string;               // API 基础URL
  apiKey?: string;               // API密钥（加密存储）
  enabled: boolean;              // 是否启用
  models: ModelConfig[];         // 模型列表（带参数配置）
}
```

### 3. 更新 Provider Registry

#### 3.1 修改 `lib/provider-registry.ts`

使用 `@ai-sdk/openai-compatible` 包的 `createOpenAICompatible` 函数：

```typescript
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export class CustomProviderFactory implements IProviderFactory {
  createProvider(config: AIConfig, customProvider?: CustomProvider): any {
    if (!customProvider) {
      throw new Error(`Custom provider configuration not found`);
    }

    // 使用官方 openai-compatible 包
    const provider = createOpenAICompatible({
      name: customProvider.name,
      apiKey: customProvider.apiKey || config.apiKey || '',
      baseURL: customProvider.baseURL,
    });

    return provider(config.model);
  }
}
```

### 4. 实现配置测试功能

#### 4.1 创建 `lib/provider-testing.ts`

```typescript
export interface TestResult {
  success: boolean;
  message: string;
  latency?: number;
}

// 测试渠道连接
export async function testProviderConnection(
  provider: CustomProvider
): Promise<TestResult> {
  // 实现连接测试逻辑
}

// 测试特定模型
export async function testModelAvailability(
  provider: CustomProvider,
  modelId: string
): Promise<TestResult> {
  // 实现模型测试逻辑
}
```

### 5. 更新 UI 组件

#### 5.1 `components/custom-provider-form.tsx`

新增功能：
- 启用/禁用开关
- 模型列表管理（添加、删除、编辑）
- 每个模型的参数配置
- 测试按钮（测试连接和模型可用性）

#### 5.2 `components/model-config-dialog.tsx`

新增功能：
- 显示渠道启用状态
- 集成测试功能
- 支持编辑和删除自定义渠道

#### 5.3 `components/model-quick-switch.tsx`

修改：
- 过滤掉未启用的渠道
- 只显示启用渠道的模型

### 6. 更新 Context

#### 6.1 `contexts/ai-config-context.tsx`

新增方法：
- `updateCustomProvider`: 更新自定义渠道配置
- `toggleProviderEnabled`: 切换渠道启用状态

## 三、实施步骤

1. ✅ 分析现有代码结构和问题
2. ⏳ 安装 `@ai-sdk/openai-compatible` 依赖
3. ⏳ 重构数据结构
4. ⏳ 更新 provider-registry.ts
5. ⏳ 实现配置测试功能
6. ⏳ 更新 custom-provider-form.tsx
7. ⏳ 更新 model-config-dialog.tsx
8. ⏳ 更新 model-quick-switch.tsx
9. ⏳ 更新 ai-config-context.tsx
10. ⏳ 验证整体功能

## 四、关键技术点

### 4.1 使用 @ai-sdk/openai-compatible

根据 AI SDK 文档，正确的使用方式：

```typescript
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const provider = createOpenAICompatible({
  name: 'my-provider',
  apiKey: 'your-api-key',
  baseURL: 'https://api.example.com/v1',
});

const model = provider('model-name');
```

### 4.2 数据迁移

需要处理旧数据格式到新格式的迁移：
- 旧格式：`models: string[]`
- 新格式：`models: ModelConfig[]`

迁移逻辑：
```typescript
function migrateProvider(old: OldCustomProvider): CustomProvider {
  return {
    ...old,
    enabled: true, // 默认启用
    models: old.models.map(modelName => ({
      id: modelName,
      name: modelName,
      parameters: {
        temperature: 0,
        maxTokens: 4096,
        topP: 1,
      }
    }))
  };
}
```

## 五、测试计划

1. **单元测试**
   - 数据结构验证
   - Provider 创建逻辑
   - 配置测试功能

2. **集成测试**
   - 添加自定义渠道
   - 配置模型参数
   - 测试连接和模型
   - 启用/禁用渠道
   - 快速切换模型

3. **端到端测试**
   - 完整的对话流程
   - 数据持久化
   - 加密/解密

## 六、注意事项

1. **向后兼容**：需要处理旧数据格式的迁移
2. **安全性**：API Key 必须加密存储
3. **错误处理**：测试失败时提供清晰的错误信息
4. **用户体验**：测试过程中显示加载状态
5. **性能**：避免频繁的 API 调用

## 七、预期成果

完成后，用户可以：
1. ✅ 通过界面添加、编辑、删除第三方大模型渠道
2. ✅ 自定义设置 API URL 和 API Key
3. ✅ 为每个渠道添加多个模型，并为每个模型设置独立参数
4. ✅ 测试配置是否正确，校验模型是否可用
5. ✅ 设置渠道启用/禁用状态
6. ✅ 快速切换不同渠道和模型进行对话
7. ✅ 切换界面只显示启用的渠道