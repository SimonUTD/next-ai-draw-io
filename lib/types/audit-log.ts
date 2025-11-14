// {{CODE-Cycle-Integration:
//   Task_ID: [3adac1ec-6d64-46ab-ae9e-62145daba696]
//   Timestamp: 2025-11-12T00:00:00Z
//   Phase: D-Develop
//   Context-Analysis: "Creating comprehensive audit logging interfaces following established patterns from provider-config.ts and config-testing.ts. Ensuring tamper protection and detailed change tracking."
//   Principle_Applied: "Aether-Engineering-SOLID-S, Aether-Security-Tamper-Proof, Aether-Engineering-Type-Safety"
// }}
// {{START_MODIFICATIONS}}

/**
 * Audit Logging System Types and Interfaces
 *
 * Comprehensive audit logging for AI provider configuration management
 * with tamper protection, cryptographic integrity, and detailed change tracking
 */

// ============================================================================
// Core Audit Interfaces
// ============================================================================

/**
 * Audit log entry interface for tracking configuration changes
 */
export interface AuditLogEntry {
  /** Unique identifier for the audit entry */
  id: string;
  /** Timestamp when the change occurred */
  timestamp: Date;
  /** Type of configuration change */
  changeType: AuditChangeType;
  /** Entity that was changed */
  entityType: AuditEntityType;
  /** ID of the entity that was changed */
  entityId: string;
  /** Previous state before the change (encrypted) */
  previousState?: string;
  /** New state after the change (encrypted) */
  newState?: string;
  /** User or system that initiated the change */
  initiator: AuditInitiator;
  /** Device from which the change was made */
  deviceFingerprint: string;
  /** Session identifier for tracking user sessions */
  sessionId?: string;
  /** Cryptographic hash for tamper protection */
  integrityHash: string;
  /** Digital signature for authenticity verification */
  signature: string;
  /** IP address from which the change was made */
  ipAddress?: string;
  /** User agent string */
  userAgent?: string;
  /** Additional metadata about the change */
  metadata: AuditEntryMetadata;
  /** Change status */
  status: AuditEntryStatus;
  /** Related audit entries for complex operations */
  relatedEntries?: string[];
  /** Entry version for migration support */
  version: number;
}

/**
 * Audit log service interface following established service patterns
 */
export interface IAuditLog {
  /**
   * Log a configuration change with tamper protection
   */
  logChange(entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'integrityHash' | 'signature' | 'version'>): Promise<string>;

  /**
   * Query audit logs with filtering and pagination
   */
  queryLogs(query: AuditLogQuery): Promise<AuditLogQueryResult>;

  /**
   * Get a specific audit entry by ID
   */
  getEntry(entryId: string): Promise<AuditLogEntry | null>;

  /**
   * Verify the integrity of audit log entries
   */
  verifyIntegrity(entryIds?: string[]): Promise<AuditIntegrityResult>;

  /**
   * Export audit logs for compliance reporting
   */
  exportLogs(query: AuditLogQuery, format: 'json' | 'csv' | 'pdf'): Promise<ExportResult>;

  /**
   * Purge old audit logs based on retention policy
   */
  purgeLogs(retentionPolicy: AuditRetentionPolicy): Promise<PurgeResult>;

  /**
   * Get audit statistics and analytics
   */
  getStatistics(filter: AuditStatisticsFilter): Promise<AuditStatistics>;

  /**
   * Search audit logs by content or metadata
   */
  searchLogs(search: AuditLogSearch): Promise<AuditLogQueryResult>;
}

// ============================================================================
// Enumerations and Constants
// ============================================================================

/**
 * Types of configuration changes that can be audited
 */
export type AuditChangeType =
  | 'provider_created'
  | 'provider_updated'
  | 'provider_deleted'
  | 'provider_enabled'
  | 'provider_disabled'
  | 'provider_tested'
  | 'model_created'
  | 'model_updated'
  | 'model_deleted'
  | 'model_enabled'
  | 'model_disabled'
  | 'api_key_rotated'
  | 'api_key_updated'
  | 'configuration_imported'
  | 'configuration_exported'
  | 'migration_performed'
  | 'rollback_executed'
  | 'backup_created'
  | 'backup_restored'
  | 'sync_completed'
  | 'sync_failed'
  | 'security_alert'
  | 'user_login'
  | 'user_logout'
  | 'system_initialized'
  | 'custom';

/**
 * Entity types that can be audited
 */
export type AuditEntityType =
  | 'provider'
  | 'model'
  | 'user_preferences'
  | 'api_key'
  | 'backup'
  | 'migration'
  | 'sync_session'
  | 'device'
  | 'user_session'
  | 'system';

/**
 * Status of audit log entries
 */
export type AuditEntryStatus =
  | 'success'
  | 'failure'
  | 'pending'
  | 'warning'
  | 'critical';

/**
 * Initiator types for audit entries
 */
export interface AuditInitiator {
  /** Type of initiator */
  type: 'user' | 'system' | 'api' | 'service';
  /** Identifier for the initiator */
  id: string;
  /** Display name of the initiator */
  name?: string;
  /** Additional initiator context */
  context?: Record<string, any>;
}

// ============================================================================
// Query and Filter Types
// ============================================================================

/**
 * Query parameters for audit log searches
 */
export interface AuditLogQuery {
  /** Filter by date range */
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  /** Filter by change types */
  changeTypes?: AuditChangeType[];
  /** Filter by entity types */
  entityTypes?: AuditEntityType[];
  /** Filter by specific entity IDs */
  entityIds?: string[];
  /** Filter by initiator */
  initiators?: AuditInitiator[];
  /** Filter by status */
  statuses?: AuditEntryStatus[];
  /** Search term for content matching */
  searchTerm?: string;
  /** Pagination parameters */
  pagination?: {
    page: number;
    pageSize: number;
    sortBy?: keyof AuditLogEntry;
    sortOrder?: 'asc' | 'desc';
  };
  /** Additional filters */
  filters?: {
    deviceFingerprint?: string;
    sessionId?: string;
    ipAddress?: string;
    hasRelatedEntries?: boolean;
  };
}

/**
 * Search parameters for audit logs
 */
export interface AuditLogSearch {
  /** Search query string */
  query: string;
  /** Search fields */
  fields?: Array<keyof AuditLogEntry>;
  /** Search type */
  searchType?: 'exact' | 'fuzzy' | 'regex';
  /** Query parameters */
  queryParams?: AuditLogQuery;
}

/**
 * Result of audit log query
 */
export interface AuditLogQueryResult {
  /** Array of audit log entries */
  entries: AuditLogEntry[];
  /** Total number of matching entries */
  totalCount: number;
  /** Current page number */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Query execution metadata */
  metadata: {
    queryTime: number;
    hasMore: boolean;
    nextCursor?: string;
    prevCursor?: string;
  };
}

// ============================================================================
// Integrity and Security Types
// ============================================================================

/**
 * Result of integrity verification
 */
export interface AuditIntegrityResult {
  /** Overall integrity status */
  valid: boolean;
  /** Number of verified entries */
  verifiedCount: number;
  /** Number of invalid entries */
  invalidCount: number;
  /** List of invalid entries with reasons */
  invalidEntries: Array<{
    entryId: string;
    reason: string;
    expectedHash?: string;
    actualHash?: string;
  }>;
  /** Verification timestamp */
  verifiedAt: Date;
  /** Verification metadata */
  metadata: {
    verificationTime: number;
    algorithm: string;
    version: number;
  };
}

/**
 * Digital signature information
 */
export interface DigitalSignature {
  /** Signature algorithm used */
  algorithm: string;
  /** Signature value */
  value: string;
  /** Public key used for verification */
  publicKey?: string;
  /** Signature timestamp */
  timestamp: Date;
}

// ============================================================================
// Configuration and Management Types
// ============================================================================

/**
 * Audit log service configuration
 */
export interface AuditLogServiceConfig {
  /** Maximum number of entries to keep */
  maxEntries: number;
  /** Retention period for audit logs */
  retentionPeriod: number; // in days
  /** Encryption settings */
  encryption: {
    algorithm: string;
    keyRotationInterval: number; // in days
  };
  /** Backup settings */
  backup: {
    enabled: boolean;
    interval: number; // in hours
    retention: number; // in days
  };
  /** Performance settings */
  performance: {
    batchSize: number;
    maxQueryTime: number; // in milliseconds
    compressionEnabled: boolean;
  };
  /** Security settings */
  security: {
    requireSignature: boolean;
    integrityCheckInterval: number; // in hours
    tamperDetectionEnabled: boolean;
  };
}

/**
 * Metadata for audit entries
 */
export interface AuditEntryMetadata {
  /** Additional context information */
  context?: Record<string, any>;
  /** Tags for categorization */
  tags?: string[];
  /** Severity level */
  severity?: 'low' | 'medium' | 'high' | 'critical';
  /** Category for grouping */
  category?: string;
  /** Source system or component */
  source?: string;
  /** Additional descriptive information */
  description?: string;
  /** Related external references */
  references?: string[];
}

/**
 * Retention policy for audit logs
 */
export interface AuditRetentionPolicy {
  /** Retention period in days */
  retentionDays: number;
  /** Maximum number of entries to keep */
  maxEntries?: number;
  /** Archive policy */
  archivePolicy?: {
    enabled: boolean;
    archiveAfterDays: number;
    archiveLocation: string;
  };
  /** Purge policy */
  purgePolicy?: {
    enabled: boolean;
    purgeAfterArchival: boolean;
    secureDelete: boolean;
  };
}

/**
 * Result of log purge operation
 */
export interface PurgeResult {
  /** Success status */
  success: boolean;
  /** Number of entries purged */
  purgedCount: number;
  /** Number of entries archived */
  archivedCount: number;
  /** Number of errors encountered */
  errorCount: number;
  /** Purge operation details */
  details: {
    startTime: Date;
    endTime: Date;
    duration: number;
    spaceFreed: number; // in bytes
  };
  /** Errors encountered */
  errors?: string[];
}

// ============================================================================
// Export and Statistics Types
// ============================================================================

/**
 * Result of export operation
 */
export interface ExportResult {
  /** Success status */
  success: boolean;
  /** Export format */
  format: 'json' | 'csv' | 'pdf';
  /** Export data or file reference */
  data?: string | Blob;
  /** File URL if applicable */
  fileUrl?: string;
  /** Number of entries exported */
  entryCount: number;
  /** Export metadata */
  metadata: {
    exportTime: Date;
    fileSize: number;
    compression: boolean;
    checksum?: string;
  };
  /** Errors encountered */
  errors?: string[];
}

/**
 * Filter for audit statistics
 */
export interface AuditStatisticsFilter {
  /** Date range for statistics */
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  /** Group by field */
  groupBy?: keyof AuditLogEntry;
  /** Filter by specific fields */
  filters?: Partial<AuditLogQuery>;
}

/**
 * Audit statistics and analytics
 */
export interface AuditStatistics {
  /** Total number of entries */
  totalEntries: number;
  /** Entries by change type */
  entriesByChangeType: Record<AuditChangeType, number>;
  /** Entries by entity type */
  entriesByEntityType: Record<AuditEntityType, number>;
  /** Entries by status */
  entriesByStatus: Record<AuditEntryStatus, number>;
  /** Activity timeline */
  activityTimeline: Array<{
    timestamp: Date;
    count: number;
    changeTypes: AuditChangeType[];
  }>;
  /** Top initiators */
  topInitiators: Array<{
    initiator: AuditInitiator;
    count: number;
    percentage: number;
  }>;
  /** Security metrics */
  securityMetrics: {
    totalAlerts: number;
    criticalAlerts: number;
    suspiciousActivities: number;
    integrityViolations: number;
  };
  /** Performance metrics */
  performanceMetrics: {
    averageQueryTime: number;
    totalStorageUsed: number;
    compressionRatio: number;
  };
}

// ============================================================================
// Default Configurations and Constants
// ============================================================================

/**
 * Default audit log service configuration
 */
export const DEFAULT_AUDIT_CONFIG: AuditLogServiceConfig = {
  maxEntries: 100000,
  retentionPeriod: 365, // 1 year
  encryption: {
    algorithm: 'AES-256-GCM',
    keyRotationInterval: 90, // 90 days
  },
  backup: {
    enabled: true,
    interval: 24, // 24 hours
    retention: 30, // 30 days
  },
  performance: {
    batchSize: 1000,
    maxQueryTime: 5000, // 5 seconds
    compressionEnabled: true,
  },
  security: {
    requireSignature: true,
    integrityCheckInterval: 6, // 6 hours
    tamperDetectionEnabled: true,
  },
};

/**
 * Audit log storage key
 */
export const AUDIT_LOG_STORAGE_KEY = 'ai-config-audit-logs';

/**
 * Audit log service version
 */
export const AUDIT_LOG_VERSION = '1.0.0';

// {{END_MODIFICATIONS}}