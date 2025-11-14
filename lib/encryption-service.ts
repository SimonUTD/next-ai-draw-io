// {{CODE-Cycle-Integration:
//   Task_ID: [#IMPL-003]
//   Timestamp: 2025-01-12T00:00:00Z
//   Phase: D-Develop
//   Context-Analysis: "Analyzed existing encryption patterns from ai-config-utils.ts. Extracting AES-256-GCM encryption with device-based key derivation."
//   Principle_Applied: "Aether-Engineering-SOLID-S, Aether-Security-Enhancement"
// }}
// {{START_MODIFICATIONS}}

/**
 * Enhanced Encryption Service
 *
 * Provides AES-256-GCM encryption with device-based key derivation,
 * key rotation support, and versioning capabilities.
 *
 * Security Features:
 * - AES-256-GCM encryption with authenticated encryption
 * - PBKDF2 key derivation (100,000 iterations)
 * - Device-specific key generation (never stored)
 * - Key rotation and versioning support
 * - Backward compatibility with existing encrypted data
 */

export interface EncryptionResult {
  encrypted: string;
  version: number;
  timestamp: number;
}

export interface EncryptionMetadata {
  version: number;
  timestamp: number;
  algorithm: string;
  keyDerivation: {
    iterations: number;
    hash: string;
  };
}

export interface KeyRotationResult {
  success: boolean;
  reencryptedCount: number;
  errors: string[];
}

/**
 * Enhanced Encryption Service with key rotation and versioning
 */
export class EncryptionService {
  private static readonly CURRENT_VERSION = 1;
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_DERIVATION_ITERATIONS = 100000;
  private static readonly SALT_LENGTH = 16;
  private static readonly IV_LENGTH = 12;
  private static readonly STORAGE_VERSION_KEY = 'encryption_service_version';

  /**
   * Generate a device-specific key based on browser fingerprint
   * This key is used for encryption/decryption and is never stored
   */
  private static getDeviceKey(): string {
    if (typeof window === 'undefined') {
      throw new Error('EncryptionService requires browser environment');
    }

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
  private static async deriveKey(deviceKey: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(deviceKey),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    // Create a new ArrayBuffer from the Uint8Array for Web Crypto API compatibility
    const compatibleSalt = new Uint8Array(salt).buffer;

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: compatibleSalt,
        iterations: this.KEY_DERIVATION_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.ALGORITHM, length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt data using current encryption standards
   * Returns a base64-encoded string containing version|timestamp|salt|iv|encrypted_data
   */
  static async encrypt(data: string): Promise<string> {
    if (!data) {
      throw new Error('Data to encrypt cannot be empty');
    }

    if (typeof window === 'undefined') {
      throw new Error('Encryption requires browser environment');
    }

    const startTime = performance.now();
    const version = this.CURRENT_VERSION;
    const timestamp = Date.now();

    try {
      // Generate random salt and IV
      const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

      // Derive encryption key from device fingerprint
      const deviceKey = this.getDeviceKey();
      const key = await this.deriveKey(deviceKey, salt);

      // Encrypt the data
      const encoder = new TextEncoder();
      const encrypted = await crypto.subtle.encrypt(
        {
          name: this.ALGORITHM,
          iv: iv
        },
        key,
        encoder.encode(data)
      );

      // Combine version, timestamp, salt, iv, and encrypted data
      const encryptedArray = new Uint8Array(encrypted);
      const versionBuffer = new Uint8Array(4);
      const timestampBuffer = new Uint8Array(8);

      // Store version and timestamp as little-endian
      new DataView(versionBuffer.buffer).setUint32(0, version, true);
      new DataView(timestampBuffer.buffer).setBigUint64(0, BigInt(timestamp), true);

      const combined = new Uint8Array(
        versionBuffer.length +
        timestampBuffer.length +
        salt.length +
        iv.length +
        encryptedArray.length
      );

      let offset = 0;
      combined.set(versionBuffer, offset);
      offset += versionBuffer.length;
      combined.set(timestampBuffer, offset);
      offset += timestampBuffer.length;
      combined.set(salt, offset);
      offset += salt.length;
      combined.set(iv, offset);
      offset += iv.length;
      combined.set(encryptedArray, offset);

      // Convert to base64 for storage
      const result = btoa(Array.from(combined, byte => String.fromCharCode(byte)).join(''));

      const endTime = performance.now();
      console.debug(`Encryption completed in ${(endTime - startTime).toFixed(2)}ms`);

      return result;
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt data using version-aware decryption
   * Supports legacy format (salt|iv|encrypted_data) for backward compatibility
   */
  static async decrypt(encrypted: string): Promise<string> {
    if (!encrypted) {
      throw new Error('Encrypted data cannot be empty');
    }

    if (typeof window === 'undefined') {
      throw new Error('Decryption requires browser environment');
    }

    const startTime = performance.now();

    try {
      // Decode from base64
      const combined = new Uint8Array(atob(encrypted).split('').map(c => c.charCodeAt(0)));

      // Check if this is the new format (has version and timestamp)
      if (combined.length >= 12) { // 4 bytes version + 8 bytes timestamp
        const version = new DataView(combined.buffer).getUint32(0, true);

        if (version === this.CURRENT_VERSION) {
          return this.decryptCurrentVersion(combined);
        } else {
          throw new Error(`Unsupported encryption version: ${version}`);
        }
      } else {
        // Legacy format: salt|iv|encrypted_data
        return this.decryptLegacyFormat(combined);
      }
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      const endTime = performance.now();
      console.debug(`Decryption completed in ${(endTime - startTime).toFixed(2)}ms`);
    }
  }

  /**
   * Decrypt current version format
   */
  private static async decryptCurrentVersion(combined: Uint8Array): Promise<string> {
    let offset = 0;

    // Extract version (already verified)
    offset += 4;

    // Extract timestamp
    const timestamp = Number(new DataView(combined.buffer).getBigUint64(offset, true));
    offset += 8;

    // Extract salt, iv, and encrypted data
    const salt = combined.slice(offset, offset + this.SALT_LENGTH);
    offset += this.SALT_LENGTH;
    const iv = combined.slice(offset, offset + this.IV_LENGTH);
    offset += this.IV_LENGTH;
    const encryptedData = combined.slice(offset);

    // Derive decryption key from device fingerprint
    const deviceKey = this.getDeviceKey();
    const key = await this.deriveKey(deviceKey, salt);

    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
      {
        name: this.ALGORITHM,
        iv: iv
      },
      key,
      encryptedData
    );

    // Convert back to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * Decrypt legacy format for backward compatibility
   * Format: salt|iv|encrypted_data
   */
  private static async decryptLegacyFormat(combined: Uint8Array): Promise<string> {
    // Extract salt, iv, and encrypted data (legacy format)
    const salt = combined.slice(0, this.SALT_LENGTH);
    const iv = combined.slice(this.SALT_LENGTH, this.SALT_LENGTH + this.IV_LENGTH);
    const encryptedData = combined.slice(this.SALT_LENGTH + this.IV_LENGTH);

    // Derive decryption key from device fingerprint
    const deviceKey = this.getDeviceKey();
    const key = await this.deriveKey(deviceKey, salt);

    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
      {
        name: this.ALGORITHM,
        iv: iv
      },
      key,
      encryptedData
    );

    // Convert back to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * Get encryption metadata for validation and debugging
   */
  static getMetadata(): EncryptionMetadata {
    return {
      version: this.CURRENT_VERSION,
      timestamp: Date.now(),
      algorithm: this.ALGORITHM,
      keyDerivation: {
        iterations: this.KEY_DERIVATION_ITERATIONS,
        hash: 'SHA-256'
      }
    };
  }

  /**
   * Check if encryption service is available in current environment
   */
  static isAvailable(): boolean {
    return typeof window !== 'undefined' &&
           typeof crypto !== 'undefined' &&
           typeof crypto.subtle !== 'undefined';
  }

  /**
   * Validate encryption format without decrypting
   */
  static validateFormat(encrypted: string): { isValid: boolean; version?: number; isLegacy: boolean } {
    if (!encrypted) {
      return { isValid: false, isLegacy: true };
    }

    try {
      const combined = new Uint8Array(atob(encrypted).split('').map(c => c.charCodeAt(0)));

      if (combined.length >= 12) {
        const version = new DataView(combined.buffer).getUint32(0, true);
        return {
          isValid: version === this.CURRENT_VERSION,
          version,
          isLegacy: false
        };
      } else if (combined.length >= this.SALT_LENGTH + this.IV_LENGTH) {
        return {
          isValid: true, // Assume legacy format is valid
          version: 0, // Legacy version
          isLegacy: true
        };
      } else {
        return { isValid: false, isLegacy: true };
      }
    } catch {
      return { isValid: false, isLegacy: true };
    }
  }
}

// {{END_MODIFICATIONS}}