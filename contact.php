<?php
/**
 * AX TECHNOLOGIES UGANDA - CONTACT & INQUIRY DISPATCHER
 * Automatically forwards inbound customer inquiries to axtechnologiesug@gmail.com
 * and dispatches an automated acknowledgment email to the sender.
 */

header('Content-Type: application/json; charset=utf-8');

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method Not Allowed']);
    exit;
}

// Enforce Cloudflare Turnstile & Brute-Force Rate Limiting
require_once __DIR__ . '/cloudflare-security.php';
axEnforceCloudflareLoginProtection(['relPath' => 'contact.php']);

// Autoload PHPMailer via Composer
require_once __DIR__ . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

// Sanitize inputs
$name    = isset($_POST['name']) ? trim(strip_tags($_POST['name'])) : '';
$email   = isset($_POST['email']) ? filter_var(trim($_POST['email']), FILTER_SANITIZE_EMAIL) : '';
$phone   = isset($_POST['phone']) ? trim(strip_tags($_POST['phone'])) : '';
$service = isset($_POST['service']) ? trim(strip_tags($_POST['service'])) : 'General Inquiries';
$message = isset($_POST['message']) ? trim(strip_tags($_POST['message'])) : '';

// Basic validation
if (empty($name) || empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL) || empty($message)) {
    http_response_code(400);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Please provide a valid name, email address, and message.'
    ]);
    exit;
}

// 1. Log inquiry to local repository as reliable persistent backup
$logFile = __DIR__ . '/inquiries_log.json';
$inquiryEntry = [
    'timestamp' => date('Y-m-d H:i:s'),
    'name'      => $name,
    'email'     => $email,
    'phone'     => $phone,
    'service'   => $service,
    'message'   => $message,
    'ip'        => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
];

$existingLogs = [];
if (file_exists($logFile)) {
    $existingLogs = json_decode(file_get_contents($logFile), true) ?: [];
}
$existingLogs[] = $inquiryEntry;
@file_put_contents($logFile, json_encode($existingLogs, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

// Helper function to build a pre-configured PHPMailer instance
function createMailer(): PHPMailer {
    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host       = 'mail.steadfast.crystalcloudhost.net';
    $mail->SMTPAuth   = true;
    $mail->Username   = 'verify@axtechnologies.net';
    $mail->Password   = 'Anthony@256#';
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = 587;
    $mail->Timeout    = 15;
    $mail->CharSet    = 'UTF-8';
    return $mail;
}

$adminSent = false;
$autoReplySent = false;
$mailErrors = [];

// 2. FORWARD USER INQUIRY TO AX TECHNOLOGIES ADMIN INBOX
try {
    $adminMail = createMailer();
    $adminMail->setFrom('support@axtechnologies.net', 'AX Technologies Web Portal');
    $adminMail->addAddress('support@axtechnologies.net', 'AX Technologies Support Desk');
    $adminMail->addAddress('axtechnologiesug@gmail.com', 'AX Technologies Management');
    $adminMail->addReplyTo($email, $name); // Clicking reply in Gmail replies directly to the client

    $adminMail->isHTML(true);
    $adminMail->Subject = "New Inbound Inquiry: " . $service . " - " . $name;

    $adminHtml = "
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset='UTF-8'>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6; }
        .container { max-width: 620px; margin: 20px auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; }
        .header { border-bottom: 2px solid #0047ab; padding-bottom: 12px; margin-bottom: 18px; }
        .header h2 { margin: 0; color: #0f172a; font-size: 20px; }
        .badge { display: inline-block; background: #f97316; color: #fff; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .field-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .field-table td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .field-label { width: 140px; font-weight: 600; color: #64748b; }
        .message-box { background: #f8fafc; border-left: 4px solid #0047ab; padding: 14px; margin: 18px 0; border-radius: 4px; font-size: 14px; white-space: pre-wrap; }
        .footer { font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class='container'>
        <div class='header'>
          <h2>New Website Inquiry</h2>
          <span class='badge'>" . htmlspecialchars($service) . "</span>
        </div>
        <p>A prospective client or partner submitted an inquiry through the <strong>axtechnologies.net</strong> web portal:</p>
        <table class='field-table'>
          <tr>
            <td class='field-label'>Client Name:</td>
            <td><strong>" . htmlspecialchars($name) . "</strong></td>
          </tr>
          <tr>
            <td class='field-label'>Email:</td>
            <td><a href='mailto:" . htmlspecialchars($email) . "'>" . htmlspecialchars($email) . "</a></td>
          </tr>
          <tr>
            <td class='field-label'>Phone / WhatsApp:</td>
            <td>" . ($phone ? htmlspecialchars($phone) : '<em>Not specified</em>') . "</td>
          </tr>
          <tr>
            <td class='field-label'>Inquiry Type:</td>
            <td>" . htmlspecialchars($service) . "</td>
          </tr>
          <tr>
            <td class='field-label'>Received At:</td>
            <td>" . date('d M Y, h:i A') . " (Uganda Time)</td>
          </tr>
        </table>

        <div style='margin-top: 18px; font-weight: 600; color: #334155;'>Client Message:</div>
        <div class='message-box'>" . nl2br(htmlspecialchars($message)) . "</div>

        <p style='font-size: 13px; color: #64748b;'><em>Tip: Simply click 'Reply' in your email client to respond directly to " . htmlspecialchars($name) . " (" . htmlspecialchars($email) . ").</em></p>

        <div class='footer'>
          AX Technologies Uganda Automated Web Portal Dispatcher &bull; Bushenyi, Uganda
        </div>
      </div>
    </body>
    </html>";

    $adminMail->Body = $adminHtml;
    $adminMail->AltBody = "New Inbound Inquiry\n\nName: $name\nEmail: $email\nPhone: $phone\nService: $service\n\nMessage:\n$message\n\nSubmitted on: " . date('Y-m-d H:i:s');

    $adminMail->send();
    $adminSent = true;
} catch (Exception $e) {
    $mailErrors[] = "Admin mail error: " . $adminMail->ErrorInfo;
}

// 3. AUTOMATIC ACKNOWLEDGMENT AUTO-REPLY TO THE SENDER
try {
    $userMail = createMailer();
    $userMail->setFrom('support@axtechnologies.net', 'AX Technologies Support Desk');
    $userMail->addAddress($email, $name);
    $userMail->addReplyTo('support@axtechnologies.net', 'AX Technologies Support Desk');

    $userMail->isHTML(true);
    $userMail->Subject = "We Have Received Your Message - AX Technologies Uganda";

    $userHtml = "
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset='UTF-8'>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6; }
        .wrapper { max-width: 620px; margin: 20px auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; }
        .brand-header { padding-bottom: 16px; border-bottom: 2px solid #0047ab; margin-bottom: 20px; }
        .brand-title { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
        .brand-title span { color: #f97316; }
        .tagline { font-size: 13px; color: #64748b; margin-top: 2px; }
        .greeting { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
        .summary-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; margin: 18px 0; }
        .summary-title { font-size: 13px; font-weight: 700; text-transform: uppercase; color: #0047ab; margin-bottom: 8px; }
        .summary-item { font-size: 13px; margin-bottom: 6px; }
        .summary-item strong { color: #334155; }
        .contact-box { background: #eff6ff; border-left: 4px solid #0047ab; padding: 12px 16px; border-radius: 4px; margin: 20px 0; font-size: 13px; }
        .footer-note { font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 14px; margin-top: 24px; text-align: center; }
      </style>
    </head>
    <body>
      <div class='wrapper'>
        <div class='brand-header'>
          <div class='brand-title'>AX <span>TECHNOLOGIES</span> UGANDA</div>
          <div class='tagline'>Web Application &amp; Enterprise Software Engineering &bull; Bushenyi, Uganda</div>
        </div>

        <div class='greeting'>Dear " . htmlspecialchars($name) . ",</div>

        <p>Thank you for reaching out to <strong>AX Technologies Uganda</strong>.</p>

        <p>We have successfully received your inquiry regarding <strong>" . htmlspecialchars($service) . "</strong>. Our software engineering and technical support team has been notified and will review your request and get back to you shortly.</p>

        <div class='summary-box'>
          <div class='summary-title'>Inquiry Summary</div>
          <div class='summary-item'><strong>Subject / Service:</strong> " . htmlspecialchars($service) . "</div>
          " . ($phone ? "<div class='summary-item'><strong>Phone Number:</strong> " . htmlspecialchars($phone) . "</div>" : "") . "
          <div class='summary-item'><strong>Your Message:</strong></div>
          <div style='font-size: 13px; color: #475569; margin-top: 4px; white-space: pre-wrap; font-style: italic;'>\"" . htmlspecialchars($message) . "\"</div>
        </div>

        <div class='contact-box'>
          <strong>Need immediate assistance?</strong><br>
          If your request is urgent, you can also reach our support desk directly via:
          <ul style='margin: 6px 0 0; padding-left: 18px;'>
            <li>Phone / WhatsApp: <strong>0772 651 444</strong> or <strong>0740 233 225</strong></li>
            <li>Email: <a href='mailto:axtechnologiesug@gmail.com' style='color:#0047ab;'>axtechnologiesug@gmail.com</a></li>
            <li>Office: <strong>Bushenyi, Uganda</strong></li>
          </ul>
        </div>

        <p style='margin-top: 20px;'>
          Best regards,<br>
          <strong>AX Technologies Support &amp; Engineering Team</strong><br>
          <span style='font-size: 12px; color: #64748b;'>Empowering Ugandan schools, pharmacies, merchants, and enterprises with custom technology.</span>
        </p>

        <div class='footer-note'>
          &copy; " . date('Y') . " AX Technologies Uganda. All rights reserved.<br>
          This is an automated confirmation sent because an inquiry was submitted with this email address.
        </div>
      </div>
    </body>
    </html>";

    $userMail->Body = $userHtml;
    $userMail->AltBody = "Dear $name,\n\nThank you for reaching out to AX Technologies Uganda. We have successfully received your inquiry regarding \"$service\". Our support team has been notified and will get back to you shortly.\n\nSummary of your message:\n$message\n\nFor urgent inquiries, reach us at 0772 651 444 / 0740 233 225 or axtechnologiesug@gmail.com.\n\nBest regards,\nAX Technologies Uganda Team\nBushenyi, Uganda";

    $userMail->send();
    $autoReplySent = true;
} catch (Exception $e) {
    $mailErrors[] = "Auto-reply error: " . $userMail->ErrorInfo;
}

// Return unified JSON response
if ($adminSent || $autoReplySent) {
    echo json_encode([
        'status'         => 'success',
        'name'           => $name,
        'email'          => $email,
        'message'        => 'Thank you! We have received your email. Our support team will get back to you shortly, and an automated confirmation has been sent to your inbox.',
        'admin_forward'  => $adminSent,
        'auto_reply'     => $autoReplySent
    ]);
} else {
    // If both failed to send over network, still succeed with client because local JSON log is saved
    echo json_encode([
        'status'         => 'success',
        'name'           => $name,
        'email'          => $email,
        'message'        => 'Thank you! Your message has been logged securely in our system. Our team will get back to you shortly.',
        'admin_forward'  => false,
        'auto_reply'     => false,
        'errors'         => $mailErrors
    ]);
}
exit;
