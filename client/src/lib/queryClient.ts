import { QueryClient, QueryFunction } from "@tanstack/react-query";

declare global {
  interface Window {
    shopify?: {
      idToken: () => Promise<string>;
    };
  }
}

async function getShopifySessionToken(): Promise<string | null> {
  try {
    if (typeof window !== "undefined" && window.shopify?.idToken) {
      return await window.shopify.idToken();
    }
  } catch {
    // Running outside Shopify admin context — no token available
  }
  return null;
}

async function buildHeaders(hasBody: boolean): Promise<HeadersInit> {
  const headers: Record<string, string> = hasBody
    ? { "Content-Type": "application/json" }
    : {};
  const token = await getShopifySessionToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function handle402(res: Response) {
  if (res.status === 402) {
    const params = new URLSearchParams(window.location.search);
    const shop = params.get("shop") ?? "";
    const host = params.get("host") ?? "";
    const billingUrl = `/billing${shop ? `?shop=${encodeURIComponent(shop)}` : ""}${host ? `${shop ? "&" : "?"}host=${encodeURIComponent(host)}` : ""}`;
    if (typeof window !== "undefined") {
      window.location.href = billingUrl;
    }
    return true;
  }
  return false;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const headers = await buildHeaders(!!data);
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (handle402(res)) {
    return res;
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    const headers = await buildHeaders(false);
    const res = await fetch(url, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    if (handle402(res)) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
