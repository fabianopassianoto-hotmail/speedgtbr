(function () {
  document.querySelectorAll('[data-championship]').forEach(async function (card) {
    var status = card.querySelector('[role="status"]');
    status.textContent = 'Consultando o resumo no SimGrid…';
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 12000);
    try {
      var response = await fetch('/api/championships/' + card.dataset.championship, { signal: controller.signal });
      if (!response.ok) throw new Error('Unavailable');
      var data = await response.json();
      if (data.status !== 'available' || typeof data.title !== 'string' || !data.title) throw new Error('Unavailable');
      card.querySelector('[data-title]').textContent = data.title;
      card.querySelector('[data-description]').textContent = typeof data.description === 'string' ? data.description : '';
      card.querySelector('.championship-data').hidden = false;
      var date = new Date(data.fetchedAt);
      status.textContent = 'Resumo consultado em ' + date.toLocaleString('pt-BR') + '. Fonte: SimGrid.';
    } catch (error) {
      status.textContent = 'O resumo está indisponível aqui no momento. Acompanhe a série pelo link oficial abaixo.';
    } finally {
      clearTimeout(timeout);
    }
  });
})();
