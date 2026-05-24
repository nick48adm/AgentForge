'use client';

import { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { useAppStore } from "@/lib/store";

export function AppShell({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAppStore();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className={`flex-1 ${isAuthenticated ? 'pb-16 md:pb-0' : ''}`}>
        {children}
      </main>
    </div>
  );
}
