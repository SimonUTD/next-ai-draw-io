"use client";

import React from "react";
import { useAIConfig } from "@/contexts/ai-config-context";
import { MODEL_OPTIONS } from "@/lib/ai-config-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, Settings } from "lucide-react";

export interface ModelQuickSwitchProps {
  onOpenDetailConfig: () => void;
}

export function ModelQuickSwitch({ onOpenDetailConfig }: ModelQuickSwitchProps) {
  const { config, updateConfig } = useAIConfig();

  // Get display name for current provider
  const getProviderDisplayName = (providerId: string): string => {
    const providerNames: Record<string, string> = {
      openai: "OpenAI",
      google: "Google",
      bedrock: "Bedrock",
      openrouter: "OpenRouter",
    };

    if (providerNames[providerId]) {
      return providerNames[providerId];
    }

    // Custom provider
    const customProvider = config.customProviders?.find(p => p.id === providerId);
    return customProvider?.name || providerId;
  };

  // Get short model name (remove provider prefix if present)
  const getShortModelName = (model: string): string => {
    // For models like "anthropic/claude-3.5-sonnet", show just "claude-3.5-sonnet"
    const parts = model.split("/");
    return parts[parts.length - 1];
  };

  // Generate all available model options
  const getAllModelOptions = () => {
    const options: Array<{ provider: string; providerName: string; model: string }> = [];

    // Built-in providers
    Object.entries(MODEL_OPTIONS).forEach(([provider, models]) => {
      models.forEach((model) => {
        options.push({
          provider,
          providerName: getProviderDisplayName(provider),
          model,
        });
      });
    });

    // Custom providers (only enabled ones)
    if (config.customProviders) {
      config.customProviders
        .filter(cp => cp.enabled)
        .forEach((cp) => {
          cp.models.forEach((model) => {
            options.push({
              provider: cp.id,
              providerName: cp.name,
              model: model.name,
            });
          });
        });
    }

    return options;
  };

  const handleModelSwitch = async (provider: string, model: string) => {
    await updateConfig({
      provider,
      model,
    });
  };

  const currentDisplay = `${getProviderDisplayName(config.provider)} - ${getShortModelName(config.model)}`;
  const allOptions = getAllModelOptions();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <span className="text-sm">{currentDisplay}</span>
          <ChevronDown className="size-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[300px]">
        <DropdownMenuLabel>Quick Switch Model</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {allOptions.map((option, index) => {
          const isActive =
            option.provider === config.provider && option.model === config.model;
          const displayText = `${option.providerName} - ${getShortModelName(option.model)}`;

          return (
            <DropdownMenuItem
              key={`${option.provider}-${option.model}-${index}`}
              onClick={() => handleModelSwitch(option.provider, option.model)}
              className={isActive ? "bg-accent" : ""}
            >
              <span className="truncate">{displayText}</span>
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenDetailConfig} className="gap-2">
          <Settings className="size-4" />
          <span>Detailed Configuration</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
