# Rastro

**Prova de origem livre de desmatamento para pequenos produtores rurais exportadores.**

O Regulamento (UE) 2023/1115 (EUDR) exige que cacau, café, soja, carne e outras commodities vendidas à União Europeia venham de áreas sem desmatamento posterior a 31/12/2020. No Rastro, o produtor mapeia a fazenda e o sistema cruza a área com os dados oficiais do INPE e com terras indígenas e unidades de conservação. O produtor vê imagens de satélite de antes e depois, recebe um dossiê e emite um QR code verificável por lote.

> O Rastro produz **evidências para a due diligence** do exportador. Não é certificação.

Projeto do time **Habeas Code** para o Hack Brasil 2026, trilha Meio ambiente & economia verde.

![CI](https://github.com/rafaelsiverisaugusto/Rastro/actions/workflows/ci.yml/badge.svg)

- **Demo:** https://rastro-sand.vercel.app
- **Estado:** Fase 0 (fundação) concluída: mapa de satélite da região-piloto, banco com PostGIS e CI.

## Stack

Next.js (App Router, TypeScript estrito), Tailwind CSS, shadcn/ui, MapLibre GL JS, Supabase (Postgres + PostGIS, Auth, Storage), Vitest, Playwright, Vercel.

## Como rodar

Pré-requisitos: Node.js 22 ou superior e um projeto Supabase.

```bash
npm install
cp .env.example .env.local   # preencha com as chaves do seu projeto Supabase
npm run db:push              # aplica as migrations de supabase/migrations
npm run dev                  # http://localhost:3000
```

| Comando | O que faz |
|---|---|
| `npm run dev` | Ambiente local |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm run format` | Prettier |
| `npm run test` | Testes unitários (Vitest) |
| `npm run test:e2e` | Testes ponta a ponta (Playwright, desktop e celular) |
| `npm run db:push` | Aplica as migrations no banco de `SUPABASE_DB_URL` |

## Estrutura

```
src/app/              rotas (App Router)
src/components/       interface (mapa, telas)
src/lib/geo/          utilidades geoespaciais e mapa base
src/lib/supabase/     clientes Supabase (navegador, servidor, admin)
src/i18n/             dicionários pt e en
supabase/migrations/  SQL versionado (PostGIS, tabelas, RLS)
tests/unit/           Vitest
tests/e2e/            Playwright
docs/                 decisões e backlog
```

## Dados e licenças

Todas as fontes de dados, licenças e atribuições estão em [`DATA_SOURCES.md`](DATA_SOURCES.md). As decisões técnicas ficam em [`docs/decisoes.md`](docs/decisoes.md).

## Licença

[MIT](LICENSE)
