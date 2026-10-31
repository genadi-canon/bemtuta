import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";
import { getContext } from "@/lib/session";
import { dirOf } from "@/lib/i18n";
import Header from "@/components/Header";
import InstallApp from "@/components/InstallApp";

const rubik = Rubik({ subsets: ["latin", "hebrew", "cyrillic"], variable: "--font-rubik" });

export const metadata: Metadata = {
  title: "במטותא · Bematuta",
  description: "כל משימה קטנה, מישהו מהשכונה שמגיע היום",
  applicationName: "במטותא",
  appleWebApp: { capable: true, title: "במטותא", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f766e" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang, t } = await getContext();
  return (
    <html lang={lang} dir={dirOf(lang)} className={rubik.variable}>
      <body className="min-h-screen bg-stone-50 font-sans text-stone-900 antialiased">
        <Header />
        <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-4">
          <InstallApp t={t.install} />
          {children}
        </main>
      </body>
    </html>
  );
}
