import { openai, createOpenAI } from "@ai-sdk/openai";
import { google, createGoogleGenerativeAI } from "@ai-sdk/google";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export interface ModelConfig {
  id: string;
  name: string;
  parameters: {
    temperature: number;
    maxTokens?: number;
    topP?: number;
  };
}

export interface CustomProvider {
  id: string;
  name: string;
  type: 'openai-compatible';
  baseURL: string;
  apiKey?: string;
  enabled: boolean;
  models: ModelConfig[];
}

export interface AIConfig {
  provider: "openai" | "google" | "bedrock" | "openrouter" | string; // string for custom provider ID
  model: string;
  apiKey?: string; // Encrypted storage
  parameters?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
  customProviders?: CustomProvider[]; // User-added custom providers
}

export const MODEL_OPTIONS = {
  openai: ["gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"],
  google: [
    "gemini-2.5-flash-preview-05-20",
    "gemini-2.5-pro",
    "gemini-pro",
  ],
  bedrock: [
    "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
    "anthropic.claude-sonnet-4-20250514-v1:0",
    "anthropic.claude-3-5-sonnet-20240620-v1:0",
  ],
  openrouter: [
    "anthropic/claude-3.5-sonnet",
    "google/gemini-pro",
    "openai/gpt-4-turbo",
  ],
};

export function getEnvConfig(): AIConfig {
  // Default to bedrock with environment variables
  return {
    provider: "bedrock",
    model: "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
    parameters: {
      temperature: 0,
    },
  };
}

export function validateConfig(config: AIConfig): boolean {
  // Check if it's a built-in provider
  const builtInProviders = ["openai", "google", "bedrock", "openrouter"];
  const isBuiltIn = builtInProviders.includes(config.provider);

  if (isBuiltIn) {
    // Validate model exists in provider's model list
    const models = MODEL_OPTIONS[config.provider as keyof typeof MODEL_OPTIONS];
    if (!models.includes(config.model)) {
      return false;
    }
  } else {
    // For custom providers, check if it exists in customProviders
    if (!config.customProviders) {
      return false;
    }
    const customProvider = config.customProviders.find(p => p.id === config.provider);
    if (!customProvider) {
      return false;
    }
    // Validate model exists in custom provider's model list
    if (!customProvider.models.some(m => m.id === config.model || m.name === config.model)) {
      return false;
    }
  }

  // Validate parameters if provided
  if (config.parameters) {
    if (
      config.parameters.temperature !== undefined &&
      (config.parameters.temperature < 0 || config.parameters.temperature > 2)
    ) {
      return false;
    }

    if (
      config.parameters.maxTokens !== undefined &&
      config.parameters.maxTokens <= 0
    ) {
      return false;
    }

    if (
      config.parameters.topP !== undefined &&
      (config.parameters.topP < 0 || config.parameters.topP > 1)
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Validate a custom provider configuration
 * Prevents SSRF attacks and ensures valid configuration
 */
export function validateCustomProvider(provider: CustomProvider): boolean {
  if (!provider.name || provider.name.trim() === '') return false;
  if (!provider.models || provider.models.length === 0) return false;

  try {
    const url = new URL(provider.baseURL);
    if (url.protocol !== 'https:') return false;

    const hostname = url.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Migrate legacy provider data to new format
 */
export function migrateProvider(provider: any): CustomProvider {
  if (provider.models && provider.models.length > 0 && typeof provider.models[0] === 'string') {
    return {
      ...provider,
      enabled: provider.enabled ?? true,
      models: provider.models.map((m: string) => ({
        id: m,
        name: m,
        parameters: {
          temperature: 0,
          maxTokens: 4096,
          topP: 1
        }
      }))
    };
  }
  return provider;
}

export function createModelFromConfig(config: AIConfig): any {
  switch (config.provider) {
    case "openai": {
      if (config.apiKey) {
        const customOpenAI = createOpenAI({
          apiKey: config.apiKey,
        });
        return customOpenAI(config.model);
      }
      return openai(config.model);
    }

    case "google": {
      if (config.apiKey) {
        const customGoogle = createGoogleGenerativeAI({
          apiKey: config.apiKey,
        });
        return customGoogle(config.model);
      }
      return google(config.model);
    }

    case "bedrock":
      // Bedrock uses environment variables for credentials
      return bedrock(config.model);

    case "openrouter": {
      const openrouter = createOpenRouter({
        apiKey: config.apiKey || process.env.OPENROUTER_API_KEY,
      });
      return openrouter(config.model);
    }

    default: {
      // Handle custom providers
      if (config.customProviders) {
        const customProvider = config.customProviders.find(p => p.id === config.provider);
        if (customProvider) {
          // Use standard OpenAI client for OpenAI-compatible endpoints
          const customOpenAI = createOpenAI({
            apiKey: customProvider.apiKey || config.apiKey || '',
            baseURL: customProvider.baseURL,
          });
          return customOpenAI(config.model);
        }
      }
      throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }
}
// ============================================================================
// Encryption Utilities for API Key Storage
// ============================================================================

export interface EncryptionResult {
  encrypted: string;
  iv: string;
  salt: string;
}

export interface EncryptionResult {
  encrypted: string;
  iv: string;
  salt: string;
}

/**
 * Generate a device-specific key based on browser fingerprint
 * This key is used for encryption/decryption and is never stored
 */

export function getDeviceKey(): string {
  // Combine multiple browser characteristics for fingerprinting
  const userAgent = navigator.userAgent;
  const screenResolution = `${screen.width}x${screen.height}`;
  const colorDepth = screen.colorDepth.toString();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const language = navigator.language;

  // Create a stable fingerprint
  const fingerprint = `${userAgent}|${screenResolution}|${colorDepth}|${timezone}|${language}`;

  return fingerprint;
}

/**
 * Derive a cryptographic key from the device fingerprint using PBKDF2
 */
async function deriveKey(deviceKey: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(deviceKey),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Create a new ArrayBuffer from the Uint8Array for Web Crypto API compatibility
  const saltBuffer = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength);
  // Ensure we have a proper ArrayBuffer (not SharedArrayBuffer)
  const compatibleSalt = new Uint8Array(salt).buffer;

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: compatibleSalt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt an API key using AES-256-GCM
 * Returns a base64-encoded string containing: salt|iv|encrypted_data
 */
export async function encryptApiKey(apiKey: string): Promise<string> {
  if (!apiKey) {
    throw new Error('API key cannot be empty');
  }

  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Derive encryption key from device fingerprint
  const deviceKey = getDeviceKey();
  const key = await deriveKey(deviceKey, salt);

  // Encrypt the API key
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    encoder.encode(apiKey)
  );

  // Combine salt, iv, and encrypted data
  const encryptedArray = new Uint8Array(encrypted);
  const combined = new Uint8Array(salt.length + iv.length + encryptedArray.length);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(encryptedArray, salt.length + iv.length);

  // Convert to base64 for storage
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt an API key using AES-256-GCM
 * Expects a base64-encoded string containing: salt|iv|encrypted_data
 */
export async function decryptApiKey(encrypted: string): Promise<string> {
  if (!encrypted) {
    throw new Error('Encrypted data cannot be empty');
  }

  try {
    // Decode from base64
    const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));

    // Extract salt, iv, and encrypted data
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encryptedData = combined.slice(28);

    // Derive decryption key from device fingerprint
    const deviceKey = getDeviceKey();
    const key = await deriveKey(deviceKey, salt);

    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encryptedData
    );

    // Convert back to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    throw new Error('Failed to decrypt API key. The key may be corrupted or was encrypted on a different device.');
  }
}

/**
 * Test if encryption/decryption is working correctly
 * This is a utility function for development/testing
 */
export async function testEncryption(): Promise<boolean> {
  try {
    const testKey = 'test-api-key-12345';
    const encrypted = await encryptApiKey(testKey);
    const decrypted = await decryptApiKey(encrypted);
    return testKey === decrypted;
  } catch (error) {
    console.error('Encryption test failed:', error);
    return false;
  }
}
