"use client";

import React, { useState } from "react";
import { useAIConfig } from "@/contexts/ai-config-context-v2";
import { ProviderConfig } from "@/lib/ai-config-types-v2";
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
import { Pencil, Plus, Trash2 } from "lucide-react";

interface ProviderManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProviderManagementDialog({
  open,
  onOpenChange,
}: ProviderManagementDialogProps) {
  const { config, updateProvider, addProvider, removeProvider, toggleProvider } = useAIConfig();
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const handleEdit = (provider: ProviderConfig) => {
    setEditingProvider(provider);
    setShowAddForm(false);
  };

  const handleAdd = () => {
    setShowAddForm(true);
    setEditingProvider(null);
  };

  const handleDelete = async (providerId: string) => {
    if (confirm("确定要删除此渠道吗？")) {
      await removeProvider(providerId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Provider 管理</DialogTitle>
          <DialogDescription>
            管理AI渠道配置，包括API Key、Base URL等
          </DialogDescription>
        </DialogHeader>

        {editingProvider ? (
          <ProviderEditForm
            provider={editingProvider}
            onSave={async (updates) => {
              await updateProvider(editingProvider.id, updates);
              setEditingProvider(null);
            }}
            onCancel={() => setEditingProvider(null)}
          />
        ) : showAddForm ? (
          <ProviderAddForm
            onSave={async (provider) => {
              await addProvider(provider);
              setShowAddForm(false);
            }}
            onCancel={() => setShowAddForm(false)}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">所有渠道</h3>
              <Button size="sm" onClick={handleAdd}>
                <Plus className="size-4 mr-1" />
                添加自定义渠道
              </Button>
            </div>

            <div className="space-y-2">
              {config.providers.map((provider) => (
                <div
                  key={provider.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{provider.name}</span>
                      {provider.isBuiltIn && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          内置
                        </span>
                      )}
                      {!provider.enabled && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          已禁用
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {provider.type === 'custom' && provider.baseURL && (
                        <span>Base URL: {provider.baseURL}</span>
                      )}
                      {provider.apiKey && <span className="ml-2">✓ API Key已配置</span>}
                      {provider.region && <span className="ml-2">区域: {provider.region}</span>}
                    </div>
                  </div>

                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleProvider(provider.id)}
                    >
                      {provider.enabled ? '禁用' : '启用'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(provider)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    {!provider.isBuiltIn && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(provider.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Provider编辑表单
function ProviderEditForm({
  provider,
  onSave,
  onCancel,
}: {
  provider: ProviderConfig;
  onSave: (updates: Partial<ProviderConfig>) => Promise<void>;
  onCancel: () => void;
}) {
  const [apiKey, setApiKey] = useState(provider.apiKey || "");
  const [baseURL, setBaseURL] = useState(provider.baseURL || "");
  const [region, setRegion] = useState(provider.region || "");
  const [accessKeyId, setAccessKeyId] = useState(provider.accessKeyId || "");
  const [secretAccessKey, setSecretAccessKey] = useState(provider.secretAccessKey || "");

  const handleSave = async () => {
    const updates: Partial<ProviderConfig> = {};
    
    if (apiKey !== provider.apiKey) updates.apiKey = apiKey || undefined;
    if (baseURL !== provider.baseURL) updates.baseURL = baseURL || undefined;
    if (region !== provider.region) updates.region = region || undefined;
    if (accessKeyId !== provider.accessKeyId) updates.accessKeyId = accessKeyId || undefined;
    if (secretAccessKey !== provider.secretAccessKey) updates.secretAccessKey = secretAccessKey || undefined;
    
    await onSave(updates);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">编辑 {provider.name}</h3>

      {provider.type === 'custom' && (
        <div className="space-y-2">
          <Label>Base URL</Label>
          <Input
            value={baseURL}
            onChange={(e) => setBaseURL(e.target.value)}
            placeholder="https://api.example.com/v1"
          />
        </div>
      )}

      {provider.type !== 'bedrock' && (
        <div className="space-y-2">
          <Label>API Key</Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
          />
        </div>
      )}

      {provider.type === 'bedrock' && (
        <>
          <div className="space-y-2">
            <Label>AWS Region</Label>
            <Input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="us-east-1"
            />
          </div>
          <div className="space-y-2">
            <Label>Access Key ID</Label>
            <Input
              value={accessKeyId}
              onChange={(e) => setAccessKeyId(e.target.value)}
              placeholder="AKIA..."
            />
          </div>
          <div className="space-y-2">
            <Label>Secret Access Key</Label>
            <Input
              type="password"
              value={secretAccessKey}
              onChange={(e) => setSecretAccessKey(e.target.value)}
              placeholder="..."
            />
          </div>
        </>
      )}

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

// Provider添加表单
function ProviderAddForm({
  onSave,
  onCancel,
}: {
  onSave: (provider: Omit<ProviderConfig, 'id' | 'isBuiltIn'>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [baseURL, setBaseURL] = useState("");
  const [apiKey, setApiKey] = useState("");

  const handleSave = async () => {
    if (!name.trim() || !baseURL.trim()) {
      alert("名称和Base URL必填");
      return;
    }

    await onSave({
      name: name.trim(),
      type: 'custom',
      baseURL: baseURL.trim(),
      apiKey: apiKey.trim() || undefined,
      enabled: true,
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">添加自定义渠道</h3>

      <div className="space-y-2">
        <Label>渠道名称 *</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如: My Custom API"
        />
      </div>

      <div className="space-y-2">
        <Label>Base URL *</Label>
        <Input
          value={baseURL}
          onChange={(e) => setBaseURL(e.target.value)}
          placeholder="https://api.example.com/v1"
        />
      </div>

      <div className="space-y-2">
        <Label>API Key</Label>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
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