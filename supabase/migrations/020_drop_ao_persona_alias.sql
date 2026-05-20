-- ao_persona_alias → ao_personas.alias に統合して DROP

update public.ao_personas p
set
  alias = coalesce(nullif(trim(p.alias), ''), nullif(trim(a.alias), '')),
  updated_at = greatest(p.updated_at, coalesce(a.updated_at, p.updated_at))
from public.ao_persona_alias a
where p.persona_key = a.persona_key
  and nullif(trim(a.alias), '') is not null;

drop table if exists public.ao_persona_alias;
