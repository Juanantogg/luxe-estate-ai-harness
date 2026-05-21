-- 0008_conversations_and_messages.sql
-- Sistema de chat user <-> agent sobre una propiedad.

create table if not exists public.conversations (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  agent_id uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz,
  user_unread_count integer not null default 0,
  agent_unread_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (property_id, user_id, agent_id)
);

create index if not exists conversations_user_idx
  on public.conversations(user_id, last_message_at desc nulls last);
create index if not exists conversations_agent_idx
  on public.conversations(agent_id, last_message_at desc nulls last);

create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) > 0 and length(body) <= 4000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx
  on public.messages(conversation_id, created_at desc);
create index if not exists messages_sender_idx on public.messages(sender_id);

-- Trigger: al insertar mensaje, actualiza last_message_at e incrementa
-- el unread_count del receptor (no del emisor).
create or replace function public.handle_new_message()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  conv public.conversations%rowtype;
begin
  select * into conv from public.conversations where id = new.conversation_id;

  if conv.id is null then
    raise exception 'Conversation % does not exist', new.conversation_id;
  end if;

  if new.sender_id = conv.user_id then
    update public.conversations
       set last_message_at = new.created_at,
           agent_unread_count = agent_unread_count + 1
     where id = conv.id;
  elsif new.sender_id = conv.agent_id then
    update public.conversations
       set last_message_at = new.created_at,
           user_unread_count = user_unread_count + 1
     where id = conv.id;
  else
    raise exception 'sender_id % is not participant of conversation %',
      new.sender_id, conv.id;
  end if;

  return new;
end;
$$;

drop trigger if exists messages_handle_new on public.messages;
create trigger messages_handle_new
  after insert on public.messages
  for each row execute function public.handle_new_message();

-- RLS conversations
alter table public.conversations enable row level security;

drop policy if exists "conversations_select_participant" on public.conversations;
create policy "conversations_select_participant"
  on public.conversations for select to authenticated
  using (user_id = auth.uid() or agent_id = auth.uid() or public.is_admin());

drop policy if exists "conversations_insert_self" on public.conversations;
create policy "conversations_insert_self"
  on public.conversations for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "conversations_update_participant" on public.conversations;
create policy "conversations_update_participant"
  on public.conversations for update to authenticated
  using (user_id = auth.uid() or agent_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or agent_id = auth.uid() or public.is_admin());

-- RLS messages
alter table public.messages enable row level security;

drop policy if exists "messages_select_participant" on public.messages;
create policy "messages_select_participant"
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.user_id = auth.uid() or c.agent_id = auth.uid())
    )
    or public.is_admin()
  );

drop policy if exists "messages_insert_participant" on public.messages;
create policy "messages_insert_participant"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.user_id = auth.uid() or c.agent_id = auth.uid())
    )
  );

drop policy if exists "messages_update_own_read" on public.messages;
create policy "messages_update_own_read"
  on public.messages for update to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.user_id = auth.uid() or c.agent_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.user_id = auth.uid() or c.agent_id = auth.uid())
    )
  );
