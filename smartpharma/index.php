<?php

/**
 * SmartPharma.ug — Entry Point (/smartpharma)
 * Supports central landing (/smartpharma) and direct pharmacy portals (/smartpharma/{pharmacy-name}/login)
 */

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

$appRoot = dirname(__DIR__) . '/ax-systems/SmartPharma';
$publicRoot = $appRoot . '/public';

$scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/smartpharma/index.php')), '/');
$requestPath = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
$relPath = ltrim(substr($requestPath, strlen($scriptDir)), '/');

require_once dirname(__DIR__) . '/pwa-helper.php';
axHandlePwaRequest([
    'systemSlug'       => 'smartpharma',
    'systemName'       => 'SmartPharma.ug ERP',
    'shortName'        => 'SmartPharma',
    'description'      => 'Pharmacy & Medical Store Point of Sale, Batch Expiry Tracking & Inventory ERP',
    'themeColor'       => '#045d36',
    'backgroundColor'  => '#071f15',
    'iconFile'         => dirname(__DIR__) . '/SmartPharma.ug Healthcare Logo.png',
    'scriptDir'        => $scriptDir,
    'relPath'          => $relPath,
    'reservedSegments' => ['portal', 'login', 'register', 'dashboard', 'pos', 'api', 'assets', 'uploads', 'index.php'],
]);

// 1. Serve static files from SmartPharma's public/ or root assets/uploads folders
if ($relPath !== '' && $relPath !== 'index.php') {
    $candidates = [
        $publicRoot . '/' . $relPath,
        $appRoot . '/' . $relPath,
    ];
    foreach ($candidates as $candidateFile) {
        if (is_file($candidateFile) && strtolower(pathinfo($candidateFile, PATHINFO_EXTENSION)) !== 'php') {
            $ext = strtolower(pathinfo($candidateFile, PATHINFO_EXTENSION));
            $mimeMap = [
                'css'   => 'text/css',
                'js'    => 'application/javascript',
                'json'  => 'application/json',
                'png'   => 'image/png',
                'jpg'   => 'image/jpeg',
                'jpeg'  => 'image/jpeg',
                'gif'   => 'image/gif',
                'svg'   => 'image/svg+xml',
                'webp'  => 'image/webp',
                'ico'   => 'image/x-icon',
                'woff'  => 'font/woff',
                'woff2' => 'font/woff2',
                'ttf'   => 'font/ttf',
                'pdf'   => 'application/pdf',
            ];
            if (isset($mimeMap[$ext])) {
                header('Content-Type: ' . $mimeMap[$ext]);
            }
            header('Content-Length: ' . filesize($candidateFile));
            readfile($candidateFile);
            exit;
        }
    }
}

// 2. Configure Asset URL & Isolated Session Cookie
$_ENV['ASSET_URL'] = $scriptDir;
$_SERVER['ASSET_URL'] = $scriptDir;
putenv("ASSET_URL={$scriptDir}");

$_ENV['SESSION_COOKIE'] = 'smartpharma_session';
$_SERVER['SESSION_COOKIE'] = 'smartpharma_session';
putenv('SESSION_COOKIE=smartpharma_session');

if (file_exists($maintenance = $appRoot . '/storage/framework/maintenance.php')) {
    require $maintenance;
}

require $appRoot . '/vendor/autoload.php';

/** @var Application $app */
$app = require_once $appRoot . '/bootstrap/app.php';

ob_start(function (string $buffer) use ($scriptDir): string {
    if (stripos($buffer, '</head>') !== false || stripos($buffer, '</body>') !== false) {
        return axInjectPwaTags($buffer, $scriptDir, '#0d9488', 'SmartPharma');
    }
    return $buffer;
});

$app->handleRequest(Request::capture());


