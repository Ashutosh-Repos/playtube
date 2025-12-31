# 🔐 PlayTube Authentication Developer Guide

This guide explains the authentication system used in PlayTube (`apps/web`). Use this reference when building new features, admin panels, or protecting routes.

## 1. Architecture Overview
We use a **Hybrid Double-Token System** with a "Server Actions First" approach.

| Token | Type | Lifespan | Storage | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Access Token** | JWT | 15 min | HttpOnly Cookie | Stateless, fast verification. |
| **Refresh Token** | UUID | 30 Days | HttpOnly Cookie + DB | Stateful, widely revocable. |

### Key Features
*   **Auto-Refresh**: Middleware automatically rotates expired access tokens using the refresh token. Users are never logged out unexpectedly.
*   **Security**: Includes Token Rotation, Reuse Detection (Anti-Replay), and Remote Revocation.
*   **Performance**: Redis Cache-Aside pattern for sub-millisecond session validation.

---

## 2. Protecting Routes & Components

### A. Protecting a Page (Server Component)
Use the `verifySession()` helper. It returns the user or redirects if invalid.
```tsx
import { verifySession } from "@/lib/auth/session-server";

export default async function ProtectedPage() {
  const session = await verifySession(); // Throws or redirects if invalid

  return <div>Welcome, {session.user.name}</div>;
}
```

### B. Protecting an API Route (Route Handler)
Use the `validateSession()` helper.
```tsx
import { validateSession } from "@/lib/auth/session";

export async function GET() {
  const session = await validateSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ userId: session.sub });
}
```

### C. Client-Side Auth State
Use the `useAuth` hook for UI interactions (e.g., hiding buttons), but **always verify on the server**.
```tsx
"use client";
import { useAuth } from "@/context/auth-context";

export function UserMenu() {
  const { user, logout } = useAuth();

  if (!user) return <LoginButton />;
  return <button onClick={logout}>Sign Out</button>;
}
```

---

## 3. Server Actions (Mutations)
Always validate the session *inside* the action. Do not trust the client state.

```tsx
"use server";
import { validateSession } from "@/lib/auth/session";

export async function updateProfile(formData: FormData) {
  const session = await validateSession();
  if (!session) return { error: "Unauthorized" };

  // ... Update Logic ...
}
```

---

## 4. Debugging & Troubleshooting

### "I keep getting logged out in Dev"
*   **Cause**: Dev mode Access Token lifespan is set to **1 minute** to test auto-refresh.
*   **Fix**: Check `lib/auth/cookie.ts`. Set `ACCESS_MAX_AGE` to `15 * 60`.

### "Infinite Redirect Loop"
*   **Cause**: You added a new public route but forgot to add it to `middleware.ts` -> `PUBLIC_PATHS`.
*   **Fix**: Add your path to `PUBLIC_PATHS` to bypass the auth check.

### "405 Method Not Allowed" on Refresh
*   **Cause**: Middleware redirected a POST request, but the destination only handled GET.
*   **Fix**: Ensure `/api/auth/refresh-session` handles POST (Already fixed).

---

## 5. Security Best Practices
1.  **Never expose tokens**: Never send `auth_token` or `auth_refresh` to the client via JSON. They must stay in HttpOnly cookies.
2.  **Graceful Degradation**: If Redis is down, the system falls back to the Database automatically. No action needed but monitor logs.
3.  **Role Checks**: Just checking `validateSession` confirms *identity*. For *permissions*, check `session.role === 'ADMIN'`.

---

**File Locations:**
*   Session Logic: `apps/web/lib/auth/session.ts`
*   Cookie Config: `apps/web/lib/auth/cookie.ts`
*   Middleware: `apps/web/middleware.ts`
*   Server Actions: `apps/web/app/actions/auth.ts`
