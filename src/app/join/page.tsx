import Link from "next/link";
import { requireUser } from "@/lib/session";
import { submitProvider } from "@/app/actions";
import SubmitButton from "@/components/SubmitButton";
import { nameOf, type Area, type Category } from "@/lib/types";

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ e?: string; sent?: string; edit?: string }> }) {
  const { supabase, user, provider, lang, t } = await requireUser("/join");
  const { e, sent, edit } = await searchParams;
  const [{ data: categories }, { data: areas }, { data: myCats }, { data: myAreas }] = await Promise.all([
    supabase.from("categories").select("*").order("sort"),
    supabase.from("areas").select("*").order("sort"),
    supabase.from("provider_categories").select("category_id").eq("provider_id", user.id),
    supabase.from("provider_areas").select("area_id").eq("provider_id", user.id),
  ]);
  const catSet = new Set((myCats ?? []).map((r) => r.category_id));
  const areaSet = new Set((myAreas ?? []).map((r) => r.area_id));

  if (provider && !edit && provider.status !== "rejected") {
    return (
      <div className="card space-y-3">
        <h1 className="h1">{t.join.title}</h1>
        {provider.status === "pending" && <p className="note mb-0">{sent ? t.join.pending : t.jobs.pending}</p>}
        {provider.status === "approved" && (
          <>
            <p className="note mb-0">✓ {t.join.approved}</p>
            <Link href="/jobs" className="btn">
              {t.join.goJobs}
            </Link>
          </>
        )}
        <Link href="/join?edit=1" className="btn-secondary">
          ✎ {t.settings.title}
        </Link>
      </div>
    );
  }

  return (
    <form action={submitProvider} className="space-y-5">
      <h1 className="h1">{t.join.title}</h1>
      <p className="text-stone-600">{t.join.intro}</p>
      {e && <div className="alert">{t.common.error}</div>}
      {provider?.status === "rejected" && (
        <div className="alert">
          {t.jobs.rejected}
          {provider.reject_reason && `: ${provider.reject_reason}`}
        </div>
      )}

      <label className="block">
        <span className="label">{t.join.bio}</span>
        <textarea name="bio" required className="input min-h-24" maxLength={2000} defaultValue={provider?.bio} />
      </label>

      <fieldset>
        <legend className="label">{t.join.categories}</legend>
        <div className="space-y-2">
          {(categories as Category[]).map((c) => (
            <label key={c.id} className="flex items-center gap-2">
              <input type="checkbox" name="categories" value={c.id} defaultChecked={catSet.has(c.id)} className="accent-teal-700" />
              {c.icon} {nameOf(c, lang)}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">{t.join.areas}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(areas as Area[]).map((a) => (
            <label key={a.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="areas" value={a.id} defaultChecked={areaSet.has(a.id)} className="accent-teal-700" />
              {nameOf(a, lang)}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="label">{t.join.priceFrom}</span>
        <input name="price_from" type="number" min={1} className="input" dir="ltr" defaultValue={provider?.price_from ?? undefined} />
      </label>

      <div className="card space-y-4">
        <p className="text-xs text-stone-500">🔒 {t.join.docsPrivate}</p>
        <label className="block">
          <span className="label">{t.join.idPhoto} {provider?.id_photo_path && "✓"}</span>
          <input type="file" name="id_photo" accept="image/*" capture="environment" required={!provider?.id_photo_path} className="block w-full text-sm" />
        </label>
        <label className="block">
          <span className="label">{t.join.selfie} {provider?.selfie_path && "✓"}</span>
          <input type="file" name="selfie" accept="image/*" capture="user" required={!provider?.selfie_path} className="block w-full text-sm" />
        </label>
        <label className="block">
          <span className="label">{t.join.policeCert} {provider?.police_cert_path && "✓"}</span>
          <input type="file" name="police_cert" accept="image/*,application/pdf" className="block w-full text-sm" />
        </label>
      </div>

      <label className="block">
        <span className="label">{t.join.references}</span>
        <textarea name="references" className="input min-h-16" maxLength={500} defaultValue={provider?.references} />
      </label>

      <SubmitButton className="btn w-full">{t.join.submit}</SubmitButton>
    </form>
  );
}
