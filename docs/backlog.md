# Backlog

Ideias e pendências que estão fora das fases atuais. Nada daqui é construído sem decisão do time.

- Mapa base: decidir entre EOX 2016 (CC BY) e 2020 (CC BY-NC-SA). Ver `docs/decisoes.md` D-003.
- Celular: a atribuição expandida cobre a escala do mapa. Avaliar começar com ela recolhida ou mudar a escala de posição (Fase 4).
- Banco: ligar a verificação TLS do certificado da Supabase nos scripts (baixar o certificado raiz em Database > SSL e preencher `SUPABASE_DB_CA_CERT`), localmente e onde mais os scripts rodarem (Fase 4). Hoje a conexão é criptografada, mas a cadeia não é verificada. Ver `docs/decisoes.md` D-014.
