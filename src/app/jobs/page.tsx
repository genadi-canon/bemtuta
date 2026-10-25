import Link from "next/link";
import { requireUser } from "@/lib/session";
import { fmtDateTime, fmtNis } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import { nameOf, type Area, type Category, type Offer, type Task } from "@/lib/types";

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { supabase, user, provider, lang, t } = await requireUser("/jobs");
  const { tab = "open" } = await searchParams;

  if (!provider) {
    return (
      <div className="card space-y-3">
        <p>{t.jobs.notProvider}</p>
        <Link href="/join" className="btn">
          {t.becomeProvider}
        </Link>
      </div>
    );
  }
  if (provider.status !== "approved") {
    return <div className="note">{provider.status === "pending" ? t.jobs.pending : t.jobs.rejected}</div>;
  }

  const [{ data: cats }, { data: areas }, { data: myCats }, { data: myAreas }] = await Promise.all([
    supabase.from("categories").select("*"),
    supabase.from("areas").select("*"),
    supabase.from("provider_categories").select("category_id").eq("provider_id", user.id),
    supabase.from("provider_areas").select("area_id").eq("provider_id", user.id),
  ]);
  const catById = new Map((cats as Category[]).map((c) => [c.id, c]));
  const areaById = new Map((areas as Area[]).map((a) => [a.id, a]));

  let rows: { task: Task; offer?: Offer }[] = [];
  if (tab === "open") {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("status", "open")
      .neq("customer_id", user.id)
      .in("category_id", (myCats ?? []).map((r) => r.category_id))
      .in("area_id", (myAreas ?? []).map((r) => r.area_id))
      .order("created_at", { ascending: false })
      .limit(100);
    const { data: offered } = await supabase.from("offers").select("task_id").eq("provider_id", user.id);
    const done = new Set((offered ?? []).map((o) => o.task_id));
    rows = ((tasks ?? []) as Task[]).filter((x) => !done.has(x.id)).map((task) => ({ task }));
  } else {
    const { data: offers } = await supabase
      .from("offers")
      .select("*, task:tasks(*)")
      .eq("provider_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    rows = ((offers ?? []) as (Offer & { task: Task | null })[])
      .filter((o) => o.task)
      .map(({ task, ...offer }) => ({ task: task!, offer }));
  }

  return (
    <div>
      <h1 className="h1">{t.jobs.title}</h1>
      <div className="mb-4 flex gap-2">
        <Link href="/jobs?tab=open" className={tab === "open" ? "btn" : "btn-secondary"}>
          {t.jobs.open}
        </Link>
        <Link href="/jobs?tab=mine" className={tab === "mine" ? "btn" : "btn-secondary"}>
          {t.jobs.mine}
        </Link>
      </div>
      {rows.length === 0 && <p className="text-stone-500">{t.jobs.empty}</p>}
      <ul className="space-y-3">
        {rows.map(({ task, offer }) => {
          const c = catById.get(task.category_id);
          const a = areaById.get(task.area_id);
          return (
            <li key={task.id}>
              <Link href={`/tasks/${task.id}`} className="card block hover:border-teal-600">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <span className="font-medium">
                    {c?.icon} {task.title}
                  </span>
                  {offer ? <StatusBadge status={task.status} t={t} /> : task.budget && <span className="font-semibold">{fmtNis(task.budget)}</span>}
                </div>
                <div className="text-sm text-stone-500">
                  {a && nameOf(a, lang)} · {fmtDateTime(task.scheduled_at, lang)}
                  {offer && ` · ${t.offer.yours}: ${fmtNis(offer.price)}`}
                </div>
                {!offer && task.description && <p className="mt-1 line-clamp-2 text-sm text-stone-600">{task.description}</p>}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
