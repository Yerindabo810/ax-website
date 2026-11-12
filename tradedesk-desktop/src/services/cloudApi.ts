import { CloudBusiness, CloudUser } from '../types';

let cachedProfileToken: string | null = null;
export function setCachedProfileToken(tok: string | null) {
  cachedProfileToken = tok;
}

export const DEFAULT_CLOUD_API_URL = 'https://axtechnologies.net/tradedeskmobile/api';
export const FALLBACK_CLOUD_API_URL = 'https://www.axtechnologies.net/tradedeskmobile/api';

let activeApiBaseUrl = DEFAULT_CLOUD_API_URL;
let activeAuthToken: string | null = null;

export function setCloudApiConfig(apiUrl?: string | null, token?: string | null) {
  if (apiUrl && apiUrl.trim()) {
    activeApiBaseUrl = apiUrl.trim().replace(/\/+$/, '');
  }
  if (token !== undefined) {
    activeAuthToken = token;
  }
}

export function getCloudApiBaseUrl(): string {
  return activeApiBaseUrl;
}

async function apiRequest<T = any>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: any;
    params?: Record<string, string | number | undefined>;
    token?: string | null;
    timeoutMs?: number;
  } = {}
): Promise<T> {
  let effectiveToken = options.token !== undefined ? options.token : activeAuthToken;
  if (!effectiveToken && cachedProfileToken) {
    effectiveToken = cachedProfileToken;
    activeAuthToken = cachedProfileToken;
  }
  const { method = 'GET', body, params, timeoutMs = 15000 } = options;
  const token = effectiveToken;

  const buildUrl = (base: string) => {
    let url = `${base}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const allParams: Record<string, any> = { ...(params || {}) };
    if (method === 'GET') {
      allParams._t = Date.now();
    }
    const qs = Object.entries(allParams)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (qs) url += `?${qs}`;
    return url;
  };

  const executeFetch = async (baseUrl: string): Promise<T> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(buildUrl(baseUrl), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        cache: 'no-store',
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { message: text || `HTTP ${res.status}` };
      }

      if (!res.ok) {
        const errMessage =
          data?.message ||
          (data?.errors ? Object.values(data.errors).flat().join(' ') : null) ||
          `Request failed (${res.status})`;
        const error: any = new Error(errMessage);
        error.status = res.status;
        error.data = data;
        throw error;
      }

      return data as T;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return await executeFetch(activeApiBaseUrl);
  } catch (err: any) {
    // If network/404 failure on default URL, try fallback URL once
    if (
      activeApiBaseUrl === DEFAULT_CLOUD_API_URL &&
      (!err.status || err.status === 404 || err.status >= 502)
    ) {
      return await executeFetch(FALLBACK_CLOUD_API_URL);
    }
    throw err;
  }
}

export interface DiscoveredStore {
  id: number;
  name: string;
  subdomain: string;
  category: string;
  location: string;
  phone?: string;
  branches_count?: number;
  logo_url?: string;
}

export interface PortalLoginResponse {
  success?: boolean;
  message?: string;
  requires_otp?: boolean;
  needs_setup?: boolean;
  email?: string;
  masked_email?: string;
  subdomain?: string;
  token?: string;
  user?: CloudUser;
  business?: CloudBusiness;
}

export const cloudApi = {
  // ============================================================
  // 1. AUTHENTICATION & STORE REGISTRATION (TradeDesk Web App Method)
  // ============================================================

  async checkEmailRegistered(email: string): Promise<{
    exists: boolean;
    message: string;
    subdomain?: string;
    business_name?: string;
  }> {
    return apiRequest('/auth/check-email', {
      method: 'GET',
      params: { email: email.trim().toLowerCase() },
    });
  },

  async sendEmailOtp(email: string): Promise<{ success: boolean; message: string }> {
    return apiRequest('/auth/send-otp', {
      method: 'POST',
      body: { email: email.trim().toLowerCase() },
    });
  },

  async verifyEmailOtp(email: string, otp: string): Promise<{ success: boolean; message: string }> {
    return apiRequest('/auth/verify-otp', {
      method: 'POST',
      body: { email: email.trim().toLowerCase(), otp: otp.trim() },
    });
  },

  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    return apiRequest('/auth/forgot-password', {
      method: 'POST',
      body: { email: email.trim().toLowerCase() },
    });
  },

  async resetPassword(
    email: string,
    otp: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    return apiRequest('/auth/reset-password', {
      method: 'POST',
      body: {
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        new_password: newPassword,
      },
    });
  },

  async updatePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    return apiRequest('/user/update-password', {
      method: 'POST',
      body: {
        current_password: currentPassword,
        new_password: newPassword,
      },
    });
  },

  async checkSubdomainAvailability(subdomain: string): Promise<{
    available: boolean;
    subdomain?: string;
    message: string;
  }> {
    try {
      return await apiRequest('/auth/check-subdomain', {
        method: 'GET',
        params: { subdomain: subdomain.trim().toLowerCase() },
      });
    } catch (err: any) {
      return {
        available: false,
        message: err.message || 'Subdomain is unavailable',
      };
    }
  },

  async registerStore(payload: {
    business_name: string;
    subdomain?: string;
    category: string;
    location: string;
    phone?: string;
    currency?: string;
    tin_number?: string;
    user_name: string;
    email: string;
    password?: string;
    firebase_uid?: string;
    auth_provider: 'email' | 'google';
  }): Promise<{
    success: boolean;
    message: string;
    business: CloudBusiness;
    user: CloudUser;
    token: string;
  }> {
    return apiRequest('/auth/register-store', {
      method: 'POST',
      body: payload,
    });
  },

  // Portal Google Login (Exact same logic as TradeDesk Web App portalGoogleLogin)
  async portalGoogleLogin(data: {
    email: string;
    firebase_uid?: string;
    name?: string;
  }): Promise<PortalLoginResponse & { is_new?: boolean }> {
    return apiRequest('/auth/google-login', {
      method: 'POST',
      body: data,
    });
  },

  async pollGoogleSession(sessionId: string): Promise<{
    completed: boolean;
    user?: {
      email: string;
      name: string;
      firebase_uid: string;
    };
  }> {
    return apiRequest('/auth/google-session-poll', {
      method: 'GET',
      params: { session_id: sessionId },
    });
  },

  async googleSendOtp(email: string): Promise<{
    success: boolean;
    is_existing_user?: boolean;
    user_name?: string | null;
    message: string;
  }> {
    return apiRequest('/auth/google-send-otp', {
      method: 'POST',
      body: { email: email.trim().toLowerCase() },
    });
  },

  async googleVerifyOtp(
    email: string,
    otp: string
  ): Promise<PortalLoginResponse & { needs_setup?: boolean }> {
    return apiRequest('/auth/google-verify', {
      method: 'POST',
      body: { email: email.trim().toLowerCase(), otp: otp.trim() },
    });
  },

  async findStore(query: string): Promise<DiscoveredStore[]> {
    try {
      const res = await apiRequest<{ success: boolean; stores: DiscoveredStore[] }>('/auth/find-store', {
        method: 'GET',
        params: { query: query.trim() },
      });
      return res.stores || [];
    } catch {
      return [];
    }
  },

  async portalLogin(email: string, password: string): Promise<PortalLoginResponse> {
    return apiRequest<PortalLoginResponse>('/auth/portal-login', {
      method: 'POST',
      body: { email: email.trim().toLowerCase(), password },
    });
  },

  async storeSubdomainLogin(
    subdomain: string,
    emailOrPhone: string,
    password: string
  ): Promise<PortalLoginResponse> {
    return apiRequest<PortalLoginResponse>('/auth/store-login', {
      method: 'POST',
      body: {
        subdomain: subdomain.trim().toLowerCase(),
        email: emailOrPhone.trim(),
        password,
      },
    });
  },

  async verifyLoginOtp(
    email: string,
    otp: string,
    subdomain?: string
  ): Promise<PortalLoginResponse> {
    return apiRequest<PortalLoginResponse>('/auth/verify-login-otp', {
      method: 'POST',
      body: { email: email.trim().toLowerCase(), otp: otp.trim(), subdomain },
    });
  },

  async resendLoginOtp(email: string): Promise<{ success: boolean; message: string }> {
    return apiRequest('/auth/resend-login-otp', {
      method: 'POST',
      body: { email: email.trim().toLowerCase() },
    });
  },

  async fetchMe(token?: string): Promise<{ success: boolean; user: CloudUser; business: CloudBusiness }> {
    return apiRequest('/auth/me', {
      method: 'GET',
      token: token || activeAuthToken,
    });
  },

  async logout(): Promise<void> {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // ignore offline logout error
    }
  },

  // ============================================================
  // 2. MOBILE MONEY & MARZPAY GATEWAY (Requires Internet + Auth)
  // ============================================================

  calculateMomoCharge(commodityAmount: number, feePercent: number = 2.5): number {
    return Math.max(200, Math.ceil((commodityAmount * feePercent) / 100));
  },

  async verifyPhone(phoneNumber: string): Promise<{
    status: 'success' | 'error';
    message?: string;
    data?: {
      success: boolean;
      phone_number: string;
      account_name: string;
      provider: string;
    };
  }> {
    return apiRequest('/pos/momo/verify-phone', {
      method: 'POST',
      body: { phone_number: phoneNumber },
    });
  },

  async requestMomoPrompt(payload: {
    phone_number: string;
    amount: number;
    business_id: number | string;
    reference?: string;
    description?: string;
  }): Promise<{
    status: 'success' | 'error';
    message: string;
    data?: {
      success: boolean;
      status: string;
      internal_reference?: string;
      customer_reference?: string;
      gateway_reference?: string;
      phone_number: string;
      provider: string;
      commodity_amount: number;
      charge: number;
      total_prompted: number;
      is_simulated?: boolean;
    };
  }> {
    return apiRequest('/pos/momo/request-prompt', {
      method: 'POST',
      body: payload,
    });
  },

  async checkMomoStatus(
    internalReference: string,
    businessId?: number | string,
    amount?: number,
    reference?: string,
    provider?: string
  ): Promise<{
    status: 'success' | 'error';
    payment_status: 'pending' | 'processing' | 'success' | 'successful' | 'completed' | 'failed' | 'cancelled';
    is_completed: boolean;
    is_failed?: boolean;
    data?: any;
  }> {
    return apiRequest(`/pos/momo/check-status/${encodeURIComponent(internalReference)}`, {
      method: 'GET',
      params: {
        business_id: businessId,
        amount,
        reference,
        customer_reference: reference,
        provider,
      },
    });
  },

  async getCloudMomoBalance(businessId: number | string): Promise<any> {
    return apiRequest('/pos/momo/balance', {
      method: 'GET',
      params: { business_id: businessId },
    });
  },

  async sendPaymentOtp(payload: {
    business_id: number | string;
    action_type: 'bill_payment' | 'airtime' | 'withdrawal' | string;
    amount: number;
    details?: string;
  }): Promise<{ status: string; message: string; masked_email?: string }> {
    return apiRequest('/pos/momo/send-payment-otp', {
      method: 'POST',
      body: payload,
    });
  },

  async getWithdrawalQuote(amount: number): Promise<{
    status: string;
    data: {
      amount: number;
      marzpay_percent: number;
      marzpay_fee: number;
      platform_percent: number;
      platform_fee: number;
      total_fee: number;
      total_deduction: number;
    };
  }> {
    return apiRequest(`/pos/momo/withdrawal-quote?amount=${encodeURIComponent(amount)}`, {
      method: 'GET',
    });
  },

  async pullBroadcastNotifications(): Promise<{
    status: string;
    count: number;
    data: Array<{
      id: number;
      business_id?: number | null;
      user_id?: number | null;
      title: string;
      message: string;
      type: string;
      action_link?: string;
      action_phone?: string;
      created_by?: string;
      created_at: string;
    }>;
  }> {
    return apiRequest('/notifications/pull', { method: 'GET' });
  },

  async registerPushToken(pushToken: string, platform: string = 'android'): Promise<{
    status: string;
    message: string;
  }> {
    return apiRequest('/users/push-token', {
      method: 'POST',
      body: { push_token: pushToken, platform },
    });
  },

  async withdrawMomo(payload: {
    business_id: number | string;
    amount: number;
    phone_number: string;
    notes?: string;
    user_id?: number | string;
    account_name?: string;
    otp?: string;
  }): Promise<any> {
    return apiRequest('/pos/momo/withdraw', {
      method: 'POST',
      body: payload,
    });
  },

  // ============================================================
  // 3. VALUE ADDED SERVICES: AIRTIME, DATA & UTILITY BILLS
  // ============================================================

  async getAirtimeCatalog(): Promise<{ status: string; data: any }> {
    return apiRequest('/pos/airtime/catalog', { method: 'GET' });
  },

  async purchaseAirtimeOrData(payload: {
    business_id: number | string;
    purchase_type: 'airtime' | 'data';
    phone_number: string;
    amount: number;
    bundle_code?: string;
    user_id?: number | string;
    otp?: string;
  }): Promise<any> {
    return apiRequest('/pos/airtime/purchase', {
      method: 'POST',
      body: payload,
    });
  },

  async getBillServices(): Promise<{
    status: string;
    data: {
      utilities: Array<{
        code: string;
        name: string;
        category: string;
        description: string;
      }>;
      nwsc_areas: string[];
      dstv_bouquets: any;
      gotv_bouquets: any;
    };
  }> {
    return apiRequest('/pos/bills/services', { method: 'GET' });
  },

  async verifyBillAccount(
    utilityCode: string,
    meterNumber: string,
    area?: string
  ): Promise<{
    success: boolean;
    utility_code?: string;
    meter_number?: string;
    customer_name?: string;
    bouquet_code?: string;
    bouquet_name?: string;
    bouquet_price?: string | number;
    message?: string;
  }> {
    return apiRequest('/pos/bills/verify', {
      method: 'POST',
      body: {
        utility_code: utilityCode,
        meter_number: meterNumber,
        area: area || undefined,
      },
    });
  },

  async payBill(payload: {
    business_id: number | string;
    utility_code: string;
    meter_number: string;
    amount: number;
    phone_number: string;
    customer_name?: string;
    area?: string;
    bouquet_code?: string;
    user_id?: number | string;
    otp?: string;
  }): Promise<any> {
    return apiRequest('/pos/bills/pay', {
      method: 'POST',
      body: payload,
    });
  },

  // ============================================================
  // 4. CLOUD BACKUP & PHONE LOSS RECOVERY (Standalone Mobile DB)
  // ============================================================

  async uploadCloudBackup(
    snapshot: Record<string, any>,
    statsSummary?: Record<string, any>
  ): Promise<{
    success: boolean;
    backup_id: number;
    backed_up_at: string;
    message: string;
  }> {
    return apiRequest('/cloud/backup', {
      method: 'POST',
      body: {
        snapshot,
        stats_summary: statsSummary || {},
        device_name: 'TradeDesk Mobile Android',
        app_version: '1.0.0',
      },
      timeoutMs: 30000,
    });
  },

  async downloadCloudBackup(): Promise<{
    success: boolean;
    backup: {
      id: number;
      device_name: string;
      app_version: string;
      created_at: string;
      stats_summary: Record<string, any>;
      snapshot: Record<string, any>;
    };
  }> {
    return apiRequest('/cloud/restore', {
      method: 'GET',
      timeoutMs: 30000,
    });
  },

  async subscribeToPlan(payload: {
    plan_code: string;
    phone_number: string;
  }): Promise<{
    status: string;
    message: string;
    internal_reference?: string;
    customer_reference?: string;
    amount?: number;
    plan_code?: string;
    plan_days?: number;
  }> {
    return apiRequest('/cloud/subscribe', {
      method: 'POST',
      body: payload,
    });
  },

  async confirmSubscription(payload: {
    internal_reference: string;
    plan_code: string;
    days: number;
  }): Promise<{
    status: string;
    is_completed?: boolean;
    is_failed?: boolean;
    message: string;
    plan?: string;
    subscription_expires_at?: string;
  }> {
    return apiRequest('/cloud/confirm-subscription', {
      method: 'POST',
      body: payload,
    });
  },
};


