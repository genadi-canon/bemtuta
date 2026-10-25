import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import Stars from "@/components/Stars";
import { fmtNis } from "@/lib/format";
import { nameOf, type Category, type ProviderProfile, type Review } from "@/lib/types";

export default async function ProviderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, lang, t } = await requireUser(`/providers/${id}`);
  const { data: p } = await supabase.from("provider_profiles").select("*").eq("user_id", id).maybeSingle<ProviderProfile>();
  if (!p) notFound();

  const [{ data: person }, { data: cats }, { data: reviews }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", id).single(),
    supabase.from("provider_categories").select("category:categories(*)").eq("provider_id", id),
    supabase.from("reviews").select("*").eq("target_id", id).eq("role", "customer").order("created_at", { ascending: false }).limit(30),
  ]);

  return (
    <div className="space-y-4">
      <section className="card space-y-2">
        <h1 className="text-xl font-bold">
          {person?.full_name}{" "}
          {p.status === "approved" && <span className="badge bg-teal-100 text-teal-800">✓ {t.provider.verified}</span>}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-stone-600">
          <Stars value={p.rating_avg} count={p.rating_count} />
          <span>
            {p.jobs_done} {t.offer.jobsDone}
          </span>
          {p.price_from && (
            <span>
              {t.provider.from}
              {fmtNis(p.price_from)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {((cats ?? []) as unknown as { category: Category }[]).map(({ category }) => (
            <span key={category.id} className="badge bg-stone-100 text-stone-700">
              {category.icon} {nameOf(category, lang)}
            </span>
          ))}
        </div>
        {p.bio && <p className="whitespace-pre-line">{p.bio}</p>}
      </section>

      <section>
        <h2 className="h2">{t.review.reviews}</h2>
        {(reviews ?? []).length === 0 && <p className="text-stone-500">{t.provider.noReviews}</p>}
        <ul className="space-y-2">
          {((reviews ?? []) as Review[]).map((r) => (
            <li key={r.id} className="card">
              <Stars value={r.stars} />
              {r.body && <p className="mt-1 text-sm">{r.body}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
