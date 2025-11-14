"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import type { AIConfigV2, ProviderConfig, ModelConfig } from "@/lib/ai-config-types-v2";
import { detectConfigVersion, migrateToV2, getDefaultV2Config } from "@/lib/ai-config-migration";
import { encryptApiKey, decryptApiKey } from "@/lib/ai-config-utils";

interface AIConfigContextType {
  config: AIConfigV2;
  
  // Provider管理
  updateProvider: (providerId: string, updates: Partial<ProviderConfig>) => Promise<void>;
  addProvider: (provider: Omit<ProviderConfig, 'id' | 'isBuiltIn'>) => Promise<void>;
  removeProvider: (providerId: string) => Promise<void>;
  toggleProvider: (providerId: string) => Promise<void>;
  
  // Model管理
  updateModel: (modelId: string, updates: Partial<ModelConfig>) => Promise<void>;
  addModel: (model: Omit<ModelConfig, 'id' | 'isBuiltIn'>) => Promise<void>;
  removeModel: (modelId: string) => Promise<void>;
  toggleModel: (modelId: string) => Promise<void>;
  
  // 激活配置
  setActiveConfig: (providerId: string, modelId: string) => Promise<void>;
  
  // 工具方法
  getActiveProvider: () => ProviderConfig | undefined;
  getActiveModel: () => ModelConfig | undefined;
  getProviderModels: (providerId: string) => ModelConfig[];
  
  resetToEnv: () => void;
  isUsingEnvConfig: boolean;
}

const AIConfigContext = createContext<AIConfigContextType | undefined>(undefined);

const STORAGE_KEY = "aiConfig";
const STORAGE_KEY_V1_BACKUP = "aiConfig_v1_backup";

export function AIConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AIConfigV2>(getDefaultV2Config());
  const [isUsingEnvConfig, setIsUsingEnvConfig] = useState(true);

  // 加载配置并自动迁移
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsedConfig = JSON.parse(stored);
          const version = detectConfigVersion(parsedConfig);
          
          let finalConfig: AIConfigV2;
          
          if (version === 1) {
            // 迁移V1到V2
            console.log('检测到V1配置，正在迁移到V2...');
            finalConfig = migrateToV2(parsedConfig);
            
            // 备份旧配置
            localStorage.setItem(STORAGE_KEY_V1_BACKUP, stored);
            console.log('V1配置已备份');
          } else {
            finalConfig = parsedConfig as AIConfigV2;
          }
          
          // 解密所有Provider的API Keys
          finalConfig.providers = await Promise.all(
            finalConfig.providers.map(async (provider) => {
              if (provider.apiKey) {
                try {
                  provider.apiKey = await decryptApiKey(provider.apiKey);
                } catch (error) {
                  console.error(`解密Provider ${provider.name} 的API Key失败:`, error);
                  provider.apiKey = undefined;
                }
              }
              if (provider.secretAccessKey) {
                try {
                  provider.secretAccessKey = await decryptApiKey(provider.secretAccessKey);
                } catch (error) {
                  console.error(`解密Provider ${provider.name} 的Secret Key失败:`, error);
                  provider.secretAccessKey = undefined;
                }
              }
              return provider;
            })
          );
          
          setConfig(finalConfig);
          setIsUsingEnvConfig(false);
        }
      } catch (error) {
        console.error("加载AI配置失败:", error);
        localStorage.removeItem(STORAGE_KEY);
      }
    };

    loadConfig();
  }, []);

  // 保存配置到localStorage
  const saveConfig = async (newConfig: AIConfigV2) => {
    try {
      const configToStore = { ...newConfig };
      
      // 加密所有Provider的API Keys
      configToStore.providers = await Promise.all(
        configToStore.providers.map(async (provider) => {
          const encrypted = { ...provider };
          if (encrypted.apiKey) {
            encrypted.apiKey = await encryptApiKey(encrypted.apiKey);
          }
          if (encrypted.secretAccessKey) {
            encrypted.secretAccessKey = await encryptApiKey(encrypted.secretAccessKey);
          }
          return encrypted;
        })
      );
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(configToStore));
    } catch (error) {
      console.error("保存AI配置失败:", error);
    }
  };

  // Provider管理
  const updateProvider = async (providerId: string, updates: Partial<ProviderConfig>) => {
    const updatedProviders = config.providers.map(p =>
      p.id === providerId ? { ...p, ...updates } : p
    );
    const newConfig = { ...config, providers: updatedProviders };
    setConfig(newConfig);
    setIsUsingEnvConfig(false);
    await saveConfig(newConfig);
  };

  const addProvider = async (provider: Omit<ProviderConfig, 'id' | 'isBuiltIn'>) => {
    const newProvider: ProviderConfig = {
      ...provider,
      id: `custom-${Date.now()}`,
      isBuiltIn: false,
    };
    const newConfig = {
      ...config,
      providers: [...config.providers, newProvider],
    };
    setConfig(newConfig);
    setIsUsingEnvConfig(false);
    await saveConfig(newConfig);
  };

  const removeProvider = async (providerId: string) => {
    const provider = config.providers.find(p => p.id === providerId);
    if (provider?.isBuiltIn) {
      console.error("不能删除内置Provider");
      return;
    }
    
    // 删除Provider及其所有Models
    const updatedProviders = config.providers.filter(p => p.id !== providerId);
    const updatedModels = config.models.filter(m => m.providerId !== providerId);
    
    // 如果删除的是当前激活的Provider，切换到默认
    let newActiveProviderId = config.activeProviderId;
    let newActiveModelId = config.activeModelId;
    
    if (config.activeProviderId === providerId) {
      newActiveProviderId = 'bedrock';
      newActiveModelId = updatedModels.find(m => m.providerId === 'bedrock')?.id || updatedModels[0].id;
    }
    
    const newConfig = {
      ...config,
      providers: updatedProviders,
      models: updatedModels,
      activeProviderId: newActiveProviderId,
      activeModelId: newActiveModelId,
    };
    
    setConfig(newConfig);
    setIsUsingEnvConfig(false);
    await saveConfig(newConfig);
  };

  const toggleProvider = async (providerId: string) => {
    const updatedProviders = config.providers.map(p =>
      p.id === providerId ? { ...p, enabled: !p.enabled } : p
    );
    const newConfig = { ...config, providers: updatedProviders };
    setConfig(newConfig);
    setIsUsingEnvConfig(false);
    await saveConfig(newConfig);
  };

  // Model管理
  const updateModel = async (modelId: string, updates: Partial<ModelConfig>) => {
    const updatedModels = config.models.map(m =>
      m.id === modelId ? { ...m, ...updates } : m
    );
    const newConfig = { ...config, models: updatedModels };
    setConfig(newConfig);
    setIsUsingEnvConfig(false);
    await saveConfig(newConfig);
  };

  const addModel = async (model: Omit<ModelConfig, 'id' | 'isBuiltIn'>) => {
    const newModel: ModelConfig = {
      ...model,
      id: `${model.providerId}-custom-${Date.now()}`,
      isBuiltIn: false,
    };
    const newConfig = {
      ...config,
      models: [...config.models, newModel],
    };
    setConfig(newConfig);
    setIsUsingEnvConfig(false);
    await saveConfig(newConfig);
  };

  const removeModel = async (modelId: string) => {
    const model = config.models.find(m => m.id === modelId);
    if (model?.isBuiltIn) {
      console.error("不能删除内置Model");
      return;
    }
    
    const updatedModels = config.models.filter(m => m.id !== modelId);
    
    // 如果删除的是当前激活的Model，切换到同Provider的第一个Model
    let newActiveModelId = config.activeModelId;
    if (config.activeModelId === modelId) {
      const sameProviderModel = updatedModels.find(m => m.providerId === config.activeProviderId);
      newActiveModelId = sameProviderModel?.id || updatedModels[0].id;
    }
    
    const newConfig = {
      ...config,
      models: updatedModels,
      activeModelId: newActiveModelId,
    };
    
    setConfig(newConfig);
    setIsUsingEnvConfig(false);
    await saveConfig(newConfig);
  };

  const toggleModel = async (modelId: string) => {
    const updatedModels = config.models.map(m =>
      m.id === modelId ? { ...m, enabled: !m.enabled } : m
    );
    const newConfig = { ...config, models: updatedModels };
    setConfig(newConfig);
    setIsUsingEnvConfig(false);
    await saveConfig(newConfig);
  };

  // 激活配置
  const setActiveConfig = async (providerId: string, modelId: string) => {
    const newConfig = {
      ...config,
      activeProviderId: providerId,
      activeModelId: modelId,
    };
    setConfig(newConfig);
    setIsUsingEnvConfig(false);
    await saveConfig(newConfig);
  };

  // 工具方法
  const getActiveProvider = () => {
    return config.providers.find(p => p.id === config.activeProviderId);
  };

  const getActiveModel = () => {
    return config.models.find(m => m.id === config.activeModelId);
  };

  const getProviderModels = (providerId: string) => {
    return config.models.filter(m => m.providerId === providerId);
  };

  const resetToEnv = () => {
    const envConfig = getDefaultV2Config();
    setConfig(envConfig);
    setIsUsingEnvConfig(true);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("重置配置失败:", error);
    }
  };

  return (
    <AIConfigContext.Provider
      value={{
        config,
        updateProvider,
        addProvider,
        removeProvider,
        toggleProvider,
        updateModel,
        addModel,
        removeModel,
        toggleModel,
        setActiveConfig,
        getActiveProvider,
        getActiveModel,
        getProviderModels,
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