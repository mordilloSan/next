"use client";
import React, { useState, useEffect, Suspense } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import dynamic from "next/dynamic";

import { useAuth } from "@/contexts/AuthContext";
import LoadingIndicator from "@/components/LoadingIndicator";

const LoginForm = dynamic(
  () => import("@/app/(blank-layout-pages)/login/LoginForm"),
  { ssr: true },
);

function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, error, isAuthenticated } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      const redirectUrl = searchParams.get("redirect") || "/";

      router.push(redirectUrl);
    }
  }, [isAuthenticated, searchParams, router]);

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleMouseDownPassword = (event) => {
    event.preventDefault();
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    await login(username, password);
  };

  return (
    <LoginForm
      username={username}
      setUsername={setUsername}
      password={password}
      setPassword={setPassword}
      showPassword={showPassword}
      handleClickShowPassword={handleClickShowPassword}
      handleMouseDownPassword={handleMouseDownPassword}
      handleFormSubmit={handleFormSubmit}
      error={error}
    />
  );
}

export default function LoginPageWrapper() {
  return (
    <Suspense fallback={<LoadingIndicator />}>
      <LoginPage />
    </Suspense>
  );
}
