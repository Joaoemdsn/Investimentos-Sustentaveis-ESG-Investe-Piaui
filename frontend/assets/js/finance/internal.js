/* Only aggregate values are exposed; individual internal projects stay on the server. */
(() => {
  const value = window.INTERNAL_INDICATOR;
  if (!value) return;
  const card = document.querySelector('.internal-indicator');
  card.querySelector('.quiet-chip').textContent =
    value.status === 'ready' ? 'COORTE VALIDADA' : 'DADOS INTERNOS PENDENTES';
  card.querySelector('.internal-pending').textContent =
    value.status === 'ready'
      ? new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 2 }).format(
          value.rate
        )
      : value.label;
  const note = card.querySelector('p');
  if (value.status === 'ready') {
    note.textContent = `${value.numerator} de ${value.denominator} projetos encaminhados até ${value.cutoff}. Coorte: ${value.start} a ${value.end}.`;
  } else if (value.status === 'invalid') {
    note.textContent =
      'Revise as datas da coorte e a consistência dos registros internos. O percentual não foi calculado.';
  }
})();
