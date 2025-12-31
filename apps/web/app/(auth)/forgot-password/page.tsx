"use client";

import { z } from "zod";
import Link from "next/link";
import { requestPasswordResetAction } from "@/app/actions/auth";
import { requestResetSchema } from "@/lib/auth/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState, useTransition } from "react";
import { ArrowRight, CheckCircle } from "lucide-react";

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

export default function ForgotPasswordPage() {
  const [isSuccess, setIsSuccess] = useState(false);

  if (isSuccess) {
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
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center border border-green-500/50">
                    <CheckCircle className="w-10 h-10 text-green-400" />
                </div>
            </CardItem>

           <CardItem
             translateZ="50"
             className="text-2xl font-bold text-zinc-600 dark:text-white w-full flex items-center justify-center text-center"
           >
             Check your email
           </CardItem>
           <CardItem
             as="p"
             translateZ="60"
             className="text-zinc-500 text-sm mt-4 dark:text-zinc-300 w-full text-center"
           >
             If an account exists with that email, we have sent a password reset link.
           </CardItem>
           <CardItem translateZ="80" className="w-full mt-8 flex justify-center">
             <Link href="/login" className="px-6 py-2 rounded-xl bg-black dark:bg-white dark:text-black text-white text-xs font-bold">
               Back to Login
             </Link>
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
        <CardItem
          translateZ="50"
          className="text-2xl font-bold text-zinc-600 dark:text-white w-full flex items-center justify-center"
        >
          Forgot Password
        </CardItem>
        <CardItem
          as="p"
          translateZ="60"
          className="text-zinc-500 text-xs mt-2 dark:text-zinc-300 w-full flex items-center justify-center text-center"
        >
          Enter your email and we'll send you a recovery link
        </CardItem>
        <CardItem translateZ="100" className="w-full mt-4">
         <ForgotPasswordForm onSuccess={() => setIsSuccess(true)} />
        </CardItem>
        
        <div className="flex justify-center items-center mt-6">
          <CardItem
            translateZ={40}
            className="text-sm text-zinc-500 dark:text-zinc-400"
          >
            Remember your password?{" "}
            <Link href="/login" className="font-bold text-zinc-700 dark:text-zinc-200 hover:underline">
              Sign in
            </Link>
          </CardItem>
        </div>
      </CardBody>
    </CardContainer>
  );
}

function ForgotPasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof requestResetSchema>>({
    resolver: zodResolver(requestResetSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof requestResetSchema>) => {
    startTransition(async () => {
      const result = await requestPasswordResetAction({ 
        email: values.email 
      });

      if (result?.error) {
        form.setError("root", { message: result.error });
      } else if (result?.success) {
        onSuccess();
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="name@example.com" {...field} type="email" />
              </FormControl>
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
          <Button type="submit" className="w-max px-8 group" disabled={isPending}>
            {isPending ? "Sending link..." : (
               <>
                 Send Reset Link <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
               </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
