import type { Metadata } from "next";
import { Sidebar } from "@/components/layout/sidebar";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "BEES - GEC B동 디지털 트윈",
  description: "삼성물산 GEC B동 스마트빌딩 디지털 트윈 플랫폼",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <ToastProvider>
          <div className="flex min-h-screen">
            {/* 사이드바 (고정) */}
            <Sidebar />

            {/* 메인 콘텐츠 영역 */}
            <main className="ml-64 flex-1">{children}</main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
