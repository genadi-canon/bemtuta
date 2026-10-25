import Link from "next/link";
import { getContext } from "@/lib/session";
import { nameOf, type Category } from "@/lib/types";

export default async function Home({ searchParams }: { searchParams: Promise<{ reported?: string }> }) {
  const { supabase, lang, t } = await getContext();
  const { reported } = await searchParams;
  const { data: categories } = await supabase.from("categories").select("*").order("sort");

  return (
    <div className="space-y-8">
      {reported && <div className="note">{t.task.reported}</div>}
      <section className="pt-6 text-center">
        <h1 className="mb-3 text-3xl font-bold leading-tight">{t.tagline}</h1>
        <p className="mx-auto max-w-md text-stone-600">{t.sub}</p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {(categories as Category[] | null)?.map((c) => (
          <Link key={c.id} href={`/tasks/new?category=${c.id}`} className="card flex flex-col items-center gap-2 py-6 text-center hover:border-teal-600">
            <span className="text-3xl">{c.icon}</span>
            <span className="text-sm font-medium">{nameOf(c, lang)}</span>
          </Link>
        ))}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/tasks/new" className="btn flex-1">
          {t.postTask}
        </Link>
        <Link href="/join" className="btn-secondary flex-1">
          {t.becomeProvider}
        </Link>
      </div>

      <section className="card">
        <h2 className="h2">{t.howItWorks}</h2>
        <ol className="space-y-2">
          {[t.step1, t.step2, t.step3, t.step4].map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-800">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
