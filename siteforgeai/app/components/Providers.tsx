"use client";

import { SessionProvider } from "next-auth/react";
import { AuthSessionBootstrap } from "./AuthSessionBootstrap";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus>
      <AuthSessionBootstrap />
      {children}
    </SessionProvider>
  );
}
