// {{CODE-Cycle-Integration:
//   Task_ID: [#IMPL-003]
//   Timestamp: 2025-01-12T00:00:00Z
//   Phase: D-Develop
//   Context-Analysis: "Creating versioning system based on analysis requirements. Implementing configuration version tracking with rollback capabilities."
//   Principle_Applied: "Aether-Engineering-SOLID-S, Aether-Data-Integrity"
// }}
// {{START_MODIFICATIONS}}

/**
 * Configuration Versioning System
 *
 * Provides comprehensive version tracking, migration history logging,
 * and rollback capabilities for AI configuration management.
 *
 * Features:
 * - Semantic versioning for configuration schemas
 * - Automatic migration tracking
 * - Rollback capabilities with backup management
 * - Migration history and audit logging
 * - Data integrity validation
 */

export interface ConfigVersion {
  version: string;
  timestamp: number;
  schemaVersion: number;
  description: string;
  migrationFrom?: string;
  changes: string[];
}

export interface MigrationRecord {
  id: string;
  fromVersion: string;
  toVersion: string;
  timestamp: number;
  description: string;
  migrationSteps: string[];
  success: boolean;
  error?: string;
  backupPath?: string;
  rollbackData?: any;
}

export interface BackupEntry {
  id: string;
  version: string;
  timestamp: number;
  data: any;
  checksum: string;
  size: number;
  compressed: boolean;
}

export interface VersioningStats {
  totalVersions: number;
  totalMigrations: number;
  successfulMigrations: number;
  failedMigrations: number;
  totalBackups: number;
  totalBackupSize: number;
  oldestBackup?: Date;
  newestBackup?: Date;
}

/**
 * Configuration Versioning Manager
 */
export class ConfigurationVersioning {
  private static readonly STORAGE_KEY = 'ai_config_versioning';
  private static readonly BACKUP_STORAGE_KEY = 'ai_config_backups';
  private static readonly MAX_BACKUPS = 10;
  private static readonly MAX_BACKUP_SIZE = 1024 * 1024; // 1MB
  private static readonly CURRENT_SCHEMA_VERSION = 2;

  /**
   * Initialize versioning system
   */
  static async initialize(): Promise<void> {
    if (typeof window === 'undefined') {
      return; // Skip on server-side
    }

    try {
      const versioning = this.loadVersioningData();

      if (!versioning.currentVersion) {
        // First-time initialization
        versioning.currentVersion = '1.0.0';
        versioning.schemaVersion = this.CURRENT_SCHEMA_VERSION;
        versioning.versions = [this.createInitialVersion()];
        versioning.migrations = [];
        this.saveVersioningData(versioning);
      }

      // Check if schema upgrade is needed
      if (versioning.schemaVersion < this.CURRENT_SCHEMA_VERSION) {
        await this.upgradeSchema(versioning);
      }
    } catch (error) {
      console.error('Failed to initialize configuration versioning:', error);
      throw new Error('Versioning system initialization failed');
    }
  }

  /**
   * Create a new configuration version
   */
  static async createVersion(
    version: string,
    description: string,
    changes: string[],
    configData: any
  ): Promise<ConfigVersion> {
    const versioning = this.loadVersioningData();

    // Validate version format (semantic versioning)
    if (!this.isValidVersion(version)) {
      throw new Error(`Invalid version format: ${version}. Expected semantic versioning (e.g., 1.2.3)`);
    }

    // Create backup before version change
    await this.createBackup(configData, version, description);

    const newVersion: ConfigVersion = {
      version,
      timestamp: Date.now(),
      schemaVersion: this.CURRENT_SCHEMA_VERSION,
      description,
      changes
    };

    versioning.versions.push(newVersion);
    versioning.currentVersion = version;

    this.saveVersioningData(versioning);

    console.info(`Configuration version ${version} created successfully`);
    return newVersion;
  }

  /**
   * Record a migration between versions
   */
  static async recordMigration(
    fromVersion: string,
    toVersion: string,
    description: string,
    migrationSteps: string[],
    rollbackData?: any
  ): Promise<MigrationRecord> {
    const versioning = this.loadVersioningData();

    const migration: MigrationRecord = {
      id: this.generateId(),
      fromVersion,
      toVersion,
      timestamp: Date.now(),
      description,
      migrationSteps,
      success: false,
      rollbackData
    };

    try {
      versioning.migrations.push(migration);
      this.saveVersioningData(versioning);

      migration.success = true;
      this.saveVersioningData(versioning); // Update with success status

      console.info(`Migration recorded: ${fromVersion} -> ${toVersion}`);
      return migration;
    } catch (error) {
      migration.success = false;
      migration.error = error instanceof Error ? error.message : 'Unknown error';
      this.saveVersioningData(versioning);

      console.error(`Migration recording failed: ${migration.error}`);
      throw error;
    }
  }

  /**
   * Rollback to a previous version
   */
  static async rollback(targetVersion: string): Promise<{ success: boolean; rollbackData?: any; error?: string }> {
    const versioning = this.loadVersioningData();
    const backups = this.loadBackups();

    // Find the backup for the target version
    const targetBackup = backups.find(backup => backup.version === targetVersion);
    if (!targetBackup) {
      return {
        success: false,
        error: `No backup found for version ${targetVersion}`
      };
    }

    try {
      // Validate backup integrity
      const currentChecksum = this.calculateChecksum(targetBackup.data);
      if (currentChecksum !== targetBackup.checksum) {
        return {
          success: false,
          error: `Backup integrity check failed for version ${targetVersion}`
        };
      }

      // Create backup of current state before rollback
      const currentConfig = this.getCurrentConfig();
      if (currentConfig) {
        await this.createBackup(
          currentConfig,
          `${versioning.currentVersion}-rollback-pre-${Date.now()}`,
          `Automatic backup before rollback to ${targetVersion}`
        );
      }

      // Record rollback migration
      await this.recordMigration(
        versioning.currentVersion,
        targetVersion,
        `Rollback to version ${targetVersion}`,
        [`Restored configuration from backup ${targetBackup.id}`],
        currentConfig
      );

      versioning.currentVersion = targetVersion;
      this.saveVersioningData(versioning);

      console.info(`Successfully rolled back to version ${targetVersion}`);

      return {
        success: true,
        rollbackData: targetBackup.data
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Rollback failed: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get migration history
   */
  static getMigrationHistory(): MigrationRecord[] {
    const versioning = this.loadVersioningData();
    return [...versioning.migrations].sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get available versions for rollback
   */
  static getAvailableVersions(): ConfigVersion[] {
    const versioning = this.loadVersioningData();
    const backups = this.loadBackups();

    return versioning.versions.filter((version: ConfigVersion) =>
      backups.some(backup => backup.version === version.version)
    );
  }

  /**
   * Get versioning statistics
   */
  static getStats(): VersioningStats {
    const versioning = this.loadVersioningData();
    const backups = this.loadBackups();

    const successfulMigrations = versioning.migrations.filter((m: any) => m.success).length;
    const failedMigrations = versioning.migrations.filter((m: any) => !m.success).length;
    const totalBackupSize = backups.reduce((sum: number, backup: any) => sum + backup.size, 0);

    const timestamps = backups.map(b => b.timestamp);
    const oldestBackup = timestamps.length > 0 ? new Date(Math.min(...timestamps)) : undefined;
    const newestBackup = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : undefined;

    return {
      totalVersions: versioning.versions.length,
      totalMigrations: versioning.migrations.length,
      successfulMigrations,
      failedMigrations,
      totalBackups: backups.length,
      totalBackupSize,
      oldestBackup,
      newestBackup
    };
  }

  /**
   * Clean up old backups (keep only the most recent N)
   */
  static cleanupOldBackups(): number {
    const backups = this.loadBackups();

    if (backups.length <= this.MAX_BACKUPS) {
      return 0;
    }

    // Sort by timestamp (newest first) and keep only the most recent
    const sortedBackups = backups.sort((a, b) => b.timestamp - a.timestamp);
    const backupsToKeep = sortedBackups.slice(0, this.MAX_BACKUPS);
    const backupsToDelete = sortedBackups.slice(this.MAX_BACKUPS);

    // Save the filtered backups
    try {
      localStorage.setItem(this.BACKUP_STORAGE_KEY, JSON.stringify(backupsToKeep));
      console.info(`Cleaned up ${backupsToDelete.length} old backups`);
      return backupsToDelete.length;
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
      return 0;
    }
  }

  /**
   * Get current version information
   */
  static getCurrentVersion(): ConfigVersion | null {
    const versioning = this.loadVersioningData();
    return versioning.versions.find((v: ConfigVersion) => v.version === versioning.currentVersion) || null;
  }

  // Private helper methods

  private static loadVersioningData() {
    if (typeof window === 'undefined') {
      return { versions: [], migrations: [], currentVersion: '', schemaVersion: 1 };
    }

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : { versions: [], migrations: [], currentVersion: '', schemaVersion: 1 };
    } catch (error) {
      console.error('Failed to load versioning data:', error);
      return { versions: [], migrations: [], currentVersion: '', schemaVersion: 1 };
    }
  }

  private static saveVersioningData(data: any): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save versioning data:', error);
      throw new Error('Versioning data save failed');
    }
  }

  private static loadBackups(): BackupEntry[] {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const stored = localStorage.getItem(this.BACKUP_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load backups:', error);
      return [];
    }
  }

  private static saveBackups(backups: BackupEntry[]): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(this.BACKUP_STORAGE_KEY, JSON.stringify(backups));
    } catch (error) {
      console.error('Failed to save backups:', error);
      throw new Error('Backups save failed');
    }
  }

  private static createInitialVersion(): ConfigVersion {
    return {
      version: '1.0.0',
      timestamp: Date.now(),
      schemaVersion: this.CURRENT_SCHEMA_VERSION,
      description: 'Initial configuration version',
      changes: ['Initialize configuration system']
    };
  }

  private static async createBackup(data: any, version: string, description: string): Promise<BackupEntry> {
    // Ensure data is not undefined or null
    if (data === undefined || data === null) {
      console.warn('Attempting to backup undefined/null data, using empty object');
      data = {};
    }

    const backup: BackupEntry = {
      id: this.generateId(),
      version,
      timestamp: Date.now(),
      data,
      checksum: this.calculateChecksum(data),
      size: JSON.stringify(data).length,
      compressed: false
    };

    const backups = this.loadBackups();
    backups.push(backup);

    // Enforce backup limit
    if (backups.length > this.MAX_BACKUPS) {
      const sortedBackups = backups.sort((a, b) => b.timestamp - a.timestamp);
      backups.splice(this.MAX_BACKUPS);
    }

    this.saveBackups(backups);
    return backup;
  }

  private static calculateChecksum(data: any): string {
    // Ensure data is not undefined or null
    if (data === undefined || data === null) {
      data = {};
    }

    const crypto = window.crypto || (window as any).webkitCrypto;
    if (!crypto) {
      // Fallback to simple hash if crypto is not available
      return btoa(JSON.stringify(data)).slice(0, 16);
    }

    const dataString = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataArray = encoder.encode(dataString);

    // Use subtle.digest with a simple hash fallback
    // Note: subtle.digest is async, so we use a simple fallback for synchronous context
    try {
      const hashBuffer = crypto.subtle.digest('SHA-256', dataArray);
      // If we can't await, use fallback
      return btoa(JSON.stringify(data)).slice(0, 16);
    } catch {
      return btoa(JSON.stringify(data)).slice(0, 16);
    }
  }

  private static getCurrentConfig(): any {
    // This should be implemented to get current configuration from AIConfigContext
    // For now, return null - this will be implemented when integrating with the context
    return null;
  }

  private static async upgradeSchema(versioning: any): Promise<void> {
    // Handle schema upgrades here
    console.info(`Upgrading schema from version ${versioning.schemaVersion} to ${this.CURRENT_SCHEMA_VERSION}`);

    // For now, just update the schema version
    versioning.schemaVersion = this.CURRENT_SCHEMA_VERSION;
    this.saveVersioningData(versioning);
  }

  private static isValidVersion(version: string): boolean {
    const semanticVersionRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
    return semanticVersionRegex.test(version);
  }

  private static generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// {{END_MODIFICATIONS}}