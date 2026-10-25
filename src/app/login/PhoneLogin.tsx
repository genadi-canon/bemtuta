"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizeIlPhone } from "@/lib/phone";
import type { Dict } from "@/lib/i18n";

export default function PhoneLogin({ t, next }: { t: Dict["login"]; next: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    const e164 = normalizeIlPhone(phone);
    if (!e164) return setError(t.badPhone);
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({ phone: e164 });
    setBusy(false);
    if (error) return setError(t.badPhone);
    setSentTo(e164);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({ phone: sentTo!, token: code.trim(), type: "sms" });
    setBusy(false);
    if (error) return setError(t.badCode);
    router.replace(`/login?next=${encodeURIComponent(next)}`);
    router.refresh();
  }

  return (
    <div className="card mx-auto mt-8 max-w-sm">
      <h1 className="h1">{t.title}</h1>
      {error && <div className="alert">{error}</div>}
      {!sentTo ? (
        <form onSubmit={sendCode} className="space-y-4">
          <label className="block">
            <span className="label">{t.phone}</span>
            <input
              className="input"
              dir="ltr"
              inputMode="tel"
              autoComplete="tel"
              placeholder="050-1234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoFocus
            />
          </label>
          <button className="btn w-full" disabled={busy}>
            {busy ? "…" : t.sendCode}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <label className="block">
            <span className="label">{t.code}</span>
            <input
              className="input text-center text-lg tracking-widest"
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
            />
          </label>
          <button className="btn w-full" disabled={busy || code.trim().length < 4}>
            {busy ? "…" : t.verify}
          </button>
          <button type="button" className="w-full text-sm text-stone-500" onClick={() => setSentTo(null)}>
            {t.changePhone}
          </button>
        </form>
      )}
    </div>
  );
}
