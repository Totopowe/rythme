-- Rythme V1 : schéma initial.
-- Principe : chaque alternant ne voit que ses propres lignes (RLS sur toutes les tables).
-- Le rôle anonyme n'a accès à aucune table : uniquement aux fonctions de partage par jeton.

-- ---------------------------------------------------------------------------
-- Écoles et promos (hors périmètre V1, prévues pour rattacher les alternants plus tard)
-- ---------------------------------------------------------------------------

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  created_at timestamptz not null default now()
);

create table public.cohorts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  start_year int check (start_year between 2000 and 2100),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profils
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '' check (char_length(first_name) <= 60),
  school_name text not null default '' check (char_length(school_name) <= 120),
  school_id uuid references public.schools (id) on delete set null,
  cohort_id uuid references public.cohorts (id) on delete set null,
  -- Identifiant aléatoire utilisé pour la mesure d'usage, sans lien avec le compte une fois celui-ci supprimé.
  analytics_id uuid not null unique default gen_random_uuid(),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  wake_up_days int not null default 7 check (wake_up_days between 1 and 21),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Rythme d'alternance
-- ---------------------------------------------------------------------------

-- Motif : liste de semaines, chacune décrivant ses 5 jours ouvrés (lundi → vendredi),
-- ex. [["entreprise","entreprise","entreprise","entreprise","ecole"]] pour 4 jours / 1 jour.
create table public.rhythms (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  start_date date not null,
  pattern jsonb not null check (jsonb_typeof(pattern) = 'array' and jsonb_array_length(pattern) between 1 and 60),
  template text not null default 'custom' check (char_length(template) <= 40),
  updated_at timestamptz not null default now()
);

-- Corrections ponctuelles, jour par jour (férié, semaine décalée…).
create table public.day_overrides (
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('ecole', 'entreprise', 'conge', 'ferie')),
  primary key (user_id, date)
);

create table public.absences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  kind text not null default 'conge' check (kind in ('conge', 'examen', 'maladie', 'autre')),
  label text not null default '' check (char_length(label) <= 120),
  visible_to_tutor boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_date >= start_date and end_date - start_date <= 366)
);

-- ---------------------------------------------------------------------------
-- Tâches, échéances, revues
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  context text not null check (context in ('ecole', 'entreprise', 'perso')),
  due_date date,
  priority smallint not null default 0 check (priority between 0 and 3),
  position double precision not null default 0,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_user_idx on public.tasks (user_id);

create table public.deadlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  date date not null,
  context text not null check (context in ('ecole', 'entreprise', 'perso')),
  kind text not null default 'autre' check (kind in ('partiel', 'rendu', 'memoire', 'reunion', 'autre')),
  notes text not null default '' check (char_length(notes) <= 2000),
  -- Une échéance n'est visible du tuteur que si l'alternant le décide explicitement.
  visible_to_tutor boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index deadlines_user_idx on public.deadlines (user_id);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  period_end date not null,
  from_kind text not null check (from_kind in ('ecole', 'entreprise', 'conge')),
  to_kind text not null check (to_kind in ('ecole', 'entreprise', 'conge')),
  summary text not null default '' check (char_length(summary) <= 5000),
  created_at timestamptz not null default now(),
  unique (user_id, period_end)
);

-- ---------------------------------------------------------------------------
-- Liens de partage (tuteur, abonnement .ics)
-- Seule l'empreinte SHA-256 du jeton est stockée : une fuite de la base ne révèle aucun lien.
-- ---------------------------------------------------------------------------

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('tutor', 'ics')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_viewed_at timestamptz
);
-- Un seul lien actif par type et par alternant.
create unique index share_links_one_active on public.share_links (user_id, kind) where revoked_at is null;

-- ---------------------------------------------------------------------------
-- Avis et mesure d'usage
-- ---------------------------------------------------------------------------

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null default auth.uid(),
  message text not null check (char_length(message) between 1 and 5000),
  page text not null default '' check (char_length(page) <= 200),
  created_at timestamptz not null default now()
);

-- Événements minimalistes : un identifiant aléatoire, un type, une date. Rien d'autre.
create table public.events (
  id bigint generated always as identity primary key,
  subject_id uuid not null,
  type text not null check (type in ('signup', 'login', 'task_created', 'task_completed', 'review_completed', 'tutor_link_created')),
  created_at timestamptz not null default now()
);
create index events_subject_idx on public.events (subject_id, created_at);

-- ---------------------------------------------------------------------------
-- Droits : aucune table accessible au rôle anonyme ; RLS partout.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on public.schools, public.cohorts, public.events from authenticated;
-- Le profil n'est modifiable que sur ses champs éditables (pas l'identifiant d'analyse ni l'école rattachée).
revoke insert, update, delete on public.profiles from authenticated;
grant update (first_name, school_name, theme, wake_up_days, onboarded_at) on public.profiles to authenticated;
-- Un lien de partage ne se modifie que pour être révoqué.
revoke update on public.share_links from authenticated;
grant update (revoked_at) on public.share_links to authenticated;
revoke update, delete, select on public.feedback from authenticated;

alter table public.schools enable row level security;
alter table public.cohorts enable row level security;
alter table public.profiles enable row level security;
alter table public.rhythms enable row level security;
alter table public.day_overrides enable row level security;
alter table public.absences enable row level security;
alter table public.tasks enable row level security;
alter table public.deadlines enable row level security;
alter table public.reviews enable row level security;
alter table public.share_links enable row level security;
alter table public.feedback enable row level security;
alter table public.events enable row level security;

create policy "profil : lecture du sien" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profil : modification du sien" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "rythme : le sien" on public.rhythms
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "corrections : les siennes" on public.day_overrides
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "absences : les siennes" on public.absences
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "tâches : les siennes" on public.tasks
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "échéances : les siennes" on public.deadlines
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "revues : les siennes" on public.reviews
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "liens : les siens" on public.share_links
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "avis : dépôt en son nom" on public.feedback
  for insert to authenticated with check (user_id = (select auth.uid()));

-- Le propriétaire est toujours l'utilisateur connecté (impossible d'écrire chez un autre).
alter table public.rhythms alter column user_id set default auth.uid();
alter table public.day_overrides alter column user_id set default auth.uid();
alter table public.absences alter column user_id set default auth.uid();
alter table public.tasks alter column user_id set default auth.uid();
alter table public.deadlines alter column user_id set default auth.uid();
alter table public.reviews alter column user_id set default auth.uid();
alter table public.share_links alter column user_id set default auth.uid();

-- ---------------------------------------------------------------------------
-- Déclencheurs
-- ---------------------------------------------------------------------------

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger rhythms_touch before update on public.rhythms for each row execute function public.touch_updated_at();
create trigger tasks_touch before update on public.tasks for each row execute function public.touch_updated_at();
create trigger deadlines_touch before update on public.deadlines for each row execute function public.touch_updated_at();

-- Création automatique du profil à l'inscription.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Journalisation d'un événement pour l'utilisateur courant (identifiant anonyme).
create function public.record_event(event_type text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  subject uuid;
begin
  select analytics_id into subject from public.profiles where id = auth.uid();
  if subject is null then
    return;
  end if;
  insert into public.events (subject_id, type) values (subject, event_type);
end;
$$;

-- Les événements métier sont produits par la base elle-même (déclencheurs) : fiables même si
-- l'app rejoue des écritures faites hors ligne, et impossibles à falsifier depuis le client.
create function public.task_events() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.record_event('task_created');
    if new.done_at is not null then
      perform public.record_event('task_completed');
    end if;
  elsif old.done_at is null and new.done_at is not null then
    perform public.record_event('task_completed');
  end if;
  return new;
end;
$$;

create function public.review_events() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.record_event('review_completed');
  return new;
end;
$$;

create function public.share_link_events() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'tutor' then
    perform public.record_event('tutor_link_created');
  end if;
  return new;
end;
$$;

create function public.profile_events() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.onboarded_at is null and new.onboarded_at is not null then
    perform public.record_event('signup');
  end if;
  return new;
end;
$$;

create trigger tasks_events after insert or update of done_at on public.tasks
  for each row execute function public.task_events();
create trigger reviews_events after insert on public.reviews
  for each row execute function public.review_events();
create trigger share_links_events after insert on public.share_links
  for each row execute function public.share_link_events();
create trigger profiles_events after update of onboarded_at on public.profiles
  for each row execute function public.profile_events();

-- ---------------------------------------------------------------------------
-- Fonctions appelables par l'app
-- ---------------------------------------------------------------------------

-- Connexion : au plus un événement par jour et par utilisateur.
create function public.log_login() returns void
language plpgsql security definer set search_path = '' as $$
declare
  subject uuid;
begin
  select analytics_id into subject from public.profiles where id = auth.uid();
  if subject is null then
    return;
  end if;
  if not exists (
    select 1 from public.events
    where subject_id = subject and type = 'login' and created_at >= date_trunc('day', now())
  ) then
    insert into public.events (subject_id, type) values (subject, 'login');
  end if;
end;
$$;

-- Suppression complète du compte : la cascade efface toutes les données de l'alternant.
-- Les événements, déjà anonymes, perdent leur dernier lien avec la personne.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'non connecté';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- Empreinte d'un jeton de partage.
create function public.token_hash(token text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(token, 'UTF8')), 'hex');
$$;

-- Page tuteur : uniquement le rythme, les absences visibles et les échéances choisies.
-- Ni tâches, ni notes, ni libellés d'absence.
create function public.get_tutor_view(token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  link public.share_links%rowtype;
  result jsonb;
begin
  if token is null or char_length(token) < 20 or char_length(token) > 100 then
    return null;
  end if;
  select * into link from public.share_links
  where token_hash = public.token_hash(token) and kind = 'tutor' and revoked_at is null;
  if not found then
    return null;
  end if;
  update public.share_links set last_viewed_at = now() where id = link.id;

  select jsonb_build_object(
    'first_name', p.first_name,
    'school_name', p.school_name,
    'rhythm', (select jsonb_build_object('start_date', r.start_date, 'pattern', r.pattern) from public.rhythms r where r.user_id = p.id),
    'overrides', coalesce((select jsonb_agg(jsonb_build_object('date', o.date, 'kind', o.kind) order by o.date)
                           from public.day_overrides o where o.user_id = p.id), '[]'::jsonb),
    'absences', coalesce((select jsonb_agg(jsonb_build_object('start_date', a.start_date, 'end_date', a.end_date, 'kind', a.kind) order by a.start_date)
                          from public.absences a where a.user_id = p.id and a.visible_to_tutor), '[]'::jsonb),
    'deadlines', coalesce((select jsonb_agg(jsonb_build_object('title', d.title, 'date', d.date, 'kind', d.kind) order by d.date)
                           from public.deadlines d where d.user_id = p.id and d.visible_to_tutor), '[]'::jsonb)
  ) into result
  from public.profiles p where p.id = link.user_id;
  return result;
end;
$$;

-- Flux .ics personnel (jeton connu du seul alternant) : rythme, absences, échéances, tâches datées.
create function public.get_calendar_feed(token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  link public.share_links%rowtype;
begin
  if token is null or char_length(token) < 20 or char_length(token) > 100 then
    return null;
  end if;
  select * into link from public.share_links
  where token_hash = public.token_hash(token) and kind = 'ics' and revoked_at is null;
  if not found then
    return null;
  end if;
  update public.share_links set last_viewed_at = now() where id = link.id;

  return (
    select jsonb_build_object(
      'first_name', p.first_name,
      'rhythm', (select jsonb_build_object('start_date', r.start_date, 'pattern', r.pattern) from public.rhythms r where r.user_id = p.id),
      'overrides', coalesce((select jsonb_agg(jsonb_build_object('date', o.date, 'kind', o.kind)) from public.day_overrides o where o.user_id = p.id), '[]'::jsonb),
      'absences', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'start_date', a.start_date, 'end_date', a.end_date, 'kind', a.kind, 'label', a.label))
                            from public.absences a where a.user_id = p.id), '[]'::jsonb),
      'deadlines', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title, 'date', d.date, 'kind', d.kind, 'context', d.context))
                             from public.deadlines d where d.user_id = p.id), '[]'::jsonb),
      'tasks', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'due_date', t.due_date, 'context', t.context, 'done', t.done_at is not null))
                         from public.tasks t where t.user_id = p.id and t.due_date is not null), '[]'::jsonb)
    )
    from public.profiles p where p.id = link.user_id
  );
end;
$$;

-- Par défaut, personne ne peut appeler les fonctions ; on ouvre explicitement.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.get_tutor_view(text) to anon, authenticated;
grant execute on function public.get_calendar_feed(text) to anon, authenticated;
grant execute on function public.log_login() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
