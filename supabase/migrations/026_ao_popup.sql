-- システムポップアップ文言（コルグズ確認等）

create table if not exists public.ao_popup (
  popup_key text primary key
    check (char_length(popup_key) > 0 and char_length(popup_key) <= 64),
  template_text text not null default '',
  persona_key text not null default 'qorguz',
  updated_at timestamptz not null default now()
);

comment on table public.ao_popup is
  'UI confirmation popup copy; {{論}} {{議題}} placeholders substituted client-side';

comment on column public.ao_popup.template_text is
  'Line break: literal newline or auto-split at 。';

alter table public.ao_popup enable row level security;

insert into public.ao_popup (popup_key, template_text, persona_key)
values (
  'delete_log',
  E'{{論}}の議事{{議題}}を捨てます。\nよろしいですか、殿下？',
  'qorguz'
)
on conflict (popup_key) do update set
  template_text = excluded.template_text,
  persona_key = excluded.persona_key,
  updated_at = now();
