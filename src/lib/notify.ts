import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { dicts, type Lang } from "@/lib/i18n";

type Kind = "newTask" | "newOffer" | "chosen" | "newMessage" | "reviewRequest" | "providerApproved" | "noOffers";

const texts: Record<Lang, Record<Kind, string>> = {
  he: {
    newTask: "משימה חדשה באזור שלך: {title}",
    newOffer: "קיבלת הצעה חדשה על: {title}",
    chosen: "נבחרת לעבודה: {title}",
    newMessage: "הודעה חדשה בצ'אט על: {title}",
    reviewRequest: "העבודה סומנה כבוצעה. נשמח לדירוג: {title}",
    providerApproved: "הפרופיל שלך אושר! אפשר להתחיל לשלוח הצעות.",
    noOffers: "[ניהול] משימה בלי הצעות כבר שעה: {title}",
  },
  ru: {
    newTask: "Новое задание рядом с вами: {title}",
    newOffer: "Новое предложение по заданию: {title}",
    chosen: "Вас выбрали для работы: {title}",
    newMessage: "Новое сообщение в чате: {title}",
    reviewRequest: "Работа отмечена как выполненная. Оставьте отзыв: {title}",
    providerApproved: "Ваш профиль одобрен! Можно отправлять предложения.",
    noOffers: "[Админ] Задание без предложений уже час: {title}",
  },
};

async function sendTwilio(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const waFrom = process.env.TWILIO_WHATSAPP_FROM; // e.g. "whatsapp:+14155238886"
  const smsFrom = process.env.TWILIO_SMS_FROM;
  if (!sid || !token || (!waFrom && !smsFrom)) {
    console.log(`[notify] (no Twilio configured) to=${to}: ${body}`);
    return;
  }
  const params = new URLSearchParams(
    waFrom ? { From: waFrom, To: `whatsapp:${to}`, Body: body } : { From: smsFrom!, To: to, Body: body },
  );
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  if (!res.ok) console.error(`[notify] Twilio ${res.status}: ${await res.text()}`);
}

// Sends one notification per user, in each user's language, with a link to the task.
export async function notifyUsers(userIds: string[], kind: Kind, vars: { title?: string; taskId?: string } = {}) {
  if (userIds.length === 0) return;
  const admin = createAdminClient();
  const { data: profiles } = await admin.from("profiles").select("id, lang").in("id", userIds);
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  await Promise.all(
    (profiles ?? []).map(async (p) => {
      const { data } = await admin.auth.admin.getUserById(p.id);
      const phone = data.user?.phone ? `+${data.user.phone.replace(/^\+/, "")}` : null;
      if (!phone) return;
      const lang: Lang = p.lang === "ru" ? "ru" : "he";
      let body = texts[lang][kind].replace("{title}", vars.title ?? "");
      if (vars.taskId) body += `\n${base}/tasks/${vars.taskId}`;
      body += `\n— ${dicts[lang].appName}`;
      await sendTwilio(phone, body);
    }),
  );
}

export async function adminIds() {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id").eq("is_admin", true);
  return (data ?? []).map((r) => r.id as string);
}
