import { useAuthStore } from '../store/authStore';

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const { apiBaseUrl, tenantSlug, user } = useAuthStore.getState();

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  let fullUrl: string;

  // Central login/lookup/auth endpoints
  if (
    cleanEndpoint.startsWith('/login') ||
    cleanEndpoint.startsWith('/api/') ||
    cleanEndpoint.startsWith('/password')
  ) {
    fullUrl = `${apiBaseUrl}${cleanEndpoint}`;
  } else if (tenantSlug && !cleanEndpoint.startsWith(`/${tenantSlug}`)) {
    // Tenant mobile endpoint: https://school.axtechnologies.net/{tenantSlug}/mobile{endpoint}
    if (cleanEndpoint.startsWith('/mobile')) {
      fullUrl = `${apiBaseUrl}/${tenantSlug}${cleanEndpoint}`;
    } else {
      fullUrl = `${apiBaseUrl}/${tenantSlug}/mobile${cleanEndpoint}`;
    }
  } else {
    fullUrl = `${apiBaseUrl}${cleanEndpoint}`;
  }

  const defaultHeaders: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...(user?.id ? { 'X-User-Id': String(user.id) } : {}),
    ...(tenantSlug ? { 'X-Tenant-Id': tenantSlug, 'X-Tenant-Slug': tenantSlug } : {}),
  };

  const response = await fetch(fullUrl, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...((options.headers as Record<string, string>) || {}),
    },
    credentials: 'include',
  });

  const responseText = await response.text();

  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    data = { message: responseText };
  }

  if (!response.ok) {
    const errorMsg = data.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}
