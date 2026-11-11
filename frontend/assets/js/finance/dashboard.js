(() => {
  'use strict';
  const D = window.FINANCE_DATA,
    $ = id => document.getElementById(id),
    NE = new Set(['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE']);
  const labels = {
    todos: 'Visão integrada',
    agro: 'Agro & bioeconomia',
    energia: 'Energias renováveis',
    logistica: 'Logística de cargas'
  };
  D.catalog.find(c => c.id === 'FNE_VERDE').hasData = true;
  D.catalog.find(c => c.id === 'FNE_VERDE').note =
    'Linhas agregadas do BNB. 2021–2025, com 2023 até setembro. Sem identificação de clientes.';
  const short = { agro: 'Agro', energia: 'Renováveis', logistica: 'Logística' };
  const state = {
    sector: 'todos',
    instrument: 'FNE_VERDE',
    year: '2025',
    size: 'todos',
    comparator: 'NE',
    city: '2211209',
    pane: 'overview',
    dimension: 'sector',
    distributionScope: 'PI',
    tableScope: 'PI',
    page: 0
  };
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
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 2
    }).format(n / 100);
  function compact(n) {
    const v = n / 100;
    return (
      'R$ ' +
      new Intl.NumberFormat('pt-BR', {
        maximumFractionDigits: v >= 1e9 ? 2 : v >= 1e6 ? 1 : 0
      }).format(v >= 1e9 ? v / 1e9 : v >= 1e6 ? v / 1e6 : v >= 1e3 ? v / 1e3 : v) +
      (v >= 1e9 ? ' bi' : v >= 1e6 ? ' mi' : v >= 1e3 ? ' mil' : '')
    );
  }
  const percent = v =>
    new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      v
    ) + '%';
  const sum = rs => rs.reduce((a, r) => a + r.cents, 0),
    count = rs => new Set(rs.map(r => r.operation)).size;
  const date = v => v.split('-').reverse().join('/');
  const tags = r =>
    `<div class="niche-badges">${r.tags.map(t => `<span class="niche-badge ${t}">${short[t]}</span>`).join('')}</div>`;
  const link = (url, txt) =>
    `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(txt)} ↗</a>`;
  const instrument = () => D.catalog.find(c => c.id === state.instrument),
    period = () => (state.year === 'todos' ? '2021–2025' : state.year);
  const comparator = () => (state.comparator === 'NE' ? 'Nordeste' : 'Brasil');
  function filtered(ignoreYear = false) {
    return instrument().hasData
      ? D.rows.filter(
          r =>
            (state.sector === 'todos' ? r.tags.length > 0 : r.tags.includes(state.sector)) &&
            (ignoreYear || state.year === 'todos' || r.year === Number(state.year)) &&
            (state.size === 'todos' || r.size === state.size)
        )
      : [];
  }
  const piRows = rs => rs.filter(r => r.uf === 'PI');
  const compared = rs => (state.comparator === 'BR' ? rs : rs.filter(r => NE.has(r.uf)));
  const mentions = rs => rs.filter(r => r.uf !== 'PI' && r.piMention);
  function grouped(rs, key) {
    const out = new Map();
    for (const r of rs) {
      const k = r[key] || 'Não informado';
      out.set(k, (out.get(k) || 0) + r.cents);
    }
    return [...out].sort((a, b) => b[1] - a[1]);
  }
  function countsText(rs) {
    const a = rs.filter(r => r.grain === 'registro_operacao_automatica'),
      n = count(rs.filter(r => r.grain === 'subcredito'));
    return (
      [
        n ? `${n} contrato${n === 1 ? '' : 's'} não automático${n === 1 ? '' : 's'}` : '',
        a.length
          ? `${a.length} registro${a.length === 1 ? '' : 's'} automático${a.length === 1 ? '' : 's'}`
          : ''
      ]
        .filter(Boolean)
        .join(' + ') || 'Sem unidade contabilizada'
    );
  }
  let toastTimer;
  function toast(t) {
    $('financeToast').textContent = t;
    $('financeToast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ($('financeToast').hidden = true), 4200);
  }
  function empty(text) {
    return `<p class="empty-panel">${esc(text)}</p>`;
  }
  function noData() {
    return instrument().hasData
      ? 'Nenhum registro localizado para os filtros nesta base. Isso não mede a ausência de financiamento no mercado.'
      : 'As operações deste instrumento ainda não foram coletadas. Consulte a finalidade e a porta de entrada no catálogo.';
  }
  function configureView() {
    const fne = state.instrument === 'FNE_VERDE',
      internal = state.pane === 'internal',
      esg = state.pane === 'esg',
      hideFinance = internal || esg;
    document.body.classList.toggle('fne-active', fne);
    document.body.classList.toggle('internal-active', internal);
    document.body.classList.toggle('esg-active', esg);
    document.querySelector('.sector-tabs').hidden = fne || hideFinance;
    document.querySelector('.finance-filters').hidden = hideFinance;
    document.querySelector('main > .five-metrics').hidden = fne || hideFinance;
    document.querySelector('main > .scope-line').hidden = fne || hideFinance;
    $('sizeFilter').closest('label').hidden = fne;
    $('fneLineControl').hidden = !fne || hideFinance || state.pane === 'catalog';
    $('comparisonFilter').options[1].textContent = fne ? 'Área de atuação do FNE' : 'Brasil';
    $('yearFilter').querySelector('[value="todos"]').textContent = fne
      ? '2021–2025* (2023 parcial)'
      : '2021–2025';
    for (const o of $('yearFilter').options)
      if (o.value === '2023') o.textContent = fne ? '2023 · jan–set' : '2023';
    document.querySelector('[data-export="mentions"]').hidden = fne;
    $('instrumentFilter').value = state.instrument;
    $('yearFilter').value = state.year;
    $('comparisonFilter').value = state.comparator;
  }
  function setPane(p) {
    state.pane = p;
    configureView();
    $('overviewPane').hidden = p !== 'overview' || state.instrument === 'FNE_VERDE';
    $('fnePane').hidden = p !== 'overview' || state.instrument !== 'FNE_VERDE';
    $('internalPane').hidden = p !== 'internal';
    $('esgPane').hidden = p !== 'esg';
    $('catalogPane').hidden = p !== 'catalog';
    for (const [id, pane] of [
      ['navOverview', 'overview'],
      ['navCatalog', 'catalog'],
      ['navInternal', 'internal'],
      ['navEsg', 'esg']
    ]) {
      $(id).classList.toggle('nav-active', p === pane);
      if (p === pane) $(id).setAttribute('aria-current', 'page');
      else $(id).removeAttribute('aria-current');
    }
    urlState();
  }
  function urlState() {
    const p = new URLSearchParams();
    for (const k of ['sector', 'instrument', 'year', 'size', 'comparator', 'city'])
      p.set(k, state[k]);
    if (state.pane !== 'overview') p.set('pane', state.pane);
    if (state.instrument === 'FNE_VERDE') {
      const v = window.FNE_VIEW.getState();
      if (v.line !== 'todos') p.set('line', v.line);
      if (v.city) p.set('fneCity', v.city);
    }
    history.replaceState(null, '', '#' + p.toString());
  }
  function render() {
    configureView();
    if (state.instrument === 'FNE_VERDE') {
      window.FNE_VIEW.render(state);
      renderCatalog();
      setPane(state.pane);
      return;
    }
    const rs = filtered(),
      pi = piRows(rs),
      comp = compared(rs),
      total = sum(pi),
      denom = sum(comp),
      has = instrument().hasData;
    for (const b of document.querySelectorAll('[data-sector]'))
      b.setAttribute('aria-pressed', b.dataset.sector === state.sector);
    $('instrumentFilter').value = state.instrument;
    $('yearFilter').value = state.year;
    $('sizeFilter').value = state.size;
    $('comparisonFilter').value = state.comparator;
    $('financeTotal').textContent = has
      ? pi.length
        ? compact(total)
        : 'Sem registro'
      : 'Em coleta';
    $('financeTotalNote').textContent = pi.length
      ? `${money(total)} · nominal`
      : has
        ? 'Na seleção desta base'
        : 'Operações ainda não extraídas';
    $('financeCount').textContent = has ? (pi.length ? count(pi) : '—') : '—';
    $('financeCountNote').textContent = pi.length
      ? countsText(pi)
      : has
        ? 'Sem unidade contabilizada na seleção'
        : 'Não calculado · dados pendentes';
    $('financeShare').textContent =
      has && denom && pi.length ? percent((total / denom) * 100) : '—';
    $('financeShareNote').textContent =
      has && denom
        ? `PI / ${comparator()} · ${compact(denom)} na comparação`
        : has
          ? 'Sem denominador para os filtros'
          : 'Comparação depende da coleta';
    const sizes = grouped(pi, 'size');
    $('financeSize').textContent = sizes.length
      ? sizes[0][0].toLocaleLowerCase('pt-BR').replace(/^./, c => c.toUpperCase())
      : '—';
    $('financeSizeNote').textContent = sizes.length
      ? `${percent((sizes[0][1] / total) * 100)} do valor · classificação da fonte`
      : 'Porte não determina agricultura familiar ou cooperativa';
    $('financeMapped').textContent = D.catalog.filter(
      c => state.sector === 'todos' || c.tags.includes(state.sector)
    ).length;
    $('scopeLine').textContent =
      `${instrument().name} · ${labels[state.sector]} · ${period()} · ${state.size === 'todos' ? 'todos os portes' : state.size.toLowerCase()} · valores contratados`;
    $('financeMapPeriod').textContent = period();
    $('financeNotice').textContent = !has
      ? `${instrument().name}: dados financeiros em coleta. Os campos financeiros não foram preenchidos com zeros. O catálogo documental já pode ser consultado.`
      : pi.length
        ? 'Recorte piloto: listas públicas do Fundo Clima. Nichos podem se sobrepor; cada registro entra uma única vez no total integrado. A base não cobre todo o financiamento sustentável do Piauí.'
        : `Sem registro com UF Piauí nesta seleção do Fundo Clima. Consulte a comparação com ${comparator()} e os projetos que mencionam o estado; a ausência na base não comprova falta de crédito.`;
    renderMap(pi);
    renderFocus(pi);
    renderAnnual();
    renderDistribution(rs);
    renderInterstate(rs);
    renderTable(rs);
    renderCatalog();
    setPane(state.pane);
    urlState();
  }
  let mapNodes = new Map(),
    view = { x: 0, y: 0, w: 780, h: 650 };
  function initMap() {
    const ns = 'http://www.w3.org/2000/svg';
    for (const g of D.geometry) {
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', g.d);
      p.setAttribute('class', 'map-path');
      p.setAttribute('tabindex', '0');
      p.setAttribute('role', 'button');
      p.dataset.city = g.id;
      mapNodes.set(g.id, p);
      $('financePolygons').append(p);
      p.addEventListener('click', () => {
        if (didDrag) return;
        chooseCity(g.id);
      });
      p.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          chooseCity(g.id);
        }
      });
      p.addEventListener('pointermove', e => {
        if (drag) return;
        const city = D.cities.find(c => c.id === g.id);
        const rs = piRows(filtered()).filter(r => r.cityId === g.id);
        const box = $('financeMapCanvas').getBoundingClientRect(),
          tip = $('financeTooltip');
        tip.innerHTML = `<b>${esc(city?.name || g.id)}</b><small>${rs.length ? compact(sum(rs)) + ' · município informado' : 'Sem registro nesta seleção'}</small>`;
        tip.hidden = false;
        tip.style.left = Math.max(8, Math.min(e.clientX - box.left + 14, box.width - 240)) + 'px';
        tip.style.top = Math.max(8, Math.min(e.clientY - box.top + 12, box.height - 85)) + 'px';
      });
      p.addEventListener('pointerleave', () => {
        $('financeTooltip').hidden = true;
      });
    }
  }
  function renderMap(pi) {
    const byCity = new Map(grouped(pi, 'cityId'));
    for (const [id, p] of mapNodes) {
      const city = D.cities.find(c => c.id === id);
      p.setAttribute('fill', byCity.has(id) ? '#396a46' : '#e2e7dc');
      p.classList.toggle('selected', id === state.city);
      p.setAttribute('aria-pressed', String(id === state.city));
      p.setAttribute(
        'aria-label',
        `${city?.name || id}: ${byCity.has(id) ? compact(byCity.get(id)) + ' contratado, município informado' : 'sem registro nesta seleção'}`
      );
    }
    const selected = mapNodes.get(state.city);
    if (selected) $('financePolygons').append(selected);
    $('financeMapHint').textContent = instrument().hasData
      ? `${new Set(pi.map(r => r.cityId).filter(Boolean)).size} município(s) com registro localizado nesta seleção`
      : 'Dados financeiros deste instrumento em coleta';
  }
  function chooseCity(id) {
    state.city = id;
    $('financeSearch').value = '';
    $('financeSearchResults').hidden = true;
    $('financeSearch').setAttribute('aria-expanded', 'false');
    render();
  }
  function renderFocus(pi) {
    const city = D.cities.find(c => c.id === state.city),
      rs = state.city ? pi.filter(r => r.cityId === state.city) : pi;
    let html = `<h2>${city ? esc(city.name) : 'Piauí'}</h2><p class="focus-sub">${city ? 'Código IBGE ' + esc(city.id) + ' · município informado' : 'Registros com UF Piauí'}</p>`;
    if (!rs.length) {
      html += `<span class="city-label">${instrument().hasData ? 'NA SELEÇÃO DESTA BASE' : 'COLETA PENDENTE'}</span><strong class="focus-value">${instrument().hasData ? 'Sem registro' : 'Em coleta'}</strong><p class="focus-caption">${esc(noData())}</p><div class="case-block"><span class="eyebrow">PERGUNTA PARA A INVESTE</span><h3>O que a lista ainda não revela?</h3><p>Quais projetos deste território estão em preparação? Quais barreiras de acesso precisam ser investigadas com os proponentes e financiadores?</p><button class="focus-action" id="focusCompare">Explorar a comparação ↗</button></div>`;
    } else {
      html += `<span class="city-label">VALOR CONTRATADO · ${esc(period())}</span><strong class="focus-value">${compact(sum(rs))}</strong><p class="focus-caption">${esc(countsText(rs))}. Valores nominais.</p>`;
      const bio = rs.find(r => r.id === 'FC_AUTOMATICAS:383');
      if (bio) {
        html += `<div class="case-block"><span class="eyebrow">UMA OPERAÇÃO, DOIS NICHOS</span><h3>Agro e energia se encontram em Uruçuí.</h3>${tags(bio)}<p>O BNDES descreve cogeração por biomassa para o complexo de etanol, DDGS e óleo de milho da Brasbio. A mesma operação participa dos dois nichos e é contada uma vez na visão integrada.</p>${link(D.evidenceUrl, 'Evidência BNDES · PDF, p. 156')}<br><button data-record="${bio.id}">Abrir registro financeiro ↗</button></div>`;
      } else {
        html += rs
          .slice(0, 3)
          .map(
            r =>
              `<div class="case-block"><h3>${esc(r.client)}</h3>${tags(r)}<button data-record="${esc(r.id)}">Ver evidência ↗</button></div>`
          )
          .join('');
      }
    }
    $('financeFocus').innerHTML = html;
    $('focusCompare')?.addEventListener('click', () => {
      state.tableScope = 'comparison';
      $('tableScope').value = 'comparison';
      state.page = 0;
      renderTable(filtered());
      $('financeTable').closest('section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  function renderAnnual() {
    const pi = piRows(filtered(true)),
      max = Math.max(
        ...[2021, 2022, 2023, 2024, 2025].map(y => sum(pi.filter(r => r.year === y))),
        1
      );
    $('annualChart').innerHTML = instrument().hasData
      ? [2021, 2022, 2023, 2024, 2025]
          .map(y => {
            const a = pi.filter(r => r.year === y),
              v = sum(a);
            return `<button class="annual-col" data-year="${y}" aria-label="${y}: ${a.length ? money(v) : 'sem registro'}" aria-pressed="${String(state.year) === String(y)}"><b>${a.length ? compact(v) : ''}</b>${a.length ? `<i style="height:${Math.max((v / max) * 115, 3)}px"></i>` : '<small>Sem<br>registro</small><i style="height:3px;background:#e2e7dc"></i>'}<span>${y}</span></button>`;
          })
          .join('')
      : empty('Série financeira em coleta para este instrumento.');
  }
  function renderDistribution(rs) {
    const data = state.distributionScope === 'PI' ? piRows(rs) : compared(rs),
      groups = grouped(data, state.dimension),
      total = sum(data);
    for (const b of document.querySelectorAll('[data-dimension]'))
      b.setAttribute('aria-pressed', b.dataset.dimension === state.dimension);
    if (!groups.length) {
      $('distributionChart').innerHTML = empty(noData());
      return;
    }
    const display = groups.slice(0, 5);
    if (groups.length > 5)
      display.push(['Demais categorias', groups.slice(5).reduce((a, r) => a + r[1], 0)]);
    $('distributionChart').innerHTML = display
      .map(
        ([name, n]) =>
          `<div class="distribution-row"><div class="distribution-label"><span>${esc(name)}</span><b>${percent((n / total) * 100)}</b></div><div class="distribution-track"><i style="width:${(n / total) * 100}%"></i></div></div>`
      )
      .join('');
  }
  function renderInterstate(rs) {
    const ms = mentions(rs),
      groups = new Map();
    for (const r of ms) {
      if (!groups.has(r.operation)) groups.set(r.operation, []);
      groups.get(r.operation).push(r);
    }
    $('interstateCount').textContent = groups.size
      ? `${groups.size} contrato(s) localizado(s)`
      : 'Sem registro na seleção';
    $('interstateCards').innerHTML = groups.size
      ? [...groups]
          .map(
            ([id, rows]) =>
              `<article class="interstate-card"><span class="eyebrow">UF PUBLICADA: ${esc([...new Set(rows.map(r => r.uf))].join(', '))} · ${rows[0].year}</span><h3>${esc(D.interstateTitles[id] || rows[0].client)}</h3><strong class="project-amount">${compact(sum(rows))}</strong><p>Valor integral dos ${rows.length} subcrédito(s) selecionado(s) deste contrato · vários estados.</p><p class="allocation-note"><b>Parcela destinada ao Piauí: não informada.</b><br>Excluído do valor contratado com UF Piauí.</p><button data-group="${esc(id)}">Ler descrição e subcréditos ↗</button></article>`
          )
          .join('')
      : empty(
          instrument().hasData
            ? 'Nenhuma menção ao Piauí em registros de outras UFs / IE para estes filtros. A busca se restringe às descrições publicadas.'
            : 'A identificação de projetos depende da coleta das operações.'
        );
  }
  function renderTable(rs) {
    const data = (state.tableScope === 'PI' ? piRows(rs) : compared(rs))
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date) || b.cents - a.cents),
      pages = Math.max(Math.ceil(data.length / 8), 1);
    state.page = Math.min(state.page, pages - 1);
    $('tableCount').textContent = data.length
      ? `${data.length} linha${data.length === 1 ? '' : 's'} · ${countsText(data)} · ${state.tableScope === 'PI' ? 'UF Piauí' : comparator()}. Contratos diretos podem ter vários subcréditos.`
      : noData();
    $('financeTable').innerHTML = data.length
      ? data
          .slice(state.page * 8, state.page * 8 + 8)
          .map(
            r =>
              `<tr><td><b>${esc(r.client)}</b><small>${esc(r.id)} · ${r.grain === 'subcredito' ? 'subcrédito' : 'registro automático'}</small></td><td>${esc(r.uf)}<small>${esc(r.city || 'Município não informado')}</small></td><td>${date(r.date)}</td><td>${money(r.cents)}</td><td>${tags(r)}</td><td><button class="row-details" data-record="${esc(r.id)}" aria-label="Ver registro ${esc(r.id)}">Ver ↗</button></td></tr>`
          )
          .join('')
      : '<tr><td colspan="6">Nenhuma linha disponível para esta seleção.</td></tr>';
    $('pageLabel').textContent = `${state.page + 1} / ${pages}`;
    $('previousPage').disabled = state.page === 0;
    $('nextPage').disabled = state.page >= pages - 1;
  }
  function renderCatalog() {
    const cs = D.catalog.filter(
      c =>
        state.instrument === 'FNE_VERDE' ||
        state.sector === 'todos' ||
        c.tags.includes(state.sector)
    );
    $('catalogCards').innerHTML = cs
      .map(
        c =>
          `<article class="catalog-card"><span class="eyebrow">${esc(c.institution)}</span><h3>${esc(c.name)}</h3><p>${esc(c.type)}</p><span class="catalog-status ${c.hasData ? '' : 'pending'}">${c.id === 'FNE_VERDE' ? 'Linhas coletadas · 2023 parcial' : c.hasData ? 'Operações coletadas · 2021–2025' : 'Série do PI ainda não validada'}${c.id === 'RENOVAGRO' ? ' · vigência a confirmar' : ''}</span>${tags(c)}<dl><dt>Finalidade</dt><dd>${esc(c.purpose)}</dd><dt>Público a verificar</dt><dd>${esc(c.audience)}</dd><dt>Porta de entrada</dt><dd>${esc(c.entry)}</dd><dt>Requisitos a verificar</dt><dd>${esc(c.requirements)}</dd></dl>${c.id === 'RENOVAGRO' ? '<p>A página consultada contém aviso de expiração e prazo de vigência até 30/06/2027. Confirmar a condição vigente com a instituição.</p>' : '<p>Condições e disponibilidade na data do projeto precisam ser confirmadas.</p>'}${c.id === 'FNE_VERDE' ? '<p>Dados agregados por município, setor e porte. MPE, Sol PF e demais linhas separados. 2023: janeiro a setembro.</p>' : ''}${link(c.url, 'Consultar fonte oficial')}<br><button class="solid-button" data-instrument="${c.id}">${c.hasData ? 'Explorar operações' : 'Ver situação da coleta'} →</button></article>`
      )
      .join('');
  }
  function openRecord(id) {
    const r = D.rows.find(x => x.id === id);
    if (!r) return;
    $('operationBody').innerHTML =
      `<h2>${esc(r.client)}</h2>${tags(r)}<dl><dt>Valor contratado</dt><dd>${money(r.cents)} · nominal</dd><dt>Contratação</dt><dd>${date(r.date)}</dd><dt>UF / município publicado</dt><dd>${esc(r.uf)} / ${esc(r.city || 'Não informado')} · não confirma a localização física</dd><dt>Porte / setor original</dt><dd>${esc(r.size)} / ${esc(r.sector)}</dd><dt>CNAE publicado</dt><dd>${esc(r.cnae)} · ${esc(r.activity)}</dd><dt>Finalidade publicada</dt><dd>${esc(r.purpose || 'Não informada')}</dd><dt>Unidade da linha</dt><dd>${r.grain === 'subcredito' ? 'Subcrédito de contrato não automático' : 'Registro de operação automática; identificador da operação não publicado'}</dd><dt>Contrato / identificador local</dt><dd>${esc(r.contract || r.id)} · linha ${r.sourceRow} da fonte</dd></dl><h3>Descrição do projeto na lista</h3><p class="record-description">${esc(r.description || 'A lista automática não publica descrição do projeto para este registro.')}</p>${r.uf !== 'PI' && r.piMention ? '<p><b>O Piauí é citado na descrição, mas o valor destinado ao estado não é informado. O valor integral não entra nos indicadores do PI.</b></p>' : ''}<h3>Por que está neste nicho?</h3><ul>${r.rules.map(id => `<li>${esc(id)} · ${esc(D.rules.find(x => x.id === id)?.description || '')}</li>`).join('')}</ul>${r.evidenceUrls.map(u => `<p>${link(u, 'Evidência complementar BNDES · p. 156')}</p>`).join('')}<p>${link(D.sourceUrls[r.source], `Lista BNDES · linha ${r.sourceRow}`)}</p><p class="dialog-disclaimer">Registro local: ${esc(r.id)}. Enquadramento analítico revisável; não constitui parecer de elegibilidade, prioridade de investimento ou impacto comprovado.</p>`;
    $('operationDialog').showModal();
  }
  function openGroup(id) {
    const rows = mentions(filtered()).filter(r => r.operation === id);
    if (!rows.length) return;
    $('operationBody').innerHTML =
      `<h2>${esc(D.interstateTitles[id] || 'Contrato interestadual')}</h2><p><b>${money(sum(rows))}</b> nos subcréditos desta seleção. O valor cobre vários estados; parcela do Piauí não informada.</p><p>Contrato ${esc(rows[0].contract)} · ${esc(rows[0].client)}.</p>${rows.map(r => `<h3>${esc(r.id)} · ${money(r.cents)} · ${date(r.date)}</h3><p class="record-description">${esc(r.description)}</p><p>${link(D.sourceUrls[r.source], `Fonte BNDES · linha ${r.sourceRow}`)}</p>`).join('')}<p class="dialog-disclaimer">Cada subcrédito publicado é preservado. Menções a outras operações/produtos na descrição não são somadas sem conciliação documental.</p>`;
    $('operationDialog').showModal();
  }
  function openSources() {
    if (state.pane === 'internal') {
      $('sourcesBody').innerHTML =
        '<h2>Indicador interno aprovado.</h2><p>Taxa de encaminhamento: projetos da mesma coorte formalmente encaminhados pela Investe até a data de corte, divididos pelos projetos com demanda registrada na coorte.</p><h3>Condições para apurar</h3><ul><li>Validar o papel da Investe no fluxo e a disponibilidade dos registros com a instituição.</li><li>Definir início e fim da coorte e a data de corte.</li><li>Contar identificadores únicos de projetos com demanda documentada.</li><li>Exigir informação de encaminhamento e uma data válida quando houver envio formal.</li><li>Encaminhamento é uma etapa distinta de aprovação ou desembolso.</li></ul><p>A planilha consolidada já contém os campos e a fórmula. Esta tela não recebeu registros internos, não apresenta percentual estimado nem utiliza dados fictícios.</p>';
      $('financeSources').showModal();
      return;
    }
    if (state.instrument === 'FNE_VERDE') {
      window.FNE_VIEW.openSources();
      return;
    }
    const mapped = D.rows.filter(r => r.tags.length);
    $('sourcesBody').innerHTML =
      `<h2>Uma base pequena pode fazer perguntas melhores.</h2><p>Este piloto reúne operações do <b>Fundo Clima</b> contratadas entre 2021 e 2025, mais um catálogo de três instrumentos. Não representa a totalidade do financiamento sustentável do Piauí.</p><div class="source-list">${Object.entries(
        D.sourceUrls
      )
        .map(
          ([id, u]) =>
            `<a href="${esc(u)}" target="_blank" rel="noopener"><b>BNDES · ${id === 'FC_AUTOMATICAS' ? 'operações automáticas' : 'operações não automáticas'}</b><span>${esc(D.sourceDates[id])} · planilha oficial preservada</span></a>`
        )
        .join(
          ''
        )}<a href="${esc(D.evidenceUrl)}" target="_blank" rel="noopener"><b>BNDES · Relatório Anual Integrado 2025</b><span>Página 156 do PDF · evidência complementar para a Brasbio</span></a></div><h3>Universo, período e unidades</h3><ul><li>${D.rows.length} linhas com data de contratação em 2021–2025. ${mapped.length} receberam pelo menos um dos três nichos. Coleta consolidada em 26/10/2026; as planilhas refletem suas próprias datas de apuração.</li><li>Valores contratados nominais, em reais. Não são desembolsos anuais nem valores ajustados pela inflação.</li><li>Não automáticas: linhas de subcrédito somadas em valor e contratos distintos para a contagem. Automáticas: registros de operação sem identificador público. O indicador combina as duas unidades e informa sua composição.</li><li>Contagens de contratos distintos não são necessariamente aditivas entre anos, estados ou nichos. Não equivalem a número de clientes ou projetos.</li><li>As listas possuem exclusões: pessoas físicas e Cartão BNDES na automática; subcréditos complementares na não automática. Linhas semelhantes foram preservadas porque não há prova de duplicação.</li></ul><h3>Território e comparação</h3><ul><li>O indicador do Piauí usa exclusivamente a UF PI publicada. O município informado não comprova a localização física da planta.</li><li>Nordeste: apenas as nove UFs da região. IE e UFs externas sem rateio não são atribuídas ao PI ou ao Nordeste. Brasil: todos os registros do recorte, incluindo interestaduais (IE).</li><li>Numerador e denominador têm o mesmo instrumento, período, porte e nicho. Cada linha entra uma única vez na visão integrada. Projetos que mencionam PI, com outra UF / IE, ficam em seção separada.</li><li>Sem registro significa ausência na lista filtrada; em coleta significa base ainda não obtida. Não se infere crédito zero no mercado, demanda reprimida ou dificuldade de acesso apenas desses resultados.</li></ul><h3>Três nichos, com sobreposição explícita</h3><p>Classificação por atividade CNAE e texto publicado, com revisão documental identificada. Agro inclui produção, agroindústria e bioenergia de origem agrícola. Logística deste piloto cobre cargas e armazenagem; passageiros sem evidência de carga ficam fora. A visão integrada é a união dos nichos, não a soma dos subtotais.</p><ul>${D.rules.map(r => `<li><b>${esc(r.id)}</b>: ${esc(r.description)}</li>`).join('')}</ul><div class="method-actions"><button id="exportFull">Baixar base completa · 313 linhas</button><button id="exportRules">Baixar regras de enquadramento</button></div><h3>Instrumentos e limites da análise</h3><p>FNE Verde tem uma visão própria com linhas agregadas do BNB e 2023 parcial. Renovagro permanece sem série estadual validada. As bases são analisadas separadamente. Os três instrumentos são de crédito; fundos de investimento ESG/impacto ainda serão investigados. Finalidades e nichos do catálogo são pistas de aderência, não garantia de elegibilidade, vigência, disponibilidade ou aprovação. O catálogo é filtrado apenas pelo nicho, independentemente do instrumento, ano e porte selecionados.</p><p>A identificação de agricultura familiar, cooperativas, garantias, preparação de projetos e barreiras de acesso depende de dados adicionais e validação com a Investe. Os registros atuais não permitem medir esses pontos.</p><p>Mapa: malha municipal IBGE 2024 simplificada, mantida entre os anos; não representa mudanças territoriais.</p><p class="dialog-disclaimer">Protótipo acadêmico para discussão. Não é um produto oficial da Investe Piauí. Não calcula ranking de investimento, impacto ambiental ou elegibilidade de proponentes.</p>`;
    $('exportFull').onclick = () => downloadRows(D.rows, 'base_completa_classificada_2021_2025');
    $('exportRules').onclick = () =>
      downloadCsv('regras_de_enquadramento', [
        ['regra', 'nicho', 'criterio'],
        ...D.rules.map(r => [r.id, r.sector, r.description])
      ]);
    $('financeSources').showModal();
  }
  function downloadCsv(name, rows) {
    const text =
      '\uFEFF' +
      rows
        .map(row => row.map(x => '"' + String(x ?? '').replace(/"/g, '""') + '"').join(';'))
        .join('\r\n');
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' }),
      a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name + '.csv';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('CSV gerado com os registros e identificadores de fonte.');
  }
  function downloadRows(rs, name) {
    if (!rs.length) {
      toast('Nenhum registro para exportar nesta seleção.');
      return;
    }
    downloadCsv(name, [
      [
        'registro_id',
        'operacao_id',
        'contrato_publicado',
        'unidade_registro',
        'cliente',
        'data_contratacao',
        'uf_informada',
        'municipio_informado',
        'codigo_ibge',
        'valor_contratado_reais',
        'setor_publicado',
        'cnae',
        'atividade_publicada',
        'porte_publicado',
        'finalidade_publicada',
        'nichos_analiticos',
        'regras',
        'pi_mencionado_descricao',
        'descricao_publicada',
        'fonte_url',
        'linha_fonte',
        'evidencia_complementar'
      ],
      ...rs.map(r => [
        r.id,
        r.operation,
        r.contract,
        r.grain,
        r.client,
        r.date,
        r.uf,
        r.city,
        r.cityId,
        (r.cents / 100).toFixed(2).replace('.', ','),
        r.sector,
        r.cnae,
        r.activity,
        r.size,
        r.purpose,
        r.tags.join('|'),
        r.rules.join('|'),
        r.piMention ? 'sim' : 'não',
        r.description,
        D.sourceUrls[r.source],
        r.sourceRow,
        r.evidenceUrls.join('|')
      ])
    ]);
  }
  function exportSelection(type) {
    $('exportOptions').hidden = true;
    $('financeExport').setAttribute('aria-expanded', 'false');
    if (state.instrument === 'FNE_VERDE' && type !== 'catalog') {
      window.FNE_VIEW.export(type);
      return;
    }
    if (type === 'catalog') {
      const cs = D.catalog.filter(
        c =>
          state.instrument === 'FNE_VERDE' ||
          state.sector === 'todos' ||
          c.tags.includes(state.sector)
      );
      downloadCsv('catalogo_instrumentos', [
        [
          'instrumento',
          'instituicao',
          'tipo',
          'nichos',
          'finalidade',
          'publico',
          'porta_entrada',
          'requisitos_a_verificar',
          'status_documental',
          'operacoes_coletadas',
          'fonte'
        ],
        ...cs.map(c => [
          c.name,
          c.institution,
          c.type,
          c.tags.join('|'),
          c.purpose,
          c.audience,
          c.entry,
          c.requirements,
          c.status,
          c.hasData ? 'sim' : 'não',
          c.url
        ])
      ]);
      return;
    }
    const rs = filtered();
    downloadRows(
      type === 'pi' ? piRows(rs) : type === 'comparison' ? compared(rs) : mentions(rs),
      `${type}_${state.instrument}_${state.sector}_${period()}`
    );
  }
  let tour = -1;
  const tours = [
    {
      title: 'Mais municípios, com dados reais.',
      copy: 'A base do FNE Verde acrescenta 2.678 linhas agregadas do Piauí e alcança 156 municípios nos cortes coletados. Explore o mapa de 2025. O detalhe de 2023 é parcial e fica identificado.'
    },
    {
      title: 'Citar o Piauí não é financiar só o Piauí.',
      copy: 'O Fundo Clima permanece disponível. Dois contratos solares incluem o estado na descrição, mas os valores cobrem vários estados. A parcela destinada ao Piauí não foi publicada.'
    },
    {
      title: 'Uma perspectiva de dentro da Investe.',
      copy: 'O sexto indicador acompanha o avanço da demanda até o encaminhamento formal. A estrutura está preparada e aguarda os registros internos da instituição.'
    }
  ];
  function showTour(n) {
    if (n > 2) {
      closeTour();
      return;
    }
    tour = Math.max(0, n);
    Object.assign(state, {
      instrument: tour === 1 ? 'FUNDO_CLIMA' : 'FNE_VERDE',
      year: tour === 1 ? 'todos' : '2025',
      size: 'todos',
      sector: tour === 1 ? 'energia' : 'todos',
      city: '2211209',
      pane: tour === 2 ? 'internal' : 'overview'
    });
    if (tour === 0) window.FNE_VIEW.resetFocus();
    if (tour === 1) {
      document.body.classList.remove('presentation-mode');
      $('presentButton').setAttribute('aria-pressed', 'false');
    }
    render();
    $('financeTour').hidden = false;
    $('financeTourCounter').textContent = 'LEITURA ' + (tour + 1) + ' DE 3';
    $('financeTourTitle').textContent = tours[tour].title;
    $('financeTourCopy').textContent = tours[tour].copy;
    $('financeTourDots').innerHTML = tours
      .map((_, i) => '<i class="' + (i === tour ? 'active' : '') + '"></i>')
      .join('');
    $('financeTourPrevious').disabled = tour === 0;
    $('financeTourNext').textContent = tour === 2 ? 'Concluir roteiro' : 'Próxima leitura →';
    (tour === 1
      ? $('interstateSection')
      : tour === 2
        ? $('internalPane')
        : $('fneMapCanvas').closest('section')
    ).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function closeTour() {
    tour = -1;
    $('financeTour').hidden = true;
  }
  for (const s of [...new Set(D.rows.map(r => r.size))].sort()) {
    const o = document.createElement('option');
    o.value = s;
    o.textContent = s;
    $('sizeFilter').append(o);
  }
  try {
    const p = new URLSearchParams(location.hash.slice(1));
    if (Object.keys(labels).includes(p.get('sector'))) state.sector = p.get('sector');
    if (D.catalog.some(c => c.id === p.get('instrument'))) state.instrument = p.get('instrument');
    if (['todos', '2021', '2022', '2023', '2024', '2025'].includes(p.get('year')))
      state.year = p.get('year');
    if (['todos', ...D.rows.map(r => r.size)].includes(p.get('size'))) state.size = p.get('size');
    if (['NE', 'BR'].includes(p.get('comparator'))) state.comparator = p.get('comparator');
    if (D.cities.some(c => c.id === p.get('city'))) state.city = p.get('city');
    if (['internal', 'catalog', 'esg'].includes(p.get('pane'))) state.pane = p.get('pane');
    window.FNE_VIEW.restore(p);
  } catch {}
  for (const [id, key] of [
    ['instrumentFilter', 'instrument'],
    ['yearFilter', 'year'],
    ['sizeFilter', 'size'],
    ['comparisonFilter', 'comparator']
  ])
    $(id).addEventListener('change', e => {
      state[key] = e.target.value;
      state.page = 0;
      render();
    });
  document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.sector) {
      state.sector = b.dataset.sector;
      state.page = 0;
      render();
    }
    if (b.dataset.dimension) {
      state.dimension = b.dataset.dimension;
      renderDistribution(filtered());
    }
    if (b.dataset.record) openRecord(b.dataset.record);
    if (b.dataset.group) openGroup(b.dataset.group);
    if (b.dataset.year) {
      state.year = state.year === b.dataset.year ? 'todos' : b.dataset.year;
      state.page = 0;
      render();
    }
    if (b.dataset.export) exportSelection(b.dataset.export);
    if (b.dataset.instrument) {
      state.instrument = b.dataset.instrument;
      state.pane = 'overview';
      state.page = 0;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
  $('navEsg').onclick = () => {
    closeTour();
    setPane('esg');
    window.scrollTo({ top: 0 });
  };
  $('navInternal').onclick = () => setPane('internal');
  $('navOverview').onclick = () => setPane('overview');
  $('navCatalog').onclick = () => {
    renderCatalog();
    setPane('catalog');
  };
  for (const id of ['navSources', 'scopeMethod', 'financeFooterSources'])
    $(id).onclick = openSources;
  $('closeFinanceSources').onclick = () => $('financeSources').close();
  $('closeOperation').onclick = () => $('operationDialog').close();
  for (const id of ['financeSources', 'operationDialog'])
    $(id).addEventListener('click', e => {
      if (e.target === $(id)) {
        const box = $(id).getBoundingClientRect();
        if (
          e.clientX < box.left ||
          e.clientX > box.right ||
          e.clientY < box.top ||
          e.clientY > box.bottom
        )
          $(id).close();
      }
    });
  $('distributionScope').onchange = e => {
    state.distributionScope = e.target.value;
    renderDistribution(filtered());
  };
  $('tableScope').onchange = e => {
    state.tableScope = e.target.value;
    state.page = 0;
    renderTable(filtered());
  };
  $('previousPage').onclick = () => {
    state.page--;
    renderTable(filtered());
  };
  $('nextPage').onclick = () => {
    state.page++;
    renderTable(filtered());
  };
  $('financeExport').onclick = () => {
    const open = $('exportOptions').hidden;
    $('exportOptions').hidden = !open;
    $('financeExport').setAttribute('aria-expanded', String(open));
  };
  document.addEventListener('click', e => {
    if (!e.target.closest('.export-wrap')) {
      $('exportOptions').hidden = true;
      $('financeExport').setAttribute('aria-expanded', 'false');
    }
  });
  $('focusState').onclick = () => {
    state.city = '';
    render();
  };
  $('financeSearch').addEventListener('input', e => {
    const q = normal(e.target.value),
      matches = q ? D.cities.filter(c => normal(c.name).includes(q)).slice(0, 10) : [];
    $('financeSearchResults').innerHTML = matches.length
      ? matches.map(c => `<button data-city="${c.id}">${esc(c.name)}</button>`).join('')
      : q
        ? '<p>Município não encontrado.</p>'
        : '';
    $('financeSearchResults').hidden = !q;
    e.target.setAttribute('aria-expanded', String(!!q));
  });
  $('financeSearchResults').onclick = e => {
    const b = e.target.closest('[data-city]');
    if (b) chooseCity(b.dataset.city);
  };
  $('financeSearch').addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      $('financeSearchResults').hidden = true;
      e.target.setAttribute('aria-expanded', 'false');
    }
    if (e.key === 'ArrowDown') {
      $('financeSearchResults').querySelector('button')?.focus();
      e.preventDefault();
    }
    if (e.key === 'Enter') {
      const b = $('financeSearchResults').querySelector('button');
      if (b) {
        e.preventDefault();
        chooseCity(b.dataset.city);
      }
    }
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) {
      $('financeSearchResults').hidden = true;
      $('financeSearch').setAttribute('aria-expanded', 'false');
    }
  });
  $('financeTourButton').onclick = () => showTour(0);
  $('financeTourPrevious').onclick = () => showTour(tour - 1);
  $('financeTourNext').onclick = () => showTour(tour + 1);
  $('financeTourClose').onclick = closeTour;
  $('presentButton').onclick = async () => {
    const active = document.body.classList.toggle('presentation-mode');
    $('presentButton').setAttribute('aria-pressed', String(active));
    try {
      if (active && !document.fullscreenElement) await document.documentElement.requestFullscreen();
      else if (!active && document.fullscreenElement) await document.exitFullscreen();
    } catch {
      toast('Modo de apresentação ativado. Use a tela cheia do navegador se desejar.');
    }
  };
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      document.body.classList.remove('presentation-mode');
      $('presentButton').setAttribute('aria-pressed', 'false');
    }
  });
  $('contextLink').onclick = e => {
    if (window.FIN_CONTEXT_OFFLINE) {
      e.preventDefault();
      const blob = new Blob([window.FIN_CONTEXT_OFFLINE], { type: 'text/html' }),
        url = URL.createObjectURL(blob);
      const opened = window.open(url, '_blank');
      if (!opened) toast('Permita abrir uma nova aba para consultar o mapa produtivo offline.');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  };
  function applyView() {
    $('financeMap').setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
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
  $('financeZoomIn').onclick = () => zoom(0.8);
  $('financeZoomOut').onclick = () => zoom(1.25);
  $('financeReset').onclick = () => {
    view = { x: 0, y: 0, w: 780, h: 650 };
    applyView();
  };
  let drag = null,
    didDrag = false;
  const svg = $('financeMap');
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
      $('financeTooltip').hidden = true;
      const box = svg.getBoundingClientRect(),
        scale = Math.max(view.w / box.width, view.h / box.height);
      view.x = drag.vx - dx * scale;
      view.y = drag.vy - dy * scale;
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
  window.FNE_VIEW.mount({
    year: y => {
      state.year = y;
      render();
    },
    internal: () => setPane('internal'),
    csv: downloadCsv,
    toast,
    sync: urlState
  });
  initMap();
  render();
})();
