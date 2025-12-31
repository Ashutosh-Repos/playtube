"use client";

import { useAuth } from "@/context/auth-context";
import { useState } from "react";
import Link from "next/link";

import { useActionState } from "react";
import { registerAction } from "@/app/actions/auth";

export default function RegisterPage() {
  const [state, action, isPending] = useActionState(registerAction, {});
  
  if (state.success) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-zinc-900">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-md dark:bg-zinc-800 text-center">
                <h2 className="mb-4 text-2xl font-bold dark:text-white">Check your email</h2>
                <p className="mb-4 text-gray-600 dark:text-gray-300">
                    We have sent a verification link to your email address.
                </p>
                <Link href="/login" className="text-indigo-600 hover:text-indigo-500">
                    Back to Login
                </Link>
            </div>
        </div>
      );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-zinc-900">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-md dark:bg-zinc-800">
        <h2 className="mb-6 text-2xl font-bold text-center dark:text-white">Create Account</h2>
        {state.error && (
          <div className="mb-4 rounded bg-red-100 p-3 text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {state.error}
          </div>
        )}
        <form action={action} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
            <input
              name="name"
              type="text"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              required
            />
          </div>
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
            {isPending ? "Creating account..." : "Sign Up"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
