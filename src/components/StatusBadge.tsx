import type { Dict } from "@/lib/i18n";
import type { TaskStatus } from "@/lib/types";

const colors: Record<TaskStatus, string> = {
  open: "bg-teal-100 text-teal-800",
  assigned: "bg-amber-100 text-amber-800",
  done: "bg-sky-100 text-sky-800",
  reviewed: "bg-stone-200 text-stone-700",
  cancelled: "bg-stone-100 text-stone-500",
  expired: "bg-stone-100 text-stone-500",
};

export default function StatusBadge({ status, t }: { status: TaskStatus; t: Dict }) {
  return <span className={`badge ${colors[status]}`}>{t.status[status]}</span>;
}
