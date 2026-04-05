/**
 * Run Migration: add_portal_token
 * Applies the portal_token columns to the clients table.
 * Safe to run multiple times — checks if columns already exist first.
 */

import pool from '../config/database.js';

async function runMigration() {
    console.log('🚀 Running migration: add_portal_token...\n');

    try {
        // ── Check if portal_token column already exists ────────────────────
        const [columns] = await pool.query(`
            SELECT COLUMN_NAME
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME   = 'clients'
              AND COLUMN_NAME IN ('portal_token', 'portal_token_active')
        `);

        const existingCols = columns.map(c => c.COLUMN_NAME);
        const needsPortalToken       = !existingCols.includes('portal_token');
        const needsPortalTokenActive = !existingCols.includes('portal_token_active');

        if (!needsPortalToken && !needsPortalTokenActive) {
            console.log('✅ Both columns already exist — migration already applied. Skipping.');
            await pool.end();
            process.exit(0);
        }

        // ── Build ALTER TABLE dynamically based on what's missing ──────────
        const alterParts = [];

        if (needsPortalToken) {
            alterParts.push(`
                ADD COLUMN portal_token VARCHAR(32) DEFAULT NULL
                COMMENT 'Unique magic-link token for customer portal (base64url, 24 chars). NULL for walk-in clients.'
            `);
            console.log('  → Will add column: portal_token');
        } else {
            console.log('  ✓ portal_token already exists, skipping.');
        }

        if (needsPortalTokenActive) {
            alterParts.push(`
                ADD COLUMN portal_token_active TINYINT(1) NOT NULL DEFAULT 1
                COMMENT '1 = active (accessible), 0 = revoked by admin (returns 404 on portal)'
            `);
            console.log('  → Will add column: portal_token_active');
        } else {
            console.log('  ✓ portal_token_active already exists, skipping.');
        }

        // ── Apply column additions ─────────────────────────────────────────
        if (alterParts.length > 0) {
            await pool.query(`ALTER TABLE clients ${alterParts.join(', ')}`);
            console.log('\n  ✅ Columns added successfully.');
        }

        // ── Add UNIQUE INDEX on portal_token if not already there ──────────
        const [indexes] = await pool.query(`
            SELECT INDEX_NAME
            FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME   = 'clients'
              AND INDEX_NAME   = 'idx_portal_token'
        `);

        if (indexes.length === 0) {
            await pool.query(`
                ALTER TABLE clients
                ADD UNIQUE INDEX idx_portal_token (portal_token)
            `);
            console.log('  ✅ UNIQUE INDEX idx_portal_token added.');
        } else {
            console.log('  ✓ UNIQUE INDEX idx_portal_token already exists, skipping.');
        }

        // ── Verify final state ─────────────────────────────────────────────
        const [finalCols] = await pool.query(`
            SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME   = 'clients'
              AND COLUMN_NAME IN ('portal_token', 'portal_token_active')
            ORDER BY COLUMN_NAME
        `);

        console.log('\n📋 Final column state:');
        for (const col of finalCols) {
            console.log(`   ${col.COLUMN_NAME}: ${col.COLUMN_TYPE}, nullable=${col.IS_NULLABLE}, default=${col.COLUMN_DEFAULT}`);
            console.log(`   Comment: ${col.COLUMN_COMMENT}`);
        }

        console.log('\n✅ Migration add_portal_token completed successfully!');

    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        if (err.code) console.error('   Error code:', err.code);
        process.exit(1);
    }

    await pool.end();
    process.exit(0);
}

runMigration();
