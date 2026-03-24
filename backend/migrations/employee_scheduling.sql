-- =============================================================================
-- Migration: Employee Scheduling Infrastructure
-- Tables: employee_schedules, employee_breaks, employee_schedule_exceptions,
--         employee_time_off
-- Run order: Execute this entire file in one shot against your MySQL database.
-- Rollback: See ROLLBACK section at the bottom of this file.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. employee_schedules — Recurring weekly schedule per employee per business
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `employee_schedules` (
  `id`             INT          NOT NULL AUTO_INCREMENT,
  `business_id`    INT          NOT NULL COMMENT 'Scopes schedule to a specific business',
  `user_id`        INT          NOT NULL COMMENT 'The employee this schedule belongs to',
  `day_of_week`    TINYINT      NOT NULL COMMENT '1=Monday, 2=Tuesday, ... 7=Sunday (ISO)',
  `start_time`     TIME         NOT NULL COMMENT 'Shift start time in business local time',
  `end_time`       TIME         NOT NULL COMMENT 'Shift end time in business local time',
  `is_day_off`     TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '1 = employee does not work this day of week',
  `effective_from` DATE         DEFAULT NULL COMMENT 'NULL = applies from the beginning of time',
  `effective_to`   DATE         DEFAULT NULL COMMENT 'NULL = no expiry (open-ended)',
  `created_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  -- Lookup: "what is employee X's schedule on day Y as of date Z?"
  KEY `idx_lookup` (`business_id`, `user_id`, `day_of_week`, `effective_from`),

  -- Lookup: fetch all schedule rows for one employee in one business
  KEY `idx_employee` (`business_id`, `user_id`),

  CONSTRAINT `fk_es_business` FOREIGN KEY (`business_id`) REFERENCES `business`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_es_user`     FOREIGN KEY (`user_id`)     REFERENCES `user`(`id`)     ON DELETE CASCADE,

  CONSTRAINT `chk_es_day`   CHECK (`day_of_week` BETWEEN 1 AND 7),
  CONSTRAINT `chk_es_times` CHECK (`is_day_off` = 1 OR `start_time` < `end_time`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Recurring weekly schedule per employee. Multiple rows per day allowed for versioning (effective_from/effective_to).';


-- -----------------------------------------------------------------------------
-- 2. employee_breaks — Named break windows attached to a schedule row
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `employee_breaks` (
  `id`          INT        NOT NULL AUTO_INCREMENT,
  `schedule_id` INT        NOT NULL COMMENT 'References the employee_schedules row this break belongs to',
  `start_time`  TIME       NOT NULL COMMENT 'Break start in business local time',
  `end_time`    TIME       NOT NULL COMMENT 'Break end in business local time',
  `label`       VARCHAR(50) DEFAULT NULL COMMENT 'Optional label e.g. "Lunch", "Coffee"',

  PRIMARY KEY (`id`),

  -- Lookup: fetch all breaks for a given schedule row
  KEY `idx_schedule` (`schedule_id`),

  CONSTRAINT `fk_eb_schedule` FOREIGN KEY (`schedule_id`) REFERENCES `employee_schedules`(`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_eb_times`   CHECK (`start_time` < `end_time`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Break windows for a recurring schedule row. Multiple breaks per day supported.';


-- -----------------------------------------------------------------------------
-- 3. employee_schedule_exceptions — Single-date overrides
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `employee_schedule_exceptions` (
  `id`             INT         NOT NULL AUTO_INCREMENT,
  `business_id`    INT         NOT NULL COMMENT 'Scope to business',
  `user_id`        INT         NOT NULL COMMENT 'The employee',
  `exception_date` DATE        NOT NULL COMMENT 'The specific calendar date this exception applies to',
  `is_day_off`     TINYINT(1)  NOT NULL DEFAULT 0 COMMENT '1 = worker is completely off on this date',
  `start_time`     TIME        DEFAULT NULL COMMENT 'Override start time. NULL when is_day_off=1',
  `end_time`       TIME        DEFAULT NULL COMMENT 'Override end time. NULL when is_day_off=1',
  `reason`         VARCHAR(255) DEFAULT NULL COMMENT 'Human-readable reason (shift swap, special event, etc.)',
  `created_by`     INT         DEFAULT NULL COMMENT 'Admin/owner user who created this exception',
  `created_at`     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  -- One exception per employee per date — the unique constraint is the enforcement mechanism
  UNIQUE KEY `uq_exception` (`business_id`, `user_id`, `exception_date`),

  -- Lookup: "does employee X have an exception on date Y?"
  KEY `idx_exception_lookup` (`business_id`, `user_id`, `exception_date`),

  -- Lookup: fetch all exceptions for a business in a date range (admin calendar view)
  KEY `idx_exception_range`  (`business_id`, `exception_date`),

  CONSTRAINT `fk_ese_business`    FOREIGN KEY (`business_id`) REFERENCES `business`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ese_user`        FOREIGN KEY (`user_id`)     REFERENCES `user`(`id`)     ON DELETE CASCADE,
  CONSTRAINT `fk_ese_created_by`  FOREIGN KEY (`created_by`)  REFERENCES `user`(`id`)     ON DELETE SET NULL,

  CONSTRAINT `chk_ese_times` CHECK (
    `is_day_off` = 1
    OR (`start_time` IS NOT NULL AND `end_time` IS NOT NULL AND `start_time` < `end_time`)
  )

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Single-date schedule overrides. When a row exists for a date it completely replaces the recurring schedule for that date.';


-- -----------------------------------------------------------------------------
-- 4. exception_breaks — Breaks attached to a specific exception
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `exception_breaks` (
  `id`           INT        NOT NULL AUTO_INCREMENT,
  `exception_id` INT        NOT NULL COMMENT 'References employee_schedule_exceptions.id',
  `start_time`   TIME       NOT NULL,
  `end_time`     TIME       NOT NULL,
  `label`        VARCHAR(50) DEFAULT NULL,

  PRIMARY KEY (`id`),

  KEY `idx_exception` (`exception_id`),

  CONSTRAINT `fk_exb_exception` FOREIGN KEY (`exception_id`) REFERENCES `employee_schedule_exceptions`(`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_exb_times`    CHECK (`start_time` < `end_time`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Break windows for a single-date exception. Mirrors employee_breaks but scoped to exceptions.';


-- -----------------------------------------------------------------------------
-- 5. employee_time_off — Multi-day leave records
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `employee_time_off` (
  `id`          INT          NOT NULL AUTO_INCREMENT,
  `business_id` INT          NOT NULL COMMENT 'Scope to business',
  `user_id`     INT          NOT NULL COMMENT 'The employee on leave',
  `start_date`  DATE         NOT NULL COMMENT 'First day of leave (inclusive)',
  `end_date`    DATE         NOT NULL COMMENT 'Last day of leave (inclusive)',
  `type`        ENUM('vacation','sick_leave','personal','other') NOT NULL DEFAULT 'vacation',
  `status`      ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'approved'
                COMMENT 'approved = immediately blocks availability',
  `note`        VARCHAR(500) DEFAULT NULL,
  `approved_by` INT          DEFAULT NULL COMMENT 'User who approved this leave',
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  -- Range check: "is employee X on leave on date Y?" Uses range scan on start_date
  KEY `idx_user_dates`     (`business_id`, `user_id`, `start_date`, `end_date`),

  -- Admin calendar: show all leave in a date range for a business
  KEY `idx_business_range` (`business_id`, `start_date`, `end_date`),

  CONSTRAINT `fk_eto_business`     FOREIGN KEY (`business_id`) REFERENCES `business`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_eto_user`         FOREIGN KEY (`user_id`)     REFERENCES `user`(`id`)     ON DELETE CASCADE,
  CONSTRAINT `fk_eto_approved_by`  FOREIGN KEY (`approved_by`) REFERENCES `user`(`id`)     ON DELETE SET NULL,

  CONSTRAINT `chk_eto_dates` CHECK (`start_date` <= `end_date`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Multi-day leave records (vacation, sick, personal). status=approved blocks availability.';


-- =============================================================================
-- ROLLBACK SQL (run in reverse order to undo this migration)
-- =============================================================================
-- DROP TABLE IF EXISTS `exception_breaks`;
-- DROP TABLE IF EXISTS `employee_schedule_exceptions`;
-- DROP TABLE IF EXISTS `employee_breaks`;
-- DROP TABLE IF EXISTS `employee_schedules`;
-- DROP TABLE IF EXISTS `employee_time_off`;
