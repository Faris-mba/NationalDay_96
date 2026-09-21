import type { Metadata, Viewport } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800", "900"],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "تحدي العائلة 🇸🇦",
  description: "لعبة اليوم الوطني السعودي — تُعرض على التلفزيون ويشارك الجميع من جوالاتهم",
};

export const viewport: Viewport = {
  themeColor: "#006C35",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <body className="font-sans bg-identity min-h-screen antialiased">{children}</body>
    </html>
  );
}
