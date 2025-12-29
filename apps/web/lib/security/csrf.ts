import { headers } from "next/headers";

/**
 * Verifies that the request Origin matches the Host.
 * Protects against CSRF in API Route Handlers.
 */
export async function checkOrigin(request: Request) {
  // 1. Skip for GET/HEAD (Safe methods)
  if (request.method === "GET" || request.method === "HEAD") return true;

  const headerStore = await headers();
  const origin = headerStore.get("origin");
  
  // 2. Resolve Host (Support Proxies like Vercel/Nginx)
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host");

  // 3. If no Origin, strictly check Referer (Optional fallback, but Origin is standard)
  if (!origin) return false;

  // 4. Compare
  const originUrl = new URL(origin);
  
  // Strict Same-Origin Check
  if (originUrl.host !== host) {
    if (process.env.ALLOWED_ORIGINS) {
        const allowed = process.env.ALLOWED_ORIGINS.split(",");
        if (allowed.includes(origin)) return true;
    }
    
    console.warn(`CSRF Mismatch: Origin ${originUrl.host} vs Host ${host}`);
    return false;
  }

  return true;
}
