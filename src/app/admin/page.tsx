import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminCloseReport, adminSetProviderStatus } from "@/app/actions";
import { fmtDateTime } from "@/lib/format";
import SubmitButton from "@/components/SubmitButton";
import type { ProviderProfile, Task } from "@/lib/types";

type Report = { id: string; reporter_id: string; task_id: string | null; reason: string; created_at: string };

export default async function AdminPage() {
  const { supabase, profile, lang, t } = await requireUser("/admin");
  if (!profile.is_admin) notFound();
  const admin = createAdminClient();

  const hourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
  const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const [{ data: pending }, { data: openTasks }, { data: reports }, { data: allTasks }, { data: offers }, { data: reviews }] = await Promise.all([
    supabase.from("provider_profiles").select("*").eq("status", "pending").order("created_at"),
    supabase.from("tasks").select("*, offers(count)").eq("status", "open").lt("created_at", hourAgo).order("created_at"),
    supabase.from("reports").select("*").eq("status", "open").order("created_at", { ascending: false }),
    supabase.from("tasks").select("id, customer_id, chosen_provider_id, status, created_at, done_at"),
    supabase.from("offers").select("task_id, created_at"),
    supabase.from("reviews").select("stars").eq("role", "customer"),
  ]);

  // Contact details and documents for providers waiting for approval.
  const pendingRows = await Promise.all(
    ((pending ?? []) as ProviderProfile[]).map(async (p) => {
      const [{ data: u }, { data: prof }, { data: cats }] = await Promise.all([
        admin.auth.admin.getUserById(p.user_id),
        admin.from("profiles").select("full_name").eq("id", p.user_id).single(),
        admin.from("provider_categories").select("category_id").eq("provider_id", p.user_id),
      ]);
      const paths = [p.id_photo_path, p.selfie_path, p.police_cert_path].filter(Boolean) as string[];
      const { data: signed } = paths.length
        ? await admin.storage.from("provider-docs").createSignedUrls(paths, 3600)
        : { data: [] };
      return { p, name: prof?.full_name ?? "", phone: u.user?.phone ?? "", cats: (cats ?? []).map((c) => c.category_id), docs: (signed ?? []).map((s) => s.signedUrl) };
    }),
  );

  const noOffer = ((openTasks ?? []) as (Task & { offers: { count: number }[] })[]).filter((x) => (x.offers[0]?.count ?? 0) === 0);

  // Pilot metrics (see the plan): completed jobs, offer within 2h, active providers, repeat customers.
  const tasks = (allTasks ?? []) as Pick<Task, "id" | "customer_id" | "chosen_provider_id" | "status" | "created_at" | "done_at">[];
  const completed = tasks.filter((x) => x.status === "done" || x.status === "reviewed");
  const firstOffer = new Map<string, number>();
  for (const o of offers ?? []) {
    const ts = new Date(o.created_at).getTime();
    const prev = firstOffer.get(o.task_id);
    if (prev === undefined || ts < prev) firstOffer.set(o.task_id, ts);
  }
  const judged = tasks.filter((x) => Date.now() - new Date(x.created_at).getTime() > 2 * 3600 * 1000);
  const fast = judged.filter((x) => {
    const f = firstOffer.get(x.id);
    return f !== undefined && f - new Date(x.created_at).getTime() <= 2 * 3600 * 1000;
  });
  const activeProviders = new Set(completed.filter((x) => x.done_at && x.done_at > monthAgo).map((x) => x.chosen_provider_id)).size;
  const perCustomer = new Map<string, number>();
  for (const x of completed) perCustomer.set(x.customer_id, (perCustomer.get(x.customer_id) ?? 0) + 1);
  const customers = perCustomer.size;
  const repeat = [...perCustomer.values()].filter((n) => n > 1).length;
  const stars = (reviews ?? []).map((r) => r.stars as number);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

  const metrics: [string, string][] = [
    [t.admin.completed, String(completed.length)],
    [t.admin.offer2h, pct(fast.length, judged.length)],
    [t.admin.activeProviders, String(activeProviders)],
    [t.admin.repeat, pct(repeat, customers)],
    [t.admin.totalTasks, String(tasks.length)],
    [t.admin.avgRating, stars.length ? (stars.reduce((a, b) => a + b, 0) / stars.length).toFixed(2) : "—"],
  ];

  return (
    <div className="space-y-8">
      <h1 className="h1">{t.admin.title}</h1>

      <section>
        <h2 className="h2">{t.admin.metrics}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {metrics.map(([label, value]) => (
            <div key={label} className="card">
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs text-stone-500">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="h2">
          {t.admin.tasks} ({noOffer.length})
        </h2>
        {noOffer.length === 0 && <p className="text-stone-500">{t.admin.none}</p>}
        <ul className="space-y-2">
          {noOffer.map((x) => (
            <li key={x.id}>
              <Link href={`/tasks/${x.id}`} className="card block border-red-200 hover:border-red-400">
                <span className="font-medium">{x.title}</span>
                <span className="block text-sm text-stone-500">{fmtDateTime(x.created_at, lang)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="h2">
          {t.admin.providers} ({pendingRows.length})
        </h2>
        {pendingRows.length === 0 && <p className="text-stone-500">{t.admin.none}</p>}
        <ul className="space-y-3">
          {pendingRows.map(({ p, name, phone, cats, docs }) => (
            <li key={p.user_id} className="card space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{name}</span>
                <a href={`tel:+${phone}`} dir="ltr" className="text-sm text-teal-700">
                  +{phone}
                </a>
              </div>
              <p className="text-sm text-stone-600">{cats.join(", ")}</p>
              <p className="whitespace-pre-line text-sm">{p.bio}</p>
              {p.references && <p className="whitespace-pre-line text-sm text-stone-600">📇 {p.references}</p>}
              <div className="flex gap-2">
                {docs.map((u, i) => (
                  <a key={i} href={u ?? undefined} target="_blank" rel="noreferrer" className="btn-secondary px-3 py-1 text-sm">
                    📄 {i + 1}
                  </a>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={adminSetProviderStatus}>
                  <input type="hidden" name="user_id" value={p.user_id} />
                  <input type="hidden" name="status" value="approved" />
                  <SubmitButton>✓ {t.admin.approve}</SubmitButton>
                </form>
                <form action={adminSetProviderStatus} className="flex flex-1 gap-2">
                  <input type="hidden" name="user_id" value={p.user_id} />
                  <input type="hidden" name="status" value="rejected" />
                  <input name="reason" className="input" placeholder={t.admin.reason} />
                  <SubmitButton className="btn-danger">{t.admin.reject}</SubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="h2">
          {t.admin.reports} ({(reports ?? []).length})
        </h2>
        {(reports ?? []).length === 0 && <p className="text-stone-500">{t.admin.none}</p>}
        <ul className="space-y-2">
          {((reports ?? []) as Report[]).map((r) => (
            <li key={r.id} className="card space-y-2">
              <p className="whitespace-pre-line text-sm">{r.reason}</p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {r.task_id && (
                  <Link href={`/tasks/${r.task_id}`} className="text-teal-700 underline">
                    task
                  </Link>
                )}
                <form action={adminCloseReport}>
                  <input type="hidden" name="report_id" value={r.id} />
                  <SubmitButton className="btn-secondary px-3 py-1">{t.admin.close}</SubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
