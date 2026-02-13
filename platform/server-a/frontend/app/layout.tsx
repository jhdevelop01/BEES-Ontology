import type { Metadata } from "next";
import { ToastProvider } from "@/components/ui/toast";
import { ClientLayout } from "@/components/client-layout";
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
          <ClientLayout>{children}</ClientLayout>
        </ToastProvider>
      </body>
    </html>
  );
}
