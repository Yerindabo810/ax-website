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

        try {
            self::$pdo = new PDO($dsn, $user, $pass, $options);
        } catch (PDOException $e) {
            // Fallback for local dev if root is used
            if ($user !== 'root') {
                try {
                    self::$pdo = new PDO($dsn, 'root', '', $options);
                } catch (PDOException $inner) {
                    throw $e;
                }
            } else {
                throw $e;
            }
        }

        self::ensureSchema(self::$pdo);
        return self::$pdo;
    }

    /**
     * Automatically ensures all 5 standalone tables exist in `axtechno_tradedesk-mobile`
     */
    private static function ensureSchema(PDO $pdo): void
    {
        $markerFile = dirname(__DIR__) . '/storage/.schema_initialized_v1';
        if (is_file($markerFile)) {
            return;
        }

        $schemaFile = dirname(__DIR__) . '/database/schema.sql';
        if (!is_file($schemaFile)) {
            return;
        }

        $sql = file_get_contents($schemaFile);
        if (!$sql) {
            return;
        }

        $statements = array_filter(array_map('trim', explode(';', $sql)));
        foreach ($statements as $stmt) {
            if ($stmt !== '' && !str_starts_with($stmt, '--')) {
                $pdo->exec($stmt);
            }
        }

        $storageDir = dirname(__DIR__) . '/storage';
        if (!is_dir($storageDir)) {
            @mkdir($storageDir, 0775, true);
        }
        @file_put_contents($markerFile, date('c'));
    }
}

