import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { I18nProvider } from "@/i18n/provider";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rastro",
  description:
    "Prova de origem livre de desmatamento (EUDR) para pequenos produtores rurais exportadores.",
};

export const viewport: Viewport = {
  themeColor: "#173427",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
