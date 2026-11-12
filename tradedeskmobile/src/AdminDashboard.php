<?php

namespace TradeDeskMobile;

use PDO;

class AdminDashboard
{
    private PDO $pdo;
    private SmtpMailer $mailer;
    private array $config;

    public function __construct(PDO $pdo, SmtpMailer $mailer, array $config)
    {
        $this->pdo = $pdo;
        $this->mailer = $mailer;
        $this->config = $config;

        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
    }

    public function handle(string $route, string $method, array $input): bool
    {
        // 1. Admin Auth Endpoints (JSON API)
        if ($route === 'admin/auth/login' && $method === 'POST') {
            $this->handleLogin($input);
            return true;
        }

        if ($route === 'admin/auth/verify-otp' && $method === 'POST') {
            $this->handleVerifyOtp($input);
            return true;
        }

        if ($route === 'admin/auth/logout') {
            unset($_SESSION['admin_user_id'], $_SESSION['admin_email'], $_SESSION['admin_logged_in']);
            session_destroy();
            header('Location: ' . $this->getBaseUrl());
            exit;
        }

        // 2. Admin Actions (Requires Login)
        if ($route === 'admin/api/send-notification' && $method === 'POST') {
            $this->requireAuthJson();
            $this->handleSendNotification($input);
            return true;
        }

        if ($route === 'admin/api/delete-notification' && $method === 'POST') {
            $this->requireAuthJson();
            $this->handleDeleteNotification($input);
            return true;
        }

        // 3. Admin Web Page (Route === '' or 'admin' or 'index.php')
        // Only render HTML if not an explicit JSON API request
        $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
        $isJsonRequest = str_contains($accept, 'application/json') || str_starts_with($route, 'api/');

        if (!$isJsonRequest && ($route === '' || $route === 'admin' || $route === 'index.php')) {
            if ($this->isLoggedIn()) {
                $this->renderDashboardHtml();
            } else {
                $this->renderLoginHtml();
            }
            return true;
        }

        return false;
    }

    private function getBaseUrl(): string
    {
        $scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/tradedeskmobile/index.php')), '/');
        return $scriptDir . '/';
    }

    private function isLoggedIn(): bool
    {
        return !empty($_SESSION['admin_logged_in']) && !empty($_SESSION['admin_email']);
    }

    private function requireAuthJson(): void
    {
        if (!$this->isLoggedIn()) {
            header('Content-Type: application/json; charset=utf-8');
            http_response_code(401);
            echo json_encode(['status' => 'error', 'message' => 'Unauthorized admin session. Please log in.']);
            exit;
        }
    }

    private function handleLogin(array $input): void
    {
        header('Content-Type: application/json; charset=utf-8');
        $email = trim(strtolower((string) ($input['email'] ?? '')));
        $password = (string) ($input['password'] ?? '');

        if (!$email || !$password) {
            http_response_code(422);
            echo json_encode(['status' => 'error', 'message' => 'Email and password are required.']);
            exit;
        }

        $stmt = $this->pdo->prepare("SELECT * FROM `mobile_admins` WHERE email = ? LIMIT 1");
        $stmt->execute([$email]);
        $admin = $stmt->fetch(PDO::FETCH_ASSOC);

        // Fallback or seed check for axtechnologiesug@gmail.com
        if (!$admin && $email === 'axtechnologiesug@gmail.com') {
            $hashed = password_hash('Anthony256#', PASSWORD_BCRYPT);
            $this->pdo->prepare("INSERT INTO `mobile_admins` (email, password, name, role) VALUES (?, ?, 'Anthony (Super Admin)', 'superadmin')")
                ->execute([$email, $hashed]);
            $stmt->execute([$email]);
            $admin = $stmt->fetch(PDO::FETCH_ASSOC);
        }

        if (!$admin || !password_verify($password, $admin['password'])) {
            http_response_code(401);
            echo json_encode(['status' => 'error', 'message' => 'Invalid admin email or password.']);
            exit;
        }

        // Generate 6-Digit Email OTP
        $otp = (string) random_int(100000, 999999);
        $expiresAt = date('Y-m-d H:i:s', time() + 10 * 60);

        // Store OTP in database
        $this->pdo->prepare("INSERT INTO `mobile_email_otps` (email, otp, expires_at, is_used) VALUES (?, ?, ?, 0)")
            ->execute([$email, $otp, $expiresAt]);

        // Send OTP via SMTP Mailer
        $subject = "{$otp} is your TradeDesk Admin Login Code";
        $html = "
        <div style='font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;'>
            <h2 style='color: #0b4fb8; margin: 0; text-align: center;'>Trade<span style='color: #f26a0e;'>Desk</span> Admin Portal</h2>
            <p style='color: #475569; font-size: 14px; text-align: center; margin-top: 6px;'>Two-Factor Administrator Sign In Verification</p>
            <div style='background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;'>
                <div style='font-size: 13px; color: #64748b;'>Your 6-Digit Verification Code:</div>
                <div style='font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #0b4fb8; margin: 10px 0;'>{$otp}</div>
                <div style='font-size: 12px; color: #94a3b8;'>Valid for 10 minutes. Never share this code.</div>
            </div>
            <p style='font-size: 12px; color: #64748b; line-height: 16px;'>This security check protects your store management console and user database. If you did not request this login, please change your password immediately.</p>
        </div>";

        $this->mailer->send($email, $subject, $html);

        echo json_encode([
            'status' => 'otp_required',
            'message' => 'Verification code sent to ' . $email,
            'email' => $email,
        ]);
        exit;
    }

    private function handleVerifyOtp(array $input): void
    {
        header('Content-Type: application/json; charset=utf-8');
        $email = trim(strtolower((string) ($input['email'] ?? '')));
        $otp = trim((string) ($input['otp'] ?? ''));

        if (!$email || strlen($otp) !== 6) {
            http_response_code(422);
            echo json_encode(['status' => 'error', 'message' => 'Valid email and 6-digit OTP code are required.']);
            exit;
        }

        $stmt = $this->pdo->prepare("
            SELECT id FROM `mobile_email_otps`
            WHERE email = ? AND otp = ? AND is_used = 0 AND expires_at > NOW()
            ORDER BY id DESC LIMIT 1
        ");
        $stmt->execute([$email, $otp]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Invalid or expired OTP code. Please request a new code.']);
            exit;
        }

        // Mark OTP as used
        $this->pdo->prepare("UPDATE `mobile_email_otps` SET is_used = 1 WHERE id = ?")
            ->execute([(int) $row['id']]);

        // Get admin user
        $aStmt = $this->pdo->prepare("SELECT * FROM `mobile_admins` WHERE email = ? LIMIT 1");
        $aStmt->execute([$email]);
        $admin = $aStmt->fetch(PDO::FETCH_ASSOC);

        // Update last login
        $this->pdo->prepare("UPDATE `mobile_admins` SET last_login_at = NOW() WHERE email = ?")
            ->execute([$email]);

        // Set session
        $_SESSION['admin_logged_in'] = true;
        $_SESSION['admin_user_id'] = $admin['id'] ?? 1;
        $_SESSION['admin_email'] = $email;
        $_SESSION['admin_name'] = $admin['name'] ?? 'Super Admin';

        echo json_encode([
            'status' => 'success',
            'message' => 'Admin authentication successful! Redirecting...',
            'redirect' => $this->getBaseUrl(),
        ]);
        exit;
    }

    private function handleSendNotification(array $input): void
    {
        header('Content-Type: application/json; charset=utf-8');
        $title = trim((string) ($input['title'] ?? ''));
        $message = trim((string) ($input['message'] ?? ''));
        $type = strtoupper(trim((string) ($input['type'] ?? 'ALERT')));
        $target = trim((string) ($input['target'] ?? 'all'));
        $actionLink = trim((string) ($input['action_link'] ?? ''));
        $actionPhone = trim((string) ($input['action_phone'] ?? ''));

        if (!$title || !$message) {
            http_response_code(422);
            echo json_encode(['status' => 'error', 'message' => 'Title and message are required.']);
            exit;
        }

        $userId = null;
        $businessId = null;

        if ($target !== 'all' && is_numeric($target)) {
            $uStmt = $this->pdo->prepare("SELECT id, business_id FROM `mobile_users` WHERE id = ? LIMIT 1");
            $uStmt->execute([(int) $target]);
            $targetUser = $uStmt->fetch(PDO::FETCH_ASSOC);
            if ($targetUser) {
                $userId = (int) $targetUser['id'];
                $businessId = (int) $targetUser['business_id'];
            }
        }

        $stmt = $this->pdo->prepare("
            INSERT INTO `mobile_broadcast_notifications`
            (business_id, user_id, title, message, type, action_link, action_phone, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ");
        $stmt->execute([
            $businessId,
            $userId,
            $title,
            $message,
            $type,
            $actionLink ?: null,
            $actionPhone ?: null,
            $_SESSION['admin_name'] ?? 'Admin',
        ]);

        echo json_encode([
            'status' => 'success',
            'message' => 'Notification dispatched! It will be automatically delivered to users when they connect to the internet.',
            'id' => $this->pdo->lastInsertId(),
        ]);
        exit;
    }

    private function handleDeleteNotification(array $input): void
    {
        header('Content-Type: application/json; charset=utf-8');
        $id = (int) ($input['id'] ?? 0);
        if ($id <= 0) {
            http_response_code(422);
            echo json_encode(['status' => 'error', 'message' => 'Invalid notification ID.']);
            exit;
        }

        $this->pdo->prepare("DELETE FROM `mobile_broadcast_notifications` WHERE id = ?")->execute([$id]);
        $this->pdo->prepare("DELETE FROM `mobile_notification_deliveries` WHERE notification_id = ?")->execute([$id]);

        echo json_encode(['status' => 'success', 'message' => 'Notification removed.']);
        exit;
    }

    private function renderLoginHtml(): void
    {
        header('Content-Type: text/html; charset=utf-8', true);
        $baseUrl = $this->getBaseUrl();
        ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TradeDesk Mobile &bull; Admin Portal</title>
    <link rel="icon" type="image/png" href="<?= htmlspecialchars($baseUrl) ?>logo-mark.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #0B4FB8;
            --primary-dark: #073B8A;
            --accent: #F26A0E;
            --text-dark: #0F172A;
            --text-muted: #64748B;
            --bg-subtle: #F8FAFC;
            --border-color: #E2E8F0;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
        body {
            background: linear-gradient(135deg, #071E4A 0%, #0B4FB8 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .login-card {
            background: #FFFFFF;
            width: 100%;
            max-width: 440px;
            border-radius: 20px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
            padding: 36px 32px;
            overflow: hidden;
            position: relative;
        }
        .brand-header {
            text-align: center;
            margin-bottom: 28px;
        }
        .brand-logo {
            width: 68px;
            height: 68px;
            background: #FFFFFF;
            border: 1.5px solid #DBEAFE;
            border-radius: 20px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 14px;
            box-shadow: 0 4px 16px rgba(11, 79, 184, 0.12);
            padding: 8px;
        }
        .brand-logo img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
        .brand-title {
            font-size: 24px;
            font-weight: 800;
            color: var(--text-dark);
        }
        .brand-title span { color: var(--accent); }
        .brand-sub {
            font-size: 13px;
            color: var(--text-muted);
            margin-top: 4px;
        }
        .form-group {
            margin-bottom: 18px;
            text-align: left;
        }
        .form-label {
            display: block;
            font-size: 12.5px;
            font-weight: 700;
            color: #334155;
            margin-bottom: 6px;
        }
        .form-input {
            width: 100%;
            height: 48px;
            padding: 0 16px;
            border: 1.5px solid var(--border-color);
            border-radius: 12px;
            font-size: 14.5px;
            color: var(--text-dark);
            outline: none;
            transition: all 0.2s;
            background: #FFFFFF;
        }
        .form-input:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(11, 79, 184, 0.12);
        }
        .otp-input {
            text-align: center;
            font-size: 26px;
            letter-spacing: 12px;
            font-weight: 800;
            color: var(--primary);
        }
        .btn-submit {
            width: 100%;
            height: 48px;
            background: var(--primary);
            color: #FFFFFF;
            font-size: 14.5px;
            font-weight: 700;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            margin-top: 6px;
        }
        .btn-submit:hover { background: var(--primary-dark); }
        .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .alert-box {
            padding: 12px 14px;
            border-radius: 10px;
            font-size: 13px;
            line-height: 18px;
            margin-bottom: 18px;
            display: none;
        }
        .alert-error { background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; }
        .alert-success { background: #F0FDF4; color: #16A36A; border: 1px solid #BBF7D0; }
        .alert-info { background: #EFF6FF; color: #1E40AF; border: 1px solid #BFDBFE; }
        .security-badge {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            font-size: 11.5px;
            color: var(--text-muted);
            margin-top: 24px;
            padding-top: 18px;
            border-top: 1px solid #F1F5F9;
        }
    </style>
</head>
<body>
    <div class="login-card">
        <div class="brand-header">
            <div class="brand-logo">
                <img src="<?= htmlspecialchars($baseUrl) ?>logo-mark.png" alt="TradeDesk Logo">
            </div>
            <h1 class="brand-title">Trade<span>Desk</span> Admin</h1>
            <p class="brand-sub">Platform Management & Cloud User Console</p>
        </div>

        <div id="alertBox" class="alert-box"></div>

        <!-- Step 1: Email + Password Form -->
        <form id="loginForm" onsubmit="handleLoginSubmit(event)" autocomplete="off">
            <div class="form-group">
                <label class="form-label">Administrator Email</label>
                <input type="email" id="adminEmail" class="form-input" required placeholder="Enter administrator email" autocomplete="off" autocorrect="off" autocapitalize="none">
            </div>

            <div class="form-group">
                <label class="form-label">Password</label>
                <input type="password" id="adminPassword" class="form-input" required placeholder="••••••••••••" autocomplete="current-password">
            </div>

            <button type="submit" id="loginBtn" class="btn-submit">
                <span>Sign In with 2FA</span>
                <span id="loginSpinner" style="display:none;">⏳</span>
            </button>
        </form>

        <!-- Step 2: 6-Digit Email OTP Form -->
        <form id="otpForm" style="display:none;" onsubmit="handleOtpSubmit(event)">
            <div class="alert-box alert-info" style="display:block;">
                We sent a 6-digit verification code to <strong id="maskedEmailDisplay">your admin email</strong>.
            </div>

            <div class="form-group">
                <label class="form-label" style="text-align:center;">Enter 6-Digit Verification Code</label>
                <input type="text" id="adminOtp" class="form-input otp-input" maxlength="6" inputmode="numeric" required placeholder="------" autocomplete="one-time-code">
            </div>

            <button type="submit" id="otpBtn" class="btn-submit">
                <span>Verify & Access Dashboard</span>
                <span id="otpSpinner" style="display:none;">⏳</span>
            </button>

            <div style="text-align:center; margin-top:14px;">
                <a href="#" onclick="backToLogin(event)" style="font-size:12.5px; color:var(--primary); font-weight:700; text-decoration:none;">&larr; Back to Email & Password</a>
            </div>
        </form>

        <div class="security-badge">
            <span>🔒 Protected by Two-Factor Authentication (OTP)</span>
        </div>
    </div>

    <script>
        const baseUrl = '<?= htmlspecialchars($baseUrl) ?>';

        function showAlert(msg, type = 'error') {
            const box = document.getElementById('alertBox');
            box.className = 'alert-box alert-' + type;
            box.innerText = msg;
            box.style.display = 'block';
        }

        function hideAlert() {
            document.getElementById('alertBox').style.display = 'none';
        }

        async function handleLoginSubmit(e) {
            e.preventDefault();
            hideAlert();
            const btn = document.getElementById('loginBtn');
            const spinner = document.getElementById('loginSpinner');
            const email = document.getElementById('adminEmail').value.trim();
            const password = document.getElementById('adminPassword').value;

            try {
                btn.disabled = true;
                spinner.style.display = 'inline-block';

                const res = await fetch(baseUrl + 'admin/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await res.json();
                if (!res.ok || data.status === 'error') {
                    throw new Error(data.message || 'Login failed.');
                }

                if (data.status === 'otp_required') {
                    document.getElementById('maskedEmailDisplay').innerText = data.email || email;
                    document.getElementById('loginForm').style.display = 'none';
                    document.getElementById('otpForm').style.display = 'block';
                    document.getElementById('adminOtp').focus();
                    showAlert('Verification code sent to your email! Please enter it below.', 'success');
                }
            } catch (err) {
                showAlert(err.message || 'Network error.');
            } finally {
                btn.disabled = false;
                spinner.style.display = 'none';
            }
        }

        async function handleOtpSubmit(e) {
            e.preventDefault();
            hideAlert();
            const btn = document.getElementById('otpBtn');
            const spinner = document.getElementById('otpSpinner');
            const email = document.getElementById('adminEmail').value.trim();
            const otp = document.getElementById('adminOtp').value.trim();

            if (otp.length !== 6) {
                showAlert('Please enter the full 6-digit verification code.');
                return;
            }

            try {
                btn.disabled = true;
                spinner.style.display = 'inline-block';

                const res = await fetch(baseUrl + 'admin/auth/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, otp })
                });

                const data = await res.json();
                if (!res.ok || data.status === 'error') {
                    throw new Error(data.message || 'Verification failed.');
                }

                showAlert('Access granted! Redirecting to dashboard...', 'success');
                setTimeout(() => {
                    window.location.href = data.redirect || baseUrl;
                }, 800);
            } catch (err) {
                showAlert(err.message || 'Verification error.');
            } finally {
                btn.disabled = false;
                spinner.style.display = 'none';
            }
        }

        function backToLogin(e) {
            e.preventDefault();
            hideAlert();
            document.getElementById('otpForm').style.display = 'none';
            document.getElementById('loginForm').style.display = 'block';
        }
    </script>
</body>
</html>
        <?php
        exit;
    }

    private function renderDashboardHtml(): void
    {
        header('Content-Type: text/html; charset=utf-8', true);
        $baseUrl = $this->getBaseUrl();

        // Query platform metrics
        $totalUsers = (int) $this->pdo->query("SELECT COUNT(*) FROM `mobile_users`")->fetchColumn();
        $totalBusinesses = (int) $this->pdo->query("SELECT COUNT(*) FROM `mobile_businesses`")->fetchColumn();
        $onlineNow = (int) $this->pdo->query("SELECT COUNT(*) FROM `mobile_users` WHERE last_seen_at >= NOW() - INTERVAL 5 MINUTE")->fetchColumn();
        $activeToday = (int) $this->pdo->query("SELECT COUNT(*) FROM `mobile_users` WHERE last_seen_at >= NOW() - INTERVAL 24 HOUR")->fetchColumn();
        $totalBackups = (int) $this->pdo->query("SELECT COUNT(*) FROM `mobile_cloud_backups`")->fetchColumn();
        $totalWalletBal = (float) $this->pdo->query("SELECT SUM(wallet_balance) FROM `mobile_businesses`")->fetchColumn();
        $totalNotifications = (int) $this->pdo->query("SELECT COUNT(*) FROM `mobile_broadcast_notifications`")->fetchColumn();

        // Query all users with businesses
        $usersStmt = $this->pdo->query("
            SELECT u.id, u.name, u.email, u.phone, u.role, u.status as user_status, u.last_seen_at, u.last_ip, u.created_at as registered_at,
                   b.name as shop_name, b.category as shop_category, b.location as shop_location, b.plan, b.wallet_balance, b.trial_ends_at, b.subscription_expires_at,
                   (SELECT COUNT(*) FROM `mobile_cloud_backups` WHERE user_id = u.id) as backup_count,
                   (SELECT stats_summary FROM `mobile_cloud_backups` WHERE user_id = u.id ORDER BY id DESC LIMIT 1) as last_backup_stats
            FROM `mobile_users` u
            LEFT JOIN `mobile_businesses` b ON u.business_id = b.id
            ORDER BY u.id DESC
        ");
        $users = $usersStmt->fetchAll(PDO::FETCH_ASSOC);

        // Query sent broadcast notifications
        $notifStmt = $this->pdo->query("
            SELECT n.*,
                   (SELECT COUNT(*) FROM `mobile_notification_deliveries` WHERE notification_id = n.id) as delivery_count
            FROM `mobile_broadcast_notifications` n
            ORDER BY n.id DESC
            LIMIT 50
        ");
        $notifications = $notifStmt->fetchAll(PDO::FETCH_ASSOC);

        // Query recent MoMo Transactions
        $momoStmt = $this->pdo->query("
            SELECT * FROM `mobile_momo_transactions`
            ORDER BY id DESC
            LIMIT 25
        ");
        $momoTx = $momoStmt->fetchAll(PDO::FETCH_ASSOC);
        ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TradeDesk Mobile &bull; Admin Console</title>
    <link rel="icon" type="image/png" href="<?= htmlspecialchars($baseUrl) ?>logo-mark.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #0B4FB8;
            --primary-dark: #073B8A;
            --primary-light: #EFF6FF;
            --accent: #F26A0E;
            --success: #16A36A;
            --success-light: #DCFCE7;
            --danger: #DC2626;
            --danger-light: #FEE2E2;
            --warning: #D97706;
            --warning-light: #FEF3C7;
            --sidebar-bg: #0F172A;
            --sidebar-width: 260px;
            --sidebar-collapsed-width: 76px;
            --header-height: 64px;
            --bg-body: #F8FAFC;
            --card-bg: #FFFFFF;
            --border: #E2E8F0;
            --text-dark: #0F172A;
            --text-muted: #64748B;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
        body { background: var(--bg-body); color: var(--text-dark); display: flex; min-height: 100vh; overflow-x: hidden; }

        /* Sidebar Styling */
        #sidebar {
            width: var(--sidebar-width);
            background: var(--sidebar-bg);
            color: #FFFFFF;
            height: 100vh;
            position: fixed;
            top: 0;
            left: 0;
            display: flex;
            flex-direction: column;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 100;
            box-shadow: 4px 0 16px rgba(0,0,0,0.1);
        }
        #sidebar.collapsed {
            width: var(--sidebar-collapsed-width);
        }
        .sidebar-brand {
            height: var(--header-height);
            display: flex;
            align-items: center;
            padding: 0 18px;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            gap: 12px;
            overflow: hidden;
        }
        .brand-badge {
            width: 38px;
            height: 38px;
            border-radius: 10px;
            background: #FFFFFF;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            padding: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.18);
        }
        .brand-badge img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
        .brand-text {
            font-size: 17px;
            font-weight: 800;
            white-space: nowrap;
        }
        .brand-text span { color: var(--accent); }
        .sidebar-menu {
            list-style: none;
            padding: 16px 10px;
            flex: 1;
            overflow-y: auto;
        }
        .menu-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 11px 14px;
            border-radius: 10px;
            color: #94A3B8;
            text-decoration: none;
            font-size: 13.5px;
            font-weight: 600;
            cursor: pointer;
            margin-bottom: 4px;
            transition: all 0.15s;
            white-space: nowrap;
        }
        .menu-item:hover, .menu-item.active {
            color: #FFFFFF;
            background: rgba(255,255,255,0.1);
        }
        .menu-item.active {
            background: var(--primary);
            color: #FFFFFF;
        }
        .menu-icon {
            font-size: 18px;
            flex-shrink: 0;
            width: 22px;
            text-align: center;
        }
        .menu-label {
            transition: opacity 0.2s;
        }
        #sidebar.collapsed .menu-label,
        #sidebar.collapsed .brand-text,
        #sidebar.collapsed .sidebar-footer-info {
            display: none;
        }
        .sidebar-footer {
            padding: 14px;
            border-top: 1px solid rgba(255,255,255,0.08);
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .sidebar-footer-avatar {
            width: 34px;
            height: 34px;
            border-radius: 50%;
            background: #1E293B;
            border: 1px solid #334155;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: 800;
            color: #60A5FA;
            flex-shrink: 0;
        }
        .sidebar-footer-info {
            flex: 1;
            overflow: hidden;
            font-size: 11px;
            line-height: 14px;
        }
        .sidebar-footer-name {
            font-weight: 700;
            color: #F8FAFC;
            white-space: nowrap;
            text-overflow: ellipsis;
            overflow: hidden;
        }
        .sidebar-footer-role {
            color: #94A3B8;
        }

        /* Main Content Container */
        #main {
            margin-left: var(--sidebar-width);
            flex: 1;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            transition: margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        #sidebar.collapsed + #main {
            margin-left: var(--sidebar-collapsed-width);
        }

        /* Header Bar */
        .top-header {
            height: var(--header-height);
            background: #FFFFFF;
            border-bottom: 1px solid var(--border);
            padding: 0 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: sticky;
            top: 0;
            z-index: 90;
        }
        .header-left {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .toggle-btn {
            background: #F1F5F9;
            border: 1px solid var(--border);
            width: 36px;
            height: 36px;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            color: var(--text-dark);
            transition: all 0.15s;
        }
        .toggle-btn:hover { background: #E2E8F0; }
        .page-heading {
            font-size: 17px;
            font-weight: 800;
            color: var(--text-dark);
        }
        .header-right {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .live-dot {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--success);
            margin-right: 6px;
            box-shadow: 0 0 0 3px rgba(22, 163, 106, 0.2);
        }
        .badge-live {
            background: #DCFCE7;
            color: #166534;
            font-size: 11.5px;
            font-weight: 700;
            padding: 5px 10px;
            border-radius: 20px;
            display: flex;
            align-items: center;
        }
        .btn-logout {
            background: #FEE2E2;
            color: #DC2626;
            border: 1px solid #FECACA;
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 12.5px;
            font-weight: 700;
            text-decoration: none;
            transition: all 0.15s;
        }
        .btn-logout:hover { background: #FCA5A5; }

        /* Page Body */
        .content-body {
            padding: 24px;
            flex: 1;
        }
        .tab-content { display: none; }
        .tab-content.active { display: block; }

        /* Stat Cards Grid */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 18px;
            margin-bottom: 24px;
        }
        .stat-card {
            background: var(--card-bg);
            border-radius: 16px;
            padding: 18px;
            border: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 14px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }
        .stat-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
        }
        .stat-info { flex: 1; }
        .stat-label { font-size: 12px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }
        .stat-value { font-size: 22px; font-weight: 800; color: var(--text-dark); margin-top: 2px; }
        .stat-sub { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

        /* Panels & Tables */
        .card-panel {
            background: var(--card-bg);
            border-radius: 16px;
            border: 1px solid var(--border);
            box-shadow: 0 2px 4px rgba(0,0,0,0.02);
            margin-bottom: 24px;
            overflow: hidden;
        }
        .panel-header {
            padding: 16px 20px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
        }
        .panel-title {
            font-size: 15.5px;
            font-weight: 800;
            color: var(--text-dark);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .search-box {
            padding: 7px 12px;
            border: 1.5px solid var(--border);
            border-radius: 8px;
            font-size: 13px;
            outline: none;
            width: 240px;
        }
        .search-box:focus { border-color: var(--primary); }

        /* Data Table */
        .table-responsive {
            width: 100%;
            overflow-x: auto;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
            font-size: 13px;
        }
        th {
            background: #F8FAFC;
            color: #475569;
            font-weight: 700;
            padding: 12px 16px;
            border-bottom: 1px solid var(--border);
            white-space: nowrap;
        }
        td {
            padding: 14px 16px;
            border-bottom: 1px solid #F1F5F9;
            color: #334155;
            vertical-align: middle;
        }
        tr:hover td { background: #F8FAFC; }

        /* Pills and Status Badges */
        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
        }
        .badge-online { background: #DCFCE7; color: #166534; }
        .badge-active-today { background: #FEF3C7; color: #92400E; }
        .badge-offline { background: #F1F5F9; color: #64748B; }

        .plan-badge {
            background: #EFF6FF;
            color: #0B4FB8;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 6px;
            font-size: 11px;
        }

        /* Composer Form */
        .composer-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            padding: 20px;
        }
        @media (max-width: 768px) {
            .composer-grid { grid-template-columns: 1fr; }
        }
        .form-field { margin-bottom: 14px; }
        .field-label { display: block; font-size: 12.5px; font-weight: 700; margin-bottom: 6px; color: #334155; }
        .field-input, .field-select, .field-textarea {
            width: 100%;
            padding: 10px 14px;
            border: 1.5px solid var(--border);
            border-radius: 10px;
            font-size: 13.5px;
            outline: none;
            background: #FFFFFF;
        }
        .field-input:focus, .field-select:focus, .field-textarea:focus { border-color: var(--primary); }
        .field-textarea { min-height: 90px; resize: vertical; }
        .btn-primary {
            background: var(--primary);
            color: #FFFFFF;
            border: none;
            padding: 11px 20px;
            border-radius: 10px;
            font-weight: 700;
            font-size: 13.5px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s;
        }
        .btn-primary:hover { background: var(--primary-dark); }
        .btn-sm-danger {
            background: #FEE2E2;
            color: #DC2626;
            border: 1px solid #FECACA;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 11.5px;
            font-weight: 700;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <!-- Sidebar -->
    <div id="sidebar">
        <div class="sidebar-brand">
            <div class="brand-badge">
                <img src="<?= htmlspecialchars($baseUrl) ?>logo-mark.png" alt="TradeDesk">
            </div>
            <div class="brand-text">Trade<span>Desk</span></div>
        </div>

        <ul class="sidebar-menu">
            <li>
                <a class="menu-item active" onclick="switchTab('overview')">
                    <span class="menu-icon">📊</span>
                    <span class="menu-label">Overview</span>
                </a>
            </li>
            <li>
                <a class="menu-item" onclick="switchTab('users')">
                    <span class="menu-icon">👥</span>
                    <span class="menu-label">Cloud Users (<?= count($users) ?>)</span>
                </a>
            </li>
            <li>
                <a class="menu-item" onclick="switchTab('notifications')">
                    <span class="menu-icon">📢</span>
                    <span class="menu-label">In-App Notifications</span>
                </a>
            </li>
            <li>
                <a class="menu-item" onclick="switchTab('momo')">
                    <span class="menu-icon">💳</span>
                    <span class="menu-label">MoMo Transactions</span>
                </a>
            </li>
            <li>
                <a class="menu-item" onclick="switchTab('backups')">
                    <span class="menu-icon">💾</span>
                    <span class="menu-label">Cloud Backups</span>
                </a>
            </li>
        </ul>

        <div class="sidebar-footer">
            <div class="sidebar-footer-avatar">A</div>
            <div class="sidebar-footer-info">
                <div class="sidebar-footer-name"><?= htmlspecialchars($_SESSION['admin_name'] ?? 'Super Admin') ?></div>
                <div class="sidebar-footer-role"><?= htmlspecialchars($_SESSION['admin_email'] ?? 'axtechnologiesug@gmail.com') ?></div>
            </div>
        </div>
    </div>

    <!-- Main Content -->
    <div id="main">
        <div class="top-header">
            <div class="header-left">
                <button class="toggle-btn" onclick="toggleSidebar()" title="Toggle Sidebar">☰</button>
                <div class="page-heading" id="pageTitle">Admin Dashboard &bull; TradeDesk Mobile</div>
            </div>
            <div class="header-right">
                <div class="badge-live">
                    <span class="live-dot"></span>
                    <span><?= $onlineNow ?> User<?= $onlineNow === 1 ? '' : 's' ?> Online Now</span>
                </div>
                <a href="<?= $baseUrl ?>admin/auth/logout" class="btn-logout">Sign Out</a>
            </div>
        </div>

        <div class="content-body">
            <!-- TAB 1: OVERVIEW -->
            <div id="tab-overview" class="tab-content active">
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon" style="background:#EFF6FF; color:#0B4FB8;">👥</div>
                        <div class="stat-info">
                            <div class="stat-label">Cloud Users</div>
                            <div class="stat-value"><?= number_format($totalUsers) ?></div>
                            <div class="stat-sub"><?= $totalBusinesses ?> registered shops</div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon" style="background:#DCFCE7; color:#16A36A;">🟢</div>
                        <div class="stat-info">
                            <div class="stat-label">Online Active Now</div>
                            <div class="stat-value"><?= number_format($onlineNow) ?></div>
                            <div class="stat-sub"><?= $activeToday ?> active in last 24h</div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon" style="background:#FEF3C7; color:#D97706;">💰</div>
                        <div class="stat-info">
                            <div class="stat-label">Total Store Balances</div>
                            <div class="stat-value">UGX <?= number_format($totalWalletBal) ?></div>
                            <div class="stat-sub">Across all shops</div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon" style="background:#F3E8FF; color:#7E22CE;">💾</div>
                        <div class="stat-info">
                            <div class="stat-label">Cloud Snapshots</div>
                            <div class="stat-value"><?= number_format($totalBackups) ?></div>
                            <div class="stat-sub">Protected offline data</div>
                        </div>
                    </div>
                </div>

                <!-- Recent Registered Users Table -->
                <div class="card-panel">
                    <div class="panel-header">
                        <div class="panel-title">👥 Recently Active Cloud Users</div>
                        <button class="btn-primary" onclick="switchTab('users')" style="padding: 6px 14px; font-size: 12px;">View All Users &rarr;</button>
                    </div>
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Status</th>
                                    <th>User & Email</th>
                                    <th>Shop / Business</th>
                                    <th>Phone</th>
                                    <th>Plan</th>
                                    <th>Wallet</th>
                                    <th>Last Seen</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach (array_slice($users, 0, 8) as $u):
                                    $lastSeen = $u['last_seen_at'] ? strtotime($u['last_seen_at']) : 0;
                                    $diff = time() - $lastSeen;
                                    $isOnline = $lastSeen && $diff <= 300;
                                    $isActiveToday = $lastSeen && $diff <= 86400;
                                ?>
                                <tr>
                                    <td>
                                        <?php if ($isOnline): ?>
                                            <span class="status-badge badge-online">🟢 Online Now</span>
                                        <?php elseif ($isActiveToday): ?>
                                            <span class="status-badge badge-active-today">🟡 Active Today</span>
                                        <?php else: ?>
                                            <span class="status-badge badge-offline">⚪ Offline</span>
                                        <?php endif; ?>
                                    </td>
                                    <td>
                                        <div style="font-weight:700; color:#0F172A;"><?= htmlspecialchars($u['name']) ?></div>
                                        <div style="font-size:11.5px; color:#64748B;"><?= htmlspecialchars($u['email']) ?></div>
                                    </td>
                                    <td>
                                        <div style="font-weight:700;"><?= htmlspecialchars($u['shop_name'] ?: 'Solo Store') ?></div>
                                        <div style="font-size:11px; color:#64748B;"><?= htmlspecialchars($u['shop_category'] ?: 'Retail') ?></div>
                                    </td>
                                    <td><?= htmlspecialchars($u['phone'] ?: 'No phone') ?></td>
                                    <td><span class="plan-badge"><?= htmlspecialchars($u['plan'] ?: 'Starter') ?></span></td>
                                    <td style="font-weight:700; color:#0B4FB8;">UGX <?= number_format((float) ($u['wallet_balance'] ?? 0)) ?></td>
                                    <td style="font-size:11.5px; color:#64748B;">
                                        <?= $u['last_seen_at'] ? date('M j, g:i a', strtotime($u['last_seen_at'])) : 'Never' ?>
                                    </td>
                                    <td>
                                        <button class="btn-primary" style="padding:4px 8px; font-size:11px;" onclick="openQuickNotification(<?= $u['id'] ?>, '<?= htmlspecialchars(addslashes($u['name'])) ?>')">📢 Notify</button>
                                    </td>
                                </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- TAB 2: USERS & CLOUD ACCOUNTS -->
            <div id="tab-users" class="tab-content">
                <div class="card-panel">
                    <div class="panel-header">
                        <div class="panel-title">👥 All Cloud Registered Users (<?= count($users) ?>)</div>
                        <input type="text" id="userSearch" class="search-box" placeholder="Search name, email, shop..." onkeyup="filterUsersTable()">
                    </div>
                    <div class="table-responsive">
                        <table id="usersTable">
                            <thead>
                                <tr>
                                    <th>Presence</th>
                                    <th>Owner / Name</th>
                                    <th>Email</th>
                                    <th>Shop Name & Location</th>
                                    <th>Phone</th>
                                    <th>Plan Status</th>
                                    <th>Wallet Balance</th>
                                    <th>Backups</th>
                                    <th>Registered</th>
                                    <th>Last IP / Device</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($users as $u):
                                    $lastSeen = $u['last_seen_at'] ? strtotime($u['last_seen_at']) : 0;
                                    $diff = time() - $lastSeen;
                                    $isOnline = $lastSeen && $diff <= 300;
                                    $isActiveToday = $lastSeen && $diff <= 86400;
                                ?>
                                <tr>
                                    <td>
                                        <?php if ($isOnline): ?>
                                            <span class="status-badge badge-online">🟢 Online Now</span>
                                        <?php elseif ($isActiveToday): ?>
                                            <span class="status-badge badge-active-today">🟡 Today (<?= floor($diff/60) ?>m ago)</span>
                                        <?php else: ?>
                                            <span class="status-badge badge-offline">⚪ <?= $lastSeen ? date('M j, g:i a', $lastSeen) : 'Never' ?></span>
                                        <?php endif; ?>
                                    </td>
                                    <td><strong><?= htmlspecialchars($u['name']) ?></strong></td>
                                    <td><a href="mailto:<?= htmlspecialchars($u['email']) ?>" style="color:#0B4FB8; text-decoration:none;"><?= htmlspecialchars($u['email']) ?></a></td>
                                    <td>
                                        <div><strong><?= htmlspecialchars($u['shop_name'] ?: 'Unnamed Shop') ?></strong></div>
                                        <div style="font-size:11px; color:#64748B;"><?= htmlspecialchars($u['shop_location'] ?: 'Uganda') ?></div>
                                    </td>
                                    <td><?= htmlspecialchars($u['phone'] ?: '-') ?></td>
                                    <td><span class="plan-badge"><?= htmlspecialchars($u['plan'] ?: 'Starter') ?></span></td>
                                    <td style="font-weight:800; color:#0B4FB8;">UGX <?= number_format((float) ($u['wallet_balance'] ?? 0)) ?></td>
                                    <td>
                                        <span title="<?= htmlspecialchars($u['last_backup_stats'] ?? '') ?>">
                                            💾 <?= (int) $u['backup_count'] ?> snapshots
                                        </span>
                                    </td>
                                    <td style="font-size:11.5px; color:#64748B;"><?= date('M j, Y', strtotime($u['registered_at'])) ?></td>
                                    <td style="font-size:11px; color:#94A3B8;"><?= htmlspecialchars($u['last_ip'] ?: '-') ?></td>
                                    <td>
                                        <button class="btn-primary" style="padding:4px 8px; font-size:11px;" onclick="openQuickNotification(<?= $u['id'] ?>, '<?= htmlspecialchars(addslashes($u['name'])) ?>')">📢 Notify</button>
                                    </td>
                                </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- TAB 3: IN-APP NOTIFICATIONS -->
            <div id="tab-notifications" class="tab-content">
                <!-- Composer Form -->
                <div class="card-panel">
                    <div class="panel-header">
                        <div class="panel-title">📢 Send In-App Notification (Auto-Pulled when User Connects to Internet)</div>
                    </div>
                    <form id="notifForm" onsubmit="sendNotificationSubmit(event)">
                        <div class="composer-grid">
                            <div>
                                <div class="form-field">
                                    <label class="field-label">Target Recipient</label>
                                    <select id="notifTarget" class="field-select">
                                        <option value="all">📢 Broadcast to ALL Cloud Users (<?= count($users) ?> users)</option>
                                        <?php foreach ($users as $u): ?>
                                            <option value="<?= $u['id'] ?>">👤 <?= htmlspecialchars($u['name']) ?> (<?= htmlspecialchars($u['shop_name'] ?: $u['email']) ?>)</option>
                                        <?php endforeach; ?>
                                    </select>
                                </div>

                                <div class="form-field">
                                    <label class="field-label">Notification Type</label>
                                    <select id="notifType" class="field-select">
                                        <option value="ALERT">⚠️ Store Alert (Important Updates)</option>
                                        <option value="SALE">🛍️ Sale / Product Offer</option>
                                        <option value="PAYMENT">💳 Payment / Mobile Money Notice</option>
                                        <option value="SYNC">☁️ Cloud Backup & Sync</option>
                                    </select>
                                </div>

                                <div class="form-field">
                                    <label class="field-label">Notification Title</label>
                                    <input type="text" id="notifTitle" class="field-input" placeholder="e.g. Critical Update: New Version Available" required>
                                </div>
                            </div>

                            <div>
                                <div class="form-field">
                                    <label class="field-label">Message Content</label>
                                    <textarea id="notifMessage" class="field-textarea" placeholder="Type message body. You can also type links or phone numbers inside the text." required></textarea>
                                </div>

                                <div class="form-field">
                                    <label class="field-label">Attach Action Link URL (Optional)</label>
                                    <input type="url" id="notifLink" class="field-input" placeholder="e.g. https://axtechnologies.net/download">
                                    <div style="font-size:11px; color:#64748B; margin-top:3px;">Creates a one-tap 'Open Link' button in the user's mobile app.</div>
                                </div>

                                <div class="form-field">
                                    <label class="field-label">Attach Contact Phone Number (Optional)</label>
                                    <input type="text" id="notifPhone" class="field-input" placeholder="e.g. +256772651444">
                                    <div style="font-size:11px; color:#64748B; margin-top:3px;">Creates 1-tap 'Call' and 'WhatsApp' buttons in the mobile app.</div>
                                </div>
                            </div>
                        </div>

                        <div style="padding: 0 20px 20px 20px; display:flex; justify-content:flex-end;">
                            <button type="submit" id="sendNotifBtn" class="btn-primary">
                                <span>🚀 Dispatch In-App Notification</span>
                            </button>
                        </div>
                    </form>
                </div>

                <!-- Sent Notifications Log -->
                <div class="card-panel">
                    <div class="panel-header">
                        <div class="panel-title">📜 Dispatched Notifications History (<?= count($notifications) ?>)</div>
                    </div>
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Title</th>
                                    <th>Message</th>
                                    <th>Attached Link / Phone</th>
                                    <th>Deliveries</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php if (empty($notifications)): ?>
                                    <tr><td colspan="7" style="text-align:center; padding:30px; color:#94A3B8;">No in-app notifications sent yet.</td></tr>
                                <?php else: ?>
                                    <?php foreach ($notifications as $n): ?>
                                    <tr>
                                        <td style="font-size:11.5px; white-space:nowrap;"><?= date('M j, g:i a', strtotime($n['created_at'])) ?></td>
                                        <td><span class="plan-badge"><?= htmlspecialchars($n['type']) ?></span></td>
                                        <td><strong><?= htmlspecialchars($n['title']) ?></strong></td>
                                        <td style="max-width:300px; font-size:12.5px;"><?= htmlspecialchars($n['message']) ?></td>
                                        <td style="font-size:12px;">
                                            <?php if ($n['action_link']): ?>
                                                <div>🌐 <a href="<?= htmlspecialchars($n['action_link']) ?>" target="_blank" style="color:#0B4FB8;"><?= htmlspecialchars(substr($n['action_link'], 0, 30)) ?>...</a></div>
                                            <?php endif; ?>
                                            <?php if ($n['action_phone']): ?>
                                                <div>📞 <?= htmlspecialchars($n['action_phone']) ?></div>
                                            <?php endif; ?>
                                            <?php if (!$n['action_link'] && !$n['action_phone']): ?>
                                                <span style="color:#94A3B8;">None</span>
                                            <?php endif; ?>
                                        </td>
                                        <td>
                                            <span class="status-badge badge-online">
                                                ✓ <?= (int) $n['delivery_count'] ?> delivered
                                            </span>
                                        </td>
                                        <td>
                                            <button class="btn-sm-danger" onclick="deleteNotification(<?= $n['id'] ?>)">Delete</button>
                                        </td>
                                    </tr>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- TAB 4: MOMO TRANSACTIONS -->
            <div id="tab-momo" class="tab-content">
                <div class="card-panel">
                    <div class="panel-header">
                        <div class="panel-title">💳 Live Mobile Money Collections & Disbursements (<?= count($momoTx) ?>)</div>
                    </div>
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Phone / Recipient</th>
                                    <th>Amount</th>
                                    <th>Total Charge</th>
                                    <th>Status</th>
                                    <th>Reference</th>
                                    <th>Description</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php if (empty($momoTx)): ?>
                                    <tr><td colspan="8" style="text-align:center; padding:30px; color:#94A3B8;">No Mobile Money transactions recorded yet.</td></tr>
                                <?php else: ?>
                                    <?php foreach ($momoTx as $tx): ?>
                                    <tr>
                                        <td style="font-size:11.5px; white-space:nowrap;"><?= date('M j, g:i a', strtotime($tx['created_at'])) ?></td>
                                        <td>
                                            <span class="plan-badge" style="<?= $tx['type'] === 'disbursement' ? 'background:#FEE2E2; color:#DC2626;' : '' ?>">
                                                <?= htmlspecialchars(strtoupper($tx['type'])) ?>
                                            </span>
                                        </td>
                                        <td><?= htmlspecialchars($tx['phone_number'] ?: '-') ?> (<?= htmlspecialchars($tx['provider']) ?>)</td>
                                        <td style="font-weight:800; color:<?= $tx['type'] === 'disbursement' ? '#DC2626' : '#16A36A' ?>;">
                                            UGX <?= number_format((float) $tx['amount']) ?>
                                        </td>
                                        <td>UGX <?= number_format((float) $tx['charge']) ?></td>
                                        <td>
                                            <span class="status-badge <?= $tx['status'] === 'completed' || $tx['status'] === 'successful' ? 'badge-online' : 'badge-active-today' ?>">
                                                <?= htmlspecialchars($tx['status']) ?>
                                            </span>
                                        </td>
                                        <td style="font-size:11px; font-family:monospace;"><?= htmlspecialchars(substr($tx['internal_reference'], 0, 16)) ?>...</td>
                                        <td style="font-size:12px; color:#64748B;"><?= htmlspecialchars($tx['description'] ?: '-') ?></td>
                                    </tr>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- TAB 5: CLOUD BACKUPS -->
            <div id="tab-backups" class="tab-content">
                <div class="card-panel">
                    <div class="panel-header">
                        <div class="panel-title">💾 Cloud Data Snapshots & Sync Status</div>
                    </div>
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Shop & Owner</th>
                                    <th>Device Name</th>
                                    <th>App Version</th>
                                    <th>Snapshot Summary</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php
                                $bStmt = $this->pdo->query("
                                    SELECT cb.*, u.name as user_name, b.name as shop_name
                                    FROM `mobile_cloud_backups` cb
                                    JOIN `mobile_users` u ON cb.user_id = u.id
                                    JOIN `mobile_businesses` b ON cb.business_id = b.id
                                    ORDER BY cb.id DESC LIMIT 40
                                ");
                                $backups = $bStmt->fetchAll(PDO::FETCH_ASSOC);
                                if (empty($backups)):
                                ?>
                                    <tr><td colspan="5" style="text-align:center; padding:30px; color:#94A3B8;">No device snapshots saved yet.</td></tr>
                                <?php else: ?>
                                    <?php foreach ($backups as $b): ?>
                                    <tr>
                                        <td style="font-size:11.5px;"><?= date('M j, Y g:i a', strtotime($b['created_at'])) ?></td>
                                        <td>
                                            <strong><?= htmlspecialchars($b['shop_name']) ?></strong>
                                            <div style="font-size:11px; color:#64748B;"><?= htmlspecialchars($b['user_name']) ?></div>
                                        </td>
                                        <td><?= htmlspecialchars($b['device_name'] ?: 'Android Phone') ?></td>
                                        <td><span class="plan-badge"><?= htmlspecialchars($b['app_version'] ?: 'v1.0.0') ?></span></td>
                                        <td style="font-size:12.5px; color:#0F172A;"><?= htmlspecialchars($b['stats_summary'] ?: 'Full SQLite backup') ?></td>
                                    </tr>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        const baseUrl = '<?= htmlspecialchars($baseUrl) ?>';

        function toggleSidebar() {
            document.getElementById('sidebar').classList.toggle('collapsed');
        }

        function switchTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));

            const targetTab = document.getElementById('tab-' + tabId);
            if (targetTab) {
                targetTab.classList.add('active');
            }

            // Update title
            const titles = {
                overview: 'Admin Dashboard • Overview & Real-Time Stats',
                users: 'Cloud User Management & Online Tracking',
                notifications: 'In-App Broadcast Notifications Center',
                momo: 'Mobile Money Audit Log',
                backups: 'Cloud Backups & Device Snapshots'
            };
            document.getElementById('pageTitle').innerText = titles[tabId] || 'Admin Console';
        }

        function openQuickNotification(userId, userName) {
            switchTab('notifications');
            const select = document.getElementById('notifTarget');
            select.value = userId;
            document.getElementById('notifTitle').value = 'Notice for ' + userName;
            document.getElementById('notifTitle').focus();
        }

        function filterUsersTable() {
            const query = document.getElementById('userSearch').value.toLowerCase();
            const rows = document.querySelectorAll('#usersTable tbody tr');
            rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                row.style.display = text.includes(query) ? '' : 'none';
            });
        }

        async function sendNotificationSubmit(e) {
            e.preventDefault();
            const btn = document.getElementById('sendNotifBtn');
            const target = document.getElementById('notifTarget').value;
            const type = document.getElementById('notifType').value;
            const title = document.getElementById('notifTitle').value.trim();
            const message = document.getElementById('notifMessage').value.trim();
            const action_link = document.getElementById('notifLink').value.trim();
            const action_phone = document.getElementById('notifPhone').value.trim();

            if (!title || !message) {
                alert('Please enter title and message.');
                return;
            }

            try {
                btn.disabled = true;
                btn.innerText = 'Dispatching...';

                const res = await fetch(baseUrl + 'admin/api/send-notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ target, type, title, message, action_link, action_phone })
                });

                const data = await res.json();
                if (!res.ok || data.status === 'error') {
                    throw new Error(data.message || 'Failed to dispatch notification.');
                }

                alert('Notification successfully dispatched! Users will receive it in-app automatically upon connecting to the internet.');
                location.reload();
            } catch (err) {
                alert(err.message || 'Error sending notification.');
            } finally {
                btn.disabled = false;
                btn.innerText = '🚀 Dispatch In-App Notification';
            }
        }

        async function deleteNotification(id) {
            if (!confirm('Are you sure you want to delete this notification?')) return;
            try {
                const res = await fetch(baseUrl + 'admin/api/delete-notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });
                const data = await res.json();
                if (data.status === 'success') {
                    location.reload();
                } else {
                    alert(data.message || 'Failed to delete.');
                }
            } catch (err) {
                alert('Network error.');
            }
        }
    </script>
</body>
</html>
        <?php
        exit;
    }
}

