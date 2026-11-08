<?php

/**
 * SmartSchool.ug — Entry Point (/smartschool)
 * Supports central landing/search (/smartschool) and path-based school portals (/smartschool/{school-name}/login)
 */

define('LARAVEL_START', microtime(true));

$appRoot = dirname(__DIR__) . '/ax-systems/smartschool.ug';
$publicRoot = $appRoot . '/public';

$scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/smartschool/index.php')), '/');
$requestPath = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
$relPath = ltrim(substr($requestPath, strlen($scriptDir)), '/');

$reservedCentral = [
    'index.php',
    'login',
    'logout',
    'mobile',
    'download-app',
    'SmartSchool.apk',
    'password',
    'reset',
    'home',
    'register',
    'register-school',
    'parent-login',
    'master-admin',
    'admin',
    'dashboard',
    'overview',
    'schools',
    'direct-payments',
    'marzpay',
    'sms-balance',
    'profile',
    'verify-2fa',
    'resend-2fa',
    'gateway-balances',
    'verify',
    'api',
    'webhooks',
    'logoes',
    'cloud-file',
    'assets',
    'css',
    'js',
    'images',
    'logos',
    'uploads',
    'files',
    'qrcodes',
    'svg',
    'templates',
    'ajax_stream_finder',
    'ajax_class_finder',
    'ajax_student_finder',
    'ajax_optioal_subject_finder',
    'ajax_subject_finder',
    'ajax_level_subject_finder',
    'ajax_class_subject_finder',
    'ajax_learning_material_finder',
    'ajax_combination_finder',
    'marksheets',
    'report_cards',
    'expense_report',
    'periodic_fees_collection_form',
    'overall_fees_collection',
    'termly_fees_collection',
    'bankreport',
    'get_reconciliation',
    'finance_report',
    'get_sub_category_report',
    'purchase_report',
];

require_once dirname(__DIR__) . '/pwa-helper.php';
axHandlePwaRequest([
    'systemSlug'       => 'smartschool',
    'systemName'       => 'SmartSchool.ug ERP',
    'shortName'        => 'SmartSchool',
    'description'      => 'Complete Cloud School Management System — Admissions, Academics, Fees & UNEB Grading',
    'themeColor'       => '#003399',
    'backgroundColor'  => '#0b162c',
    'iconFile'         => dirname(__DIR__) . '/logo.png',
    'scriptDir'        => $scriptDir,
    'relPath'          => $relPath,
    'reservedSegments' => $reservedCentral,
]);

// 1. Serve static files from SmartSchool's public/ directory if requested directly
if ($relPath !== '' && $relPath !== 'index.php') {
    $candidateFile = $publicRoot . '/' . $relPath;
    // Also check if prefixed by a tenant slug (e.g., /smartschool/{school}/css/...)
    if (!is_file($candidateFile) && strpos($relPath, '/') !== false) {
        $afterFirstSlash = substr($relPath, strpos($relPath, '/') + 1);
        if ($afterFirstSlash !== '' && is_file($publicRoot . '/' . $afterFirstSlash)) {
            $candidateFile = $publicRoot . '/' . $afterFirstSlash;
        }
    }

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
            'eot'   => 'application/vnd.ms-fontobject',
            'pdf'   => 'application/pdf',
            'apk'   => 'application/vnd.android.package-archive',
            'mp4'   => 'video/mp4',
            'webm'  => 'video/webm',
        ];
        if (isset($mimeMap[$ext])) {
            header('Content-Type: ' . $mimeMap[$ext]);
        }
        readfile($candidateFile);
        exit;
    }
}

// 2. Configure Asset URL & Isolated Session Cookie
$_SERVER['SMARTSCHOOL_ASSET_URL'] = $scriptDir;
$_ENV['ASSET_URL'] = $scriptDir;
$_SERVER['ASSET_URL'] = $scriptDir;
putenv("ASSET_URL={$scriptDir}");

$_ENV['SESSION_COOKIE'] = 'smartschool_session';
$_SERVER['SESSION_COOKIE'] = 'smartschool_session';
putenv('SESSION_COOKIE=smartschool_session');

// 3. Detect Path-Based School Slug (/smartschool/{school-name}/login)
$segments = $relPath === '' ? [] : explode('/', $relPath);

if (!empty($segments[0]) && !in_array(strtolower($segments[0]), $reservedCentral, true) && !str_starts_with(strtolower($segments[0]), 'ajax_')) {
    $schoolSlug = strtolower($segments[0]);
    $_SERVER['SMARTSCHOOL_TENANT'] = $schoolSlug;

    $prefix = $scriptDir !== '' ? $scriptDir : '';
    // Only redirect if specifically hitting a legacy login or parent-logout sub-path
    if (count($segments) >= 2 && in_array(strtolower($segments[1]), ['login', 'parent_logout', 'student_parent'], true)) {
        header('Location: ' . $prefix . '/login', true, 302);
        exit;
    }
}

require $appRoot . '/vendor/autoload.php';

$app = require_once $appRoot . '/bootstrap/app.php';

// Ensure central domains include dedicated subdomains before routing
if (isset($app['config'])) {
    $existingCentral = (array) $app['config']->get('tenancy.central_domains', []);
    $app['config']->set('tenancy.central_domains', array_values(array_unique(array_merge($existingCentral, [
        'localhost',
        '127.0.0.1',
        'admin.localhost',
        'axtechnologies.net',
        'www.axtechnologies.net',
        'school.axtechnologies.net',
        'smartschool.axtechnologies.net',
        'smartschool.ug',
        'www.smartschool.ug',
    ]))));
}

$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

$response = $kernel->handle(
    $request = Illuminate\Http\Request::capture()
);

// Inject PWA installer script & rewrite any root-relative href="/..." or action="/..." in HTML responses
$contentType = (string) $response->headers->get('Content-Type', '');
if (!$request->ajax() && (stripos($contentType, 'text/html') !== false || $contentType === '')) {
    $content = $response->getContent();
    if (is_string($content) && $content !== '') {
        $basePrefix = !empty($_SERVER['SMARTSCHOOL_TENANT'])
            ? ($scriptDir . '/' . $_SERVER['SMARTSCHOOL_TENANT'])
            : $scriptDir;

        if ($basePrefix !== '') {
            $currentTenant = !empty($_SERVER['SMARTSCHOOL_TENANT']) ? strtolower((string)$_SERVER['SMARTSCHOOL_TENANT']) : '';
            $content = preg_replace_callback(
                '/\b(href|action)=(["\'])\/(?!\/)([^"\']*)\2/i',
                function (array $m) use ($basePrefix, $scriptDir, $currentTenant): string {
                    $attr = $m[1];
                    $quote = $m[2];
                    $rest = $m[3];
                    $fullPath = '/' . $rest;

                    // 1. NEVER prepend if path already starts with $basePrefix
                    if ($basePrefix !== '' && (str_starts_with($fullPath, $basePrefix . '/') || $fullPath === $basePrefix)) {
                        return $m[0];
                    }

                    // 2. NEVER prepend if path already starts with current tenant slug (prevents duplicate slugs like /ax-secondary-school/ax-secondary-school/...)
                    if ($currentTenant !== '' && (str_starts_with($fullPath, '/' . $currentTenant . '/') || $fullPath === '/' . $currentTenant)) {
                        return $m[0];
                    }

                    // 3. NEVER prepend if path already starts with $scriptDir
                    if ($scriptDir !== '' && (str_starts_with($fullPath, $scriptDir . '/') || $fullPath === $scriptDir)) {
                        return $m[0];
                    }

                    // 4. Do not prefix static asset directories with school tenant slug
                    if (preg_match('~^/(assets|css|js|images|logoes|cloud-file|vendor|templates|files|uploads)/~i', $fullPath)) {
                        return $attr . '=' . $quote . ($scriptDir !== '' ? $scriptDir : '') . $fullPath . $quote;
                    }

                    return $attr . '=' . $quote . $basePrefix . '/' . $rest . $quote;
                },
                $content
            ) ?? $content;
        }

        $tenant = (string) ($_SERVER['SMARTSCHOOL_TENANT'] ?? '');
        $ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
        $isMobileAppRoute = (stripos($relPath, 'mobile') !== false || stripos($ua, 'SmartSchoolAndroid') !== false || stripos($ua, '; wv)') !== false);
        if (!$isMobileAppRoute) {
            $content = axInjectPwaTags($content, $scriptDir, '#0d9488', 'SmartSchool.ug', $tenant);
        }
        $response->setContent($content);
    }
}

$response->send();

$kernel->terminate($request, $response);

