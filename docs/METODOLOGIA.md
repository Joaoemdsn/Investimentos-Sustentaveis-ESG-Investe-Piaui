# Metodologia e limites

## Pergunta de análise

Como as evidências públicas de contratação e o acompanhamento dos projetos podem apoiar a articulação de acesso a financiamento sustentável no Piauí?

O dashboard descreve a contratação observada e explicita lacunas que precisam de validação com a Investe. Os valores, isoladamente, não medem demanda reprimida, impacto ambiental, elegibilidade ou participação da instituição em uma operação.

## Indicadores externos

| Indicador | Cálculo / interpretação |
| --- | --- |
| Valor contratado com UF Piauí | Soma dos valores do instrumento e filtros selecionados; valores nominais |
| Operações / registros | Fundo Clima: contratos distintos não automáticos + registros automáticos. FNE: linhas agregadas e QTD BNB, exibidas separadamente |
| Participação do Piauí | Valor do PI dividido pelo valor da comparação sob os mesmos filtros aplicáveis |
| Porte com maior valor | Categoria publicada com a maior soma de valor no PI |
| Instrumentos mapeados | Contagem do catálogo documental, independente de ano de contratação |

O número de instrumentos não mede crédito aprovado. A evolução anual, a distribuição territorial e o perfil por setor/porte complementam esses indicadores.

### FNE Verde

São 2.678 linhas do Piauí em 156 municípios e 591 grupos de comparação por UF, ano e programa. O valor de 2025 no PI é R$ 469.697.268,61, em 458 linhas, com QTD BNB 468,0000 e 68 municípios.

2021, 2022, 2024 e 2025 cobrem o ano completo. **2023 cobre janeiro a setembro**. A referência do relatório anual de 2023 permanece separada e não preenche municípios do recorte parcial.

O filtro de grupo abrange Sol PF, MPE e demais linhas. Setor, porte e nomes de programa são preservados. O comparador Nordeste usa as nove UFs; a área de atuação usa todas as UFs presentes na publicação. A área FNE não é Brasil. O detalhe do PI permite setor e porte, mas as UFs estão agregadas por programa: os filtros de nicho e porte do Fundo Clima não são aplicados ao FNE.

As linhas não têm identificador de contrato ou cliente. QTD pode ser fracionária e foi preservada com quatro casas. Não se convertem linhas em empresas nem em contratos distintos.

### Fundo Clima

São 313 linhas com contratação em 2021–2025, das quais 163 receberam ao menos um dos três nichos analíticos. Regras de CNAE/texto e revisão documental estão em `regras_enquadramento.csv`. A visão integrada usa a **união** dos nichos: uma operação pode ser agro e energia, mas é somada uma vez no total integrado.

O recorte estrito PI usa somente a UF PI publicada. O valor localizado é R$ 150 milhões, em um registro automático da Brasbio em Uruçuí, 2025, com evidência complementar de cogeração por biomassa. A classificação dupla agro/energia não duplica esse registro.

Dois contratos solares que mencionam o Piauí têm R$ 700 milhões em valores integrais de projetos de vários estados, em três subcréditos. Não há parcela estadual publicada. Esses valores são mostrados separadamente e excluídos da soma estrita do PI.

Contratos não automáticos podem ter vários subcréditos: somam-se os valores e contam-se contratos distintos. Registros automáticos não possuem identificador público de operação; sua contagem é informada separadamente. Não se conclui que registros semelhantes são duplicados sem evidência.

O comparador Nordeste exclui IE e UFs externas; Brasil inclui todos os registros do recorte. Numerador e denominador preservam instrumento, período, nicho e porte. FNE e Fundo Clima **não são somados**.

### IBGE

224 municípios, 157 atividades ou totais, cinco anos. Valor de produção em **R$ mil**. A matriz conserva observações ausentes e seus códigos de status, sem convertê-las em zero. A malha simplificada de 2024 é usada para os cinco anos e não descreve mudanças de limites territoriais. O contexto produtivo não comprova recebimento de crédito.

## Indicador interno 06

**Taxa de encaminhamento para financiamento sustentável** = projetos da coorte formalmente encaminhados até o corte ÷ projetos da mesma coorte com demanda registrada × 100.

Coorte é o conjunto de projetos com demanda entre início e fim, inclusive. IDs são únicos. Um projeto com envio após o corte fica no denominador e não entra no numerador. Demanda fora da coorte não entra em nenhum dos dois. Encaminhamento é uma etapa distinta de aprovação e desembolso.

Sem registros: pendente e percentual nulo. Coorte vazia: percentual nulo. Registros/datas inválidos ou IDs duplicados: cálculo bloqueado. O desenho e o papel da Investe nesse fluxo ainda precisam de validação institucional.

## Rastreabilidade

Cada registro financeiro mantém identificador de fonte e linha de origem quando disponível. URLs, datas, hashes de fontes FNE e da planilha consolidada estão nos metadados. `export.json` identifica o commit e o protótipo de origem. Os testes comparam os três conjuntos reconstruídos com hashes de referência desse snapshot.

Não foi feita nova coleta nesta transformação de arquitetura. O catálogo de instrumentos conserva a situação documental da versão exportada; a vigência e as condições de crédito devem ser verificadas nas fontes para decisões futuras.
