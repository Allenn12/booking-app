import pool from '../config/database.js';

async function fixDuplicates() {
  try {
    // Find all duplicate (business_id, phone) combos
    const [dupes] = await pool.query(`
      SELECT business_id, phone, COUNT(*) as cnt, GROUP_CONCAT(id ORDER BY id) as ids
      FROM clients
      GROUP BY business_id, phone
      HAVING COUNT(*) > 1
    `);

    if (dupes.length === 0) {
      console.log('✅ No duplicates found.');
    } else {
      console.log(`Found ${dupes.length} duplicate groups:`);
      for (const d of dupes) {
        console.log(`  business_id=${d.business_id}, phone="${d.phone}", ids=[${d.ids}]`);
        // Keep the LOWEST id (oldest), delete the rest
        const idArray = d.ids.split(',').map(Number);
        const keepId = idArray[0];
        const deleteIds = idArray.slice(1);

        // Re-point any appointments referencing deleted client ids to the kept one
        for (const delId of deleteIds) {
          const [upd] = await pool.query(
            'UPDATE appointment SET client_id = ? WHERE client_id = ?',
            [keepId, delId]
          );
          if (upd.affectedRows > 0) {
            console.log(`    Moved ${upd.affectedRows} appointments from client ${delId} → ${keepId}`);
          }
          await pool.query('DELETE FROM clients WHERE id = ?', [delId]);
          console.log(`    Deleted duplicate client id=${delId}`);
        }
      }
    }

    // Now add the UNIQUE constraint
    const [indexes] = await pool.query('SHOW INDEX FROM clients WHERE Key_name = ?', ['idx_business_phone']);
    if (indexes.length > 0) {
      await pool.query('ALTER TABLE clients DROP INDEX idx_business_phone');
    }
    await pool.query('ALTER TABLE clients ADD UNIQUE INDEX idx_business_phone (business_id, phone)');
    console.log('✅ UNIQUE constraint on clients(business_id, phone) applied successfully!');
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
  process.exit(0);
}

fixDuplicates();
