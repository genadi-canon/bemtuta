import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminIds, notifyUsers } from "@/lib/notify";

// Runs daily at 06:00 UTC (vercel.json; the free Vercel plan allows one run a day): expires stale tasks
// and alerts admins about open tasks from the last day that still have no offer.
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data: expired } = await admin.rpc("expire_tasks");

  const now = Date.now();
  const { data: stale } = await admin
    .from("tasks")
    .select("id, title, offers(count)")
    .eq("status", "open")
    .lt("created_at", new Date(now - 60 * 60 * 1000).toISOString())
    .gte("created_at", new Date(now - 25 * 60 * 60 * 1000).toISOString());
  const noOffers = ((stale ?? []) as { id: string; title: string; offers: { count: number }[] }[]).filter((t) => (t.offers[0]?.count ?? 0) === 0);
  const admins = await adminIds();
  for (const task of noOffers) await notifyUsers(admins, "noOffers", { title: task.title, taskId: task.id });

  return NextResponse.json({ expired, alerted: noOffers.length });
}
