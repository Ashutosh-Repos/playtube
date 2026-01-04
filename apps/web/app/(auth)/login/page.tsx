"use client";

import { z } from "zod";
import Link from "next/link";
import { loginAction } from "@/app/actions/auth";
import { loginSchema } from "@/lib/auth/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTransition } from "react";
import { useSearchParams } from "next/navigation";

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
import { Separator } from "@/components/ui/separator";



export default function LoginPage() {
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
          Welcome back
        </CardItem>
        <CardItem
          as="p"
          translateZ="60"
          className="text-zinc-500 text-xs mt-2 dark:text-zinc-300 w-full flex items-center justify-center"
        >
          Enter your email to sign in to your account 
        </CardItem>
        <CardItem translateZ="100" className="w-full mt-4">
         <LoginForm />
        </CardItem>
        <CardItem translateZ="40" className="w-full mt-4">
         <div className="my-2 flex items-center gap-4">
         <Separator className="flex-1 bg-zinc-200/20" />
         <span className="text-xs text-muted-foreground">OR CONTINUE WITH</span>
         <Separator className="flex-1 bg-zinc-200/20" />
        </div>
        </CardItem>
        <CardItem translateZ="80" className="w-full mt-4">
         <GoogleSignIn />
        </CardItem>
        <div className="flex justify-between items-center mt-4">
          <CardItem
            translateZ={20}
          >
            <Link href="/forgot-password" className="px-4 py-2 rounded-xl bg-black dark:bg-white dark:text-black text-white text-xs font-bold">
            Forgot Password?
            </Link>
          </CardItem>
          <CardItem
            translateZ={40}
          >
            <Link href="/register" className="px-4 py-2 rounded-xl bg-black dark:bg-white dark:text-black text-white text-xs font-bold">
              Sign up
            </Link>
            
          </CardItem>
        </div>
      </CardBody>
    </CardContainer>
  );
  
}

export function GoogleSignIn() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";
  const href = `/api/auth/login/google?redirect=${encodeURIComponent(redirectTo)}`;

  return (
    <Button variant="outline" className="w-full" asChild>
      <Link href={href}>
        <svg className="mr-2 h-4 w-4" aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Google
      </Link>
    </Button>
  );
}

export function LoginForm() {
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    startTransition(async () => {
      const result = await loginAction({ 
        email: values.email, 
        password: values.password, 
        redirectTo 
      });

      if (result?.error) {
        form.setError("root", { message: result.error });
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
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input placeholder="••••••••" {...field} type="password" />
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
        <div className="w-full h-max bg-transparent flex items-center justify-center">
          <Button type="submit" className="w-max px-6" disabled={isPending}>
            {isPending ? "Signing in..." : "Sign In"}
          </Button>
        </div>
      </form>
    </Form>
  );
}