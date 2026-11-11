(() => {
  'use strict';
  const sum = (rows, key = 'cents') => rows.reduce((n, r) => n + r[key], 0);
  const group = (rows, key) => {
    const m = new Map();
    for (const r of rows) {
      const k = r[key] || 'Não informado';
      m.set(k, (m.get(k) || 0) + r.cents);
    }
    return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
  };
  function select(data, year, line = 'todos') {
    const ok = r =>
      (year === 'todos' || r.year === Number(year)) && (line === 'todos' || r.group === line);
    return { pi: data.rows.filter(ok), ufs: data.ufRows.filter(ok) };
  }
  function statistics(data, year, line = 'todos', comparison = 'NE') {
    const { pi, ufs } = select(data, year, line),
      comp = ufs.filter(r => comparison !== 'NE' || r.region === 'Nordeste');
    const total = sum(pi),
      denominator = sum(comp),
      sizes = group(pi, 'size');
    return {
      pi,
      ufs,
      comp,
      total,
      denominator,
      share: denominator ? total / denominator : null,
      lines: pi.length,
      qUnits: sum(pi, 'qUnits'),
      cities: new Set(pi.map(r => r.cityId)).size,
      sizes
    };
  }
  window.FNE_ANALYSIS = { sum, group, select, statistics };
})();
