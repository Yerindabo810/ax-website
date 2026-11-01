<?php

/**
 * SmartLearn.ug Entry Point under /smartlearn
 * Serves the React frontend SPA & static assets from /smartlearn
 * and forwards /smartlearn/api/* requests to the Laravel backend.
 */

$distPath    = realpath(__DIR__ . '/../ax-systems/SmartLearn/frontend/dist');
$backendPath = realpath(__DIR__ . '/../ax-systems/SmartLearn/backend');

$scriptDir  = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/smartlearn/index.php')), '/');
$requestUri = $_SERVER['REQUEST_URI'] ?? $scriptDir;
$pathOnly   = rawurldecode(parse_url($requestUri, PHP_URL_PATH) ?: '/');
$relPath    = $pathOnly;
if ($scriptDir !== '' && str_starts_with($pathOnly, $scriptDir)) {
    $relPath = substr($pathOnly, strlen($scriptDir)) ?: '/';
}

require_once dirname(__DIR__) . '/pwa-helper.php';
axHandlePwaRequest([
    'systemSlug'       => 'smartlearn',
    'systemName'       => 'SmartLearn.ug',
    'shortName'        => 'SmartLearn',
    'description'      => 'AI-Powered E-Learning & Digital Revision Platform',
    'themeColor'       => '#003399',
    'backgroundColor'  => '#0b162c',
    'iconFile'         => dirname(__DIR__) . '/SmartLearn.ug Education Logo.png',
    'scriptDir'        => $scriptDir,
    'relPath'          => ltrim($relPath, '/'),
    'reservedSegments' => ['login', 'signup', 'dashboard', 'courses', 'api', 'assets', 'index.php', 'index.html'],
]);

// 1. Route /smartlearn/api/* or /smartlearn/sanctum/* or /smartlearn/storage/* to Laravel backend
if (
    $backendPath && (
        $relPath === '/api' ||
        str_starts_with($relPath, '/api/') ||
        str_starts_with($relPath, '/sanctum/') ||
        str_starts_with($relPath, '/storage/')
    )
) {
    putenv('SESSION_COOKIE=smartlearn_session');
    $_ENV['SESSION_COOKIE']    = 'smartlearn_session';
    $_SERVER['SESSION_COOKIE'] = 'smartlearn_session';

    chdir($backendPath . '/public');
    require $backendPath . '/public/index.php';
    exit;
}

// 2. Serve built frontend static files (/assets/*, images, etc.)
if ($distPath && $relPath !== '/' && $relPath !== '/index.php') {
    $candidate = realpath($distPath . $relPath);
    if ($candidate && str_starts_with($candidate, $distPath) && is_file($candidate)) {
        $ext = strtolower(pathinfo($candidate, PATHINFO_EXTENSION));
        $mimeMap = [
            'css'   => 'text/css; charset=utf-8',
            'js'    => 'application/javascript; charset=utf-8',
            'mjs'   => 'application/javascript; charset=utf-8',
            'json'  => 'application/json; charset=utf-8',
            'svg'   => 'image/svg+xml',
            'png'   => 'image/png',
            'jpg'   => 'image/jpeg',
            'jpeg'  => 'image/jpeg',
            'webp'  => 'image/webp',
            'gif'   => 'image/gif',
            'ico'   => 'image/x-icon',
            'woff'  => 'font/woff',
            'woff2' => 'font/woff2',
            'ttf'   => 'font/ttf',
        ];
        header('Content-Type: ' . ($mimeMap[$ext] ?? (mime_content_type($candidate) ?: 'application/octet-stream')));
        header('Cache-Control: public, max-age=86400');
        readfile($candidate);
        exit;
    }
}

// 3. Serve SPA index.html with dynamic <base href> so deep routes work cleanly
$indexHtmlFile = $distPath . '/index.html';
if (!is_file($indexHtmlFile)) {
    http_response_code(503);
    echo 'SmartLearn frontend build not found.';
    exit;
}

$html = file_get_contents($indexHtmlFile);
$baseHref = htmlspecialchars($scriptDir . '/', ENT_QUOTES, 'UTF-8');
$html = preg_replace('/<head>/i', '<head>' . "\n" . '    <base href="' . $baseHref . '" />', $html, 1);
$pwaTags = '<link rel="manifest" href="' . $scriptDir . '/manifest.json">' . "\n"
         . '<meta name="theme-color" content="#003399">' . "\n"
         . '<script src="' . $scriptDir . '/pwa-install.js" defer></script>';
$html = str_ireplace('</body>', $pwaTags . "\n</body>", $html);

header('Content-Type: text/html; charset=utf-8');
echo $html;

