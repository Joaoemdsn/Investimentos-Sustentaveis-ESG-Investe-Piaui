# Piauí em Perspectiva

Dashboard de análise de **acesso a financiamento sustentável no Piauí**, desenvolvido no projeto acadêmico iCEV + Investe Piauí, Grupo 7. Integra evidências do FNE Verde e do Fundo Clima, contexto produtivo municipal do IBGE e uma estrutura para acompanhar encaminhamentos internos.

Agro e bioeconomia, energias renováveis e logística de cargas orientam a leitura do Fundo Clima. O FNE preserva os setores e programas publicados pelo BNB. A interface mantém os mapas, filtros, gráficos, detalhes de fonte, exportação e identidade visual do protótipo.

**Snapshot dos dados:** 10/11/2026. Período analítico: 2021–2025. **FNE 2023: janeiro a setembro.** O indicador interno aguarda registros reais.

## Executar no computador

Requer **Python 3.12 ou superior**. Extraia o ZIP e abra o terminal na pasta que contém este README.

Windows, PowerShell:

```powershell
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python run.py
```

Linux/macOS:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python run.py
```

Abra **http://127.0.0.1:8000**. Interrompa com `Ctrl+C`. Não é preciso Node, conta em banco de dados ou chave de API. O primeiro carregamento lê os CSVs; as próximas consultas usam cache em memória. Reinicie o servidor após editar os dados.

Os comandos abaixo usam `python` como abreviação do Python do ambiente virtual. No Windows, também pode usar `.venv\Scripts\python`; no Linux/macOS, `.venv/bin/python`.

## Camadas do projeto

| Pasta / arquivo | Responsabilidade |
| --- | --- |
| `frontend/index.html` | Página de financiamento, visão interna e pontuação ESG |
| `frontend/contexto.html` | Mapa do contexto produtivo |
| `frontend/assets/css/` | Estilos e layout |
| `frontend/assets/js/` | Filtros, mapas SVG, gráficos, navegação e consumo da API |
| `backend/api/` | Rotas HTTP e validação dos filtros |
| `backend/domain/` | Regras dos indicadores e dos universos de comparação |
| `backend/repositories/` | Leitura e tipagem dos CSVs; conversão monetária exata |
| `backend/services/` | Geração de versões offline |
| `data/processed/` | Dados tabulares efetivamente usados pela aplicação |
| `data/metadata/` | Fontes, cobertura, rastreabilidade e geometria municipal |
| `data/templates/` | Cabeçalho para receber dados internos |
| `scripts/` | Validação, preparação dos indicadores e geração estática |
| `tests/` | Testes de dados, regras, API e exportação |
| `docs/` | Dicionário, metodologia e guia da API |
| `.github/workflows/` | Validação automática em push e pull request |
| `run.py` / `wsgi.py` | Entradas de desenvolvimento e produção |

O frontend consulta a API para carregar os dados. As interações do mapa e dos gráficos são calculadas no navegador para preservar a resposta imediata do protótipo. A API também oferece indicadores calculados em Python e consulta paginada do FNE para análises e integrações.

## Pontuação ESG

A aba reproduz a versão publicada em 11/11/2026. São três projetos fictícios de agroindústria, energia renovável e logística, com notas de **75**, **83** e **58**. Os valores, metas e resultados simulados estão em `frontend/assets/js/finance/esg.js`, separados dos CSVs e dos totais de crédito real.

A nota é a média de Ambiental, Social e Governança, com dois indicadores por dimensão e pontuações de 0, 50 ou 100. A nota geral só aparece quando todos os seis indicadores podem ser avaliados. A Brasbio, caso real com registro no Fundo Clima, aparece como **Em avaliação**. A aba funciona com Flask, no build estático e na versão offline.

## Dados incluídos

| Base | Linhas | Unidade |
| --- | ---: | --- |
| FNE Verde · Piauí | 2.678 | Linha agregada publicada pelo BNB |
| FNE Verde · UFs | 591 | Grupo por UF, ano e programa |
| Fundo Clima | 313 | Subcrédito ou registro automático publicado pelo BNDES |
| Municípios | 224 | Município / código IBGE |
| Atividades IBGE | 157 | Série produtiva ou total publicado |
| Produção municipal | 175.840 | Atividade × município × ano, incluindo ausentes |
| Instrumentos / regras | 3 / 7 | Catálogo documental / regra de enquadramento |
| Projetos internos | 0 | Aguardando dados da Investe |

Os CSVs são UTF-8, separados por vírgula e com ponto decimal. Abra no Excel por **Dados → De Texto/CSV**, selecionando a codificação e o separador. Campos com listas usam JSON dentro da célula. As unidades e os principais campos estão em [docs/DADOS.md](docs/DADOS.md).

Os dados de produção estão em **mil reais**; os CSVs financeiros, em **reais nominais**. O backend trabalha com centavos inteiros e unidades de 1/10.000 para a QTD BNB. Os CSVs não contêm observações fictícias. As simulações ESG existem somente na aba de demonstração. As entradas sintéticas dos testes servem exclusivamente para verificar regras.

## Validar e preparar a análise

```bash
python scripts/validate_data.py
python -m unittest discover -s tests -v
python scripts/export_indicators.py
```

O primeiro comando reconcilia valores, quantidades e linhas do FNE em **48 combinações de ano, grupo e comparação**. O segundo verifica também equivalência com o snapshot original, precisão, sobreposição dos nichos, coorte interna, API e exportação estática. O terceiro grava indicadores em `build/reports/`, em CSV.

Os hashes em `tests/reference.json` registram o conteúdo recuperado do protótipo. Uma atualização intencional da base exige revisar essa referência e os testes de valores conhecidos após conferir as novas fontes; não altere os hashes apenas para ocultar uma divergência.

## Gerar site para GitHub Pages

```bash
python scripts/build_static.py
python -m http.server 8080 --directory build/static
```

Abra **http://localhost:8080** para conferir. Publique **o conteúdo de `build/static/`** no serviço estático de sua preferência. Todos os caminhos são relativos, inclusive para GitHub Pages em uma subpasta de repositório.

Uma opção manual no GitHub Pages é copiar esse conteúdo para a raiz de uma branch `gh-pages` e selecionar essa branch em **Settings → Pages → Deploy from a branch**. A pasta gerada inclui HTML, CSS, JavaScript, dados JSON e as duas versões offline. O repositório principal continua contendo o código Python e os CSVs que permitem reconstruí-la.

**GitHub Pages executa a versão estática; o backend Python precisa de uma hospedagem que execute Python.** Nesse modo, as interações continuam funcionando e os dados são os do momento da geração. Não abra `frontend/index.html` diretamente pelo explorador de arquivos: ele depende da API. Para abrir sem servidor, use o `offline.html` gerado, com dados incorporados.

## Colocar o código no GitHub

Crie um repositório vazio em sua conta. Na pasta extraída:

```bash
git init
git add .
git commit -m "Estrutura inicial do Piauí em Perspectiva"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/piaui-em-perspectiva.git
git push -u origin main
```

Substitua `SEU_USUARIO` e o nome do repositório pela URL real criada. O ZIP não contém credenciais nem histórico Git do ambiente anterior. O workflow incluído verifica o projeto; a publicação no Pages é configurada separadamente.

## Atualização e visão interna

1. Atualize as tabelas normalizadas em `data/processed/`, preservando o esquema e a unidade dos campos.
2. Registre a fonte, a data de corte e a cobertura nos arquivos de `data/metadata/`.
3. Execute a validação e os testes; confira comparações e unidades antes de atualizar referências de snapshot.
4. Reinicie o servidor. Para publicação estática, gere novamente o site.

A coleta original está representada nos CSVs e nas fontes registradas. Os arquivos brutos de origem e a planilha consolidada original não estão duplicados no pacote. Não há atualização automática pela internet: os scripts deste projeto validam, analisam e publicam os dados normalizados já coletados.

Para alimentar o indicador interno, copie `data/templates/projetos_internos.csv` para **`data/private/projetos_internos.csv`** e preencha os registros. Essa pasta é ignorada pelo Git e pelo Docker. Configure `start`, `end` e `cutoff` em `data/metadata/internal_period.json`, no formato `AAAA-MM-DD`, com início ≤ fim ≤ corte. O frontend recebe somente o resultado agregado. O build estático e as cópias offline incorporam esse agregado; gere-os com a base interna desejada para a apresentação.

Encaminhamento admite `sim`, `não` ou `nao`; quando positivo, a data de envio é obrigatória. IDs devem ser únicos e anonimizados. Datas inválidas ou duplicações impedem o cálculo. Ausência de dados produz **pendente**, e não 0%. Veja a definição em [docs/METODOLOGIA.md](docs/METODOLOGIA.md).

## Produção com Python

```bash
python -m pip install -r requirements-production.txt
gunicorn --bind 0.0.0.0:8000 --workers 2 wsgi:app
```

Gunicorn é uma opção para Linux. O `Dockerfile` oferece a mesma entrada:

```bash
docker build -t piaui-perspectiva .
docker run --rm -p 8000:8000 piaui-perspectiva
```

Para dados internos em um contêiner, monte a pasta privada em `/app/data/private`, em modo somente leitura, e use um arquivo de período compatível. Este pacote é uma aplicação de consulta: não possui login, formulário de cadastro ou banco transacional.

Consulte [docs/API.md](docs/API.md) para os endpoints e [NOTICE.md](NOTICE.md) para atribuição de dados e marca.
