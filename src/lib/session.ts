import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dicts, isLang, type Lang } from "@/lib/i18n";
import type { Profile, ProviderProfile } from "@/lib/types";

export const getContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  let provider: ProviderProfile | null = null;
  if (user) {
    const [p, pp] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("provider_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    profile = p.data;
    provider = pp.data;
  }

  const cookieLang = (await cookies()).get("lang")?.value;
  const lang: Lang = isLang(cookieLang) ? cookieLang : profile?.lang ?? "he";
  return { supabase, user, profile, provider, lang, t: dicts[lang] };
});

export async function requireUser(next: string) {
  const ctx = await getContext();
  if (!ctx.user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!ctx.profile?.full_name) redirect(`/login?step=name&next=${encodeURIComponent(next)}`);
  return { ...ctx, user: ctx.user, profile: ctx.profile };
}
