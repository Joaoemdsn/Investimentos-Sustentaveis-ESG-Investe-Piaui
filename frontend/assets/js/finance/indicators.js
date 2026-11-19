/* GRI catalogue: browse, select and import indicator values. Imported data never leaves this browser. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  if (!$('indicatorsPane') || !window.INDICATORS_DATA) return;

  const ITEMS = window.INDICATORS_DATA.items;
  const BY_CODE = new Map(ITEMS.map(item => [item.codigo, item]));
  const CITIES = (window.FINANCE_DATA && window.FINANCE_DATA.cities) || [];
  const STORAGE_KEYS = { values: 'piauiIndicadores.valores.v1', selected: 'piauiIndicadores.selecao.v1' };
  const COLUMNS = ['codigo_gri', 'empresa_projeto', 'municipio', 'ano', 'valor', 'unidade', 'meta', 'sentido', 'fonte', 'observacao'];
  const REQUIRED = ['codigo_gri', 'empresa_projeto', 'ano', 'valor'];
  const MAX_BYTES = 2 * 1024 * 1024;
  const MAX_ROWS = 5000;
  const SHOWN_VALUES = 30;
  const DIMENSIONS = { AMBIENTAL: 'Ambiental', SOCIAL: 'Social', GOVERNANCA: 'Governança', ECONOMICA: 'Econômica' };
  const PERSPECTIVES = { EMPRESAS: 'Empresas e projetos', INVESTE: 'Investe Piauí', AMBAS: 'Investe e empresas' };
  const TAB_COPY = {
    EMPRESAS:
      'Impactos dos empreendimentos atraídos e acompanhados pela Investe: emprego na obra e na operação, mão de obra piauiense, participação de mulheres e homens, ambiente e economia local.',
    INVESTE:
      'Governança e responsabilidade da própria Investe Piauí: como a instituição decide, seleciona projetos e parceiros e presta contas.',
    TODOS: 'Acervo completo. Indicadores marcados como “Investe e empresas” valem para as duas perspectivas.'
  };

  const esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const normal = value =>
    String(value ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
  const clip = (value, size) => value.slice(0, size);
  const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });

  const storage = {
    read(key, fallback) {
      try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
      } catch {
        return fallback;
      }
    },
    write(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch {}
    }
  };

  function storedImport() {
    const saved = storage.read(STORAGE_KEYS.values, null);
    if (!saved || !Array.isArray(saved.rows)) return null;
    const rows = saved.rows.filter(row => row && BY_CODE.has(row.code));
    return rows.length ? { file: String(saved.file || ''), date: String(saved.date || ''), rows } : null;
  }

  const savedSelection = storage.read(STORAGE_KEYS.selected, []);
  const state = {
    tab: 'EMPRESAS',
    dimension: '',
    origin: '',
    data: '',
    query: '',
    active: ITEMS[0] && ITEMS[0].codigo,
    selected: new Set(Array.isArray(savedSelection) ? savedSelection.filter(code => BY_CODE.has(code)) : []),
    imported: storedImport(),
    report: null
  };

  const inTab = (item, tab) => tab === 'TODOS' || item.perspectiva === tab || item.perspectiva === 'AMBAS';
  function valuesByCode() {
    const map = new Map();
    for (const row of state.imported ? state.imported.rows : []) {
      if (!map.has(row.code)) map.set(row.code, []);
      map.get(row.code).push(row);
    }
    return map;
  }
  function visibleItems(values) {
    const query = normal(state.query.trim());
    return ITEMS.filter(
      item =>
        inTab(item, state.tab) &&
        (!state.dimension || item.dimensao === state.dimension) &&
        (!state.origin || item.origem === state.origin) &&
        (!state.data || (state.data === 'com') === values.has(item.codigo)) &&
        (!query ||
          normal([item.codigo, item.nome, item.pergunta, item.relacao_tema, item.norma].join(' ')).includes(query))
    );
  }

  /* ---------- Rendering ---------- */

  function render() {
    const values = valuesByCode();
    for (const tab of document.querySelectorAll('[data-ind-tab]')) {
      const selected = tab.dataset.indTab === state.tab;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      tab.querySelector('.ind-tab-count').textContent = ITEMS.filter(i => inTab(i, tab.dataset.indTab)).length;
      if (selected) $('indBody').setAttribute('aria-labelledby', tab.id);
    }
    $('indTabDesc').textContent = TAB_COPY[state.tab];
    const tabDimensions = Object.keys(DIMENSIONS).filter(d =>
      ITEMS.some(i => inTab(i, state.tab) && i.dimensao === d)
    );
    if (!tabDimensions.includes(state.dimension)) state.dimension = '';
    $('indChips').innerHTML =
      `<button type="button" class="ind-chip" data-ind-dim="" aria-pressed="${!state.dimension}">Todas as dimensões</button>` +
      tabDimensions
        .map(
          d =>
            `<button type="button" class="ind-chip" data-ind-dim="${d}" data-dim="${d}" aria-pressed="${state.dimension === d}"><i></i>${DIMENSIONS[d]}</button>`
        )
        .join('');

    const items = visibleItems(values);
    $('indResult').textContent = items.length === 1 ? '1 indicador' : `${items.length} indicadores`;
    if (!items.some(i => i.codigo === state.active)) state.active = items[0] ? items[0].codigo : null;
    $('indGrid').innerHTML = items.length
      ? items.map(item => card(item, values.get(item.codigo))).join('')
      : '<p class="ind-empty">Nenhum indicador encontrado com esses filtros.</p>';
    renderDetail(state.active ? BY_CODE.get(state.active) : null, values);
    $('indSelectedCount').textContent = state.selected.size;
    renderImportStatus();
  }

  function originPill(item) {
    return item.origem === 'referencia'
      ? '<span class="pill ref">Lista de referência</span>'
      : '<span class="pill">Sugerido</span>';
  }

  function card(item, rows) {
    return (
      `<button type="button" class="ind-card" data-ind-code="${esc(item.codigo)}" data-dim="${item.dimensao}" aria-pressed="${item.codigo === state.active}">` +
      `<header><span class="gri-code">${esc(item.codigo)}</span><span class="dim-tag">${DIMENSIONS[item.dimensao].toUpperCase()}</span></header>` +
      `<h3>${esc(item.nome)}</h3><p>${esc(item.pergunta)}</p><footer>` +
      originPill(item) +
      (item.perspectiva === 'AMBAS' ? '<span class="pill both">Investe e empresas</span>' : '') +
      (rows ? `<span class="pill data">${rows.length} ${rows.length === 1 ? 'registro' : 'registros'}</span>` : '') +
      (state.selected.has(item.codigo) ? '<span class="pill sel">✓ Selecionado</span>' : '') +
      '</footer></button>'
    );
  }

  function valuesTable(rows) {
    if (!rows || !rows.length)
      return '<p class="note">Nenhum dado importado para este indicador. Use “Baixar modelo”, preencha e depois “Importar dados”.</p>';
    const sorted = [...rows].sort((a, b) => b.year - a.year || a.company.localeCompare(b.company, 'pt-BR'));
    const body = sorted
      .slice(0, SHOWN_VALUES)
      .map(
        row =>
          `<tr><td>${esc(row.company)}${row.city ? `<br><small>${esc(row.city)}</small>` : ''}</td>` +
          `<td class="num">${row.year}</td>` +
          `<td class="num">${number.format(row.value)} <small>${esc(row.unit)}</small></td>` +
          `<td class="num">${row.meta === null ? '—' : number.format(row.meta)}</td></tr>`
      )
      .join('');
    return (
      '<table class="ind-values"><thead><tr><th>Empresa / projeto</th><th class="num">Ano</th><th class="num">Valor</th><th class="num">Meta</th></tr></thead>' +
      `<tbody>${body}</tbody></table>` +
      (sorted.length > SHOWN_VALUES
        ? `<p class="note">Mostrando ${SHOWN_VALUES} de ${sorted.length} registros, dos mais recentes para os mais antigos.</p>`
        : '') +
      '<p class="note">Dados informados no arquivo importado; não foram verificados pelo painel.</p>'
    );
  }

  function renderDetail(item, values) {
    const detail = $('indDetail');
    if (!item) {
      detail.removeAttribute('data-dim');
      detail.innerHTML = '<p class="note">Ajuste os filtros para ver um indicador.</p>';
      return;
    }
    const selected = state.selected.has(item.codigo);
    detail.dataset.dim = item.dimensao;
    detail.innerHTML =
      `<span class="gri-code">${esc(item.codigo)}</span><h2>${esc(item.nome)}</h2>` +
      `<div class="tags"><span class="pill" style="color:var(--dim)">${DIMENSIONS[item.dimensao]}</span>` +
      `<span class="pill both">${PERSPECTIVES[item.perspectiva]}</span>${originPill(item)}</div>` +
      `<p class="standard">Norma: ${esc(item.norma)}</p>` +
      (item.observacao ? `<p class="warning">${esc(item.observacao)}</p>` : '') +
      `<h3>Pergunta que responde</h3><p class="question">${esc(item.pergunta)}</p>` +
      `<h3>Relação com o tema</h3><p>${esc(item.relacao_tema)}</p>` +
      '<h3>Como medir</h3><dl>' +
      `<dt>Unidade</dt><dd>${esc(item.unidade)}</dd>` +
      `<dt>Periodicidade</dt><dd>${esc(item.periodicidade)}</dd>` +
      `<dt>Fonte sugerida</dt><dd>${esc(item.fonte_sugerida || '—')}</dd></dl>` +
      `<h3>Dados importados</h3>${valuesTable(values.get(item.codigo))}` +
      `<button type="button" class="ind-select" id="indSelectToggle" aria-pressed="${selected}">` +
      (selected ? '✓ Selecionado para monitorar' : '+ Selecionar para monitorar') +
      '</button>';
  }

  function renderImportStatus() {
    const box = $('indImportStatus');
    const report = state.report;
    const clear = state.imported
      ? '<button type="button" id="indClearImport">Limpar dados importados</button>'
      : '';
    box.classList.toggle('has-errors', !!(report && (report.error || report.errors.length)));
    if (report) {
      let text;
      if (report.error) text = `${esc(report.file)}: ${esc(report.error)}`;
      else {
        const parts = [`${report.accepted} ${report.accepted === 1 ? 'linha importada' : 'linhas importadas'}`];
        if (report.errors.length) parts.push(`${report.errors.length} recusada${report.errors.length === 1 ? '' : 's'}`);
        if (report.skipped) parts.push(`${report.skipped} sem preenchimento ignorada${report.skipped === 1 ? '' : 's'}`);
        text = `<b>${esc(report.file)}</b>: ${parts.join(' · ')}.`;
        if (!report.accepted) text += ' Os dados anteriores foram mantidos.';
        else if (!report.saved)
          text += ' O navegador não permitiu guardar os dados; eles valem até a página ser fechada.';
      }
      const errors = report.errors && report.errors.length
        ? '<ul>' +
          report.errors
            .slice(0, 50)
            .map(e => `<li>Linha ${e.line}: ${esc(e.message)}</li>`)
            .join('') +
          (report.errors.length > 50 ? `<li>… e mais ${report.errors.length - 50} linhas.</li>` : '') +
          '</ul>'
        : '';
      box.innerHTML = `<p>${text}</p>${clear}<button type="button" id="indDismissReport">Fechar</button>${errors}`;
      box.hidden = false;
    } else if (state.imported) {
      const date = state.imported.date ? new Date(state.imported.date).toLocaleDateString('pt-BR') : '';
      box.innerHTML =
        `<p>Dados importados de <b>${esc(state.imported.file)}</b>${date ? ` em ${date}` : ''}: ` +
        `${state.imported.rows.length} registros. Ficam guardados somente neste navegador.</p>${clear}`;
      box.hidden = false;
    } else {
      box.innerHTML = '';
      box.hidden = true;
    }
  }

  /* Mirrors the five headline cards already calculated in the Financiamentos tab. */
  function renderCore() {
    const fne = document.body.classList.contains('fne-active');
    const cards = document.querySelectorAll(
      fne ? '#fneSummary .five-metrics article' : 'main > .five-metrics article'
    );
    const scope = (fne ? $('fneScope') : $('scopeLine'))?.textContent || '';
    $('indCore').innerHTML =
      `<div class="core-title"><b>5 PRINCIPAIS</b>${esc(scope || 'Calculados na aba Financiamentos')}</div>` +
      [...cards]
        .map(
          article =>
            `<article><span>${esc(article.querySelector('.metric-label')?.textContent)}</span>` +
            `<strong>${esc(article.querySelector('strong')?.textContent)}</strong></article>`
        )
        .join('') +
      '<button type="button" class="core-link" id="indOpenFinance">Ver em Financiamentos →</button>';
  }

  /* ---------- CSV helpers ---------- */

  function toast(text) {
    const box = $('financeToast');
    if (!box) return;
    box.textContent = text;
    box.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (box.hidden = true), 4200);
  }

  function download(name, rows, message) {
    const text =
      '﻿' +
      rows.map(row => row.map(x => '"' + String(x ?? '').replace(/"/g, '""') + '"').join(';')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8;' }));
    link.download = name + '.csv';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    toast(message);
  }

  function parseCsv(text) {
    const header = text.split(/\r?\n/, 1)[0];
    const count = d => header.split(d).length;
    const delimiter = [';', ',', '\t'].reduce((best, d) => (count(d) > count(best) ? d : best), ';');
    const rows = [];
    let row = [],
      field = '',
      quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c !== '"') field += c;
        else if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else if (c === '"' && field === '') quoted = true;
      else if (c === delimiter) {
        row.push(field);
        field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else field += c;
    }
    if (field !== '' || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  /* Accepts 1234,5 · 1.234,5 · 1234.5 · 1,234.5. A lone "1.234" is ambiguous and refused. */
  function parseNumber(raw) {
    let s = String(raw).replace(/[\s ]/g, '').replace(/^R\$/i, '').replace(/%$/, '');
    if (!s) return { error: 'vazio' };
    if (/^-?\d{1,3}\.\d{3}$/.test(s)) return { error: `ambíguo (${raw}): escreva sem separador de milhar` };
    const comma = s.lastIndexOf(','),
      dot = s.lastIndexOf('.');
    if (comma > -1 && dot > -1)
      s = comma > dot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (comma > -1) s = s.split(',').length === 2 ? s.replace(',', '.') : '';
    else if (s.split('.').length > 2) s = /^-?\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : '';
    return /^-?\d+(\.\d+)?$/.test(s) ? { value: Number(s) } : { error: `não numérico (${raw})` };
  }

  const normalizeCode = raw => {
    const code = raw.trim().toUpperCase().replace(/^GRI\s*/, '');
    return code ? 'GRI ' + code : '';
  };

  function parseImport(text) {
    const rows = parseCsv(text.replace(/^﻿/, ''));
    const headerIndex = rows.findIndex(r => r.some(c => c.trim()));
    if (headerIndex < 0) return { error: 'o arquivo está vazio.' };
    const header = rows[headerIndex].map(h => normal(h).trim().replace(/\s+/g, '_'));
    const missing = REQUIRED.filter(c => !header.includes(c));
    if (missing.length)
      return { error: `colunas obrigatórias ausentes: ${missing.join(', ')}. Use o arquivo de “Baixar modelo”.` };
    if (rows.length - headerIndex - 1 > MAX_ROWS) return { error: `o limite é de ${MAX_ROWS} linhas por arquivo.` };

    const accepted = [],
      errors = [],
      seen = new Set();
    let skipped = 0;
    rows.slice(headerIndex + 1).forEach((cells, index) => {
      const line = headerIndex + index + 2;
      const get = name => {
        const at = header.indexOf(name);
        return at < 0 ? '' : String(cells[at] ?? '').trim();
      };
      const raw = { code: get('codigo_gri'), company: get('empresa_projeto'), year: get('ano'), value: get('valor') };
      if (!raw.company && !raw.year && !raw.value) {
        if (cells.some(c => c.trim())) skipped++;
        return;
      }
      const problems = [];
      const code = normalizeCode(raw.code);
      const item = BY_CODE.get(code);
      if (!item) problems.push(raw.code ? `código ${raw.code} não está no acervo` : 'código GRI vazio');
      if (!raw.company) problems.push('empresa/projeto vazio');
      const year = Number(raw.year);
      if (!/^\d{4}$/.test(raw.year) || year < 1990 || year > 2100) problems.push('ano inválido');
      const value = parseNumber(raw.value);
      if (value.error) problems.push('valor ' + value.error);
      const metaRaw = get('meta');
      const meta = metaRaw ? parseNumber(metaRaw) : { value: null };
      if (meta.error) problems.push('meta ' + meta.error);
      const directionRaw = normal(get('sentido'));
      const direction = !directionRaw
        ? null
        : directionRaw.startsWith('maior')
          ? 'maior'
          : directionRaw.startsWith('menor')
            ? 'menor'
            : undefined;
      if (direction === undefined) problems.push('sentido deve ser “maior é melhor” ou “menor é melhor”');
      const cityRaw = get('municipio');
      let city = '';
      if (cityRaw) {
        const found = CITIES.find(c => normal(c.name) === normal(cityRaw));
        if (found) city = found.name;
        else problems.push(`município ${cityRaw} não encontrado no Piauí`);
      }
      const key = [code, normal(raw.company), city, year].join('|');
      if (!problems.length && seen.has(key))
        problems.push('linha repetida (mesmo indicador, empresa, município e ano)');
      if (problems.length) {
        errors.push({ line, message: problems.join('; ') });
        return;
      }
      seen.add(key);
      accepted.push({
        code,
        company: clip(raw.company, 120),
        city,
        year,
        value: value.value,
        unit: clip(get('unidade'), 60) || item.unidade,
        meta: meta.value,
        direction,
        source: clip(get('fonte'), 200),
        note: clip(get('observacao'), 300)
      });
    });
    return { accepted, errors, skipped };
  }

  async function importFile(file) {
    const report = { file: file.name, accepted: 0, errors: [], skipped: 0, saved: false };
    if (!/\.csv$/i.test(file.name)) report.error = 'envie um arquivo .csv (no Excel: Salvar como → CSV).';
    else if (file.size > MAX_BYTES) report.error = 'o arquivo passa de 2 MB.';
    else {
      try {
        const result = parseImport(await file.text());
        if (result.error) report.error = result.error;
        else {
          Object.assign(report, { accepted: result.accepted.length, errors: result.errors, skipped: result.skipped });
          if (result.accepted.length) {
            state.imported = { file: file.name, date: new Date().toISOString(), rows: result.accepted };
            report.saved = storage.write(STORAGE_KEYS.values, state.imported);
          }
        }
      } catch {
        report.error = 'não foi possível ler o arquivo.';
      }
    }
    state.report = report;
    render();
  }

  /* ---------- Actions ---------- */

  function downloadTemplate() {
    const codes = state.selected.size ? ITEMS.filter(i => state.selected.has(i.codigo)) : ITEMS;
    download(
      'modelo_indicadores_gri',
      [COLUMNS, ...codes.map(i => [i.codigo, '', '', '', '', i.unidade, '', '', '', ''])],
      state.selected.size
        ? 'Modelo gerado com os indicadores selecionados.'
        : 'Modelo gerado com todos os indicadores do acervo.'
    );
  }

  function exportSelection() {
    if (!state.selected.size) {
      toast('Selecione ao menos um indicador para exportar.');
      return;
    }
    const values = valuesByCode();
    download(
      'indicadores_selecionados',
      [
        ['codigo', 'nome', 'dimensao', 'perspectiva', 'origem', 'norma', 'pergunta', 'relacao_tema', 'unidade', 'periodicidade', 'fonte_sugerida', 'observacao', 'registros_importados'],
        ...ITEMS.filter(i => state.selected.has(i.codigo)).map(i => [
          i.codigo,
          i.nome,
          DIMENSIONS[i.dimensao],
          PERSPECTIVES[i.perspectiva],
          i.origem === 'referencia' ? 'Lista de referência' : 'Sugerido',
          i.norma,
          i.pergunta,
          i.relacao_tema,
          i.unidade,
          i.periodicidade,
          i.fonte_sugerida,
          i.observacao,
          (values.get(i.codigo) || []).length
        ])
      ],
      'CSV gerado com os indicadores selecionados.'
    );
  }

  $('indicatorsPane').addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.indTab) state.tab = target.dataset.indTab;
    else if ('indDim' in target.dataset) state.dimension = target.dataset.indDim;
    else if (target.dataset.indCode) state.active = target.dataset.indCode;
    else if (target.id === 'indSelectToggle') {
      if (state.selected.has(state.active)) state.selected.delete(state.active);
      else state.selected.add(state.active);
      storage.write(STORAGE_KEYS.selected, [...state.selected]);
    } else if (target.id === 'indClearImport') {
      if (!confirm('Remover os dados importados deste navegador? O arquivo original não é afetado.')) return;
      state.imported = null;
      state.report = null;
      storage.remove(STORAGE_KEYS.values);
    } else if (target.id === 'indDismissReport') state.report = null;
    else if (target.id === 'indOpenFinance') {
      $('navOverview').click();
      return;
    } else return;
    render();
  });
  $('indSearch').addEventListener('input', event => {
    state.query = event.target.value;
    render();
  });
  $('indOrigin').addEventListener('change', event => {
    state.origin = event.target.value;
    render();
  });
  $('indData').addEventListener('change', event => {
    state.data = event.target.value;
    render();
  });
  $('indTemplate').addEventListener('click', downloadTemplate);
  $('indExport').addEventListener('click', exportSelection);
  $('indImportButton').addEventListener('click', () => $('indImportFile').click());
  $('indImportFile').addEventListener('change', event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (file) importFile(file);
  });

  render();
  window.INDICATORS_VIEW = {
    show() {
      renderCore();
      render();
    }
  };
})();
