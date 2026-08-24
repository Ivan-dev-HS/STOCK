(() => {
  'use strict';

  const STORAGE_KEY = 'inventarioPedidoV3';
  const todayISO = () => new Date().toISOString().slice(0, 10);

  const defaultState = () => ({
    header: { solicitante: '', fecha: todayISO(), observaciones: '' },
    checked: {},  // { itemId: true }    -> marcado "hay que pedir"
    qty: {},      // { itemId: number }   -> cantidad opcional (Guías/Rieles)
    qtyDiam: {},  // { itemId: { d20, d28 } } -> cantidad opcional (Barras)
    otros: [],    // [{ id, cat, prod, color, cantidad }]
  });

  let state = loadState();
  let onlyMarked = false;
  let activeTab = 'rieles';
  const openSections = { rieles: new Set(), barras: new Set() };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return migrateOldState();
      const parsed = JSON.parse(raw);
      const base = defaultState();
      return {
        header: { ...base.header, ...(parsed.header || {}) },
        checked: parsed.checked || {},
        qty: parsed.qty || {},
        qtyDiam: parsed.qtyDiam || {},
        otros: Array.isArray(parsed.otros) ? parsed.otros : [],
      };
    } catch (e) {
      return defaultState();
    }
  }

  // Compatibilidad con versiones anteriores: los ids de producto cambiaron
  // de formato (ya no dependen de la posición en el catálogo), así que las
  // marcas/cantidades viejas no se pueden migrar, pero sí los datos del
  // pedido (fecha, solicitante, observaciones) y los productos "Otros".
  function migrateOldState() {
    const base = defaultState();
    try {
      const raw = localStorage.getItem('inventarioPedidoV2') || localStorage.getItem('inventarioPedidoV1');
      if (!raw) return base;
      const old = JSON.parse(raw);
      base.header = { ...base.header, ...(old.header || {}) };
      base.otros = Array.isArray(old.otros) ? old.otros : [];
    } catch (e) { /* ignora */ }
    return base;
  }

  function saveState() {
    // Guardado inmediato (sin debounce): el JSON es pequeño y así no se
    // pierde una marca si el usuario cierra la app justo después.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  const ACCENTS = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ñ: 'n', ü: 'u' };
  function norm(s) {
    return (s || '')
      .toString()
      .toLowerCase()
      .replace(/[áéíóúñü]/g, (c) => ACCENTS[c] || c);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- Render de catálogos (secciones plegables) ----------

  function buildItemRow(item) {
    const label = document.createElement('label');
    label.className = 'item-row';
    label.dataset.id = item.id;
    label.dataset.search = norm([item.cat, item.prod, item.color, item.nota].join(' '));

    const isChecked = !!state.checked[item.id];
    if (isChecked) label.classList.add('is-checked');

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'chk';
    chk.checked = isChecked;

    const box = document.createElement('span');
    box.className = 'check-box';
    box.setAttribute('aria-hidden', 'true');

    const info = document.createElement('div');
    info.className = 'item-info';
    info.innerHTML =
      `<span class="item-name">${escapeHtml(item.prod)}</span>` +
      (item.color ? `<span class="item-color">${escapeHtml(item.color)}</span>` : '') +
      (item.nota ? `<span class="item-nota">${escapeHtml(item.nota)}</span>` : '');

    const qtyBox = document.createElement('div');
    qtyBox.className = 'item-qty';
    if (item.diam) {
      qtyBox.appendChild(qtyInput('D20', state.qtyDiam[item.id]?.d20, (v) => {
        state.qtyDiam[item.id] = state.qtyDiam[item.id] || {};
        state.qtyDiam[item.id].d20 = v;
        saveState();
        updateSummary();
      }));
      qtyBox.appendChild(qtyInput('D28', state.qtyDiam[item.id]?.d28, (v) => {
        state.qtyDiam[item.id] = state.qtyDiam[item.id] || {};
        state.qtyDiam[item.id].d28 = v;
        saveState();
        updateSummary();
      }));
    } else {
      qtyBox.appendChild(qtyInput('Cant.', state.qty[item.id], (v) => {
        state.qty[item.id] = v;
        saveState();
        updateSummary();
      }));
    }

    chk.addEventListener('change', () => {
      state.checked[item.id] = chk.checked || undefined;
      if (!chk.checked) delete state.checked[item.id];
      label.classList.toggle('is-checked', chk.checked);
      saveState();
      updateSummary();
      applyFilters();
    });

    label.appendChild(chk);
    label.appendChild(box);
    label.appendChild(info);
    label.appendChild(qtyBox);
    return label;
  }

  function qtyInput(placeholder, value, onChange) {
    const wrap = document.createElement('span');
    wrap.className = 'qty-field';
    const input = document.createElement('input');
    input.type = 'number';
    input.inputMode = 'numeric';
    input.min = '0';
    input.placeholder = placeholder;
    input.value = value ? String(value) : '';
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('mousedown', (e) => e.stopPropagation());
    input.addEventListener('input', () => {
      const n = parseInt(input.value, 10);
      onChange(Number.isFinite(n) && n > 0 ? n : undefined);
    });
    wrap.appendChild(input);
    return wrap;
  }

  function sectionCounts(section) {
    const total = section.items.length;
    const done = section.items.filter((it) => state.checked[it.id]).length;
    return { total, done };
  }

  function buildSectionEl(section, sectionIndex, tabKey) {
    const wrap = document.createElement('section');
    wrap.className = 'cat-section';
    wrap.dataset.index = String(sectionIndex);

    const { total, done } = sectionCounts(section);
    const isOpen = openSections[tabKey].has(sectionIndex);
    if (isOpen) wrap.classList.add('open');

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'cat-header';
    header.innerHTML =
      `<span class="chevron">›</span>` +
      `<span class="cat-title">${escapeHtml(section.title)}</span>` +
      `<span class="cat-count${done ? ' has-marked' : ''}">${done}/${total}</span>`;
    header.addEventListener('click', () => {
      const nowOpen = wrap.classList.toggle('open');
      if (nowOpen) openSections[tabKey].add(sectionIndex);
      else openSections[tabKey].delete(sectionIndex);
    });

    const body = document.createElement('div');
    body.className = 'cat-body';
    section.items.forEach((item) => body.appendChild(buildItemRow(item)));

    wrap.appendChild(header);
    wrap.appendChild(body);
    return wrap;
  }

  function renderSections(sections, containerId, tabKey) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    sections.forEach((section, i) => {
      const { done } = sectionCounts(section);
      if (done > 0) openSections[tabKey].add(i);
      frag.appendChild(buildSectionEl(section, i, tabKey));
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
      row.className = 'item-row is-checked otro-row';
      row.innerHTML =
        `<span class="check-box static" aria-hidden="true"></span>` +
        `<div class="item-info">` +
        `<span class="item-name">${escapeHtml(o.prod)}</span>` +
        (o.color ? `<span class="item-color">${escapeHtml(o.color)}</span>` : '') +
        (o.cat ? `<span class="item-nota">${escapeHtml(o.cat)}</span>` : '') +
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
      const cantidadRaw = document.getElementById('otro-cant').value.trim();
      const cantidad = cantidadRaw ? parseInt(cantidadRaw, 10) : 1;
      if (!prod) {
        alert('Indica al menos el nombre del producto.');
        return;
      }
      state.otros.push({ id: 'o' + Date.now(), cat, prod, color, cantidad: Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1 });
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
    CATALOG_RIELES.forEach((it) => {
      if (!state.checked[it.id]) return;
      lines++;
      units += state.qty[it.id] || 1;
    });
    CATALOG_BARRAS.forEach((it) => {
      if (!state.checked[it.id]) return;
      lines++;
      const d = state.qtyDiam[it.id] || {};
      units += (d.d20 || 0) + (d.d28 || 0) || 1;
    });
    state.otros.forEach((o) => { lines++; units += o.cantidad; });
    return { lines, units };
  }

  function catalogProgress(tabKey) {
    const list = tabKey === 'rieles' ? CATALOG_RIELES : tabKey === 'barras' ? CATALOG_BARRAS : null;
    if (!list) return null;
    const total = list.length;
    const done = list.filter((it) => state.checked[it.id]).length;
    return { total, done };
  }

  function updateSummary() {
    const { lines, units } = countMarked();
    document.getElementById('summary-lines').textContent = lines;
    document.getElementById('summary-units').textContent = units;
    document.getElementById('badge-otros').textContent = state.otros.length;
    document.getElementById('badge-otros').style.display = state.otros.length ? 'inline-flex' : 'none';

    const progress = document.getElementById('tab-progress');
    const fill = document.getElementById('tab-progress-fill');
    const prog = catalogProgress(activeTab);
    if (prog) {
      progress.style.visibility = 'visible';
      fill.style.width = (prog.total ? (prog.done / prog.total) * 100 : 0) + '%';
    } else {
      progress.style.visibility = 'hidden';
    }

    document.querySelectorAll(`#panel-${activeTab} .cat-section`).forEach((secEl) => {
      const idx = Number(secEl.dataset.index);
      const sections = activeTab === 'rieles' ? SECTIONS_RIELES : SECTIONS_BARRAS;
      const section = sections[idx];
      if (!section) return;
      const { total, done } = sectionCounts(section);
      const countEl = secEl.querySelector('.cat-count');
      countEl.textContent = `${done}/${total}`;
      countEl.classList.toggle('has-marked', done > 0);
    });
  }

  function applyFilters() {
    const q = norm(document.getElementById('search-input').value);
    const filtering = !!q || onlyMarked;

    document.querySelectorAll(`#panel-${activeTab} .cat-section`).forEach((secEl) => {
      let visibleCount = 0;
      secEl.querySelectorAll('.item-row').forEach((row) => {
        const matchesSearch = !q || row.dataset.search.includes(q);
        const matchesOnlyMarked = !onlyMarked || row.classList.contains('is-checked');
        const visible = matchesSearch && matchesOnlyMarked;
        row.style.display = visible ? '' : 'none';
        if (visible) visibleCount++;
      });
      secEl.style.display = visibleCount === 0 && filtering ? 'none' : '';
      secEl.classList.toggle('force-open', filtering && visibleCount > 0);
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
        updateSummary();
      });
    });
  }

  // ---------- Cabecera del pedido ----------

  function initHeaderForm() {
    const ids = { solicitante: 'f-solicitante', fecha: 'f-fecha', observaciones: 'f-observaciones' };
    Object.entries(ids).forEach(([key, id]) => {
      const el = document.getElementById(id);
      el.value = state.header[key] || (key === 'fecha' ? todayISO() : '');
      el.addEventListener('input', () => {
        state.header[key] = el.value;
        saveState();
      });
    });

    const toggle = document.getElementById('order-header-toggle');
    const panel = document.getElementById('order-header-fields');
    toggle.addEventListener('click', () => {
      const open = panel.classList.toggle('open');
      toggle.classList.toggle('open', open);
    });
  }

  // ---------- Construcción de los datos del pedido ----------

  function buildOrderData() {
    const rieles = CATALOG_RIELES
      .filter((it) => state.checked[it.id])
      .map((it) => [it.cat.replace(/^-/, ''), it.prod, it.color || '', state.qty[it.id] ? String(state.qty[it.id]) : 'Sí']);

    const barras = CATALOG_BARRAS
      .filter((it) => state.checked[it.id])
      .map((it) => {
        const d = state.qtyDiam[it.id] || {};
        const d20 = d.d20 ? String(d.d20) : '';
        const d28 = d.d28 ? String(d.d28) : '';
        return [it.cat.replace(/^-/, ''), it.prod, it.color || '', d20 || (d28 ? '' : 'Sí'), d28];
      });

    const otros = state.otros.map((o) => [o.cat || '', o.prod, o.color || '', String(o.cantidad)]);

    return { rieles, barras, otros };
  }

  // ---------- Generación de PDF ----------

  function generatePDF() {
    const { rieles, barras, otros } = buildOrderData();
    if (!rieles.length && !barras.length && !otros.length) {
      alert('No hay productos marcados. Marca al menos un producto antes de generar el pedido.');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const marginX = 40;
    let y = 50;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('PEDIDO DE MATERIAL', marginX, y);
    y += 26;

    const h = state.header;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`Fecha: ${h.fecha || todayISO()}`, marginX, y);
    y += 20;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Solicitado por: ${h.solicitante || '-'}`, marginX, y);
    y += 14;
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
    doc.text(`Total líneas: ${lines}   Total unidades aprox.: ${units}`, marginX, y);

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
      `<p class="print-fecha"><strong>Fecha:</strong> ${escapeHtml(h.fecha || todayISO())}</p>` +
      `<p><strong>Solicitado por:</strong> ${escapeHtml(h.solicitante || '-')}</p>` +
      (h.observaciones ? `<p><strong>Observaciones:</strong> ${escapeHtml(h.observaciones)}</p>` : '') +
      table('Sistemas de Guías y Rieles', ['Categoría', 'Producto', 'Color', 'Cantidad'], rieles) +
      table('Sistemas de Barras', ['Categoría', 'Producto', 'Color', 'D20', 'D28'], barras) +
      table('Productos adicionales', ['Categoría', 'Producto', 'Color', 'Cantidad'], otros) +
      `<p class="print-total">Total líneas: ${lines} &nbsp;&nbsp; Total unidades aprox.: ${units}</p>`;
  }

  function printOrder() {
    const { rieles, barras, otros } = buildOrderData();
    if (!rieles.length && !barras.length && !otros.length) {
      alert('No hay productos marcados. Marca al menos un producto antes de imprimir.');
      return;
    }
    buildPrintView();
    window.print();
  }

  // ---------- Vaciar ----------

  function clearAll() {
    if (!confirm('¿Vaciar todo lo marcado y los productos adicionales? Los datos de solicitante se mantienen.')) return;
    state.checked = {};
    state.qty = {};
    state.qtyDiam = {};
    state.otros = [];
    saveState();
    openSections.rieles.clear();
    openSections.barras.clear();
    renderSections(SECTIONS_RIELES, 'panel-rieles-list', 'rieles');
    renderSections(SECTIONS_BARRAS, 'panel-barras-list', 'barras');
    renderOtros();
    updateSummary();
    applyFilters();
  }

  // ---------- Init ----------

  document.addEventListener('DOMContentLoaded', () => {
    initHeaderForm();
    initTabs();
    initOtroForm();

    renderSections(SECTIONS_RIELES, 'panel-rieles-list', 'rieles');
    renderSections(SECTIONS_BARRAS, 'panel-barras-list', 'barras');
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
