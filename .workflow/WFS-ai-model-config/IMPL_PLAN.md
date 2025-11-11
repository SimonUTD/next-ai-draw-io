# AI模型界面配置功能 - 实施计划

## 项目概述

实现AI模型的界面配置功能，允许用户通过UI动态选择和配置AI模型（OpenAI、Google、AWS Bedrock、OpenRouter），实现配置优先级逻辑（UI配置优先于环境变量配置），支持模型参数调整和持久化存储。

## 核心目标

1. 创建用户友好的AI模型配置界面
2. 实现配置优先级逻辑（UI > env > default）
3. 支持多个AI提供商（OpenAI, Google, Bedrock, OpenRouter）
4. 持久化配置到localStorage
5. 向后兼容现有env配置方式

## 技术架构

### 配置管理流程

```
用户UI → ModelConfigDialog → AIConfigContext → localStorage
                                      ↓
                              ChatPanel (useAIConfig)
                                      ↓
                              API Route (接收config)
                                      ↓
                              动态创建AI Model实例
```

### 配置优先级

```
1. UI配置 (localStorage)
2. 环境变量配置 (.env.local)
3. 默认配置 (hardcoded fallback)
```

## 实施阶段

### Phase 1: 基础组件开发

**任务1: 创建加密工具函数**
- 创建 `lib/ai-config-utils.ts` (加密部分)
- 实现API Key加密/解密功能
- 使用AES-256-GCM算法
- 基于设备指纹生成密钥
- 使用Web Crypto API
- 确保密钥不存储在localStorage

**任务2: 创建Select和Slider UI组件**
- 创建 `components/ui/select.tsx`
- 创建 `components/ui/slider.tsx`
- 基于Radix UI实现
- 与项目现有UI组件保持一致的样式

**任务3: 创建AI配置Context和工具函数**
- 创建 `contexts/ai-config-context.tsx`
- 扩展 `lib/ai-config-utils.ts`
- 实现配置状态管理
- 实现localStorage持久化（API Key加密存储）
- 支持内置和自定义提供商
- 实现配置验证和模型创建工具函数

**任务4: 创建CustomProviderForm组件**
- 创建 `components/custom-provider-form.tsx`
- 实现添加/编辑自定义OpenAI兼容提供商
- 提供商名称、Base URL、模型列表输入
- API Key输入（可选，加密存储）
- URL验证（必须HTTPS，防SSRF）
- 保存/取消功能

**任务5: 创建模型配置对话框组件**
- 创建 `components/model-config-dialog.tsx`
- 实现Provider选择器（内置 + 自定义）
- 实现"添加自定义提供商"按钮
- 实现Model选择器（动态更新）
- 实现API Key输入（可选，加密存储提示）
- 实现参数调整（Temperature, Max Tokens, Top P）
- 实现保存/重置功能

**任务6: 创建ModelQuickSwitch快速切换组件**
- 创建 `components/model-quick-switch.tsx`
- 显示当前选中的模型
- 下拉菜单显示所有已配置模型
- 快速切换功能（无需打开详细配置）
- "详细配置"选项（打开ModelConfigDialog）

### Phase 2: 系统集成

**任务7: 集成配置组件到ChatPanel**
- 修改 `components/chat-panel.tsx`
- 集成ModelConfigDialog和ModelQuickSwitch
- 添加配置按钮和快速切换下拉框
- 显示当前模型信息
- 发送消息时传递AI配置到API Route

**任务8: 修改API Route支持动态模型配置**
- 修改 `app/api/chat/route.ts`
- 接收aiConfig参数
- 实现配置优先级逻辑（UI > env > default）
- 支持内置提供商动态创建model实例
- 支持自定义OpenAI兼容提供商
- 添加错误处理和配置验证

**任务9: 集成AIConfigProvider到应用根组件**
- 修改 `app/layout.tsx`
- 集成AIConfigProvider
- 确保Provider嵌套顺序正确（AIConfigProvider在外层）

### Phase 3: 质量保证

**任务10: 添加配置验证和错误处理**
- 增强 `lib/ai-config-utils.ts` 的 validateConfig
- 实现validateCustomProvider（防SSRF攻击）
- 在 `components/model-config-dialog.tsx` 添加错误提示
- 在 `app/api/chat/route.ts` 添加详细错误日志
- 完善配置验证规则（Provider、Model、参数范围）

## 任务依赖关系

```
任务1 (加密工具) ──→ 任务3 (AIConfigContext)
                        ↓
任务2 (UI组件) ──→ 任务4 (CustomForm) ──→ 任务5 (ModelConfigDialog)
         ↓                                    ↓
         └──────────────────────────→ 任务6 (ModelQuickSwitch)
                                              ↓
任务3 ──→ 任务8 (API Route)                  ↓
    ↓                                         ↓
    └──→ 任务9 (Provider) ←──────────────────┘
                                              ↓
                                        任务7 (集成到ChatPanel)
                                              ↓
任务3, 任务5, 任务8 ──→ 任务10 (验证和错误处理)
```

**关键路径**: 任务1 → 任务3 → 任务5 → 任务7 → 任务10

## 关键实现点

### 1. AIConfigContext实现

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
    topP?: number; // 新增
  };
  customProviders?: CustomProvider[]; // 用户添加的自定义提供商
}

// Provider实现要点:
// - 从localStorage读取配置（key: 'aiConfig'）
// - API Key使用encryptApiKey加密后存储
// - 读取时使用decryptApiKey解密
// - 如果localStorage无配置，使用环境变量默认值
// - updateConfig时加密API Key后保存到localStorage
// - resetToEnv时清除localStorage配置
// - 支持自定义提供商管理（addCustomProvider, removeCustomProvider）
```

### 2. 模型列表预定义

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

### 3. API Route配置逻辑

```typescript
// 接收配置
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

### 4. 配置验证规则

**基本配置验证**:
1. Provider必须是支持的提供商之一或有效的自定义provider ID
2. Model必须在对应Provider的模型列表中
3. API Key格式验证（如果提供）
4. Temperature范围: 0-2
5. Max Tokens范围: 正整数
6. Top P范围: 0-1

**自定义提供商验证**:
1. baseURL必须使用HTTPS
2. baseURL不能是内网地址（防SSRF攻击）
3. 至少提供一个模型名称
4. 提供商名称不为空

## 文件清单

### 新建文件

1. `lib/ai-config-utils.ts` - 加密工具和配置工具函数
2. `components/ui/select.tsx` - Select组件
3. `components/ui/slider.tsx` - Slider组件
4. `contexts/ai-config-context.tsx` - AI配置Context
5. `components/custom-provider-form.tsx` - 自定义提供商表单
6. `components/model-config-dialog.tsx` - 详细配置对话框
7. `components/model-quick-switch.tsx` - 快速切换组件

### 修改文件

1. `components/chat-panel.tsx` - 集成配置功能和快速切换
2. `app/api/chat/route.ts` - 支持动态配置和自定义提供商
3. `app/layout.tsx` - 集成AIConfigProvider
4. `package.json` - 添加Radix UI依赖

## 验收标准

### 功能验收

- [ ] 用户能通过UI选择内置AI提供商
- [ ] 用户能添加和管理自定义OpenAI兼容提供商
- [ ] 用户能选择对应提供商的模型
- [ ] 用户能调整模型参数（Temperature, Max Tokens, Top P）
- [ ] API Key加密存储到localStorage
- [ ] 配置能正确应用到AI请求
- [ ] 配置优先级逻辑正确（UI > env）
- [ ] 快速切换下拉框能快速切换模型
- [ ] 详细配置对话框能完整配置所有选项
- [ ] 重置功能能恢复环境变量配置

### 技术验收

- [ ] 所有TypeScript类型定义完整
- [ ] 所有组件样式与项目一致
- [ ] API Key加密/解密功能正常
- [ ] 配置验证逻辑完善（包括自定义提供商验证）
- [ ] 防SSRF攻击验证生效
- [ ] 错误处理完善
- [ ] 向后兼容现有功能
- [ ] 不影响现有env配置方式

### 用户体验验收

- [ ] UI界面友好直观
- [ ] 配置变更立即生效
- [ ] 错误提示清晰友好
- [ ] 当前模型信息清晰显示
- [ ] 配置按钮位置合理

## 风险与缓解

### 风险1: localStorage配置损坏
**缓解**: 添加配置验证，损坏时回退到环境变量

### 风险2: API Key泄露
**缓解**:
- 使用AES-256-GCM加密存储
- 密钥基于设备指纹生成，不存储在localStorage
- 提供"使用环境变量"选项，不强制在UI输入

### 风险3: SSRF攻击（自定义提供商）
**缓解**:
- 强制HTTPS
- 禁止内网地址（localhost, 127.*, 192.168.*, 10.*）
- URL格式验证

### 风险4: 配置不兼容
**缓解**: 完善的配置验证和错误处理

### 风险5: 性能影响
**缓解**: localStorage读写性能良好，Context更新不会导致全局重渲染

## 时间估算

- Phase 1 (基础组件): 8-10小时
  - 任务1 (加密): 2小时
  - 任务2 (UI组件): 2小时
  - 任务3 (Context): 2-3小时
  - 任务4 (CustomForm): 1-2小时
  - 任务5 (Dialog): 2-3小时
  - 任务6 (QuickSwitch): 1小时
- Phase 2 (系统集成): 4-5小时
  - 任务7 (集成): 1-2小时
  - 任务8 (API Route): 2-3小时
  - 任务9 (Provider): 30分钟
- Phase 3 (质量保证): 2-3小时
  - 任务10 (验证): 2-3小时
- **总计**: 14-18小时

## 后续优化方向

1. ~~API Key加密存储~~ (已实现)
2. ~~自定义OpenAI兼容提供商~~ (已实现)
3. ~~快速切换下拉框~~ (已实现)
4. 配置导入/导出功能
5. 配置预设功能
6. 配置历史记录
7. 配置测试功能（测试API key有效性）
8. 更多参数配置（presence_penalty, frequency_penalty等）

## 参考资料

- Radix UI文档: https://www.radix-ui.com/
- Vercel AI SDK文档: https://sdk.vercel.ai/
- 项目现有Context实现: `contexts/diagram-context.tsx`
- 项目现有Dialog实现: `components/ui/dialog.tsx`
