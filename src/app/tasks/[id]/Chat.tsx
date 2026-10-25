"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendMessage } from "@/app/actions";
import type { Dict } from "@/lib/i18n";
import type { Message } from "@/lib/types";

export default function Chat({
  taskId,
  userId,
  initial,
  names,
  t,
}: {
  taskId: string;
  userId: string;
  initial: Message[];
  names: Record<string, string>;
  t: Dict["chat"];
}) {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const add = (rows: Message[]) =>
      setMessages((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const fresh = rows.filter((r) => !seen.has(r.id));
        return fresh.length ? [...prev, ...fresh].sort((a, b) => a.created_at.localeCompare(b.created_at)) : prev;
      });

    (async () => {
      // Realtime checks row-level security with the user's token, so hand it over before subscribing.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`task-${taskId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `task_id=eq.${taskId}` }, (payload) =>
          add([payload.new as Message]),
        )
        .subscribe();
    })();

    // Fallback when the realtime socket misses events: poll every 5 seconds.
    const timer = setInterval(async () => {
      const { data } = await supabase.from("messages").select("*").eq("task_id", taskId).order("created_at");
      if (data) add(data as Message[]);
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [taskId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    start(async () => {
      await sendMessage(taskId, body);
      // Realtime delivers the row; reload as a fallback if it is not connected.
      const { data } = await createClient().from("messages").select("*").eq("task_id", taskId).order("created_at");
      if (data) setMessages(data as Message[]);
    });
  }

  return (
    <section className="card">
      <h2 className="h2">💬 {t.title}</h2>
      <div className="mb-3 max-h-80 space-y-2 overflow-y-auto">
        {messages.map((m) => {
          const mine = m.sender_id === userId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-teal-700 text-white" : "bg-stone-100"}`}>
                {!mine && <div className="text-xs font-medium text-stone-500">{names[m.sender_id]}</div>}
                <div className="whitespace-pre-line">{m.body}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={t.placeholder} maxLength={2000} />
        <button className="btn" disabled={pending || !text.trim()}>
          {t.send}
        </button>
      </form>
    </section>
  );
}
