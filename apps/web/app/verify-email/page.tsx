"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense, useRef } from "react";
import { Mail, RefreshCw, CheckCircle, ArrowRight, AlertCircle, Loader2, ShieldCheck, XCircle } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  // Mode: "VERIFYING" (Token present) or "INBOX" (No Token, waiting for user)
  const mode = token ? "VERIFYING" : "INBOX";

  // State for Inbox Mode
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState("");
  const [countdown, setCountdown] = useState(0);

  // State for Verify Mode
  const [verifyStatus, setVerifyStatus] = useState<"IDLE" | "LOADING" | "SUCCESS" | "ERROR">("IDLE");
  const [verifyMessage, setVerifyMessage] = useState("");
  const processedToken = useRef<string | null>(null);

  // Effect: Resend Timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  // Effect: Verify Token
  useEffect(() => {
    if (mode === "VERIFYING" && token && processedToken.current !== token) {
        processedToken.current = token;
        verifyEmail(token);
    }
  }, [token, mode]);

  const verifyEmail = async (token: string) => {
      setVerifyStatus("LOADING");
      try {
          const { verifyEmailAction } = await import("@/app/actions/auth");
          const data = await verifyEmailAction(token);
          
          if (data.success) {
              setVerifyStatus("SUCCESS");
              setVerifyMessage(data.message || "Email verified successfully!");
          } else {
              setVerifyStatus("ERROR");
              setVerifyMessage(data.error || "Verification failed. The link may be invalid or expired.");
          }
      } catch (err) {
          setVerifyStatus("ERROR");
          setVerifyMessage("An unknown error occurred. Please try again.");
      }
  };

  const handleResend = async () => {
    if (!email) return;
    if (countdown > 0) return;

    setResendLoading(true);
    setResendError("");
    setResendSuccess(false);

    try {
      const { resendVerificationAction } = await import("@/app/actions/auth");
      const formData = new FormData();
      formData.append("email", email);
      
      const data = await resendVerificationAction({}, formData);

      if (data.error) {
           // Basic rate limit handling if error string contains generic message, 
           // but real rate limit might just return error.
           setResendError(data.error);
           if (data.error.includes("Too many")) {
                setCountdown(60);
           }
      } else {
        setResendSuccess(true);
        setCountdown(60); // Start 60s cooldown
      }
    } catch (err) {
      setResendError("Something went wrong. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // UI: Verification Mode
  // ------------------------------------------------------------------
  if (mode === "VERIFYING") {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-white p-4 relative overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-600/10 rounded-full blur-[128px] pointer-events-none" />
            
            <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl max-w-md w-full relative z-10">
                
                {verifyStatus === "LOADING" && (
                     <div className="flex flex-col items-center py-8">
                        <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-6" />
                        <h1 className="text-2xl font-bold mb-2">Verifying...</h1>
                        <p className="text-zinc-400">Please wait while we confirm your email.</p>
                     </div>
                )}

                {verifyStatus === "SUCCESS" && (
                    <div className="flex flex-col items-center py-2">
                         <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6 border border-green-500/50">
                            <ShieldCheck className="w-10 h-10 text-green-400" />
                         </div>
                         <h1 className="text-3xl font-bold text-center mb-2 bg-gradient-to-br from-white to-green-400 bg-clip-text text-transparent">
                             Verified!
                         </h1>
                         <p className="text-zinc-400 text-center mb-8">{verifyMessage}</p>
                         
                         <button 
                            onClick={() => router.push("/login")}
                            className="w-full py-3.5 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                        >
                            Continue to Login
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {verifyStatus === "ERROR" && (
                    <div className="flex flex-col items-center py-2">
                        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6 border border-red-500/50">
                           <XCircle className="w-10 h-10 text-red-400" />
                        </div>
                        <h1 className="text-3xl font-bold text-center mb-2 text-white">
                            Verification Failed
                        </h1>
                        <p className="text-red-300 text-center mb-8 bg-red-500/10 p-4 rounded-lg border border-red-500/20">
                            {verifyMessage}
                        </p>
                        
                        <div className="flex flex-col gap-3 w-full">
                            <button 
                                onClick={() => router.push("/login")}
                                className="w-full py-3.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors"
                            >
                                Back to Login
                            </button>
                             {/* If we had the email here, we could offer resend. But often token based verification doesn't carry email in session unless we extracted it from invalid token (risky) or param */}
                             {/* We can offer a generic "Resend" button that goes to a request form? Or just redirect to login which handles "Unverified" flow */}
                        </div>
                    </div>
                )}
            </div>
        </div>
      );
  }

  // ------------------------------------------------------------------
  // UI: Inbox Mode (Check Email)
  // ------------------------------------------------------------------
  if (!email) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
             <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h1 className="text-2xl font-bold mb-2">Invalid Request</h1>
                <p className="text-zinc-400 mb-6">No email address provided.</p>
                <button 
                  onClick={() => router.push("/login")}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-all"
                >
                  Back to Login
                </button>
             </div>
        </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-white p-4 relative overflow-hidden">
      {/* Ambient Background Effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[128px] pointer-events-none" />

      <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl max-w-md w-full relative z-10 transition-all duration-300">
        <div className="flex justify-center mb-8">
            <div className="relative">
                <div className="absolute inset-0 bg-blue-500/30 blur-xl rounded-full" />
                <div className="relative bg-zinc-800 p-4 rounded-full border border-white/10">
                    <Mail className="w-8 h-8 text-blue-400" />
                </div>
            </div>
        </div>

        <h1 className="text-3xl font-bold text-center mb-2 bg-gradient-to-br from-white to-zinc-400 bg-clip-text text-transparent">
          Check your inbox
        </h1>
        
        <p className="text-zinc-400 text-center mb-6 leading-relaxed">
          We've sent a clickable link to <br />
          <span className="text-white font-medium">{email}</span>
        </p>

        {/* Status Messages for Resend */}
        {resendSuccess && (
            <div className="mb-6 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-center gap-2 text-green-400 text-sm">
                <CheckCircle className="w-4 h-4" />
                Email resent successfully!
            </div>
        )}

        {resendError && (
             <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                {resendError}
            </div>
        )}

        <div className="space-y-4">
            <button
              onClick={handleResend}
              disabled={resendLoading || countdown > 0}
              className={`
                w-full py-3.5 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2
                ${countdown > 0 
                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
                    : "bg-white text-black hover:bg-zinc-200 active:scale-[0.98]"
                }
              `}
            >
              {resendLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : countdown > 0 ? (
                <>
                    <RefreshCw className="w-4 h-4" />
                    Resend available in {countdown}s
                </>
              ) : (
                "Resend Email"
              )}
            </button>

            <button 
                onClick={() => router.push("/login")}
                className="w-full py-3.5 bg-transparent hover:bg-white/5 text-zinc-400 hover:text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 group"
            >
                Back to Login
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
        </div>
        
        <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-xs text-zinc-500">
                Did not receive the email? Check your spam folder or wait for the timer to retry.
            </p>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
