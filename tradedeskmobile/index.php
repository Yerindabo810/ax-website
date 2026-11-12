<?php

/**
 * TradeDesk Mobile — Standalone Cloud Backend Entry Point (/tradedeskmobile/api/*)
 * Dedicated Database: axtechno_tradedesk-mobile
 * Completely isolated from the TradeDesk Web App (axtechno_tradedesk).
 */

declare(strict_types=1);

use TradeDeskMobile\Database;
use TradeDeskMobile\SmtpMailer;
use TradeDeskMobile\MarzPayService;
use TradeDeskMobile\AdminDashboard;

// CORS Headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept, X-Requested-With');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function jsonResponse(array $payload, int $status = 200): void
{
    header('Content-Type: application/json; charset=utf-8', true);
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

// Catch any fatal errors so the API always outputs JSON instead of a blank 500
register_shutdown_function(static function (): void {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode([
            'status' => 'error',
            'success' => false,
            'message' => 'Server Error: ' . $err['message'],
            'file' => basename($err['file']),
            'line' => $err['line'],
        ]);
    }
});

try {
    $config = require __DIR__ . '/config.php';
    date_default_timezone_set($config['app']['timezone'] ?? 'Africa/Kampala');

    require_once __DIR__ . '/src/Database.php';
    require_once __DIR__ . '/src/SmtpMailer.php';
    require_once __DIR__ . '/src/MarzPayService.php';
    require_once __DIR__ . '/src/AdminDashboard.php';

    function getRequestBody(): array
    {
        $raw = file_get_contents('php://input');
        if ($raw) {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                return array_merge($_GET, $_POST, $decoded);
            }
        }
        return array_merge($_GET, $_POST);
    }

    function getBearerToken(): ?string
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        if (!$header && function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            $header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        }
        if (preg_match('/Bearer\s+(.+)/i', trim((string) $header), $m)) {
            return trim($m[1]);
        }
        return null;
    }

    function maskEmailAddress(string $email): string
    {
        $parts = explode('@', $email);
        $name = $parts[0] ?? '';
        $domain = $parts[1] ?? '';
        $masked = strlen($name) <= 2
            ? substr($name, 0, 1) . '***'
            : substr($name, 0, 2) . '***' . substr($name, -1);
        return $masked . '@' . $domain;
    }

    function formatBusinessPayload(array $biz): array
    {
        return [
            'id' => (int) $biz['id'],
            'name' => $biz['name'],
            'subdomain' => $biz['subdomain'],
            'category' => $biz['category'],
            'location' => $biz['location'],
            'phone' => $biz['phone'],
            'currency' => $biz['currency'] ?? 'UGX',
            'tin_number' => $biz['tin_number'] ?? null,
            'logo_url' => $biz['logo_url'] ?? null,
            'plan' => $biz['plan'] ?? 'free_trial',
            'trial_ends_at' => $biz['trial_ends_at'] ?? null,
            'subscription_expires_at' => $biz['subscription_expires_at'] ?? null,
            'wallet_balance' => (float) ($biz['wallet_balance'] ?? 0),
            'status' => $biz['status'] ?? 'active',
            'branches' => [
                [
                    'id' => '1',
                    'name' => $biz['name'] . ' (Mobile Solo Shop)',
                    'code' => 'SOLO-01',
                    'category' => $biz['category'],
                    'location' => $biz['location'],
                    'phone' => $biz['phone'],
                    'tills' => 1,
                    'manager' => 'Shop Owner',
                    'status' => 'Active',
                ],
            ],
        ];
    }

    function formatUserPayload(array $user, ?array $biz = null): array
    {
        return [
            'id' => (int) $user['id'],
            'business_id' => (int) $user['business_id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'phone' => $user['phone'],
            'role' => $user['role'] ?? 'owner',
            'branch_id' => '1',
            'branch' => $biz ? [
                'id' => '1',
                'name' => $biz['name'] . ' (Mobile Solo Shop)',
                'code' => 'SOLO-01',
                'location' => $biz['location'],
            ] : null,
            'assigned_till' => 'TILL-01',
            'status' => $user['status'] ?? 'Active',
            'permissions' => ['*'],
            'two_factor_enabled' => (bool) ($user['two_factor_enabled'] ?? false),
        ];
    }

    // Parse request path relative to /tradedeskmobile
    $scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/tradedeskmobile/index.php')), '/');
    $requestPath = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
    $relPath = ltrim(substr($requestPath, strlen($scriptDir)), '/');
    if (str_starts_with(strtolower($relPath), 'api/')) {
        $route = substr($relPath, 4);
    } elseif (strtolower($relPath) === 'api') {
        $route = '';
    } else {
        $route = $relPath;
    }
    $route = trim($route, '/');
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $input = getRequestBody();

    $pdo = Database::getConnection($config['db']);
    $mailer = new SmtpMailer($config['mail']);
    $marzpay = new MarzPayService($config['marzpay'], $pdo);

    // Helper to resolve authenticated user from Bearer token
    $requireAuthUser = static function () use ($pdo): array {
        $token = getBearerToken();
        if (!$token) {
            jsonResponse(['success' => false, 'message' => 'Unauthenticated. Please sign in to TradeDesk Mobile Cloud.'], 401);
        }
        $stmt = $pdo->prepare("SELECT * FROM mobile_users WHERE api_token = ? LIMIT 1");
        $stmt->execute([$token]);
        $user = $stmt->fetch();
        if (!$user) {
            try {
                $tStmt = $pdo->prepare("SELECT u.* FROM mobile_user_tokens mt JOIN mobile_users u ON mt.user_id = u.id WHERE mt.token = ? LIMIT 1");
                $tStmt->execute([$token]);
                $user = $tStmt->fetch();
            } catch (\Throwable $e) {}
        }
        if (!$user) {
            jsonResponse(['success' => false, 'message' => 'Session expired or invalid token. Please sign in again.'], 401);
        }

        // Live Presence Tracking: Update user's last_seen_at timestamp & IP address
        try {
            $clientIp = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? null;
            $pdo->prepare("UPDATE mobile_users SET last_seen_at = NOW(), last_ip = ? WHERE id = ?")
                ->execute([$clientIp, (int) $user['id']]);
        } catch (\Throwable $e) {}

        $bStmt = $pdo->prepare("SELECT * FROM mobile_businesses WHERE id = ? LIMIT 1");
        $bStmt->execute([$user['business_id']]);
        $biz = $bStmt->fetch() ?: [];
        return [$user, $biz];
    };

    // ============================================================================
    // 0. ADMIN WEB PORTAL ROUTING (axtechnologies.net/tradedeskmobile/)
    // ============================================================================
    $adminDashboard = new AdminDashboard($pdo, $mailer, $config);
    if ($adminDashboard->handle($route, $method, $input)) {
        exit;
    }

    // Health / API status fallback (for JSON monitoring tools)
    if ($route === 'health' || $route === 'status' || $route === 'api') {
        jsonResponse([
            'status' => 'online',
            'success' => true,
            'service' => 'TradeDesk API',
        ]);
    }

    // ============================================================================
    // IN-APP NOTIFICATIONS PULL (PULLED BY USER APP UPON CONNECTING TO INTERNET)
    // ============================================================================
    if (($route === 'notifications/pull' || $route === 'pos/notifications/pull') && $method === 'GET') {
        [$user, $biz] = $requireAuthUser();
        $userId = (int) $user['id'];
        $bizId = (int) ($user['business_id'] ?? 0);

        $stmt = $pdo->prepare("
            SELECT n.*
            FROM mobile_broadcast_notifications n
            WHERE (n.business_id IS NULL OR n.business_id = ?)
              AND (n.user_id IS NULL OR n.user_id = ?)
              AND n.id NOT IN (
                  SELECT notification_id FROM mobile_notification_deliveries WHERE user_id = ?
              )
            ORDER BY n.id ASC
            LIMIT 50
        ");
        $stmt->execute([$bizId, $userId, $userId]);
        $pending = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (!empty($pending)) {
            $insDeliv = $pdo->prepare("INSERT IGNORE INTO mobile_notification_deliveries (notification_id, user_id) VALUES (?, ?)");
            foreach ($pending as $p) {
                try {
                    $insDeliv->execute([$p['id'], $userId]);
                } catch (\Throwable $e) {}
            }
        }

        jsonResponse([
            'status' => 'success',
            'count' => count($pending),
            'data' => $pending,
        ]);
    }

    // ============================================================================
    // PUSH NOTIFICATION TOKEN REGISTRATION
    // ============================================================================
    if (($route === 'users/push-token' || $route === 'api/users/push-token' || $route === 'pos/users/push-token') && $method === 'POST') {
        [$user, $biz] = $requireAuthUser();
        $userId = (int) $user['id'];
        $pushToken = trim((string) ($input['push_token'] ?? ''));
        $platform = trim((string) ($input['platform'] ?? 'android'));

        if (!empty($pushToken)) {
            $stmt = $pdo->prepare("UPDATE mobile_users SET push_token = ?, push_platform = ? WHERE id = ?");
            $stmt->execute([$pushToken, $platform, $userId]);
        }

        jsonResponse([
            'status' => 'success',
            'message' => 'Device push token successfully registered',
        ]);
    }

    // ============================================================================
    // 1. AUTHENTICATION & ONBOARDING ROUTES (/auth/*)
    // ============================================================================

    // GET /auth/check-email
    if ($route === 'auth/check-email' && $method === 'GET') {
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['message' => 'Please enter a valid email address.'], 422);
        }

        $stmt = $pdo->prepare("
            SELECT u.id, b.subdomain, b.name AS business_name
            FROM mobile_users u
            LEFT JOIN mobile_businesses b ON b.id = u.business_id
            WHERE u.email = ?
            LIMIT 1
        ");
        $stmt->execute([$email]);
        $row = $stmt->fetch();

        if ($row) {
            jsonResponse([
                'exists' => true,
                'message' => 'This email already has an active TradeDesk Mobile account.',
                'subdomain' => $row['subdomain'],
                'business_name' => $row['business_name'],
            ]);
        }

        jsonResponse([
            'exists' => false,
            'message' => 'Email is available.',
        ]);
    }

    // POST /auth/send-otp
    if ($route === 'auth/send-otp' && $method === 'POST') {
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['success' => false, 'message' => 'Please provide a valid email address.'], 422);
        }

        $chk = $pdo->prepare("SELECT id FROM mobile_users WHERE email = ? LIMIT 1");
        $chk->execute([$email]);
        if ($chk->fetch()) {
            jsonResponse([
                'success' => false,
                'message' => 'This email is already registered on TradeDesk Mobile. Please sign in instead.',
            ], 409);
        }

        $otp = (string) random_int(100000, 999999);
        $expiresAt = date('Y-m-d H:i:s', time() + 15 * 60);

        $ins = $pdo->prepare("INSERT INTO mobile_email_otps (email, otp, expires_at, is_used) VALUES (?, ?, ?, 0)");
        $ins->execute([$email, $otp, $expiresAt]);

        $year = date('Y');
        $html = "
        <div style='font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;'>
            <div style='text-align: center; margin-bottom: 20px;'>
                <h2 style='color: #0b4fb8; margin: 0;'>Trade<span style='color: #f26a0e;'>Desk</span> Mobile</h2>
                <p style='color: #64748b; font-size: 14px; margin-top: 4px;'>Solo POS &amp; Shop Management App</p>
            </div>
            <p style='color: #1e293b; font-size: 16px; line-height: 1.5;'>Hello,</p>
            <p style='color: #1e293b; font-size: 15px; line-height: 1.5;'>Your 6-digit email verification code for <strong>TradeDesk Mobile</strong> account setup is:</p>
            <div style='text-align: center; margin: 28px 0;'>
                <span style='display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0a2a66; background: #f1f5f9; padding: 12px 28px; border-radius: 8px; border: 1px dashed #cbd5e1;'>{$otp}</span>
            </div>
            <p style='color: #64748b; font-size: 13px; line-height: 1.4;'>This code expires in 15 minutes. If you did not request this code, please ignore this email.</p>
            <hr style='border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;' />
            <p style='text-align: center; font-size: 12px; color: #94a3b8; margin: 0;'>&copy; {$year} TradeDesk Mobile &bull; AX Technologies Uganda.</p>
        </div>";

        $plain = "TradeDesk Mobile - Account Verification\n\nYour email verification code is: {$otp}\n\nThis code expires in 15 minutes.";
        $sent = $mailer->send($email, "{$otp} is your TradeDesk Mobile Verification Code", $html, $plain);

        if (!$sent) {
            jsonResponse([
                'success' => false,
                'message' => 'Failed to send verification email. Please check your internet connection.',
            ], 500);
        }

        jsonResponse([
            'success' => true,
            'message' => 'Verification code sent to ' . $email,
        ]);
    }

    // POST /auth/verify-otp
    if ($route === 'auth/verify-otp' && $method === 'POST') {
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $otp = trim((string) ($input['otp'] ?? ''));

        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($otp) !== 6) {
            jsonResponse(['success' => false, 'message' => 'Please enter a valid 6-digit verification code.'], 422);
        }

        $stmt = $pdo->prepare("
            SELECT id FROM mobile_email_otps
            WHERE email = ? AND otp = ? AND is_used = 0 AND expires_at > NOW()
            ORDER BY id DESC LIMIT 1
        ");
        $stmt->execute([$email, $otp]);
        $record = $stmt->fetch();

        if (!$record) {
            jsonResponse([
                'success' => false,
                'message' => 'Invalid or expired verification code.',
            ], 422);
        }

        $upd = $pdo->prepare("UPDATE mobile_email_otps SET is_used = 1 WHERE id = ?");
        $upd->execute([$record['id']]);

        jsonResponse([
            'success' => true,
            'message' => 'Email verified successfully.',
        ]);
    }

    // POST /auth/forgot-password
    if ($route === 'auth/forgot-password' && $method === 'POST') {
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['success' => false, 'message' => 'Please provide a valid email address.'], 422);
        }

        $uStmt = $pdo->prepare("SELECT id, name FROM mobile_users WHERE email = ? LIMIT 1");
        $uStmt->execute([$email]);
        $user = $uStmt->fetch();

        if (!$user) {
            jsonResponse(['success' => false, 'message' => 'No account found with this email address.'], 404);
        }

        $otp = (string) random_int(100000, 999999);
        $expiresAt = date('Y-m-d H:i:s', time() + 15 * 60);

        $pdo->prepare("INSERT INTO mobile_email_otps (email, otp, expires_at, is_used) VALUES (?, ?, ?, 0)")
            ->execute([$email, $otp, $expiresAt]);

        $year = date('Y');
        $userName = htmlspecialchars($user['name'] ?: 'Shop Owner');
        $html = "
        <div style='font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;'>
            <div style='text-align: center; margin-bottom: 20px;'>
                <h2 style='color: #0b4fb8; margin: 0;'>Trade<span style='color: #f26a0e;'>Desk</span> Mobile</h2>
                <p style='color: #64748b; font-size: 14px; margin-top: 4px;'>Password Reset Request</p>
            </div>
            <p style='color: #1e293b; font-size: 16px; line-height: 1.5;'>Hello {$userName},</p>
            <p style='color: #1e293b; font-size: 15px; line-height: 1.5;'>We received a request to reset your password for your <strong>TradeDesk Mobile</strong> account.</p>
            <p style='color: #1e293b; font-size: 15px;'>Your 6-digit password reset verification code is:</p>
            <div style='text-align: center; margin: 28px 0;'>
                <span style='display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #b91c1c; background: #fef2f2; padding: 12px 28px; border-radius: 8px; border: 1px dashed #fca5a5;'>{$otp}</span>
            </div>
            <p style='color: #64748b; font-size: 13px; line-height: 1.4;'>This code expires in 15 minutes. If you did not request a password reset, please ignore this email or contact support immediately.</p>
            <hr style='border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;' />
            <p style='text-align: center; font-size: 12px; color: #94a3b8; margin: 0;'>&copy; {$year} TradeDesk Mobile &bull; AX Technologies Uganda.</p>
        </div>";

        $plain = "TradeDesk Mobile - Password Reset\n\nYour password reset code is: {$otp}\n\nThis code expires in 15 minutes.";
        $sent = $mailer->send($email, "{$otp} is your TradeDesk Mobile Password Reset Code", $html, $plain);

        if (!$sent) {
            jsonResponse(['success' => false, 'message' => 'Failed to send reset email. Please try again.'], 500);
        }

        jsonResponse([
            'success' => true,
            'message' => 'Password reset code sent to ' . $email,
        ]);
    }

    // POST /auth/reset-password
    if ($route === 'auth/reset-password' && $method === 'POST') {
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $otp = trim((string) ($input['otp'] ?? ''));
        $newPassword = (string) ($input['new_password'] ?? '');

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['success' => false, 'message' => 'Please provide a valid email address.'], 422);
        }
        if (strlen($otp) !== 6) {
            jsonResponse(['success' => false, 'message' => 'Please enter the 6-digit verification code.'], 422);
        }
        if (strlen($newPassword) < 6) {
            jsonResponse(['success' => false, 'message' => 'New password must be at least 6 characters long.'], 422);
        }

        $oStmt = $pdo->prepare("
            SELECT id FROM mobile_email_otps
            WHERE email = ? AND otp = ? AND is_used = 0 AND expires_at >= NOW()
            ORDER BY id DESC LIMIT 1
        ");
        $oStmt->execute([$email, $otp]);
        $rec = $oStmt->fetch();

        if (!$rec) {
            jsonResponse(['success' => false, 'message' => 'Invalid or expired verification code.'], 422);
        }

        $uStmt = $pdo->prepare("SELECT id FROM mobile_users WHERE email = ? LIMIT 1");
        $uStmt->execute([$email]);
        $user = $uStmt->fetch();

        if (!$user) {
            jsonResponse(['success' => false, 'message' => 'No account found with this email address.'], 404);
        }

        $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
        $pdo->prepare("UPDATE mobile_users SET password = ?, updated_at = NOW() WHERE id = ?")
            ->execute([$newHash, $user['id']]);

        $pdo->prepare("UPDATE mobile_email_otps SET is_used = 1 WHERE id = ?")
            ->execute([$rec['id']]);

        jsonResponse([
            'success' => true,
            'message' => 'Your password has been reset successfully. Please sign in with your new password.',
        ]);
    }

    // GET /auth/check-subdomain
    if ($route === 'auth/check-subdomain' && $method === 'GET') {
        $sub = strtolower(trim((string) ($input['subdomain'] ?? '')));
        if (!preg_match('/^[a-z0-9-]{3,30}$/', $sub)) {
            jsonResponse(['available' => false, 'message' => 'Subdomain must be 3-30 lowercase letters, numbers, or hyphens.'], 422);
        }

        $reserved = ['admin', 'api', 'app', 'pos', 'mail', 'www', 'root', 'support', 'help', 'mobile'];
        if (in_array($sub, $reserved, true)) {
            jsonResponse(['available' => false, 'message' => 'This subdomain is reserved.'], 422);
        }

        $stmt = $pdo->prepare("SELECT id FROM mobile_businesses WHERE subdomain = ? LIMIT 1");
        $stmt->execute([$sub]);
        $exists = (bool) $stmt->fetch();

        jsonResponse([
            'available' => !$exists,
            'subdomain' => $sub,
            'message' => $exists ? 'Subdomain already taken' : 'Subdomain is available',
        ]);
    }

    // POST /auth/register-store
    if ($route === 'auth/register-store' && $method === 'POST') {
        $businessName = trim((string) ($input['business_name'] ?? ''));
        $subdomain = strtolower(trim((string) ($input['subdomain'] ?? '')));
        $category = trim((string) ($input['category'] ?? 'Retail Shop'));
        $location = trim((string) ($input['location'] ?? 'Kampala, Uganda'));
        $phone = trim((string) ($input['phone'] ?? ''));
        $currency = strtoupper(trim((string) ($input['currency'] ?? 'UGX')));
        $tinNumber = trim((string) ($input['tin_number'] ?? ''));
        $userName = trim((string) ($input['user_name'] ?? ''));
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $password = (string) ($input['password'] ?? '');
        $firebaseUid = trim((string) ($input['firebase_uid'] ?? ''));
        $authProvider = in_array(($input['auth_provider'] ?? 'email'), ['email', 'google'], true)
            ? $input['auth_provider']
            : 'email';

        if ($businessName === '' || $userName === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['success' => false, 'message' => 'Business name, owner name, and valid email are required.'], 422);
        }

        if ($authProvider === 'email') {
            $vCheck = $pdo->prepare("SELECT id FROM mobile_email_otps WHERE email = ? AND is_used = 1 AND created_at > (NOW() - INTERVAL 2 HOUR) ORDER BY id DESC LIMIT 1");
            $vCheck->execute([$email]);
            if (!$vCheck->fetch()) {
                jsonResponse(['success' => false, 'message' => 'Please verify your email address with the 6-digit verification code before registering.'], 403);
            }
        }

        if ($subdomain === '') {
            $subdomain = strtolower(preg_replace('/[^a-z0-9]/i', '', $businessName));
            if (strlen($subdomain) < 3) {
                $subdomain .= 'shop';
            }
            $subdomain = substr($subdomain, 0, 24);
        }

        // Ensure unique subdomain
        $baseSub = $subdomain;
        $counter = 1;
        while (true) {
            $sChk = $pdo->prepare("SELECT id FROM mobile_businesses WHERE subdomain = ? LIMIT 1");
            $sChk->execute([$subdomain]);
            if (!$sChk->fetch()) {
                break;
            }
            $subdomain = $baseSub . $counter;
            $counter++;
        }

        // Check duplicate email
        $uChk = $pdo->prepare("SELECT id FROM mobile_users WHERE email = ? LIMIT 1");
        $uChk->execute([$email]);
        if ($uChk->fetch()) {
            jsonResponse(['success' => false, 'message' => 'This email is already registered. Please sign in instead.'], 422);
        }

        $trialEndsAt = date('Y-m-d H:i:s', time() + 30 * 86400);
        $insBiz = $pdo->prepare("
            INSERT INTO mobile_businesses
            (name, subdomain, category, location, phone, currency, tin_number, plan, trial_ends_at, wallet_balance, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'free_trial', ?, 0.00, 'active')
        ");
        $insBiz->execute([
            $businessName,
            $subdomain,
            $category,
            $location,
            $phone ?: null,
            $currency ?: 'UGX',
            $tinNumber ?: null,
            $trialEndsAt,
        ]);
        $businessId = (int) $pdo->lastInsertId();

        $hashedPassword = password_hash($password !== '' ? $password : bin2hex(random_bytes(8)), PASSWORD_BCRYPT);
        $apiToken = bin2hex(random_bytes(32));

        $insUser = $pdo->prepare("
            INSERT INTO mobile_users
            (business_id, name, email, phone, password, firebase_uid, auth_provider, role, two_factor_enabled, is_verified, api_token, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'owner', 0, 1, ?, 'Active')
        ");
        $insUser->execute([
            $businessId,
            $userName,
            $email,
            $phone ?: null,
            $hashedPassword,
            $firebaseUid ?: null,
            $authProvider,
            $apiToken,
        ]);
        $userId = (int) $pdo->lastInsertId();

        $bStmt = $pdo->prepare("SELECT * FROM mobile_businesses WHERE id = ?");
        $bStmt->execute([$businessId]);
        $bizRow = $bStmt->fetch();

        $uStmt = $pdo->prepare("SELECT * FROM mobile_users WHERE id = ?");
        $uStmt->execute([$userId]);
        $userRow = $uStmt->fetch();

        // Send Welcome Email
        $year = date('Y');
        $welcomeHtml = "
        <div style='font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 26px; border: 1px solid #e2e8f0; border-radius: 14px; background: #ffffff;'>
            <div style='text-align: center; margin-bottom: 20px;'>
                <h2 style='color: #0b4fb8; margin: 0;'>Trade<span style='color: #f26a0e;'>Desk</span> Mobile</h2>
                <p style='color: #64748b; font-size: 13px; margin-top: 4px;'>Standalone Android POS, Inventory &amp; Mobile Money</p>
            </div>
            <h3 style='color: #0a2a66; margin-top: 0;'>Welcome aboard, {$userName}! 🎉</h3>
            <p style='color: #334155; font-size: 14px; line-height: 1.6;'>
                Your shop <strong>{$businessName}</strong> is now registered on <strong>TradeDesk Mobile Cloud</strong> with a <strong>30-Day Free Trial</strong>.
                You can now accept live MTN &amp; Airtel Mobile Money payments, purchase Airtime/Data &amp; pay Yaka/NWSC bills, and back up your shop data to the cloud.
            </p>
            <div style='background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 20px 0; font-size: 13px;'>
                <div><strong>Shop Name:</strong> {$businessName}</div>
                <div style='margin-top: 6px;'><strong>Login Email:</strong> {$email}</div>
                " . ($phone ? "<div style='margin-top: 6px;'><strong>Login Phone:</strong> {$phone}</div>" : "") . "
                <div style='margin-top: 6px;'><strong>Free Trial Valid Until:</strong> " . date('d M Y', strtotime($trialEndsAt)) . "</div>
            </div>
            <hr style='border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;' />
            <p style='text-align: center; font-size: 12px; color: #94a3b8; margin: 0;'>&copy; {$year} TradeDesk Mobile &bull; AX Technologies Uganda.</p>
        </div>";
        $mailer->send($email, "Welcome to TradeDesk Mobile — {$businessName} is ready!", $welcomeHtml);

        jsonResponse([
            'success' => true,
            'message' => 'TradeDesk Mobile shop created successfully!',
            'token' => $apiToken,
            'user' => formatUserPayload($userRow, $bizRow),
            'business' => formatBusinessPayload($bizRow),
        ]);
    }

    // GET /auth/find-store
    if ($route === 'auth/find-store' && $method === 'GET') {
        $q = trim((string) ($input['query'] ?? ''));
        if (strlen($q) < 2) {
            jsonResponse(['success' => true, 'stores' => []]);
        }

        $like = "%{$q}%";
        $stmt = $pdo->prepare("
            SELECT DISTINCT b.*
            FROM mobile_businesses b
            LEFT JOIN mobile_users u ON u.business_id = b.id
            WHERE b.name LIKE ? OR b.subdomain LIKE ? OR b.phone LIKE ?
               OR u.email LIKE ? OR u.phone LIKE ? OR u.name LIKE ?
            LIMIT 6
        ");
        $stmt->execute([$like, $like, $like, $like, $like, $like]);
        $rows = $stmt->fetchAll();

        $stores = array_map(static function (array $b): array {
            return [
                'id' => (int) $b['id'],
                'name' => $b['name'],
                'subdomain' => $b['subdomain'],
                'category' => $b['category'],
                'location' => $b['location'],
                'phone' => $b['phone'],
                'branches_count' => 1,
                'logo_url' => $b['logo_url'],
            ];
        }, $rows);

        jsonResponse([
            'success' => true,
            'stores' => $stores,
        ]);
    }

    // POST /auth/portal-login & POST /auth/store-login
    if (($route === 'auth/portal-login' || $route === 'auth/store-login') && $method === 'POST') {
        $loginInput = trim((string) ($input['email'] ?? ''));
        $password = (string) ($input['password'] ?? '');
        $subdomain = strtolower(trim((string) ($input['subdomain'] ?? '')));

        if ($loginInput === '' || $password === '') {
            jsonResponse(['message' => 'Email/Phone and password are required.'], 422);
        }

        $cleanDigits = preg_replace('/\D/', '', $loginInput);

        if ($route === 'auth/store-login' && $subdomain !== '') {
            $bStmt = $pdo->prepare("SELECT * FROM mobile_businesses WHERE subdomain = ? LIMIT 1");
            $bStmt->execute([$subdomain]);
            $biz = $bStmt->fetch();
            if (!$biz) {
                jsonResponse(['message' => 'Shop not found on TradeDesk Mobile.'], 404);
            }

            $uStmt = $pdo->prepare("
                SELECT * FROM mobile_users
                WHERE business_id = ? AND (email = ? OR phone = ? OR (? <> '' AND REPLACE(REPLACE(phone, '+', ''), ' ', '') LIKE ?))
                LIMIT 1
            ");
            $uStmt->execute([
                $biz['id'],
                strtolower($loginInput),
                $loginInput,
                $cleanDigits,
                "%{$cleanDigits}%",
            ]);
            $user = $uStmt->fetch();
        } else {
            $uStmt = $pdo->prepare("
                SELECT * FROM mobile_users
                WHERE email = ? OR phone = ? OR (? <> '' AND REPLACE(REPLACE(phone, '+', ''), ' ', '') LIKE ?)
                LIMIT 1
            ");
            $uStmt->execute([
                strtolower($loginInput),
                $loginInput,
                $cleanDigits,
                "%{$cleanDigits}%",
            ]);
            $user = $uStmt->fetch();
            $biz = null;
            if ($user) {
                $bStmt = $pdo->prepare("SELECT * FROM mobile_businesses WHERE id = ? LIMIT 1");
                $bStmt->execute([$user['business_id']]);
                $biz = $bStmt->fetch();
            }
        }

        if (!$user || !password_verify($password, $user['password'])) {
            jsonResponse(['message' => 'Invalid email/phone or password.'], 401);
        }

        if (!$biz) {
            jsonResponse(['message' => 'Business profile not found for this account.'], 404);
        }

        // Check Two-Factor Authentication
        if ((int) ($user['two_factor_enabled'] ?? 0) === 1) {
            $otp = (string) random_int(100000, 999999);
            $expiresAt = date('Y-m-d H:i:s', time() + 10 * 60);
            $ins = $pdo->prepare("INSERT INTO mobile_email_otps (email, otp, expires_at, is_used) VALUES (?, ?, ?, 0)");
            $ins->execute([$user['email'], $otp, $expiresAt]);

            $html = "
            <div style='font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;'>
                <h2 style='color: #0b4fb8; margin: 0; text-align: center;'>Trade<span style='color: #f26a0e;'>Desk</span> Mobile</h2>
                <p style='color: #1e293b; font-size: 15px; margin-top: 16px;'>Hello <strong>{$user['name']}</strong>,</p>
                <p style='color: #475569; font-size: 14px;'>Your 6-digit Two-Factor Authentication login code for <strong>{$biz['name']}</strong> is:</p>
                <div style='text-align: center; margin: 24px 0;'>
                    <span style='display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0b4fb8; background: #eff6ff; padding: 12px 28px; border-radius: 8px;'>{$otp}</span>
                </div>
                <p style='color: #64748b; font-size: 12px;'>This code expires in 10 minutes.</p>
            </div>";
            $mailer->send($user['email'], "{$otp} is your TradeDesk Mobile login code", $html);

            $masked = maskEmailAddress($user['email']);
            jsonResponse([
                'success' => true,
                'requires_otp' => true,
                'email' => $user['email'],
                'masked_email' => $masked,
                'subdomain' => $biz['subdomain'],
                'message' => "Two-Factor Authentication is enabled. A 6-digit code was sent to {$masked}.",
            ]);
        }

        $apiToken = bin2hex(random_bytes(32));
        $upd = $pdo->prepare("UPDATE mobile_users SET api_token = ? WHERE id = ?");
        $upd->execute([$apiToken, $user['id']]);

        jsonResponse([
            'success' => true,
            'message' => 'Login successful!',
            'token' => $apiToken,
            'user' => formatUserPayload($user, $biz),
            'business' => formatBusinessPayload($biz),
            'subdomain' => $biz['subdomain'],
        ]);
    }

    // POST /auth/verify-login-otp
    if ($route === 'auth/verify-login-otp' && $method === 'POST') {
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $otp = trim((string) ($input['otp'] ?? ''));

        $stmt = $pdo->prepare("
            SELECT id FROM mobile_email_otps
            WHERE email = ? AND otp = ? AND is_used = 0 AND expires_at >= NOW()
            ORDER BY id DESC LIMIT 1
        ");
        $stmt->execute([$email, $otp]);
        $rec = $stmt->fetch();

        if (!$rec) {
            jsonResponse(['success' => false, 'message' => 'Invalid or expired verification code.'], 422);
        }

        $pdo->prepare("UPDATE mobile_email_otps SET is_used = 1 WHERE id = ?")->execute([$rec['id']]);

        $uStmt = $pdo->prepare("SELECT * FROM mobile_users WHERE email = ? LIMIT 1");
        $uStmt->execute([$email]);
        $user = $uStmt->fetch();
        if (!$user) {
            jsonResponse(['message' => 'User not found.'], 404);
        }

        $bStmt = $pdo->prepare("SELECT * FROM mobile_businesses WHERE id = ? LIMIT 1");
        $bStmt->execute([$user['business_id']]);
        $biz = $bStmt->fetch();

        $apiToken = bin2hex(random_bytes(32));
        $pdo->prepare("UPDATE mobile_users SET api_token = ? WHERE id = ?")->execute([$apiToken, $user['id']]);

        jsonResponse([
            'success' => true,
            'message' => 'Login verified successfully!',
            'token' => $apiToken,
            'user' => formatUserPayload($user, $biz),
            'business' => $biz ? formatBusinessPayload($biz) : null,
            'subdomain' => $biz['subdomain'] ?? null,
        ]);
    }

    // POST /auth/resend-login-otp
    if ($route === 'auth/resend-login-otp' && $method === 'POST') {
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $uStmt = $pdo->prepare("SELECT * FROM mobile_users WHERE email = ? LIMIT 1");
        $uStmt->execute([$email]);
        $user = $uStmt->fetch();
        if (!$user) {
            jsonResponse(['message' => 'Account not found with this email.'], 404);
        }

        $otp = (string) random_int(100000, 999999);
        $expiresAt = date('Y-m-d H:i:s', time() + 10 * 60);
        $pdo->prepare("INSERT INTO mobile_email_otps (email, otp, expires_at, is_used) VALUES (?, ?, ?, 0)")
            ->execute([$email, $otp, $expiresAt]);

        $mailer->send($email, "{$otp} is your TradeDesk Mobile login verification code", "<p>Your login verification code is: <strong>{$otp}</strong></p>");

        jsonResponse([
            'success' => true,
            'message' => 'A new 6-digit verification code has been sent to your email.',
        ]);
    }

    // GET /auth/google-oauth (Firebase Google Sign-In Popup / Redirect Bridge using google-services.json credentials)
    if ($route === 'auth/google-oauth' && $method === 'GET') {
        $sessionId = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($input['session_id'] ?? ''));
        $returnUrl = trim((string) ($input['return_url'] ?? 'tradedesk://google-auth'));
        header('Content-Type: text/html; charset=utf-8');
        echo '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Sign in with Google — TradeDesk MOBILE</title>
<script src="https://accounts.google.com/gsi/client" async defer></script>
<style>
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #061a42; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; box-sizing: border-box; }
  .card { background: #ffffff; color: #0d1526; max-width: 400px; width: 100%; border-radius: 22px; padding: 28px 24px; text-align: center; box-shadow: 0 24px 60px rgba(0,0,0,0.45); }
  .brand { font-size: 24px; font-weight: 900; color: #0a2a66; letter-spacing: -0.4px; }
  .brand span { color: #f26a0e; }
  .mobile-tag { font-size: 9px; font-weight: 900; color: #f26a0e; letter-spacing: 3.5px; margin-top: 2px; margin-bottom: 16px; }
  h2 { font-size: 18px; margin: 0 0 8px; color: #0d1526; }
  p { font-size: 13.5px; color: #5b6782; margin: 0 0 22px; line-height: 1.45; }
  .btn-google { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 14px; border-radius: 12px; border: 1.5px solid #cbd5e1; background: #fff; color: #0d1526; font-size: 15px; font-weight: 800; cursor: pointer; margin-bottom: 14px; }
  .btn-google:hover { background: #f8fafc; border-color: #0b4fb8; }
  #g_id_signin { display: flex; justify-content: center; margin: 12px 0; }
  .status { font-size: 13px; font-weight: 700; color: #0b4fb8; margin-top: 14px; }
  .err { color: #e0393e; }
</style>
</head>
<body>
  <div class="card">
    <div class="brand">Trade<span>Desk</span></div>
    <div class="mobile-tag">MOBILE</div>
    <h2>Continue with Google</h2>
    <p>Select your Google account below to sign in or set up your shop on TradeDesk Mobile.</p>
    <div id="g_id_onload"
         data-client_id="613926385238-phjjj57f4f17kq4m24aclnev5bk26gec.apps.googleusercontent.com"
         data-context="signin"
         data-ux_mode="popup"
         data-callback="handleGoogleCredential"
         data-auto_prompt="true">
    </div>
    <div id="g_id_signin" class="g_id_signin"
         data-type="standard"
         data-shape="rectangular"
         data-theme="outline"
         data-text="continue_with"
         data-size="large"
         data-logo_alignment="left"
         data-width="320">
    </div>
    <button type="button" class="btn-google" id="firebasePopupBtn" style="margin-top:10px;">
      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20" height="20" alt="Google" />
      <span>Open Google Account Chooser</span>
    </button>
    <div id="statusMsg" class="status"></div>
  </div>

  <script type="module">
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
    import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithCredential } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

    const firebaseConfig = {
      apiKey: "AIzaSyBrbWi2sYBxbhDzeiZd5SemcUE3Pp1jvJE",
      authDomain: "tradedesk-46cfc.firebaseapp.com",
      projectId: "tradedesk-46cfc",
      storageBucket: "tradedesk-46cfc.firebasestorage.app",
      messagingSenderId: "613926385238",
      appId: "1:613926385238:android:4486c2d846bc5bb4d22df7"
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    const sessionId = ' . json_encode($sessionId) . ';
    const returnUrl = ' . json_encode($returnUrl) . ';
    const statusEl = document.getElementById("statusMsg");

    async function completeSession(payload) {
      statusEl.className = "status";
      statusEl.textContent = "Verified as " + payload.email + "! Returning to TradeDesk Mobile...";
      await fetch("./google-session-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, ...payload })
      });
      setTimeout(() => {
        if (returnUrl) window.location.href = returnUrl;
      }, 500);
    }

    window.handleGoogleCredential = async function(response) {
      try {
        statusEl.textContent = "Verifying Google account...";
        const credential = GoogleAuthProvider.credential(response.credential);
        const res = await signInWithCredential(auth, credential);
        const u = res.user;
        await completeSession({
          firebase_uid: u.uid,
          email: u.email || "",
          name: u.displayName || "Business Owner",
          photo_url: u.photoURL || ""
        });
      } catch (e) {
        // Fallback decode JWT directly if Firebase domain is restricted
        try {
          const parts = response.credential.split(".");
          const decoded = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
          await completeSession({
            firebase_uid: decoded.sub || "",
            email: decoded.email || "",
            name: decoded.name || "Business Owner",
            photo_url: decoded.picture || ""
          });
        } catch (err) {
          statusEl.className = "status err";
          statusEl.textContent = err.message || "Google sign-in failed.";
        }
      }
    };

    document.getElementById("firebasePopupBtn").addEventListener("click", async () => {
      try {
        statusEl.className = "status";
        statusEl.textContent = "Opening Google Account Picker...";
        const result = await signInWithPopup(auth, provider);
        const u = result.user;
        await completeSession({
          firebase_uid: u.uid,
          email: u.email || "",
          name: u.displayName || "Business Owner",
          photo_url: u.photoURL || ""
        });
      } catch (e) {
        statusEl.className = "status err";
        statusEl.textContent = "Please tap the Google button above to select your account.";
      }
    });
  </script>
</body>
</html>';
        exit;
    }

    // POST /auth/google-session-save
    if ($route === 'auth/google-session-save' && $method === 'POST') {
        $sessionId = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($input['session_id'] ?? ''));
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $name = trim((string) ($input['name'] ?? 'Business Owner'));
        $firebaseUid = trim((string) ($input['firebase_uid'] ?? ''));
        $photoUrl = trim((string) ($input['photo_url'] ?? ''));

        if ($sessionId === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['success' => false, 'message' => 'Invalid Google session payload.'], 422);
        }

        // Store JSON in mobile_momo_transactions description/raw_response or mobile_email_otps
        $payloadJson = json_encode([
            'firebase_uid' => $firebaseUid,
            'email' => $email,
            'name' => $name,
            'photo_url' => $photoUrl,
        ]);
        $expiresAt = date('Y-m-d H:i:s', time() + 10 * 60);
        $pdo->prepare("INSERT INTO mobile_email_otps (email, otp, expires_at, is_used) VALUES (?, 'GOOGLE', ?, 0)")
            ->execute(['gs_' . $sessionId . ':' . $email . ':' . base64_encode($name) . ':' . $firebaseUid, $expiresAt]);

        jsonResponse(['success' => true]);
    }

    // GET /auth/google-session-poll
    if ($route === 'auth/google-session-poll' && $method === 'GET') {
        $sessionId = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($input['session_id'] ?? ''));
        if ($sessionId === '') {
            jsonResponse(['completed' => false]);
        }

        $like = 'gs_' . $sessionId . ':%';
        $stmt = $pdo->prepare("
            SELECT id, email FROM mobile_email_otps
            WHERE email LIKE ? AND otp = 'GOOGLE' AND is_used = 0 AND expires_at >= NOW()
            ORDER BY id DESC LIMIT 1
        ");
        $stmt->execute([$like]);
        $row = $stmt->fetch();

        if (!$row) {
            jsonResponse(['completed' => false]);
        }

        $pdo->prepare("UPDATE mobile_email_otps SET is_used = 1 WHERE id = ?")->execute([$row['id']]);
        $parts = explode(':', $row['email'], 4);
        $email = $parts[1] ?? '';
        $name = isset($parts[2]) ? (base64_decode($parts[2]) ?: 'Business Owner') : 'Business Owner';
        $firebaseUid = $parts[3] ?? '';

        jsonResponse([
            'completed' => true,
            'user' => [
                'email' => $email,
                'name' => $name,
                'firebase_uid' => $firebaseUid,
            ],
        ]);
    }

    // POST /auth/google-login (Exact same logic as TradeDesk Web App AuthController::googleLogin)
    if ($route === 'auth/google-login' && $method === 'POST') {
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $firebaseUid = trim((string) ($input['firebase_uid'] ?? ''));
        $name = trim((string) ($input['name'] ?? ''));

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['message' => 'A valid Google email address is required.'], 422);
        }

        if ($firebaseUid !== '') {
            $uStmt = $pdo->prepare("SELECT * FROM mobile_users WHERE email = ? OR firebase_uid = ? LIMIT 1");
            $uStmt->execute([$email, $firebaseUid]);
        } else {
            $uStmt = $pdo->prepare("SELECT * FROM mobile_users WHERE email = ? LIMIT 1");
            $uStmt->execute([$email]);
        }
        $user = $uStmt->fetch();

        if (!$user) {
            jsonResponse([
                'success' => false,
                'is_new' => true,
                'email' => $email,
                'name' => $name,
                'firebase_uid' => $firebaseUid,
                'message' => 'User not registered yet. Please complete business setup.',
            ]);
        }

        if ($firebaseUid !== '' && empty($user['firebase_uid'])) {
            $pdo->prepare("UPDATE mobile_users SET firebase_uid = ? WHERE id = ?")->execute([$firebaseUid, $user['id']]);
        }

        $bStmt = $pdo->prepare("SELECT * FROM mobile_businesses WHERE id = ? LIMIT 1");
        $bStmt->execute([$user['business_id']]);
        $biz = $bStmt->fetch();

        if (!$biz) {
            jsonResponse([
                'success' => false,
                'needs_setup' => true,
                'message' => 'Account found, but business profile setup is pending.',
                'user' => [
                    'id' => (int) $user['id'],
                    'name' => $user['name'],
                    'email' => $user['email'],
                    'phone' => $user['phone'],
                ],
            ]);
        }

        // Check Two-Factor Authentication
        if ((int) ($user['two_factor_enabled'] ?? 0) === 1) {
            $otp = (string) random_int(100000, 999999);
            $expiresAt = date('Y-m-d H:i:s', time() + 10 * 60);
            $pdo->prepare("INSERT INTO mobile_email_otps (email, otp, expires_at, is_used) VALUES (?, ?, ?, 0)")
                ->execute([$user['email'], $otp, $expiresAt]);

            $mailer->send($user['email'], "{$otp} is your TradeDesk Mobile login code", "<p>Your 6-digit login verification code is: <strong>{$otp}</strong></p>");
            $masked = maskEmailAddress($user['email']);

            jsonResponse([
                'success' => true,
                'requires_otp' => true,
                'email' => $user['email'],
                'masked_email' => $masked,
                'message' => "Two-Factor Authentication is enabled. A 6-digit verification code has been sent to {$masked}.",
            ]);
        }

        $apiToken = bin2hex(random_bytes(32));
        $pdo->prepare("UPDATE mobile_users SET api_token = ? WHERE id = ?")->execute([$apiToken, $user['id']]);

        jsonResponse([
            'success' => true,
            'message' => 'Google login successful!',
            'token' => $apiToken,
            'user' => formatUserPayload($user, $biz),
            'business' => formatBusinessPayload($biz),
        ]);
    }

    // POST /auth/google-send-otp (Send 6-digit code for Google Sign-In / Sign-Up)
    if ($route === 'auth/google-send-otp' && $method === 'POST') {
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['success' => false, 'message' => 'Please enter a valid Google email address.'], 422);
        }

        $otp = (string) random_int(100000, 999999);
        $expiresAt = date('Y-m-d H:i:s', time() + 15 * 60);
        $pdo->prepare("INSERT INTO mobile_email_otps (email, otp, expires_at, is_used) VALUES (?, ?, ?, 0)")
            ->execute([$email, $otp, $expiresAt]);

        $uStmt = $pdo->prepare("SELECT name FROM mobile_users WHERE email = ? LIMIT 1");
        $uStmt->execute([$email]);
        $existingUser = $uStmt->fetch();

        $year = date('Y');
        $html = "
        <div style='font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;'>
            <div style='text-align: center; margin-bottom: 20px;'>
                <h2 style='color: #0b4fb8; margin: 0;'>Trade<span style='color: #f26a0e;'>Desk</span> Mobile</h2>
                <p style='color: #64748b; font-size: 14px; margin-top: 4px;'>Google Account Sign-In</p>
            </div>
            <p style='color: #1e293b; font-size: 15px; line-height: 1.5;'>Your 6-digit Google verification code for <strong>TradeDesk Mobile</strong> is:</p>
            <div style='text-align: center; margin: 24px 0;'>
                <span style='display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0a2a66; background: #f1f5f9; padding: 12px 28px; border-radius: 8px; border: 1px dashed #cbd5e1;'>{$otp}</span>
            </div>
            <p style='color: #64748b; font-size: 12px;'>This code expires in 15 minutes.</p>
            <hr style='border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;' />
            <p style='text-align: center; font-size: 12px; color: #94a3b8; margin: 0;'>&copy; {$year} TradeDesk Mobile &bull; AX Technologies Uganda.</p>
        </div>";
        $mailer->send($email, "{$otp} is your TradeDesk Mobile Google Sign-In code", $html);

        jsonResponse([
            'success' => true,
            'is_existing_user' => (bool) $existingUser,
            'user_name' => $existingUser['name'] ?? null,
            'message' => 'Google verification code sent to ' . $email,
        ]);
    }

    // POST /auth/google-verify (Verify Google OTP -> either Sign In existing user OR return needs_setup for new user)
    if ($route === 'auth/google-verify' && $method === 'POST') {
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $otp = trim((string) ($input['otp'] ?? ''));

        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($otp) !== 6) {
            jsonResponse(['success' => false, 'message' => 'Please enter a valid 6-digit code.'], 422);
        }

        $stmt = $pdo->prepare("
            SELECT id FROM mobile_email_otps
            WHERE email = ? AND otp = ? AND is_used = 0 AND expires_at >= NOW()
            ORDER BY id DESC LIMIT 1
        ");
        $stmt->execute([$email, $otp]);
        $rec = $stmt->fetch();

        if (!$rec) {
            jsonResponse(['success' => false, 'message' => 'Invalid or expired verification code.'], 422);
        }

        $pdo->prepare("UPDATE mobile_email_otps SET is_used = 1 WHERE id = ?")->execute([$rec['id']]);

        // Check if user already has a TradeDesk Mobile account
        $uStmt = $pdo->prepare("SELECT * FROM mobile_users WHERE email = ? LIMIT 1");
        $uStmt->execute([$email]);
        $user = $uStmt->fetch();

        if ($user) {
            $bStmt = $pdo->prepare("SELECT * FROM mobile_businesses WHERE id = ? LIMIT 1");
            $bStmt->execute([$user['business_id']]);
            $biz = $bStmt->fetch();

            $apiToken = bin2hex(random_bytes(32));
            $pdo->prepare("UPDATE mobile_users SET api_token = ? WHERE id = ?")->execute([$apiToken, $user['id']]);

            jsonResponse([
                'success' => true,
                'needs_setup' => false,
                'message' => 'Signed in with Google successfully!',
                'token' => $apiToken,
                'user' => formatUserPayload($user, $biz),
                'business' => $biz ? formatBusinessPayload($biz) : null,
            ]);
        }

        // New Google user -> proceed to store setup
        jsonResponse([
            'success' => true,
            'needs_setup' => true,
            'email' => $email,
            'message' => 'Google account verified. Complete your shop details.',
        ]);
    }

    // GET /auth/me
    if ($route === 'auth/me' && $method === 'GET') {
        [$user, $biz] = $requireAuthUser();
        jsonResponse([
            'success' => true,
            'user' => formatUserPayload($user, $biz),
            'business' => formatBusinessPayload($biz),
        ]);
    }

    // POST /auth/logout
    if ($route === 'auth/logout' && $method === 'POST') {
        $token = getBearerToken();
        if ($token) {
            $pdo->prepare("UPDATE mobile_users SET api_token = NULL WHERE api_token = ?")->execute([$token]);
        }
        jsonResponse(['success' => true, 'message' => 'Logged out successfully.']);
    }

    // POST /user/update-password or POST /auth/update-password
    if (($route === 'user/update-password' || $route === 'auth/update-password') && $method === 'POST') {
        [$user, $biz] = $requireAuthUser();
        $currentPassword = (string) ($input['current_password'] ?? '');
        $newPassword = (string) ($input['new_password'] ?? '');

        if ($currentPassword === '' || $newPassword === '') {
            jsonResponse(['success' => false, 'message' => 'Current password and new password are required.'], 422);
        }
        if (strlen($newPassword) < 6) {
            jsonResponse(['success' => false, 'message' => 'New password must be at least 6 characters long.'], 422);
        }

        if (!empty($user['password']) && !password_verify($currentPassword, $user['password'])) {
            jsonResponse(['success' => false, 'message' => 'Current password is incorrect. Please try again.'], 422);
        }

        $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
        $pdo->prepare("UPDATE mobile_users SET password = ?, updated_at = NOW() WHERE id = ?")
            ->execute([$newHash, $user['id']]);

        jsonResponse([
            'success' => true,
            'message' => 'Password changed successfully!',
        ]);
    }

    // ============================================================================
    // 2. MOBILE MONEY & VALUE-ADDED SERVICES (/pos/*)
    // ============================================================================

    // Helper to verify Owner Payment OTP
    $verifyOwnerPaymentOtp = static function (int $businessId, string $otp) use ($pdo): void {
        $stmt = $pdo->prepare("SELECT email FROM mobile_users WHERE business_id = ? ORDER BY id ASC LIMIT 1");
        $stmt->execute([$businessId]);
        $email = $stmt->fetchColumn();
        if (!$email) {
            jsonResponse(['status' => 'error', 'message' => 'Shop owner email not found for OTP verification.'], 403);
        }

        $oStmt = $pdo->prepare("
            SELECT id FROM mobile_email_otps
            WHERE email = ? AND otp = ? AND is_used = 0 AND expires_at >= NOW()
            ORDER BY id DESC LIMIT 1
        ");
        $oStmt->execute([$email, trim($otp)]);
        $valid = $oStmt->fetch();
        if (!$valid) {
            jsonResponse(['status' => 'error', 'message' => 'Invalid or expired 6-digit authorization OTP code.'], 403);
        }

        $pdo->prepare("UPDATE mobile_email_otps SET is_used = 1 WHERE id = ?")->execute([$valid['id']]);
    };

    // POST /pos/momo/verify-phone
    if ($route === 'pos/momo/verify-phone' && $method === 'POST') {
        $phone = trim((string) ($input['phone_number'] ?? ''));
        if (strlen($phone) < 9) {
            jsonResponse(['status' => 'error', 'message' => 'Please enter a valid phone number.'], 422);
        }
        $result = $marzpay->verifyPhone($phone);
        if (!$result['success']) {
            jsonResponse([
                'status' => 'error',
                'message' => $result['message'] ?? 'Could not verify account name.',
                'data' => $result,
            ], 422);
        }
        jsonResponse([
            'status' => 'success',
            'data' => $result,
        ]);
    }

    // POST /pos/momo/request-prompt
    if ($route === 'pos/momo/request-prompt' && $method === 'POST') {
        $phone = trim((string) ($input['phone_number'] ?? ''));
        $amount = (float) ($input['amount'] ?? 0);
        $businessId = (int) ($input['business_id'] ?? 1);
        $reference = trim((string) ($input['reference'] ?? '')) ?: ('TDM-' . strtoupper(bin2hex(random_bytes(4))));
        $description = trim((string) ($input['description'] ?? 'TradeDesk Mobile POS Sale'));

        if (strlen($phone) < 9 || $amount < 500) {
            jsonResponse(['status' => 'error', 'message' => 'Valid phone number and minimum UGX 500 are required.'], 422);
        }

        $result = $marzpay->requestPayment($phone, $amount, $reference, $description, $businessId);
        if (!$result['success']) {
            jsonResponse([
                'status' => 'error',
                'error_code' => $result['error_code'] ?? 'GATEWAY_ERROR',
                'message' => $result['message'],
                'data' => $result,
            ], 422);
        }

        jsonResponse([
            'status' => 'success',
            'message' => $result['message'],
            'data' => $result,
        ]);
    }

    // GET /pos/momo/check-status/{internalReference}
    if (preg_match('#^pos/momo/check-status/([^/]+)$#', $route, $m) && $method === 'GET') {
        $internalReference = rawurldecode($m[1]);
        $merchantRef = $input['reference'] ?? $input['customer_reference'] ?? null;
        $result = $marzpay->checkStatus($internalReference, $merchantRef ? (string) $merchantRef : null);

        $status = strtolower($result['status'] ?? 'pending');
        $isSuccessful = !empty($result['is_completed']) || in_array($status, ['completed', 'successful', 'success'], true);
        $isFailed = !empty($result['is_failed']) || in_array($status, ['failed', 'cancelled'], true);

        if ($isSuccessful && !empty($input['business_id']) && !empty($input['amount']) && !empty($input['credit_treasury'])) {
            $businessId = (int) $input['business_id'];
            $amount = (float) $input['amount'];
            $ref = (string) ($merchantRef ?: $internalReference);
            $provider = (string) ($input['provider'] ?? 'MOMO');
            $result['treasury_account_balance'] = $marzpay->creditBusinessWallet($businessId, $amount, $ref, $provider);
        }

        jsonResponse([
            'status' => 'success',
            'payment_status' => $status,
            'is_completed' => $isSuccessful,
            'is_failed' => $isFailed,
            'message' => $result['message'] ?? ($isFailed ? 'Payment cancelled or failed.' : ($isSuccessful ? 'Payment successful.' : 'Payment pending.')),
            'data' => $result,
        ]);
    }

    // POST /pos/momo/credit-balance
    if ($route === 'pos/momo/credit-balance' && $method === 'POST') {
        $businessId = (int) ($input['business_id'] ?? 1);
        $amount = (float) ($input['amount'] ?? 0);
        $reference = trim((string) ($input['reference'] ?? ''));
        $provider = trim((string) ($input['provider'] ?? 'MOMO'));

        $newBalance = $marzpay->creditBusinessWallet($businessId, $amount, $reference, $provider);
        jsonResponse([
            'status' => 'success',
            'message' => 'UGX ' . number_format($amount) . " credited to shop's Mobile Money wallet.",
            'current_balance' => $newBalance,
        ]);
    }

    // GET /pos/momo/balance
    if ($route === 'pos/momo/balance' && $method === 'GET') {
        $businessId = (int) ($input['business_id'] ?? 1);
        $bStmt = $pdo->prepare("SELECT wallet_balance FROM mobile_businesses WHERE id = ? LIMIT 1");
        $bStmt->execute([$businessId]);
        $localWallet = (float) ($bStmt->fetchColumn() ?: 0.0);

        $walletData = $marzpay->getWalletBalance();
        $gatewayBalance = (float) ($walletData['available_balance'] ?? $walletData['balance'] ?? 0);

        jsonResponse([
            'status' => 'success',
            'data' => [
                'gateway' => 'mobile_money',
                'gateway_balance' => $gatewayBalance,
                'current_balance' => $localWallet > 0 ? $localWallet : $gatewayBalance,
                'is_configured' => $walletData['is_configured'] ?? true,
            ],
        ]);
    }

    // POST /pos/momo/send-payment-otp
    if ($route === 'pos/momo/send-payment-otp' && $method === 'POST') {
        $businessId = (int) ($input['business_id'] ?? 1);
        $actionType = (string) ($input['action_type'] ?? 'payment');
        $amount = (float) ($input['amount'] ?? 0);
        $details = (string) ($input['details'] ?? '');

        $bStmt = $pdo->prepare("SELECT * FROM mobile_businesses WHERE id = ? LIMIT 1");
        $bStmt->execute([$businessId]);
        $biz = $bStmt->fetch();

        $uStmt = $pdo->prepare("SELECT * FROM mobile_users WHERE business_id = ? ORDER BY id ASC LIMIT 1");
        $uStmt->execute([$businessId]);
        $owner = $uStmt->fetch();

        if (!$owner || empty($owner['email'])) {
            jsonResponse(['status' => 'error', 'message' => 'Shop owner email not found.'], 422);
        }

        $email = $owner['email'];
        $otp = (string) random_int(100000, 999999);
        $expiresAt = date('Y-m-d H:i:s', time() + 10 * 60);

        $pdo->prepare("INSERT INTO mobile_email_otps (email, otp, expires_at, is_used) VALUES (?, ?, ?, 0)")
            ->execute([$email, $otp, $expiresAt]);

        if ($actionType === 'bill_payment') {
            $actionLabel = 'Utility Bill Payment';
        } elseif ($actionType === 'airtime') {
            $actionLabel = 'Airtime / Data Bundle Top-Up';
        } elseif ($actionType === 'withdrawal') {
            $actionLabel = 'Mobile Money Withdrawal';
            if ($amount < 5000) {
                jsonResponse(['status' => 'error', 'message' => 'Minimum withdrawal amount is UGX 5,000.'], 422);
            }
            $feeQuote = $marzpay->calculateWithdrawalFee($amount);
            $charge = $feeQuote['total_fee'];
            $totalRequired = $feeQuote['total_deduction'];
            $currentBal = (float) ($biz['wallet_balance'] ?? 0);
            if ($currentBal < $totalRequired) {
                jsonResponse([
                    'status' => 'error',
                    'message' => 'Insufficient funds: Your Mobile Money wallet balance is UGX ' . number_format($currentBal) . ', but UGX ' . number_format($totalRequired) . ' is required (UGX ' . number_format($amount) . ' withdrawal + UGX ' . number_format($charge) . ' total fee [MarzPay 3%: UGX ' . number_format($feeQuote['marzpay_fee']) . ' + Platform 2%: UGX ' . number_format($feeQuote['platform_fee']) . ']).',
                ], 422);
            }
        } else {
            $actionLabel = 'Payment Authorization';
        }

        $formattedAmt = 'UGX ' . number_format($amount);
        $shopName = $biz['name'] ?? 'TradeDesk Mobile Shop';
        $feeQuote = $actionType === 'withdrawal' ? $marzpay->calculateWithdrawalFee($amount) : null;
        $feeText = $actionType === 'withdrawal' && $feeQuote
            ? "<div style='font-size: 13px; color: #dc2626; margin-top: 6px; background: #fff1f2; padding: 10px; border-radius: 6px; border: 1px solid #fecdd3;'>
                <div>Withdrawal Amount: <strong>UGX " . number_format($amount) . "</strong></div>
                <div>MarzPay Network Charge (3%): <strong>UGX " . number_format($feeQuote['marzpay_fee']) . "</strong></div>
                <div>Platform Processing Fee (2% retained on account): <strong>UGX " . number_format($feeQuote['platform_fee']) . "</strong></div>
                <div style='margin-top: 4px; font-weight: 800; color: #9f1239; border-top: 1px dashed #f43f5e; padding-top: 4px;'>Total Account Deduction: <strong>UGX " . number_format($feeQuote['total_deduction']) . "</strong></div>
               </div>"
            : "";
        $html = "
        <div style='font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;'>
            <h2 style='color: #0b4fb8; margin: 0; text-align: center;'>Trade<span style='color: #f26a0e;'>Desk</span> Mobile</h2>
            <div style='background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 18px 0;'>
                <div style='font-size: 13px; color: #475569;'>Payment authorization requested for <strong>{$shopName}</strong>:</div>
                <div style='font-size: 17px; font-weight: 800; color: #0f172a; margin-top: 6px;'>{$actionLabel}: <span style='color: #b91c1c;'>{$formattedAmt}</span></div>
                {$feeText}
                " . ($details ? "<div style='font-size: 12px; color: #64748b; margin-top: 4px;'>Details: <strong>{$details}</strong></div>" : "") . "
            </div>
            <p style='font-size: 14px; color: #1e293b;'>Enter this 6-digit authorization code in TradeDesk Mobile:</p>
            <div style='text-align: center; margin: 22px 0;'>
                <span style='display: inline-block; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #0b4fb8; background: #eff6ff; padding: 12px 26px; border-radius: 10px;'>{$otp}</span>
            </div>
            <p style='font-size: 12px; color: #64748b; text-align: center;'>Expires in 10 minutes.</p>
        </div>";

        $subject = "{$otp} is your TradeDesk Authorization Code ({$formattedAmt})";
        if ($actionType === 'airtime') {
            $subject = "{$otp} is your TradeDesk Airtime Top-Up Code ({$formattedAmt})";
        } elseif ($actionType === 'bill_payment') {
            $subject = "{$otp} is your TradeDesk Bill Payment Code ({$formattedAmt})";
        } elseif ($actionType === 'withdrawal') {
            $subject = "{$otp} is your TradeDesk Mobile Withdrawal Code ({$formattedAmt})";
        }
        $mailer->send($email, $subject, $html);
        $masked = maskEmailAddress($email);

        jsonResponse([
            'status' => 'success',
            'message' => "Authorization code sent to {$masked}",
            'masked_email' => $masked,
        ]);
    }

    // GET /pos/momo/withdrawal-quote
    if ($route === 'pos/momo/withdrawal-quote' && $method === 'GET') {
        $amount = (float) ($_GET['amount'] ?? 0);
        $quote = $marzpay->calculateWithdrawalFee($amount);
        jsonResponse([
            'status' => 'success',
            'data' => $quote,
        ]);
    }

    // POST /pos/momo/withdraw
    if ($route === 'pos/momo/withdraw' && $method === 'POST') {
        $businessId = (int) ($input['business_id'] ?? 1);
        $amount = (float) ($input['amount'] ?? 0);
        $phone = trim((string) ($input['phone_number'] ?? ''));
        $otp = trim((string) ($input['otp'] ?? ''));
        $notes = trim((string) ($input['notes'] ?? 'TradeDesk Mobile Owner Withdrawal'));

        if ($amount < 5000) {
            jsonResponse(['status' => 'error', 'message' => 'Minimum withdrawal amount is UGX 5,000.'], 422);
        }

        if (strlen($phone) < 9) {
            jsonResponse(['status' => 'error', 'message' => 'Valid recipient phone number is required.'], 422);
        }

        // Calculate dynamic withdrawal fees: 3% MarzPay + 2% platform margin (retained on account)
        $fees = $marzpay->calculateWithdrawalFee($amount);
        $charge = $fees['total_fee'];
        $totalRequired = $fees['total_deduction'];
        $marzpayFee = $fees['marzpay_fee'];
        $platformFee = $fees['platform_fee'];

        // Check wallet balance
        $bStmt = $pdo->prepare("SELECT wallet_balance FROM mobile_businesses WHERE id = ?");
        $bStmt->execute([$businessId]);
        $currentBal = (float) ($bStmt->fetchColumn() ?: 0);

        if ($currentBal < $totalRequired) {
            jsonResponse([
                'status' => 'error',
                'message' => 'Insufficient funds: Your Mobile Money wallet balance is UGX ' . number_format($currentBal) . ', but UGX ' . number_format($totalRequired) . ' is required (UGX ' . number_format($amount) . ' withdrawal + UGX ' . number_format($charge) . ' fee [MarzPay 3%: UGX ' . number_format($marzpayFee) . ' + Platform 2%: UGX ' . number_format($platformFee) . ']).',
            ], 422);
        }

        $verifyOwnerPaymentOtp($businessId, $otp);

        $res = $marzpay->sendMoney($phone, $amount, $notes);
        if (!$res['success']) {
            jsonResponse([
                'status' => 'error',
                'message' => $res['message'],
                'error_code' => $res['error_code'] ?? 'DISBURSEMENT_FAILED',
            ], 422);
        }

        // Deduct withdrawal amount + total fee from wallet
        $pdo->prepare("UPDATE mobile_businesses SET wallet_balance = GREATEST(0, wallet_balance - ?) WHERE id = ?")
            ->execute([$totalRequired, $businessId]);

        // Record in mobile_momo_transactions with transparent fee breakdown
        $feeDescription = sprintf(
            "%s (Fee: UGX %s [MarzPay 3%%: UGX %s, Platform 2%%: UGX %s])",
            $notes,
            number_format($charge),
            number_format($marzpayFee),
            number_format($platformFee)
        );

        try {
            $stmt = $pdo->prepare("
                INSERT INTO mobile_momo_transactions
                (business_id, internal_reference, customer_reference, gateway_reference, type, provider, phone_number, amount, charge, status, credited, description)
                VALUES (?, ?, ?, ?, 'disbursement', ?, ?, ?, ?, 'completed', 1, ?)
            ");
            $stmt->execute([
                $businessId,
                $res['reference'],
                $res['reference'],
                $res['reference'],
                $res['provider'] ?? 'MOMO',
                $res['phone_number'] ?? $phone,
                $amount,
                $charge,
                $feeDescription,
            ]);
        } catch (\Exception $e) {}

        $bStmt->execute([$businessId]);
        $newBal = (float) ($bStmt->fetchColumn() ?: 0);

        jsonResponse([
            'status' => 'success',
            'message' => 'UGX ' . number_format($amount) . " withdrawn to {$res['phone_number']} ({$res['provider']})! Total fee: UGX " . number_format($charge) . ' (MarzPay 3%: UGX ' . number_format($marzpayFee) . ' + Platform 2%: UGX ' . number_format($platformFee) . ').',
            'data' => [
                'withdrawn_amount' => $amount,
                'charge' => $charge,
                'marzpay_fee' => $marzpayFee,
                'platform_fee' => $platformFee,
                'total_deducted' => $totalRequired,
                'phone_number' => $res['phone_number'],
                'provider' => $res['provider'],
                'reference' => $res['reference'],
                'new_balance' => $newBal,
            ],
        ]);
    }

    // POST /pos/momo/webhook
    if (($route === 'pos/momo/webhook' || $route === 'webhooks/marzpay') && $method === 'POST') {
        $data = isset($input['data']) && is_array($input['data']) ? $input['data'] : $input;
        $eventType = $input['event_type'] ?? ($data['event_type'] ?? '');
        $transaction = $data['transaction'] ?? ($data['collection'] ?? $data);
        $status = strtolower($transaction['status'] ?? ($data['status'] ?? ''));
        $isCompleted = ($eventType === 'collection.completed') || in_array($status, ['completed', 'successful', 'success'], true);

        if ($isCompleted) {
            $uuid = $transaction['uuid'] ?? ($transaction['reference'] ?? ($data['reference'] ?? ($data['uuid'] ?? ($input['reference'] ?? ''))));
            if ($uuid !== '') {
                $stmt = $pdo->prepare("SELECT * FROM mobile_momo_transactions WHERE internal_reference = ? OR gateway_reference = ? OR customer_reference = ? LIMIT 1");
                $stmt->execute([$uuid, $uuid, $uuid]);
                $tx = $stmt->fetch();
                if ($tx) {
                    $marzpay->creditBusinessWallet((int) $tx['business_id'], (float) $tx['amount'], (string) $tx['internal_reference'], (string) $tx['provider']);
                }
            }
        }

        jsonResponse(['received' => true, 'status' => 'processed']);
    }

    // GET /pos/bills/services
    if ($route === 'pos/bills/services' && $method === 'GET') {
        $nwscAreas = $marzpay->getNwscAreas();
        $dstvBouquets = $marzpay->getBouquetCodes('dstv');
        $gotvBouquets = $marzpay->getBouquetCodes('gotv');

        jsonResponse([
            'status' => 'success',
            'data' => [
                'nwsc_areas' => $nwscAreas,
                'dstv_bouquets' => $dstvBouquets,
                'gotv_bouquets' => $gotvBouquets,
            ],
        ]);
    }

    // POST /pos/bills/verify
    if ($route === 'pos/bills/verify' && $method === 'POST') {
        $utilityCode = (string) ($input['utility_code'] ?? '');
        $meterNumber = (string) ($input['meter_number'] ?? '');
        $area = isset($input['area']) ? (string) $input['area'] : null;

        $res = $marzpay->verifyBillAccount($utilityCode, $meterNumber, $area);
        jsonResponse($res, $res['success'] ? 200 : 422);
    }

    // POST /pos/bills/pay
    if ($route === 'pos/bills/pay' && $method === 'POST') {
        $businessId = (int) ($input['business_id'] ?? 1);
        $utilityCode = (string) ($input['utility_code'] ?? '');
        $meterNumber = (string) ($input['meter_number'] ?? '');
        $amount = (float) ($input['amount'] ?? 0);
        $phone = (string) ($input['phone_number'] ?? '');
        $customerName = (string) ($input['customer_name'] ?? 'Customer');
        $area = isset($input['area']) ? (string) $input['area'] : null;
        $bouquetCode = isset($input['bouquet_code']) ? (string) $input['bouquet_code'] : null;
        $email = isset($input['email']) ? (string) $input['email'] : null;
        $otp = (string) ($input['otp'] ?? '');

        $verifyOwnerPaymentOtp($businessId, $otp);

        $payRes = $marzpay->payBill($utilityCode, $meterNumber, $amount, $phone, $customerName, $area, $bouquetCode, $email);
        if (!$payRes['success']) {
            jsonResponse([
                'status' => 'error',
                'message' => $payRes['message'] ?? 'Bill payment failed.',
            ], 422);
        }

        $pdo->prepare("UPDATE mobile_businesses SET wallet_balance = GREATEST(0, wallet_balance - ?) WHERE id = ?")
            ->execute([$amount, $businessId]);

        jsonResponse([
            'status' => 'success',
            'message' => 'UGX ' . number_format($amount) . " paid for {$utilityCode} ({$meterNumber})!",
            'data' => [
                'utility_code' => $utilityCode,
                'meter_number' => $meterNumber,
                'customer_name' => $customerName,
                'amount' => $amount,
                'token' => $payRes['token'] ?? null,
                'units' => $payRes['units'] ?? null,
                'reference' => $payRes['reference'],
            ],
        ]);
    }

    // GET /pos/airtime/catalog
    if ($route === 'pos/airtime/catalog' && $method === 'GET') {
        jsonResponse([
            'status' => 'success',
            'data' => $marzpay->getAirtimeDataCatalog(),
        ]);
    }

    // POST /pos/airtime/purchase
    if ($route === 'pos/airtime/purchase' && $method === 'POST') {
        $businessId = (int) ($input['business_id'] ?? 1);
        $purchaseType = (string) ($input['purchase_type'] ?? 'airtime');
        $phone = (string) ($input['phone_number'] ?? '');
        $amount = (float) ($input['amount'] ?? 0);
        $bundleCode = isset($input['bundle_code']) ? (string) $input['bundle_code'] : null;
        $otp = (string) ($input['otp'] ?? '');

        $verifyOwnerPaymentOtp($businessId, $otp);

        $buyRes = $marzpay->purchaseAirtimeOrData($purchaseType, $phone, $amount, $bundleCode);
        if (!$buyRes['success']) {
            jsonResponse([
                'status' => 'error',
                'message' => $buyRes['message'] ?? 'Airtime/Data top-up failed.',
            ], 422);
        }

        $pdo->prepare("UPDATE mobile_businesses SET wallet_balance = GREATEST(0, wallet_balance - ?) WHERE id = ?")
            ->execute([$amount, $businessId]);

        jsonResponse([
            'status' => 'success',
            'message' => 'UGX ' . number_format($amount) . " {$purchaseType} sent to {$phone}!",
            'data' => $buyRes,
        ]);
    }

    // ============================================================================
    // 3. CLOUD BACKUP, PHONE RECOVERY & SUBSCRIPTION ROUTES (/cloud/*)
    // ============================================================================

    // POST /cloud/backup
    if ($route === 'cloud/backup' && $method === 'POST') {
        [$user, $biz] = $requireAuthUser();
        $snapshot = $input['snapshot'] ?? null;
        $deviceName = trim((string) ($input['device_name'] ?? 'Android Phone'));
        $appVersion = trim((string) ($input['app_version'] ?? '1.0.0'));
        $statsSummary = $input['stats_summary'] ?? [];

        if (!$snapshot || !is_array($snapshot)) {
            jsonResponse(['success' => false, 'message' => 'Valid database snapshot payload is required.'], 422);
        }

        $snapshotJson = json_encode($snapshot, JSON_UNESCAPED_UNICODE);
        $statsJson = json_encode($statsSummary, JSON_UNESCAPED_UNICODE);

        $ins = $pdo->prepare("
            INSERT INTO mobile_cloud_backups (business_id, user_id, device_name, app_version, snapshot_json, stats_summary)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $ins->execute([
            $biz['id'],
            $user['id'],
            $deviceName,
            $appVersion,
            $snapshotJson,
            $statsJson,
        ]);

        jsonResponse([
            'success' => true,
            'backup_id' => (int) $pdo->lastInsertId(),
            'backed_up_at' => date('c'),
            'message' => 'Your shop data has been securely backed up to TradeDesk Mobile Cloud!',
        ]);
    }

    // GET /cloud/restore
    if ($route === 'cloud/restore' && $method === 'GET') {
        [$user, $biz] = $requireAuthUser();

        $stmt = $pdo->prepare("
            SELECT id, device_name, app_version, snapshot_json, stats_summary, created_at
            FROM mobile_cloud_backups
            WHERE business_id = ?
            ORDER BY id DESC
            LIMIT 1
        ");
        $stmt->execute([$biz['id']]);
        $backup = $stmt->fetch();

        if (!$backup) {
            jsonResponse([
                'success' => false,
                'message' => 'No cloud backup found for this TradeDesk Mobile account yet.',
            ], 404);
        }

        jsonResponse([
            'success' => true,
            'backup' => [
                'id' => (int) $backup['id'],
                'device_name' => $backup['device_name'],
                'app_version' => $backup['app_version'],
                'created_at' => $backup['created_at'],
                'stats_summary' => json_decode((string) $backup['stats_summary'], true) ?: [],
                'snapshot' => json_decode((string) $backup['snapshot_json'], true) ?: [],
            ],
        ]);
    }

    // GET /cloud/subscription
    if ($route === 'cloud/subscription' && $method === 'GET') {
        [$user, $biz] = $requireAuthUser();
        jsonResponse([
            'success' => true,
            'plan' => $biz['plan'] ?? 'free_trial',
            'trial_ends_at' => $biz['trial_ends_at'],
            'subscription_expires_at' => $biz['subscription_expires_at'],
            'plans_catalog' => [
                ['code' => 'starter_monthly', 'name' => 'Starter (50 sales/day • 100 SKUs)', 'price_ugx' => 5000, 'period' => 'month'],
                ['code' => 'growth_monthly', 'name' => 'Growth (150 sales/day • 1,000 SKUs)', 'price_ugx' => 15000, 'period' => 'month'],
                ['code' => 'pro_monthly', 'name' => 'Pro (300 sales/day • 2,500 SKUs)', 'price_ugx' => 30000, 'period' => 'month'],
                ['code' => 'unlimited_monthly', 'name' => 'Unlimited Enterprise', 'price_ugx' => 50000, 'period' => 'month'],
            ],
        ]);
    }

    // POST /cloud/subscribe
    if ($route === 'cloud/subscribe' && $method === 'POST') {
        [$user, $biz] = $requireAuthUser();
        $planCode = trim((string) ($input['plan_code'] ?? 'growth_monthly'));
        $phone = trim((string) ($input['phone_number'] ?? $user['phone'] ?? ''));

        $plans = [
            'starter_monthly' => ['name' => 'Starter Monthly', 'price' => 5000, 'days' => 30],
            'growth_monthly' => ['name' => 'Growth Monthly', 'price' => 15000, 'days' => 30],
            'pro_monthly' => ['name' => 'Pro High-Volume Monthly', 'price' => 30000, 'days' => 30],
            'unlimited_monthly' => ['name' => 'Unlimited Enterprise Monthly', 'price' => 50000, 'days' => 30],
            'basic_monthly' => ['name' => 'Starter Monthly', 'price' => 5000, 'days' => 30],
            'standard_monthly' => ['name' => 'Growth Monthly', 'price' => 15000, 'days' => 30],
            'basic_annual' => ['name' => 'Annual Starter', 'price' => 50000, 'days' => 365],
            'standard_annual' => ['name' => 'Annual Growth', 'price' => 150000, 'days' => 365],
        ];

        $plan = $plans[$planCode] ?? $plans['growth_monthly'];

        if (strlen($phone) < 9) {
            jsonResponse(['status' => 'error', 'message' => 'Valid MTN or Airtel Mobile Money phone number required.'], 422);
        }

        $merchantRef = 'SUB-' . strtoupper(bin2hex(random_bytes(4)));
        $promptRes = $marzpay->requestPayment($phone, (float) $plan['price'], $merchantRef, "TradeDesk {$plan['name']} Subscription", (int) $biz['id']);

        if (!$promptRes['success']) {
            jsonResponse(['status' => 'error', 'message' => $promptRes['message'] ?? 'Could not dispatch Mobile Money payment prompt.'], 400);
        }

        jsonResponse([
            'status' => 'success',
            'message' => "Payment prompt sent to {$phone}. Enter your Mobile Money PIN to activate your subscription.",
            'internal_reference' => $promptRes['internal_reference'],
            'customer_reference' => $merchantRef,
            'amount' => $plan['price'],
            'plan_code' => $planCode,
            'plan_days' => $plan['days'],
        ]);
    }

    // POST /cloud/confirm-subscription
    if ($route === 'cloud/confirm-subscription' && $method === 'POST') {
        [$user, $biz] = $requireAuthUser();
        $internalRef = trim((string) ($input['internal_reference'] ?? ''));
        $planCode = trim((string) ($input['plan_code'] ?? 'standard_monthly'));
        $days = (int) ($input['days'] ?? 30);

        $st = $marzpay->checkStatus($internalRef);
        if (empty($st['is_completed'])) {
            if (!empty($st['is_failed'])) {
                jsonResponse(['status' => 'error', 'is_failed' => true, 'message' => 'Subscription payment was cancelled or failed.'], 400);
            }
            jsonResponse(['status' => 'pending', 'is_completed' => false, 'message' => 'Payment pending confirmation.'], 200);
        }

        // Activate plan
        $expiresAt = date('Y-m-d H:i:s', strtotime("+{$days} days"));
        $up = $pdo->prepare("UPDATE mobile_businesses SET plan = ?, subscription_expires_at = ?, status = 'active' WHERE id = ?");
        $up->execute([$planCode, $expiresAt, (int) $biz['id']]);

        jsonResponse([
            'status' => 'success',
            'is_completed' => true,
            'message' => 'Subscription activated successfully!',
            'plan' => $planCode,
            'subscription_expires_at' => $expiresAt,
        ]);
    }

    jsonResponse([
        'status' => 'error',
        'message' => "Endpoint not found on TradeDesk Mobile API: {$method} /{$route}",
    ], 404);
} catch (\Throwable $e) {
    jsonResponse([
        'status' => 'error',
        'success' => false,
        'message' => $e->getMessage(),
    ], 500);
}
