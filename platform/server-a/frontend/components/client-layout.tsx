"use client";

import React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { AlarmBanner } from "@/components/alarm-banner";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AlarmBanner />
      <Sidebar />
      <main className="ml-0 md:ml-16 lg:ml-64 flex-1">{children}</main>
    </div>
  );
}
