import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ToastProvider } from "@/components/ui/toast";
import { ClientLayout } from "@/components/client-layout";
import "./globals.css";

export const metadata: Metadata = {
  title: "BEES - GEC B동 디지털 트윈",
  description: "삼성물산 GEC B동 스마트빌딩 디지털 트윈 플랫폼",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="bg-slate-950 text-white antialiased">
        <NextIntlClientProvider messages={messages}>
          <ToastProvider>
            <ClientLayout>{children}</ClientLayout>
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
