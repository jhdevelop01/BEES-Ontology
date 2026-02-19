"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Monitor,
  Settings2,
  Share2,
  Network,
  MessageCircle,
  Building2,
  Clock,
  Menu,
  X,
  LogIn,
  LogOut,
  User,
  Bell,
  Zap,
  Wrench,
  FileText,
  Settings,
  Play,
  ShieldCheck,
} from "lucide-react";
import { getCurrentUser, isLoggedIn, logout } from "@/lib/api";

/* 사이드바 네비게이션 — 반응형 */

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { href: "/", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/monitoring", labelKey: "monitoring", icon: Monitor },
  { href: "/control", labelKey: "control", icon: Settings2 },
  { href: "/ontology", labelKey: "ontology", icon: Share2 },
  { href: "/topology", labelKey: "topology", icon: Network },
  { href: "/history", labelKey: "history", icon: Clock },
  { href: "/chat", labelKey: "chat", icon: MessageCircle },
  { href: "/alarms", labelKey: "alarms", icon: Bell },
  { href: "/scenarios", labelKey: "scenarios", icon: Play },
  { href: "/data-quality", labelKey: "dataQuality", icon: ShieldCheck },
  { href: "/energy", labelKey: "energy", icon: Zap },
  { href: "/maintenance", labelKey: "maintenance", icon: Wrench },
  { href: "/reports", labelKey: "reports", icon: FileText },
  { href: "/settings", labelKey: "settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const t = useTranslations("nav");
  const tc = useTranslations("common");

  // 클라이언트에서만 로그인 상태 확인 (hydration 불일치 방지)
  useEffect(() => {
    setLoggedIn(isLoggedIn());
  }, [pathname]);

  // 경로 변경 시 모바일 메뉴 닫기
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // ESC 키로 닫기
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <>
      {/* 모바일 햄버거 버튼 */}
      <button
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-white border border-gray-200 shadow-sm lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={t("menuToggle")}
      >
        {mobileOpen ? (
          <X className="h-5 w-5 text-gray-700" />
        ) : (
          <Menu className="h-5 w-5 text-gray-700" />
        )}
      </button>

      {/* 모바일 오버레이 */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* 사이드바 */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r border-gray-200 bg-white transition-all duration-300",
          // 모바일: 숨김 / 오버레이 표시
          mobileOpen ? "translate-x-0 w-64" : "-translate-x-full w-64",
          // 태블릿 (md~lg): 아이콘만 (접힌 상태)
          "md:translate-x-0 md:w-16",
          // 데스크탑 (lg+): 전체 표시
          "lg:w-64"
        )}
      >
        {/* 로고 영역 */}
        <div className="flex h-16 items-center border-b border-gray-200 px-4 lg:px-6">
          <Building2 className="h-6 w-6 text-blue-600 flex-shrink-0" />
          <div className={cn("ml-3", "md:hidden lg:block", mobileOpen && "!block")}>
            <h1 className="text-base font-bold text-gray-900">{t("siteTitle")}</h1>
            <p className="text-[10px] text-gray-500">{t("siteSubtitle")}</p>
          </div>
        </div>

        {/* 네비게이션 메뉴 */}
        <nav className="p-2 md:p-2 lg:p-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const label = t(item.labelKey);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-colors",
                  // 태블릿: 중앙 아이콘
                  "md:justify-center md:px-2 md:py-2.5",
                  // 데스크탑: 풀 사이즈
                  "lg:justify-start lg:px-3 lg:py-2.5 lg:gap-3",
                  // 모바일 오픈: 풀 사이즈
                  mobileOpen ? "justify-start px-3 py-2.5 gap-3" : "justify-center px-2 py-2.5",
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
                title={label}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 flex-shrink-0",
                    isActive ? "text-blue-600" : "text-gray-400"
                  )}
                />
                <span className={cn(
                  "md:hidden lg:inline",
                  mobileOpen && "!inline"
                )}>
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* 하단: 사용자 + 로그인/로그아웃 */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 p-2 lg:p-4 space-y-2">
          {loggedIn ? (
            <>
              {/* 사용자 정보 */}
              <div className={cn(
                "flex items-center gap-2 px-2 py-1",
                "md:justify-center lg:justify-start"
              )}>
                <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className={cn(
                  "text-xs text-gray-600 truncate",
                  "md:hidden lg:inline",
                  mobileOpen && "!inline"
                )}>
                  {getCurrentUser()?.name || tc("user")}
                </span>
              </div>
              {/* 로그아웃 */}
              <button
                onClick={() => logout()}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors w-full",
                  "md:justify-center md:px-2 md:py-2",
                  "lg:justify-start lg:px-3 lg:py-2 lg:gap-3",
                  mobileOpen ? "justify-start px-3 py-2 gap-3" : "justify-center px-2 py-2"
                )}
                title={t("logout")}
              >
                <LogOut className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className={cn("md:hidden lg:inline", mobileOpen && "!inline")}>
                  {t("logout")}
                </span>
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className={cn(
                "flex items-center rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors w-full",
                "md:justify-center md:px-2 md:py-2",
                "lg:justify-start lg:px-3 lg:py-2 lg:gap-3",
                mobileOpen ? "justify-start px-3 py-2 gap-3" : "justify-center px-2 py-2"
              )}
              title={t("login")}
            >
              <LogIn className="h-4 w-4 flex-shrink-0" />
              <span className={cn("md:hidden lg:inline", mobileOpen && "!inline")}>
                {t("login")}
              </span>
            </Link>
          )}
          <div className={cn("text-xs text-gray-400 px-2", "md:text-center lg:text-left")}>
            <p>Phase 4</p>
          </div>
        </div>
      </aside>
    </>
  );
}
