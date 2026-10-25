import type { Lang } from "@/lib/i18n";

export type TaskStatus = "open" | "assigned" | "done" | "reviewed" | "cancelled" | "expired";

export type Profile = {
  id: string;
  full_name: string;
  lang: Lang;
  is_admin: boolean;
  blocked: boolean;
  created_at: string;
};

export type ProviderProfile = {
  user_id: string;
  bio: string;
  price_from: number | null;
  status: "pending" | "approved" | "rejected";
  reject_reason: string | null;
  id_photo_path: string | null;
  selfie_path: string | null;
  police_cert_path: string | null;
  references: string;
  rating_avg: number;
  rating_count: number;
  jobs_done: number;
  created_at: string;
};

export type Category = { id: string; name_he: string; name_ru: string; icon: string; requires_police_cert: boolean; sort: number };
export type Area = { id: string; name_he: string; name_ru: string; sort: number };

export type Task = {
  id: string;
  customer_id: string;
  category_id: string;
  title: string;
  description: string;
  area_id: string;
  scheduled_at: string;
  budget: number | null;
  photos: string[];
  status: TaskStatus;
  chosen_offer_id: string | null;
  chosen_provider_id: string | null;
  final_price: number | null;
  offer_count: number;
  created_at: string;
  done_at: string | null;
};

// Matches public.max_offers() in the database.
export const MAX_OFFERS = 5;

export type Offer = {
  id: string;
  task_id: string;
  provider_id: string;
  price: number;
  message: string;
  available_time: string;
  status: "sent" | "accepted" | "declined" | "withdrawn";
  created_at: string;
};

export type Message = { id: string; task_id: string; sender_id: string; body: string; created_at: string };

export type Review = {
  id: string;
  task_id: string;
  author_id: string;
  target_id: string;
  role: "customer" | "provider";
  stars: number;
  body: string;
  created_at: string;
};

export function nameOf(row: { name_he: string; name_ru: string }, lang: Lang) {
  return lang === "ru" ? row.name_ru : row.name_he;
}
