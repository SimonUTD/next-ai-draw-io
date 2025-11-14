"use client";

import React, { useState, useEffect } from "react";
import { useAIConfig } from "@/contexts/ai-config-context";
import { MODEL_OPTIONS, type AIConfig } from "@/lib/ai-config-utils";
import { type CustomProvider } from "@/lib/ai-config-types";
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
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CustomProviderForm } from "@/components/custom-provider-form";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface ModelConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModelConfigDialog({
  open,
  onOpenChange,
}: ModelConfigDialogProps) {
  const { config, updateConfig, addCustomProvider, removeCustomProvider, toggleBuiltInProvider, resetToEnv } = useAIConfig();

  // Local state for editing
  const [provider, setProvider] = useState<AIConfig["provider"]>(
    config.provider
  );
  const [model, setModel] = useState(config.model);
  const [apiKey, setApiKey] = useState(config.apiKey || "");
  const [temperature, setTemperature] = useState(
    config.parameters?.temperature ?? 0
  );
  const [maxTokens, setMaxTokens] = useState(
    config.parameters?.maxTokens?.toString() || ""
  );
  const [topP, setTopP] = useState(
    config.parameters?.topP ?? 1
  );
  const [error, setError] = useState<string>("");
  const [showCustomProviderForm, setShowCustomProviderForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<CustomProvider | undefined>();

  // Sync local state with context when dialog opens
  useEffect(() => {
    if (open) {
      setProvider(config.provider);
      setModel(config.model);
      setApiKey(config.apiKey || "");
      setTemperature(config.parameters?.temperature ?? 0);
      setMaxTokens(config.parameters?.maxTokens?.toString() || "");
      setTopP(config.parameters?.topP ?? 1);
      setError("");
      setShowCustomProviderForm(false);
      setEditingProvider(undefined);
    }
  }, [open, config]);

  // Update model options when provider changes
  useEffect(() => {
    const builtInProviders = ["openai", "google", "bedrock", "openrouter"];
    let models: string[];

    if (builtInProviders.includes(provider)) {
      models = MODEL_OPTIONS[provider as keyof typeof MODEL_OPTIONS];
    } else {
      // Custom provider
      const customProvider = config.customProviders?.find(p => p.id === provider);
      models = customProvider?.models.map(m => m.name) || [];
    }

    if (models.length > 0 && !models.includes(model)) {
      setModel(models[0]);
    }
  }, [provider, model, config.customProviders]);

  const handleSave = async () => {
    // Clear previous errors
    setError("");

    // Validate inputs
    if (!provider || !model) {
      setError("Provider and model are required");
      return;
    }

    if (!apiKey.trim()) {
      setError("API key is required");
      return;
    }

    if (temperature < 0 || temperature > 2) {
      setError("Temperature must be between 0 and 2");
      return;
    }

    if (maxTokens && parseInt(maxTokens, 10) <= 0) {
      setError("Max tokens must be a positive number");
      return;
    }

    if (topP < 0 || topP > 1) {
      setError("Top P must be between 0 and 1");
      return;
    }

    const newConfig: Partial<AIConfig> = {
      provider,
      model,
      apiKey: apiKey || undefined,
      parameters: {
        temperature,
        maxTokens: maxTokens ? parseInt(maxTokens, 10) : undefined,
        topP,
      },
      customProviders: config.customProviders,
    };

    await updateConfig(newConfig);
    onOpenChange(false);
  };

  const handleAddCustomProvider = async (provider: CustomProvider) => {
    await addCustomProvider(provider);
    setProvider(provider.id);
    setShowCustomProviderForm(false);
    setEditingProvider(undefined);
  };

  const handleEditProvider = (provider: CustomProvider) => {
    setEditingProvider(provider);
    setShowCustomProviderForm(true);
  };

  const handleDeleteProvider = async (providerId: string) => {
    if (confirm("确定要删除此渠道吗？")) {
      await removeCustomProvider(providerId);
    }
  };

  const handleReset = () => {
    resetToEnv();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>AI Model Configuration</DialogTitle>
          <DialogDescription>
            Configure your AI model settings. UI configuration takes priority
            over environment variables.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-4 py-4">
          {showCustomProviderForm ? (
            <CustomProviderForm
              provider={editingProvider}
              onSave={handleAddCustomProvider}
              onCancel={() => {
                setShowCustomProviderForm(false);
                setEditingProvider(undefined);
              }}
            />
          ) : (
            <>
              {/* Provider Selection */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="provider" className="text-sm font-medium">
                    Provider
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCustomProviderForm(true)}
                    className="h-7 gap-1 text-xs"
                  >
                    <Plus className="size-3" />
                    Add Custom
                  </Button>
                </div>
                <Select
                  value={provider}
                  onValueChange={(value) =>
                    setProvider(value as AIConfig["provider"])
                  }
                >
                  <SelectTrigger id="provider">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      { id: 'openai', name: 'OpenAI' },
                      { id: 'google', name: 'Google Gemini' },
                      { id: 'bedrock', name: 'AWS Bedrock' },
                      { id: 'openrouter', name: 'OpenRouter' }
                    ].map((builtIn) => {
                      const isDisabled = config.disabledProviders?.includes(builtIn.id);
                      return (
                        <div key={builtIn.id} className="flex items-center justify-between px-2 py-1.5 hover:bg-accent">
                          <SelectItem value={builtIn.id} className="flex-1 border-0">
                            {builtIn.name} {isDisabled && <span className="text-xs text-muted-foreground">(已禁用)</span>}
                          </SelectItem>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBuiltInProvider(builtIn.id);
                            }}
                          >
                            {isDisabled ? '启用' : '禁用'}
                          </Button>
                        </div>
                      );
                    })}
                    {config.customProviders && config.customProviders.length > 0 && (
                      <>
                        <div className="my-1 h-px bg-border" />
                        {config.customProviders.map((cp) => (
                          <div key={cp.id} className="flex items-center justify-between px-2 py-1.5 hover:bg-accent">
                            <SelectItem value={cp.id} className="flex-1 border-0">
                              {cp.name} {!cp.enabled && <span className="text-xs text-muted-foreground">(已禁用)</span>}
                            </SelectItem>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditProvider(cp);
                                }}
                              >
                                <Pencil className="size-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteProvider(cp.id);
                                }}
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Model Selection */}
              <div className="grid gap-2">
                <label htmlFor="model" className="text-sm font-medium">
                  Model
                </label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="model">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const builtInProviders = ["openai", "google", "bedrock", "openrouter"];
                      if (builtInProviders.includes(provider)) {
                        return MODEL_OPTIONS[provider as keyof typeof MODEL_OPTIONS].map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ));
                      } else {
                        const customProvider = config.customProviders?.find(p => p.id === provider);
                        return customProvider?.models.map((m) => (
                          <SelectItem key={m.id} value={m.name}>
                            {m.name}
                          </SelectItem>
                        )) || [];
                      }
                    })()}
                  </SelectContent>
                </Select>
              </div>

          {/* API Key Input */}
          <div className="grid gap-2">
            <label htmlFor="apiKey" className="text-sm font-medium">
              API Key *
            </label>
            <Input
              id="apiKey"
              type="password"
              placeholder="Enter API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          {/* Temperature Slider */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="temperature" className="text-sm font-medium">
                Temperature
              </label>
              <span className="text-sm text-muted-foreground">
                {temperature.toFixed(1)}
              </span>
            </div>
            <Slider
              id="temperature"
              min={0}
              max={2}
              step={0.1}
              value={[temperature]}
              onValueChange={(value) => setTemperature(value[0])}
            />
          </div>

              {/* Max Tokens Input */}
              <div className="grid gap-2">
                <label htmlFor="maxTokens" className="text-sm font-medium">
                  Max Tokens (Optional)
                </label>
                <Input
                  id="maxTokens"
                  type="number"
                  placeholder="e.g., 4096"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(e.target.value)}
                  min="1"
                />
              </div>

              {/* Top P Slider */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="topP" className="text-sm font-medium">
                    Top P
                  </label>
                  <span className="text-sm text-muted-foreground">
                    {topP.toFixed(2)}
                  </span>
                </div>
                <Slider
                  id="topP"
                  min={0}
                  max={1}
                  step={0.05}
                  value={[topP]}
                  onValueChange={(value) => setTopP(value[0])}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                API keys are encrypted and stored securely in your browser.
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleReset}>
            Reset to Environment
          </Button>
          <Button onClick={handleSave}>Save Configuration</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
