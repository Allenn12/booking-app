import db from '../config/database.js';

async function migrate() {
  const steps = [
    // 1. ALTER notification_logs
    `ALTER TABLE notification_logs 
     ADD COLUMN source ENUM('transactional','campaign','automation') NOT NULL DEFAULT 'transactional',
     ADD COLUMN source_id INT UNSIGNED NULL,
     MODIFY appointment_id INT NULL,
     MODIFY user_id INT NULL`,
    
    // 2. ALTER clients
    `ALTER TABLE clients 
     ADD COLUMN birth_date DATE NULL,
     ADD COLUMN marketing_opt_out TINYINT(1) NOT NULL DEFAULT 0`,

    // 3. CREATE segments
    `CREATE TABLE IF NOT EXISTS segments (
      id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      business_id     INT NOT NULL,
      name            VARCHAR(120) NOT NULL,
      description     TEXT NULL,
      type            ENUM('all_clients','lapsed','new_clients','frequent','upcoming','custom') NOT NULL DEFAULT 'custom',
      rules           JSON NULL,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_seg_business (business_id),
      CONSTRAINT fk_seg_business FOREIGN KEY (business_id) REFERENCES business(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,

    // 4. CREATE campaigns
    `CREATE TABLE IF NOT EXISTS campaigns (
      id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      business_id           INT NOT NULL,
      name                  VARCHAR(160) NOT NULL,
      channel               ENUM('sms') NOT NULL DEFAULT 'sms',
      segment_id            INT UNSIGNED NULL,
      template_id           INT NULL,
      inline_message        TEXT NULL,
      status                ENUM('draft','scheduled','running','completed','cancelled','failed') NOT NULL DEFAULT 'draft',
      scheduled_at          DATETIME NULL,
      started_at            DATETIME NULL,
      completed_at          DATETIME NULL,
      total_recipients      INT UNSIGNED DEFAULT 0,
      sent_count            INT UNSIGNED DEFAULT 0,
      failed_count          INT UNSIGNED DEFAULT 0,
      created_by_user_id    INT NULL,
      created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_camp_business_status (business_id, status),
      INDEX idx_camp_scheduled (scheduled_at),
      CONSTRAINT fk_camp_business FOREIGN KEY (business_id) REFERENCES business(id) ON DELETE CASCADE,
      CONSTRAINT fk_camp_segment  FOREIGN KEY (segment_id)  REFERENCES segments(id) ON DELETE SET NULL,
      CONSTRAINT fk_camp_template FOREIGN KEY (template_id) REFERENCES message_templates(id) ON DELETE SET NULL,
      CONSTRAINT fk_camp_creator  FOREIGN KEY (created_by_user_id) REFERENCES user(id) ON DELETE SET NULL
    ) ENGINE=InnoDB`,

    // 5. CREATE campaign_recipients
    `CREATE TABLE IF NOT EXISTS campaign_recipients (
      id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      campaign_id     INT UNSIGNED NOT NULL,
      client_id       INT NOT NULL,
      status          ENUM('pending','sent','failed','skipped') NOT NULL DEFAULT 'pending',
      sent_at         DATETIME NULL,
      error_message   VARCHAR(500) NULL,
      notif_log_id    INT NULL,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      UNIQUE KEY uq_camp_client (campaign_id, client_id),
      INDEX idx_cr_campaign_status (campaign_id, status),
      INDEX idx_cr_client (client_id),
      CONSTRAINT fk_cr_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      CONSTRAINT fk_cr_client   FOREIGN KEY (client_id)   REFERENCES clients(id) ON DELETE CASCADE,
      CONSTRAINT fk_cr_notif    FOREIGN KEY (notif_log_id) REFERENCES notification_logs(id) ON DELETE SET NULL
    ) ENGINE=InnoDB`,

    // 6. CREATE automations
    `CREATE TABLE IF NOT EXISTS automations (
      id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      business_id           INT NOT NULL,
      name                  VARCHAR(160) NOT NULL,
      type                  ENUM('lapsed_clients','post_visit','birthday') NOT NULL,
      status                ENUM('enabled','disabled') NOT NULL DEFAULT 'disabled',
      channel               ENUM('sms') NOT NULL DEFAULT 'sms',
      template_id           INT NULL,
      inline_message        TEXT NULL,
      segment_id            INT UNSIGNED NULL,
      config                JSON NOT NULL,
      last_run_at           DATETIME NULL,
      created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_auto_business_status (business_id, status),
      CONSTRAINT fk_auto_business FOREIGN KEY (business_id) REFERENCES business(id) ON DELETE CASCADE,
      CONSTRAINT fk_auto_segment  FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE SET NULL,
      CONSTRAINT fk_auto_template FOREIGN KEY (template_id) REFERENCES message_templates(id) ON DELETE SET NULL
    ) ENGINE=InnoDB`,

    // 7. CREATE automation_logs
    `CREATE TABLE IF NOT EXISTS automation_logs (
      id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      automation_id   INT UNSIGNED NOT NULL,
      client_id       INT NOT NULL,
      appointment_id  INT NULL,
      sent_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      notif_log_id    INT NULL,

      UNIQUE KEY uq_auto_client_appt (automation_id, client_id, appointment_id),
      INDEX idx_al_automation (automation_id),
      INDEX idx_al_client (client_id),
      INDEX idx_al_sent_at (sent_at),
      CONSTRAINT fk_al_automation FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE,
      CONSTRAINT fk_al_client     FOREIGN KEY (client_id)     REFERENCES clients(id) ON DELETE CASCADE,
      CONSTRAINT fk_al_appt       FOREIGN KEY (appointment_id) REFERENCES appointment(id) ON DELETE CASCADE,
      CONSTRAINT fk_al_notif      FOREIGN KEY (notif_log_id)   REFERENCES notification_logs(id) ON DELETE SET NULL
    ) ENGINE=InnoDB`
  ];

  for (const sql of steps) {
    try {
      await db.query(sql);
      console.log('Success:', sql.substring(0, 50) + '...');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('Skipping duplicate column:', err.message);
      } else if (err.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log('Table exists:', err.message);
      } else {
        console.error('Error executing query:', sql.substring(0, 50) + '...', err);
        throw err;
      }
    }
  }
  process.exit(0);
}

migrate();
