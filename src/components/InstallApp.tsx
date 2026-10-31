"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { Dict } from "@/lib/i18n";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Registers the service worker and offers to install the site as an app.
// Android/Chrome gets a button; iPhone Safari has no install API, so it gets the steps instead.
export default function InstallApp({ t }: { t: Dict["install"] }) {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem("install-dismissed") === "1";
    } catch {}
    if (standalone || dismissed) return;

    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua)) {
      setIos(true);
      setHidden(false);
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  // The offer only shows on the home page; the service worker registers on every page.
  if (hidden || pathname !== "/") return null;

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem("install-dismissed", "1");
    } catch {}
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    setEvent(null);
    setHidden(true);
  }

  return (
    <section className="card mb-4 flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{t.title}</p>
        {ios && <p className="text-sm text-stone-600">{t.ios}</p>}
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        {event && (
          <button type="button" className="btn px-3 py-2 text-sm" onClick={install}>
            {t.button}
          </button>
        )}
        <button type="button" className="text-sm text-stone-500 hover:text-stone-800" onClick={dismiss}>
          {t.dismiss}
        </button>
      </div>
    </section>
  );
}
