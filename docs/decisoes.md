# Registro de decisões

Decisões técnicas e ajustes em relação ao `PLANO.md`, com o motivo de cada um. A entrada mais recente fica no topo.

---

## 2026-11-05 · Fase 1: fluxo de mapear e resultado

### D-018 · Mapear, salvar e checar

- **Três formas de marcar a área** (`/app/fazendas/nova`): desenho com Terra Draw (polígono, depois ajuste dos pontos no modo de seleção), GPS (`watchPosition` com alta precisão, um ponto a cada 5 m e leituras piores que 20 m descartadas, depois simplificação com Turf) e arquivo GeoJSON ou KML (`@tmcw/togeojson`) com uma única área.
- **Validação dupla:** `validateFarmPolygon` (`src/lib/geo/farm-geometry.ts`) roda no navegador, para dar resposta imediata, e de novo na Server Action. Ela fecha o anel, remove altitude e pontos repetidos, arredonda para 7 casas e recusa autointerseção, coordenadas fora do Brasil (pega eixos trocados), área abaixo de 0,5 ha ou acima de 5.000 ha e mais de 5.000 vértices. O banco ainda tem `check (ST_IsValid(geom))`.
- **Cobertura no navegador:** o contorno simplificado da região (`coverage_outline()`, em cache no servidor) aparece tracejado no mapa e gera um aviso se algum vértice ficar fora. Quem decide é o servidor (`NO_COVERAGE`).
- **Salvar:** a fazenda é gravada como o próprio usuário (RLS). Em seguida, `runFarmCheck` roda com a service role e o usuário vai para o resultado. Se a checagem falhar, a fazenda continua salva e a página oferece "Checar agora".
- **Resultado** (`/app/fazendas/[id]`): veredito com ícone e texto, explicação, achados (fonte, classe, data, área dentro da fazenda, efeito no veredito), áreas protegidas, versões dos dados, método, crédito do INPE e o aviso de que não é certificação. O mapa mostra as camadas num recorte ao redor da fazenda (`farm_map_layers()`, com RLS do dono). As cores das manchas vêm da mesma `classifyDeforestation` do motor, então o mapa não contradiz o veredito.
- **Testes e2e** (`tests/e2e/farm-flow.spec.ts`), em desktop e celular: login pelo link mágico (link gerado pela API de administração, sem e-mail), importação de arquivo até o "Não conforme" com um alerta DETER real, desenho no mapa e caminhada com GPS. A geolocalização simulada do Chromium só entrega a primeira posição ao `watchPosition`, por isso o teste injeta uma geolocalização falsa. Os usuários de teste são fictícios (`e2e-<n>@rastro.example`), e as fazendas deles são apagadas depois de cada teste.

---

## 2026-11-05 · Fase 1: autenticação e conta de demonstração

### D-017 · Link mágico, conta de demonstração compartilhada e fazendas travadas

- **Link mágico:** Supabase Auth com `signInWithOtp` numa Server Action. O link volta para `/auth/confirm`, que aceita tanto o formato PKCE (`?code=`) quanto o `token_hash`.
- **Proxy:** `src/proxy.ts` (o antigo middleware, renomeado no Next 16) renova os cookies de sessão e manda para `/entrar` quem não tem sessão em `/app`. As páginas verificam o usuário de novo no servidor com `getClaims()` (`src/lib/auth.ts`). Sem as variáveis da Supabase (CI), o proxy não faz nada.
- **Conta de demonstração:** usuário único, com e-mail fictício `demo@rastro.example`, criado e confirmado por `npm run data:seed -- account` pela API de administração. O botão "Entrar como demonstração" faz `signInWithPassword` no servidor. A senha fica só em `DEMO_USER_PASSWORD`, no servidor. Ela não é um segredo forte, porque o botão dá o mesmo acesso a qualquer pessoa, mas fica fora do repositório. O formulário de link mágico recusa o e-mail da demonstração.
- **Fazendas travadas:** a conta é compartilhada pelos jurados, então as fazendas de demonstração têm `is_demo` e `is_locked`. O RLS impede editar ou apagar fazendas travadas e impede o usuário de criar fazendas que se passem por demonstração. Só o seed (service role) mexe nelas.
- **Cache Components:** `createSupabaseServerClient` chama `await connection()` antes de tudo. Sem isso, o Next tentava pré-renderizar `/app` com os cookies e falhava no `Date.now()` da Supabase. Toda leitura de sessão fica atrás de `<Suspense>`.

**Configuração fora do código (feita pelo time):**

- No painel da Supabase (Authentication > URL Configuration), incluir `http://localhost:3000/auth/confirm` e o domínio da Vercel com `/auth/confirm` nas Redirect URLs.
- Na Vercel, cadastrar `DEMO_USER_EMAIL` e `DEMO_USER_PASSWORD`.
- O envio de e-mail padrão da Supabase tem limite baixo por hora. A troca para SMTP próprio (Resend) fica para a Fase 3.

---

## 2026-11-05 · Fase 1: motor de conformidade

### D-016 · O SQL mede, o TypeScript decide

O plano pedia o motor "em TypeScript e numa função SQL equivalente". Duas implementações das mesmas regras acabariam divergindo, então dividimos o trabalho:

- **SQL, `public.compliance_facts(geom, border_tolerance_m)`:** só fatos geométricos, com `geography`. Calcula o recuo interno de 10 m (com o polígono original quando o recuo esvazia a fazenda), as sobreposições em hectares com DETER, PRODES, TIs e UCs, a área fora da cobertura, o município e as versões dos dados. Não aplica limite nem data de corte. `compliance_facts_for_farm(farm_id)` é o atalho usado pelo servidor.
- **TypeScript, `evaluateCompliance(facts)` em `src/lib/compliance/`:** todas as regras da seção 5.2, numa função pura. É o único lugar onde o veredito é decidido. As constantes ficam em `constants.ts`, e a tolerância é passada para o SQL a partir dali.
- **`runFarmCheck(farmId)`** (somente servidor): chama o SQL, aplica o veredito e grava em `checks` com a service role. As duas funções SQL só podem ser executadas pela `service_role`.

Ajustes em relação ao plano:

- **Cobertura por área, não por contenção estrita:** `NO_COVERAGE` só quando pelo menos `MAX_OUTSIDE_COVERAGE_HA` (0,1 ha) do polígono analisado fica fora dos municípios. Assim as frestas entre municípios vizinhos não tiram a cobertura de uma fazenda na divisa.
- **Mínimo de sobreposição:** sobreposições abaixo de `MIN_OVERLAP_HA` continuam listadas, com `effect: "info"` e `below_min_overlap: true`, mantendo a classificação original.
- **Classe desconhecida do DETER:** gera `ATTENTION` depois do corte (`deter_unknown_class`). Nunca é ignorada.
- **DETER duplicado:** linhas com mesma fonte, classe, data e geometria contam uma vez só (risco da D-008).
- **Imagem recente:** `imagery: "unavailable"` gera `ATTENTION`. Na Fase 1 o valor é `"not_checked"`, sem efeito, até o serviço de imagens existir (Fase 2).
- **Datas das versões dos dados:** no horário de Brasília, não em UTC.

Testes: os unitários (`tests/unit/compliance.test.ts`) cobrem as regras. A integração (`tests/integration/compliance-sql.test.ts`) roda o SQL sobre os polígonos sintéticos de `tests/fixtures/compliance-cases.ts`: os 10 casos da seção 5.4, mais fazenda estreita e fazenda na divisa. Tudo roda numa transação desfeita no final. No CI, o job `sql` sobe um PostGIS descartável, aplica `tests/sql/supabase-stub.sql` e as migrations, e roda a integração. Localmente: `RASTRO_SQL_TESTS_ON_SUPABASE=1 npm run test:sql`.

---

## 2026-11-05 · Fase 1: importação (`npm run data:import`)

### D-015 · Resultado da primeira importação e faixa da Resex Verde para Sempre

Primeira carga em 05/11/2026: 3 municípios (25.481 km²), 9.013 DETER (de 02/08/2016 a 23/10/2026), 9.429 PRODES de 2020 a 2025 que tocam a região, 2 TIs (Arara e Cachoeira Seca) e 1 UC. O banco ficou com 46 MB.

A UC é a Resex Verde para Sempre. O CNUC não lista nenhum município-piloto para ela, mas o polígono dela invade o limite municipal do INPE numa faixa estreita de cerca de 11 ha ao longo de 51 km, na divisa entre bases cartográficas diferentes. Mantivemos a faixa: o polígono da UC é o oficial, e uma fazenda que se sobreponha a ela em pelo menos `MIN_OVERLAP_HA` deve, sim, ser sinalizada. As fazendas de demonstração devem ficar longe dessa divisa.

### D-014 · FUNAI: certificado intermediário ausente

O servidor `geoserver.funai.gov.br` não envia o certificado intermediário (Sectigo Public Server Authentication CA OV R36). O curl no Windows completa a cadeia sozinho, mas o Node recusa a conexão. O script baixa esse intermediário do endereço publicado no próprio certificado da FUNAI (campo AIA, `http://crt.sectigo.com/...`) e valida a conexão com as raízes padrão do Node mais esse intermediário. A verificação TLS continua ligada: um intermediário adulterado não fecharia a cadeia até uma raiz confiável.

Banco: o pooler da Supabase usa CA própria. Os scripts aceitam o certificado raiz da Supabase em `SUPABASE_DB_CA_CERT`. Sem ele, a conexão é criptografada, mas sem verificar a cadeia, e o script avisa no log.

### D-013 · Esquema para importação idempotente

Migration `20261106000000_reference_import_keys.sql`:

- `protected_areas` ganhou `external_id` (TI: `terrai_cod`; UC: `cd_cnuc`), `category` (fase da TI ou categoria da UC) e `source_date`, com `unique (kind, external_id)`.
- `coverage_regions` passou a ter uma linha por município, com `mun_geocode` único. A união das linhas é a região coberta, e a linha que contém a fazenda informa o município dela.
- No PRODES, `detected_at` recebe o `image_date` e `class_name` recebe `d<ano>`.

Cada passo roda numa transação. DETER e PRODES usam *upsert* por `(source, external_id)`. TI e UC são apagadas e recriadas, porque nenhuma tabela aponta para elas. Cada passo grava uma linha em `data_snapshots`. O PRODES é baixado pelo retângulo da região, mas só entram os polígonos que tocam os três municípios. Importamos o PRODES a partir de 2020: o ano de 2020 entra como contexto anterior ao corte.

---

## 2026-11-05 · Fase 1: fontes de dados

### D-012 · Região de cobertura pelo TerraBrasilis e crédito do INPE

**Decisão do time:** os limites municipais vêm da camada `prodes-amazon-nb:municipalities_amazon_biome` do TerraBrasilis, e não da API de malhas do IBGE. Assim todas as camadas de decisão (DETER, PRODES e cobertura) ficam sob a mesma licença, CC BY-SA 4.0.

O código segue MIT. O crédito "Dados: INPE/TerraBrasilis, CC BY-SA 4.0", com o aviso de que as camadas derivadas seguem a mesma licença, aparece no mapa, no dossiê e na página de verificação. O texto fica em um só lugar, `src/lib/attribution.ts`. Detalhes em `DATA_SOURCES.md`.

### D-011 · Região-piloto e licenças

Os municípios-piloto, definidos pelo time, são Medicilândia (1504455), Brasil Novo (1501725) e Uruará (1508159). A região de cobertura é a união dos três limites municipais (fonte na D-012).

Os dados do INPE são CC BY-SA 4.0. O código do Rastro continua MIT, mas a cópia das camadas no nosso banco e os derivados que publicarmos (manchas no mapa, achados no dossiê) ficam sob CC BY-SA 4.0, com atribuição ao INPE. Isso vai constar na página `/metodologia` e no dossiê.

### D-010 · CNUC: shapefile de 2025_08

Os shapefiles do CNUC de 2026 estão publicados em links do SharePoint, que não são estáveis para script. Usamos o `shp_cnuc_2025_08.zip`, hospedado no próprio dados.mma.gov.br. Pela planilha de 2026_07, nenhuma UC abrange os municípios-piloto, então a diferença de versão não muda nenhum resultado na região.

### D-009 · FUNAI: link oficial, com User-Agent do projeto

O endpoint genérico `geoserver.funai.gov.br/geoserver/ows` responde ao GetCapabilities, mas devolve 403 em DescribeFeatureType e GetFeature. Usamos o link de download por UF publicado na página oficial da FUNAI. O servidor recusa o User-Agent padrão do curl e aceita um cliente identificado. Os scripts enviam `Rastro/0.1 (+https://github.com/rafaelsiverisaugusto/Rastro)`. Não simulamos navegador nem contornamos nenhum limite.

### D-008 · DETER e PRODES: CSV em vez de JSON, e nova chave do DETER

As saídas `application/json` e GML do GeoServer do INPE arredondam as coordenadas para 4 casas decimais (cerca de 11 m), da mesma ordem da nossa tolerância de borda. O CSV traz a geometria em WKT com precisão total, igual à do SHAPE-ZIP. Os scripts usam `outputFormat=csv` e sempre `srsName=EPSG:4674`, porque sem ele a camada do PRODES sai em ordem lat/lon.

O plano usava o `gid` do DETER como `external_id`, com `unique (source, external_id)`. O `gid` não é único: o mesmo `13931_hist` aparece em cinco municípios e datas diferentes, e há 301 repetidos só na região-piloto. A combinação `gid|view_date|classname|mun_geocod` não tem nenhuma repetição e passa a ser o `external_id` do DETER. No PRODES, o `external_id` é o `uuid`, que é único.

Risco para o cron (Fase 3): se o INPE mover um alerta da base `_curr` para a `_hist` trocando o `gid`, o mesmo polígono pode entrar duas vezes. O motor deve deduplicar achados de geometria igual.

### D-007 · Classes do DETER

As oito classes da camada (a soma das contagens bate com o total) ficam mapeadas assim:

| Classe | Efeito após o corte |
|---|---|
| `DESMATAMENTO_CR`, `DESMATAMENTO_VEG`, `MINERACAO` | Desmatamento: `NON_COMPLIANT` |
| `DEGRADACAO`, `CICATRIZ_DE_QUEIMADA`, `CS_DESORDENADO`, `CS_GEOMETRICO`, `CORTE_SELETIVO` | `ATTENTION` |

O plano pedia para fechar o mapeamento depois de importar. Fechamos antes, consultando a camada inteira pelo WFS. Na região-piloto aparecem seis classes: `DESMATAMENTO_CR` (6.187), `CICATRIZ_DE_QUEIMADA` (1.253), `DEGRADACAO` (790), `DESMATAMENTO_VEG` (657), `CS_DESORDENADO` (65) e `CS_GEOMETRICO` (61).

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
