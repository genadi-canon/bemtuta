import Link from "next/link";
import { requireUser } from "@/lib/session";
import { fmtDateTime } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import type { Task } from "@/lib/types";

export default async function MyTasks() {
  const { supabase, user, lang, t } = await requireUser("/tasks");
  const { data } = await supabase
    .from("tasks")
    .select("*, offers(count)")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });
  const tasks = (data ?? []) as (Task & { offers: { count: number }[] })[];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="h1 mb-0">{t.task.myTasks}</h1>
        <Link href="/tasks/new" className="btn">
          {t.postTask}
        </Link>
      </div>
      {tasks.length === 0 && <p className="text-stone-500">{t.task.empty}</p>}
      <ul className="space-y-3">
        {tasks.map((task) => (
          <li key={task.id}>
            <Link href={`/tasks/${task.id}`} className="card block hover:border-teal-600">
              <div className="mb-1 flex items-start justify-between gap-2">
                <span className="font-medium">{task.title}</span>
                <StatusBadge status={task.status} t={t} />
              </div>
              <div className="text-sm text-stone-500">
                {fmtDateTime(task.scheduled_at, lang)}
                {task.status === "open" && ` · ${task.offers[0]?.count ?? 0} ${t.task.offersCount}`}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
