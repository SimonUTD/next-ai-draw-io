"use client";

import React, { useState } from "react";
import { useAIConfig } from "@/contexts/ai-config-context-v2";
import { ModelConfig } from "@/lib/ai-config-types-v2";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ModelManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModelManagementDialog({
  open,
  onOpenChange,
}: ModelManagementDialogProps) {
  const { config, updateModel, addModel, removeModel, toggleModel } = useAIConfig();
  const [selectedProviderId, setSelectedProviderId] = useState(config.activeProviderId);
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const enabledProviders = config.providers.filter(p => p.enabled);
  const selectedProvider = config.providers.find(p => p.id === selectedProviderId);
  const providerModels = config.models.filter(m => m.providerId === selectedProviderId);

  const handleEdit = (model: ModelConfig) => {
    setEditingModel(model);
    setShowAddForm(false);
  };

  const handleAdd = () => {
    setShowAddForm(true);
    setEditingModel(null);
  };

  const handleDelete = async (modelId: string) => {
    if (confirm("确定要删除此模型吗？")) {
      await removeModel(modelId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Model 管理</DialogTitle>
          <DialogDescription>
            管理每个渠道下的模型及其参数配置
          </DialogDescription>
        </DialogHeader>

        {editingModel ? (
          <ModelEditForm
            model={editingModel}
            onSave={async (updates) => {
              await updateModel(editingModel.id, updates);
              setEditingModel(null);
            }}
            onCancel={() => setEditingModel(null)}
          />
        ) : showAddForm ? (
          <ModelAddForm
            providerId={selectedProviderId}
            onSave={async (model) => {
              await addModel(model);
              setShowAddForm(false);
            }}
            onCancel={() => setShowAddForm(false)}
          />
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>选择渠道</Label>
              <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {enabledProviders.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">
                {selectedProvider?.name} 的模型
              </h3>
              <Button size="sm" onClick={handleAdd}>
                <Plus className="size-4 mr-1" />
                添加模型
              </Button>
            </div>

            <div className="space-y-2">
              {providerModels.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  此渠道暂无模型
                </div>
              ) : (
                providerModels.map((model) => (
                  <div
                    key={model.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{model.name}</span>
                        {model.isBuiltIn && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            内置
                          </span>
                        )}
                        {!model.enabled && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            已禁用
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Temperature: {model.parameters.temperature} | 
                        Max Tokens: {model.parameters.maxTokens || 'N/A'} | 
                        Top P: {model.parameters.topP}
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleModel(model.id)}
                      >
                        {model.enabled ? '禁用' : '启用'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(model)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      {!model.isBuiltIn && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(model.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Model编辑表单
function ModelEditForm({
  model,
  onSave,
  onCancel,
}: {
  model: ModelConfig;
  onSave: (updates: Partial<ModelConfig>) => Promise<void>;
  onCancel: () => void;
}) {
  const [temperature, setTemperature] = useState(model.parameters.temperature);
  const [maxTokens, setMaxTokens] = useState(model.parameters.maxTokens?.toString() || "");
  const [topP, setTopP] = useState(model.parameters.topP ?? 1);

  const handleSave = async () => {
    await onSave({
      parameters: {
        temperature,
        maxTokens: maxTokens ? parseInt(maxTokens) : undefined,
        topP,
      },
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">编辑 {model.name}</h3>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Temperature</Label>
          <span className="text-sm text-muted-foreground">
            {temperature.toFixed(1)}
          </span>
        </div>
        <Slider
          min={0}
          max={2}
          step={0.1}
          value={[temperature]}
          onValueChange={([v]) => setTemperature(v)}
        />
      </div>

      <div className="space-y-2">
        <Label>Max Tokens</Label>
        <Input
          type="number"
          value={maxTokens}
          onChange={(e) => setMaxTokens(e.target.value)}
          placeholder="4096"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Top P</Label>
          <span className="text-sm text-muted-foreground">
            {topP.toFixed(2)}
          </span>
        </div>
        <Slider
          min={0}
          max={1}
          step={0.05}
          value={[topP]}
          onValueChange={([v]) => setTopP(v)}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button onClick={handleSave}>
          保存
        </Button>
      </div>
    </div>
  );
}

// Model添加表单
function ModelAddForm({
  providerId,
  onSave,
  onCancel,
}: {
  providerId: string;
  onSave: (model: Omit<ModelConfig, 'id' | 'isBuiltIn'>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState("4096");
  const [topP, setTopP] = useState(1);

  const handleSave = async () => {
    if (!name.trim()) {
      alert("模型名称必填");
      return;
    }

    await onSave({
      name: name.trim(),
      providerId,
      parameters: {
        temperature,
        maxTokens: maxTokens ? parseInt(maxTokens) : undefined,
        topP,
      },
      enabled: true,
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">添加模型</h3>

      <div className="space-y-2">
        <Label>模型名称 *</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如: gpt-4"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Temperature</Label>
          <span className="text-sm text-muted-foreground">
            {temperature.toFixed(1)}
          </span>
        </div>
        <Slider
          min={0}
          max={2}
          step={0.1}
          value={[temperature]}
          onValueChange={([v]) => setTemperature(v)}
        />
      </div>

      <div className="space-y-2">
        <Label>Max Tokens</Label>
        <Input
          type="number"
          value={maxTokens}
          onChange={(e) => setMaxTokens(e.target.value)}
          placeholder="4096"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Top P</Label>
          <span className="text-sm text-muted-foreground">
            {topP.toFixed(2)}
          </span>
        </div>
        <Slider
          min={0}
          max={1}
          step={0.05}
          value={[topP]}
          onValueChange={([v]) => setTopP(v)}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button onClick={handleSave}>
          添加
        </Button>
      </div>
    </div>
  );
}