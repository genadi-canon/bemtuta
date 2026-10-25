import Link from "next/link";
import { getContext } from "@/lib/session";
import { signOut } from "@/app/actions";
import LangSwitch from "@/components/LangSwitch";

export default async function Header() {
  const { user, profile, provider, lang, t } = await getContext();
  return (
    <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="text-xl font-bold text-teal-700">
          {t.appName}
        </Link>
        <nav className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {user && <Link href="/tasks">{t.nav.myTasks}</Link>}
          {provider && <Link href="/jobs">{t.nav.jobs}</Link>}
          {profile?.is_admin && <Link href="/admin">{t.nav.admin}</Link>}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <LangSwitch lang={lang} />
          {user ? (
            <>
              <Link href="/settings">{t.nav.settings}</Link>
              <form action={signOut}>
                <button className="text-stone-500 hover:text-stone-800">{t.nav.logout}</button>
              </form>
            </>
          ) : (
            <Link href="/login" className="font-medium text-teal-700">
              {t.nav.login}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
