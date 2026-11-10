<?php

namespace TradeDeskMobile;

use PDO;
use PDOException;

class Database
{
    private static ?PDO $pdo = null;

    public static function getConnection(array $dbConfig): PDO
    {
        if (self::$pdo !== null) {
            return self::$pdo;
        }

        $host = $dbConfig['host'] ?? 'localhost';
        $port = $dbConfig['port'] ?? '3306';
        $dbname = $dbConfig['database'] ?? 'axtechno_tradedesk-mobile';
        $user = $dbConfig['username'] ?? 'axtechno_admin';
        $pass = $dbConfig['password'] ?? '';
        $charset = $dbConfig['charset'] ?? 'utf8mb4';

        $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset={$charset}";
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];

        self::$pdo = new PDO($dsn, $user, $pass, $options);
        self::ensureSchema(self::$pdo);
        return self::$pdo;
    }

    /**
     * Automatically ensures all 5 standalone tables exist in `axtechno_tradedesk-mobile`
     */
    private static function ensureSchema(PDO $pdo): void
    {
        $tables = [
            "CREATE TABLE IF NOT EXISTS `mobile_businesses` (
                `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                `name` VARCHAR(150) NOT NULL,
                `subdomain` VARCHAR(60) NOT NULL,
                `category` VARCHAR(80) NOT NULL DEFAULT 'Retail Shop',
                `location` VARCHAR(200) NOT NULL DEFAULT 'Kampala, Uganda',
                `phone` VARCHAR(40) DEFAULT NULL,
                `currency` VARCHAR(10) NOT NULL DEFAULT 'UGX',
                `tin_number` VARCHAR(50) DEFAULT NULL,
                `logo_url` TEXT DEFAULT NULL,
                `plan` VARCHAR(30) NOT NULL DEFAULT 'free_trial',
                `trial_ends_at` DATETIME DEFAULT NULL,
                `subscription_expires_at` DATETIME DEFAULT NULL,
                `wallet_balance` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                `status` VARCHAR(20) NOT NULL DEFAULT 'active',
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                UNIQUE KEY `idx_mobile_businesses_subdomain` (`subdomain`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

            "CREATE TABLE IF NOT EXISTS `mobile_users` (
                `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                `business_id` BIGINT UNSIGNED NOT NULL,
                `name` VARCHAR(120) NOT NULL,
                `email` VARCHAR(150) NOT NULL,
                `phone` VARCHAR(40) DEFAULT NULL,
                `password` VARCHAR(255) NOT NULL,
                `firebase_uid` VARCHAR(128) DEFAULT NULL,
                `auth_provider` VARCHAR(20) NOT NULL DEFAULT 'email',
                `role` VARCHAR(30) NOT NULL DEFAULT 'owner',
                `two_factor_enabled` TINYINT(1) NOT NULL DEFAULT 0,
                `is_verified` TINYINT(1) NOT NULL DEFAULT 1,
                `api_token` VARCHAR(128) DEFAULT NULL,
                `status` VARCHAR(20) NOT NULL DEFAULT 'Active',
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                UNIQUE KEY `idx_mobile_users_email` (`email`),
                KEY `idx_mobile_users_business` (`business_id`),
                KEY `idx_mobile_users_token` (`api_token`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

            "CREATE TABLE IF NOT EXISTS `mobile_email_otps` (
                `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                `email` VARCHAR(150) NOT NULL,
                `otp` VARCHAR(10) NOT NULL,
                `expires_at` DATETIME NOT NULL,
                `is_used` TINYINT(1) NOT NULL DEFAULT 0,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                KEY `idx_mobile_email_otps_lookup` (`email`, `otp`, `is_used`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

            "CREATE TABLE IF NOT EXISTS `mobile_momo_transactions` (
                `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                `business_id` BIGINT UNSIGNED NOT NULL,
                `internal_reference` VARCHAR(100) NOT NULL,
                `customer_reference` VARCHAR(100) DEFAULT NULL,
                `gateway_reference` VARCHAR(100) DEFAULT NULL,
                `type` VARCHAR(40) NOT NULL DEFAULT 'collection',
                `provider` VARCHAR(30) NOT NULL DEFAULT 'MOMO',
                `phone_number` VARCHAR(40) DEFAULT NULL,
                `account_name` VARCHAR(150) DEFAULT NULL,
                `amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                `charge` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                `status` VARCHAR(30) NOT NULL DEFAULT 'pending',
                `credited` TINYINT(1) NOT NULL DEFAULT 0,
                `description` VARCHAR(255) DEFAULT NULL,
                `raw_response` LONGTEXT DEFAULT NULL,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                KEY `idx_mobile_momo_business` (`business_id`),
                KEY `idx_mobile_momo_internal_ref` (`internal_reference`),
                KEY `idx_mobile_momo_customer_ref` (`customer_reference`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

            "CREATE TABLE IF NOT EXISTS `mobile_cloud_backups` (
                `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                `business_id` BIGINT UNSIGNED NOT NULL,
                `user_id` BIGINT UNSIGNED NOT NULL,
                `device_name` VARCHAR(120) DEFAULT 'Android Phone',
                `app_version` VARCHAR(30) DEFAULT '1.0.0',
                `snapshot_json` LONGTEXT NOT NULL,
                `stats_summary` TEXT DEFAULT NULL,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                KEY `idx_mobile_backups_business` (`business_id`, `created_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        ];

        foreach ($tables as $sql) {
            $pdo->exec($sql);
        }
        $cols = $pdo->query("SHOW COLUMNS FROM `mobile_users` LIKE 'firebase_uid'")->fetchAll();
        if (empty($cols)) {
            try {
                $pdo->exec("ALTER TABLE `mobile_users` ADD COLUMN `firebase_uid` VARCHAR(128) DEFAULT NULL");
            } catch (\Throwable $e) {}
        }
        $cols2 = $pdo->query("SHOW COLUMNS FROM `mobile_users` LIKE 'auth_provider'")->fetchAll();
        if (empty($cols2)) {
            try {
                $pdo->exec("ALTER TABLE `mobile_users` ADD COLUMN `auth_provider` VARCHAR(20) NOT NULL DEFAULT 'email'");
            } catch (\Throwable $e) {}
        }
    }
}
