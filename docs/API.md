# API de consulta

Base local: `http://127.0.0.1:8000/api/v1`. Respostas JSON, UTF-8. Sem autenticação. Não há endpoints de escrita.

| Método / rota | Conteúdo |
| --- | --- |
| `GET /health` | Estado e data do snapshot |
| `GET /datasets/finance` | Fundo Clima, catálogo, regras, municípios e geometria para o frontend |
| `GET /datasets/fne` | FNE PI, agregados por UF, fontes e referências anuais |
| `GET /datasets/atlas` | Matriz IBGE e malha simplificada para o mapa |
| `GET /catalog` | Catálogo de instrumentos |
| `GET /fne/summary` | Indicadores financeiros e distribuições do FNE |
| `GET /fne/records` | Linhas do PI, com paginação |
| `GET /clima/summary` | Indicadores do Fundo Clima |
| `GET /internal/indicator` | Resultado agregado da coorte interna; não expõe projetos individuais |

## Filtros FNE

`year`: `todos`, `2021`, `2022`, `2023`, `2024`, `2025`; padrão `2025`.

`group`: `todos`, `FNE Verde: demais linhas`, `FNE Verde MPE`, `FNE Verde Sol PF`; padrão `todos`. Codifique espaços e acentos na URL.

`comparison` em `/fne/summary`: `NE` ou `FNE`; padrão `NE`. `BR` é rejeitado porque a base não é nacional.

Em `/fne/records`: `municipality` opcional com código IBGE do PI; `page` a partir de 1; `per_page` de 1 a 500, padrão 50. A resposta contém `total`, `page`, `per_page` e `items`.

```text
/api/v1/fne/summary?year=2025&comparison=NE
/api/v1/fne/records?year=2025&municipality=2211209&page=1&per_page=20
```

## Filtros Fundo Clima

`year`: mesmos anos, padrão `todos`. `sector`: `todos`, `agro`, `energia`, `logistica`. `size`: `todos` ou rótulo publicado exato da base. `comparison`: `NE` ou `BR`.

```text
/api/v1/clima/summary?year=todos&sector=energia&comparison=NE
```

## Unidades e erros

`value_cents`, `benchmark_cents` e valores das distribuições são **centavos inteiros**. `quantity_units_1e4` representa QTD BNB × 10.000. `pi_share`, `share` e `rate` são frações: 0,13548 corresponde a cerca de 13,55%. `null` não é zero.

Filtros ou paginação inválidos produzem HTTP 400 com `error`. Dataset/rota inexistente: 404. As consultas mantêm o escopo definido na metodologia; filtros municipais são da tabela de registros e não alteram o numerador estadual do resumo.

O frontend usa os datasets completos e calcula interações no navegador. Os endpoints de resumo oferecem os mesmos universos analíticos para consumidores Python ou outras ferramentas. A versão estática substitui os datasets da API por arquivos JSON gerados a partir dos mesmos CSVs.
