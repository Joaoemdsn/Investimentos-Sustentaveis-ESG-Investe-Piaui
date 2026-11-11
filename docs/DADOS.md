# Dicionário de dados

## Convenções

UTF-8, vírgula como delimitador, ponto decimal, datas ISO `AAAA-MM-DD`. Campos monetários financeiros têm duas casas; QTD BNB, quatro. Códigos IBGE e identificadores são texto. Listas como `tags` são arrays JSON dentro de uma célula CSV. Campo vazio representa ausência, conforme o esquema do conjunto; no IBGE, o código `status_codigo` preserva a situação da observação original.

## FNE Verde · Piauí (`fne_verde_pi.csv`)

| Campo | Conteúdo |
| --- | --- |
| `id` | Identificador local: fonte e linha de origem; não é contrato |
| `year`, `cutoff`, `month` | Ano, corte da publicação e mês publicado quando disponível |
| `cityId`, `city`, `publishedCity` | Código IBGE, nome padronizado e nome publicado pelo BNB |
| `valor_contratado_reais` | Valor nominal em reais, duas casas |
| `quantidade_bnb` | Medida QTD publicada, quatro casas; não é contagem de clientes |
| `program`, `group` | Programa publicado e grupo de leitura do dashboard |
| `sector`, `size` | Setor e porte publicados |
| `purpose`, `activity`, `product` | Finalidade, atividade e produto da fonte |
| `person`, `category`, `region`, `interest` | Tipo de pessoa, categoria, região e setor de interesse publicados |
| `source`, `sourceRow` | Chave nos metadados e linha da aba GERAL |

## FNE Verde · UFs (`fne_verde_ufs.csv`)

`year`, `cutoff`, `uf`, `region`, `group`, `program`, `lines`, `quantidade_bnb`, `valor_contratado_reais`, `source`.

`lines` conta linhas agregadas da publicação. `region` define o universo de comparação e não possui o mesmo significado de região subestadual do CSV do PI. Os demais campos seguem as unidades acima.

## Fundo Clima (`fundo_clima.csv`)

| Campo | Conteúdo |
| --- | --- |
| `id`, `operation`, `contract` | ID de linha, unidade de contagem analítica e contrato publicado quando disponível |
| `grain` | `subcredito` ou `registro_operacao_automatica` |
| `source`, `sourceRow` | Fonte e linha de origem |
| `client` | Nome do cliente na publicação pública |
| `date`, `year` | Data e ano da contratação |
| `uf`, `city`, `cityId` | Localização informada pela publicação; não confirma localização física do empreendimento |
| `valor_contratado_reais` | Valor nominal em reais, duas casas |
| `sector`, `cnae`, `activity`, `size`, `purpose` | Classificações publicadas |
| `description` | Descrição textual publicada |
| `piMention` | Booleano `0` / `1`: menção ao Piauí em descrição |
| `tags` | Nichos analíticos: `agro`, `energia`, `logistica`, com sobreposição possível |
| `rules` | IDs das regras aplicadas |
| `evidenceUrls` | Evidências complementares, em array JSON |

Não aplique relacionamento obrigatório entre todos os códigos do Fundo Clima e a dimensão de municípios do PI: a base inclui Brasil e códigos de localização não especificada.

## Contexto produtivo

`municipios.csv`: `id` (código IBGE), `name` (nome). 224 linhas.

`atividades_ibge.csv`: `id`, `label`, `source` (`pam`, `ppm`, `pevs`), `parentLabel`, `level` (posição hierárquica original). Inclui totais e produtos: somar todas as atividades pode duplicar totais e componentes.

`producao_municipal.csv`: `atividade_id`, `codigo_ibge`, `ano`, `valor_mil_reais`, `status_codigo`. Matriz completa de 157 × 224 × 5. A transformação preserva valores e códigos do protótipo, sem inferir observações ausentes. Valores em **R$ mil**; não são valores de financiamento.

| `status_codigo` | Significado no protótipo |
| ---: | --- |
| 0 | Valor publicado |
| 1 | Zero absoluto, símbolo original `-` |
| 2 | Zero calculado ou arredondado, símbolo `0` |
| 3 | Dado não disponível, símbolo `...` |
| 4 | Valor protegido por sigilo, símbolo `X` |
| 5 | Não se aplica, símbolo `..` |

`metadata/municipal_geometry.json`: caminhos SVG municipais simplificados, identificados por código IBGE, no espaço de coordenadas do mapa. Geometria adequada à visualização do protótipo, sem finalidade cadastral.

## Catálogo e regras

`instrumentos.csv`: `id`, nome, instituição, tipo, tags, finalidade, público, porta de entrada, requisitos, situação documental, URL e `hasData` (`0` / `1`). Os rótulos originais em inglês são mantidos para correspondência com a interface.

`regras_enquadramento.csv`: ID, nicho e descrição do critério de classificação. As listas de IDs no Fundo Clima permitem rastrear a regra de cada registro.

## Dados internos

Cabeçalho em `templates/projetos_internos.csv`. A aplicação procura os registros preenchidos em `data/private/projetos_internos.csv`; na ausência, usa o template vazio.

| Campo | Regra |
| --- | --- |
| `projeto_id` | Obrigatório, único, anonimizado |
| `data_demanda` | Obrigatória, define a entrada na coorte |
| `municipio`, `nicho` | Contexto para futuras análises; não alteram o cálculo atual |
| `encaminhado` | `sim`, `não` ou `nao` |
| `data_envio` | Obrigatória se encaminhado; não pode anteceder a demanda |
| `motivo_nao_avanco` | Informação de contexto; não entra na fórmula atual |

O arquivo `metadata/internal_period.json` define `start`, `end`, `cutoff`. Não há dados internos reais no pacote.

## Metadados e fontes

| Arquivo | Conteúdo |
| --- | --- |
| `metadata/fne.json` | Fontes BNB, URLs, hashes, datas de corte, resumos anuais e referência anual separada de 2023 |
| `metadata/finance.json` | Fontes BNDES, datas, escopo e evidências complementares |
| `metadata/atlas.json` | URLs SIDRA e malha IBGE; coleta e anos |
| `metadata/export.json` | Snapshot, contagens e referência do protótipo exportado |

Os arquivos brutos de origem não estão anexados. Os dados normalizados são a fonte de entrada desta aplicação. Consulte as URLs preservadas para recuperar as publicações oficiais e conferir a próxima coleta.
