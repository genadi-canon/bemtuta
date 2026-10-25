-- End-to-end check of the task lifecycle and the main RLS rules.
-- Run against a local database: psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/flow.sql
begin;

insert into auth.users (id, phone, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', '972500000001', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', '972500000002', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', '972500000003', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000d', '972500000004', 'authenticated', 'authenticated');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000d';

create function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.expect_fail(sql text, label text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise notice 'ok (denied): %', label;
    return;
  end;
  raise exception 'expected failure but succeeded: %', label;
end $$;

-- a = customer, b = provider, c = second provider (pending), d = admin
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($$update public.profiles set is_admin = true where id = auth.uid()$$, 'user makes self admin');
insert into public.tasks (id, customer_id, category_id, title, area_id, scheduled_at)
  values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'assembly', 'Assemble wardrobe', 'bat-yam-north', now() + interval '1 day');
insert into public.task_addresses values ('10000000-0000-0000-0000-000000000001', 'Balfour 10');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.provider_profiles (user_id, bio) values (auth.uid(), 'handy');
select pg_temp.expect_fail($$update public.provider_profiles set status = 'approved' where user_id = auth.uid()$$, 'provider approves self');
select pg_temp.expect_fail(
  $$insert into public.offers (task_id, provider_id, price) values ('10000000-0000-0000-0000-000000000001', auth.uid(), 200)$$,
  'pending provider sends offer');
do $$ begin
  if exists (select 1 from public.tasks) then raise exception 'pending provider can see tasks'; end if;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.admin_set_provider_status('00000000-0000-0000-0000-00000000000b', 'approved', null);

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  if (select count(*) from public.tasks) <> 1 then raise exception 'approved provider cannot see open task'; end if;
  if exists (select 1 from public.task_addresses) then raise exception 'address leaked before choice'; end if;
end $$;
insert into public.offers (id, task_id, provider_id, price, message)
  values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', auth.uid(), 200, 'tomorrow');
select pg_temp.expect_fail($$select public.choose_offer('20000000-0000-0000-0000-000000000001')$$, 'provider chooses own offer');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.expect_fail($$select public.admin_set_blocked('00000000-0000-0000-0000-00000000000a', true)$$, 'non-admin blocks');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  if (select count(*) from public.offers) <> 1 then raise exception 'customer cannot see offer'; end if;
end $$;
select pg_temp.expect_fail(
  $$insert into public.messages (task_id, sender_id, body) values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'hi')$$,
  'chat before choice');
select public.choose_offer('20000000-0000-0000-0000-000000000001');
insert into public.messages (task_id, sender_id, body) values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'hi');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  if (select address from public.task_addresses) <> 'Balfour 10' then raise exception 'chosen provider cannot see address'; end if;
  if (select count(*) from public.messages) <> 1 then raise exception 'provider cannot read chat'; end if;
end $$;
select public.mark_task_done('10000000-0000-0000-0000-000000000001', 250);
select public.leave_review('10000000-0000-0000-0000-000000000001', 5, 'nice customer');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.leave_review('10000000-0000-0000-0000-000000000001', 4, 'good job');
select pg_temp.expect_fail($$select public.leave_review('10000000-0000-0000-0000-000000000001', 5, 'again')$$, 'double review');

reset role;
do $$
declare t public.tasks; p public.provider_profiles;
begin
  select * into t from public.tasks;
  select * into p from public.provider_profiles where user_id = '00000000-0000-0000-0000-00000000000b';
  if t.status <> 'reviewed' or t.final_price <> 250 then raise exception 'task state wrong: % %', t.status, t.final_price; end if;
  if p.rating_avg <> 4 or p.rating_count <> 1 or p.jobs_done <> 1 then raise exception 'provider stats wrong'; end if;
  raise notice 'ALL CHECKS PASSED';
end $$;

rollback;
