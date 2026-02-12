"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Monitor,
  Settings2,
  Share2,
  Network,
  MessageCircle,
  Building2,
} from "lucide-react";

/* 사이드바 네비게이션 */

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/monitoring", label: "모니터링", icon: Monitor },
  { href: "/control", label: "제어", icon: Settings2 },
  { href: "/ontology", label: "온톨로지", icon: Share2 },
  { href: "/topology", label: "토폴로지", icon: Network },
  { href: "/chat", label: "AI 채팅", icon: MessageCircle },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-gray-200 bg-white">
      {/* 로고 영역 */}
      <div className="flex h-16 items-center border-b border-gray-200 px-6">
        <Building2 className="h-6 w-6 text-blue-600 mr-3" />
        <div>
          <h1 className="text-base font-bold text-gray-900">BEES</h1>
          <p className="text-[10px] text-gray-500">GEC B동 디지털 트윈</p>
        </div>
      </div>

      {/* 네비게이션 메뉴 */}
      <nav className="p-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5",
                  isActive ? "text-blue-600" : "text-gray-400"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* 하단 정보 */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 p-4">
        <div className="text-xs text-gray-400">
          <p>Server A v1.0.0</p>
          <p>Phase 2</p>
        </div>
      </div>
    </aside>
  );
}
