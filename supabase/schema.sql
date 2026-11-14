-- Fake Fanatic waitlist schema. Safe to run more than once.
-- Only the server (service role key) can read or write: RLS is on and there are no public policies.

-- ---------- Tables ----------
create table if not exists public.waitlist (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique
                check (email = lower(btrim(email)) and char_length(email) between 3 and 254),
  created_at    timestamptz not null default now(),
  referral_code text not null unique,
  referred_by   text,                         -- the referrer's referral_code
  source        text not null default 'direct', -- utm_source, or 'direct'
  utm_medium    text,
  utm_campaign  text,
  landing_path  text,
  ip_country    text,
  status        text not null default 'subscribed'
                check (status in ('subscribed', 'unsubscribed')),
  weekly_updates boolean not null default false  -- ticked "weekly Fake Fanatic updates"
);
alter table public.waitlist add column if not exists weekly_updates boolean not null default false;
create index if not exists waitlist_referred_by_idx on public.waitlist (referred_by);
create index if not exists waitlist_created_at_idx on public.waitlist (created_at);
alter table public.waitlist enable row level security;

-- Signup attempts per (hashed) IP, for rate limiting. Rows older than a day are deleted automatically.
create table if not exists public.waitlist_attempts (
  ip_hash text not null,
  at      timestamptz not null default now()
);
create index if not exists waitlist_attempts_ip_idx on public.waitlist_attempts (ip_hash, at);
alter table public.waitlist_attempts enable row level security;

-- ---------- Referral counts (for you, in the Table Editor) ----------
create or replace view public.referral_counts
with (security_invoker = true) as
select w.email,
       w.referral_code,
       w.created_at,
       w.status,
       count(r.id) as referrals
from public.waitlist w
left join public.waitlist r on r.referred_by = w.referral_code
group by w.id
order by referrals desc, w.created_at asc;

-- ---------- Signup function (called by /api/waitlist) ----------
-- Inserts a new signup or finds the existing one, and returns their code and place in line.
-- Place in line: most referrals first, then earliest signup.
-- p_weekly = true opts the person in to weekly updates (also for someone already on the list).
-- r_weekly_added is true when this call newly opted an existing person in.
drop function if exists public.join_waitlist(text, text, text, text, text, text, text, text);
create or replace function public.join_waitlist(
  p_email        text,
  p_referred_by  text default null,
  p_source       text default 'direct',
  p_utm_medium   text default null,
  p_utm_campaign text default null,
  p_landing_path text default null,
  p_ip_country   text default null,
  p_ip_hash      text default null,
  p_weekly       boolean default false
)
returns table (r_code text, r_position bigint, r_is_new boolean, r_rate_limited boolean, r_weekly_added boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email    text := lower(btrim(p_email));
  v_ref      text := nullif(upper(btrim(coalesce(p_referred_by, ''))), '');
  v_row      public.waitlist;
  v_new      boolean := false;
  v_code     text;
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no 0/O, 1/I/L
  v_refs     bigint;
  v_pos      bigint;
  v_weekly_added boolean := false;
begin
  -- Rate limit: at most 8 attempts per IP per 10 minutes.
  if p_ip_hash is not null then
    delete from waitlist_attempts where at < now() - interval '1 day';
    if (select count(*) from waitlist_attempts
        where ip_hash = p_ip_hash and at > now() - interval '10 minutes') >= 8 then
      return query select null::text, null::bigint, false, true, false;
      return;
    end if;
    insert into waitlist_attempts (ip_hash) values (p_ip_hash);
  end if;

  select * into v_row from waitlist where email = v_email;

  if not found then
    -- Only keep a referral code that actually exists.
    if v_ref is not null and not exists (select 1 from waitlist where referral_code = v_ref) then
      v_ref := null;
    end if;

    for i in 1..10 loop
      v_code := '';
      for j in 1..6 loop
        v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
      end loop;
      begin
        insert into waitlist (email, referral_code, referred_by, source, utm_medium, utm_campaign, landing_path, ip_country, weekly_updates)
        values (v_email, v_code, v_ref,
                coalesce(nullif(btrim(p_source), ''), 'direct'),
                nullif(btrim(p_utm_medium), ''), nullif(btrim(p_utm_campaign), ''),
                nullif(btrim(p_landing_path), ''), nullif(btrim(p_ip_country), ''), coalesce(p_weekly, false))
        returning * into v_row;
        v_new := true;
        exit;
      exception when unique_violation then
        -- Either the code collided (try again) or the same email arrived twice at once.
        select * into v_row from waitlist where email = v_email;
        exit when found;
      end;
    end loop;
  end if;

  -- Existing signup ticking the box later: opt them in (never opt anyone out here).
  if not v_new and coalesce(p_weekly, false) and v_row.id is not null and not v_row.weekly_updates then
    update waitlist set weekly_updates = true where id = v_row.id;
    v_weekly_added := true;
  end if;

  if v_row.id is null then
    raise exception 'Could not create waitlist entry';
  end if;

  select count(*) into v_refs from waitlist where referred_by = v_row.referral_code;
  select 1 + count(*) into v_pos
  from (
    select w.created_at, (select count(*) from waitlist r where r.referred_by = w.referral_code) as refs
    from waitlist w
    where w.status = 'subscribed' and w.id <> v_row.id
  ) others
  where others.refs > v_refs or (others.refs = v_refs and others.created_at < v_row.created_at);

  return query select v_row.referral_code, v_pos, v_new, false, v_weekly_added;
end;
$$;

-- ---------- Lock it down ----------
revoke all on public.waitlist, public.waitlist_attempts, public.referral_counts from anon, authenticated;
revoke all on function public.join_waitlist(text, text, text, text, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.join_waitlist(text, text, text, text, text, text, text, text, boolean) to service_role;
grant all on public.waitlist, public.waitlist_attempts, public.referral_counts to service_role;

-- ---------- Newsletter sends (one row per weekly edition; stops double sends) ----------
create table if not exists public.newsletter_sends (
  slug        text primary key,           -- blog post slug, e.g. 2026-11-17-week-in-sports
  campaign_id integer,                    -- Nitrosend campaign id once created
  status      text not null default 'claimed',  -- claimed | sent | failed
  detail      text,
  created_at  timestamptz not null default now()
);
alter table public.newsletter_sends enable row level security;
revoke all on public.newsletter_sends from anon, authenticated;
grant all on public.newsletter_sends to service_role;
