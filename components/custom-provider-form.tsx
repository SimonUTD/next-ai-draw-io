"use client";

import React, { useState } from "react";
import { CustomProvider, ModelConfig } from "@/lib/ai-config-types";
import { validateCustomProvider } from "@/lib/ai-config-utils";
import { testProviderConnection, testModelAvailability } from "@/lib/provider-testing";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Loader2, Plus, Trash2, TestTube } from "lucide-react";

export interface CustomProviderFormProps {
  provider?: CustomProvider;
  onSave: (provider: CustomProvider) => void;
  onCancel: () => void;
}

export function CustomProviderForm({
  provider,
  onSave,
  onCancel,
}: CustomProviderFormProps) {
  const [name, setName] = useState(provider?.name || "");
  const [baseURL, setBaseURL] = useState(provider?.baseURL || "");
  const [apiKey, setApiKey] = useState(provider?.apiKey || "");
  const [enabled, setEnabled] = useState(provider?.enabled ?? true);
  const [models, setModels] = useState<ModelConfig[]>(
    provider?.models || []
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string>("");

  const addModel = () => {
    setModels([
      ...models,
      {
        id: "",
        name: "",
        parameters: {
          temperature: 0,
          maxTokens: 4096,
          topP: 1,
        },
      },
    ]);
  };

  const removeModel = (index: number) => {
    setModels(models.filter((_, i) => i !== index));
  };

  const updateModel = (index: number, field: keyof ModelConfig, value: any) => {
    const updated = [...models];
    if (field === "parameters") {
      updated[index] = { ...updated[index], parameters: value };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setModels(updated);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult("");

    const testProvider: CustomProvider = {
      id: provider?.id || `custom-${Date.now()}`,
      name: name.trim(),
      type: "openai-compatible",
      baseURL: baseURL.trim(),
      apiKey: apiKey.trim() || undefined,
      enabled: true,
      models: models.filter(m => m.name.trim()),
    };

    const result = await testProviderConnection(testProvider);
    setTestResult(
      result.success
        ? `✓ 连接成功 (${result.latency}ms)`
        : `✗ 连接失败: ${result.message}`
    );
    setTesting(false);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = "渠道名称必填";
    if (!baseURL.trim()) {
      newErrors.baseURL = "Base URL 必填";
    } else {
      try {
        const url = new URL(baseURL);
        if (url.protocol !== "https:") {
          newErrors.baseURL = "必须使用 HTTPS";
        }
      } catch {
        newErrors.baseURL = "无效的 URL 格式";
      }
    }

    const validModels = models.filter(m => m.name.trim());
    if (validModels.length === 0) {
      newErrors.models = "至少需要一个模型";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;

    const validModels = models.filter(m => m.name.trim()).map(m => ({
      ...m,
      id: m.id || m.name,
      name: m.name.trim(),
    }));

    const newProvider: CustomProvider = {
      id: provider?.id || `custom-${Date.now()}`,
      name: name.trim(),
      type: "openai-compatible",
      baseURL: baseURL.trim(),
      apiKey: apiKey.trim() || undefined,
      enabled,
      models: validModels,
    };

    if (!validateCustomProvider(newProvider)) {
      setErrors({ general: "配置验证失败" });
      return;
    }

    onSave(newProvider);
  };

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
      <div className="space-y-2">
        <Label htmlFor="provider-name">渠道名称 *</Label>
        <Input
          id="provider-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如: My Custom API"
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="base-url">Base URL *</Label>
        <Input
          id="base-url"
          value={baseURL}
          onChange={(e) => setBaseURL(e.target.value)}
          placeholder="https://api.example.com/v1"
        />
        {errors.baseURL && <p className="text-sm text-destructive">{errors.baseURL}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="api-key">API Key</Label>
        <Input
          id="api-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="size-4 rounded"
        />
        <Label htmlFor="enabled">启用此渠道</Label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>模型配置 *</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addModel}
          >
            <Plus className="size-4 mr-1" />
            添加模型
          </Button>
        </div>

        {models.map((model, index) => (
          <div key={index} className="border rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="模型名称 (例如: gpt-4)"
                value={model.name}
                onChange={(e) => updateModel(index, "name", e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeModel(index)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Temperature</Label>
                <span className="text-xs text-muted-foreground">
                  {model.parameters.temperature.toFixed(1)}
                </span>
              </div>
              <Slider
                min={0}
                max={2}
                step={0.1}
                value={[model.parameters.temperature]}
                onValueChange={([v]) =>
                  updateModel(index, "parameters", {
                    ...model.parameters,
                    temperature: v,
                  })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Max Tokens</Label>
                <Input
                  type="number"
                  value={model.parameters.maxTokens || ""}
                  onChange={(e) =>
                    updateModel(index, "parameters", {
                      ...model.parameters,
                      maxTokens: parseInt(e.target.value) || undefined,
                    })
                  }
                  placeholder="4096"
                />
              </div>
              <div>
                <Label className="text-xs">Top P</Label>
                <Input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={model.parameters.topP || ""}
                  onChange={(e) =>
                    updateModel(index, "parameters", {
                      ...model.parameters,
                      topP: parseFloat(e.target.value) || undefined,
                    })
                  }
                  placeholder="1"
                />
              </div>
            </div>
          </div>
        ))}

        {errors.models && <p className="text-sm text-destructive">{errors.models}</p>}
      </div>

      {testResult && (
        <div className={`text-sm p-2 rounded ${testResult.startsWith("✓") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {testResult}
        </div>
      )}

      {errors.general && <p className="text-sm text-destructive">{errors.general}</p>}

      <div className="flex justify-between gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleTest}
          disabled={testing || !name.trim() || !baseURL.trim()}
        >
          {testing ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              测试中...
            </>
          ) : (
            <>
              <TestTube className="size-4 mr-2" />
              测试连接
            </>
          )}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button onClick={handleSave}>
            {provider ? "更新" : "添加"}渠道
          </Button>
        </div>
      </div>
    </div>
  );
}
