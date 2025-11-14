"use client";

import React, { useState } from "react";
import { useAIConfig } from "@/contexts/ai-config-context-v2";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Settings, Database } from "lucide-react";
import { ProviderManagementDialog } from "./provider-management-dialog";
import { ModelManagementDialog } from "./model-management-dialog";

interface ModelConfigDialogV2Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModelConfigDialogV2({
  open,
  onOpenChange,
}: ModelConfigDialogV2Props) {
  const { config, setActiveConfig, getActiveProvider, getActiveModel, getProviderModels, resetToEnv } = useAIConfig();
  const [selectedProviderId, setSelectedProviderId] = useState(config.activeProviderId);
  const [selectedModelId, setSelectedModelId] = useState(config.activeModelId);
  const [showProviderManagement, setShowProviderManagement] = useState(false);
  const [showModelManagement, setShowModelManagement] = useState(false);

  const enabledProviders = config.providers.filter(p => p.enabled);
  const availableModels = getProviderModels(selectedProviderId).filter(m => m.enabled);

  const handleProviderChange = (providerId: string) => {
    setSelectedProviderId(providerId);
    // 自动选择该Provider的第一个启用的Model
    const firstModel = getProviderModels(providerId).find(m => m.enabled);
    if (firstModel) {
      setSelectedModelId(firstModel.id);
    }
  };

  const handleSave = async () => {
    await setActiveConfig(selectedProviderId, selectedModelId);
    onOpenChange(false);
  };

  const handleReset = () => {
    if (confirm("确定要重置到环境变量配置吗？")) {
      resetToEnv();
      onOpenChange(false);
    }
  };

  const activeProvider = getActiveProvider();
  const activeModel = getActiveModel();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>AI 配置</DialogTitle>
            <DialogDescription>
              选择AI渠道和模型，或管理详细配置
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 当前配置摘要 */}
            <div className="rounded-lg bg-muted p-3 space-y-1">
              <div className="text-sm font-medium">当前配置</div>
              <div className="text-xs text-muted-foreground">
                渠道: {activeProvider?.name || 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground">
                模型: {activeModel?.name || 'N/A'}
              </div>
              {activeModel && (
                <div className="text-xs text-muted-foreground">
                  参数: Temp={activeModel.parameters.temperature}, 
                  MaxTokens={activeModel.parameters.maxTokens || 'N/A'}, 
                  TopP={activeModel.parameters.topP}
                </div>
              )}
            </div>

            {/* Provider选择 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">渠道</label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowProviderManagement(true)}
                  className="h-7 gap-1 text-xs"
                >
                  <Settings className="size-3" />
                  管理渠道
                </Button>
              </div>
              <Select value={selectedProviderId} onValueChange={handleProviderChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {enabledProviders.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                      {provider.isBuiltIn && (
                        <span className="ml-2 text-xs text-muted-foreground">(内置)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model选择 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">模型</label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowModelManagement(true)}
                  className="h-7 gap-1 text-xs"
                >
                  <Database className="size-3" />
                  管理模型
                </Button>
              </div>
              <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      此渠道暂无可用模型
                    </div>
                  ) : (
                    availableModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                        {model.isBuiltIn && (
                          <span className="ml-2 text-xs text-muted-foreground">(内置)</span>
                        )}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* 选中模型的参数预览 */}
            {selectedModelId && (() => {
              const selectedModel = config.models.find(m => m.id === selectedModelId);
              return selectedModel ? (
                <div className="rounded-lg border p-3 space-y-1">
                  <div className="text-sm font-medium">模型参数</div>
                  <div className="text-xs text-muted-foreground">
                    Temperature: {selectedModel.parameters.temperature}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Max Tokens: {selectedModel.parameters.maxTokens || 'N/A'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Top P: {selectedModel.parameters.topP}
                  </div>
                </div>
              ) : null;
            })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleReset}>
              重置到环境变量
            </Button>
            <Button onClick={handleSave}>
              保存配置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Provider管理对话框 */}
      <ProviderManagementDialog
        open={showProviderManagement}
        onOpenChange={setShowProviderManagement}
      />

      {/* Model管理对话框 */}
      <ModelManagementDialog
        open={showModelManagement}
        onOpenChange={setShowModelManagement}
      />
    </>
  );
}