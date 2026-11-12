<?php

namespace TradeDeskMobile;

use PDO;

class MarzPayService
{
    private string $baseUrl;
    private string $apiKey;
    private string $apiSecret;
    private string $country;
    private string $callbackUrl;
    private PDO $pdo;

    public function __construct(array $marzConfig, PDO $pdo)
    {
        $this->baseUrl = rtrim($marzConfig['base_url'] ?? 'https://wallet.wearemarz.com/api/v1', '/');
        $this->apiKey = (string) ($marzConfig['api_key'] ?? '');
        $this->apiSecret = (string) ($marzConfig['api_secret'] ?? '');
        $this->country = (string) ($marzConfig['country'] ?? 'UG');
        $this->callbackUrl = (string) ($marzConfig['callback_url'] ?? 'https://axtechnologies.net/tradedeskmobile/api/pos/momo/webhook');
        $this->pdo = $pdo;
    }

    public function isConfigured(): bool
    {
        return $this->apiKey !== '' && $this->apiSecret !== '';
    }

    public function formatPhoneNumber(string $phone): string
    {
        $cleaned = preg_replace('/[^0-9]/', '', $phone);
        if (str_starts_with($cleaned, '256')) {
            return '+' . $cleaned;
        }
        if (str_starts_with($cleaned, '0')) {
            return '+256' . substr($cleaned, 1);
        }
        if (str_starts_with($cleaned, '7') || str_starts_with($cleaned, '3')) {
            return '+256' . $cleaned;
        }
        return '+' . $cleaned;
    }

    public function detectProvider(string $phone): string
    {
        $cleaned = preg_replace('/[^0-9]/', '', $phone);
        if (str_starts_with($cleaned, '256') && strlen($cleaned) >= 5) {
            $prefix = substr($cleaned, 3, 2);
        } elseif (str_starts_with($cleaned, '0') && strlen($cleaned) >= 3) {
            $prefix = substr($cleaned, 1, 2);
        } else {
            $prefix = substr($cleaned, 0, 2);
        }

        if (in_array($prefix, ['77', '78', '76', '39', '79'], true)) {
            return 'MTN';
        }
        if (in_array($prefix, ['70', '75', '74', '20'], true)) {
            return 'AIRTEL';
        }
        return 'MOMO';
    }

    public function calculateFee(float $amount, float $percent = 2.5): float
    {
        return (float) max(200, ceil(($amount * $percent) / 100));
    }

    public static function uuid4(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    private function httpRequest(string $method, string $endpoint, ?array $payload = null, bool $useBearerHeader = false, int $timeout = 25): array
    {
        $url = $this->baseUrl . '/' . ltrim($endpoint, '/');
        $ch = curl_init();

        $headers = [
            'Accept: application/json',
            'Content-Type: application/json',
        ];

        if ($useBearerHeader) {
            $headers[] = "Authorization: Bearer {$this->apiKey}:{$this->apiSecret}";
            $headers[] = "x-api-key: {$this->apiKey}";
        } else {
            curl_setopt($ch, CURLOPT_USERPWD, "{$this->apiKey}:{$this->apiSecret}");
        }

        if (strtoupper($method) === 'GET' && !empty($payload)) {
            $url .= '?' . http_build_query($payload);
        } elseif (strtoupper($method) === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload ?? []));
        }

        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => 0,
        ]);

        $raw = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($raw === false) {
            return [
                'ok' => false,
                'status_code' => 0,
                'error' => $err ?: 'Network connection error',
                'json' => [],
            ];
        }

        $json = json_decode($raw, true);
        return [
            'ok' => $httpCode >= 200 && $httpCode < 300,
            'status_code' => $httpCode,
            'json' => is_array($json) ? $json : [],
        ];
    }

    public function verifyPhone(string $phone): array
    {
        $formattedPhone = $this->formatPhoneNumber($phone);
        $provider = $this->detectProvider($formattedPhone);

        $res = $this->httpRequest('POST', '/phone-verification/verify', [
            'phone_number' => $formattedPhone,
        ]);

        $data = $res['json'];
        if ($res['ok']) {
            $subData = $data['data'] ?? [];
            $fullName = $subData['full_name']
                ?? trim(($subData['first_name'] ?? '') . ' ' . ($subData['last_name'] ?? ''))
                ?: ($data['full_name'] ?? null);

            if (!empty($fullName)) {
                return [
                    'success' => true,
                    'phone_number' => $formattedPhone,
                    'account_name' => strtoupper($fullName),
                    'first_name' => $subData['first_name'] ?? '',
                    'last_name' => $subData['last_name'] ?? '',
                    'provider' => $provider,
                    'verified_at' => $data['verified_at'] ?? date('c'),
                ];
            }
        }

        return [
            'success' => false,
            'phone_number' => $formattedPhone,
            'provider' => $provider,
            'message' => $data['message'] ?? $res['error'] ?? 'Could not resolve registered subscriber name.',
        ];
    }

    public function requestPayment(string $phone, float $amount, string $merchantRef, string $description, int $businessId): array
    {
        $formattedPhone = $this->formatPhoneNumber($phone);
        $provider = $this->detectProvider($formattedPhone);
        $marzpayUuid = self::uuid4();
        $roundAmount = (int) round($amount);

        if ($roundAmount < 500) {
            return [
                'success' => false,
                'status' => 'failed',
                'message' => 'Minimum collection amount for Mobile Money is UGX 500.',
                'error_code' => 'AMOUNT_BELOW_MINIMUM',
            ];
        }

        $payload = [
            'amount' => $roundAmount,
            'phone_number' => $formattedPhone,
            'reference' => $marzpayUuid,
            'country' => $this->country,
            'method' => 'mobile_money',
            'description' => substr($description, 0, 255),
            'callback_url' => $this->callbackUrl,
        ];

        $res = $this->httpRequest('POST', '/collect-money', $payload, false, 30);
        $data = $res['json'];

        if ($res['ok'] && (($data['status'] ?? '') === 'success')) {
            $transaction = $data['data']['transaction'] ?? [];
            $collection = $data['data']['collection'] ?? [];
            $returnedUuid = $transaction['uuid'] ?? $marzpayUuid;
            $detectedProvider = strtoupper($collection['provider'] ?? $provider);
            $charge = $this->calculateFee($amount);

            $stmt = $this->pdo->prepare("
                INSERT INTO mobile_momo_transactions
                (business_id, internal_reference, customer_reference, gateway_reference, type, provider, phone_number, amount, charge, status, description, raw_response)
                VALUES (?, ?, ?, ?, 'collection', ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $businessId,
                $returnedUuid,
                $merchantRef,
                $marzpayUuid,
                $detectedProvider,
                $formattedPhone,
                $amount,
                $charge,
                strtolower($transaction['status'] ?? 'processing'),
                $description,
                json_encode($data),
            ]);

            return [
                'success' => true,
                'status' => strtolower($transaction['status'] ?? 'processing'),
                'internal_reference' => $returnedUuid,
                'customer_reference' => $merchantRef,
                'gateway_reference' => $marzpayUuid,
                'phone_number' => $formattedPhone,
                'provider' => $detectedProvider,
                'commodity_amount' => $amount,
                'charge' => $charge,
                'total_prompted' => $amount,
                'message' => $data['message'] ?? 'Payment prompt dispatched to customer phone.',
            ];
        }

        return [
            'success' => false,
            'status' => 'failed',
            'message' => $data['message'] ?? $res['error'] ?? 'MarzPay payment initiation failed.',
            'error_code' => $data['error_code'] ?? 'MARZPAY_ERROR',
        ];
    }

    public function checkStatus(string $internalRef, ?string $merchantRef = null): array
    {
        // Resolve UUID from mobile_momo_transactions if needed
        $uuidPattern = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i';
        $targetUuid = $internalRef;

        // Collect all possible references to search (internalRef, merchantRef, etc.)
        $refs = array_values(array_unique(array_filter([$internalRef, $merchantRef])));
        $placeholders = implode(',', array_fill(0, count($refs), '?'));

        $stmt = $this->pdo->prepare("SELECT id, business_id, internal_reference, customer_reference, gateway_reference, type, provider, phone_number, amount, charge, status, credited, created_at 
                FROM mobile_momo_transactions 
                WHERE internal_reference IN ($placeholders) 
                   OR customer_reference IN ($placeholders) 
                   OR gateway_reference IN ($placeholders) 
                ORDER BY id DESC LIMIT 1");

        $params = array_merge($refs, $refs, $refs);
        $stmt->execute($params);
        $row = $stmt->fetch();

        if ($row && !empty($row['internal_reference'])) {
            $targetUuid = $row['internal_reference'];
        }

        // 1. PRIMARY INSTANT CHECK: If transaction was ALREADY completed or credited in DB by webhook
        if ($row) {
            $currentStatus = strtolower($row['status'] ?? 'pending');
            $isCredited = !empty($row['credited']);
            $isCompleted = $isCredited || in_array($currentStatus, ['completed', 'successful', 'success'], true);

            if ($isCompleted) {
                return [
                    'success' => true,
                    'status' => 'completed',
                    'is_completed' => true,
                    'is_failed' => false,
                    'message' => 'Payment approved and verified.',
                    'internal_reference' => $targetUuid,
                    'raw' => $row,
                ];
            }

            if (in_array($currentStatus, ['failed', 'cancelled', 'rejected'], true)) {
                return [
                    'success' => true,
                    'status' => 'failed',
                    'is_completed' => false,
                    'is_failed' => true,
                    'message' => 'Payment was rejected or cancelled.',
                    'internal_reference' => $targetUuid,
                    'raw' => $row,
                ];
            }

            // Check if payment has exceeded 5 minutes (300 seconds) without completion -> Auto-Fail
            if (!empty($row['created_at'])) {
                $ageSeconds = time() - strtotime($row['created_at']);
                if ($ageSeconds > 300) {
                    $up = $this->pdo->prepare("UPDATE mobile_momo_transactions SET status = 'failed' WHERE id = ?");
                    $up->execute([$row['id']]);
                    return [
                        'success' => true,
                        'status' => 'failed',
                        'is_completed' => false,
                        'is_failed' => true,
                        'message' => 'Payment expired: Mobile Money prompt was not approved within 5 minutes.',
                    ];
                }
            }
        }

        // 2. Query MarzPay Gateway if not yet completed locally
        $uuidToQuery = preg_match($uuidPattern, $targetUuid) ? $targetUuid : ($row['gateway_reference'] ?? $targetUuid);
        if (preg_match($uuidPattern, $uuidToQuery)) {
            $res = $this->httpRequest('GET', "/collect-money/{$uuidToQuery}", null, false, 15);
            if ($res['ok']) {
                $data = $res['json'];
                $coll = $data['data']['collection'] ?? [];
                $tx = $data['data']['transaction'] ?? [];
                $root = $data['data'] ?? [];

                $status = strtolower($tx['status'] ?? ($coll['status'] ?? ($root['status'] ?? ($data['status'] ?? 'pending'))));
                $isCompleted = in_array($status, ['completed', 'successful', 'success'], true) ||
                    strtolower($coll['status'] ?? '') === 'completed' ||
                    strtolower($tx['status'] ?? '') === 'completed';
                $isFailed = in_array($status, ['failed', 'cancelled', 'rejected'], true) ||
                    in_array(strtolower($coll['status'] ?? ''), ['failed', 'cancelled', 'rejected'], true);

                if ($isCompleted) {
                    if ($row && empty($row['credited'])) {
                        $this->creditBusinessWallet((int) $row['business_id'], (float) $row['amount'], (string) $row['internal_reference'], (string) ($row['provider'] ?? 'MOMO'));
                    } else {
                        $up = $this->pdo->prepare("UPDATE mobile_momo_transactions SET status = 'completed' WHERE internal_reference = ?");
                        $up->execute([$targetUuid]);
                    }
                } elseif ($isFailed) {
                    $up = $this->pdo->prepare("UPDATE mobile_momo_transactions SET status = 'failed' WHERE internal_reference = ?");
                    $up->execute([$targetUuid]);
                }

                if ($isCompleted || $isFailed) {
                    return [
                        'success' => true,
                        'status' => $status,
                        'is_completed' => $isCompleted,
                        'is_failed' => $isFailed,
                        'raw' => $data,
                    ];
                }
            }
        }

        // 3. Fallback: Query /transactions?reference=... across all possible references
        $candidateRefs = array_unique(array_filter([
            $row['gateway_reference'] ?? null,
            $row['customer_reference'] ?? null,
            $row['internal_reference'] ?? null,
            $merchantRef,
            $targetUuid,
        ]));

        foreach ($candidateRefs as $queryRef) {
            $qRes = $this->httpRequest('GET', '/transactions', [
                'reference' => $queryRef,
                'per_page' => 1,
            ], false, 15);

            if ($qRes['ok']) {
                $qData = $qRes['json'];
                $firstTx = $qData['data'][0] ?? null;
                if ($firstTx) {
                    $st = strtolower($firstTx['status'] ?? 'pending');
                    $isCompleted = in_array($st, ['completed', 'successful', 'success'], true);
                    $isFailed = in_array($st, ['failed', 'cancelled', 'rejected'], true);

                    if ($isCompleted) {
                        if ($row && empty($row['credited'])) {
                            $this->creditBusinessWallet((int) $row['business_id'], (float) $row['amount'], (string) $row['internal_reference'], (string) ($row['provider'] ?? 'MOMO'));
                        } elseif ($row) {
                            $up = $this->pdo->prepare("UPDATE mobile_momo_transactions SET status = 'completed' WHERE id = ?");
                            $up->execute([$row['id']]);
                        }
                    } elseif ($isFailed && $row) {
                        $up = $this->pdo->prepare("UPDATE mobile_momo_transactions SET status = 'failed' WHERE id = ?");
                        $up->execute([$row['id']]);
                    }

                    if ($isCompleted || $isFailed) {
                        return [
                            'success' => true,
                            'status' => $st,
                            'is_completed' => $isCompleted,
                            'is_failed' => $isFailed,
                            'raw' => $qData,
                        ];
                    }
                }
            }
        }

        return [
            'success' => false,
            'status' => 'pending',
            'is_completed' => false,
            'is_failed' => false,
            'message' => 'Status pending verification.',
        ];
    }

    public function creditBusinessWallet(int $businessId, float $amount, string $reference, string $provider = 'MOMO'): float
    {
        $stmt = $this->pdo->prepare("SELECT id, credited FROM mobile_momo_transactions WHERE (internal_reference = ? OR customer_reference = ?) AND business_id = ? LIMIT 1");
        $stmt->execute([$reference, $reference, $businessId]);
        $tx = $stmt->fetch();

        if ($tx && (int) $tx['credited'] === 1) {
            $bStmt = $this->pdo->prepare("SELECT wallet_balance FROM mobile_businesses WHERE id = ?");
            $bStmt->execute([$businessId]);
            return (float) ($bStmt->fetchColumn() ?: 0);
        }

        if ($tx) {
            $uTx = $this->pdo->prepare("UPDATE mobile_momo_transactions SET credited = 1, status = 'completed' WHERE id = ?");
            $uTx->execute([$tx['id']]);
        } else {
            $ins = $this->pdo->prepare("INSERT INTO mobile_momo_transactions (business_id, internal_reference, customer_reference, type, provider, amount, status, credited, description) VALUES (?, ?, ?, 'collection', ?, ?, 'completed', 1, 'POS Mobile Money Collection')");
            $ins->execute([$businessId, $reference, $reference, strtoupper($provider), $amount]);
        }

        $upd = $this->pdo->prepare("UPDATE mobile_businesses SET wallet_balance = wallet_balance + ? WHERE id = ?");
        $upd->execute([$amount, $businessId]);

        $bStmt = $this->pdo->prepare("SELECT wallet_balance FROM mobile_businesses WHERE id = ?");
        $bStmt->execute([$businessId]);
        return (float) ($bStmt->fetchColumn() ?: 0);
    }

    public function getWalletBalance(string $country = 'UG'): array
    {
        $res = $this->httpRequest('GET', '/balance', ['country' => $country], false, 15);
        if ($res['ok']) {
            $data = $res['json'];
            $account = $data['data']['account'] ?? [];
            $available = (float) ($account['available_balance']['raw'] ?? $account['balance']['raw'] ?? 0);
            $total = (float) ($account['total_balance']['raw'] ?? $available);
            return [
                'success' => true,
                'balance' => $total,
                'available_balance' => $available,
                'currency' => $account['balance']['currency'] ?? 'UGX',
                'is_configured' => true,
            ];
        }

        return [
            'success' => false,
            'balance' => 0.0,
            'available_balance' => 0.0,
            'currency' => 'UGX',
            'is_configured' => $this->isConfigured(),
        ];
    }

    public function sendMoney(string $phone, float $amount, string $description): array
    {
        $formattedPhone = $this->formatPhoneNumber($phone);
        $provider = $this->detectProvider($formattedPhone);
        $uuidRef = self::uuid4();

        $res = $this->httpRequest('POST', '/send-money', [
            'amount' => (int) round($amount),
            'phone_number' => $formattedPhone,
            'reference' => $uuidRef,
            'country' => $this->country,
            'description' => $description,
            'callback_url' => $this->callbackUrl,
        ], false, 30);

        $data = $res['json'];
        if ($res['ok'] && (($data['status'] ?? '') === 'success' || ($data['success'] ?? false) === true)) {
            return [
                'success' => true,
                'status' => 'pending',
                'reference' => $uuidRef,
                'provider' => $provider,
                'phone_number' => $formattedPhone,
                'message' => $data['message'] ?? 'Disbursement submitted successfully.',
            ];
        }

        return [
            'success' => false,
            'status' => 'failed',
            'error_code' => $data['error_code'] ?? 'DISBURSEMENT_FAILED',
            'message' => $data['message'] ?? $res['error'] ?? 'Disbursement failed on MarzPay.',
        ];
    }

    public function getNwscAreas(): array
    {
        return [
            'Kampala', 'Entebbe', 'Jinja', 'Mukono', 'Iganga', 'Lugazi', 'Kawuku',
            'Kajjansi', 'Mbarara', 'Gulu', 'Mbale', 'Masaka', 'Fort Portal', 'Lira', 'Arua', 'Others'
        ];
    }

    public function getBouquetCodes(string $provider): array
    {
        $provider = strtolower($provider);
        $res = $this->httpRequest('GET', "/bill-payment/{$provider}/bouquet-codes", null, true, 15);
        if ($res['ok']) {
            return $res['json']['data'] ?? [];
        }
        return [];
    }

    public function verifyBillAccount(string $utilityCode, string $meterNumber, ?string $area = null): array
    {
        $utilityCode = strtoupper(trim($utilityCode));
        if (in_array($utilityCode, ['UMEME', 'UEDCL', 'ELECTRICITY', 'POWER'], true)) {
            $utilityCode = 'LIGHT';
        }

        $payload = [
            'utility_code' => $utilityCode,
            'meter_number' => trim($meterNumber),
        ];
        if ($utilityCode === 'NWSC' && $area) {
            $payload['area'] = $area;
        }

        $res = $this->httpRequest('POST', '/bill-payment/verify', $payload, true, 15);
        $data = $res['json'];

        if ($res['ok'] && ($data['status'] ?? '') === 'success') {
            $details = $data['data']['customer_details'] ?? [];
            return [
                'success' => true,
                'utility_code' => $utilityCode,
                'meter_number' => $meterNumber,
                'customer_name' => $details['customer_name'] ?? $details['name'] ?? 'Verified Customer',
                'bouquet_code' => $details['bouquet_code'] ?? null,
                'bouquet_name' => $details['bouquet_name'] ?? null,
                'bouquet_price' => $details['bouquet_price'] ?? null,
            ];
        }

        return [
            'success' => false,
            'message' => $data['message'] ?? $res['error'] ?? 'Could not verify meter/account number.',
        ];
    }

    public function payBill(
        string $utilityCode,
        string $meterNumber,
        float $amount,
        string $phone,
        string $customerName,
        ?string $area = null,
        ?string $bouquetCode = null,
        ?string $email = null
    ): array {
        $utilityCode = strtoupper(trim($utilityCode));
        if (in_array($utilityCode, ['UMEME', 'UEDCL', 'ELECTRICITY', 'POWER'], true)) {
            $utilityCode = 'LIGHT';
        }

        $formattedPhone = $this->formatPhoneNumber($phone);
        $uuidRef = self::uuid4();

        $payload = [
            'reference' => $uuidRef,
            'utility_code' => $utilityCode,
            'meter_number' => trim($meterNumber),
            'phone_number' => $formattedPhone,
            'amount' => (int) round($amount),
            'customer_name' => $customerName ?: 'Customer',
            'callback_url' => $this->callbackUrl,
        ];
        if ($email) {
            $payload['email'] = $email;
        }
        if ($utilityCode === 'NWSC' && $area) {
            $payload['area'] = $area;
        }
        if (($utilityCode === 'DSTV' || $utilityCode === 'GOTV') && $bouquetCode) {
            $payload['bouquet_code'] = $bouquetCode;
        }

        $res = $this->httpRequest('POST', '/bill-payment', $payload, true, 30);
        $data = $res['json'];

        if ($res['ok'] && (($data['status'] ?? '') === 'success' || ($data['success'] ?? false) === true)) {
            $txData = $data['data'] ?? [];
            return [
                'success' => true,
                'status' => 'completed',
                'reference' => $uuidRef,
                'utility_code' => $utilityCode,
                'token' => $txData['token'] ?? $txData['token_number'] ?? null,
                'units' => $txData['units'] ?? null,
                'message' => $data['message'] ?? 'Bill payment processed successfully.',
            ];
        }

        return [
            'success' => false,
            'status' => 'failed',
            'message' => $data['message'] ?? $res['error'] ?? 'Bill payment failed on provider network.',
        ];
    }

    public function getAirtimeDataCatalog(): array
    {
        $res = $this->httpRequest('GET', '/airtime-data/catalog', null, true, 15);
        if ($res['ok']) {
            return $res['json']['data'] ?? [];
        }
        return [];
    }

    public function purchaseAirtimeOrData(string $purchaseType, string $phone, float $amount, ?string $bundleCode = null): array
    {
        $formattedPhone = $this->formatPhoneNumber($phone);
        $msisdn = ltrim($formattedPhone, '+');
        $uuidRef = self::uuid4();

        $payload = [
            'reference' => $uuidRef,
            'purchase_type' => strtolower($purchaseType),
            'msisdn' => $msisdn,
            'amount' => (int) round($amount),
        ];
        if (strtolower($purchaseType) === 'data' && $bundleCode) {
            $payload['bundle_code'] = $bundleCode;
        }

        $res = $this->httpRequest('POST', '/airtime-data', $payload, true, 30);
        $data = $res['json'];

        if ($res['ok'] && (($data['status'] ?? '') === 'success' || ($data['success'] ?? false) === true)) {
            return [
                'success' => true,
                'status' => 'completed',
                'reference' => $uuidRef,
                'purchase_type' => $purchaseType,
                'msisdn' => $msisdn,
                'amount' => $amount,
                'message' => $data['message'] ?? 'Airtime/Data top-up delivered successfully.',
            ];
        }

        return [
            'success' => false,
            'status' => 'failed',
            'message' => $data['message'] ?? $res['error'] ?? 'Airtime/Data purchase failed on provider network.',
        ];
    }
}

