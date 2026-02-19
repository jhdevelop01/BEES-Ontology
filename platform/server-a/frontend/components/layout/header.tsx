"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Globe } from "lucide-react";

/* 상단 헤더 */

interface HeaderProps {
  title: string;
  description?: string;
  connected?: boolean;
}

function LanguageSwitcher() {
  const t = useTranslations("header");

  const switchLocale = (locale: string) => {
    document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=31536000`;
    window.location.reload();
  };

  // 현재 쿠키에서 locale 읽기
  const currentLocale =
    typeof document !== "undefined"
      ? (document.cookie.match(/NEXT_LOCALE=(\w+)/)?.[1] || "ko")
      : "ko";

  return (
    <div className="relative group">
      <button className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1 rounded-md hover:bg-white/5 transition-colors">
        <Globe className="h-3.5 w-3.5" />
        <span>{currentLocale === "ko" ? t("ko") : t("en")}</span>
      </button>
      <div className="absolute right-0 top-full pt-1 hidden group-hover:block z-50"><div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-glow py-1 min-w-[100px]">
        <button
          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 ${currentLocale === "ko" ? "font-semibold text-cyan-400" : "text-slate-400"}`}
          onClick={() => switchLocale("ko")}
        >
          {t("ko")}
        </button>
        <button
          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 ${currentLocale === "en" ? "font-semibold text-cyan-400" : "text-slate-400"}`}
          onClick={() => switchLocale("en")}
        >
          {t("en")}
        </button>
      </div></div>
    </div>
  );
}

export function Header({ title, description, connected }: HeaderProps) {
  const t = useTranslations("header");

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/5 bg-slate-900/60 backdrop-blur-xl px-4 pl-14 md:pl-6 lg:px-6">
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {description && (
          <p className="text-sm text-slate-400">{description}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* 실시간 연결 상태 */}
        {connected !== undefined && (
          <Badge variant={connected ? "success" : "danger"}>
            {connected ? (
              <>
                <Wifi className="h-3 w-3 mr-1" />
                {t("connected")}
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 mr-1" />
                {t("disconnected")}
              </>
            )}
          </Badge>
        )}

        {/* 언어 전환 */}
        <LanguageSwitcher />

        {/* 현재 시각 */}
        <span className="text-xs text-slate-500">
          {t("buildingLabel")}
        </span>
      </div>
    </header>
  );
}
