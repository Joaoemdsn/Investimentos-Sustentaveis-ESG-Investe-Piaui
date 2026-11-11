(() => {
  'use strict';
  const D = window.ATLAS_DATA;
  const $ = id => document.getElementById(id);
  if (!D) {
    document.body.innerHTML =
      '<main><h1>Não foi possível carregar os dados.</h1><p>Atualize a página para tentar novamente.</p></main>';
    return;
  }
  const cities = D.cities,
    acts = new Map(D.activities.map(a => [a.id, a])),
    cityIndex = new Map(cities.map((c, i) => [c.id, i]));
  const sourceNames = {
    pam: 'PAM · lavouras',
    ppm: 'PPM · produtos animais',
    pevs: 'PEVS · extração vegetal'
  };
  const sourceShort = { pam: 'Lavouras', ppm: 'Produtos animais', pevs: 'Extração vegetal' };
  const statusLabels = [
    'Valor publicado',
    'Zero absoluto',
    'Zero calculado ou arredondado',
    'Dado não disponível',
    'Valor protegido por sigilo',
    'Não se aplica'
  ];
  const palette = ['#dce8bc', '#b6ce91', '#86ac68', '#557d46', '#274f35'];
  const moneyLong = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0
  });
  const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
  const esc = v =>
    String(v).replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const label = a => {
    if (a.id.endsWith(':0'))
      return { pam: 'Lavouras', ppm: 'Produtos de origem animal', pevs: 'Extração vegetal' }[
        a.source
      ];
    const name = a.label.replace(/^\d+(?:\.\d+)?\s*-\s*/, '').replace(/\*$/, '');
    return /^(Outras|Outros)$/.test(name) && a.parentLabel
      ? name + ' · ' + a.parentLabel.replace(/^\d+\s*-\s*/, '')
      : name;
  };
  const norm = s =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  function money(v, full = false) {
    if (v === null || v === undefined) return '—';
    if (full) return moneyLong.format(v * 1000);
    if (v >= 1e6) return 'R$ ' + decimal.format(v / 1e6) + ' bi';
    if (v >= 1e3) return 'R$ ' + decimal.format(v / 1e3) + ' mi';
    if (v > 0) return 'R$ ' + decimal.format(v) + ' mil';
    return 'R$ 0';
  }
  const pct = v => (v === null || !Number.isFinite(v) ? '—' : percent.format(v));
  const defaultCity = cities.find(c => c.name === 'São Raimundo Nonato').id;
  const state = { activity: 'ppm:2687', year: 2025, metric: 'value', city: defaultCity, tour: -1 };
  let ctx,
    view = { x: 0, y: 0, w: 780, h: 650 },
    drag = null,
    toastTimer;

  // Same statistical universe and year for every sum, rank and participation.
  function statistics(id, year) {
    const a = acts.get(id),
      offset = (year - 2021) * 224,
      v = a.v.slice(offset, offset + 224),
      s = a.s.slice(offset, offset + 224);
    const ranked = cities
      .map((c, i) => ({ ...c, i, value: v[i] }))
      .filter(c => c.value !== null && c.value > 0)
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'pt-BR'));
    const valid = v.filter(x => x !== null).length,
      total = v.reduce((sum, x) => sum + (x === null ? 0 : x), 0);
    return {
      a,
      v,
      s,
      ranked,
      valid,
      total,
      positive: ranked.length,
      topFive: ranked.slice(0, 5).reduce((sum, c) => sum + c.value, 0)
    };
  }

  const selectable = D.activities.filter(a => a.level === 'produto' || a.level === 'total');
  for (const [source, title] of Object.entries(sourceNames)) {
    const group = document.createElement('optgroup');
    group.label = title;
    const list = selectable
      .filter(a => a.source === source)
      .sort(
        (a, b) =>
          Number(b.level === 'total') - Number(a.level === 'total') ||
          label(a).localeCompare(label(b), 'pt-BR')
      );
    for (const a of list) {
      const option = document.createElement('option');
      option.value = a.id;
      option.textContent = label(a) + (a.level === 'total' ? ' · total da pesquisa' : '');
      group.appendChild(option);
    }
    $('activitySelect').appendChild(group);
  }
  for (const year of D.years) {
    const b = document.createElement('button');
    b.textContent = year;
    b.setAttribute('aria-pressed', 'false');
    b.dataset.year = year;
    b.addEventListener('click', () => {
      state.year = year;
      render();
    });
    $('yearButtons').appendChild(b);
  }
  const mapGroup = $('municipalities'),
    svg = $('mapSvg'),
    paths = new Map();
  for (const f of D.geometry) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', f.d);
    p.setAttribute('class', 'map-path');
    p.dataset.id = f.id;
    p.setAttribute('tabindex', '0');
    p.setAttribute('role', 'button');
    mapGroup.appendChild(p);
    paths.set(f.id, p);
  }

  function updateHash() {
    const params = new URLSearchParams({
      atividade: state.activity,
      ano: state.year,
      leitura: state.metric
    });
    if (state.city) params.set('municipio', state.city);
    try {
      history.replaceState(null, '', '#' + params.toString());
    } catch {}
  }
  try {
    const params = new URLSearchParams(location.hash.slice(1));
    if (selectable.some(a => a.id === params.get('atividade')))
      state.activity = params.get('atividade');
    if (D.years.includes(Number(params.get('ano')))) state.year = Number(params.get('ano'));
    if (['value', 'share'].includes(params.get('leitura'))) state.metric = params.get('leitura');
    if (cityIndex.has(params.get('municipio'))) state.city = params.get('municipio');
  } catch {}
  function setActivity(id) {
    if (!acts.has(id)) return;
    state.activity = id;
    render();
  }
  function selectCity(id) {
    if (!cityIndex.has(id)) return;
    state.city = id;
    closeSearch();
    render();
  }
  function render() {
    ctx = statistics(state.activity, state.year);
    $('activitySelect').value = state.activity;
    $('metricSelect').value = state.metric;
    document
      .querySelectorAll('#yearButtons button')
      .forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.year) === state.year)));
    document
      .querySelectorAll('[data-activity]')
      .forEach(b => b.classList.toggle('active', b.dataset.activity === state.activity));
    $('totalValue').textContent = ctx.valid ? money(ctx.total) : '—';
    $('positiveCount').textContent = ctx.valid ? ctx.positive : '—';
    $('coverageLabel').textContent =
      ctx.valid === 224
        ? '224 municípios com valor publicado'
        : ctx.valid + ' com valor publicado · ' + (224 - ctx.valid) + ' sem valor';
    $('topShare').textContent = ctx.total > 0 ? pct(ctx.topFive / ctx.total) : '—';
    $('mapTitle').textContent = label(ctx.a) + ' no Piauí';
    $('mapSubtitle').textContent =
      sourceNames[ctx.a.source] +
      ' · ' +
      (state.metric === 'value'
        ? 'Valor da produção em reais'
        : 'Participação na soma estadual da atividade');
    $('mapPeriod').textContent = state.year;
    $('rankingYear').textContent = state.year;
    const notice = $('dataNotice');
    notice.hidden = ctx.valid > 0 && ctx.total > 0;
    notice.textContent =
      ctx.valid === 0
        ? 'Não há valores disponíveis para esta atividade neste ano. Isso não significa produção zero. Alguns produtos passaram a ser pesquisados em 2025.'
        : ctx.total === 0
          ? 'Os valores publicados desta seleção são zero. Não há participação percentual ou ordenação de valores positivos a apresentar.'
          : '';
    renderMap();
    renderDetail();
    renderRanking();
    updateHash();
    hideTooltip();
    $('readingText').textContent =
      ctx.total > 0
        ? `Em ${state.year}, os cinco maiores municípios reúnem ${pct(ctx.topFive / ctx.total)} do valor de ${label(ctx.a).toLocaleLowerCase('pt-BR')}. Mude a atividade para observar outra distribuição territorial.`
        : 'A disponibilidade muda conforme a atividade e o ano. Consulte as fontes para interpretar zeros e dados ausentes.';
  }

  function renderMap() {
    const metric = ctx.v.map(v =>
      v === null ? null : state.metric === 'share' ? (ctx.total > 0 ? v / ctx.total : 0) : v
    );
    const positives = metric.filter(v => v !== null && v > 0).sort((a, b) => a - b);
    const cuts = [0.2, 0.4, 0.6, 0.8, 1].map(p =>
      positives.length ? positives[Math.ceil(p * positives.length) - 1] : 0
    );
    const bucket = v =>
      Math.max(
        0,
        cuts.findIndex(c => v <= c)
      );
    for (const [id, p] of paths) {
      const i = cityIndex.get(id),
        v = metric[i];
      p.setAttribute(
        'fill',
        v === null ? 'url(#unavailablePattern)' : v === 0 ? '#e2e7dc' : palette[bucket(v)]
      );
      p.classList.toggle('selected', id === state.city);
      p.setAttribute('aria-pressed', String(id === state.city));
      p.setAttribute(
        'aria-label',
        `${cities[i].name}, ${label(ctx.a)}, ${state.year}: ${ctx.v[i] === null ? statusLabels[ctx.s[i]] : money(ctx.v[i], true)}`
      );
    }
    if (state.city) mapGroup.appendChild(paths.get(state.city));
    const format = state.metric === 'share' ? v => pct(v) : v => money(v);
    let html =
      '<b class="legend-title">' +
      (state.metric === 'share' ? 'Participação estadual' : 'Valor da produção') +
      '</b>';
    let previous = null;
    cuts.forEach((cut, i) => {
      if (!positives.length || cut === previous) return;
      const text =
        previous === null ? 'Até ' + format(cut) : format(previous) + ' – ' + format(cut);
      html += `<div class="legend-row"><i style="background:${palette[i]}"></i>${esc(text)}</div>`;
      previous = cut;
    });
    if (!positives.length) html += '<div class="legend-row">Sem valores positivos</div>';
    html +=
      '<div class="legend-row"><i style="background:#e2e7dc"></i>Zero publicado</div><div class="legend-row"><i style="background:repeating-linear-gradient(-45deg,#f1efe9,#f1efe9 2px,#c7c8c1 2px,#c7c8c1 3px)"></i>Sem valor disponível</div><div class="legend-note">Quintis dos valores positivos.<br>Faixas mudam com a seleção.</div>';
    $('mapLegend').innerHTML = html;
  }
  function renderDetail() {
    const el = $('detailContent');
    if (!state.city) {
      el.innerHTML = `<div class="state-illustration"><svg class="icon"><use href="#i-pin"/></svg></div><h3 class="city-title">Visão estadual</h3><p class="city-subtitle">224 municípios · Piauí</p><p class="state-copy">O mesmo município pode participar de várias atividades. Selecione um território no mapa ou use a busca para conhecer suas diferentes produções.</p><div class="state-highlight"><b>${ctx.valid ? money(ctx.total) : '—'}</b>${esc(label(ctx.a))} · ${state.year}<br><span>${ctx.positive} municípios com valor positivo nesta seleção.</span></div><p class="side-note">Este mapa descreve a produção. O vínculo com instrumentos de financiamento ainda está em construção.</p>`;
      return;
    }
    const i = cityIndex.get(state.city),
      city = cities[i],
      v = ctx.v[i];
    const share = v !== null && ctx.total > 0 ? v / ctx.total : null;
    const rank = v > 0 ? ctx.ranked.filter(c => c.value > v).length + 1 : null;
    const trend = D.years.map(y => ctx.a.v[(y - 2021) * 224 + i]);
    const max = Math.max(...trend.filter(x => x !== null), 1);
    const others = D.activities
      .filter(a => a.level === 'produto' && a.id !== state.activity)
      .map(a => ({ a, value: a.v[(state.year - 2021) * 224 + i] }))
      .filter(x => x.value !== null && x.value > 0)
      .sort((a, b) => b.value - a.value || label(a.a).localeCompare(label(b.a), 'pt-BR'))
      .slice(0, 4);
    el.innerHTML = `<h3 class="city-title">${esc(city.name)}</h3><p class="city-subtitle">Piauí · código IBGE ${city.id}</p><p class="city-label">${esc(label(ctx.a))} · ${state.year}</p><strong class="city-value">${money(v)}</strong>${v === null ? `<p class="side-note">${esc(statusLabels[ctx.s[i]])}. Não interpretado como zero.</p>` : ''}<div class="city-stat-row"><div><strong>${pct(share)}</strong><span>da soma estadual</span></div><div><strong>${rank === null ? '—' : rank + 'º'}</strong><span>posição por valor</span></div></div><div class="trend-header"><span>Trajetória da produção</span><small>REAIS CORRENTES</small></div><div class="trend-chart">${D.years.map((y, j) => `<button class="trend-col ${y === state.year ? 'active' : ''}" data-trend-year="${y}" title="${y}: ${trend[j] === null ? 'Sem valor disponível' : money(trend[j], true)}" aria-label="Selecionar ${y}, ${trend[j] === null ? 'sem valor disponível' : money(trend[j], true)}">${trend[j] === null ? '<span class="trend-missing">—</span>' : `<span class="trend-bar" style="height:${Math.max(2, (trend[j] / max) * 60)}px"></span>`}<small>${y}</small></button>`).join('')}</div><div class="other-head"><svg class="icon"><use href="#i-layers"/></svg>Outras atividades observadas</div><p class="other-help">Produtos com maior valor no município · ${state.year}</p>${others.length ? others.map(({ a, value }) => `<button class="other-activity" data-other-activity="${esc(a.id)}"><span>${esc(label(a))}<small>${esc(sourceShort[a.source])}</small></span><b>${money(value)}</b></button>`).join('') : '<p class="side-note">Não há outras atividades com valor positivo nesta base e ano.</p>'}`;
    el.querySelectorAll('[data-trend-year]').forEach(b =>
      b.addEventListener('click', () => {
        state.year = Number(b.dataset.trendYear);
        render();
      })
    );
    el.querySelectorAll('[data-other-activity]').forEach(b =>
      b.addEventListener('click', () => setActivity(b.dataset.otherActivity))
    );
  }
  function renderRanking() {
    $('rankingList').innerHTML = ctx.ranked.length
      ? ctx.ranked
          .slice(0, 5)
          .map(
            (c, i) =>
              `<button class="ranking-row" data-city="${c.id}" aria-label="Explorar ${esc(c.name)}"><span class="rank-number">0${i + 1}</span><span class="rank-name">${esc(c.name)}</span><span class="rank-track"><i style="width:${(c.value / ctx.ranked[0].value) * 100}%"></i></span><span class="rank-value">${money(c.value)}</span><span class="rank-share">${pct(c.value / ctx.total)}</span></button>`
          )
          .join('')
      : '<p class="empty-ranking">Não há valores positivos para ordenar nesta seleção. Escolha outra atividade ou outro ano.</p>';
    $('rankingList')
      .querySelectorAll('[data-city]')
      .forEach(b => b.addEventListener('click', () => selectCity(b.dataset.city)));
  }
  function tooltip(event, id) {
    if (drag) return;
    const i = cityIndex.get(id),
      v = ctx.v[i],
      tip = $('tooltip'),
      rect = $('mapCanvas').getBoundingClientRect();
    tip.innerHTML = `<b>${esc(cities[i].name)}</b><small>${esc(label(ctx.a))} · ${state.year}</small><strong>${v === null ? 'Sem valor disponível' : money(v)}</strong><small>${v === null ? esc(statusLabels[ctx.s[i]]) : pct(ctx.total > 0 ? v / ctx.total : null) + ' da soma estadual'}</small>`;
    tip.hidden = false;
    tip.style.left =
      Math.max(8, Math.min(event.clientX - rect.left + 14, rect.width - tip.offsetWidth - 9)) +
      'px';
    tip.style.top =
      Math.max(8, Math.min(event.clientY - rect.top + 14, rect.height - tip.offsetHeight - 9)) +
      'px';
  }
  function hideTooltip() {
    $('tooltip').hidden = true;
  }
  function updateView() {
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    $('zoomOut').disabled = view.w >= 780;
    $('zoomIn').disabled = view.w <= 156;
  }
  function zoom(factor) {
    const w = Math.min(780, Math.max(156, view.w * factor)),
      h = (w * 650) / 780;
    view = { x: view.x + (view.w - w) / 2, y: view.y + (view.h - h) / 2, w, h };
    if (w === 780) view = { x: 0, y: 0, w: 780, h: 650 };
    updateView();
    hideTooltip();
  }
  function resetView() {
    view = { x: 0, y: 0, w: 780, h: 650 };
    updateView();
  }
  svg.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const r = svg.getBoundingClientRect();
    drag = {
      x: e.clientX,
      y: e.clientY,
      vx: view.x,
      vy: view.y,
      scale: Math.min(r.width / view.w, r.height / view.h),
      id: e.target.closest('.map-path')?.dataset.id,
      moved: false
    };
    svg.setPointerCapture(e.pointerId);
    hideTooltip();
  });
  svg.addEventListener('pointermove', e => {
    if (drag) {
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) {
        drag.moved = true;
        svg.classList.add('dragging');
        view.x = drag.vx - dx / drag.scale;
        view.y = drag.vy - dy / drag.scale;
        updateView();
      }
      return;
    }
    const id = e.target.closest('.map-path')?.dataset.id;
    if (id) tooltip(e, id);
    else hideTooltip();
  });
  svg.addEventListener('pointerup', e => {
    if (!drag) return;
    const old = drag;
    drag = null;
    svg.classList.remove('dragging');
    if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    if (!old.moved && old.id) selectCity(old.id);
  });
  svg.addEventListener('pointercancel', () => {
    drag = null;
    svg.classList.remove('dragging');
  });
  svg.addEventListener('pointerleave', hideTooltip);
  svg.addEventListener('keydown', e => {
    const id = e.target.closest('.map-path')?.dataset.id;
    if (id && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      selectCity(id);
    }
  });
  $('zoomIn').addEventListener('click', () => zoom(0.72));
  $('zoomOut').addEventListener('click', () => zoom(1 / 0.72));
  $('resetMap').addEventListener('click', resetView);
  $('activitySelect').addEventListener('change', e => setActivity(e.target.value));
  $('metricSelect').addEventListener('change', e => {
    state.metric = e.target.value;
    render();
  });
  document
    .querySelectorAll('.shortcuts [data-activity]')
    .forEach(b => b.addEventListener('click', () => setActivity(b.dataset.activity)));
  $('clearSelection').addEventListener('click', () => {
    state.city = null;
    render();
  });

  function closeSearch() {
    $('searchResults').hidden = true;
    $('citySearch').setAttribute('aria-expanded', 'false');
    $('citySearch').value = '';
  }
  function search() {
    const query = norm($('citySearch').value.trim()),
      box = $('searchResults');
    if (!query) {
      box.hidden = true;
      $('citySearch').setAttribute('aria-expanded', 'false');
      return;
    }
    const found = cities.filter(c => norm(c.name).includes(query)).slice(0, 8);
    box.innerHTML = found.length
      ? found
          .map(c => `<button role="option" data-result="${c.id}">${esc(c.name)}</button>`)
          .join('')
      : '<p>Nenhum município encontrado.</p>';
    box.hidden = false;
    $('citySearch').setAttribute('aria-expanded', 'true');
    box
      .querySelectorAll('[data-result]')
      .forEach(b => b.addEventListener('click', () => selectCity(b.dataset.result)));
  }
  $('citySearch').addEventListener('input', search);
  $('citySearch').addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSearch();
    if (e.key === 'ArrowDown') {
      $('searchResults').querySelector('button')?.focus();
      e.preventDefault();
    }
    if (e.key === 'Enter') {
      const b = $('searchResults').querySelector('button');
      if (b) {
        selectCity(b.dataset.result);
        e.preventDefault();
      }
    }
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) closeSearch();
  });

  function toast(text) {
    clearTimeout(toastTimer);
    $('toast').textContent = text;
    $('toast').hidden = false;
    toastTimer = setTimeout(() => {
      $('toast').hidden = true;
    }, 4200);
  }
  $('exportButton').addEventListener('click', () => {
    const header = [
      'codigo_ibge',
      'municipio',
      'ano',
      'atividade_id',
      'atividade',
      'fonte',
      'valor_mil_reais',
      'valor_original',
      'status',
      'participacao_soma_estadual_pct'
    ];
    const quote = x => '"' + String(x ?? '').replace(/"/g, '""') + '"';
    const rows = cities.map((c, i) => {
      const s = ctx.s[i],
        v = ctx.v[i],
        raw =
          s === 1
            ? '-'
            : s === 2
              ? '0'
              : s === 3
                ? '...'
                : s === 4
                  ? 'X'
                  : s === 5
                    ? '..'
                    : String(v);
      return [
        c.id,
        c.name,
        state.year,
        state.activity,
        label(ctx.a),
        ctx.a.source,
        v,
        raw,
        statusLabels[s],
        v !== null && ctx.total > 0 ? ((100 * v) / ctx.total).toFixed(6) : ''
      ];
    });
    const blob = new Blob(
        ['\uFEFF' + [header, ...rows].map(r => r.map(quote).join(',')).join('\r\n')],
        { type: 'text/csv;charset=utf-8;' }
      ),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = `piaui_${state.activity.replace(':', '_')}_${state.year}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Seleção exportada: 224 municípios e símbolos originais.');
  });
  $('fullscreenButton').addEventListener('click', async () => {
    const enabled = document.body.classList.toggle('presentation-mode');
    $('fullscreenButton').setAttribute('aria-pressed', String(enabled));
    window.scrollTo({ top: 0, behavior: 'instant' });
    try {
      if (!enabled && document.fullscreenElement) await document.exitFullscreen();
      else if (enabled && !document.fullscreenElement)
        await document.documentElement.requestFullscreen();
    } catch {
      toast(
        enabled
          ? 'Modo de apresentação ativado. Use F11 para ampliar a tela.'
          : 'Modo de exploração ativado.'
      );
    }
  });
  const about = $('aboutDialog');
  for (const id of ['aboutButton', 'sourceInfoButton', 'footerAbout'])
    $(id).addEventListener('click', () => about.showModal());
  $('closeAbout').addEventListener('click', () => about.close());
  for (const id of ['aboutDialog', 'insightsDialog'])
    $(id).addEventListener('click', e => {
      if (e.target === $(id)) {
        const r = $(id).getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
          $(id).close();
      }
    });

  function insights() {
    const ids = ['pam:0', 'ppm:2687', 'ppm:2682'];
    $('insightCards').innerHTML = ids
      .map((id, i) => {
        const s = statistics(id, 2025),
          c = s.ranked[0];
        return `<button class="insight-card" data-insight="${i}"><small>0${i + 1} · ${esc(label(s.a).toLocaleUpperCase('pt-BR'))}</small><h3>${i === 0 ? 'A produção tem diferentes concentrações.' : i === 1 ? 'Outras atividades revelam outros polos.' : 'Um município pode ter vários perfis.'}</h3><p>Os cinco maiores reúnem <b>${pct(s.topFive / s.total)}</b> do valor. ${i === 2 ? 'Parnaíba tem produção de leite e de ovos de galinha registrada em 2025.' : `O maior valor nesta seleção é de <b>${esc(c.name)}</b>.`}</p></button>`;
      })
      .join('');
    $('insightCards')
      .querySelectorAll('[data-insight]')
      .forEach(b =>
        b.addEventListener('click', () => {
          $('insightsDialog').close();
          startTour(Number(b.dataset.insight));
        })
      );
    $('insightsDialog').showModal();
  }
  $('insightsButton').addEventListener('click', insights);
  $('closeInsights').addEventListener('click', () => $('insightsDialog').close());
  function startTour(step = 0) {
    state.tour = step;
    showTour();
    $('mapCanvas').scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'center'
    });
  }
  function showTour() {
    const steps = [
      { id: 'pam:0', city: 'Baixa Grande do Ribeiro', title: 'A escala também tem endereço.' },
      {
        id: 'ppm:2687',
        city: 'São Raimundo Nonato',
        title: 'Mude a atividade. Encontre outros polos.'
      },
      { id: 'ppm:2682', city: 'Parnaíba', title: 'O município não cabe em um único perfil.' }
    ];
    const step = steps[state.tour];
    state.activity = step.id;
    state.year = 2025;
    state.metric = 'value';
    state.city = cities.find(c => c.name === step.city).id;
    resetView();
    render();
    $('tourCard').hidden = false;
    $('tourCounter').textContent = `LEITURA ${state.tour + 1} DE 3`;
    $('tourTitle').textContent = step.title;
    const s = statistics(step.id, 2025);
    const copies = [
      `Em 2025, cinco municípios reúnem ${pct(s.topFive / s.total)} do valor das lavouras. A concentração é um ponto de partida para compreender a distribuição produtiva.`,
      `No mel, os cinco maiores reúnem ${pct(s.topFive / s.total)} do valor. São Raimundo Nonato lidera essa atividade; a leitura territorial muda quando mudamos o produto.`,
      `Parnaíba tem produção registrada tanto de leite quanto de ovos. Explore suas outras atividades no painel. A relevância de cada perfil ainda será definida pelo grupo.`
    ];
    $('tourCopy').textContent = copies[state.tour];
    $('tourPrev').disabled = state.tour === 0;
    $('tourNext').innerHTML =
      (state.tour === 2 ? 'Concluir roteiro' : 'Próxima leitura') +
      ' <svg class="icon"><use href="#i-arrow"/></svg>';
    $('tourDots').innerHTML = steps
      .map((_, i) => `<i class="${i === state.tour ? 'active' : ''}"></i>`)
      .join('');
  }
  function closeTour() {
    state.tour = -1;
    $('tourCard').hidden = true;
  }
  for (const id of ['tourButton', 'readingTourButton'])
    $(id).addEventListener('click', () => startTour());
  $('tourPrev').addEventListener('click', () => {
    if (state.tour > 0) {
      state.tour--;
      showTour();
    }
  });
  $('tourNext').addEventListener('click', () => {
    if (state.tour >= 2) {
      closeTour();
      toast('Agora explore livremente os municípios e suas atividades.');
    } else {
      state.tour++;
      showTour();
    }
  });
  $('tourClose').addEventListener('click', closeTour);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeTour();
  });
  document.querySelector('.brand').addEventListener('click', e => {
    e.preventDefault();
    state.activity = 'ppm:2687';
    state.year = 2025;
    state.metric = 'value';
    state.city = defaultCity;
    closeTour();
    resetView();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  updateView();
  render();
})();
