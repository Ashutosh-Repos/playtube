"use client";

import { z } from "zod";
import Link from "next/link";
import { resetPasswordAction } from "@/app/actions/auth";
import { resetPasswordSchema } from "@/lib/auth/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState, useTransition, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Lock, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { CardBody, CardContainer, CardItem } from "@/components/ui/3d-card";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: token || "",
      newPassword: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof resetPasswordSchema>) => {
    startTransition(async () => {
      const result = await resetPasswordAction({ 
        token: values.token,
        newPassword: values.newPassword, 
      });

      if (result?.error) {
        form.setError("root", { message: result.error });
      }
      // Success is handled by redirect in server action
    });
  };

  if (!token) {
      return (
        <div className="flex flex-col items-center">
             <AlertCircle className="h-10 w-10 text-red-500 mb-4" />
             <p className="text-zinc-600 dark:text-zinc-300 text-center mb-4">
                 Invalid request. Missing reset token.
             </p>
             <Link href="/login" className="text-sm font-semibold text-blue-500 hover:underline">
                 Return to Login
             </Link>
        </div>
      );
  }


  return (
    <Form {...form}>
      <form 
        onSubmit={form.handleSubmit(onSubmit)} 
        className="space-y-4"
      >
        <input type="hidden" {...form.register("token")} />
        
        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              
              <div className="flex w-full h-max items-center justify-center">
                <FormLabel className="absolute left-8 -top-2.5">New Password</FormLabel>
                <Lock className="h-4 w-4 text-zinc-400 cursor-pointer mr-1" />
                <FormControl>
                  <Input 
                      placeholder="••••••••" 
                      {...field} 
                      type={showPassword ? "text" : "password"} 
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-4 h-4 hover:bg-transparent cursor-pointer ml-0.5"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-zinc-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-zinc-400" />
                  )}
                  <span className="sr-only">
                    {showPassword ? "Hide password" : "Show password"}
                  </span>
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {form.formState.errors.root && (
            <div className="text-sm font-medium text-destructive">
                {form.formState.errors.root.message}
            </div>
        )}
        <div className="w-full h-max bg-transparent flex items-center justify-center pt-2">
          <Button type="submit" className="w-max px-8" disabled={isPending}>
            {isPending ? "Resetting..." : "Reset Password"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function ResetPasswordPage() {
  return (
      <CardContainer className="inter-var w-max h-max p-6">
      <CardBody className="bg-transparent relative group/card md:p-10 p-6 rounded-xl w-max h-max md:w-lg">
      <CardItem
          translateZ="0"
          className="absolute inset-0 w-full h-full backdrop-blur-[5px] rounded-xl -z-10 pointer-events-none"
        >
          <></>
        </CardItem>
        <CardItem
          translateZ="50"
          className="text-2xl font-bold text-zinc-600 dark:text-white w-full flex items-center justify-center"
        >
          Reset Password
        </CardItem>
        <CardItem
          as="p"
          translateZ="60"
          className="text-zinc-500 text-xs mt-2 dark:text-zinc-300 w-full flex items-center justify-center text-center"
        >
          Create a new, strong password for your account
        </CardItem>
        <CardItem translateZ="100" className="w-full mt-6 relative z-50">
         <Suspense fallback={<div>Loading...</div>}>
            <ResetPasswordForm />
         </Suspense>
        </CardItem>
        
        <div className="flex justify-center items-center mt-6">
          <CardItem
            translateZ={40}
            className="text-sm text-zinc-500 dark:text-zinc-400"
          >
            <Link href="/login" className="font-bold text-zinc-700 dark:text-zinc-200 hover:underline">
              Back to Sign in
            </Link>
          </CardItem>
        </div>
      </CardBody>
    </CardContainer>
  );
}
