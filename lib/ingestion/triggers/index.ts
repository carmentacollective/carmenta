/**
 * Ingestion triggers - entry points for knowledge ingestion
 */

export { triggerFollowUpIngestion } from "./follow-up";
export { runScheduledSync, syncAllServices } from "./scheduled-sync";
export type { FollowUpIngestionConfig } from "./follow-up";
export type { SyncConfig } from "./scheduled-sync";
