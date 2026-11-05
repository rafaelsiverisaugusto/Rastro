# Fontes de dados

Toda fonte usada pelo Rastro é oficial e aberta, acessada por API ou download oficial. Nada de scraping. Cada entrada traz URL, data de acesso, licença e texto de atribuição.

| Fonte | Uso | Status |
|---|---|---|
| EOX Sentinel-2 cloudless | Mapa base de satélite | Em uso (Fase 0) |
| INPE DETER (TerraBrasilis) | Alertas de desmatamento | Fase 1 |
| INPE PRODES (TerraBrasilis) | Desmatamento anual | Fase 1 |
| FUNAI: terras indígenas | Áreas protegidas | Fase 1 |
| MMA/ICMBio CNUC: unidades de conservação | Áreas protegidas | Fase 1 |
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
