/**
 * localDb.js — Re-export layer for backward compatibility.
 *
 * All 27+ consumer files import from "@/lib/localDb".
 * This thin layer re-exports everything from the domain-specific DB modules,
 * so zero consumer changes are needed.
 */

export {
  // Provider Connections
  getProviderConnections,
  getProviderConnectionById,
  createProviderConnection,
  updateProviderConnection,
  deleteProviderConnection,
  deleteProviderConnections,
  deleteProviderConnectionsByProvider,
  reorderProviderConnections,
  cleanupProviderConnections,

  // Provider Nodes
  getProviderNodes,
  getProviderNodeById,
  createProviderNode,
  updateProviderNode,
  deleteProviderNode,

  // T05: Rate-limit DB persistence (survives token refresh)
  setConnectionRateLimitUntil,
  isConnectionRateLimited,
  getRateLimitedConnections,

  // T05 startup recovery: clear stale transient cooldowns left by a prior crash
  clearStaleCrashCooldowns,

  // T13: Stale quota display fix (zero out usage after window resets)
  getEffectiveQuotaUsage,
  formatResetCountdown,
} from "./db/providers";

export {
  // Model Aliases
  getModelAliases,
  setModelAlias,
  deleteModelAlias,

  // MITM Alias
  getMitmAlias,
  setMitmAliasAll,

  // Custom Models
  getCustomModels,
  getAllCustomModels,
  addCustomModel,
  replaceCustomModels,
  removeCustomModel,
  updateCustomModel,
  getModelCompatOverrides,
  mergeModelCompatOverride,
  removeModelCompatOverride,
  getModelNormalizeToolCallId,
  getModelPreserveOpenAIDeveloperRole,
  getModelUpstreamExtraHeaders,
  getModelIsHidden,
  setModelIsHidden,

  // Synced Available Models
  getSyncedAvailableModels,
  getAllSyncedAvailableModels,
  replaceSyncedAvailableModelsForConnection,
  deleteSyncedAvailableModelsForConnection,
  deleteSyncedAvailableModelsForProvider,
  removeSyncedAvailableModel,
} from "./db/models";

export type { ModelCompatPerProtocol, ModelCompatPatch, SyncedAvailableModel } from "./db/models";

export {
  // Combos
  getCombos,
  getComboById,
  getComboByName,
  createCombo,
  updateCombo,
  reorderCombos,
  deleteCombo,
} from "./db/combos";

export {
  // API Keys
  getApiKeys,
  getApiKeyById,
  createApiKey,
  deleteApiKey,
  validateApiKey,
  getApiKeyMetadata,
  updateApiKeyPermissions,
  regenerateApiKey,
  isModelAllowedForKey,
  clearApiKeyCaches,
  resetApiKeyState,
} from "./db/apiKeys";

export {
  // Settings
  getSettings,
  updateSettings,

  // LKGP (Last Known Good Provider) (#919)
  getLKGP,
  setLKGP,

  // Pricing
  getPricing,
  getPricingWithSources,
  getPricingForModel,
  updatePricing,
  resetPricing,
  resetAllPricing,

  // Proxy Config
  getProxyConfig,
  getProxyForLevel,
  setProxyForLevel,
  deleteProxyForLevel,
  resolveProxyForConnection,
  setProxyConfig,
} from "./db/settings";

export type { PricingSource, PricingSourceMap } from "./db/settings";

export {
  getDatabaseSettings,
  getUserDatabaseSettings,
  updateDatabaseSettings,
} from "./db/databaseSettings";

export type { UserDatabaseSettings } from "./db/databaseSettings";

export {
  // Proxy Registry
  listProxies,
  getProxyById,
  createProxy,
  createProxyAndAssign,
  updateProxy,
  updateProxyAndAssign,
  upsertProxy,
  deleteProxyById,
  getProxyAssignments,
  getProxyWhereUsed,
  assignProxyToScope,
  resolveProxyForConnectionFromRegistry,
  resolveProxyForProvider,
  resolveProxyForScopeFromRegistry,
  migrateLegacyProxyConfigToRegistry,
  getProxyHealthStats,
  bulkAssignProxyToScope,
} from "./db/proxies";

export {
  // Pricing Sync
  getSyncedPricing,
  saveSyncedPricing,
  clearSyncedPricing,
  syncPricingFromSources,
  getSyncStatus,
  initPricingSync,
  startPeriodicSync,
  stopPeriodicSync,
} from "./pricingSync";

export {
  // Backup Management
  backupDbFile,
  cleanupDbBackups,
  getDbBackupMaxFiles,
  setDbBackupMaxFiles,
  getDbBackupRetentionDays,
  setDbBackupRetentionDays,
  listDbBackups,
  restoreDbBackup,
  // Export-All / Import helpers (#3500 slice 5)
  exportAllSummaryRows,
  getTableNamesFromAdapter,
  countImportedRows,
} from "./db/backup";

export type { ExportAllRows } from "./db/backup";

export {
  // Read Cache (cached wrappers for hot-read paths)
  getCachedSettings,
  getCachedPricing,
  getCachedProviderConnections,
  getCachedLKGP,
  setCachedLKGP,
  invalidateDbCache,
  getCombosCacheVersion,
} from "./db/readCache";

export {
  // Registered Keys Provisioning (#464)
  issueRegisteredKey,
  getRegisteredKey,
  listRegisteredKeys,
  revokeRegisteredKey,
  validateRegisteredKey,
  incrementRegisteredKeyUsage,
  checkQuota,
  setProviderKeyLimit,
  setAccountKeyLimit,
  getProviderKeyLimit,
  getAccountKeyLimit,
} from "./db/registeredKeys";

export type {
  RegisteredKey,
  RegisteredKeyWithSecret,
  ProviderKeyLimit,
  AccountKeyLimit,
  QuotaCheckResult,
  IssueKeyParams,
} from "./db/registeredKeys";

export { resolveComboForModel } from "./db/modelComboMappings";

export type { ModelComboMapping } from "./db/modelComboMappings";

export {
  saveQuotaSnapshot,
  getQuotaSnapshots,
  getAggregatedSnapshots,
  cleanupOldSnapshots,
} from "./db/quotaSnapshots";

export * from "./db/sessionAccountAffinity";

export type { QuotaSnapshotRow, ProviderUtilizationPoint } from "@/shared/types/utilization";

export {
  getUpstreamProxyConfigs,
  getUpstreamProxyConfig,
  upsertUpstreamProxyConfig,
  updateUpstreamProxyConfig,
  deleteUpstreamProxyConfig,
  getProvidersByMode,
  getFallbackChainForProvider,
  validateProxyUrl,
} from "./db/upstreamProxy";

export {
  getProviderLimitsCache,
  getAllProviderLimitsCache,
  setProviderLimitsCache,
  setProviderLimitsCacheBatch,
  deleteProviderLimitsCache,
} from "./db/providerLimits";

export type { ProviderLimitsCacheEntry } from "./db/providerLimits";

export {
  getPersistedCreditBalance,
  getAllPersistedCreditBalances,
  persistCreditBalance,
} from "./db/creditBalance";

export {
  // Reasoning Replay Cache (#1628)
  setReasoningCache,
  getReasoningCache,
  deleteReasoningCache,
  clearAllReasoningCache,
} from "./db/reasoningCache";

export type { ReasoningCacheEntry, ReasoningCacheStats } from "./db/reasoningCache";

export {
  getSessionAccountAffinity,
  upsertSessionAccountAffinity,
  touchSessionAccountAffinity,
  deleteSessionAccountAffinity,
  cleanupStaleSessionAccountAffinities,
  startSessionAccountAffinityCleanup,
  stopSessionAccountAffinityCleanupForTests,
} from "./db/sessionAccountAffinity";

export * from "./db/featureFlags";

export {
  upsertHandoff,
  getHandoff,
  deleteHandoff,
  cleanupExpiredHandoffs,
  hasActiveHandoff,
  recordSessionModelUsage,
  getLastSessionModel,
} from "./db/contextHandoffs";

export type { HandoffPayload } from "./db/contextHandoffs";

export {
  getAllKeyGroups,
  getKeyGroup,
  getKeyGroupWithPermissions,
  createKeyGroup,
  updateKeyGroup,
  deleteKeyGroup,
  getGroupPermissions,
  addGroupPermission,
  removeGroupPermission,
  clearGroupPermissions,
  getGroupMembers,
  getKeyGroupsForApiKey,
  addKeyToGroup,
  removeKeyFromGroup,
  checkKeyModelAccess,
} from "./db/apiKeyGroups";

// Plan 21 — Memory Engine Redesign
// Quota Sharing — Group B (planos 16+22)
export {
  // Per-API-Key Token Limits (migration 073)
  upsertTokenLimit,
  listTokenLimits,
  getTokenLimitsForRequest,
  deleteTokenLimit,
  getWindowUsage,
  incrementWindowTokens,
  resetWindowIfElapsed,
  logTokenLimitReset,
} from "./db/tokenLimits";

export type {
  TokenLimit,
  TokenLimitScopeType,
  UpsertTokenLimitInput,
  TokenWindowState,
} from "./db/tokenLimits";

export {
  // Model Intelligence (task-fitness scores)
  getModelIntelligence,
  getModelIntelligenceBySource,
  upsertModelIntelligence,
  deleteModelIntelligence,
  deleteExpiredIntelligence,
  deleteModelIntelligenceBySource,
  listModelIntelligence,
  bulkUpsertModelIntelligence,
  getResolvedTaskFitness,
  setUserFitnessOverrideEntry,
  deleteUserFitnessOverrideEntry,
} from "./db/modelIntelligence";

export type { ModelIntelligenceEntry } from "./db/modelIntelligence";

export { getProviderMetrics, getFallbackStats } from "./db/callLogStats";
export type { ProviderMetricRow, FallbackStatsRow } from "./db/callLogStats";

export {
  buildUnifiedSource,
  buildPresetUnifiedSource,
  getUsageSummary,
  getDailyUsage,
  getDailyCostRows,
  getHeatmapRows,
  getModelUsageRows,
  getProviderCostRows,
  getProviderUsageRows,
  getAccountCostRows,
  getAccountUsageRows,
  getApiKeyUsageRows,
  getServiceTierUsageRows,
  getApiKeyMetadataRows,
  getWeeklyPatternRows,
  getPresetCostModelRows,
  getAllUsageHistory,
  getAllDomainCostHistory,
  getAllDomainBudgets,
} from "./db/usageAnalytics";
export type {
  AnalyticsParams,
  BuildUnifiedSourceOptions,
  UnifiedSourceResult,
  UsageSummaryRow,
  DailyUsageRow,
  DailyCostRow,
  HeatmapRow,
  ModelUsageRow,
  ProviderCostRow,
  ProviderUsageRow,
  AccountCostRow,
  AccountUsageRow,
  ApiKeyUsageRow,
  ServiceTierUsageRow,
  ApiKeyMetadataRow,
  WeeklyPatternRow,
  PresetCostModelRow,
} from "./db/usageAnalytics";
