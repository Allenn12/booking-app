/**
 * Migration runner for the employee scheduling tables.
 * Run: node backend/migrate_scheduling.mjs
 */
import pool from './config/database.js';

const TABLES = [
    {
        name: 'employee_schedules',
        sql: `
        CREATE TABLE IF NOT EXISTS employee_schedules (
            id             INT          NOT NULL AUTO_INCREMENT,
            business_id    INT          NOT NULL COMMENT 'Scopes schedule to a specific business',
            user_id        INT          NOT NULL COMMENT 'The employee this schedule belongs to',
            day_of_week    TINYINT      NOT NULL COMMENT '1=Monday 2=Tuesday ... 7=Sunday (ISO)',
            start_time     TIME         DEFAULT NULL COMMENT 'Shift start, NULL when is_day_off=1',
            end_time       TIME         DEFAULT NULL COMMENT 'Shift end, NULL when is_day_off=1',
            is_day_off     TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '1 = employee does not work this day of week',
            effective_from DATE         DEFAULT NULL COMMENT 'NULL = applies from the beginning of time',
            effective_to   DATE         DEFAULT NULL COMMENT 'NULL = no expiry',
            created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_lookup   (business_id, user_id, day_of_week, effective_from),
            KEY idx_employee (business_id, user_id),
            CONSTRAINT fk_es_business FOREIGN KEY (business_id) REFERENCES business(id) ON DELETE CASCADE,
            CONSTRAINT fk_es_user     FOREIGN KEY (user_id)     REFERENCES user(id)     ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          COMMENT='Recurring weekly schedule per employee. Versioned via effective_from/effective_to.'
        `
    },
    {
        name: 'employee_breaks',
        sql: `
        CREATE TABLE IF NOT EXISTS employee_breaks (
            id          INT          NOT NULL AUTO_INCREMENT,
            schedule_id INT          NOT NULL COMMENT 'The recurring schedule row this break belongs to',
            start_time  TIME         NOT NULL,
            end_time    TIME         NOT NULL,
            label       VARCHAR(50)  DEFAULT NULL COMMENT 'Optional: Lunch, Coffee, etc.',
            PRIMARY KEY (id),
            KEY idx_schedule (schedule_id),
            CONSTRAINT fk_eb_schedule FOREIGN KEY (schedule_id) REFERENCES employee_schedules(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          COMMENT='Break windows for a recurring schedule row. Multiple breaks per day supported.'
        `
    },
    {
        name: 'employee_schedule_exceptions',
        sql: `
        CREATE TABLE IF NOT EXISTS employee_schedule_exceptions (
            id             INT          NOT NULL AUTO_INCREMENT,
            business_id    INT          NOT NULL,
            user_id        INT          NOT NULL,
            exception_date DATE         NOT NULL COMMENT 'The specific calendar date this override applies to',
            is_day_off     TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '1 = completely off on this date',
            start_time     TIME         DEFAULT NULL COMMENT 'Override start. NULL when is_day_off=1',
            end_time       TIME         DEFAULT NULL COMMENT 'Override end. NULL when is_day_off=1',
            reason         VARCHAR(255) DEFAULT NULL,
            created_by     INT          DEFAULT NULL COMMENT 'Admin user who created this exception',
            created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_exception     (business_id, user_id, exception_date),
            KEY idx_exception_lookup    (business_id, user_id, exception_date),
            KEY idx_exception_range     (business_id, exception_date),
            CONSTRAINT fk_ese_business   FOREIGN KEY (business_id) REFERENCES business(id) ON DELETE CASCADE,
            CONSTRAINT fk_ese_user       FOREIGN KEY (user_id)     REFERENCES user(id)     ON DELETE CASCADE,
            CONSTRAINT fk_ese_created_by FOREIGN KEY (created_by)  REFERENCES user(id)     ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          COMMENT='Single-date overrides. Completely replaces recurring schedule for that date.'
        `
    },
    {
        name: 'exception_breaks',
        sql: `
        CREATE TABLE IF NOT EXISTS exception_breaks (
            id           INT         NOT NULL AUTO_INCREMENT,
            exception_id INT         NOT NULL COMMENT 'References employee_schedule_exceptions.id',
            start_time   TIME        NOT NULL,
            end_time     TIME        NOT NULL,
            label        VARCHAR(50) DEFAULT NULL,
            PRIMARY KEY (id),
            KEY idx_exception (exception_id),
            CONSTRAINT fk_exb_exception FOREIGN KEY (exception_id) REFERENCES employee_schedule_exceptions(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          COMMENT='Break windows for a single-date exception.'
        `
    },
    {
        name: 'employee_time_off',
        sql: `
        CREATE TABLE IF NOT EXISTS employee_time_off (
            id          INT          NOT NULL AUTO_INCREMENT,
            business_id INT          NOT NULL,
            user_id     INT          NOT NULL,
            start_date  DATE         NOT NULL COMMENT 'First day of leave (inclusive)',
            end_date    DATE         NOT NULL COMMENT 'Last day of leave (inclusive)',
            type        ENUM('vacation','sick_leave','personal','other') NOT NULL DEFAULT 'vacation',
            status      ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'approved'
                        COMMENT 'approved = blocks availability immediately',
            note        VARCHAR(500) DEFAULT NULL,
            approved_by INT          DEFAULT NULL,
            created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_user_dates     (business_id, user_id, start_date, end_date),
            KEY idx_business_range (business_id, start_date, end_date),
            CONSTRAINT fk_eto_business    FOREIGN KEY (business_id) REFERENCES business(id) ON DELETE CASCADE,
            CONSTRAINT fk_eto_user        FOREIGN KEY (user_id)     REFERENCES user(id)     ON DELETE CASCADE,
            CONSTRAINT fk_eto_approved_by FOREIGN KEY (approved_by) REFERENCES user(id)     ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          COMMENT='Multi-day leave records. status=approved blocks all availability for the date range.'
        `
    }
];

async function migrate() {
    console.log('\n🚀 Employee Scheduling Migration\n');
    let allOk = true;

    for (const table of TABLES) {
        try {
            await pool.query(table.sql);
            console.log(`  ✅ ${table.name}`);
        } catch (err) {
            console.error(`  ❌ ${table.name}: ${err.message}`);
            allOk = false;
        }
    }

    console.log(allOk ? '\n✅ Migration complete.\n' : '\n❌ Migration completed with errors.\n');
    await pool.end();
    process.exit(allOk ? 0 : 1);
}

migrate();
