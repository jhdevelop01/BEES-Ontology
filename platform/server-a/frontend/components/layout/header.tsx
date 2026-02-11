"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff } from "lucide-react";

/* 상단 헤더 */

interface HeaderProps {
  title: string;
  description?: string;
  connected?: boolean;
}

export function Header({ title, description, connected }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white/95 backdrop-blur px-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {description && (
          <p className="text-sm text-gray-500">{description}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* 실시간 연결 상태 */}
        {connected !== undefined && (
          <Badge variant={connected ? "success" : "danger"}>
            {connected ? (
              <>
                <Wifi className="h-3 w-3 mr-1" />
                실시간 연결
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 mr-1" />
                연결 끊김
              </>
            )}
          </Badge>
        )}

        {/* 현재 시각 */}
        <span className="text-xs text-gray-400">
          GEC B동
        </span>
      </div>
    </header>
  );
}
