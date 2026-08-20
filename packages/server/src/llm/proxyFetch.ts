import { ProxyAgent, fetch as undiciFetch } from "undici";

export interface HttpResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

export interface HttpFetch {
  (url: string, init: { method: string; headers: Record<string, string>; body: string }): Promise<HttpResponse>;
}

// Node's global fetch (undici under the hood) ignores HTTP_PROXY/HTTPS_PROXY
// env vars — unlike curl, it needs an explicit dispatcher. This matters when
// a provider is geo-blocked (e.g. OpenAI 403s from Russian IPs) and requests
// need to go through a local proxy (Hiddify/VLESS etc. usually expose one on
// 127.0.0.1).
export function createHttpFetch(proxyUrl: string | undefined): HttpFetch {
  if (!proxyUrl) return fetch as unknown as HttpFetch;

  const dispatcher = new ProxyAgent(proxyUrl);
  return ((url: string, init: Parameters<HttpFetch>[1]) =>
    undiciFetch(url, { ...init, dispatcher })) as unknown as HttpFetch;
}
