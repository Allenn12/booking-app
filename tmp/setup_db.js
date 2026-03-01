import pool from './backend/config/database.js';

const createTableSql = `
CREATE TABLE IF NOT EXISTS invitations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    business_id INT NOT NULL,
    token VARCHAR(64) UNIQUE NOT NULL,
    code VARCHAR(10) UNIQUE,
    role VARCHAR(20) DEFAULT 'employee',
    created_by INT NOT NULL,
    expires_at TIMESTAMP NULL,
    max_uses INT NULL,
    used_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES business(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES user(id)
);
`;

async function main() {
    try {
        console.log('⏳ Creating invitations table...');
        await pool.query(createTableSql);
        console.log('✅ Table invitations created successfully!');
    } catch (error) {
        console.error('❌ Error creating table:', error);
    } finally {
        await pool.end();
    }
}

main();
