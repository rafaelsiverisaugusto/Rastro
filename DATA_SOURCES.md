# Fontes de dados

Toda fonte usada pelo Rastro é oficial e aberta, acessada por API ou download oficial. Nada de scraping. Cada entrada traz URL, data de acesso, licença e texto de atribuição.

| Fonte | Uso | Status |
|---|---|---|
| EOX Sentinel-2 cloudless | Mapa base de satélite | Em uso (Fase 0) |
| INPE DETER (TerraBrasilis) | Alertas de desmatamento | Confirmada (Fase 1) |
| INPE PRODES (TerraBrasilis) | Desmatamento anual | Confirmada (Fase 1) |
| FUNAI: terras indígenas | Áreas protegidas | Confirmada (Fase 1) |
| MMA CNUC: unidades de conservação | Áreas protegidas | Confirmada (Fase 1) |
| IBGE: malha municipal | Região de cobertura | Confirmada (Fase 1); termos de uso pendentes |
| Earth Search STAC (Element 84), `sentinel-2-l2a` | Imagens de antes e depois | Fase 2 |

---

## EOX Sentinel-2 cloudless (mapa base)

- **Serviço:** WMTS da EOX, `https://tiles.maps.eox.at/wmts/1.0.0/WMTSCapabilities.xml`
- **Camada usada:** `s2cloudless_3857` (mosaico de 2016, Web Mercator), matriz `GoogleMapsCompatible`
- **URL dos tiles:** `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg`
- **Acesso e conferência:** 05/11/2026, pelo GetCapabilities
- **Licença:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- **Atribuição (exibida no mapa):** "EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016)", CC BY 4.0
- **Exigência do serviço (AccessConstraints):** atribuição adequada é obrigatória em qualquer uso.

Licenças por ano, segundo o GetCapabilities de 05/11/2026:

| Anos | Licença | Observação |
|---|---|---|
| 2016 | CC BY 4.0 | Cobertura global. **Em uso.** |
| 2017 | CC BY 4.0 | Sem dados sobre o Brasil (tiles em branco na região-piloto) |
| 2018 a 2025 | CC BY-NC-SA 4.0 | Uso não comercial; uso comercial exige licença da EOX |

O ano fica em uma só constante: `BASEMAP_YEAR`, em `src/lib/geo/basemap.ts`. A escolha está registrada em `docs/decisoes.md`.

---

## Região-piloto

Medicilândia, Brasil Novo e Uruará (PA). Retângulo envolvente (EPSG:4674): longitude −54,2983 a −52,2741, latitude −4,2669 a −2,6653.

| Município | Código IBGE |
|---|---|
| Brasil Novo | 1501725 |
| Medicilândia | 1504455 |
| Uruará | 1508159 |

Códigos conferidos em `https://servicodados.ibge.gov.br/api/v1/localidades/estados/PA/municipios` (05/11/2026).

Os scripts de importação se identificam com o User-Agent `Rastro/0.1 (+https://github.com/rafaelsiverisaugusto/Rastro)`.

---

## INPE DETER (alertas de desmatamento)

- **Serviço:** WFS do TerraBrasilis, `https://terrabrasilis.dpi.inpe.br/geoserver/deter-amz/deter_amz/wfs`
- **Camada:** `deter-amz:deter_amz` (466.701 polígonos na Amazônia Legal em 05/11/2026)
- **Projeção:** EPSG:4674 (SIRGAS 2000), transformada para EPSG:4326 na importação
- **Requisição usada:** `GetFeature` com `outputFormat=csv`, `srsName=EPSG:4674` e `CQL_FILTER=mun_geocod IN ('1501725','1504455','1508159')`
- **Na região-piloto:** 9.013 polígonos, de 02/08/2016 a 23/10/2026
- **Acesso e conferência:** 05/11/2026 (DescribeFeatureType e amostras)
- **Licença:** [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), conforme a [página de licença do TerraBrasilis](https://www.terrabrasilis.dpi.inpe.br/?p=1216)
- **Atribuição:** "DETER: Programa de Monitoramento dos Biomas Brasileiros, INPE/CGCT. TerraBrasilis (terrabrasilis.dpi.inpe.br), CC BY-SA 4.0."

Campos (nomes reais no WFS): `gid`, `classname`, `quadrant`, `path_row`, `view_date` (data), `sensor`, `satellite`, `areauckm`, `uc`, `areamunkm`, `municipality`, `mun_geocod`, `uf`, `publish_month` (data), `geom` (MultiPolygon).

Classes na camada inteira (a soma bate com o total):

| `classname` | Polígonos |
|---|---|
| `DESMATAMENTO_CR` | 273.455 |
| `CICATRIZ_DE_QUEIMADA` | 121.075 |
| `DEGRADACAO` | 40.692 |
| `DESMATAMENTO_VEG` | 9.974 |
| `MINERACAO` | 8.866 |
| `CS_DESORDENADO` | 7.033 |
| `CS_GEOMETRICO` | 5.605 |
| `CORTE_SELETIVO` | 1 |

Cuidados (detalhes em `docs/decisoes.md`, D-008 e D-009):

- As saídas JSON e GML arredondam as coordenadas para 4 casas (cerca de 11 m). CSV (WKT) e SHAPE-ZIP mantêm a precisão total.
- `gid` não é único.
- Sem `srsName` explícito, a saída pode vir em ordem lat/lon.

## INPE PRODES (desmatamento anual, bioma Amazônia)

- **Serviço:** WFS do TerraBrasilis, `https://terrabrasilis.dpi.inpe.br/geoserver/prodes-amazon-nb/wfs`
- **Camada:** `prodes-amazon-nb:yearly_deforestation_biome`, encontrada pelo GetCapabilities em `https://terrabrasilis.dpi.inpe.br/geoserver/ows`
- **Projeção:** EPSG:4674
- **Campos:** `uuid` (único), `fid`, `state`, `path_row`, `main_class` (`desmatamento` ou `DESMATAMENTO`), `class_name` (`d<ano>`), `def_cloud`, `julian_day`, `image_date`, `year`, `area_km`, `scene_id`, `publish_year`, `source`, `satellite`, `sensor`, `geom`
- **Filtro:** a camada não tem campo de município. Filtramos pelo `BBOX` da região e recortamos pelos limites municipais no banco.
- **Anos disponíveis:** 2008 a 2025 (o PRODES 2026 ainda não tinha sido publicado em 05/11/2026). No retângulo da região: 31.639 polígonos, 11.580 deles de 2020 em diante.
- **Acesso e conferência:** 05/11/2026
- **Licença e atribuição:** as mesmas do DETER (CC BY-SA 4.0, INPE/CGCT, TerraBrasilis)

A camada `prodes-legal-amz:yearly_deforestation` (Amazônia Legal) também existe. Usamos a do bioma, alinhada ao escopo do plano.

## FUNAI: terras indígenas

- **Página oficial de downloads:** https://www.gov.br/funai/pt-br/atuacao/terras-indigenas/geoprocessamento-e-mapas
- **Download usado (link da própria página, com filtro por UF):**
  `https://geoserver.funai.gov.br/geoserver/Funai/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Funai:tis_poligonais&CQL_FILTER=uf_sigla%20LIKE%20%27%25PA%25%27&outputFormat=SHAPE-ZIP`
- **Formato:** shapefile, EPSG:4674, codificação ISO-8859-1; 61 terras indígenas no Pará
- **Campos usados:** `terrai_cod`, `terrai_nom`, `fase_ti`, `modalidade`, `data_atual`
- **Na região-piloto:** TI Arara (Medicilândia, Brasil Novo, Altamira e Uruará) e TI Cachoeira Seca (Altamira, Uruará e Placas), ambas regularizadas
- **Acesso:** 05/11/2026. O GetCapabilities declara `AccessConstraints: NONE` e `Fees: NONE`.
- **Licença:** dado público federal; o serviço não declara licença específica.
- **Atribuição:** "Terras indígenas: FUNAI, Coordenação de Geoprocessamento (geoserver.funai.gov.br)."

## MMA: Cadastro Nacional de Unidades de Conservação (CNUC)

- **Conjunto de dados:** https://dados.mma.gov.br/dataset/unidadesdeconservacao
- **Arquivo usado:** `shp_cnuc_2025_08.zip`, o shapefile mais recente hospedado no próprio portal: https://dados.mma.gov.br/dataset/44b6dc8a-dc82-4a84-8d95-1b0da7c85dac/resource/6ba9a557-87e8-4882-acb7-b3e0f0ea192d/download/shp_cnuc_2025_08.zip
- **Formato:** shapefile, SIRGAS 2000 (o `.prj` não traz código EPSG; tratado como EPSG:4674), UTF-8; 3.122 polígonos
- **Campos usados:** `cd_cnuc`, `nome_uc`, `categoria`, `grupo`, `esfera`
- **Na região-piloto:** nenhuma UC. Conferimos também a planilha mais recente, `cnuc_2026_07.csv`: nenhuma UC lista Medicilândia, Brasil Novo ou Uruará. A importação continua no pipeline para manter o método válido se a região crescer.
- **Acesso:** 05/11/2026
- **Licença:** Creative Commons Atribuição, declarada no portal dados.mma.gov.br
- **Atribuição:** "Unidades de conservação: Cadastro Nacional de Unidades de Conservação (CNUC), Ministério do Meio Ambiente e Mudança do Clima."

## IBGE: malha municipal (região de cobertura)

- **Serviço:** API de malhas v3, um município por chamada (o filtro com `|` é rejeitado):
  `https://servicodados.ibge.gov.br/api/v3/malhas/municipios/{codigo}?formato=application/vnd.geo%2Bjson&qualidade=maxima`
- **Formato:** GeoJSON, SIRGAS 2000, coordenadas com 4 casas decimais (suficiente para o limite da região)
- **Acesso:** 05/11/2026
- **Licença:** **pendente de confirmação.** Os termos encontrados para outros produtos cartográficos do IBGE pedem crédito ("Fonte: IBGE") e vedam a revenda. Não achamos um termo específico da API.
- **Atribuição:** "Limites municipais: IBGE, Malha Municipal (API de malhas v3)."
