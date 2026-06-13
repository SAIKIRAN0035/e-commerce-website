-- Run this in Supabase SQL Editor (https://supabase.com/dashboard)
create table if not exists reviews (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  location text not null,
  text text not null,
  rating int not null check (rating >= 1 and rating <= 5),
  created_at timestamptz default now()
);

alter table reviews enable row level security;

create policy "Public read reviews" on reviews for select using (true);
create policy "Public insert reviews" on reviews for insert with check (true);
