import { getCurrentUserAction } from "@/app/actions/auth";
import { AuthProvider } from "./auth-context";

/**
 * Server Component Wrapper for AuthProvider.
 * Fetches session implicitly so Layout doesn't have to.
 */
export async function SessionProvider({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserAction();
  return (
    <AuthProvider initialUser={user}>
      {children}
    </AuthProvider>
  );
}
