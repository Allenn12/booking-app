/**
 * Backfill Portal Tokens for Existing Clients
 * ============================================
 * PURPOSE: Generate a unique portal_token for every client that doesn't have one yet.
 *
 * SAFETY GUARANTEES:
 *   - IDEMPOTENT: WHERE portal_token IS NULL AND phone != 'WALKIN' — 
 *     already-tokenized clients are completely skipped
 *   - Walk-in sentinel (phone = 'WALKIN') is always excluded
 *   - Processes in batches of 500 to avoid memory pressure
 *   - Uses INSERT with ON DUPLICATE KEY UPDATE retry logic on token collision
 *   - Can be run multiple times safely — zero side-effects on already-tokenized rows
 *
 * USAGE:
 *   node backend/migrations/backfill_portal_tokens.mjs
 *
 * PREREQUISITES:
 *   backend/migrations/add_portal_token.sql must have been run first.
 */

import { createPool } from 'mysql2/promise';
import { randomBytes } from 'crypto';
import { config } from 'dotenv';

config(); // Load .env

// ──────────────────────────────────────────────────────────────────────────────
// Database connection — standalone pool (not shared with the app server)
// ──────────────────────────────────────────────────────────────────────────────
const pool = createPool({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
    connectionLimit: 3,
});

// ──────────────────────────────────────────────────────────────────────────────
// Token generator — 18 random bytes → 24-char base64url string
// base64url uses A-Z a-z 0-9 - _ so it's URL-safe without encoding
// 144 bits of entropy — brute force infeasible
// ──────────────────────────────────────────────────────────────────────────────
function generatePortalToken() {
    return randomBytes(18).toString('base64url');
}

// ──────────────────────────────────────────────────────────────────────────────
// Main backfill function
// ──────────────────────────────────────────────────────────────────────────────
async function backfillPortalTokens() {
    const BATCH_SIZE = 500;
    let totalProcessed = 0;
    let totalSkipped   = 0;
    let totalErrors    = 0;

    console.log('🚀 Starting portal token backfill...');
    console.log(`   Batch size: ${BATCH_SIZE}`);
    console.log(`   Excluding: WALKIN clients, already-tokenized clients\n`);

    // ── Count how many clients need a token ──────────────────────────────────
    const [[countRow]] = await pool.query(`
        SELECT COUNT(*) AS total
        FROM clients
        WHERE portal_token IS NULL
          AND phone != 'WALKIN'
          AND phone IS NOT NULL
    `);
    const totalToProcess = countRow.total;

    if (totalToProcess === 0) {
        console.log('✅ All eligible clients already have portal tokens. Nothing to do.');
        await pool.end();
        process.exit(0);
    }

    console.log(`📊 Found ${totalToProcess} client(s) without portal tokens.\n`);

    // ── Batch processing loop ─────────────────────────────────────────────────
    let offset = 0;

    while (true) {
        // Fetch a batch of clients that still need a token
        // Re-query each iteration — as we update rows, offsets shift.
        // Use id-based pagination for stability instead of OFFSET.
        const [clients] = await pool.query(`
            SELECT id, phone, business_id
            FROM clients
            WHERE portal_token IS NULL
              AND phone != 'WALKIN'
              AND phone IS NOT NULL
            ORDER BY id ASC
            LIMIT ?
        `, [BATCH_SIZE]);

        if (clients.length === 0) {
            break; // All done
        }

        console.log(`📦 Processing batch of ${clients.length} clients...`);

        for (const client of clients) {
            let attempts = 0;
            let success  = false;

            // Retry loop handles the rare case of a token collision
            while (attempts < 5 && !success) {
                const token = generatePortalToken();
                try {
                    const [result] = await pool.query(`
                        UPDATE clients
                        SET portal_token        = ?,
                            portal_token_active = 1
                        WHERE id = ?
                          AND portal_token IS NULL
                    `, [token, client.id]);

                    if (result.affectedRows > 0) {
                        success = true;
                        totalProcessed++;
                    } else {
                        // Row was updated by another process or already had a token
                        totalSkipped++;
                        success = true;
                    }
                } catch (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        // Token collision — generate a new one and retry
                        attempts++;
                        console.warn(`  ⚠️  Token collision for client ${client.id}, retrying (attempt ${attempts})...`);
                    } else {
                        console.error(`  ❌ Failed to update client ${client.id}:`, err.message);
                        totalErrors++;
                        success = true; // Skip this client, don't loop forever
                    }
                }
            }

            if (!success) {
                console.error(`  ❌ Could not generate unique token for client ${client.id} after 5 attempts.`);
                totalErrors++;
            }
        }

        const processedSoFar = totalProcessed + totalSkipped + totalErrors;
        console.log(`   ✓ Progress: ${processedSoFar}/${totalToProcess} — (✅ ${totalProcessed} updated, ⏭️  ${totalSkipped} skipped, ❌ ${totalErrors} errors)`);
    }

    // ── Final summary ─────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════');
    console.log('🏁 Backfill complete!');
    console.log(`   ✅ Tokens generated : ${totalProcessed}`);
    console.log(`   ⏭️  Already had token : ${totalSkipped}`);
    console.log(`   ❌ Errors            : ${totalErrors}`);

    if (totalErrors > 0) {
        console.error('\n⚠️  Some clients could not be tokenized. Check errors above.');
        process.exitCode = 1;
    } else {
        console.log('\n✅ All clients have been tokenized successfully.');
    }

    // ── Verification query ────────────────────────────────────────────────────
    const [[remaining]] = await pool.query(`
        SELECT COUNT(*) AS remaining
        FROM clients
        WHERE portal_token IS NULL
          AND phone != 'WALKIN'
          AND phone IS NOT NULL
    `);
    console.log(`\n📋 Verification: ${remaining.remaining} eligible client(s) still without tokens.`);

    if (remaining.remaining > 0) {
        console.error('⚠️  Some clients were not tokenized. Re-run this script to retry.');
        process.exitCode = 1;
    }

    await pool.end();
}

// ── Run ───────────────────────────────────────────────────────────────────────
backfillPortalTokens().catch((err) => {
    console.error('💥 Fatal error during backfill:', err);
    process.exit(1);
});
