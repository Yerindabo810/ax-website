<?php

/**
 * BizBooks.ug — Unified Entry Point (/bizbooks)
 * - Serves React SPA at /bizbooks and /bizbooks/{business-name}/login
 * - Routes /bizbooks/api/* to Laravel Backend (ax-systems/BizBooks/backend)
 */

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

$systemDir = dirname(__DIR__) . '/ax-systems/BizBooks';
$frontendDist = $systemDir . '/frontend/dist';
$backendRoot = $systemDir . '/backend';
$backendPublic = $backendRoot . '/public';

$scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/bizbooks/index.php')), '/');
$requestPath = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
$relPath = ltrim(substr($requestPath, strlen($scriptDir)), '/');

require_once dirname(__DIR__) . '/pwa-helper.php';
axHandlePwaRequest([
    'systemSlug'       => 'bizbooks',
    'systemName'       => 'BizBooks.ug Accounting',
    'shortName'        => 'BizBooks',
    'description'      => 'Smart Cloud Accounting, Invoicing, Expenses & Financial Reports for Businesses',
    'themeColor'       => '#0047ab',
    'backgroundColor'  => '#0b162c',
    'iconFile'         => dirname(__DIR__) . '/BizBooks.ug Growth Emblem.png',
    'scriptDir'        => $scriptDir,
    'relPath'          => $relPath,
    'reservedSegments' => ['login', 'get-started', 'dashboard', 'api', 'assets', 'index.php', 'index.html'],
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

// 1. Handle Backend API & Storage routes (/bizbooks/api/*, /bizbooks/storage/*)
if (preg_match('#^(api|sanctum|storage|uploads)(/|$)#i', $relPath)) {
    $staticBackendFile = $backendPublic . '/' . $relPath;
    if (is_file($staticBackendFile) && strtolower(pathinfo($staticBackendFile, PATHINFO_EXTENSION)) !== 'php') {
        $ext = strtolower(pathinfo($staticBackendFile, PATHINFO_EXTENSION));
        if (isset($mimeMap[$ext])) {
            header('Content-Type: ' . $mimeMap[$ext]);
        }
        header('Content-Length: ' . filesize($staticBackendFile));
        readfile($staticBackendFile);
        exit;
    }

    define('LARAVEL_START', microtime(true));

    $_ENV['SESSION_COOKIE'] = 'bizbooks_session';
    $_SERVER['SESSION_COOKIE'] = 'bizbooks_session';
    putenv('SESSION_COOKIE=bizbooks_session');

    if (file_exists($maintenance = $backendRoot . '/storage/framework/maintenance.php')) {
        require $maintenance;
    }

    require $backendRoot . '/vendor/autoload.php';

    /** @var Application $app */
    $app = require_once $backendRoot . '/bootstrap/app.php';

    $app->handleRequest(Request::capture());
    exit;
}

// 2. Serve Frontend Static Assets (from frontend/dist or root BizBooks folder)
if ($relPath !== '' && $relPath !== 'index.php' && $relPath !== 'index.html') {
    $candidate = $frontendDist . '/' . $relPath;

    if (!is_file($candidate) && ($assetsPos = strpos($relPath, 'assets/')) !== false) {
        $candidate = $frontendDist . '/' . substr($relPath, $assetsPos);
    }
    if (!is_file($candidate) && is_file($systemDir . '/' . basename($relPath))) {
        $candidate = $systemDir . '/' . basename($relPath);
    }

    if (is_file($candidate) && strtolower(pathinfo($candidate, PATHINFO_EXTENSION)) !== 'php') {
        $ext = strtolower(pathinfo($candidate, PATHINFO_EXTENSION));
        if (isset($mimeMap[$ext])) {
            header('Content-Type: ' . $mimeMap[$ext]);
        }
        header('Content-Length: ' . filesize($candidate));
        readfile($candidate);
        exit;
    }
}

// 3. Serve SPA index.html with base-adjusted asset URLs & PWA installer
$indexHtmlPath = $frontendDist . '/index.html';
if (is_file($indexHtmlPath)) {
    $html = file_get_contents($indexHtmlPath);
    $html = str_replace(['"./assets/', '"/assets/', "'./assets/", "'/assets/", '"/logo.png"'], [
        '"' . $scriptDir . '/assets/',
        '"' . $scriptDir . '/assets/',
        "'" . $scriptDir . '/assets/',
        "'" . $scriptDir . '/assets/',
        '"' . $scriptDir . '/logo.png"',
    ], $html);
    $jsBundlePath = $frontendDist . '/assets/index-B1RlGprI.js';
    $ver = is_file($jsBundlePath) ? filemtime($jsBundlePath) : time();
    $html = str_replace('index-B1RlGprI.js"', 'index-B1RlGprI.js?v=' . $ver . '"', $html);

    $assetFixScript = '<script>(function(){var b=' . json_encode($scriptDir) . ';if(!b)return;function f(r){(r.querySelectorAll?r.querySelectorAll("img[src]"):[]).forEach(function(i){var s=i.getAttribute("src");if(s&&/^\/(logo\.png|favicon\.svg|icons\.svg|assets\/|slides\/)/.test(s)&&s.indexOf(b+"/")!==0){i.setAttribute("src",b+s);}});}f(document);new MutationObserver(function(m){m.forEach(function(r){r.addedNodes.forEach(function(n){if(n.nodeType===1){if(n.tagName==="IMG")f(n.parentNode||document);else f(n);}});});}).observe(document.documentElement,{childList:true,subtree:true});})();</script>';

    $reservedBiz = ['login', 'get-started', 'dashboard', 'api', 'assets', 'index.php', 'index.html'];
    $segments = $relPath === '' ? [] : explode('/', $relPath);
    $tenantSlug = (count($segments) >= 1 && !in_array(strtolower($segments[0]), $reservedBiz, true)) ? strtolower($segments[0]) : '';

    $html = axInjectPwaTags($html, $scriptDir, '#0047ab', 'BizBooks', $tenantSlug);
    $html = str_ireplace('</body>', $assetFixScript . "\n</body>", $html);

    header('Content-Type: text/html; charset=utf-8');
    echo $html;
    exit;
}

http_response_code(500);
echo 'BizBooks frontend build not found.';

