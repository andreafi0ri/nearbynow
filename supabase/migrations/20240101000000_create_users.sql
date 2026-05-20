-- Users profile table (extends auth.users)
create table public.users (
  id         uuid references auth.users on delete cascade primary key,
  email      text not null,
  username   text,
  avatar     text default '👤',
  area       text,
  push_token text,
  created_at timestamptz default now()
);

alter table public.users enable row level security;

create policy "users_select_own"  on public.users for select  using (auth.uid() = id);
create policy "users_insert_own"  on public.users for insert  with check (auth.uid() = id);
create policy "users_update_own"  on public.users for update  using (auth.uid() = id);

-- Auto-create profile row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
