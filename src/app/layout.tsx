import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Sora({ subsets: ["latin"], variable: "--font-display", display: "swap", weight: ["500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "JND · THINK. LEARN. LEAD.", template: "%s · JND" },
  description: "Academia online de educación financiera: Bitcoin, mercados, inversión, análisis y gestión del riesgo.",
  applicationName: "JND",
};

export const viewport: Viewport = { themeColor: "#101827" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
