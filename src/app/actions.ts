"use server";

import { after } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLang } from "@/lib/i18n";
import { adminIds, notifyUsers } from "@/lib/notify";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function str(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

function intOrNull(fd: FormData, key: string) {
  const v = str(fd, key);
  if (!v) return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function safeNext(next: string) {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function ext(file: File) {
  const m = /\.([a-z0-9]{1,5})$/i.exec(file.name);
  return m ? m[1].toLowerCase() : "jpg";
}

async function uploadFiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bucket: string,
  userId: string,
  files: File[],
) {
  const paths: string[] = [];
  for (const file of files) {
    if (!file || file.size === 0) continue;
    if (file.size > MAX_PHOTO_BYTES) throw new Error("file too large");
    const path = `${userId}/${crypto.randomUUID()}.${ext(file)}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type });
    if (error) throw error;
    paths.push(path);
  }
  return paths;
}

// ---------------------------------------------------------------------------
// Profile and language
// ---------------------------------------------------------------------------

export async function setLang(lang: string) {
  if (!isLang(lang)) return;
  (await cookies()).set("lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await supabase.from("profiles").update({ lang }).eq("id", user.id);
  revalidatePath("/", "layout");
}

export async function saveProfile(fd: FormData) {
  const { supabase, user } = await currentUser();
  const fullName = str(fd, "full_name").slice(0, 80);
  const lang = str(fd, "lang");
  const next = safeNext(str(fd, "next") || "/");
  if (!fullName) redirect(`/login?step=name&e=1&next=${encodeURIComponent(next)}`);
  const update: { full_name: string; lang?: "he" | "ru" } = { full_name: fullName };
  if (isLang(lang)) {
    update.lang = lang;
    (await cookies()).set("lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  await supabase.from("profiles").update(update).eq("id", user.id);
  revalidatePath("/", "layout");
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function createTask(fd: FormData) {
  const { supabase, user } = await currentUser();
  const categoryId = str(fd, "category_id");
  const title = str(fd, "title").slice(0, 120);
  const description = str(fd, "description").slice(0, 3000);
  const areaId = str(fd, "area_id");
  const address = str(fd, "address").slice(0, 200);
  const when = str(fd, "scheduled_at");
  const budget = intOrNull(fd, "budget");

  // The form sends local Israel time ("2026-11-02T18:00"); store it as a real instant.
  const scheduledAt = when ? new Date(`${when}:00${israelOffset(when)}`) : null;
  if (!categoryId || title.length < 3 || !areaId || !address || !scheduledAt || isNaN(scheduledAt.getTime())) {
    redirect(`/tasks/new?e=1&category=${encodeURIComponent(categoryId)}`);
  }

  const photos = await uploadFiles(supabase, "task-photos", user.id, fd.getAll("photos") as File[]);

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      customer_id: user.id,
      category_id: categoryId,
      title,
      description,
      area_id: areaId,
      scheduled_at: scheduledAt.toISOString(),
      budget,
      photos,
    })
    .select("id")
    .single();
  if (error || !task) redirect(`/tasks/new?e=1&category=${encodeURIComponent(categoryId)}`);

  await supabase.from("task_addresses").insert({ task_id: task.id, address });

  after(async () => {
    const admin = createAdminClient();
    const [{ data: byCat }, { data: byArea }, { data: approved }] = await Promise.all([
      admin.from("provider_categories").select("provider_id").eq("category_id", categoryId),
      admin.from("provider_areas").select("provider_id").eq("area_id", areaId),
      admin.from("provider_profiles").select("user_id").eq("status", "approved"),
    ]);
    const inArea = new Set((byArea ?? []).map((r) => r.provider_id));
    const ok = new Set((approved ?? []).map((r) => r.user_id));
    const ids = (byCat ?? []).map((r) => r.provider_id as string).filter((id) => inArea.has(id) && ok.has(id) && id !== user.id);
    await notifyUsers(ids, "newTask", { title, taskId: task.id });
  });

  redirect(`/tasks/${task.id}`);
}

// Israel is UTC+3 in summer (late March to late October) and UTC+2 otherwise.
function israelOffset(local: string) {
  const probe = new Date(`${local}:00Z`);
  const tz = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", timeZoneName: "shortOffset" })
    .formatToParts(probe)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = /GMT([+-]\d+)/.exec(tz ?? "");
  const h = m ? Number(m[1]) : 2;
  return `${h >= 0 ? "+" : "-"}${String(Math.abs(h)).padStart(2, "0")}:00`;
}

export async function sendOffer(fd: FormData) {
  const { supabase, user } = await currentUser();
  const taskId = str(fd, "task_id");
  const price = intOrNull(fd, "price");
  if (!price) redirect(`/tasks/${taskId}?e=1`);
  const { error } = await supabase.from("offers").insert({
    task_id: taskId,
    provider_id: user.id,
    price,
    message: str(fd, "message").slice(0, 1000),
    available_time: str(fd, "available_time").slice(0, 120),
  });
  if (error) redirect(`/tasks/${taskId}?e=1`);

  after(async () => {
    const admin = createAdminClient();
    const { data: task } = await admin.from("tasks").select("customer_id, title").eq("id", taskId).single();
    if (task) await notifyUsers([task.customer_id], "newOffer", { title: task.title, taskId });
  });
  revalidatePath(`/tasks/${taskId}`);
}

export async function withdrawOffer(fd: FormData) {
  const { supabase } = await currentUser();
  const taskId = str(fd, "task_id");
  await supabase.rpc("withdraw_offer", { p_offer: str(fd, "offer_id") });
  revalidatePath(`/tasks/${taskId}`);
}

export async function chooseOffer(fd: FormData) {
  const { supabase } = await currentUser();
  const taskId = str(fd, "task_id");
  const offerId = str(fd, "offer_id");
  const { error } = await supabase.rpc("choose_offer", { p_offer: offerId });
  if (error) redirect(`/tasks/${taskId}?e=1`);

  after(async () => {
    const admin = createAdminClient();
    const { data: task } = await admin.from("tasks").select("chosen_provider_id, title").eq("id", taskId).single();
    if (task?.chosen_provider_id) await notifyUsers([task.chosen_provider_id], "chosen", { title: task.title, taskId });
  });
  revalidatePath(`/tasks/${taskId}`);
}

export async function cancelTask(fd: FormData) {
  const { supabase } = await currentUser();
  const taskId = str(fd, "task_id");
  await supabase.rpc("cancel_task", { p_task: taskId });
  revalidatePath(`/tasks/${taskId}`);
}

export async function markDone(fd: FormData) {
  const { supabase, user } = await currentUser();
  const taskId = str(fd, "task_id");
  const { error } = await supabase.rpc("mark_task_done", { p_task: taskId, p_final_price: intOrNull(fd, "final_price") });
  if (error) redirect(`/tasks/${taskId}?e=1`);

  after(async () => {
    const admin = createAdminClient();
    const { data: task } = await admin.from("tasks").select("customer_id, chosen_provider_id, title").eq("id", taskId).single();
    if (!task) return;
    const other = task.customer_id === user.id ? task.chosen_provider_id : task.customer_id;
    if (other) await notifyUsers([other], "reviewRequest", { title: task.title, taskId });
  });
  revalidatePath(`/tasks/${taskId}`);
}

export async function leaveReview(fd: FormData) {
  const { supabase } = await currentUser();
  const taskId = str(fd, "task_id");
  const stars = Number(str(fd, "stars"));
  if (!(stars >= 1 && stars <= 5)) redirect(`/tasks/${taskId}?e=1`);
  const { error } = await supabase.rpc("leave_review", { p_task: taskId, p_stars: stars, p_body: str(fd, "body").slice(0, 1000) });
  if (error) redirect(`/tasks/${taskId}?e=1`);
  revalidatePath(`/tasks/${taskId}`);
}

export async function sendMessage(taskId: string, body: string) {
  const { supabase, user } = await currentUser();
  const text = body.trim().slice(0, 2000);
  if (!text) return;

  const { data: last } = await supabase
    .from("messages")
    .select("sender_id, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("messages").insert({ task_id: taskId, sender_id: user.id, body: text });
  if (error) throw new Error("send failed");

  // Notify the other side only when a conversation (re)starts, not on every line.
  const quiet = !last || last.sender_id !== user.id || Date.now() - new Date(last.created_at).getTime() > 15 * 60 * 1000;
  if (quiet) {
    after(async () => {
      const admin = createAdminClient();
      const { data: task } = await admin.from("tasks").select("customer_id, chosen_provider_id, title").eq("id", taskId).single();
      if (!task) return;
      const other = task.customer_id === user.id ? task.chosen_provider_id : task.customer_id;
      if (other) await notifyUsers([other], "newMessage", { title: task.title, taskId });
    });
  }
}

export async function reportProblem(fd: FormData) {
  const { supabase, user } = await currentUser();
  const taskId = str(fd, "task_id") || null;
  const reason = str(fd, "reason").slice(0, 2000);
  if (!reason) redirect(taskId ? `/tasks/${taskId}?e=1` : "/");
  await supabase.from("reports").insert({ reporter_id: user.id, task_id: taskId, reason });
  after(async () => notifyUsers(await adminIds(), "noOffers", { title: `REPORT: ${reason.slice(0, 80)}`, taskId: taskId ?? undefined }));
  redirect(taskId ? `/tasks/${taskId}?reported=1` : "/?reported=1");
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export async function submitProvider(fd: FormData) {
  const { supabase, user } = await currentUser();
  const categories = fd.getAll("categories").map(String);
  const areas = fd.getAll("areas").map(String);
  const bio = str(fd, "bio").slice(0, 2000);
  const references = str(fd, "references").slice(0, 500);
  if (categories.length === 0 || areas.length === 0 || !bio) redirect("/join?e=1");

  const { data: existing } = await supabase.from("provider_profiles").select("*").eq("user_id", user.id).maybeSingle();
  const [idPhoto] = await uploadFiles(supabase, "provider-docs", user.id, [fd.get("id_photo") as File]);
  const [selfie] = await uploadFiles(supabase, "provider-docs", user.id, [fd.get("selfie") as File]);
  const [police] = await uploadFiles(supabase, "provider-docs", user.id, [fd.get("police_cert") as File]);

  const idPath = idPhoto ?? existing?.id_photo_path;
  const selfiePath = selfie ?? existing?.selfie_path;
  const policePath = police ?? existing?.police_cert_path;
  const { data: cats } = await supabase.from("categories").select("id, requires_police_cert").in("id", categories);
  const needsPolice = (cats ?? []).some((c) => c.requires_police_cert);
  if (!idPath || !selfiePath || (needsPolice && !policePath)) redirect("/join?e=1");

  // Service role: a resubmission after rejection goes back to "pending", which users cannot set themselves.
  const admin = createAdminClient();
  await admin.from("provider_profiles").upsert({
    user_id: user.id,
    bio,
    price_from: intOrNull(fd, "price_from"),
    references,
    id_photo_path: idPath,
    selfie_path: selfiePath,
    police_cert_path: policePath ?? null,
    status: existing?.status === "approved" ? "approved" : "pending",
    reject_reason: null,
  });
  await admin.from("provider_categories").delete().eq("provider_id", user.id);
  await admin.from("provider_areas").delete().eq("provider_id", user.id);
  await admin.from("provider_categories").insert(categories.map((c) => ({ provider_id: user.id, category_id: c })));
  await admin.from("provider_areas").insert(areas.map((a) => ({ provider_id: user.id, area_id: a })));

  if (existing?.status !== "approved") {
    after(async () => notifyUsers(await adminIds(), "noOffers", { title: "New provider waiting for approval" }));
  }
  revalidatePath("/join");
  redirect("/join?sent=1");
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function adminSetProviderStatus(fd: FormData) {
  const { supabase } = await currentUser();
  const userId = str(fd, "user_id");
  const status = str(fd, "status");
  const { error } = await supabase.rpc("admin_set_provider_status", {
    p_user: userId,
    p_status: status,
    p_reason: str(fd, "reason") || null,
  });
  if (!error && status === "approved") after(async () => notifyUsers([userId], "providerApproved"));
  revalidatePath("/admin");
}

export async function adminSetBlocked(fd: FormData) {
  const { supabase } = await currentUser();
  await supabase.rpc("admin_set_blocked", { p_user: str(fd, "user_id"), p_blocked: str(fd, "blocked") === "1" });
  revalidatePath("/admin");
}

export async function adminCloseReport(fd: FormData) {
  const { supabase } = await currentUser();
  await supabase.rpc("admin_close_report", { p_report: str(fd, "report_id") });
  revalidatePath("/admin");
}
