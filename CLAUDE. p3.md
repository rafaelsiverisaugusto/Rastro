# Rastro: instruções permanentes para o agente

Este arquivo vale para todas as sessões. A especificação completa e as fases estão em `PLANO.md`. Leia os dois antes de qualquer tarefa.

## O que é o projeto

Rastro é uma plataforma web que ajuda pequenos produtores rurais exportadores (cacau, café, soja, carne e outras commodities) a provar que sua área de produção é livre de desmatamento posterior a 31/12/2020, como exige o Regulamento (UE) 2023/1115 (EUDR). O produtor mapeia a fazenda, o sistema cruza o polígono com dados públicos de desmatamento do INPE e com áreas protegidas, mostra imagens Sentinel-2 de antes e depois, gera um dossiê com IA e emite um QR code verificável por lote.

Projeto do time Habeas Code para o Hack Brasil 2026, trilha Meio ambiente & economia verde. Objetivo: chegar à final e vencer.

## Regras do hackathon (inegociáveis)

1. Todo o código deste repositório foi escrito a partir de 4/11/2026, 21h. Nunca copie código de projetos anteriores do time. Bibliotecas e boilerplates públicos de código aberto são permitidos.
2. Repositório público no GitHub, com licença MIT. Nada pode impedir os jurados de ler, executar e testar o código.
3. Nenhum dado pessoal real de terceiros. Fazendas de demonstração são fictícias: nomes inventados, sem CPF, sem código CAR, sem nome de proprietário. Não importe a base do CAR nem a lista de embargos do Ibama com dados pessoais.
4. Dados só de fontes oficiais e abertas, por API ou download oficial. Nada de scraping, nada de burlar captcha ou limites. Toda fonte vai documentada em `DATA_SOURCES.md` com URL, licença e atribuição.
5. A demo em produção (deploy da branch `main`) precisa funcionar sempre. Nunca faça merge na `main` de algo que quebra o fluxo principal.

## Stack

- Next.js (App Router) com TypeScript em modo estrito, Tailwind CSS e shadcn/ui.
- Supabase: Postgres com PostGIS, Auth e Storage.
- MapLibre GL JS para mapas; Terra Draw (ou equivalente compatível com MapLibre) para desenhar polígonos; Turf.js para cálculos no cliente.
- Imagens: API STAC do Earth Search (`https://earth-search.aws.element84.com/v1`), coleção `sentinel-2-l2a`. Recorte no servidor com `geotiff` + `proj4` + `sharp`, com cache no Supabase Storage.
- IA: API de modelo de linguagem (Anthropic) chamada só do servidor.
- E-mail: Resend.
- Deploy: Vercel. Agendamentos: Vercel Cron.
- Testes: Vitest (unitários, sobretudo a lógica geoespacial) e Playwright (fluxo principal ponta a ponta).

Não troque peças da stack sem registrar o motivo em `docs/decisoes.md`.

## Convenções

- Código, nomes de arquivos, tabelas e variáveis em inglês. Textos da interface em português, com versão em inglês (dicionário simples em `src/i18n`).
- Geometrias armazenadas em EPSG:4326. Dados do INPE chegam em EPSG:4674 e são transformados na importação. Áreas sempre calculadas com `geography` (hectares = `ST_Area(geom::geography) / 10000`).
- Toda regra de negócio de conformidade fica em funções puras, testadas, em `src/lib/compliance/`. A interface nunca decide veredito.
- A IA nunca decide nem inventa fatos. Ela recebe o resultado já calculado (JSON) e só redige. Se faltar dado, o texto diz que falta.
- Segredos só em variáveis de ambiente. Mantenha `.env.example` atualizado e nunca faça commit de `.env.local`.
- Row Level Security ligado em todas as tabelas com dados de usuário.
- Commits pequenos e descritivos, em português ou inglês, um assunto por commit.

## Como trabalhar

- Siga as fases do `PLANO.md` em ordem. Ao terminar cada fase, confira os critérios de pronto, rode os testes, atualize o README e pare para revisão humana antes da próxima.
- Antes de usar uma API externa, confirme o formato real da resposta (por exemplo, GetCapabilities do WFS, assets de um item STAC). Nunca invente nomes de camadas, campos ou endpoints. Se algo do `PLANO.md` não bater com a realidade, ajuste e registre em `docs/decisoes.md`.
- Prefira a solução mais simples que funciona de forma confiável na demo. Execução impecável vale mais que funcionalidade extra.
- Interface limpa: pouco texto por tela, hierarquia clara, estados de carregamento e de erro sempre tratados.

## Comandos

- `npm run dev`: ambiente local
- `npm run test`: testes unitários
- `npm run test:e2e`: testes ponta a ponta
- `npm run lint` e `npm run typecheck`: rodar antes de todo commit
- `npm run data:import`: importa as camadas do INPE e as áreas protegidas da região-piloto
- `npm run data:seed`: cria as fazendas de demonstração
