// ============================================================================
// AI Configuration Encryption Utilities
// ============================================================================

import type { EncryptionResult } from './ai-config-types';

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
 * @deprecated Use EncryptionService.encrypt() from './encryption-service.ts' instead
 * Encrypt an API key using AES-256-GCM
 * Returns a base64-encoded string containing: salt|iv|encrypted_data
 */
export async function encryptApiKey(apiKey: string): Promise<string> {
  // Try to use new encryption service if available
  try {
    const { EncryptionService } = await import('./encryption-service');
    if (EncryptionService.isAvailable()) {
      return await EncryptionService.encrypt(apiKey);
    }
  } catch {
    // Fall back to legacy implementation if new service is not available
    console.warn('New EncryptionService not available, using legacy encryption');
  }

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
  return btoa(Array.from(combined, byte => String.fromCharCode(byte)).join(''));
}

/**
 * @deprecated Use EncryptionService.decrypt() from './encryption-service.ts' instead
 * Decrypt an API key using AES-256-GCM
 * Expects a base64-encoded string containing: salt|iv|encrypted_data
 */
export async function decryptApiKey(encrypted: string): Promise<string> {
  // Try to use new encryption service if available
  try {
    const { EncryptionService } = await import('./encryption-service');
    if (EncryptionService.isAvailable()) {
      return await EncryptionService.decrypt(encrypted);
    }
  } catch {
    // Fall back to legacy implementation if new service is not available
    console.warn('New EncryptionService not available, using legacy decryption');
  }

  if (!encrypted) {
    throw new Error('Encrypted data cannot be empty');
  }

  try {
    // Decode from base64
    const combined = new Uint8Array(atob(encrypted).split('').map(c => c.charCodeAt(0)));

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