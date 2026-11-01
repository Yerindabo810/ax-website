<?php

/**
 * AX Technologies Uganda — Centralized Cloudflare Security & Turnstile Bot Protection
 *
 * 1. Restores real visitor IP (CF-Connecting-IP) and HTTPS scheme (CF-Visitor) behind Cloudflare Proxy.
 * 2. Protects all Login, Registration, and Contact POST endpoints with:
 *    - Cloudflare Turnstile cryptographic token verification (https://challenges.cloudflare.com/turnstile/v0/siteverify)
 *    - Per-IP Brute-Force Rate Limiting
 *    - Honeypot & automated headless bot detection
 * 3. Serves `cf-protect.js` which auto-renders the Cloudflare Turnstile widget inside both
 *    traditional HTML forms (SmartSchool, SmartPharma, Contact) and React SPA forms (TradeDesk POS, BizBooks).
 *
 * HOW TO GO LIVE:
 * In Cloudflare Dashboard -> Turnstile -> Add Widget (choose "Managed"), then paste your
 * Site Key and Secret Key below (or set CF_TURNSTILE_SITE_KEY / CF_TURNSTILE_SECRET_KEY in your environment).
 */

if (!defined('AX_CF_TURNSTILE_SITE_KEY')) {
    define('AX_CF_TURNSTILE_SITE_KEY', getenv('CF_TURNSTILE_SITE_KEY') ?: '0x4AAAAAAFtNIl9JiNnsQ9pO');
}

if (!defined('AX_CF_TURNSTILE_SECRET_KEY')) {
    define('AX_CF_TURNSTILE_SECRET_KEY', getenv('CF_TURNSTILE_SECRET_KEY') ?: '0x4AAAAAAFtNIjaPJ3NraBwUHXE_fAMsE1I');
}

/**
 * Restore Real Visitor IP and HTTPS scheme when behind Cloudflare Proxy.
 */
function axRestoreCloudflareVisitor(): void
{
    if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        $cfIp = trim((string) $_SERVER['HTTP_CF_CONNECTING_IP']);
        if (filter_var($cfIp, FILTER_VALIDATE_IP)) {
            $_SERVER['REMOTE_ADDR'] = $cfIp;
            $_SERVER['HTTP_X_FORWARDED_FOR'] = $cfIp;
        }
    }

    if (!empty($_SERVER['HTTP_CF_VISITOR'])) {
        $visitor = @json_decode((string) $_SERVER['HTTP_CF_VISITOR'], true);
        if (is_array($visitor) && ($visitor['scheme'] ?? '') === 'https') {
            $_SERVER['HTTPS'] = 'on';
            $_SERVER['SERVER_PORT'] = 443;
            $_SERVER['HTTP_X_FORWARDED_PROTO'] = 'https';
        }
    }
}

/**
 * Simple file-based Per-IP Rate Limiter for auth endpoints.
 */
function axCheckAuthRateLimit(string $ip, string $bucket = 'auth', int $maxAttempts = 12, int $windowSeconds = 60): bool
{
    $dir = rtrim(sys_get_temp_dir(), '/\\') . '/ax_cf_ratelimit';
    if (!is_dir($dir)) {
        @mkdir($dir, 0777, true);
    }

    $key = md5($ip . '_' . $bucket);
    $file = $dir . '/' . $key . '.json';
    $now = time();

    $attempts = [];
    if (is_file($file)) {
        $raw = @file_get_contents($file);
        $decoded = $raw ? @json_decode($raw, true) : [];
        if (is_array($decoded)) {
            foreach ($decoded as $ts) {
                if (is_int($ts) && ($now - $ts) < $windowSeconds) {
                    $attempts[] = $ts;
                }
            }
        }
    }

    if (count($attempts) >= $maxAttempts) {
        return false;
    }

    $attempts[] = $now;
    @file_put_contents($file, json_encode($attempts));
    return true;
}

/**
 * Verify a Cloudflare Turnstile token against Cloudflare's siteverify API.
 */
function axVerifyTurnstileToken(string $token, string $remoteIp): bool
{
    $host = strtolower($_SERVER['HTTP_HOST'] ?? 'localhost');
    $isLocal = in_array($host, ['localhost', '127.0.0.1'], true) || str_starts_with($host, 'localhost:');

    // Allow local offline bypass token if the developer has no internet connection on localhost
    if ($isLocal && $token === 'ax-local-offline-bypass') {
        return true;
    }

    if ($token === '') {
        return false;
    }

    $postData = http_build_query([
        'secret'   => AX_CF_TURNSTILE_SECRET_KEY,
        'response' => $token,
        'remoteip' => $remoteIp,
    ]);

    $responseBody = false;

    if (function_exists('curl_init')) {
        $ch = curl_init('https://challenges.cloudflare.com/turnstile/v0/siteverify');
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $postData,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 8,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_SSL_VERIFYPEER => !$isLocal,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
        ]);
        $responseBody = curl_exec($ch);
        $curlErr = curl_errno($ch);
        curl_close($ch);

        // If on localhost without internet access, do not lock out local testing
        if ($responseBody === false && $curlErr !== 0 && $isLocal) {
            return true;
        }
    } else {
        $ctx = stream_context_create([
            'http' => [
                'method'  => 'POST',
                'header'  => "Content-Type: application/x-www-form-urlencoded\r\n",
                'content' => $postData,
                'timeout' => 8,
            ],
        ]);
        $responseBody = @file_get_contents('https://challenges.cloudflare.com/turnstile/v0/siteverify', false, $ctx);
        if ($responseBody === false && $isLocal) {
            return true;
        }
    }

    if (!is_string($responseBody) || $responseBody === '') {
        return false;
    }

    $result = @json_decode($responseBody, true);
    return is_array($result) && !empty($result['success']);
}

/**
 * Determine if the current request is a protected login/register POST and enforce protection.
 */
function axEnforceCloudflareLoginProtection(array $config = []): void
{
    axRestoreCloudflareVisitor();

    $scriptDir = rtrim((string) ($config['scriptDir'] ?? ''), '/');
    $relPath = ltrim((string) ($config['relPath'] ?? ''), '/');
    $lowerPath = strtolower($relPath);

    // 1. Serve /cf-protect.js for this system
    if ($lowerPath === 'cf-protect.js' || str_ends_with($lowerPath, '/cf-protect.js')) {
        header('Content-Type: application/javascript; charset=utf-8');
        header('Cache-Control: no-cache, must-revalidate');
        echo axBuildCloudflareClientScript(AX_CF_TURNSTILE_SITE_KEY);
        exit;
    }

    // 2. Only inspect POST requests for login / registration / contact
    if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        return;
    }

    // Match login & registration paths (excluding logout or authenticated settings routes)
    $isProtectedAuthPost = (bool) preg_match(
        '#(^|/)(login|register|register-school|signup|contact\.php)(/|$)#i',
        $lowerPath
    );

    if (!$isProtectedAuthPost) {
        return;
    }

    $remoteIp = (string) ($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1');
    $acceptHeader = strtolower((string) ($_SERVER['HTTP_ACCEPT'] ?? ''));
    $contentType = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
    $isJsonOrApi = str_contains($acceptHeader, 'application/json')
        || str_contains($contentType, 'application/json')
        || str_starts_with($lowerPath, 'api/')
        || str_ends_with($lowerPath, 'contact.php');

    // 3. Enforce Per-IP Brute-Force Rate Limiting (max 12 attempts per 60s)
    if (!axCheckAuthRateLimit($remoteIp, 'login_post', 12, 60)) {
        http_response_code(429);
        if ($isJsonOrApi) {
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'status'  => 'error',
                'message' => 'Too many login or submission attempts from your IP. Please wait 1 minute and try again.',
            ]);
        } else {
            echo axRenderSecurityBlockPage(
                'Too Many Attempts (Rate Limited)',
                'Cloudflare Security detected too many rapid login attempts from your IP address (' . htmlspecialchars($remoteIp) . '). Please wait 60 seconds and try again.'
            );
        }
        exit;
    }

    // 4. Honeypot Bot Trap Check (bots auto-fill hidden fields)
    if (!empty($_POST['ax_website_hp_trap'])) {
        http_response_code(403);
        if ($isJsonOrApi) {
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'status'  => 'error',
                'message' => 'Automated bot submission blocked by Cloudflare security.',
            ]);
        } else {
            echo axRenderSecurityBlockPage('Bot Activity Blocked', 'Automated bot submission was blocked.');
        }
        exit;
    }

    // 5. Extract Cloudflare Turnstile Token from POST, Header, or JSON body
    $token = '';
    if (!empty($_POST['cf-turnstile-response'])) {
        $token = trim((string) $_POST['cf-turnstile-response']);
    } elseif (!empty($_SERVER['HTTP_X_CF_TURNSTILE_RESPONSE'])) {
        $token = trim((string) $_SERVER['HTTP_X_CF_TURNSTILE_RESPONSE']);
    } elseif (str_contains($contentType, 'application/json')) {
        $rawBody = file_get_contents('php://input');
        if (is_string($rawBody) && $rawBody !== '') {
            $jsonBody = @json_decode($rawBody, true);
            if (is_array($jsonBody)) {
                $token = trim((string) ($jsonBody['cf-turnstile-response'] ?? $jsonBody['cf_turnstile_response'] ?? ''));
            }
        }
    }

    if (!axVerifyTurnstileToken($token, $remoteIp)) {
        http_response_code(403);
        if ($isJsonOrApi) {
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'status'  => 'error',
                'message' => 'Cloudflare security check is required. Please verify you are human and try again.',
            ]);
        } else {
            echo axRenderSecurityBlockPage(
                'Security Verification Required',
                'Please complete the Cloudflare "Verify you are human" security check on the form before submitting.'
            );
        }
        exit;
    }
}

/**
 * Clean HTML error page if a bot or user submits a traditional form without completing Turnstile.
 */
function axRenderSecurityBlockPage(string $title, string $message): string
{
    $safeTitle = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    $safeMsg = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
    return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{$safeTitle} — Cloudflare Security</title>
  <style>
    body { margin:0; font-family: system-ui, -apple-system, sans-serif; background:#0f172a; color:#f8fafc; display:flex; align-items:center; justify-content:center; min-height:100vh; padding:1.25rem; box-sizing:border-box; }
    .card { background:#1e293b; border:1px solid rgba(255,255,255,0.12); border-radius:16px; max-width:440px; width:100%; padding:2rem 1.75rem; text-align:center; box-shadow:0 20px 45px rgba(0,0,0,0.45); }
    .shield { width:56px; height:56px; border-radius:14px; background:rgba(234,88,12,0.15); color:#f97316; display:inline-flex; align-items:center; justify-content:center; font-size:28px; margin-bottom:1rem; }
    h1 { font-size:1.3rem; margin:0 0 0.65rem; color:#fff; }
    p { font-size:0.95rem; line-height:1.6; color:#94a3b8; margin:0 0 1.5rem; }
    .btn { display:inline-block; background:#ea580c; color:#fff; text-decoration:none; font-weight:700; font-size:0.95rem; padding:0.75rem 1.5rem; border-radius:10px; border:none; cursor:pointer; }
    .btn:hover { background:#c2410c; }
  </style>
</head>
<body>
  <div class="card">
    <div class="shield">&#128737;</div>
    <h1>{$safeTitle}</h1>
    <p>{$safeMsg}</p>
    <button class="btn" onclick="window.history.back()">Go Back &amp; Try Again</button>
  </div>
</body>
</html>
HTML;
}

/**
 * Build client-side JS that automatically injects Cloudflare Turnstile into login,
 * registration, and contact forms (both Blade HTML forms and React SPAs).
 */
function axBuildCloudflareClientScript(string $siteKey): string
{
    $siteKeyJson = json_encode($siteKey);
    return <<<JS
(function () {
  if (window.__axCloudflareProtectLoaded) return;
  window.__axCloudflareProtectLoaded = true;

  var SITE_KEY = {$siteKeyJson};
  window.__axTurnstileToken = '';
  var activeWidgets = [];
  var turnstileScriptFailed = false;

  // 1. Load Cloudflare Turnstile API script
  var s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  s.async = true;
  s.defer = true;
  s.onerror = function () {
    turnstileScriptFailed = true;
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      window.__axTurnstileToken = 'ax-local-offline-bypass';
      document.querySelectorAll('input[name="cf-turnstile-response"]').forEach(function (inp) {
        inp.value = 'ax-local-offline-bypass';
      });
    }
  };
  document.head.appendChild(s);

  function isAuthOrContactForm(form) {
    if (!form || form.tagName !== 'FORM') return false;
    if (form.dataset.axNoTurnstile === 'true') return false;

    var id = (form.id || '').toLowerCase();
    var action = (form.getAttribute('action') || '').toLowerCase();
    var pagePath = (window.location.pathname || '').toLowerCase();

    if (id === 'contact-form') return true;
    if (/(login|register|signup|contact\.php)/.test(action)) return true;

    // Any form containing a password field on a login/register/auth screen
    var pwdInputs = form.querySelectorAll('input[type="password"]');
    if (pwdInputs.length > 0 && pwdInputs.length <= 2) {
      if (/(login|register|signup|auth|portal)/.test(pagePath) || action === '' || /(login|register)/.test(action)) {
        // Exclude password change forms inside settings where there are 3 password inputs (current, new, confirm)
        return true;
      }
    }
    return false;
  }

  function isLocalEnv() {
    return (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  }

  function setFormButtonsLocked(form, locked, reason) {
    if (!form) return;
    if (isLocalEnv()) return;
    var btns = form.querySelectorAll('button[type="submit"], input[type="submit"]');
    btns.forEach(function (btn) {
      if (locked) {
        btn.disabled = true;
        btn.dataset.axTurnstileLocked = 'true';
        btn.style.opacity = '0.55';
        btn.style.cursor = 'not-allowed';
        if (reason) btn.setAttribute('title', reason);
      } else {
        if (btn.dataset.axTurnstileLocked === 'true') {
          btn.disabled = false;
          delete btn.dataset.axTurnstileLocked;
          btn.style.opacity = '';
          btn.style.cursor = '';
          btn.removeAttribute('title');
        }
      }
    });
  }

  function renderWidgetInContainer(container, hiddenInput, form) {
    if (!window.turnstile || typeof window.turnstile.render !== 'function') {
      if (turnstileScriptFailed && isLocalEnv()) {
        window.__axTurnstileToken = 'ax-local-offline-bypass';
        if (hiddenInput) hiddenInput.value = 'ax-local-offline-bypass';
        setFormButtonsLocked(form, false);
      } else {
        setTimeout(function () { renderWidgetInContainer(container, hiddenInput, form); }, 250);
      }
      return;
    }

    if (container.dataset.rendered === 'true') return;
    container.dataset.rendered = 'true';

    try {
      var widgetId = window.turnstile.render(container, {
        sitekey: SITE_KEY,
        theme: 'auto',
        callback: function (token) {
          window.__axTurnstileToken = token;
          if (hiddenInput) hiddenInput.value = token;
          setFormButtonsLocked(form, false);
        },
        'expired-callback': function () {
          window.__axTurnstileToken = '';
          if (hiddenInput) hiddenInput.value = '';
          setFormButtonsLocked(form, true, 'Cloudflare security check expired. Verifying again...');
        },
        'error-callback': function () {
          if (isLocalEnv()) {
            window.__axTurnstileToken = 'ax-local-offline-bypass';
            if (hiddenInput) hiddenInput.value = 'ax-local-offline-bypass';
            setFormButtonsLocked(form, false);
          }
        }
      });
      activeWidgets.push({ id: widgetId, input: hiddenInput, form: form });
    } catch (e) {}
  }

  function resetAllWidgets() {
    if (!window.turnstile || typeof window.turnstile.reset !== 'function') return;
    activeWidgets.forEach(function (w) {
      try {
        window.turnstile.reset(w.id);
        if (w.form) {
          setFormButtonsLocked(w.form, true, 'Refreshing security check...');
        }
      } catch (e) {}
    });
  }

  function enhanceForms() {
    var forms = document.querySelectorAll('form');
    forms.forEach(function (form) {
      if (form.dataset.axTurnstileBound === 'true') {
        // If already bound, ensure button status matches token status
        if (window.__axTurnstileToken) {
          setFormButtonsLocked(form, false);
        }
        return;
      }
      if (!isAuthOrContactForm(form)) return;

      form.dataset.axTurnstileBound = 'true';

      // Keep submit buttons inactive until Cloudflare Turnstile finishes scanning
      if (!isLocalEnv() && !window.__axTurnstileToken) {
        setFormButtonsLocked(form, true, 'Cloudflare security verification in progress... Button will activate once verified.');
      }

      // Inject hidden honeypot trap for bots
      var hp = document.createElement('input');
      hp.type = 'text';
      hp.name = 'ax_website_hp_trap';
      hp.tabIndex = -1;
      hp.autocomplete = 'off';
      hp.style.cssText = 'position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;';
      form.appendChild(hp);

      // Ensure a hidden input exists for standard HTML form submissions
      var hiddenInput = form.querySelector('input[name="cf-turnstile-response"]');
      if (!hiddenInput) {
        hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.name = 'cf-turnstile-response';
        form.appendChild(hiddenInput);
      }

      // Create visual container for Cloudflare Turnstile widget above the submit button
      var wrapper = document.createElement('div');
      wrapper.className = 'ax-cf-turnstile-wrap';
      wrapper.style.cssText = 'margin: 12px 0; display: flex; justify-content: center; width: 100%; overflow: hidden;';

      var widgetDiv = document.createElement('div');
      wrapper.appendChild(widgetDiv);

      var submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn && submitBtn.parentNode) {
        submitBtn.parentNode.insertBefore(wrapper, submitBtn);
      } else {
        form.appendChild(wrapper);
      }

      // Capture submit to guarantee form is never submitted prematurely
      form.addEventListener('submit', function (e) {
        if (isLocalEnv()) return;
        var token = window.__axTurnstileToken || (hiddenInput ? hiddenInput.value : '');
        if (!token) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof e.stopImmediatePropagation === 'function') {
            e.stopImmediatePropagation();
          }
          wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
          wrapper.style.transition = 'box-shadow 0.3s ease';
          wrapper.style.boxShadow = '0 0 0 3px rgba(249, 115, 22, 0.55)';
          setTimeout(function () { wrapper.style.boxShadow = 'none'; }, 2000);
          return false;
        }
      }, true);

      renderWidgetInContainer(widgetDiv, hiddenInput, form);
    });
  }

  // 2. Intercept fetch() for React SPAs (TradeDesk POS, BizBooks) & AJAX forms (contact.php)
  var origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      var method = (init && init.method ? init.method : (input && input.method ? input.method : 'GET')).toUpperCase();

      if (method === 'POST' && /(login|register|signup|contact\.php)/i.test(url)) {
        init = Object.assign({}, init || {});
        var headers = new Headers(init.headers || {});
        if (window.__axTurnstileToken && !headers.has('X-CF-Turnstile-Response')) {
          headers.set('X-CF-Turnstile-Response', window.__axTurnstileToken);
        }
        init.headers = headers;

        return origFetch.call(this, input, init).then(function (res) {
          // Reset single-use Turnstile token if login failed so user can retry immediately
          if (!res.ok) {
            setTimeout(resetAllWidgets, 300);
          }
          return res;
        });
      }
      return origFetch.call(this, input, init);
    };
  }

  // 3. Intercept XMLHttpRequest (for axios-based SPAs like BizBooks)
  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__axMethod = (method || 'GET').toUpperCase();
    this.__axUrl = String(url || '');
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    if (this.__axMethod === 'POST' && /(login|register|signup|contact\.php)/i.test(this.__axUrl)) {
      if (window.__axTurnstileToken) {
        try {
          this.setRequestHeader('X-CF-Turnstile-Response', window.__axTurnstileToken);
        } catch (e) {}
      }
      this.addEventListener('loadend', function () {
        if (this.status >= 400) {
          setTimeout(resetAllWidgets, 300);
        }
      });
    }
    return origSend.apply(this, arguments);
  };

  // Observe DOM for dynamically mounted React login/register forms
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhanceForms);
  } else {
    enhanceForms();
  }

  var observer = new MutationObserver(function () {
    enhanceForms();
  });
  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true
  });
})();
JS;
}

// Allow direct script inclusion via <script src="cloudflare-security.php?js=1" defer></script>
if (isset($_GET['js']) && basename($_SERVER['SCRIPT_FILENAME'] ?? '') === 'cloudflare-security.php') {
    header('Content-Type: application/javascript; charset=utf-8');
    header('Cache-Control: no-cache, must-revalidate');
    echo axBuildCloudflareClientScript(AX_CF_TURNSTILE_SITE_KEY);
    exit;
}

