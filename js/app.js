(() => {
  'use strict';

  const STORAGE_KEY = 'inventarioPedidoV1';
  const todayISO = () => new Date().toISOString().slice(0, 10);

  const defaultState = () => ({
    header: { sucursal: '', solicitante: '', fecha: todayISO(), observaciones: '' },
    qty: {},      // { itemId: number }               -> catálogo Guías/Rieles
    qtyDiam: {},  // { itemId: { d20, d28 } }          -> catálogo Barras
    otros: [],    // [{ id, cat, prod, color, cantidad }]
  });

  let state = loadState();
  let onlyMarked = false;
  let activeTab = 'rieles';
  let saveTimer = null;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const base = defaultState();
      return {
        header: { ...base.header, ...(parsed.header || {}) },
        qty: parsed.qty || {},
        qtyDiam: parsed.qtyDiam || {},
        otros: Array.isArray(parsed.otros) ? parsed.otros : [],
      };
    } catch (e) {
      return defaultState();
    }
  }

  function saveState() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, 200);
  }

  const ACCENTS = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ñ: 'n', ü: 'u' };
  function norm(s) {
    return (s || '')
      .toString()
      .toLowerCase()
      .replace(/[áéíóúñü]/g, (c) => ACCENTS[c] || c);
  }

  // ---------- Render de listas ----------

  function buildRow(item, kind) {
    const row = document.createElement('div');
    const isMain = !item.cat.startsWith('-');
    row.className = 'item-row' + (isMain ? ' is-main' : ' is-accessory');
    row.dataset.search = norm([item.cat, item.prod, item.color, item.nota].join(' '));

    const info = document.createElement('div');
    info.className = 'item-info';
    info.innerHTML =
      `<span class="item-cat">${escapeHtml(item.cat.replace(/^-/, ''))}</span>` +
      `<span class="item-name">${escapeHtml(item.prod)}</span>` +
      (item.color ? `<span class="item-color">${escapeHtml(item.color)}</span>` : '') +
      (item.nota ? `<span class="item-nota">${escapeHtml(item.nota)}</span>` : '');
    row.appendChild(info);

    const qtyBox = document.createElement('div');
    qtyBox.className = 'item-qty';

    if (item.diam) {
      qtyBox.appendChild(qtyInput(item.id, 'D20', state.qtyDiam[item.id]?.d20, (v) => {
        state.qtyDiam[item.id] = state.qtyDiam[item.id] || {};
        state.qtyDiam[item.id].d20 = v;
        afterChange(row);
      }));
      qtyBox.appendChild(qtyInput(item.id, 'D28', state.qtyDiam[item.id]?.d28, (v) => {
        state.qtyDiam[item.id] = state.qtyDiam[item.id] || {};
        state.qtyDiam[item.id].d28 = v;
        afterChange(row);
      }));
    } else {
      qtyBox.appendChild(qtyInput(item.id, 'Cant.', state.qty[item.id], (v) => {
        state.qty[item.id] = v;
        afterChange(row);
      }));
    }
    row.appendChild(qtyBox);
    return row;
  }

  function qtyInput(id, label, value, onChange) {
    const wrap = document.createElement('label');
    wrap.className = 'qty-field';
    const span = document.createElement('span');
    span.className = 'qty-label';
    span.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.inputMode = 'numeric';
    input.min = '0';
    input.placeholder = '0';
    input.value = value ? String(value) : '';
    input.addEventListener('input', () => {
      const n = parseInt(input.value, 10);
      onChange(Number.isFinite(n) && n > 0 ? n : undefined);
      saveState();
    });
    wrap.appendChild(span);
    wrap.appendChild(input);
    return wrap;
  }

  function afterChange(row) {
    row.classList.toggle('has-qty', rowHasQty(row));
    updateSummary();
    applyFilters();
  }

  function rowHasQty(row) {
    return [...row.querySelectorAll('input[type=number]')].some((i) => parseInt(i.value, 10) > 0);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderCatalog(list, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    list.forEach((item) => {
      const row = buildRow(item);
      if (rowHasQty(row)) row.classList.add('has-qty');
      frag.appendChild(row);
    });
    container.appendChild(frag);
  }

  // ---------- Productos adicionales (fuera de catálogo) ----------

  function renderOtros() {
    const container = document.getElementById('otros-list');
    container.innerHTML = '';
    if (state.otros.length === 0) {
      container.innerHTML = '<p class="empty-hint">No has agregado productos adicionales.</p>';
      return;
    }
    state.otros.forEach((o) => {
      const row = document.createElement('div');
      row.className = 'item-row is-main otro-row';
      row.innerHTML =
        `<div class="item-info">` +
        `<span class="item-cat">${escapeHtml(o.cat || 'Otro')}</span>` +
        `<span class="item-name">${escapeHtml(o.prod)}</span>` +
        (o.color ? `<span class="item-color">${escapeHtml(o.color)}</span>` : '') +
        `</div>` +
        `<div class="item-qty"><span class="qty-fixed">${o.cantidad}</span>` +
        `<button type="button" class="btn-icon btn-remove" aria-label="Eliminar">✕</button></div>`;
      row.querySelector('.btn-remove').addEventListener('click', () => {
        state.otros = state.otros.filter((x) => x.id !== o.id);
        saveState();
        renderOtros();
        updateSummary();
      });
      container.appendChild(row);
    });
  }

  function initOtroForm() {
    const form = document.getElementById('otro-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const cat = document.getElementById('otro-cat').value.trim();
      const prod = document.getElementById('otro-prod').value.trim();
      const color = document.getElementById('otro-color').value.trim();
      const cantidad = parseInt(document.getElementById('otro-cant').value, 10);
      if (!prod || !Number.isFinite(cantidad) || cantidad <= 0) {
        alert('Indica al menos el nombre del producto y una cantidad mayor que 0.');
        return;
      }
      state.otros.push({ id: 'o' + Date.now(), cat, prod, color, cantidad });
      saveState();
      form.reset();
      renderOtros();
      updateSummary();
    });
  }

  // ---------- Resumen / filtros ----------

  function countMarked() {
    let lines = 0;
    let units = 0;
    Object.values(state.qty).forEach((v) => { if (v > 0) { lines++; units += v; } });
    Object.values(state.qtyDiam).forEach((v) => {
      const d20 = v.d20 || 0, d28 = v.d28 || 0;
      if (d20 > 0) { lines++; units += d20; }
      if (d28 > 0) { lines++; units += d28; }
    });
    state.otros.forEach((o) => { lines++; units += o.cantidad; });
    return { lines, units };
  }

  function updateSummary() {
    const { lines, units } = countMarked();
    document.getElementById('summary-lines').textContent = lines;
    document.getElementById('summary-units').textContent = units;
    document.getElementById('badge-otros').textContent = state.otros.length;
    document.getElementById('badge-otros').style.display = state.otros.length ? 'inline-flex' : 'none';
  }

  function applyFilters() {
    const q = norm(document.getElementById('search-input').value);
    document.querySelectorAll('#panel-' + activeTab + ' .item-row').forEach((row) => {
      const matchesSearch = !q || row.dataset.search.includes(q);
      const matchesOnlyMarked = !onlyMarked || row.classList.contains('has-qty');
      row.style.display = matchesSearch && matchesOnlyMarked ? '' : 'none';
    });
  }

  // ---------- Tabs ----------

  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === 'panel-' + activeTab));
        applyFilters();
      });
    });
  }

  // ---------- Cabecera del pedido ----------

  function initHeaderForm() {
    const ids = { sucursal: 'f-sucursal', solicitante: 'f-solicitante', fecha: 'f-fecha', observaciones: 'f-observaciones' };
    Object.entries(ids).forEach(([key, id]) => {
      const el = document.getElementById(id);
      el.value = state.header[key] || (key === 'fecha' ? todayISO() : '');
      el.addEventListener('input', () => {
        state.header[key] = el.value;
        saveState();
      });
    });
  }

  // ---------- Construcción de los datos del pedido ----------

  function buildOrderData() {
    const rieles = CATALOG_RIELES
      .filter((it) => (state.qty[it.id] || 0) > 0)
      .map((it) => [it.cat.replace(/^-/, ''), it.prod, it.color || '', String(state.qty[it.id])]);

    const barras = CATALOG_BARRAS
      .filter((it) => (state.qtyDiam[it.id]?.d20 || 0) > 0 || (state.qtyDiam[it.id]?.d28 || 0) > 0)
      .map((it) => [
        it.cat.replace(/^-/, ''), it.prod, it.color || '',
        state.qtyDiam[it.id]?.d20 ? String(state.qtyDiam[it.id].d20) : '',
        state.qtyDiam[it.id]?.d28 ? String(state.qtyDiam[it.id].d28) : '',
      ]);

    const otros = state.otros.map((o) => [o.cat || '', o.prod, o.color || '', String(o.cantidad)]);

    return { rieles, barras, otros };
  }

  // ---------- Generación de PDF ----------

  function generatePDF() {
    const { rieles, barras, otros } = buildOrderData();
    if (!rieles.length && !barras.length && !otros.length) {
      alert('No hay productos con cantidad indicada. Marca al menos un producto antes de generar el pedido.');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const marginX = 40;
    let y = 50;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('PEDIDO DE MATERIAL', marginX, y);
    y += 22;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const h = state.header;
    const infoLines = [
      `Sucursal / Local: ${h.sucursal || '-'}`,
      `Solicitado por: ${h.solicitante || '-'}`,
      `Fecha: ${h.fecha || todayISO()}`,
    ];
    infoLines.forEach((line) => { doc.text(line, marginX, y); y += 14; });
    if (h.observaciones) {
      const wrapped = doc.splitTextToSize(`Observaciones: ${h.observaciones}`, 515);
      doc.text(wrapped, marginX, y);
      y += wrapped.length * 12 + 4;
    }
    y += 8;

    if (rieles.length) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Sistemas de Guías y Rieles', marginX, y);
      doc.autoTable({
        startY: y + 6,
        margin: { left: marginX, right: marginX },
        head: [['Categoría', 'Producto', 'Color', 'Cantidad']],
        body: rieles,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [37, 61, 90] },
        columnStyles: { 3: { halign: 'center', cellWidth: 60 } },
      });
      y = doc.lastAutoTable.finalY + 26;
    }

    if (barras.length) {
      if (y > 700) { doc.addPage(); y = 50; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Sistemas de Barras', marginX, y);
      doc.autoTable({
        startY: y + 6,
        margin: { left: marginX, right: marginX },
        head: [['Categoría', 'Producto', 'Color', 'D20', 'D28']],
        body: barras,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [37, 61, 90] },
        columnStyles: { 3: { halign: 'center', cellWidth: 45 }, 4: { halign: 'center', cellWidth: 45 } },
      });
      y = doc.lastAutoTable.finalY + 26;
    }

    if (otros.length) {
      if (y > 700) { doc.addPage(); y = 50; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Productos adicionales', marginX, y);
      doc.autoTable({
        startY: y + 6,
        margin: { left: marginX, right: marginX },
        head: [['Categoría', 'Producto', 'Color', 'Cantidad']],
        body: otros,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [37, 61, 90] },
        columnStyles: { 3: { halign: 'center', cellWidth: 60 } },
      });
      y = doc.lastAutoTable.finalY + 26;
    }

    const { lines, units } = countMarked();
    if (y > 740) { doc.addPage(); y = 50; }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Total líneas: ${lines}   Total unidades: ${units}`, marginX, y);
    y += 40;
    doc.text('Firma / Recibido:', marginX, y);
    doc.line(marginX + 90, y, marginX + 300, y);

    doc.save(`Pedido_Material_${h.fecha || todayISO()}.pdf`);
  }

  // ---------- Vista de impresión ----------

  function buildPrintView() {
    const { rieles, barras, otros } = buildOrderData();
    const h = state.header;
    const { lines, units } = countMarked();

    const table = (title, headers, rows) => {
      if (!rows.length) return '';
      return `<h2>${title}</h2><table><thead><tr>${headers.map((x) => `<th>${x}</th>`).join('')}</tr></thead>` +
        `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    };

    document.getElementById('print-area').innerHTML =
      `<h1>Pedido de Material</h1>` +
      `<p><strong>Sucursal / Local:</strong> ${escapeHtml(h.sucursal || '-')} &nbsp;&nbsp;` +
      `<strong>Solicitado por:</strong> ${escapeHtml(h.solicitante || '-')} &nbsp;&nbsp;` +
      `<strong>Fecha:</strong> ${escapeHtml(h.fecha || todayISO())}</p>` +
      (h.observaciones ? `<p><strong>Observaciones:</strong> ${escapeHtml(h.observaciones)}</p>` : '') +
      table('Sistemas de Guías y Rieles', ['Categoría', 'Producto', 'Color', 'Cantidad'], rieles) +
      table('Sistemas de Barras', ['Categoría', 'Producto', 'Color', 'D20', 'D28'], barras) +
      table('Productos adicionales', ['Categoría', 'Producto', 'Color', 'Cantidad'], otros) +
      `<p class="print-total">Total líneas: ${lines} &nbsp;&nbsp; Total unidades: ${units}</p>` +
      `<p class="print-firma">Firma / Recibido: __________________________</p>`;
  }

  function printOrder() {
    const { rieles, barras, otros } = buildOrderData();
    if (!rieles.length && !barras.length && !otros.length) {
      alert('No hay productos con cantidad indicada. Marca al menos un producto antes de imprimir.');
      return;
    }
    buildPrintView();
    window.print();
  }

  // ---------- Vaciar ----------

  function clearAll() {
    if (!confirm('¿Vaciar todas las cantidades y productos adicionales? Los datos de sucursal/solicitante se mantienen.')) return;
    state.qty = {};
    state.qtyDiam = {};
    state.otros = [];
    saveState();
    renderCatalog(CATALOG_RIELES, 'panel-rieles-list');
    renderCatalog(CATALOG_BARRAS, 'panel-barras-list');
    renderOtros();
    updateSummary();
  }

  // ---------- Init ----------

  document.addEventListener('DOMContentLoaded', () => {
    initHeaderForm();
    initTabs();
    initOtroForm();

    renderCatalog(CATALOG_RIELES, 'panel-rieles-list');
    renderCatalog(CATALOG_BARRAS, 'panel-barras-list');
    renderOtros();
    updateSummary();
    applyFilters();

    document.getElementById('search-input').addEventListener('input', applyFilters);
    document.getElementById('only-marked').addEventListener('change', (e) => {
      onlyMarked = e.target.checked;
      applyFilters();
    });
    document.getElementById('btn-pdf').addEventListener('click', generatePDF);
    document.getElementById('btn-print').addEventListener('click', printOrder);
    document.getElementById('btn-clear').addEventListener('click', clearAll);
  });
})();
