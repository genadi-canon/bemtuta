import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtDateTime, fmtNis } from "@/lib/format";
import { MAX_OFFERS, nameOf, type Area, type Category, type Message, type Offer, type ProviderProfile, type Review, type Task } from "@/lib/types";
import { adminSetBlocked, cancelTask, chooseOffer, leaveReview, markDone, reportProblem, sendOffer, withdrawOffer } from "@/app/actions";
import SubmitButton from "@/components/SubmitButton";
import StatusBadge from "@/components/StatusBadge";
import Stars from "@/components/Stars";
import Chat from "./Chat";

export default async function TaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ e?: string; reported?: string }>;
}) {
  const { id } = await params;
  const { e, reported } = await searchParams;
  const { supabase, user, profile, provider, lang, t } = await requireUser(`/tasks/${id}`);

  const { data: task } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle<Task>();
  if (!task) notFound();

  const isCustomer = task.customer_id === user.id;
  const isChosen = task.chosen_provider_id === user.id;
  const isParticipant = isCustomer || isChosen;
  const chatOpen = isParticipant && ["assigned", "done", "reviewed"].includes(task.status);

  const [{ data: category }, { data: area }, { data: addr }, { data: offerRows }, { data: reviewRows }, { data: msgRows }] =
    await Promise.all([
      supabase.from("categories").select("*").eq("id", task.category_id).single<Category>(),
      supabase.from("areas").select("*").eq("id", task.area_id).single<Area>(),
      supabase.from("task_addresses").select("address").eq("task_id", id).maybeSingle(),
      supabase.from("offers").select("*").eq("task_id", id).order("price"),
      supabase.from("reviews").select("*").eq("task_id", id),
      chatOpen
        ? supabase.from("messages").select("*").eq("task_id", id).order("created_at")
        : Promise.resolve({ data: [] as Message[] }),
    ]);
  const offers = (offerRows ?? []) as Offer[];
  const reviews = (reviewRows ?? []) as Review[];

  // Names and provider stats for everyone shown on this page.
  const peopleIds = Array.from(new Set([task.customer_id, ...offers.map((o) => o.provider_id), task.chosen_provider_id].filter(Boolean))) as string[];
  const [{ data: people }, { data: providerRows }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("id", peopleIds),
    supabase.from("provider_profiles").select("*").in("user_id", peopleIds),
  ]);
  const nameById = new Map((people ?? []).map((p) => [p.id as string, p.full_name as string]));
  const statsById = new Map(((providerRows ?? []) as ProviderProfile[]).map((p) => [p.user_id, p]));

  // Task photos are private; this user can read the task, so sign them for display.
  let photoUrls: string[] = [];
  if (task.photos.length > 0) {
    const { data } = await createAdminClient().storage.from("task-photos").createSignedUrls(task.photos, 3600);
    photoUrls = (data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[];
  }

  const myOffer = offers.find((o) => o.provider_id === user.id);
  const isFull = task.offer_count >= MAX_OFFERS;
  const canOffer = !isCustomer && task.status === "open" && provider?.status === "approved" && !myOffer && !isFull;
  const myReview = reviews.find((r) => r.author_id === user.id);
  const otherReview = reviews.find((r) => r.author_id !== user.id);
  const otherId = isCustomer ? task.chosen_provider_id : task.customer_id;

  return (
    <div className="space-y-5">
      {e && <div className="alert">{t.common.error}</div>}
      {reported && <div className="note">{t.task.reported}</div>}

      <section className="card space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl font-bold">{task.title}</h1>
          <StatusBadge status={task.status} t={t} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-600">
          {category && (
            <span>
              {category.icon} {nameOf(category, lang)}
            </span>
          )}
          {area && <span>📍 {nameOf(area, lang)}</span>}
          <span>🗓 {fmtDateTime(task.scheduled_at, lang)}</span>
          {task.budget && (
            <span>
              {t.task.budgetLabel}: {fmtNis(task.budget)}
            </span>
          )}
        </div>
        {task.description && <p className="whitespace-pre-line">{task.description}</p>}
        {photoUrls.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {photoUrls.map((u) => (
              <a key={u} href={u} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed URLs change every hour */}
                <img src={u} alt="" className="h-28 w-28 shrink-0 rounded-xl object-cover" />
              </a>
            ))}
          </div>
        )}
        {addr?.address && (
          <p className="rounded-xl bg-stone-100 p-2 text-sm">
            🏠 {t.task.addressLabel}: <strong>{addr.address}</strong>
          </p>
        )}
      </section>

      {/* Customer: compare and choose offers */}
      {isCustomer && task.status === "open" && (
        <section>
          <h2 className="h2">
            {t.task.offers} ({offers.filter((o) => o.status === "sent").length}/{MAX_OFFERS})
          </h2>
          {offers.filter((o) => o.status === "sent").length === 0 && <p className="text-stone-500">{t.task.noOffers}</p>}
          <ul className="space-y-3">
            {offers
              .filter((o) => o.status === "sent")
              .map((o) => {
                const s = statsById.get(o.provider_id);
                return (
                  <li key={o.id} className="card space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/providers/${o.provider_id}`} className="font-medium underline-offset-2 hover:underline">
                        {nameById.get(o.provider_id)} <span className="badge bg-teal-100 text-teal-800">✓ {t.provider.verified}</span>
                      </Link>
                      <span className="text-lg font-bold">{fmtNis(o.price)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-stone-600">
                      <Stars value={s?.rating_avg ?? 0} count={s?.rating_count ?? 0} />
                      <span>
                        {s?.jobs_done ?? 0} {t.offer.jobsDone}
                      </span>
                      {o.available_time && <span>🕒 {o.available_time}</span>}
                    </div>
                    {o.message && <p className="whitespace-pre-line text-sm">{o.message}</p>}
                    <form action={chooseOffer}>
                      <input type="hidden" name="task_id" value={task.id} />
                      <input type="hidden" name="offer_id" value={o.id} />
                      <SubmitButton className="btn w-full">{t.task.choose}</SubmitButton>
                    </form>
                  </li>
                );
              })}
          </ul>
        </section>
      )}

      {/* Provider: send an offer, or see the one already sent */}
      {canOffer && (
        <form action={sendOffer} className="card space-y-3">
          <h2 className="h2">{t.offer.send}</h2>
          <input type="hidden" name="task_id" value={task.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">{t.offer.price}</span>
              <input name="price" type="number" min={1} required className="input" inputMode="numeric" dir="ltr" />
            </label>
            <label className="block">
              <span className="label">{t.offer.when}</span>
              <input name="available_time" className="input" maxLength={120} />
            </label>
          </div>
          <label className="block">
            <span className="label">{t.offer.message}</span>
            <textarea name="message" className="input min-h-20" maxLength={1000} />
          </label>
          <SubmitButton className="btn w-full">{t.offer.send}</SubmitButton>
        </form>
      )}
      {!isCustomer && task.status === "open" && provider?.status === "approved" && !myOffer && isFull && (
        <p className="note">{t.offer.full}</p>
      )}
      {myOffer && !isChosen && (
        <section className="card space-y-2">
          <h2 className="h2">{t.offer.yours}</h2>
          <p className="text-lg font-bold">{fmtNis(myOffer.price)}</p>
          <p className="text-sm text-stone-600">
            {myOffer.status === "sent" && t.offer.sent}
            {myOffer.status === "declined" && t.offer.declined}
            {myOffer.status === "withdrawn" && t.offer.withdrawn}
          </p>
          {myOffer.status === "sent" && (
            <form action={withdrawOffer}>
              <input type="hidden" name="task_id" value={task.id} />
              <input type="hidden" name="offer_id" value={myOffer.id} />
              <SubmitButton className="btn-secondary">{t.offer.withdraw}</SubmitButton>
            </form>
          )}
        </section>
      )}

      {/* Both sides after a choice */}
      {isParticipant && task.chosen_provider_id && (
        <section className="card space-y-2">
          <h2 className="h2">{isCustomer ? t.task.chosenProvider : t.task.yourCustomer}</h2>
          {isChosen && task.status === "assigned" && <p className="note mb-0">{t.offer.accepted}</p>}
          <div className="flex items-center justify-between">
            {isCustomer ? (
              <Link href={`/providers/${task.chosen_provider_id}`} className="font-medium hover:underline">
                {nameById.get(task.chosen_provider_id)}
              </Link>
            ) : (
              <span className="font-medium">{nameById.get(task.customer_id)}</span>
            )}
            {task.final_price && <span className="text-lg font-bold">{fmtNis(task.final_price)}</span>}
          </div>
        </section>
      )}

      {chatOpen && <Chat taskId={task.id} userId={user.id} initial={(msgRows ?? []) as Message[]} names={Object.fromEntries(nameById)} t={t.chat} />}

      {isParticipant && task.status === "assigned" && (
        <form action={markDone} className="card space-y-3">
          <input type="hidden" name="task_id" value={task.id} />
          <label className="block">
            <span className="label">{t.task.finalPrice}</span>
            <input
              name="final_price"
              type="number"
              min={1}
              defaultValue={task.final_price ?? undefined}
              className="input"
              inputMode="numeric"
              dir="ltr"
            />
          </label>
          <SubmitButton className="btn w-full">✓ {t.task.markDone}</SubmitButton>
        </form>
      )}

      {isParticipant && ["done", "reviewed"].includes(task.status) && (
        <section className="card space-y-3">
          <h2 className="h2">{t.review.title}</h2>
          {myReview ? (
            <p className="text-sm">
              {t.review.thanks} <Stars value={myReview.stars} />
            </p>
          ) : (
            <form action={leaveReview} className="space-y-3">
              <input type="hidden" name="task_id" value={task.id} />
              <p className="font-medium">{isCustomer ? t.review.rateProvider : t.review.rateCustomer}</p>
              <div className="flex flex-row-reverse justify-end gap-1" dir="ltr">
                {[5, 4, 3, 2, 1].map((n) => (
                  <label key={n} className="cursor-pointer">
                    <input type="radio" name="stars" value={n} required className="peer sr-only" />
                    <span className="text-3xl text-stone-300 peer-checked:text-amber-500">★</span>
                  </label>
                ))}
              </div>
              <textarea name="body" className="input min-h-16" maxLength={1000} placeholder={t.review.body} />
              <SubmitButton className="btn w-full">{t.review.submit}</SubmitButton>
            </form>
          )}
          {otherReview && otherId && myReview && (
            <p className="text-sm text-stone-600">
              {nameById.get(otherId)}: <Stars value={otherReview.stars} /> {otherReview.body}
            </p>
          )}
        </section>
      )}

      {isCustomer && ["open", "assigned"].includes(task.status) && (
        <form action={cancelTask}>
          <input type="hidden" name="task_id" value={task.id} />
          <SubmitButton className="btn-danger w-full">{t.task.cancel}</SubmitButton>
        </form>
      )}

      {(isParticipant || myOffer) && (
        <details className="text-sm">
          <summary className="cursor-pointer text-stone-500">⚠ {t.task.report}</summary>
          <form action={reportProblem} className="mt-2 space-y-2">
            <input type="hidden" name="task_id" value={task.id} />
            <textarea name="reason" required className="input min-h-16" placeholder={t.task.reportPh} />
            <SubmitButton className="btn-secondary">{t.task.send}</SubmitButton>
          </form>
        </details>
      )}

      {profile.is_admin && (
        <section className="card space-y-2 border-dashed text-sm">
          <p className="text-stone-500">{t.admin.title}</p>
          {[task.customer_id, task.chosen_provider_id].filter((x): x is string => !!x && x !== user.id).map((uid) => (
            <form key={uid} action={adminSetBlocked} className="flex items-center justify-between gap-2">
              <span>{nameById.get(uid)}</span>
              <input type="hidden" name="user_id" value={uid} />
              <input type="hidden" name="blocked" value="1" />
              <SubmitButton className="btn-danger px-3 py-1">{t.admin.block}</SubmitButton>
            </form>
          ))}
        </section>
      )}
    </div>
  );
}
