<?php

/**
 * TradeDesk POS — Unified Entry Point (/tradedeskpos)
 * - Serves React SPA at /tradedeskpos and /tradedeskpos/{business-name}/login
 * - Routes /tradedeskpos/api/* to Laravel Backend (ax-systems/TradeDesk POS/backend)
 */

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

$systemDir = dirname(__DIR__) . '/ax-systems/TradeDesk POS';
$frontendDist = $systemDir . '/frontend/dist';
$backendRoot = $systemDir . '/backend';
$backendPublic = $backendRoot . '/public';

$scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/tradedeskpos/index.php')), '/');
$requestPath = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
$relPath = ltrim(substr($requestPath, strlen($scriptDir)), '/');

$reservedTabs = [
    'auth', 'login', 'signup', 'dashboard', 'overview', 'pos', 'shifts',
    'products', 'inventory', 'transfers', 'customers', 'suppliers',
    'finance', 'branches', 'users', 'reports', 'efris', 'settings', 'profile',
    'assets', 'api', 'index.html', 'index.php'
];

require_once dirname(__DIR__) . '/pwa-helper.php';
axHandlePwaRequest([
    'systemSlug'       => 'tradedeskpos',
    'systemName'       => 'TradeDesk POS',
    'shortName'        => 'TradeDesk POS',
    'description'      => 'Multi-branch Retail, Wholesale & Supermarket Point of Sale System',
    'themeColor'       => '#0b4fb8',
    'backgroundColor'  => '#0b162c',
    'iconFile'         => dirname(__DIR__) . '/TradeDesk logo.png',
    'scriptDir'        => $scriptDir,
    'relPath'          => $relPath,
    'reservedSegments' => $reservedTabs,
]);

$mimeMap = [
    'css'   => 'text/css; charset=utf-8',
    'js'    => 'application/javascript; charset=utf-8',
    'mjs'   => 'application/javascript; charset=utf-8',
    'json'  => 'application/json; charset=utf-8',
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

// 1. Handle Backend API & Storage routes (/tradedeskpos/api/*, /tradedeskpos/storage/*)
if (preg_match('#^(api|sanctum|storage|uploads)(/|$)#i', $relPath)) {
    $staticBackendFile = $backendPublic . '/' . $relPath;
    if (!is_file($staticBackendFile) && str_starts_with(strtolower($relPath), 'storage/')) {
        $staticBackendFile = $backendRoot . '/storage/app/public/' . substr($relPath, 8);
    }
    if (is_file($staticBackendFile) && strtolower(pathinfo($staticBackendFile, PATHINFO_EXTENSION)) !== 'php') {
        $ext = strtolower(pathinfo($staticBackendFile, PATHINFO_EXTENSION));
        if (isset($mimeMap[$ext])) {
            header('Content-Type: ' . $mimeMap[$ext]);
        }
        readfile($staticBackendFile);
        exit;
    }

    define('LARAVEL_START', microtime(true));

    $_ENV['SESSION_COOKIE'] = 'tradedesk_session';
    $_SERVER['SESSION_COOKIE'] = 'tradedesk_session';
    putenv('SESSION_COOKIE=tradedesk_session');

    if (file_exists($maintenance = $backendRoot . '/storage/framework/maintenance.php')) {
        require $maintenance;
    }

    require $backendRoot . '/vendor/autoload.php';

    /** @var Application $app */
    $app = require_once $backendRoot . '/bootstrap/app.php';

    $app->handleRequest(Request::capture());
    exit;
}

// 2. Serve Frontend Static Assets (from frontend/dist)
if ($relPath !== '' && $relPath !== 'index.php' && $relPath !== 'index.html') {
    $candidate = $frontendDist . '/' . $relPath;

    // Support deep-path asset requests like /tradedeskpos/{business}/assets/...
    if (!is_file($candidate) && ($assetsPos = strpos($relPath, 'assets/')) !== false) {
        $candidate = $frontendDist . '/' . substr($relPath, $assetsPos);
    }
    if (!is_file($candidate)) {
        $basename = basename($relPath);
        if (is_file($frontendDist . '/' . $basename)) {
            $candidate = $frontendDist . '/' . $basename;
        }
    }

    if (is_file($candidate) && strtolower(pathinfo($candidate, PATHINFO_EXTENSION)) !== 'php') {
        $ext = strtolower(pathinfo($candidate, PATHINFO_EXTENSION));
        if (isset($mimeMap[$ext])) {
            header('Content-Type: ' . $mimeMap[$ext]);
        }
        readfile($candidate);
        exit;
    }
}

// 3. If user visits /{business-name} (single segment that isn't a dashboard tab), redirect to /{business-name}/login
$segments = $relPath === '' ? [] : explode('/', $relPath);
if (count($segments) === 1 && !in_array(strtolower($segments[0]), $reservedTabs, true)) {
    $prefix = $scriptDir !== '' ? $scriptDir : '';
    header('Location: ' . $prefix . '/' . strtolower($segments[0]) . '/login', true, 302);
    exit;
}

// 4. Serve SPA index.html with base-adjusted asset URLs & PWA installer
$indexHtmlPath = $frontendDist . '/index.html';
if (is_file($indexHtmlPath)) {
    $html = file_get_contents($indexHtmlPath);
    $html = str_replace([
        '"./assets/',
        '"/assets/',
        "'./assets/",
        "'/assets/",
        '"./favicon.png"',
        '"./apple-touch-icon.png"',
    ], [
        '"' . $scriptDir . '/assets/',
        '"' . $scriptDir . '/assets/',
        "'" . $scriptDir . '/assets/',
        "'" . $scriptDir . '/assets/',
        '"' . $scriptDir . '/favicon.png"',
        '"' . $scriptDir . '/pwa-icon-192.png"',
    ], $html);

    $tenantSlug = (count($segments) >= 1 && !in_array(strtolower($segments[0]), $reservedTabs, true)) ? strtolower($segments[0]) : '';
    $html = axInjectPwaTags($html, $scriptDir, '#0b4fb8', 'TradeDesk POS', $tenantSlug);

    header('Content-Type: text/html; charset=utf-8');
    echo $html;
    exit;
}

http_response_code(500);
echo 'TradeDesk POS frontend build not found.';

