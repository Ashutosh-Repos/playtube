"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { 
  Laptop, 
  Smartphone, 
  Globe, 
  ShieldCheck, 
  LogOut,
  Clock,
  MapPin
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";

interface Session {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  isCurrent: boolean;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    (async () => {
        try {
            const { getSessionsAction } = await import("@/app/actions/auth");
            const result = await getSessionsAction();
            if (result.error) throw new Error(result.error);
            if (result.sessions) setSessions(result.sessions);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    })();
  }, []);

  // ... existing revokeSession ... 
  
  // (Keep revokeSession and revokeAll the same)
  // I must be careful not to delete them if I replace the whole file or chunk.
  // The tool replaces contiguous block.
  // I need to insert `useState` at top and update `useEffect` and `render`.
  // Wait, I can't easily inject `useState` with a single replace if I target `useEffect`.
  // I'll replace the top part of the component.
  
  // Actually, let's just use `console.log` for now to avoid UI clutter?
  // But user can't see console easily in screenshot. 
  // I will render it.
  
  // I will assume I can replace the start of the component up to useEffect end.
  
  // ...


  const revokeSession = async (id: string, isCurrent: boolean) => {
    if (!confirm(isCurrent ? "This will log you out immediately. Continue?" : "Are you sure you want to log out this device?")) return;
    
    if (isCurrent) {
        await logout();
        return;
    }

    try {
      const { revokeSessionByIdAction } = await import("@/app/actions/auth");
      const res = await revokeSessionByIdAction(id);
      
      if (res.error) throw new Error(res.error);
      
      if (res.isCurrent) {
          router.push("/login"); // or call logout() to be safe
          return;
      }

      // Optimistic update
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const revokeAll = async () => {
     if (!confirm("Sign out of all other devices?")) return;
     alert("Feature coming soon: Revoke All");
  };
  
  // Loading state remains content below...
  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );

  if (error && error !== "Unauthorized") {
      return (
         <div className="max-w-3xl mx-auto py-12 px-6">
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
                {error}
            </div>
         </div>
      );
  }

  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <ShieldCheck className="w-8 h-8 text-blue-600" />
                Active Sessions
            </h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
                Manage the devices logged into your account.
            </p>
        </div>
      </div>

      <div className="space-y-4">
        {sessions.length === 0 ? (
          <div className="p-12 border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-xl text-center">
            <p className="text-gray-500">No active sessions found.</p>
          </div>
        ) : (
          sessions.map((session) => {
            const isCurrent = session.isCurrent;
            const { icon: DeviceIcon, label: deviceLabel } = getDeviceIcon(session.userAgent || "Unknown Device");
            
            return (
                <div
                key={session.id}
                className={`
                    relative group flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 rounded-xl transition-all
                    ${isCurrent 
                        ? "bg-blue-50/50 border-2 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800" 
                        : "bg-white border border-gray-100 dark:bg-zinc-800/50 dark:border-zinc-700 hover:shadow-md"
                    }
                `}
                >
                <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-full ${isCurrent ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "bg-gray-100 text-gray-500 dark:bg-zinc-700 dark:text-zinc-400"}`}>
                        <DeviceIcon className="w-6 h-6" />
                    </div>
                    
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                                {deviceLabel}
                            </h3>
                            {isCurrent && (
                                <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 bg-blue-600 text-white rounded-full">
                                    Current Device
                                </span>
                            )}
                        </div>
                        
                        <div className="space-y-1 text-sm text-gray-500 dark:text-gray-400">
                            <div className="flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5" />
                                <span>{session.ipAddress || "Unknown IP"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5" />
                                <span title={new Date(session.lastUsedAt).toLocaleString()}>
                                    Active {formatDistanceToNow(new Date(session.lastUsedAt))} ago
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="mt-4 sm:mt-0 sm:ml-4 w-full sm:w-auto">
                    {!isCurrent && (
                        <button
                            onClick={() => revokeSession(session.id, isCurrent)}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors dark:hover:bg-red-900/20 dark:text-red-400 border border-transparent hover:border-red-100"
                        >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                        </button>
                    )}
                    {isCurrent && (
                        <button
                            onClick={() => revokeSession(session.id, isCurrent)}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                        >
                             <LogOut className="w-4 h-4" />
                             Sign Out Now
                        </button>
                    )}
                </div>
                </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Improved User Agent Parsing
function getDeviceIcon(ua: string) {
  const lower = ua.toLowerCase();
  
  if (lower.includes("mobile") || lower.includes("android") || lower.includes("iphone")) {
    return { icon: Smartphone, label: parseMobileName(ua) };
  }
  
  return { icon: Laptop, label: parseDesktopName(ua) };
}

function parseMobileName(ua: string): string {
    if (ua.includes("iPhone")) return "iPhone";
    if (ua.includes("iPad")) return "iPad";
    if (ua.includes("Android")) return "Android Device";
    return "Mobile Device";
}

function parseDesktopName(ua: string): string {
    if (ua.includes("Macintosh")) return "MacBook / iMac";
    if (ua.includes("Windows")) return "Windows PC";
    if (ua.includes("Linux")) return "Linux Machine";
    return "Desktop Computer";
}
