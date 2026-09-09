(function () {
  const originalRender = render;

  function renderUnits(rows, total) {
    const names = Object.fromEntries(rows.map(row => [row.unit || '0', row.unit_name || `Birim ${row.unit || '0'}`]));
    const units = [...aggregate(rows, row => row.unit || '0').entries()]
      .map(([code, value]) => ({ code, name: names[code] || `Birim ${code}`, ...value }))
      .sort((left, right) => right.total - left.total);
    const max = Math.max(1, ...units.map(unit => Math.abs(unit.total)));

    $('unitsChart').innerHTML = units.map(unit => `
      <button class="bar-row unit-row unit-link${unit.code === selectedUnit ? ' active' : ''}" data-unit="${esc(unit.code)}" type="button">
        <span class="bar-name"><b>${esc(unit.name)}</b><small>${num.format(unit.count)} işlem · ${total ? (unit.total / total * 100).toFixed(1) : 0}% pay</small></span>
        <span class="bar-track"><span class="bar-fill unit-fill" style="width:${Math.abs(unit.total) / max * 100}%"></span></span>
        <span class="bar-value">${euro.format(unit.total)}</span>
      </button>`).join('') || 'Kayıt yok';

    $('unitsBody').innerHTML = units.map(unit => `
      <tr><td><b>${esc(unit.name)}</b></td><td>${num.format(unit.count)}</td><td>${euro.format(unit.total)}</td><td>${euro.format(unit.count ? unit.total / unit.count : 0)}</td><td>${total ? (unit.total / total * 100).toFixed(1) : 0}%</td></tr>`).join('');
    $('unitsFoot').innerHTML = `<tr><td>GENEL TOPLAM</td><td>${num.format(rows.length)}</td><td>${euro.format(total)}</td><td>${euro.format(rows.length ? total / rows.length : 0)}</td><td>${rows.length ? '100%' : '0%'}</td></tr>`;
  }

  render = function (data) {
    originalRender(data);
    const rows = data.rows || [];
    renderUnits(rows, rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0));
  };
})();
