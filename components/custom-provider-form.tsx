"use client";

import React, { useState } from "react";
import type { CustomProvider } from "@/lib/ai-config-utils";
import { validateCustomProvider } from "@/lib/ai-config-utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export interface CustomProviderFormProps {
  provider?: CustomProvider; // Edit mode
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
  const [models, setModels] = useState(
    provider?.models.join(", ") || ""
  );
  const [apiKey, setApiKey] = useState(provider?.apiKey || "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate name
    if (!name.trim()) {
      newErrors.name = "Provider name is required";
    }

    // Validate baseURL
    if (!baseURL.trim()) {
      newErrors.baseURL = "Base URL is required";
    } else {
      try {
        const url = new URL(baseURL);

        // Must use HTTPS
        if (url.protocol !== "https:") {
          newErrors.baseURL = "Base URL must use HTTPS";
        }

        // Prevent SSRF attacks - block internal addresses
        const hostname = url.hostname.toLowerCase();
        if (
          hostname === "localhost" ||
          hostname.startsWith("127.") ||
          hostname.startsWith("192.168.") ||
          hostname.startsWith("10.") ||
          hostname.startsWith("172.16.") ||
          hostname.startsWith("172.17.") ||
          hostname.startsWith("172.18.") ||
          hostname.startsWith("172.19.") ||
          hostname.startsWith("172.20.") ||
          hostname.startsWith("172.21.") ||
          hostname.startsWith("172.22.") ||
          hostname.startsWith("172.23.") ||
          hostname.startsWith("172.24.") ||
          hostname.startsWith("172.25.") ||
          hostname.startsWith("172.26.") ||
          hostname.startsWith("172.27.") ||
          hostname.startsWith("172.28.") ||
          hostname.startsWith("172.29.") ||
          hostname.startsWith("172.30.") ||
          hostname.startsWith("172.31.")
        ) {
          newErrors.baseURL = "Internal/private IP addresses are not allowed";
        }
      } catch (error) {
        newErrors.baseURL = "Invalid URL format";
      }
    }

    // Validate models
    const modelList = models
      .split(",")
      .map((m) => m.trim())
      .filter((m) => m);
    if (modelList.length === 0) {
      newErrors.models = "At least one model name is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      return;
    }

    const modelList = models
      .split(",")
      .map((m) => m.trim())
      .filter((m) => m);

    const newProvider: CustomProvider = {
      id: provider?.id || `custom-${Date.now()}`,
      name: name.trim(),
      type: "openai-compatible",
      baseURL: baseURL.trim(),
      models: modelList,
      apiKey: apiKey.trim() || undefined,
    };

    // Final validation using the utility function
    if (!validateCustomProvider(newProvider)) {
      setErrors({ general: "Invalid provider configuration" });
      return;
    }

    onSave(newProvider);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="provider-name">Provider Name *</Label>
        <Input
          id="provider-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., My Custom API"
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="base-url">Base URL *</Label>
        <Input
          id="base-url"
          value={baseURL}
          onChange={(e) => setBaseURL(e.target.value)}
          placeholder="https://api.example.com/v1"
          aria-invalid={!!errors.baseURL}
        />
        {errors.baseURL && (
          <p className="text-sm text-destructive">{errors.baseURL}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Must use HTTPS. Internal/private IP addresses are not allowed.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="models">Model Names *</Label>
        <Input
          id="models"
          value={models}
          onChange={(e) => setModels(e.target.value)}
          placeholder="gpt-4, gpt-3.5-turbo"
          aria-invalid={!!errors.models}
        />
        {errors.models && (
          <p className="text-sm text-destructive">{errors.models}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Comma-separated list of model names
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="api-key">API Key (Optional)</Label>
        <Input
          id="api-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
        />
        <p className="text-xs text-muted-foreground">
          Will be encrypted and stored securely
        </p>
      </div>

      {errors.general && (
        <p className="text-sm text-destructive">{errors.general}</p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          {provider ? "Update" : "Add"} Provider
        </Button>
      </div>
    </div>
  );
}
