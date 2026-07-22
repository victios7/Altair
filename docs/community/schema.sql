-- ============================================================
-- ESQUEMA — Altair Community
-- Pega y ejecuta esto en Supabase → SQL Editor → New query → Run
-- ============================================================

-- Posts del foro
create table if not exists posts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  author text not null,
  title text not null,
  content text not null
);

-- Comentarios de cada post
create table if not exists comments (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  post_id bigint not null references posts(id) on delete cascade,
  author text not null,
  content text not null
);

-- Showcase de proyectos hechos con Altair
create table if not exists showcase (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  author text not null,
  title text not null,
  description text not null,
  link text
);

-- Noticias / anuncios oficiales
create table if not exists news (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  author text not null,
  title text not null,
  content text not null
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Habilitamos RLS y permitimos lectura pública + escritura pública
-- (sencillo, sin cuentas de usuario). Puedes endurecer esto luego
-- con Supabase Auth si quieres moderar quién publica en "news".
-- ============================================================

alter table posts enable row level security;
alter table comments enable row level security;
alter table showcase enable row level security;
alter table news enable row level security;

create policy "public read posts" on posts for select using (true);
create policy "public insert posts" on posts for insert with check (true);

create policy "public read comments" on comments for select using (true);
create policy "public insert comments" on comments for insert with check (true);

create policy "public read showcase" on showcase for select using (true);
create policy "public insert showcase" on showcase for insert with check (true);

create policy "public read news" on news for select using (true);
create policy "public insert news" on news for insert with check (true);
-- Si quieres que SOLO tú publiques noticias, borra la línea de arriba
-- ("public insert news") y publica manualmente desde el Table Editor
-- de Supabase, o desde el SQL Editor con un INSERT directo.
