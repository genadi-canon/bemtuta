import Link from "next/link";
import { requireUser } from "@/lib/session";
import { saveProfile } from "@/app/actions";
import SubmitButton from "@/components/SubmitButton";

export default async function SettingsPage() {
  const { profile, provider, lang, t } = await requireUser("/settings");
  return (
    <div className="space-y-4">
      <form action={saveProfile} className="card space-y-4">
        <h1 className="h1">{t.settings.title}</h1>
        <input type="hidden" name="next" value="/settings" />
        <label className="block">
          <span className="label">{t.settings.name}</span>
          <input name="full_name" className="input" required maxLength={80} defaultValue={profile.full_name} />
        </label>
        <label className="block">
          <span className="label">{t.settings.lang}</span>
          <select name="lang" className="input" defaultValue={lang}>
            <option value="he">עברית</option>
            <option value="ru">Русский</option>
          </select>
        </label>
        <SubmitButton>{t.settings.save}</SubmitButton>
      </form>
      <Link href="/join" className="btn-secondary w-full">
        {provider ? t.join.title : t.becomeProvider}
      </Link>
    </div>
  );
}
