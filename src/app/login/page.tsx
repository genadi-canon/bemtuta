import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { saveProfile } from "@/app/actions";
import SubmitButton from "@/components/SubmitButton";
import PhoneLogin from "./PhoneLogin";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; step?: string; e?: string }> }) {
  const { user, profile, lang, t } = await getContext();
  const { next = "/", e } = await searchParams;

  if (user && profile?.full_name) redirect(next);

  if (user) {
    return (
      <form action={saveProfile} className="card mx-auto mt-8 max-w-sm space-y-4">
        <h1 className="h1">{t.login.name}</h1>
        {e && <div className="alert">{t.common.required}</div>}
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="lang" value={lang} />
        <input name="full_name" className="input" required autoFocus maxLength={80} />
        <SubmitButton className="btn w-full">{t.login.save}</SubmitButton>
      </form>
    );
  }

  return <PhoneLogin t={t.login} next={next} />;
}
