"use client";

import { useAuth } from "@/context/auth-context";
import { useState, Suspense } from "react";
import Link from "next/link";
import { GoogleSignIn } from "./google-signin";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";

import { useSearchParams } from "next/navigation";

function LoginForm() {
  const [state, action, isPending] = useActionState(loginAction, {});
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-zinc-900">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-md dark:bg-zinc-800">
        <h2 className="mb-6 text-2xl font-bold text-center dark:text-white">Sign In</h2>
        {state.error && (
          <div className="mb-4 rounded bg-red-100 p-3 text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {state.error}
          </div>
        )}
        <form action={action} className="space-y-4">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
            <input
              name="email"
              type="email"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
            <input
              name="password"
              type="password"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isPending ? "Signing in..." : "Sign In"}
          </button>
        </form>
        
        <div className="relative mt-6">
            <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-zinc-700" />
            </div>
            <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-gray-500 dark:bg-zinc-800">Or continue with</span>
            </div>
        </div>

        <GoogleSignIn redirectTo={redirectTo} />

        <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
