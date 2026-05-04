
create table public.area_scores (
  area_id text primary key,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  netpulse_score integer not null default 0,
  prev_score integer not null default 0,
  sample_count integer not null default 0,
  avg_download double precision not null default 0,
  avg_upload double precision not null default 0,
  avg_latency double precision not null default 0,
  isp_breakdown jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  area_id text not null references public.area_scores(area_id) on delete cascade,
  wallet_address text not null,
  download_mbps double precision not null,
  upload_mbps double precision not null,
  latency_ms double precision not null,
  isp text not null,
  lat double precision not null,
  lng double precision not null,
  score integer not null,
  genlayer_tx_hash text,
  created_at timestamptz not null default now()
);

create index submissions_area_idx on public.submissions(area_id, created_at desc);

alter table public.area_scores enable row level security;
alter table public.submissions enable row level security;

create policy "public read area_scores" on public.area_scores for select using (true);
create policy "public read submissions" on public.submissions for select using (true);
