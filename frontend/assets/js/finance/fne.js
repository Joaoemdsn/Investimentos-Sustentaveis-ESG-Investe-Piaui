(() => {
  'use strict';
  const D = window.FNE_DATA,
    Atlas = window.FINANCE_DATA,
    M = window.FNE_ANALYSIS,
    $ = id => document.getElementById(id);
  const esc = v =>
    String(v ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const normal = v =>
    String(v)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const money = n =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n / 100);
  const compact = n => {
    const v = n / 100,
      k = Math.abs(v) >= 1e9 ? 1e9 : Math.abs(v) >= 1e6 ? 1e6 : Math.abs(v) >= 1e3 ? 1e3 : 1;
    return (
      'R$ ' +
      new Intl.NumberFormat('pt-BR', {
        maximumFractionDigits: k === 1e9 ? 2 : k === 1 ? 2 : 1
      }).format(v / k) +
      (k === 1e9 ? ' bi' : k === 1e6 ? ' mi' : k === 1e3 ? ' mil' : '')
    );
  };
  const pct = v =>
    new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      v * 100
    ) + '%';
  const qty = n =>
    new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(
      n / 10000
    );
  const date = v => v.split('-').reverse().join('/');
  const link = (u, t) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)} ↗</a>`;
  const empty = s => `<p class="empty-panel">${esc(s)}</p>`;
  const palette = ['#d9e8c7', '#bdd3a4', '#92b47c', '#638c59', '#315d3d'];
  let bridge,
    year = '2025',
    comparison = 'NE',
    line = 'todos',
    city = '',
    dimension = 'sector',
    scope = 'PI',
    page = 0,
    lastKey = '',
    stats;
  const nodes = new Map(),
    names = new Map(Atlas.cities.map(c => [c.id, c.name]));
  let view = { x: 0, y: 0, w: 780, h: 650 },
    drag = null,
    didDrag = false;
  function cityRows() {
    return stats.pi.filter(r => r.cityId === city);
  }
  function choose(id) {
    city = id;
    scope = id ? 'city' : 'PI';
    page = 0;
    $('fneTableScope').value = scope;
    $('fneSearchResults').hidden = true;
    $('fneSearch').setAttribute('aria-expanded', 'false');
    $('fneSearch').value = '';
    renderCurrent();
  }
  function renderCurrent() {
    render({ year, comparator: comparison });
    bridge.sync();
  }
  function mount(b) {
    bridge = b;
    const ns = 'http://www.w3.org/2000/svg';
    for (const g of Atlas.geometry) {
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', g.d);
      p.setAttribute('class', 'map-path');
      p.setAttribute('role', 'button');
      p.setAttribute('tabindex', '0');
      p.dataset.fneCity = g.id;
      nodes.set(g.id, p);
      $('fnePolygons').append(p);
      p.addEventListener('click', () => {
        if (!didDrag) choose(g.id);
      });
      p.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          choose(g.id);
        }
      });
      p.addEventListener('pointermove', e => {
        if (drag) return;
        const rs = stats.pi.filter(r => r.cityId === g.id);
        const box = $('fneMapCanvas').getBoundingClientRect(),
          tip = $('fneTooltip');
        tip.innerHTML = `<b>${esc(names.get(g.id))}</b><strong>${rs.length ? compact(M.sum(rs)) : 'Sem linha'}</strong><small>${rs.length ? rs.length + ' linha(s) agregada(s)' : 'Na seleção desta base'}</small>`;
        tip.hidden = false;
        tip.style.left = Math.max(8, Math.min(e.clientX - box.left + 12, box.width - 230)) + 'px';
        tip.style.top = Math.max(8, Math.min(e.clientY - box.top + 12, box.height - 105)) + 'px';
      });
      p.addEventListener('pointerleave', () => {
        $('fneTooltip').hidden = true;
      });
    }
    $('fneLine').onchange = e => {
      line = e.target.value;
      page = 0;
      renderCurrent();
    };
    $('fneState').onclick = () => choose('');
    $('fneMethod').onclick = openSources;
    $('fneTableScope').onchange = e => {
      scope = e.target.value;
      page = 0;
      renderTable();
    };
    $('fnePrevious').onclick = () => {
      page--;
      renderTable();
    };
    $('fneNext').onclick = () => {
      page++;
      renderTable();
    };
    $('fneInternalLink').onclick = () => bridge.internal();
    $('fnePane').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.fneYear) bridge.year(b.dataset.fneYear === year ? 'todos' : b.dataset.fneYear);
      if (b.dataset.fneDimension) {
        dimension = b.dataset.fneDimension;
        renderDistribution();
      }
      if (b.dataset.fneCity) choose(b.dataset.fneCity);
      if (b.dataset.fneRecord) openRecord(b.dataset.fneRecord);
    });
    $('fneSearch').addEventListener('input', e => {
      const q = normal(e.target.value);
      const rs = q ? Atlas.cities.filter(c => normal(c.name).includes(q)).slice(0, 10) : [];
      $('fneSearchResults').innerHTML = rs.length
        ? rs.map(c => `<button data-fne-city="${c.id}">${esc(c.name)}</button>`).join('')
        : q
          ? '<p>Município não encontrado.</p>'
          : '';
      $('fneSearchResults').hidden = !q;
      e.target.setAttribute('aria-expanded', String(!!q));
    });
    $('fneSearch').addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        $('fneSearchResults').hidden = true;
        e.target.setAttribute('aria-expanded', 'false');
      }
      if (e.key === 'ArrowDown') {
        $('fneSearchResults').querySelector('button')?.focus();
        e.preventDefault();
      }
      if (e.key === 'Enter') {
        const b = $('fneSearchResults').querySelector('button');
        if (b) {
          e.preventDefault();
          choose(b.dataset.fneCity);
        }
      }
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('.search-wrap')) {
        $('fneSearchResults').hidden = true;
        $('fneSearch').setAttribute('aria-expanded', 'false');
      }
    });
    $('fneZoomIn').onclick = () => zoom(0.8);
    $('fneZoomOut').onclick = () => zoom(1.25);
    $('fneReset').onclick = () => {
      view = { x: 0, y: 0, w: 780, h: 650 };
      applyView();
    };
    const svg = $('fneMap');
    svg.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      didDrag = false;
      drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    });
    svg.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) {
        didDrag = true;
        svg.classList.add('dragging');
        $('fneTooltip').hidden = true;
        const rect = svg.getBoundingClientRect(),
          k = Math.max(view.w / rect.width, view.h / rect.height);
        view.x = drag.vx - dx * k;
        view.y = drag.vy - dy * k;
        applyView();
      }
    });
    window.addEventListener('pointerup', () => {
      drag = null;
      svg.classList.remove('dragging');
      setTimeout(() => {
        didDrag = false;
      }, 0);
    });
    svg.addEventListener(
      'wheel',
      e => {
        if (e.ctrlKey) {
          e.preventDefault();
          zoom(e.deltaY > 0 ? 1.12 : 0.89);
        }
      },
      { passive: false }
    );
  }
  function render(s) {
    year = String(s.year);
    comparison = s.comparator;
    const key = year + '|' + line + '|' + comparison;
    if (lastKey !== key) {
      page = 0;
      lastKey = key;
    }
    stats = M.statistics(D, year, line, comparison);
    $('fneTotal').textContent = stats.lines ? compact(stats.total) : 'Sem linha';
    $('fneTotalNote').textContent = stats.lines
      ? money(stats.total) + ' · nominal'
      : 'Na seleção desta base';
    $('fneCount').textContent = stats.lines.toLocaleString('pt-BR');
    $('fneCountNote').textContent = 'QTD BNB: ' + qty(stats.qUnits) + ' · ver método';
    $('fneShare').textContent = stats.share === null ? '—' : pct(stats.share);
    $('fneShareNote').textContent =
      'PI / ' +
      (comparison === 'NE' ? 'Nordeste' : 'área de atuação do FNE') +
      ' · ' +
      compact(stats.denominator);
    const size = stats.sizes[0];
    $('fneSize').textContent = size
      ? size[0].toLocaleLowerCase('pt-BR').replace(/^./, c => c.toUpperCase())
      : '—';
    $('fneSizeNote').textContent = size
      ? pct(size[1] / stats.total) + ' do valor · categoria da fonte'
      : 'Sem categoria na seleção';
    const partial = year === '2023' || year === 'todos';
    $('fneScope').textContent =
      'FNE Verde · ' +
      (line === 'todos' ? 'todas as linhas da família' : line) +
      ' · ' +
      (year === 'todos'
        ? '2021–2025, com 2023 parcial'
        : year === '2023'
          ? '2023: janeiro a setembro'
          : year + ' completo');
    $('fneMapPeriod').textContent =
      year === 'todos' ? '2021–2025*' : year === '2023' ? '2023*' : year;
    $('fneNotice').textContent = partial
      ? 'Atenção ao período: o detalhe de 2023 cobre janeiro a setembro. Os demais anos são completos. As linhas são agregadas; QTD BNB pode conter frações e não é uma contagem de contratos distintos.'
      : 'Base BNB: linhas agregadas com programa FNE Verde, incluindo MPE, Sol PF e demais linhas conforme o filtro. Não há identificação de clientes ou contratos individuais nesta publicação.';
    renderMap();
    renderFocus();
    renderAnnual();
    renderDistribution();
    renderRanking();
    renderTable();
  }
  function renderMap() {
    const amounts = new Map(M.group(stats.pi, 'cityId'));
    const positive = [...amounts.values()].filter(n => n > 0).sort((a, b) => a - b);
    const cut = [0.2, 0.4, 0.6, 0.8].map(
      q => positive[Math.max(Math.ceil(positive.length * q) - 1, 0)] || 0
    );
    const rank = n => {
      let i = 0;
      while (i < 4 && n > cut[i]) i++;
      return i;
    };
    for (const [id, p] of nodes) {
      const n = amounts.get(id);
      p.setAttribute('fill', n === undefined ? '#e2e7dc' : n > 0 ? palette[rank(n)] : '#fff9e9');
      p.classList.toggle('selected', id === city);
      p.setAttribute('aria-pressed', String(id === city));
      p.setAttribute(
        'aria-label',
        `${names.get(id)}: ${n === undefined ? 'sem linha na seleção' : money(n) + ' em linhas agregadas'}`
      );
    }
    const selected = nodes.get(city);
    if (selected) $('fnePolygons').append(selected);
    $('fneMapHint').textContent = stats.cities + ' / 224 municípios com linhas na seleção';
    let lower = 0;
    const bands = [];
    for (let i = 0; i < 5; i++) {
      const upper = i === 4 ? positive[positive.length - 1] || 0 : cut[i];
      if (upper <= lower) continue;
      bands.push(
        `<div class="legend-row"><i style="background:${palette[i]}"></i>${i === 0 ? 'Até ' : ''}${compact(upper)}</div>`
      );
      lower = upper;
    }
    $('fneLegend').innerHTML =
      '<b class="legend-title">Valor contratado · PI</b>' +
      bands.join('') +
      '<div class="legend-row"><i style="background:#e2e7dc"></i>Sem linha na seleção</div><p class="legend-note">Faixas por quintis dos valores positivos. Ausência na base não significa ausência de crédito.</p>';
  }
  function renderFocus() {
    const rs = city ? cityRows() : stats.pi;
    let html = `<h2>${city ? esc(names.get(city)) : 'Piauí'}</h2><p class="focus-sub">${city ? 'Código IBGE ' + city + ' · município publicado' : 'Visão estadual · ' + stats.cities + ' municípios com linhas'}</p><span class="city-label">CONTRATADO · ${year === 'todos' ? 'RECORTE COLETADO' : year === '2023' ? 'JAN–SET / 2023' : year}</span><strong class="focus-value">${rs.length ? compact(M.sum(rs)) : 'Sem linha'}</strong><p class="focus-caption">${rs.length ? rs.length + (rs.length === 1 ? ' linha agregada. QTD BNB: ' : ' linhas agregadas. QTD BNB: ') + qty(M.sum(rs, 'qUnits')) + '.' : 'Nenhuma linha localizada para esta seleção. A lista não mede toda a oferta de crédito.'}</p>`;
    if (rs.length) {
      const groups = M.group(rs, 'group');
      html +=
        '<div class="case-block"><span class="eyebrow">LINHAS DE FINANCIAMENTO</span>' +
        groups
          .map(
            ([name, n]) =>
              `<div class="fne-focus-row"><span>${esc(name)}</span><b>${compact(n)}</b></div>`
          )
          .join('') +
        '<p>As classificações de setor e porte são mantidas como o BNB publicou. Cada linha pode representar mais de uma contratação ou frações da medida QTD.</p></div>';
    } else
      html +=
        '<div class="case-block"><h3>O que investigar neste território?</h3><p>Há projetos em preparação e demanda por apoio? Essas informações dependem de registros locais e validação com a Investe.</p></div>';
    $('fneFocus').innerHTML = html;
  }
  function renderAnnual() {
    const all = M.select(D, 'todos', line).pi,
      years = D.years.map(r => ({
        year: r.year,
        cents: M.sum(all.filter(x => x.year === r.year))
      })),
      max = Math.max(...years.map(r => r.cents), 1);
    $('fneAnnual').innerHTML = years
      .map(
        r =>
          `<button class="annual-col ${r.year === 2023 ? 'partial-year' : ''}" data-fne-year="${r.year}" aria-pressed="${String(r.year) === year}" aria-label="FNE ${r.year}${r.year === 2023 ? ', janeiro a setembro' : ''}: ${money(r.cents)}"><b>${r.cents ? compact(r.cents) : 'Sem valor'}</b><i style="height:${Math.max((r.cents / max) * 115, 3)}px"></i><span>${r.year}${r.year === 2023 ? '*' : ''}</span></button>`
      )
      .join('');
  }
  function renderDistribution() {
    for (const b of document.querySelectorAll('[data-fne-dimension]'))
      b.setAttribute('aria-pressed', String(b.dataset.fneDimension === dimension));
    const groups = M.group(stats.pi, dimension);
    const display = groups.slice(0, 5);
    if (groups.length > 5)
      display.push(['Demais categorias', groups.slice(5).reduce((s, r) => s + r[1], 0)]);
    $('fneDistribution').innerHTML = stats.total
      ? display
          .map(
            ([name, n]) =>
              `<div class="distribution-row"><div class="distribution-label"><span>${esc(name)}</span><b>${pct(n / stats.total)}</b></div><div class="distribution-track"><i style="width:${(n / stats.total) * 100}%"></i></div></div>`
          )
          .join('')
      : empty('Sem valor na seleção para calcular a distribuição.');
  }
  function renderRanking() {
    const ranks = M.group(stats.pi, 'cityId').slice(0, 6);
    $('fneRanking').innerHTML = ranks.length
      ? ranks
          .map(
            ([id, n], i) =>
              `<button class="fne-rank" data-fne-city="${id}"><small>${String(i + 1).padStart(2, '0')}</small><span>${esc(names.get(id))}</span><b>${compact(n)}</b><i>${stats.total ? pct(n / stats.total) : '—'}</i></button>`
          )
          .join('')
      : empty('Sem linhas nesta seleção.');
    $('fneReading').textContent =
      stats.cities +
      ' municípios têm linhas nesta seleção. O próximo passo é comparar esses registros com os projetos acompanhados pela Investe e entender quais demandas avançam até um financiador.';
  }
  function renderTable() {
    const comparisonView = scope === 'comparison';
    const rows = (comparisonView ? stats.comp : scope === 'city' ? cityRows() : stats.pi)
      .slice()
      .sort((a, b) => b.cents - a.cents || b.year - a.year);
    const pages = Math.max(1, Math.ceil(rows.length / 8));
    page = Math.max(0, Math.min(page, pages - 1));
    $('fneTableHead').innerHTML = comparisonView
      ? '<tr><th>UF / ano</th><th>Programa publicado</th><th>Linhas na fonte</th><th>QTD BNB</th><th>Contratado</th><th>Fonte</th></tr>'
      : '<tr><th>Município / ano</th><th>Programa e setor publicados</th><th>Porte publicado</th><th>QTD BNB</th><th>Contratado</th><th><span class="sr-only">Evidência</span></th></tr>';
    $('fneTableCount').textContent =
      scope === 'city' && !city
        ? 'Selecione um município no mapa ou na busca.'
        : comparisonView
          ? rows.length +
            ' grupos por UF, ano e programa · ' +
            (comparison === 'NE' ? 'nove UFs do Nordeste' : 'toda a área de atuação do FNE') +
            '.'
          : rows.length +
            (rows.length === 1 ? ' linha agregada · ' : ' linhas agregadas · ') +
            (scope === 'city' ? names.get(city) : 'Piauí') +
            '. QTD BNB preservada com quatro casas; não equivale a contratos distintos.';
    $('fneTableBody').innerHTML = rows.length
      ? rows
          .slice(page * 8, page * 8 + 8)
          .map(r =>
            comparisonView
              ? `<tr><td><b>${esc(r.uf)}</b><small>${r.year}${r.year === 2023 ? ' · jan–set' : ''}</small></td><td>${esc(r.program)}</td><td>${r.lines}</td><td>${qty(r.qUnits)}</td><td>${money(r.cents)}</td><td>${link(D.sources[r.source].url, r.source)}</td></tr>`
              : `<tr><td><b>${esc(r.city)}</b><small>${r.year}${r.year === 2023 ? ' · jan–set' : ''}${r.month ? ' · mês ' + r.month : ''}</small></td><td>${esc(r.program)}<small>${esc(r.sector)}</small></td><td>${esc(r.size)}</td><td>${qty(r.qUnits)}</td><td>${money(r.cents)}</td><td><button class="row-details" data-fne-record="${esc(r.id)}" aria-label="Ver linha ${esc(r.id)}">Ver ↗</button></td></tr>`
          )
          .join('')
      : '<tr><td colspan="6">Nenhuma linha nesta seleção.</td></tr>';
    $('fnePageLabel').textContent = page + 1 + ' / ' + pages;
    $('fnePrevious').disabled = page === 0;
    $('fneNext').disabled = page === pages - 1;
  }
  function openRecord(id) {
    const r = D.rows.find(r => r.id === id);
    if (!r) return;
    $('operationBody').innerHTML =
      `<h2>${esc(r.city)} · ${r.year}${r.year === 2023 ? ' (jan–set)' : ''}</h2><p>${esc(r.program)}</p><dl><dt>Valor contratado</dt><dd>${money(r.cents)} · nominal</dd><dt>Unidade</dt><dd>Linha agregada por atributos. QTD BNB: ${qty(r.qUnits)}. Sem identificador de contrato.</dd><dt>Corte da publicação</dt><dd>${date(r.cutoff)}${r.month ? ' · mês publicado: ' + r.month : ''}. O corte não é a data individual de contratação.</dd><dt>Município na fonte</dt><dd>${esc(r.publishedCity)} / PI · IBGE ${r.cityId}</dd><dt>Setor / porte publicado</dt><dd>${esc(r.sector)} / ${esc(r.size)}</dd><dt>Atividade / produto</dt><dd>${esc(r.activity || 'Não informado')} / ${esc(r.product || 'Não informado')}</dd><dt>Finalidade</dt><dd>${esc(r.purpose || 'Não informada')}</dd><dt>Tipo de pessoa / categoria</dt><dd>${esc(r.person || 'Não informado')} / ${esc(r.category || 'Não informada')}</dd><dt>Região / setor de interesse</dt><dd>${esc(r.region || 'Não informado')} / ${esc(r.interest || 'Não informado')}</dd><dt>Grupo de leitura</dt><dd>${esc(r.group)}</dd><dt>Rastreabilidade</dt><dd>${esc(r.source)} · aba GERAL · linha ${r.sourceRow}</dd></dl><p>${link(D.sources[r.source].url, 'Abrir planilha oficial do BNB')}</p><p class="dialog-disclaimer">A publicação não identifica o tomador nem comprova participação da Investe. Quantidades fracionárias foram preservadas. Não houve rateio nem criação de contratos individuais.</p>`;
    $('operationDialog').showModal();
  }
  function openSources() {
    $('sourcesBody').innerHTML =
      `<h2>FNE Verde, com a unidade da fonte.</h2><p>Foram incorporadas 2.678 linhas agregadas do Piauí e 591 grupos por UF, ano e programa. A base foi consolidada em 10/11/2026, a partir das publicações oficiais do Banco do Nordeste e da planilha de trabalho do projeto.</p><div class="source-list">${Object.entries(
        D.sources
      )
        .filter(([k]) => k !== 'BNB_REL_2023')
        .map(
          ([id, s]) =>
            `<a href="${esc(s.url)}" target="_blank" rel="noopener"><b>${esc(id)} · corte ${date(s.cutoff)}</b><span>${esc(s.description)}</span></a>`
        )
        .join(
          ''
        )}</div><h3>O que está incluído</h3><ul><li>Seleção dos nomes de programa que começam por FNE Verde, após normalizar pontuação. São mantidos os grupos FNE Verde Sol PF, FNE Verde MPE e demais linhas. O filtro de linha afeta numerador, denominador, mapa, tabelas e distribuições.</li><li>2021, 2022, 2024 e 2025 cobrem o ano completo. O detalhe de 2023 vai até setembro; o arquivo de dezembro não foi obtido integralmente nesta coleta. O corte é identificado nos gráficos, nas tabelas e nas exportações.</li><li>Valores contratados nominais, em centavos inteiros para cálculo. QTD BNB é preservada com quatro casas: há frações na origem. Linhas não são contratos únicos, empresas ou projetos.</li><li>Os detalhes por município, setor e porte estão disponíveis para o Piauí. A comparação usa grupos por UF, ano e programa; por isso, filtros de porte e nicho do Fundo Clima não são aplicados ao FNE.</li><li>Nordeste corresponde às nove UFs. A área de atuação do FNE inclui todas as UFs presentes na publicação. Não é um denominador nacional. Nenhum valor é somado ao Fundo Clima.</li><li>O código IBGE foi associado por grafia normalizada do município, com correspondência única. A publicação não comprova a localização física do empreendimento nem a participação da Investe.</li></ul><h3>Referência anual de 2023, separada</h3><p>O Relatório de Gestão informa ${D.annualReference2023.operations.toLocaleString('pt-BR')} operações e ${money(D.annualReference2023.cents)} para o programa FNE Verde na área de atuação do FNE. A classificação do relatório é própria e não preenche os municípios ausentes no detalhe parcial. ${link(D.annualReference2023.url + '#page=40', 'Relatório BNB, p. 40 do PDF')}</p><h3>Limites para a análise de acesso</h3><p>Sem linha na fonte não significa ausência de crédito. Tipo de pessoa, categoria e porte não demonstram, isoladamente, que o beneficiário é cooperativa ou agricultor familiar. Os programas e rótulos publicados são preservados. O indicador interno depende de dados da Investe.</p><div class="method-actions"><button id="fneExportAll">Exportar todas as linhas do PI</button><button id="fneExportUFs">Exportar todos os grupos por UF</button></div><p class="dialog-disclaimer">Fonte de entrada: planilha consolidada do projeto. SHA-256: ${esc(D.workbookSha256)}. Renovagro permanece sem série estadual validada. Nenhum dado fictício foi adicionado.</p>`;
    $('fneExportAll').onclick = () => exportRows(D.rows);
    $('fneExportUFs').onclick = () => exportUFs(D.ufRows);
    $('financeSources').showModal();
  }
  function exportRows(rows) {
    if (!rows.length) {
      bridge.toast('Nenhuma linha para exportar nesta seleção.');
      return;
    }
    bridge.csv('fne_verde_pi_' + year, [
      [
        'registro_id',
        'ano',
        'corte_publicacao',
        'cobertura',
        'mes_publicado',
        'codigo_ibge',
        'municipio',
        'nome_bnb',
        'programa_publicado',
        'grupo_leitura',
        'setor_publicado',
        'porte_publicado',
        'finalidade',
        'atividade',
        'produto',
        'tipo_pessoa',
        'categoria',
        'regiao',
        'setor_interesse',
        'qtd_bnb',
        'valor_contratado_reais',
        'fonte_id',
        'linha_aba_GERAL',
        'fonte_url'
      ],
      ...rows.map(r => [
        r.id,
        r.year,
        r.cutoff,
        r.year === 2023 ? 'janeiro a setembro' : 'ano completo',
        r.month,
        r.cityId,
        r.city,
        r.publishedCity,
        r.program,
        r.group,
        r.sector,
        r.size,
        r.purpose,
        r.activity,
        r.product,
        r.person,
        r.category,
        r.region,
        r.interest,
        (r.qUnits / 10000).toFixed(4).replace('.', ','),
        (r.cents / 100).toFixed(2).replace('.', ','),
        r.source,
        r.sourceRow,
        D.sources[r.source].url
      ])
    ]);
  }
  function exportUFs(rows) {
    bridge.csv('fne_verde_ufs_' + year, [
      [
        'ano',
        'corte_publicacao',
        'uf',
        'regiao_comparacao',
        'grupo_leitura',
        'programa_publicado',
        'linhas_na_fonte',
        'qtd_bnb',
        'valor_contratado_reais',
        'fonte_id',
        'fonte_url'
      ],
      ...rows.map(r => [
        r.year,
        r.cutoff,
        r.uf,
        r.region,
        r.group,
        r.program,
        r.lines,
        (r.qUnits / 10000).toFixed(4).replace('.', ','),
        (r.cents / 100).toFixed(2).replace('.', ','),
        r.source,
        D.sources[r.source].url
      ])
    ]);
  }
  function exportSelection(type) {
    if (type === 'pi') exportRows(stats.pi);
    else if (type === 'comparison') exportUFs(stats.comp);
    else bridge.toast('Menções a projetos individuais não estão disponíveis nesta base agregada.');
  }
  function applyView() {
    $('fneMap').setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
  }
  function zoom(f) {
    const w = Math.max(156, Math.min(780, view.w * f)),
      h = (w * 650) / 780;
    view.x += (view.w - w) / 2;
    view.y += (view.h - h) / 2;
    view.w = w;
    view.h = h;
    applyView();
  }
  window.FNE_VIEW = {
    mount,
    render,
    openSources,
    export: exportSelection,
    getState() {
      return { line, city };
    },
    restore(p) {
      if ([...$('fneLine').options].some(o => o.value === p.get('line'))) {
        line = p.get('line');
        $('fneLine').value = line;
      }
      if (names.has(p.get('fneCity'))) {
        city = p.get('fneCity');
        scope = 'city';
        $('fneTableScope').value = scope;
      }
    },
    resetFocus() {
      city = '';
      line = 'todos';
      scope = 'PI';
      $('fneLine').value = 'todos';
      $('fneTableScope').value = 'PI';
    }
  };
})();
