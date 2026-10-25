import { requireUser } from "@/lib/session";
import { createTask } from "@/app/actions";
import SubmitButton from "@/components/SubmitButton";
import { nameOf, type Area, type Category } from "@/lib/types";

function defaultWhen() {
  // Tomorrow at 10:00, Israel time, in the "YYYY-MM-DDTHH:mm" shape datetime-local expects.
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);
  return `${day}T10:00`;
}

export default async function NewTask({ searchParams }: { searchParams: Promise<{ category?: string; e?: string }> }) {
  const { supabase, lang, t } = await requireUser("/tasks/new");
  const { category, e } = await searchParams;
  const [{ data: categories }, { data: areas }] = await Promise.all([
    supabase.from("categories").select("*").order("sort"),
    supabase.from("areas").select("*").order("sort"),
  ]);

  return (
    <form action={createTask} className="space-y-5">
      <h1 className="h1">{t.task.newTitle}</h1>
      {e && <div className="alert">{t.common.error}</div>}

      <fieldset>
        <legend className="label">{t.task.category}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(categories as Category[]).map((c) => (
            <label key={c.id} className="card flex cursor-pointer items-center gap-2 p-3 has-[:checked]:border-teal-600 has-[:checked]:bg-teal-50">
              <input type="radio" name="category_id" value={c.id} defaultChecked={c.id === category} required className="accent-teal-700" />
              <span className="text-sm">
                {c.icon} {nameOf(c, lang)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="label">{t.task.title}</span>
        <input name="title" className="input" required minLength={3} maxLength={120} placeholder={t.task.titlePh} />
      </label>

      <label className="block">
        <span className="label">{t.task.description}</span>
        <textarea name="description" className="input min-h-28" maxLength={3000} placeholder={t.task.descriptionPh} />
      </label>

      <label className="block">
        <span className="label">{t.task.photos}</span>
        <input type="file" name="photos" accept="image/*" multiple className="block w-full text-sm" />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">{t.task.area}</span>
          <select name="area_id" className="input" required defaultValue="">
            <option value="" disabled>
              —
            </option>
            {(areas as Area[]).map((a) => (
              <option key={a.id} value={a.id}>
                {nameOf(a, lang)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">{t.task.when}</span>
          <input type="datetime-local" name="scheduled_at" className="input" required defaultValue={defaultWhen()} />
        </label>
      </div>

      <label className="block">
        <span className="label">{t.task.address}</span>
        <input name="address" className="input" required maxLength={200} />
        <span className="mt-1 block text-xs text-stone-500">🔒 {t.task.addressNote}</span>
      </label>

      <label className="block">
        <span className="label">{t.task.budget}</span>
        <input type="number" name="budget" min={1} className="input" inputMode="numeric" dir="ltr" />
      </label>

      <SubmitButton className="btn w-full">{t.task.publish}</SubmitButton>
    </form>
  );
}
