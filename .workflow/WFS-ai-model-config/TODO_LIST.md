# AI模型界面配置功能 - 任务清单

## 任务概览

总任务数: 8
- [ ] 待完成: 8
- [ ] 进行中: 0
- [ ] 已完成: 0

## Phase 1: 基础组件开发

### [ ] 任务1: 创建Select和Slider UI组件
**ID**: `7d2e2793-7211-4a95-91cc-b23cd65871f2`
**优先级**: 高
**依赖**: 无
**预计时间**: 2小时

**描述**:
项目中缺失Select和Slider组件，需要基于Radix UI创建这两个基础组件，用于后续的模型配置界面。

**交付物**:
- `components/ui/select.tsx`
- `components/ui/slider.tsx`

**验收标准**:
- Select组件能正常渲染并支持选项选择
- Slider组件能正常渲染并支持值调整
- 组件样式与项目现有UI组件一致
- TypeScript类型定义完整无错误

---

### [ ] 任务2: 创建AI配置Context和工具函数
**ID**: `d1c38082-61ca-45a1-ae98-8310e457461c`
**优先级**: 高
**依赖**: 无
**预计时间**: 2-3小时

**描述**:
创建AIConfigContext用于管理AI模型配置状态，实现配置的读取、更新和持久化。创建配置工具函数用于配置验证、环境变量读取和模型实例创建。

**交付物**:
- `contexts/ai-config-context.tsx`
- `lib/ai-config-utils.ts`

**验收标准**:
- AIConfigContext能正常提供配置状态
- updateConfig能正确更新配置并保存到localStorage
- resetToEnv能清除localStorage并恢复环境变量配置
- 配置优先级逻辑正确（UI > env > default）
- validateConfig能正确验证配置有效性

---

### [ ] 任务3: 创建模型配置对话框组件
**ID**: `27c3c477-0e85-40c5-81d4-83384880d97b`
**优先级**: 高
**依赖**: 任务1, 任务2
**预计时间**: 2-3小时

**描述**:
创建ModelConfigDialog组件，提供用户友好的界面用于配置AI模型。包括Provider选择、Model选择、API Key输入（可选）和参数调整功能。

**交付物**:
- `components/model-config-dialog.tsx`

**验收标准**:
- 对话框能正常打开和关闭
- Provider选择器能正常工作
- Model选择器根据Provider动态更新选项
- API Key输入框支持可选输入
- Temperature滑块能正常调整值
- 保存按钮能正确更新配置
- 重置按钮能恢复环境变量配置

---

## Phase 2: 系统集成

### [ ] 任务4: 集成配置对话框到ChatPanel
**ID**: `224a2e10-5906-4001-8ed0-60734dd34f8c`
**优先级**: 中
**依赖**: 任务3
**预计时间**: 1小时

**描述**:
在ChatPanel组件中添加模型配置按钮，集成ModelConfigDialog，并显示当前使用的模型信息。

**交付物**:
- 修改 `components/chat-panel.tsx`

**验收标准**:
- 配置按钮正确显示在ChatPanel头部
- 点击配置按钮能打开ModelConfigDialog
- 当前模型信息正确显示
- 配置变更后，显示的模型信息立即更新

---

### [ ] 任务5: 修改API Route支持动态模型配置
**ID**: `9727fae4-b67a-48ba-b7e1-2509f2cc15f8`
**优先级**: 高
**依赖**: 任务2
**预计时间**: 2小时

**描述**:
修改app/api/chat/route.ts，使其能够接收前端传递的AI配置参数，实现配置优先级逻辑，并根据配置动态创建对应的AI model实例。

**交付物**:
- 修改 `app/api/chat/route.ts`

**验收标准**:
- API能正确接收aiConfig参数
- 配置优先级逻辑正确（aiConfig > env > default）
- 能根据配置动态创建不同provider的model实例
- 配置验证正确，无效配置返回400错误
- 向后兼容，不传aiConfig时使用环境变量配置

---

### [ ] 任务6: 修改ChatPanel发送消息时传递配置
**ID**: `cd89ab3a-6fe3-404d-8ede-dd7975ce5243`
**优先级**: 中
**依赖**: 任务2, 任务5
**预计时间**: 30分钟

**描述**:
修改ChatPanel的onFormSubmit函数，在发送消息时将当前的AI配置传递给API Route。

**交付物**:
- 修改 `components/chat-panel.tsx` 的 onFormSubmit

**验收标准**:
- 发送消息时能正确获取当前AI配置
- 配置正确传递给API Route
- 配置变更后，下次发送消息使用新配置

---

### [ ] 任务7: 集成AIConfigProvider到应用根组件
**ID**: `5893a384-0e74-406f-be8d-40e05b7e8e9f`
**优先级**: 中
**依赖**: 任务2
**预计时间**: 30分钟

**描述**:
在app/layout.tsx中集成AIConfigProvider，使整个应用都能访问AI配置Context。

**交付物**:
- 修改 `app/layout.tsx`

**验收标准**:
- AIConfigProvider正确集成到应用根组件
- 所有子组件都能访问useAIConfig hook
- 不影响现有的DiagramProvider功能

---

## Phase 3: 质量保证

### [ ] 任务8: 添加配置验证和错误处理
**ID**: `3433aa2f-091c-4ec1-b885-eb40e31cfc0e`
**优先级**: 中
**依赖**: 任务2, 任务3, 任务5
**预计时间**: 1-2小时

**描述**:
完善配置验证逻辑和错误处理，包括API Key验证、模型可用性检查、参数范围验证等，提供友好的错误提示。

**交付物**:
- 增强 `lib/ai-config-utils.ts`
- 修改 `components/model-config-dialog.tsx`
- 修改 `app/api/chat/route.ts`

**验收标准**:
- validateConfig能正确验证所有配置项
- 无效的provider被拒绝
- 无效的model被拒绝
- 参数范围验证正确
- ModelConfigDialog显示友好的错误提示
- API Route返回详细的错误信息

---

## 任务依赖图

```
任务1 (Select/Slider)
  ↓
任务2 (Context) ──→ 任务3 (Dialog)
  ↓                    ↓
  ├──→ 任务5 (API)     ├──→ 任务4 (集成UI)
  ↓         ↓
  ├──→ 任务6 (传递) ←──┘
  ↓
  └──→ 任务7 (Provider)

任务2, 任务3, 任务5 ──→ 任务8 (验证)
```

## 执行建议

### 推荐执行顺序

1. **并行执行**: 任务1 和 任务2（无依赖）
2. **顺序执行**: 任务3（依赖任务1和2）
3. **并行执行**: 任务4, 任务5, 任务7（依赖任务2/3）
4. **顺序执行**: 任务6（依赖任务5）
5. **最后执行**: 任务8（质量保证）

### 关键路径

```
任务1 → 任务3 → 任务4
任务2 → 任务5 → 任务6
```

最短完成时间: 约9-13小时

## 进度追踪

### 完成情况

- Phase 1: 0/3 (0%)
- Phase 2: 0/4 (0%)
- Phase 3: 0/1 (0%)
- **总体**: 0/8 (0%)

### 里程碑

- [ ] Phase 1完成 - 基础组件就绪
- [ ] Phase 2完成 - 系统集成完成
- [ ] Phase 3完成 - 质量保证完成
- [ ] 功能验收通过
- [ ] 代码审查通过

## 注意事项

1. **依赖包安装**: 需要安装 `@radix-ui/react-select` 和 `@radix-ui/react-slider`
2. **localStorage key**: 统一使用 `'aiConfig'`
3. **向后兼容**: 确保不影响现有env配置方式
4. **错误处理**: 完善的配置验证和错误提示
5. **样式一致性**: 所有新组件样式与项目现有组件保持一致

## 下一步行动

1. 安装必要的依赖包
2. 开始执行任务1和任务2（可并行）
3. 完成后继续执行任务3
4. 按照依赖关系逐步完成剩余任务
