-- Bematuta: initial schema, row-level security, and state-transition functions.

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

create table public.categories (
  id text primary key,
  name_he text not null,
  name_ru text not null,
  icon text not null default '',
  requires_police_cert boolean not null default false,
  sort int not null default 0
);

create table public.areas (
  id text primary key,
  name_he text not null,
  name_ru text not null,
  sort int not null default 0
);

insert into public.categories (id, name_he, name_ru, icon, requires_police_cert, sort) values
  ('assembly', 'הרכבת רהיטים ותיקונים קלים', 'Сборка мебели и мелкий ремонт', '🔧', false, 1),
  ('moving',   'הובלות קטנות, משלוחים וסבלות', 'Мелкие перевозки, доставка, грузчики', '📦', false, 2),
  ('cleaning', 'ניקיון חד-פעמי', 'Разовая уборка', '🧹', false, 3),
  ('sitting',  'שמירה על ילדים, כלבים ומבוגרים', 'Няня, выгул собак, сиделка', '🤝', true, 4);

insert into public.areas (id, name_he, name_ru, sort) values
  ('bat-yam-north',  'בת ים צפון', 'Бат-Ям север', 1),
  ('bat-yam-center', 'בת ים מרכז', 'Бат-Ям центр', 2),
  ('bat-yam-south',  'בת ים דרום', 'Бат-Ям юг', 3),
  ('ramat-yosef',    'רמת יוסף', 'Рамат-Йосеф', 4),
  ('bat-yam-east',   'בת ים מזרח (עמידר, ניצנה)', 'Бат-Ям восток', 5),
  ('holon',          'חולון', 'Холон', 6),
  ('jaffa',          'יפו', 'Яффо', 7);

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  lang text not null default 'he' check (lang in ('he', 'ru')),
  is_admin boolean not null default false,
  blocked boolean not null default false,
  created_at timestamptz not null default now()
);

-- Every new auth user gets a profile row.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

create table public.provider_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  bio text not null default '',
  price_from int,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text,
  id_photo_path text,
  selfie_path text,
  police_cert_path text,
  "references" text not null default '',
  rating_avg numeric(3, 2) not null default 0,
  rating_count int not null default 0,
  jobs_done int not null default 0,
  created_at timestamptz not null default now()
);

create table public.provider_categories (
  provider_id uuid references public.provider_profiles (user_id) on delete cascade,
  category_id text references public.categories (id),
  primary key (provider_id, category_id)
);

create table public.provider_areas (
  provider_id uuid references public.provider_profiles (user_id) on delete cascade,
  area_id text references public.areas (id),
  primary key (provider_id, area_id)
);

create function public.is_approved_provider(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.provider_profiles where user_id = uid and status = 'approved')
$$;

-- ---------------------------------------------------------------------------
-- Tasks, offers, chat, reviews, reports
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  category_id text not null references public.categories (id),
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '',
  area_id text not null references public.areas (id),
  scheduled_at timestamptz not null,
  budget int check (budget is null or budget > 0),
  photos text[] not null default '{}',
  status text not null default 'open'
    check (status in ('open', 'assigned', 'done', 'reviewed', 'cancelled', 'expired')),
  chosen_offer_id uuid,
  chosen_provider_id uuid references public.profiles (id),
  final_price int,
  created_at timestamptz not null default now(),
  done_at timestamptz
);

create index tasks_open_idx on public.tasks (status, category_id, area_id, created_at desc);
create index tasks_customer_idx on public.tasks (customer_id, created_at desc);

-- The street address is only shown to the customer, the chosen provider and admins.
create table public.task_addresses (
  task_id uuid primary key references public.tasks (id) on delete cascade,
  address text not null
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  provider_id uuid not null references public.profiles (id) on delete cascade,
  price int not null check (price > 0),
  message text not null default '',
  available_time text not null default '',
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  unique (task_id, provider_id)
);

alter table public.tasks
  add constraint tasks_chosen_offer_fk foreign key (chosen_offer_id) references public.offers (id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index messages_task_idx on public.messages (task_id, created_at);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('customer', 'provider')),
  stars int not null check (stars between 1 and 5),
  body text not null default '',
  created_at timestamptz not null default now(),
  unique (task_id, author_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create function public.is_task_participant(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tasks
    where id = t and (customer_id = auth.uid() or chosen_provider_id = auth.uid())
  )
$$;

create function public.has_offered(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.offers where task_id = t and provider_id = auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.categories enable row level security;
alter table public.areas enable row level security;
alter table public.profiles enable row level security;
alter table public.provider_profiles enable row level security;
alter table public.provider_categories enable row level security;
alter table public.provider_areas enable row level security;
alter table public.tasks enable row level security;
alter table public.task_addresses enable row level security;
alter table public.offers enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;
alter table public.reports enable row level security;

create policy "read categories" on public.categories for select using (true);
create policy "read areas" on public.areas for select using (true);

create policy "read profiles" on public.profiles for select to authenticated using (true);
create policy "update own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- Users may change only their name and language; admin flags go through functions.
revoke update on public.profiles from authenticated, anon;
grant update (full_name, lang) on public.profiles to authenticated;

create policy "read provider profiles" on public.provider_profiles for select to authenticated
  using (status = 'approved' or user_id = auth.uid() or public.is_admin());
create policy "create own provider profile" on public.provider_profiles for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');
create policy "update own provider profile" on public.provider_profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.provider_profiles from authenticated, anon;
grant update (bio, price_from, id_photo_path, selfie_path, police_cert_path, "references")
  on public.provider_profiles to authenticated;

create policy "read provider categories" on public.provider_categories for select to authenticated using (true);
create policy "manage own provider categories" on public.provider_categories for all to authenticated
  using (provider_id = auth.uid()) with check (provider_id = auth.uid());
create policy "read provider areas" on public.provider_areas for select to authenticated using (true);
create policy "manage own provider areas" on public.provider_areas for all to authenticated
  using (provider_id = auth.uid()) with check (provider_id = auth.uid());

create policy "read tasks" on public.tasks for select to authenticated using (
  customer_id = auth.uid()
  or chosen_provider_id = auth.uid()
  or (status = 'open' and public.is_approved_provider(auth.uid()))
  or public.has_offered(id)
  or public.is_admin()
);
create policy "create own task" on public.tasks for insert to authenticated with check (
  customer_id = auth.uid() and status = 'open' and chosen_offer_id is null and chosen_provider_id is null
  and not exists (select 1 from public.profiles where id = auth.uid() and blocked)
);
-- No direct updates: status changes go through the functions below.
revoke update on public.tasks from authenticated, anon;

create policy "read task address" on public.task_addresses for select to authenticated
  using (public.is_task_participant(task_id) or public.is_admin());
create policy "create task address" on public.task_addresses for insert to authenticated
  with check (exists (select 1 from public.tasks where id = task_id and customer_id = auth.uid()));

create policy "read offers" on public.offers for select to authenticated using (
  provider_id = auth.uid()
  or exists (select 1 from public.tasks t where t.id = task_id and t.customer_id = auth.uid())
  or public.is_admin()
);
create policy "send offer" on public.offers for insert to authenticated with check (
  provider_id = auth.uid()
  and status = 'sent'
  and public.is_approved_provider(auth.uid())
  and not exists (select 1 from public.profiles where id = auth.uid() and blocked)
  and exists (select 1 from public.tasks t where t.id = task_id and t.status = 'open' and t.customer_id <> auth.uid())
);
revoke update on public.offers from authenticated, anon;

create policy "read messages" on public.messages for select to authenticated
  using (public.is_task_participant(task_id) or public.is_admin());
create policy "send message" on public.messages for insert to authenticated with check (
  sender_id = auth.uid()
  and public.is_task_participant(task_id)
  and exists (select 1 from public.tasks t where t.id = task_id and t.status in ('assigned', 'done', 'reviewed'))
);

create policy "read reviews" on public.reviews for select to authenticated using (true);

create policy "create report" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "admins read reports" on public.reports for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- State transitions
-- ---------------------------------------------------------------------------

create function public.choose_offer(p_offer uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  o public.offers;
begin
  select * into o from public.offers where id = p_offer for update;
  if not found then raise exception 'offer not found'; end if;

  update public.tasks
     set status = 'assigned', chosen_offer_id = o.id, chosen_provider_id = o.provider_id, final_price = o.price
   where id = o.task_id and customer_id = auth.uid() and status = 'open';
  if not found then raise exception 'task is not open or not yours'; end if;

  update public.offers set status = 'accepted' where id = o.id;
  update public.offers set status = 'declined' where task_id = o.task_id and id <> o.id and status = 'sent';
end $$;

create function public.withdraw_offer(p_offer uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.offers set status = 'withdrawn'
   where id = p_offer and provider_id = auth.uid() and status = 'sent';
  if not found then raise exception 'offer cannot be withdrawn'; end if;
end $$;

create function public.mark_task_done(p_task uuid, p_final_price int) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.tasks
     set status = 'done', done_at = now(), final_price = coalesce(p_final_price, final_price)
   where id = p_task and status = 'assigned'
     and (customer_id = auth.uid() or chosen_provider_id = auth.uid());
  if not found then raise exception 'task cannot be marked done'; end if;

  update public.provider_profiles set jobs_done = jobs_done + 1
   where user_id = (select chosen_provider_id from public.tasks where id = p_task);
end $$;

create function public.cancel_task(p_task uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.tasks set status = 'cancelled'
   where id = p_task and customer_id = auth.uid() and status in ('open', 'assigned');
  if not found then raise exception 'task cannot be cancelled'; end if;
  update public.offers set status = 'declined' where task_id = p_task and status = 'sent';
end $$;

create function public.leave_review(p_task uuid, p_stars int, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare
  t public.tasks;
  v_role text;
  v_target uuid;
begin
  select * into t from public.tasks where id = p_task for update;
  if not found or t.status not in ('done', 'reviewed') then raise exception 'task is not done'; end if;

  if t.customer_id = auth.uid() then
    v_role := 'customer'; v_target := t.chosen_provider_id;
  elsif t.chosen_provider_id = auth.uid() then
    v_role := 'provider'; v_target := t.customer_id;
  else
    raise exception 'not a participant';
  end if;

  insert into public.reviews (task_id, author_id, target_id, role, stars, body)
  values (p_task, auth.uid(), v_target, v_role, p_stars, coalesce(p_body, ''));

  if v_role = 'customer' then
    update public.provider_profiles p
       set rating_count = s.n, rating_avg = s.avg
      from (select count(*) n, avg(stars) avg from public.reviews where target_id = v_target and role = 'customer') s
     where p.user_id = v_target;
  end if;

  if (select count(*) from public.reviews where task_id = p_task) >= 2 then
    update public.tasks set status = 'reviewed' where id = p_task;
  end if;
end $$;

create function public.admin_set_provider_status(p_user uuid, p_status text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  update public.provider_profiles set status = p_status, reject_reason = p_reason where user_id = p_user;
end $$;

create function public.admin_set_blocked(p_user uuid, p_blocked boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  update public.profiles set blocked = p_blocked where id = p_user;
end $$;

create function public.admin_close_report(p_report uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  update public.reports set status = 'closed' where id = p_report;
end $$;

-- Open tasks whose date passed a day ago without a chosen provider expire. Called by the cron route.
create function public.expire_tasks() returns int
language sql security definer set search_path = public as $$
  with x as (
    update public.tasks set status = 'expired'
     where status = 'open' and scheduled_at < now() - interval '1 day'
    returning 1
  ) select count(*)::int from x
$$;
revoke execute on function public.expire_tasks() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values
  ('task-photos', 'task-photos', false),
  ('provider-docs', 'provider-docs', false),
  ('avatars', 'avatars', true)
on conflict do nothing;

-- Files live under "<user id>/..." so the first path segment is the owner.
create policy "upload own files" on storage.objects for insert to authenticated with check (
  bucket_id in ('task-photos', 'provider-docs', 'avatars')
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "read own files" on storage.objects for select to authenticated using (
  bucket_id in ('task-photos', 'provider-docs') and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "admins read files" on storage.objects for select to authenticated using (
  bucket_id in ('task-photos', 'provider-docs') and public.is_admin()
);
create policy "read avatars" on storage.objects for select using (bucket_id = 'avatars');

-- Realtime for chat.
alter publication supabase_realtime add table public.messages;
