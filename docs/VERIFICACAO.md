# Verificação desta exportação

Ambiente: Python 3.12, Flask 3.1.3. A transformação foi conferida contra o snapshot de origem, sem nova coleta de dados.

| Verificação | Resultado |
| --- | --- |
| Reconstrução dos dados IBGE | Mesmo SHA-256 do conjunto original |
| Reconstrução das linhas do Fundo Clima | Mesmo SHA-256 do conjunto original |
| Reconstrução do FNE, incluindo metadados | Mesmo SHA-256 do conjunto original |
| Valores, QTD e linhas FNE por ano / grupo / comparação | 48 combinações reconciliadas |
| Suíte automatizada | 12 testes aprovados |
| API Flask | Resumos, datasets, paginação, erros de filtro e rotas verificados com cliente de teste |
| Navegador, versão estática | FNE 2025, filtro MPE/2023 parcial, Fundo Clima, visão interna e mapa produtivo conferidos |
| Versão offline | Inicialização, mapas e valor FNE conferidos no navegador |

Os testes cobrem ausência de dados, zeros, precisão monetária, sobreposição de nichos, projetos interestaduais e regras da coorte interna. As observações sintéticas estão restritas aos testes.

Docker e publicação em uma conta GitHub não foram executados nesta exportação. A configuração de CI foi incluída para rodar no repositório do usuário. A hospedagem do protótipo anterior permanece independente deste pacote.

`MANIFEST.csv`, no ZIP, registra tamanho e hash de cada arquivo de origem. Para gerar outra distribuição local: `python scripts/package_release.py`. Ambientes virtuais, arquivos de cache, builds e registros privados ficam fora do ZIP.
