import type { Lang } from "@/lib/i18n";

const locales: Record<Lang, string> = { he: "he-IL", ru: "ru-RU" };

export function fmtDateTime(iso: string, lang: Lang) {
  return new Intl.DateTimeFormat(locales[lang], {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(iso));
}

export function fmtNis(n: number) {
  return `₪${n.toLocaleString("he-IL")}`;
}
