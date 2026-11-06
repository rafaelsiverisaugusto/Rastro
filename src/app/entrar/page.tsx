import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Entrar · Rastro" };

export default function SignInPage() {
  return (
    <AuthCard>
      <Suspense fallback={<div className="h-72" aria-busy />}>
        <SignInForm />
      </Suspense>
    </AuthCard>
  );
}
