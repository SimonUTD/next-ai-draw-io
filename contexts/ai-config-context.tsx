"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import type { AIConfig } from "@/lib/ai-config-utils";
import type { CustomProvider } from "@/lib/ai-config-types";
import { getEnvConfig, validateConfig, validateCustomProvider, migrateProvider } from "@/lib/ai-config-utils";
import { encryptApiKey, decryptApiKey } from "@/lib/ai-config-utils";

interface AIConfigContextType {
  config: AIConfig;
  updateConfig: (config: Partial<AIConfig>) => void;
  addCustomProvider: (provider: CustomProvider) => void;
  removeCustomProvider: (id: string) => void;
  resetToEnv: () => void;
  isUsingEnvConfig: boolean;
}

const AIConfigContext = createContext<AIConfigContextType | undefined>(
  undefined
);

const STORAGE_KEY = "aiConfig";

export function AIConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AIConfig>(getEnvConfig());
  const [isUsingEnvConfig, setIsUsingEnvConfig] = useState(true);

  // Load config from localStorage on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsedConfig = JSON.parse(stored) as AIConfig;

          // Decrypt API keys if present
          if (parsedConfig.apiKey) {
            try {
              parsedConfig.apiKey = await decryptApiKey(parsedConfig.apiKey);
            } catch (error) {
              console.error("Failed to decrypt API key:", error);
              parsedConfig.apiKey = undefined;
            }
          }

          // Migrate and decrypt custom provider API keys
          if (parsedConfig.customProviders) {
            parsedConfig.customProviders = await Promise.all(
              parsedConfig.customProviders.map(async (provider) => {
                // Migrate legacy format
                const migrated = migrateProvider(provider);
                
                // Decrypt API key
                if (migrated.apiKey) {
                  try {
                    migrated.apiKey = await decryptApiKey(migrated.apiKey);
                  } catch (error) {
                    console.error(`Failed to decrypt API key for provider ${migrated.name}:`, error);
                    migrated.apiKey = undefined;
                  }
                }
                
                return migrated;
              })
            );
          }

          if (validateConfig(parsedConfig)) {
            setConfig(parsedConfig);
            setIsUsingEnvConfig(false);
          } else {
            // Invalid config in localStorage, remove it
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (error) {
        console.error("Failed to load AI config from localStorage:", error);
        localStorage.removeItem(STORAGE_KEY);
      }
    };

    loadConfig();
  }, []);

  const updateConfig = async (newConfig: Partial<AIConfig>) => {
    const updatedConfig = { ...config, ...newConfig };

    if (validateConfig(updatedConfig)) {
      setConfig(updatedConfig);
      setIsUsingEnvConfig(false);

      try {
        // Create a copy for storage with encrypted API keys
        const configToStore = { ...updatedConfig };

        // Encrypt API key if present
        if (configToStore.apiKey) {
          configToStore.apiKey = await encryptApiKey(configToStore.apiKey);
        }

        // Encrypt custom provider API keys
        if (configToStore.customProviders) {
          configToStore.customProviders = await Promise.all(
            configToStore.customProviders.map(async (provider) => {
              if (provider.apiKey) {
                return {
                  ...provider,
                  apiKey: await encryptApiKey(provider.apiKey),
                };
              }
              return provider;
            })
          );
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(configToStore));
      } catch (error) {
        console.error("Failed to save AI config to localStorage:", error);
      }
    } else {
      console.error("Invalid AI configuration:", updatedConfig);
    }
  };

  const addCustomProvider = async (provider: CustomProvider) => {
    if (!validateCustomProvider(provider)) {
      console.error("Invalid custom provider:", provider);
      return;
    }

    const customProviders = config.customProviders || [];
    const existingIndex = customProviders.findIndex(p => p.id === provider.id);

    let updatedProviders: CustomProvider[];
    if (existingIndex >= 0) {
      // Update existing provider
      updatedProviders = [...customProviders];
      updatedProviders[existingIndex] = provider;
    } else {
      // Add new provider
      updatedProviders = [...customProviders, provider];
    }

    await updateConfig({ customProviders: updatedProviders });
  };

  const removeCustomProvider = async (id: string) => {
    const customProviders = config.customProviders || [];
    const updatedProviders = customProviders.filter(p => p.id !== id);

    // If the current provider is being removed, switch to default
    if (config.provider === id) {
      const envConfig = getEnvConfig();
      await updateConfig({
        provider: envConfig.provider,
        model: envConfig.model,
        customProviders: updatedProviders,
      });
    } else {
      await updateConfig({ customProviders: updatedProviders });
    }
  };

  const resetToEnv = () => {
    const envConfig = getEnvConfig();
    setConfig(envConfig);
    setIsUsingEnvConfig(true);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to remove AI config from localStorage:", error);
    }
  };

  return (
    <AIConfigContext.Provider
      value={{
        config,
        updateConfig,
        addCustomProvider,
        removeCustomProvider,
        resetToEnv,
        isUsingEnvConfig,
      }}
    >
      {children}
    </AIConfigContext.Provider>
  );
}

export function useAIConfig() {
  const context = useContext(AIConfigContext);
  if (context === undefined) {
    throw new Error("useAIConfig must be used within an AIConfigProvider");
  }
  return context;
}
