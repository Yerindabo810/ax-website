<?php

/**
 * Unified Progressive Web App (PWA) Helper for AX Technologies Systems
 * Handles:
 *  - /{system}/manifest.json (Dynamic per-system & per-tenant manifest)
 *  - /{system}/sw.js         (Scoped Service Worker)
 *  - /{system}/pwa-icon.png  (System App Icon)
 *  - /{system}/pwa-install.js (Auto-registration + "Install App" UI button)
 */

function axHandlePwaRequest(array $config): void
{
    require_once __DIR__ . '/cloudflare-security.php';
    axEnforceCloudflareLoginProtection($config);

    $scriptDir   = $config['scriptDir'] ?? '';
    $relPath     = ltrim($config['relPath'] ?? '', '/');
    $systemSlug  = $config['systemSlug'] ?? 'app';
    $systemName  = $config['systemName'] ?? 'AX System';
    $shortName   = $config['shortName'] ?? $systemName;
    $description = $config['description'] ?? 'Enterprise Software by AX Technologies Uganda';
    $themeColor  = $config['themeColor'] ?? '#0b4fb8';
    $bgColor     = $config['bgColor'] ?? '#ffffff';
    $iconFile    = $config['iconFile'] ?? dirname(__DIR__) . '/ax-logo.png';
    $reserved    = $config['reservedSegments'] ?? [];

    // Redirect requests on the main marketing domain (axtechnologies.net) to dedicated system subdomains
    $pureHost = strtolower(explode(':', $_SERVER['HTTP_HOST'] ?? '')[0]);
    if ($pureHost === 'axtechnologies.net' || $pureHost === 'www.axtechnologies.net') {
        $subdomainMap = [
            'tradedeskpos' => 'pos.axtechnologies.net',
            'pos'          => 'pos.axtechnologies.net',
            'bizbooks'     => 'books.axtechnologies.net',
            'books'        => 'books.axtechnologies.net',
            'smartschool'  => 'school.axtechnologies.net',
            'school'       => 'school.axtechnologies.net',
            'smartpharma'  => 'pharma.axtechnologies.net',
            'pharma'       => 'pharma.axtechnologies.net',
        ];
        if (isset($subdomainMap[$systemSlug])) {
            $targetSubdomain = $subdomainMap[$systemSlug];
            $targetUri = $relPath !== '' ? ('/' . $relPath) : '/';
            header('Location: https://' . $targetSubdomain . $targetUri, true, 301);
            exit;
        }
    }

    $host = strtolower($_SERVER['HTTP_HOST'] ?? '');
    $isSubdomainRoot = ($scriptDir === '') || preg_match('/^(pos|tradedesk|books|bizbooks|school|smartschool|pharma|smartpharma)\./i', $host);
    $basePath = $isSubdomainRoot ? '' : ($scriptDir !== '' ? $scriptDir : '/' . $systemSlug);
    $lowerRel = strtolower($relPath);

    // Strip leading tenant segment if requesting /{system}/{tenant}/manifest.json or sw.js
    $segments = $relPath === '' ? [] : explode('/', $relPath);
    $detectedTenant = '';
    if (count($segments) >= 2 && !in_array(strtolower($segments[0]), $reserved, true)) {
        $detectedTenant = strtolower($segments[0]);
    }

    $lastSegment = strtolower( end($segments) ?: '' );

    // 1. Serve /{system}/pwa-icon.png, pwa-icon-192.png, pwa-icon-512.png
    if (preg_match('/^pwa-icon(-([0-9]+))?\.png$/i', $lastSegment, $iconMatches) || $lowerRel === 'pwa-icon.png') {
        $requestedSize = isset($iconMatches[2]) ? (int) $iconMatches[2] : null;
        $sizeFile = $requestedSize ? (__DIR__ . '/' . $systemSlug . '/pwa-icon-' . $requestedSize . '.png') : null;
        if (!$sizeFile || !is_file($sizeFile)) {
            // Also check current directory if running inside DocumentRoot
            $sizeFile = $requestedSize ? (__DIR__ . '/pwa-icon-' . $requestedSize . '.png') : null;
        }
        if ($sizeFile && is_file($sizeFile)) {
            header('Content-Type: image/png');
            header('Cache-Control: public, max-age=86400');
            readfile($sizeFile);
            exit;
        }
        if (is_file($iconFile)) {
            header('Content-Type: image/png');
            header('Cache-Control: public, max-age=86400');
            readfile($iconFile);
            exit;
        }
    }

    // 2. Serve /{system}/manifest.json
    if ($lowerRel === 'manifest.json' || $lowerRel === 'manifest.webmanifest' || $lastSegment === 'manifest.json') {
        $tenantSlug = preg_replace('/[^a-z0-9-_]/i', '', $_GET['tenant'] ?? $detectedTenant);
        $customName = trim($_GET['name'] ?? '');
        $customLogo = trim($_GET['logo'] ?? '');

        $appName = $systemName;
        $appShortName = $shortName;
        $scopeUrl = ($basePath !== '' ? $basePath : '') . '/';
        $startUrl = $scopeUrl;

        if ($tenantSlug !== '') {
            $prettyTenant = $customName !== '' ? $customName : ucwords(str_replace(['-', '_'], ' ', $tenantSlug));
            $appName = $prettyTenant . ' — ' . $shortName;
            $appShortName = mb_substr($prettyTenant, 0, 20);
            $startUrl = ($basePath !== '' ? $basePath : '') . '/' . $tenantSlug . '/login';
        }

        $icon192 = ($basePath !== '' ? $basePath : '') . '/pwa-icon-192.png';
        $icon512 = ($basePath !== '' ? $basePath : '') . '/pwa-icon-512.png';
        if ($customLogo !== '' && (str_starts_with($customLogo, 'http') || str_starts_with($customLogo, '/'))) {
            $icon192 = $customLogo;
            $icon512 = $customLogo;
        }

        $appId = ($basePath !== '' ? $basePath : '') . '/?pwa=' . $systemSlug . ($tenantSlug !== '' ? ('-' . $tenantSlug) : '');

        $manifest = [
            'id'               => $appId,
            'name'             => $appName,
            'short_name'       => $appShortName,
            'description'      => $description,
            'start_url'        => $startUrl,
            'scope'            => $scopeUrl,
            'display'          => 'standalone',
            'orientation'      => 'any',
            'background_color' => $bgColor,
            'theme_color'      => $themeColor,
            'prefer_related_applications' => false,
            'icons'            => [
                [
                    'src'     => $icon192,
                    'sizes'   => '192x192',
                    'type'    => 'image/png',
                    'purpose' => 'any',
                ],
                [
                    'src'     => $icon512,
                    'sizes'   => '512x512',
                    'type'    => 'image/png',
                    'purpose' => 'any',
                ],
                [
                    'src'     => $icon512,
                    'sizes'   => '512x512',
                    'type'    => 'image/png',
                    'purpose' => 'maskable',
                ],
            ],
        ];

        header('Content-Type: application/manifest+json; charset=utf-8');
        header('Cache-Control: no-cache');
        echo json_encode($manifest, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        exit;
    }

    // 3. Serve /{system}/sw.js
    if ($lowerRel === 'sw.js' || $lastSegment === 'sw.js') {
        $cacheName = 'ax-pwa-' . $systemSlug . '-v3';
        $scopeUrl = ($basePath !== '' ? $basePath : '') . '/';
        header('Content-Type: application/javascript; charset=utf-8');
        header('Service-Worker-Allowed: ' . $scopeUrl);
        header('Cache-Control: no-cache');

        echo <<<JS
const CACHE_NAME = '{$cacheName}';
const SCOPE_PATH = '{$scopeUrl}';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        SCOPE_PATH,
        SCOPE_PATH + 'pwa-icon-192.png',
        SCOPE_PATH + 'pwa-icon-512.png'
      ]).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key.startsWith('ax-pwa-{$systemSlug}-') && key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.pathname.includes('/api/') || url.pathname.includes('/sanctum/')) {
    return;
  }

  // Handle SPA navigation requests: network first with cache fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(SCOPE_PATH, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(SCOPE_PATH))
    );
    return;
  }

  // Network-first strategy with cache fallback for assets
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && (req.destination === 'style' || req.destination === 'script' || req.destination === 'image' || req.destination === 'font')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
JS;
        exit;
    }

    // 4. Serve /{system}/pwa-install.js
    if ($lowerRel === 'pwa-install.js' || $lastSegment === 'pwa-install.js') {
        header('Content-Type: application/javascript; charset=utf-8');
        header('Cache-Control: no-cache');
        $reservedJson = json_encode(array_values($reserved));

        echo <<<JS
(function () {
  if (window.__AX_PWA_INITIALIZED__) return;
  window.__AX_PWA_INITIALIZED__ = true;

  var BASE_PATH = '{$basePath}';
  var SYSTEM_NAME = '{$systemName}';
  var SHORT_NAME = '{$shortName}';
  var THEME_COLOR = '{$themeColor}';
  var RESERVED = {$reservedJson};

  var isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  function detectTenantFromUrl() {
    var path = window.location.pathname || '';
    var rel = path.indexOf(BASE_PATH) === 0 ? path.slice(BASE_PATH.length) : path;
    var parts = rel.split('/').filter(Boolean);
    if (parts.length > 0) {
      var first = parts[0].toLowerCase();
      if (RESERVED.indexOf(first) === -1 && first.indexOf('.') === -1) {
        return first;
      }
    }
    return '';
  }

  var tenant = detectTenantFromUrl();
  var manifestUrl = BASE_PATH + '/manifest.json' + (tenant ? '?tenant=' + encodeURIComponent(tenant) : '');

  // Ensure <link rel="manifest"> and meta tags exist
  var existingManifest = document.querySelector('link[rel="manifest"]');
  if (!existingManifest) {
    var link = document.createElement('link');
    link.rel = 'manifest';
    link.href = manifestUrl;
    document.head.appendChild(link);
  } else if (tenant && existingManifest.href.indexOf('tenant=') === -1) {
    existingManifest.href = manifestUrl;
  }
  if (!document.querySelector('meta[name="theme-color"]')) {
    var meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = THEME_COLOR;
    document.head.appendChild(meta);
  }
  if (!document.querySelector('link[rel="apple-touch-icon"]')) {
    var appleIcon = document.createElement('link');
    appleIcon.rel = 'apple-touch-icon';
    appleIcon.href = BASE_PATH + '/pwa-icon-192.png';
    document.head.appendChild(appleIcon);
  }

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker
        .register(BASE_PATH + '/sw.js', { scope: BASE_PATH + '/' })
        .catch(function () {});
    });
  }

  // Load Cloudflare Turnstile Login & Registration Bot Protection (Exempt SmartSchool)
  var isSmartSchool = (SYSTEM_NAME.indexOf('SmartSchool') !== -1 || window.location.hostname.indexOf('school.') !== -1 || window.location.pathname.indexOf('smartschool') !== -1);
  if (!isSmartSchool && !window.__axCloudflareProtectLoaded && !window.__axNoTurnstile) {
    var cfScript = document.createElement('script');
    cfScript.src = BASE_PATH + '/cf-protect.js';
    cfScript.defer = true;
    document.head.appendChild(cfScript);
  }

  if (isStandalone) return;

  var deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    var el = document.getElementById('ax-pwa-install-pill');
    if (el) el.remove();
  });

  function showInstallModal() {
    var existing = document.getElementById('ax-pwa-modal');
    if (existing) existing.remove();

    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    var appLabel = tenant
      ? tenant.replace(/-/g, ' ').replace(/\\b\\w/g, function (l) { return l.toUpperCase(); }) + ' (' + SHORT_NAME + ')'
      : SYSTEM_NAME;

    var stepsHtml = isIOS
      ? '<ol style="margin:0;padding-left:20px;line-height:1.7;color:#334155;font-size:14px;">' +
        '<li>Tap the <strong>Share</strong> button at the bottom of Safari.</li>' +
        '<li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>' +
        '<li>Tap <strong>Add</strong> in the top-right corner to install <strong>' + appLabel + '</strong>.</li>' +
        '</ol>'
      : '<ol style="margin:0;padding-left:20px;line-height:1.7;color:#334155;font-size:14px;">' +
        '<li>Click the <strong>Install App</strong> icon on the right side of your browser address bar (or open the browser <strong>⋮ Menu</strong>).</li>' +
        '<li>Select <strong>Install ' + SHORT_NAME + '</strong> (or <strong>Add to Home screen</strong> on Android).</li>' +
        '<li>The system will launch in its own standalone window with a desktop/home screen shortcut.</li>' +
        '</ol>';

    var overlay = document.createElement('div');
    overlay.id = 'ax-pwa-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.6);backdrop-filter:blur(4px);z-index:999999;display:flex;align-items:center;justify-content:center;padding:16px;font-family:Inter,system-ui,sans-serif;';
    overlay.innerHTML =
      '<div style="background:#ffffff;border-radius:16px;max-width:420px;width:100%;padding:24px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.35);border:1px solid #e2e8f0;">' +
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">' +
          '<img src="' + BASE_PATH + '/pwa-icon.png" alt="" style="width:48px;height:48px;border-radius:10px;object-fit:contain;border:1px solid #e2e8f0;padding:4px;background:#fff;" />' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-weight:800;font-size:16px;color:#0f172a;">Install ' + appLabel + '</div>' +
            '<div style="font-size:12px;color:#64748b;">Install as a standalone desktop or mobile app</div>' +
          '</div>' +
          '<button id="ax-pwa-modal-close" style="background:none;border:none;font-size:22px;line-height:1;color:#64748b;cursor:pointer;padding:4px;">&times;</button>' +
        '</div>' +
        stepsHtml +
        '<div style="margin-top:20px;display:flex;justify-content:flex-end;">' +
          '<button id="ax-pwa-modal-ok" style="background:' + THEME_COLOR + ';color:#fff;border:none;border-radius:8px;padding:9px 18px;font-weight:700;font-size:13px;cursor:pointer;">Got It</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay) overlay.remove();
    });
    document.getElementById('ax-pwa-modal-close').onclick = function () { overlay.remove(); };
    document.getElementById('ax-pwa-modal-ok').onclick = function () { overlay.remove(); };
  }

  function triggerInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () {
        deferredPrompt = null;
      });
    } else {
      showInstallModal();
    }
  }

  window.axTriggerPwaInstall = triggerInstall;

  function showInstallBanner() {
    if (sessionStorage.getItem('ax_pwa_dismissed_' + SHORT_NAME) === '1') return;
    if (document.getElementById('ax-pwa-install-pill')) return;

    var pill = document.createElement('div');
    pill.id = 'ax-pwa-install-pill';
    pill.style.cssText =
      'position:fixed;bottom:18px;left:18px;z-index:99990;display:flex;align-items:center;gap:8px;' +
      'background:' + THEME_COLOR + ';color:#ffffff;padding:9px 14px;border-radius:999px;' +
      'box-shadow:0 10px 25px -5px rgba(15,23,42,0.4);font-family:Inter,system-ui,sans-serif;font-size:13px;font-weight:700;';

    var label = tenant ? 'Install Store/School App' : 'Install ' + SHORT_NAME + ' App';

    pill.innerHTML =
      '<button id="ax-pwa-install-btn" type="button" style="background:none;border:none;color:#ffffff;display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:700;font-size:13px;padding:0;">' +
        '<img src="' + BASE_PATH + '/pwa-icon.png" alt="" style="width:22px;height:22px;border-radius:5px;background:#fff;object-fit:contain;padding:2px;" />' +
        '<span>' + label + '</span>' +
      '</button>' +
      '<button id="ax-pwa-dismiss-btn" type="button" title="Dismiss" style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:13px;line-height:1;display:flex;align-items:center;justify-content:center;margin-left:2px;">&times;</button>';

    document.body.appendChild(pill);

    document.getElementById('ax-pwa-install-btn').onclick = triggerInstall;
    document.getElementById('ax-pwa-dismiss-btn').onclick = function (e) {
      e.stopPropagation();
      sessionStorage.setItem('ax_pwa_dismissed_' + SHORT_NAME, '1');
      pill.remove();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showInstallBanner);
  } else {
    showInstallBanner();
  }
})();
JS;
        exit;
    }
}

/**
 * Injects PWA manifest and mobile meta tags into the HTML <head> and install script into <body>.
 */
function axInjectPwaTags(string $html, string $scriptDir, string $themeColor = '#0b4fb8', string $appName = 'AX App', string $tenant = ''): string
{
    // Never inject PWA tags into partial HTML fragments, AJAX responses, or raw text strings
    if (stripos($html, '</head>') === false && stripos($html, '</body>') === false && stripos($html, '<html') === false) {
        return $html;
    }

    $host = strtolower($_SERVER['HTTP_HOST'] ?? '');
    $isSubdomain = preg_match('/^(pos|tradedesk|books|bizbooks|school|smartschool|pharma|smartpharma)\./i', $host);
    $basePath = ($isSubdomain || $scriptDir === '') ? '' : $scriptDir;

    $manifestHref = ($basePath !== '' ? $basePath : '') . '/manifest.json' . ($tenant !== '' ? ('?tenant=' . urlencode($tenant)) : '');
    $icon192 = ($basePath !== '' ? $basePath : '') . '/pwa-icon-192.png';
    $icon512 = ($basePath !== '' ? $basePath : '') . '/pwa-icon-512.png';
    $installJs = ($basePath !== '' ? $basePath : '') . '/pwa-install.js';

    // Strip any existing relative or hardcoded manifest tags to avoid duplication
    $html = preg_replace('/<link\s+[^>]*rel=["\']manifest["\'][^>]*>/i', '', $html) ?? $html;

    $headTags = "\n"
        . '    <link rel="manifest" href="' . htmlspecialchars($manifestHref) . '">' . "\n"
        . '    <meta name="theme-color" content="' . htmlspecialchars($themeColor) . '">' . "\n"
        . '    <meta name="mobile-web-app-capable" content="yes">' . "\n"
        . '    <meta name="apple-mobile-web-app-capable" content="yes">' . "\n"
        . '    <meta name="apple-mobile-web-app-status-bar-style" content="default">' . "\n"
        . '    <meta name="apple-mobile-web-app-title" content="' . htmlspecialchars($appName) . '">' . "\n"
        . '    <link rel="apple-touch-icon" sizes="192x192" href="' . $icon192 . '">' . "\n"
        . '    <link rel="apple-touch-icon" sizes="512x512" href="' . $icon512 . '">' . "\n";

    $bodyScript = "\n    <script src=\"" . $installJs . "\" defer></script>\n";

    if (stripos($html, '</head>') !== false) {
        $html = str_ireplace('</head>', $headTags . '</head>', $html);
    }

    if (stripos($html, '</body>') !== false && stripos($html, 'pwa-install.js') === false) {
        $html = str_ireplace('</body>', $bodyScript . '</body>', $html);
    }

    return $html;
}

