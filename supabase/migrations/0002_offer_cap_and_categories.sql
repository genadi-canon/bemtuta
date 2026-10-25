-- Cap the number of live offers per task, and rework the category list.

-- ---------------------------------------------------------------------------
-- Offer cap: at most 5 offers in status 'sent' per task.
-- Providers cannot read each other's offers, so the count lives on the task.
-- ---------------------------------------------------------------------------

alter table public.tasks add column offer_count int not null default 0;

update public.tasks t
   set offer_count = (select count(*) from public.offers o where o.task_id = t.id and o.status = 'sent');

create function public.max_offers() returns int language sql immutable as $$ select 5 $$;

create function public.offers_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  -- Lock the task row so two providers cannot both take the last slot.
  select offer_count into n from public.tasks where id = new.task_id for update;
  if n >= public.max_offers() then
    raise exception 'task already has the maximum number of offers';
  end if;
  return new;
end $$;

create function public.offers_sync_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.tasks t
     set offer_count = (select count(*) from public.offers o where o.task_id = t.id and o.status = 'sent')
   where t.id = coalesce(new.task_id, old.task_id);
  return null;
end $$;

create trigger offers_cap before insert on public.offers
  for each row execute function public.offers_before_insert();
create trigger offers_count after insert or update of status or delete on public.offers
  for each row execute function public.offers_sync_count();

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------

update public.categories
   set name_he = 'עבודות כפיים ביתיות, שיפוצניק בקטנה', name_ru = 'Мелкий ремонт по дому, мастер на час'
 where id = 'assembly';

update public.categories
   set name_he = 'שליחויות והובלות', name_ru = 'Доставка и перевозки'
 where id = 'moving';

insert into public.categories (id, name_he, name_ru, icon, requires_police_cert, sort) values
  ('car', 'רכב: נהג תורן, טרמפים בהשתתפות בדלק, חילוץ', 'Авто: трезвый водитель, попутки за бензин, помощь на дороге', '🚗', false, 5)
on conflict (id) do nothing;
