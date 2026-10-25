"use client";

import { useTransition } from "react";
import { setLang } from "@/app/actions";
import type { Lang } from "@/lib/i18n";

export default function LangSwitch({ lang }: { lang: Lang }) {
  const [pending, start] = useTransition();
  const other: Lang = lang === "he" ? "ru" : "he";
  return (
    <button
      disabled={pending}
      onClick={() => start(() => setLang(other))}
      className="rounded-lg border border-stone-300 px-2 py-1 text-xs font-medium"
      aria-label="language"
    >
      {other === "ru" ? "RU" : "עב"}
    </button>
  );
}
