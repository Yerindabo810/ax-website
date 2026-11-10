<?php

namespace TradeDeskMobile;

class SmtpMailer
{
    private array $config;

    public function __construct(array $mailConfig)
    {
        $this->config = $mailConfig;
    }

    /**
     * Sends a multipart HTML + Plain-Text email via authenticated STARTTLS SMTP
     * (`mail.steadfast.crystalcloudhost.net:587`) with fallback to PHP mail().
     */
    public function send(string $toEmail, string $subject, string $htmlBody, string $plainBody = ''): bool
    {
        $host = $this->config['host'] ?? 'mail.steadfast.crystalcloudhost.net';
        $port = (int) ($this->config['port'] ?? 587);
        $username = $this->config['username'] ?? 'verify@axtechnologies.net';
        $password = $this->config['password'] ?? '';
        $fromEmail = $this->config['from_address'] ?? $username;
        $fromName = $this->config['from_name'] ?? 'TradeDesk Mobile';

        if ($plainBody === '') {
            $plainBody = trim(strip_tags($htmlBody));
        }

        $boundary = '=_NextPart_' . md5((string) microtime(true));
        $headers = [
            "Date: " . date('r'),
            "From: \"{$fromName}\" <{$fromEmail}>",
            "Reply-To: {$fromEmail}",
            "To: <{$toEmail}>",
            "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=",
            "Message-ID: <" . bin2hex(random_bytes(8)) . "@axtechnologies.net>",
            "MIME-Version: 1.0",
            "Content-Type: multipart/alternative; boundary=\"{$boundary}\"",
        ];

        $messageBody = "--{$boundary}\r\n"
            . "Content-Type: text/plain; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($plainBody)) . "\r\n"
            . "--{$boundary}\r\n"
            . "Content-Type: text/html; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($htmlBody)) . "\r\n"
            . "--{$boundary}--\r\n";

        try {
            $context = stream_context_create([
                'ssl' => [
                    'verify_peer' => false,
                    'verify_peer_name' => false,
                    'allow_self_signed' => true,
                ],
            ]);

            $remote = ($port === 465 ? "ssl://{$host}:{$port}" : "tcp://{$host}:{$port}");
            $socket = @stream_socket_client($remote, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $context);

            if ($socket) {
                stream_set_timeout($socket, 15);
                $this->readResponse($socket);
                $this->sendCommand($socket, "EHLO axtechnologies.net");

                if ($port === 587) {
                    $this->sendCommand($socket, "STARTTLS");
                    stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
                    $this->sendCommand($socket, "EHLO axtechnologies.net");
                }

                $this->sendCommand($socket, "AUTH LOGIN");
                $this->sendCommand($socket, base64_encode($username));
                $this->sendCommand($socket, base64_encode($password));

                $this->sendCommand($socket, "MAIL FROM:<{$fromEmail}>");
                $this->sendCommand($socket, "RCPT TO:<{$toEmail}>");
                $this->sendCommand($socket, "DATA");

                $fullData = implode("\r\n", $headers) . "\r\n\r\n" . $messageBody . "\r\n.";
                $this->sendCommand($socket, $fullData);
                $this->sendCommand($socket, "QUIT");
                fclose($socket);
                return true;
            }
        } catch (\Throwable $e) {
            // Fall through to native mail() fallback
        }

        $fallbackHeaders = "MIME-Version: 1.0\r\n"
            . "Content-type: text/html; charset=UTF-8\r\n"
            . "From: {$fromName} <{$fromEmail}>\r\n"
            . "Reply-To: {$fromEmail}\r\n";

        return @mail($toEmail, $subject, $htmlBody, $fallbackHeaders);
    }

    private function sendCommand($socket, string $cmd): string
    {
        fwrite($socket, $cmd . "\r\n");
        return $this->readResponse($socket);
    }

    private function readResponse($socket): string
    {
        $response = '';
        while ($line = fgets($socket, 515)) {
            $response .= $line;
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }
        return $response;
    }
}

