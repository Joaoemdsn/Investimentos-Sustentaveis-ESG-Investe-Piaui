(() => {
  'use strict';
  const dimensions = [
    {
      key: 'A',
      name: 'Ambiental',
      indicators: ['Resultado ambiental', 'Acompanhamento da meta ambiental']
    },
    {
      key: 'S',
      name: 'Social',
      indicators: ['Empregos diretos gerados', 'Qualificação ou inclusão produtiva']
    },
    {
      key: 'G',
      name: 'Governança',
      indicators: ['Transparência na aplicação dos recursos', 'Prestação de contas da execução']
    }
  ];
  // Observed and target values below are invented for this demonstration only.
  const projects = [
    {
      id: 'agro',
      sector: 'Agroindústria',
      name: 'Empresa fictícia A',
      project: 'Modernização de unidade de beneficiamento',
      credit: 'R$ 8 milhões',
      values: [
        [18, 15, '% de redução do consumo de água'],
        [4, 4, 'medições trimestrais registradas'],
        [24, 30, 'empregos diretos criados'],
        [12, 20, 'trabalhadores capacitados'],
        [3, 3, 'categorias de gastos detalhadas'],
        [1, 2, 'relatórios de execução publicados']
      ]
    },
    {
      id: 'energia',
      sector: 'Energia renovável',
      name: 'Empresa fictícia B',
      project: 'Instalação de uma usina solar',
      credit: 'R$ 12 milhões',
      values: [
        [2100, 2000, 'MWh de energia gerada'],
        [4, 4, 'medições trimestrais registradas'],
        [16, 15, 'empregos diretos criados'],
        [25, 25, 'trabalhadores capacitados'],
        [3, 3, 'categorias de gastos detalhadas'],
        [0, 2, 'relatórios de execução publicados']
      ]
    },
    {
      id: 'logistica',
      sector: 'Logística',
      name: 'Empresa fictícia C',
      project: 'Modernização de centro de distribuição',
      credit: 'R$ 5 milhões',
      values: [
        [6, 10, '% de redução do consumo de combustível'],
        [4, 4, 'medições trimestrais registradas'],
        [12, 20, 'empregos diretos criados'],
        [0, 15, 'trabalhadores capacitados'],
        [3, 3, 'categorias de gastos detalhadas'],
        [1, 2, 'relatórios de execução publicados']
      ]
    },
    {
      id: 'brasbio',
      sector: 'Caso real',
      name: 'Brasbio · Uruçuí',
      project: 'Cogeração por biomassa',
      credit: 'R$ 150 milhões',
      values: Array(6).fill(null)
    }
  ];
  const score = value =>
    value === null ? null : value[0] >= value[1] ? 100 : value[0] > 0 ? 50 : 0;
  const average = values =>
    values.every(n => n !== null) ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const fmt = new Intl.NumberFormat('pt-BR');
  const status = n =>
    n === null
      ? 'Não avaliado'
      : n === 100
        ? 'Meta atingida'
        : n === 50
          ? 'Meta parcialmente atingida'
          : 'Meta não atendida';
  const $ = id => document.getElementById(id);
  const selector = $('esgSelect');
  if (!selector) return;

  function render() {
    const p = projects.find(x => x.id === selector.value) || projects[0];
    const real = p.id === 'brasbio';
    const points = p.values.map(score);
    const total = average(points);
    const shown = total === null ? null : Math.round(total);
    const coverage = points.filter(n => n !== null).length;
    $('esgMode').textContent = real
      ? 'CASO REAL · AVALIAÇÃO PENDENTE'
      : 'SIMULAÇÃO · TODOS OS DADOS SÃO FICTÍCIOS';
    $('esgMode').classList.toggle('esg-real', real);
    $('esgCompany').textContent = p.name;
    $('esgProject').textContent = p.project;
    $('esgCredit').textContent =
      (real ? 'Contratação publicada: ' : 'Crédito simulado: ') + p.credit;
    $('esgReading').textContent = real
      ? 'A contratação e a finalidade ambiental constam na base do Fundo Clima. Faltam resultados do projeto, dados de emprego e evidências de execução para pontuar.'
      : 'As metas e os resultados são ilustrativos. Este caso está separado dos registros, mapas e totais de crédito real.';
    $('esgEvidence').hidden = !real;
    $('esgScore').textContent = shown === null ? 'Em avaliação' : String(shown);
    $('esgScore').classList.toggle('esg-unrated', shown === null);
    $('esgScale').textContent = shown === null ? 'SEM NOTA GERAL' : 'DE 100 PONTOS';
    $('esgCoverage').textContent =
      coverage +
      ' de 6 indicadores ' +
      (real ? 'avaliáveis com os dados disponíveis' : 'avaliados com dados simulados');
    $('esgArc').classList.toggle('esg-muted', shown === null);
    $('esgMarker').setAttribute('visibility', shown === null ? 'hidden' : 'visible');
    if (shown !== null) {
      const angle = Math.PI * (1 - shown / 100);
      $('esgMarker').setAttribute('cx', 120 + 94 * Math.cos(angle));
      $('esgMarker').setAttribute('cy', 116 - 94 * Math.sin(angle));
    }
    $('esgDimensions').innerHTML = dimensions
      .map((d, i) => {
        const dim = average(points.slice(i * 2, i * 2 + 2));
        return (
          '<article class="esg-dimension"><header><span class="esg-letter">' +
          d.key +
          '</span><h3>' +
          d.name +
          '</h3><b>' +
          (dim === null ? '—' : dim + '/100') +
          '</b></header>' +
          d.indicators
            .map((title, j) => {
              const idx = i * 2 + j,
                value = p.values[idx],
                n = points[idx];
              const detail =
                value === null
                  ? 'Sem dados suficientes para verificar o indicador.'
                  : 'Resultado: ' +
                    fmt.format(value[0]) +
                    ' · Meta: ' +
                    fmt.format(value[1]) +
                    ' · ' +
                    value[2];
              return (
                '<div class="esg-metric"><h4>' +
                title +
                '</h4><p>' +
                detail +
                '</p><span class="esg-grade" data-grade="' +
                n +
                '">' +
                (n === null ? '' : n + ' pts · ') +
                status(n) +
                '</span></div>'
              );
            })
            .join('') +
          '</article>'
        );
      })
      .join('');
  }

  selector.addEventListener('change', render);
  render();
})();
