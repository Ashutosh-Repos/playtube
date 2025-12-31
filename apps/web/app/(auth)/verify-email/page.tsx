"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense, useRef } from "react";
import { Mail, RefreshCw, CheckCircle, ArrowRight, AlertCircle, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { verifyEmailAction, resendVerificationAction } from "@/app/actions/auth";

import { Button } from "@/components/ui/button";
import { CardBody, CardContainer, CardItem } from "@/components/ui/3d-card";

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
      const formData = new FormData();
      formData.append("email", email);
      
      const data = await resendVerificationAction({}, formData);

      if (data.error) {
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
        <CardContainer className="inter-var w-max h-max p-6">
          <CardBody className="bg-transparent relative group/card md:p-10 p-6 rounded-xl w-max h-max md:w-lg">
            <CardItem
                translateZ="0"
                className="absolute inset-0 w-full h-full backdrop-blur-[5px] rounded-xl -z-10"
            >
                <></>
            </CardItem>

            {verifyStatus === "LOADING" && (
                <>
                    <CardItem translateZ="50" className="w-full flex justify-center mb-6">
                         <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
                    </CardItem>
                    <CardItem translateZ="60" className="text-2xl font-bold text-center text-zinc-600 dark:text-white w-full">
                         Verifying...
                    </CardItem>
                    <CardItem translateZ="40" className="text-zinc-500 text-sm mt-2 dark:text-zinc-300 w-full text-center">
                        Please wait while we confirm your email.
                    </CardItem>
                </>
            )}

            {verifyStatus === "SUCCESS" && (
                 <>
                    <CardItem translateZ="50" className="w-full flex justify-center mb-6">
                        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center border border-green-500/50">
                            <ShieldCheck className="w-10 h-10 text-green-400" />
                        </div>
                    </CardItem>
                    <CardItem translateZ="60" className="text-3xl font-bold text-center w-full bg-gradient-to-br from-zinc-800 to-zinc-500 dark:from-white dark:to-green-400 bg-clip-text text-transparent">
                         Verified!
                    </CardItem>
                    <CardItem translateZ="40" className="text-zinc-500 text-sm mt-4 dark:text-zinc-300 w-full text-center">
                        {verifyMessage}
                    </CardItem>
                     <CardItem translateZ="80" className="w-full mt-8">
                        <Button 
                            onClick={() => router.push("/login")}
                            className="w-full"
                        >
                            Continue to Login
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </CardItem>
                 </>
            )}

            {verifyStatus === "ERROR" && (
                 <>
                    <CardItem translateZ="50" className="w-full flex justify-center mb-6">
                         <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/50">
                           <XCircle className="w-10 h-10 text-red-400" />
                        </div>
                    </CardItem>
                    <CardItem translateZ="60" className="text-3xl font-bold text-center w-full text-zinc-800 dark:text-white">
                         Verification Failed
                    </CardItem>
                    <CardItem translateZ="40" className="text-red-500 text-sm mt-4 w-full text-center bg-red-500/10 p-4 rounded-lg border border-red-500/20">
                         {verifyMessage}
                    </CardItem>
                    <CardItem translateZ="80" className="w-full mt-8">
                        <Button 
                            onClick={() => router.push("/login")}
                            variant="secondary"
                            className="w-full"
                        >
                            Back to Login
                        </Button>
                    </CardItem>
                 </>
            )}
          </CardBody>
        </CardContainer>
      );
  }

  // ------------------------------------------------------------------
  // UI: Inbox Mode (Check Email)
  // ------------------------------------------------------------------
  if (!email) {
    return (
        <CardContainer className="inter-var w-max h-max p-6">
           <CardBody className="bg-transparent relative group/card md:p-10 p-6 rounded-xl w-max h-max md:w-lg">
             <CardItem
                translateZ="0"
                className="absolute inset-0 w-full h-full backdrop-blur-[5px] rounded-xl -z-10"
             >
                <></>
             </CardItem>
             <CardItem translateZ="50" className="w-full flex justify-center mb-6">
                <AlertCircle className="w-12 h-12 text-red-500" />
             </CardItem>
             <CardItem translateZ="60" className="text-2xl font-bold text-center text-zinc-600 dark:text-white w-full">
                Invalid Request
             </CardItem>
             <CardItem translateZ="40" className="text-zinc-500 text-sm mt-2 dark:text-zinc-300 w-full text-center">
                No email address provided.
             </CardItem>
             <CardItem translateZ="80" className="w-full mt-8">
                 <Button 
                    onClick={() => router.push("/login")}
                    className="w-full"
                 >
                    Back to Login
                 </Button>
             </CardItem>
           </CardBody>
        </CardContainer>
    );
  }

  return (
      <CardContainer className="inter-var w-max h-max p-6">
        <CardBody className="bg-transparent relative group/card md:p-10 p-6 rounded-xl w-max h-max md:w-lg">
            <CardItem
                translateZ="0"
                className="absolute inset-0 w-full h-full backdrop-blur-[5px] rounded-xl -z-10"
             >
                <></>
             </CardItem>
            
            <CardItem translateZ="50" className="w-full flex justify-center mb-6">
                <div className="relative">
                    <div className="absolute inset-0 bg-blue-500/30 blur-xl rounded-full" />
                    <div className="relative bg-zinc-100 dark:bg-zinc-800 p-4 rounded-full border border-zinc-200 dark:border-white/10">
                        <Mail className="w-8 h-8 text-blue-500 dark:text-blue-400" />
                    </div>
                </div>
            </CardItem>
            
            <CardItem translateZ="60" className="text-3xl font-bold text-center w-full text-zinc-800 dark:text-white">
                Check your inbox
            </CardItem>
            
            <CardItem translateZ="40" className="text-zinc-500 text-sm mt-4 dark:text-zinc-300 w-full text-center leading-relaxed">
              We&apos;ve sent a clickable link to <br />
              <span className="font-semibold text-zinc-900 dark:text-white">{email}</span>
            </CardItem>

            {/* Status Messages for Resend */}
            {resendSuccess && (
                <CardItem translateZ="30" className="w-full mt-4">
                     <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-center gap-2 text-green-600 dark:text-green-400 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        Email resent successfully!
                    </div>
                </CardItem>
            )}

            {resendError && (
                 <CardItem translateZ="30" className="w-full mt-4">
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center gap-2 text-red-600 dark:text-red-400 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        {resendError}
                    </div>
                 </CardItem>
            )}

            <CardItem translateZ="80" className="w-full mt-8 space-y-4">
                <Button
                    onClick={handleResend}
                    disabled={resendLoading || countdown > 0}
                    variant="outline"
                    className="w-full"
                >
                    {resendLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : countdown > 0 ? (
                        <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Resend available in {countdown}s
                        </>
                    ) : (
                        "Resend Email"
                    )}
                </Button>

                <Button 
                    variant="ghost"
                    onClick={() => router.push("/login")}
                    className="w-full group"
                >
                    Back to Login
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
                </Button>
            </CardItem>
             
             <CardItem translateZ="20" className="w-full mt-6 pt-4 border-t border-zinc-200 dark:border-white/5 text-center">
                 <p className="text-xs text-zinc-400 dark:text-zinc-600">
                    Did not receive the email? Check your spam folder or wait for the timer to retry.
                 </p>
             </CardItem>
        </CardBody>
      </CardContainer>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}