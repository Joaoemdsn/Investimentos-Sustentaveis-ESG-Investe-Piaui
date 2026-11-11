/* Load the same interface against Flask or the generated static snapshot. */
(() => {
  'use strict';
  const page = document.currentScript.dataset.page;
  const runtime = document.documentElement.dataset.runtime;
  const root = new URL('./', document.baseURI);
  const dataset = async name => {
    const url = new URL(
      runtime === 'static' ? `data/${name}.json` : `api/v1/datasets/${name}`,
      root
    );
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Falha ao carregar ${name}: HTTP ${response.status}`);
    return response.json();
  };
  const script = path =>
    new Promise((resolve, reject) => {
      const element = document.createElement('script');
      element.src = new URL(`assets/js/${path}`, root);
      element.onload = resolve;
      element.onerror = () => reject(new Error(`Falha ao carregar ${path}`));
      document.body.append(element);
    });
  async function start() {
    if (page === 'context') {
      window.ATLAS_DATA = await dataset('atlas');
      await script('context/atlas.js');
    } else {
      [window.FINANCE_DATA, window.FNE_DATA] = await Promise.all([
        dataset('finance'),
        dataset('fne')
      ]);
      const internalUrl = runtime === 'static' ? 'data/internal.json' : 'api/v1/internal/indicator';
      const response = await fetch(new URL(internalUrl, root));
      if (!response.ok) throw new Error('Falha ao carregar o indicador interno');
      window.INTERNAL_INDICATOR = await response.json();
      await script('finance/fne-math.js');
      await script('finance/fne.js');
      await script('finance/esg.js');
      await script('finance/dashboard.js');
      await script('finance/internal.js');
    }
    document.documentElement.dataset.ready = 'true';
  }
  start().catch(error => {
    console.error(error);
    const message = document.createElement('p');
    message.setAttribute('role', 'alert');
    message.className = 'load-error';
    message.textContent =
      'Não foi possível carregar os dados. Inicie o servidor conforme o README e atualize a página.';
    document.querySelector('main').prepend(message);
  });
})();
