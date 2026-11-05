# Registro de decisões

Decisões técnicas e ajustes em relação ao `PLANO.md`, com o motivo de cada um. A entrada mais recente fica no topo.

---

## 2026-11-05 · Fase 0

### D-006 · Escrita no banco: o cliente só cria fazendas

Com o RLS, o produtor lê os próprios dados, mas só pode **criar, editar e apagar fazendas**. As tabelas `checks`, `imagery`, `dossiers`, `lots` e `alerts` são somente leitura para o usuário e são gravadas pelo servidor, com a service role.

**Motivo:** se o cliente pudesse gravar uma checagem, ele poderia forjar um veredito "Conforme", um hash ou um lote. Isso reforça a regra do `CLAUDE.md` de que a interface nunca decide o veredito.

As camadas de referência (`deforestation`, `protected_areas`, `coverage_regions` e `data_snapshots`) são dados públicos e têm leitura liberada para todos, inclusive `anon`. A escrita nelas é feita só pela service role.

### D-005 · `farms.area_ha` é calculada por trigger

O trigger `farms_set_area` recalcula `area_ha = ST_Area(geom::geography) / 10000` a cada inserção ou alteração da geometria. O valor enviado pelo cliente é ignorado. Há também a restrição `check (ST_IsValid(geom))`.

### D-004 · PostGIS no schema `extensions`

A migration usa `create extension postgis with schema extensions`, como a Supabase recomenda, e qualifica os tipos e funções (`extensions.geometry` e afins).

**Motivo:** mantém o schema `public` limpo e evita que o RLS automático do projeto Supabase tente agir sobre a `spatial_ref_sys`, que pertence à extensão.

O SQL do plano (seção 4) foi mantido. As únicas adições são índices em chaves estrangeiras, `on delete cascade` em `farms.owner_id` e as políticas de RLS.

### D-003 · Mapa base: EOX Sentinel-2 cloudless de 2016

O plano sugeria o EOX cloudless e pedia para conferir a licença do ano. Pelo GetCapabilities, só 2016 e 2017 são CC BY 4.0, e 2017 não cobre o Brasil. Os anos de 2018 a 2025 são CC BY-NC-SA 4.0.

**Decisão:** usar 2016 (CC BY 4.0), que não tem restrição comercial.

**Custo:** o mosaico é mais antigo e menos nítido que o de 2020. A prova de antes e depois não depende do mapa base, e sim das cenas Sentinel-2 por fazenda (Fase 2). **Pendente de confirmação do time:** trocar para 2020 aceitando a cláusula NC-SA. A troca é de uma linha (`BASEMAP_YEAR`).

### D-002 · Versões da stack

| Peça | Versão |
|---|---|
| Next.js | 16.4 (App Router, Turbopack, `cacheComponents`) |
| React | 19.3 |
| Tailwind CSS | 4 |
| shadcn/ui | estilo `base-nova`, sobre Base UI |
| MapLibre GL JS | 6.16 |
| Vitest | 5 |
| Playwright | 1.65 |
| Supabase CLI | 3.0 (dependência de desenvolvimento) |

O CI usa Node 24. Em desenvolvimento local, qualquer Node 22 ou superior serve (`engines`). O `@types/node` foi para a versão 24 porque o Vitest 5 não aceita a 20.

### D-001 · Mapa só no cliente

O MapLibre depende de WebGL. O componente é carregado com `next/dynamic` e `ssr: false` dentro de um Client Component, com placeholder e estados de carregamento e de erro (com botão "Tentar de novo").
