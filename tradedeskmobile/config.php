<?php

/**
 * TradeDesk Mobile — Standalone Cloud Backend Configuration
 * Loads all credentials from .env
 */

$envFile = __DIR__ . '/.env';
if (is_file($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (is_array($lines)) {
        foreach ($lines as $line) {
            $trimmed = trim($line);
            if ($trimmed === '' || str_starts_with($trimmed, '#') || !str_contains($trimmed, '=')) {
                continue;
            }
            [$key, $val] = explode('=', $trimmed, 2);
            $key = trim($key);
            $val = trim($val);
            if (
                (str_starts_with($val, '"') && str_ends_with($val, '"')) ||
                (str_starts_with($val, "'") && str_ends_with($val, "'"))
            ) {
                $val = substr($val, 1, -1);
            }
            $_ENV[$key] = $val;
            putenv("{$key}={$val}");
        }
    }
}

$env = static function (string $key, string $default = ''): string {
    if (isset($_ENV[$key])) {
        return (string) $_ENV[$key];
    }
    $val = getenv($key);
    return $val !== false ? (string) $val : $default;
};

return [
    'app' => [
        'name' => $env('APP_NAME', 'TradeDesk Mobile'),
        'version' => $env('APP_VERSION', '1.0.0'),
        'url' => $env('APP_URL', 'https://axtechnologies.net/tradedeskmobile'),
        'timezone' => $env('APP_TIMEZONE', 'Africa/Kampala'),
    ],
    'db' => [
        'host' => $env('DB_HOST', 'localhost'),
        'port' => $env('DB_PORT', '3306'),
        'database' => $env('DB_DATABASE', 'axtechno_tradedesk-mobile'),
        'username' => $env('DB_USERNAME', 'axtechno_admin'),
        'password' => $env('DB_PASSWORD', ''),
        'charset' => 'utf8mb4',
    ],
    'mail' => [
        'host' => $env('MAIL_HOST', 'mail.steadfast.crystalcloudhost.net'),
        'port' => (int) $env('MAIL_PORT', '587'),
        'encryption' => $env('MAIL_ENCRYPTION', 'tls'),
        'username' => $env('MAIL_USERNAME', 'verify@axtechnologies.net'),
        'password' => $env('MAIL_PASSWORD', ''),
        'from_address' => $env('MAIL_FROM_ADDRESS', 'verify@axtechnologies.net'),
        'from_name' => $env('MAIL_FROM_NAME', 'TradeDesk Mobile'),
    ],
    'marzpay' => [
        'base_url' => $env('MARZPAY_BASE_URL', 'https://wallet.wearemarz.com/api/v1'),
        'api_key' => $env('MARZPAY_API_KEY', ''),
        'api_secret' => $env('MARZPAY_API_SECRET', ''),
        'country' => $env('MARZPAY_COUNTRY', 'UG'),
        'callback_url' => $env('MARZPAY_CALLBACK_URL', 'https://axtechnologies.net/tradedeskmobile/api/pos/momo/webhook'),
    ],
];
