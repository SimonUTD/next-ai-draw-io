import { openai, createOpenAI } from "@ai-sdk/openai";
import { google, createGoogleGenerativeAI } from "@ai-sdk/google";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export interface CustomProvider {
  id: string; // User-defined ID
  name: string; // Display name
  type: 'openai-compatible' | 'custom-api';
  baseURL: string; // Custom API endpoint
  models: string[]; // Available model list
  apiKey?: string; // Encrypted storage
  customEndpoint?: boolean; // Whether this uses a non-standard endpoint
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
    if (!customProvider.models.includes(config.model)) {
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
  // Provider name must not be empty
  if (!provider.name || provider.name.trim() === '') {
    return false;
  }

  // Must have at least one model
  if (!provider.models || provider.models.length === 0) {
    return false;
  }

  // Validate baseURL
  try {
    const url = new URL(provider.baseURL);

    // Must use HTTPS
    if (url.protocol !== 'https:') {
      return false;
    }

    // Prevent SSRF attacks - block internal addresses
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.17.') ||
      hostname.startsWith('172.18.') ||
      hostname.startsWith('172.19.') ||
      hostname.startsWith('172.20.') ||
      hostname.startsWith('172.21.') ||
      hostname.startsWith('172.22.') ||
      hostname.startsWith('172.23.') ||
      hostname.startsWith('172.24.') ||
      hostname.startsWith('172.25.') ||
      hostname.startsWith('172.26.') ||
      hostname.startsWith('172.27.') ||
      hostname.startsWith('172.28.') ||
      hostname.startsWith('172.29.') ||
      hostname.startsWith('172.30.') ||
      hostname.startsWith('172.31.')
    ) {
      return false;
    }

    return true;
  } catch (error) {
    // Invalid URL
    return false;
  }
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
          if (customProvider.type === 'openai-compatible') {
            // Check if the baseURL uses a non-standard endpoint
            if (customProvider.customEndpoint) {
              // For custom endpoints that don't follow OpenAI format, create a custom HTTP client
              const customClient = {
                async doGenerate(messages: any[], options: any = {}) {
                  try {
                    const response = await fetch(`${customProvider.baseURL}`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${customProvider.apiKey || config.apiKey || ''}`
                      },
                      body: JSON.stringify({
                        model: config.model,
                        messages: messages,
                        ...options
                    })
                  });

                  if (!response.ok) {
                    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
                  }

                  const result = await response.json();
                  return result;
                } catch (error) {
                  console.error('Custom API error:', error);
                  throw error;
                }
              }
            };
            return customClient;
          } else {
            // Use standard OpenAI client for OpenAI-compatible endpoints
            const customOpenAI = createOpenAI({
              apiKey: customProvider.apiKey || config.apiKey || '',
              baseURL: customProvider.baseURL,
            });
            return customOpenAI(config.model);
          }
        } else {
          throw new Error(`Unsupported provider: ${config.provider}`);
        }
      }
      throw new Error(`Unsupported provider: ${config.provider}`);
    }
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
