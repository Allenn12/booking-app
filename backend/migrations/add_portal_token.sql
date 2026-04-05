-- ============================================================
-- Migration: Add portal_token to clients table
-- Purpose:   Magic Link Customer Portal (permanent, unique link per client)
-- Date:      2026-04-05
-- ============================================================
-- 
-- SAFETY: ALTER TABLE on modern MySQL is instant metadata-only
-- for ADD COLUMN when using InnoDB + MySQL 8.0+ due to instant DDL.
-- The UNIQUE INDEX creation on an empty/small column is fast.
--
-- IDEMPOTENCY: This script uses IF NOT EXISTS / conditional guards
-- via the backfill script. Run the backfill AFTER this migration.
-- ============================================================

ALTER TABLE `clients`
  ADD COLUMN `portal_token` VARCHAR(32) DEFAULT NULL
    COMMENT 'Unique magic-link token for customer portal (base64url, 24 chars). NULL for walk-in clients.',

  ADD COLUMN `portal_token_active` TINYINT(1) NOT NULL DEFAULT 1
    COMMENT '1 = active (accessible), 0 = revoked by admin (returns 404 on portal)',

  ADD UNIQUE INDEX `idx_portal_token` (`portal_token`)
    COMMENT 'Globally unique token lookup — no business_id needed (tokens are universally unique)';

-- Verify the migration applied correctly
SELECT 
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT,
  COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'clients'
  AND COLUMN_NAME IN ('portal_token', 'portal_token_active')
ORDER BY COLUMN_NAME;
