-- Estoque & PDV: criação do banco no Supabase
-- Cole este arquivo em: Supabase > SQL Editor > New query > Run
-- Cada tabela guarda o registro completo em JSON (coluna "data"); a coluna "id" é a chave.

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['products','clients','users','sales','moves','nfes','ap','ar','conf','promos','settings'] loop
    execute format('create table if not exists public.%I (id text primary key, data jsonb not null, updated_at timestamptz not null default now())', t);
    execute format('drop trigger if exists touch on public.%I', t);
    execute format('create trigger touch before update on public.%I for each row execute function public.touch_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "acesso autenticado" on public.%I', t);
    execute format('create policy "acesso autenticado" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Índices úteis para consultas diretas no banco
create index if not exists products_barcode_idx on public.products ((data->>'barcode'));
create index if not exists products_sku_idx     on public.products ((data->>'sku'));
create index if not exists sales_t_idx          on public.sales (((data->>'t')::bigint));
create index if not exists ar_due_idx           on public.ar ((data->>'due'));
create index if not exists ap_due_idx           on public.ap ((data->>'due'));
