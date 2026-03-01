-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: app
-- ------------------------------------------------------
-- Server version	9.5.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
SET @MYSQLDUMP_TEMP_LOG_BIN = @@SESSION.SQL_LOG_BIN;
SET @@SESSION.SQL_LOG_BIN= 0;

--
-- GTID state at the beginning of the backup 
--

SET @@GLOBAL.GTID_PURGED=/*!80000 '+'*/ '20b7b1ab-e662-11f0-968b-0a0027000010:1-2204';

--
-- Table structure for table `appointment`
--

DROP TABLE IF EXISTS `appointment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `appointment` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int DEFAULT NULL COMMENT '⭐ CRITICAL: Which business owns this appointment',
  `client_id` int DEFAULT NULL COMMENT 'References clients.id (instead of duplicate name/phone)',
  `service_id` int DEFAULT NULL COMMENT 'References services.id (which service was booked)',
  `assigned_to_user_id` int DEFAULT NULL COMMENT 'Which employee is doing this appointment',
  `name` varchar(100) DEFAULT NULL,
  `phone` varchar(32) DEFAULT NULL,
  `appointment_datetime` datetime NOT NULL,
  `user_id` int DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `status` enum('scheduled','completed','cancelled','no_show') DEFAULT 'scheduled',
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `fk_appointment_service` (`service_id`),
  KEY `idx_business_date` (`business_id`,`appointment_datetime`) COMMENT 'Get appointments for business on specific date',
  KEY `idx_assigned_user` (`assigned_to_user_id`) COMMENT 'Get appointments for specific employee',
  KEY `idx_client_appointments` (`client_id`) COMMENT 'Get appointment history for client',
  CONSTRAINT `fk_appointment_assigned_user` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_appointment_business` FOREIGN KEY (`business_id`) REFERENCES `business` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_appointment_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_appointment_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `appointment_reminders`
--

DROP TABLE IF EXISTS `appointment_reminders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `appointment_reminders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `appointment_id` int NOT NULL,
  `minutes_before` int NOT NULL,
  `sent` tinyint(1) DEFAULT '0',
  `sent_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sent` (`sent`),
  KEY `idx_appointment` (`appointment_id`),
  CONSTRAINT `appointment_reminders_ibfk_1` FOREIGN KEY (`appointment_id`) REFERENCES `appointment` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `business`
--

DROP TABLE IF EXISTS `business`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `business` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Business name (e.g., "Salon Lucija")',
  `business_type_id` int NOT NULL COMMENT 'References job.id (1=Salon, 2=Barber, etc.)',
  `owner_user_id` int NOT NULL COMMENT 'User who owns this business (for billing)',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Business phone number',
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Business email (can differ from owner email)',
  `address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Street address',
  `city` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'City name',
  `post_code` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Postal code',
  `country_id` int DEFAULT NULL COMMENT 'References country.id',
  `timezone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'Europe/Zagreb' COMMENT 'Timezone for appointment scheduling',
  `sms_credits` int DEFAULT '0' COMMENT 'SMS credits balance (business-level, not user-level)',
  `subscription_status` enum('trial','active','suspended','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'trial',
  `trial_ends_at` datetime DEFAULT NULL COMMENT 'When trial period ends',
  `booking_buffer_minutes` int DEFAULT '0' COMMENT 'Buffer time between appointments (prevent burnout)',
  `is_active` tinyint(1) DEFAULT '1' COMMENT 'Soft delete flag',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `country_id` (`country_id`),
  KEY `business_type_id` (`business_type_id`),
  KEY `idx_owner` (`owner_user_id`),
  KEY `idx_active` (`is_active`),
  KEY `idx_subscription` (`subscription_status`),
  CONSTRAINT `business_ibfk_1` FOREIGN KEY (`owner_user_id`) REFERENCES `user` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `business_ibfk_2` FOREIGN KEY (`country_id`) REFERENCES `country` (`id`) ON DELETE SET NULL,
  CONSTRAINT `business_ibfk_3` FOREIGN KEY (`business_type_id`) REFERENCES `job` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Core business entity - one business per salon/barber/mechanic';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `business_hours`
--

DROP TABLE IF EXISTS `business_hours`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `business_hours` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL COMMENT 'Which business these hours apply to',
  `day_of_week` tinyint NOT NULL COMMENT '0=Sunday, 1=Monday, 2=Tuesday ... 6=Saturday',
  `open_time` time NOT NULL COMMENT 'Opening time (e.g., 09:00:00)',
  `close_time` time NOT NULL COMMENT 'Closing time (e.g., 18:00:00)',
  `is_closed` tinyint(1) DEFAULT '0' COMMENT '1 = Closed on this day (overrides times)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_business_day` (`business_id`,`day_of_week`) COMMENT 'Only one entry per day per business',
  KEY `idx_business_hours` (`business_id`,`day_of_week`),
  CONSTRAINT `business_hours_ibfk_1` FOREIGN KEY (`business_id`) REFERENCES `business` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Business operating hours (for appointment validation)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `business_invitations`
--

DROP TABLE IF EXISTS `business_invitations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `business_invitations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL COMMENT 'Business that is inviting',
  `invited_by_user_id` int NOT NULL COMMENT 'User who sent the invitation (owner/admin)',
  `email` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Email of person being invited',
  `role` enum('admin','employee') COLLATE utf8mb4_unicode_ci DEFAULT 'employee' COMMENT 'Role they will have when they join',
  `token_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Hashed invitation token (sha256)',
  `status` enum('pending','accepted','expired','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `expires_at` datetime NOT NULL COMMENT 'Invitation expires after 7 days',
  `accepted_at` datetime DEFAULT NULL COMMENT 'When invitation was accepted',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_pending_invitation` (`business_id`,`email`,`status`) COMMENT 'Cannot send duplicate pending invitations',
  KEY `invited_by_user_id` (`invited_by_user_id`),
  KEY `idx_token_hash` (`token_hash`),
  KEY `idx_email_status` (`email`,`status`),
  KEY `idx_business_pending` (`business_id`,`status`),
  CONSTRAINT `business_invitations_ibfk_1` FOREIGN KEY (`business_id`) REFERENCES `business` (`id`) ON DELETE CASCADE,
  CONSTRAINT `business_invitations_ibfk_2` FOREIGN KEY (`invited_by_user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Employee invitation system (email-based invites like Slack)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `clients`
--

DROP TABLE IF EXISTS `clients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clients` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL COMMENT '⭐ ISOLATION KEY - which business owns this client',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Client full name',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Phone number (E.164 format: +385912345678) - CRITICAL for SMS',
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Optional email',
  `notes` text COLLATE utf8mb4_unicode_ci COMMENT 'Internal notes (allergies, preferences, etc.)',
  `total_appointments` int DEFAULT '0' COMMENT 'Total appointments booked',
  `last_appointment_at` datetime DEFAULT NULL COMMENT 'Last appointment date',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_business_phone` (`business_id`,`phone`) COMMENT 'Lookup client by phone within business',
  KEY `idx_business_name` (`business_id`,`name`) COMMENT 'Search clients by name',
  KEY `idx_business_stats` (`business_id`,`total_appointments`) COMMENT 'Find VIP clients',
  CONSTRAINT `clients_ibfk_1` FOREIGN KEY (`business_id`) REFERENCES `business` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Clients (customers) who book appointments - isolated per business';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `country`
--

DROP TABLE IF EXISTS `country`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `country` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `flag_path` varchar(255) DEFAULT NULL,
  `langugage` varchar(50) DEFAULT NULL,
  `phone_code` varchar(5) NOT NULL,
  `tax` varchar(5) DEFAULT NULL,
  `country_code` varchar(10) DEFAULT NULL,
  `currency` varchar(5) DEFAULT NULL,
  `exchange_rate` decimal(10,4) DEFAULT NULL,
  `active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `credit_transactions`
--

DROP TABLE IF EXISTS `credit_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `credit_transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `business_id` int DEFAULT NULL COMMENT 'Which business this transaction belongs to',
  `amount` int NOT NULL,
  `transaction_type` enum('purchase','sms_sent','refund','bonus') NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `reference_id` varchar(255) DEFAULT NULL,
  `balance_after` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `idx_business_transactions` (`business_id`,`created_at`) COMMENT 'Transaction history per business',
  CONSTRAINT `credit_transactions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_credit_business` FOREIGN KEY (`business_id`) REFERENCES `business` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `invitations`
--

DROP TABLE IF EXISTS `invitations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invitations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL,
  `token` varchar(64) NOT NULL,
  `code` varchar(10) DEFAULT NULL,
  `role` varchar(20) DEFAULT 'employee',
  `created_by` int NOT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `max_uses` int DEFAULT NULL,
  `used_count` int DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  UNIQUE KEY `code` (`code`),
  KEY `business_id` (`business_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `invitations_ibfk_1` FOREIGN KEY (`business_id`) REFERENCES `business` (`id`) ON DELETE CASCADE,
  CONSTRAINT `invitations_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job`
--

DROP TABLE IF EXISTS `job`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text,
  `default_sms_template` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `message_template`
--

DROP TABLE IF EXISTS `message_template`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `message_template` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `job_id` int NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `template_text` text NOT NULL,
  `variables` text,
  `status` enum('active','pending_approval','rejected') DEFAULT 'active',
  `is_default` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `job_id` (`job_id`),
  CONSTRAINT `message_template_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `message_template_ibfk_2` FOREIGN KEY (`job_id`) REFERENCES `job` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `notification_logs`
--

DROP TABLE IF EXISTS `notification_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int DEFAULT NULL COMMENT 'Which business sent this SMS',
  `appointment_id` int NOT NULL,
  `user_id` int NOT NULL,
  `notification_type` enum('created','reminder','changed','cancelled') NOT NULL,
  `channel` enum('sms') NOT NULL,
  `recipient_phone` varchar(20) NOT NULL,
  `message_text` text NOT NULL,
  `status` enum('pending','sent','failed') DEFAULT 'pending',
  `sent_at` datetime DEFAULT NULL,
  `failed_reason` text,
  `twilio_sid` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `appointment_id` (`appointment_id`),
  KEY `user_id` (`user_id`),
  KEY `idx_business_date` (`business_id`,`created_at`) COMMENT 'SMS logs per business per month',
  CONSTRAINT `fk_notification_business` FOREIGN KEY (`business_id`) REFERENCES `business` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notification_logs_ibfk_1` FOREIGN KEY (`appointment_id`) REFERENCES `appointment` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notification_logs_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `services`
--

DROP TABLE IF EXISTS `services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `services` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL COMMENT '⭐ ISOLATION KEY - which business offers this service',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Service name (e.g., "Muško šišanje")',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT 'Optional service description',
  `duration_minutes` int NOT NULL COMMENT 'How long service takes (for conflict detection)',
  `price` decimal(10,2) DEFAULT NULL COMMENT 'Optional price (some businesses hide prices)',
  `is_active` tinyint(1) DEFAULT '1' COMMENT 'Soft delete (hide without losing appointment history)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_business_active` (`business_id`,`is_active`) COMMENT 'Get active services for dropdown',
  CONSTRAINT `services_ibfk_1` FOREIGN KEY (`business_id`) REFERENCES `business` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Services offered by each business (haircut, massage, car repair, etc.)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `session_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `expires` int unsigned NOT NULL,
  `data` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user` (
  `id` int NOT NULL AUTO_INCREMENT,
  `first_name` varchar(30) COLLATE utf8mb3_unicode_ci NOT NULL,
  `last_name` varchar(40) COLLATE utf8mb3_unicode_ci NOT NULL,
  `business_name` varchar(40) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `business_pin` varchar(15) COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `address` varchar(60) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `post_code` varchar(24) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `city` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `email` varchar(50) COLLATE utf8mb3_unicode_ci NOT NULL,
  `password` varchar(120) COLLATE utf8mb3_unicode_ci NOT NULL,
  `network` int DEFAULT NULL,
  `phone_number` varchar(16) COLLATE utf8mb3_unicode_ci NOT NULL,
  `country_id` int DEFAULT NULL,
  `job_id` int DEFAULT NULL,
  `credits` int DEFAULT '0',
  `active` tinyint DEFAULT '1',
  `level` int DEFAULT NULL,
  `created_at` date NOT NULL DEFAULT (curdate()),
  `date_expire` date DEFAULT NULL,
  `verification_level` enum('email_pending','profile_incomplete','active','suspended') COLLATE utf8mb3_unicode_ci DEFAULT 'email_pending',
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_email` (`email`),
  KEY `idx_level` (`level`)
) ENGINE=InnoDB AUTO_INCREMENT=74 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_business`
--

DROP TABLE IF EXISTS `user_business`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_business` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL COMMENT 'User who belongs to the business',
  `business_id` int NOT NULL COMMENT 'Business that user belongs to',
  `role` enum('owner','admin','employee') COLLATE utf8mb4_unicode_ci DEFAULT 'employee' COMMENT 'User role in this business',
  `can_manage_services` tinyint(1) DEFAULT '0' COMMENT 'Can create/edit/delete services',
  `can_manage_clients` tinyint(1) DEFAULT '0' COMMENT 'Can create/edit/delete clients',
  `can_create_appointments` tinyint(1) DEFAULT '1' COMMENT 'Can book appointments',
  `can_view_reports` tinyint(1) DEFAULT '0' COMMENT 'Can access analytics/reports',
  `invited_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'When invitation was sent',
  `joined_at` timestamp NULL DEFAULT NULL COMMENT 'When user accepted invitation',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_business` (`user_id`,`business_id`) COMMENT 'User cannot be added to same business twice',
  KEY `idx_business_users` (`business_id`,`user_id`),
  KEY `idx_user_businesses` (`user_id`,`business_id`),
  CONSTRAINT `user_business_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_business_ibfk_2` FOREIGN KEY (`business_id`) REFERENCES `business` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Many-to-many relationship: users ↔ businesses (enables team management)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_settings`
--

DROP TABLE IF EXISTS `user_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `notification_on_appointment_created` tinyint(1) DEFAULT '1',
  `default_reminder_count` int DEFAULT '1',
  `reminder1_minutes` int DEFAULT '1440',
  `reminder2_minutes` int DEFAULT '60',
  `language` varchar(5) DEFAULT 'hr',
  `timezone` varchar(50) DEFAULT 'Europe/Zagreb',
  `date_format` varchar(10) DEFAULT 'DD.MM.YYYY',
  `time_format` varchar(10) DEFAULT 'HH:mm',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `user_settings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `verification_codes`
--

DROP TABLE IF EXISTS `verification_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `verification_codes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `code` varchar(255) NOT NULL,
  `code_type` enum('email','phone','password_reset') DEFAULT NULL,
  `is_used` tinyint(1) DEFAULT '0',
  `used_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_code` (`user_id`,`code`),
  CONSTRAINT `verification_codes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `verification_tokens`
--

DROP TABLE IF EXISTS `verification_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `verification_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `email` varchar(50) NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `token_type` enum('email_verification','password_reset') DEFAULT 'email_verification',
  `is_used` tinyint(1) DEFAULT '0',
  `used_at` datetime DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_hash` (`token_hash`),
  UNIQUE KEY `idx_unique_active_token` (`user_id`,`token_type`,((case when (`is_used` = 0) then 0 else NULL end))),
  KEY `idx_email_type` (`email`,`token_type`),
  KEY `idx_expires_used` (`expires_at`,`is_used`),
  KEY `idx_user_invalidate` (`user_id`,`token_type`,`is_used`,`expires_at`),
  CONSTRAINT `verification_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=92 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
SET @@SESSION.SQL_LOG_BIN = @MYSQLDUMP_TEMP_LOG_BIN;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-01 18:56:06
