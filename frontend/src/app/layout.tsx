import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finhub — AI Crypto Day Trading Decision Support",
  description: "Institutional-grade AI confluence signals, time-windowed trade setups, and live risk-managed paper trading for crypto traders.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Finhub",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0F19",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="bg-[#0B0F19] text-white min-h-screen antialiased flex flex-col">
        {children}
      </body>
    </html>
  );
}
