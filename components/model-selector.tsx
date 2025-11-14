"use client";

import React from "react";
import { useAIConfig } from "@/contexts/ai-config-context-v2";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ModelSelector() {
  const { config, setActiveConfig } = useAIConfig();

  // 获取所有启用的模型
  const availableModels = config.models.filter(model => {
    const provider = config.providers.find(p => p.id === model.providerId);
    return provider?.enabled && model.enabled;
  });

  // 获取当前模型的显示名称
  const getCurrentModelDisplay = () => {
    const activeModel = config.models.find(m => m.id === config.activeModelId);
    const activeProvider = config.providers.find(p => p.id === config.activeProviderId);
    
    if (!activeModel || !activeProvider) return "Select Model";
    
    return `${activeProvider.name} - ${activeModel.name}`;
  };

  const handleModelChange = (modelId: string) => {
    const model = config.models.find(m => m.id === modelId);
    if (model) {
      setActiveConfig(model.providerId, modelId);
    }
  };

  return (
    <Select value={config.activeModelId} onValueChange={handleModelChange}>
      <SelectTrigger className="w-[280px]">
        <SelectValue>{getCurrentModelDisplay()}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {availableModels.map((model) => {
          const provider = config.providers.find(p => p.id === model.providerId);
          if (!provider) return null;
          
          return (
            <SelectItem key={model.id} value={model.id}>
              {provider.name} - {model.name}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}