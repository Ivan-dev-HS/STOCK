(() => {
  'use strict';

  const STORAGE_KEY = 'inventarioPedidoV4';
  const HISTORY_KEY = 'inventarioHistorialV2';
  const CATALOG_EDITS_KEY = 'inventarioCatalogoEditsV1';
  const HISTORY_MAX = 50;
  const todayISO = () => new Date().toISOString().slice(0, 10);

  const defaultState = () => ({
    header: { solicitante: '', fecha: todayISO(), observaciones: '' },
    checked: {}, // { itemId: true } -> marcado "hay que pedir"
    otros: [],   // [{ id, cat, prod, color }]
  });

  let state = loadState();
  let history = loadHistory();
  let catalogEdits = loadCatalogEdits();
  let onlyMarked = false;
  let activeTab = 'rieles';
  let catalogoView = 'rieles';
  const openSections = { rieles: new Set(), barras: new Set() };
  const openCatalogoSections = { rieles: new Set(), barras: new Set() };
  const openHistory = new Set();
  const EFFECTIVE = { rieles: [], barras: [], sectionsRieles: [], sectionsBarras: [] };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return migrateOldState();
      const parsed = JSON.parse(raw);
      const base = defaultState();
      return {
        header: { ...base.header, ...(parsed.header || {}) },
        checked: parsed.checked || {},
        otros: Array.isArray(parsed.otros) ? parsed.otros : [],
      };
    } catch (e) {
      return defaultState();
    }
  }

  // Compatibilidad con versiones anteriores: los ids de producto cambiaron
  // de formato y ya no hay cantidades, así que las marcas viejas no se
  // pueden migrar, pero sí los datos del pedido (fecha, solicitante,
  // observaciones) y los nombres de los productos "Otros" ya agregados.
  function migrateOldState() {
    const base = defaultState();
    try {
      const raw = localStorage.getItem('inventarioPedidoV3')
        || localStorage.getItem('inventarioPedidoV2')
        || localStorage.getItem('inventarioPedidoV1');
      if (!raw) return base;
      const old = JSON.parse(raw);
      base.header = { ...base.header, ...(old.header || {}) };
      base.otros = (Array.isArray(old.otros) ? old.otros : []).map((o) => ({ id: o.id, cat: o.cat, prod: o.prod, color: o.color }));
    } catch (e) { /* ignora */ }
    return base;
  }

  function saveState() {
    // Guardado inmediato (sin debounce): el JSON es pequeño y así no se
    // pierde una marca si el usuario cierra la app justo después.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory() {
    if (history.length > HISTORY_MAX) history.length = HISTORY_MAX;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  // ---------- Edición manual del catálogo ----------
  //
  // El catálogo base (js/catalog-data.js) queda tal cual viene de las
  // planillas originales. Los cambios que el usuario hace desde la pestaña
  // "Catálogo" (agregar, editar, eliminar) se guardan aparte, como una capa
  // encima del catálogo base, para poder "Restaurar" en cualquier momento
  // sin perder la referencia original.

  function defaultCatalogEdits() {
    return {
      edits: {},   // { itemId: { grupo, prod, color } } -> reemplaza esos campos en un item base
      deleted: {}, // { itemId: true } -> oculta un item base
      custom: [],  // [{ id, catalogo:'rieles'|'barras', grupo, cat, prod, color }] -> items nuevos
    };
  }

  function loadCatalogEdits() {
    try {
      const raw = localStorage.getItem(CATALOG_EDITS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      const base = defaultCatalogEdits();
      if (!parsed) return base;
      return {
        edits: parsed.edits || {},
        deleted: parsed.deleted || {},
        custom: Array.isArray(parsed.custom) ? parsed.custom : [],
      };
    } catch (e) {
      return defaultCatalogEdits();
    }
  }

  function saveCatalogEdits() {
    localStorage.setItem(CATALOG_EDITS_KEY, JSON.stringify(catalogEdits));
  }

  function buildEffectiveList(catalogo) {
    const base = catalogo === 'rieles' ? CATALOG_RIELES : CATALOG_BARRAS;
    const out = [];
    base.forEach((it) => {
      if (catalogEdits.deleted[it.id]) return;
      const patch = catalogEdits.edits[it.id];
      out.push(patch ? { ...it, ...patch } : it);
    });
    catalogEdits.custom
      .filter((c) => c.catalogo === catalogo && !catalogEdits.deleted[c.id])
      .forEach((c) => out.push({ id: c.id, grupo: c.grupo, cat: c.cat || '-Accesorio', prod: c.prod, color: c.color || '', custom: true }));
    return out;
  }

  // Agrupa por "grupo" (sin exigir que estén contiguos en el arreglo), para
  // que un producto agregado a un grupo ya existente se una a esa misma
  // sección en vez de crear una sección duplicada al final.
  function buildSectionsFrom(list) {
    const sections = [];
    const byTitle = new Map();
    list.forEach((item) => {
      let sec = byTitle.get(item.grupo);
      if (!sec) {
        sec = { title: item.grupo, items: [] };
        byTitle.set(item.grupo, sec);
        sections.push(sec);
      }
      sec.items.push(item);
    });
    return sections;
  }

  function rebuildEffectiveCatalog() {
    EFFECTIVE.rieles = buildEffectiveList('rieles');
    EFFECTIVE.barras = buildEffectiveList('barras');
    EFFECTIVE.sectionsRieles = buildSectionsFrom(EFFECTIVE.rieles);
    EFFECTIVE.sectionsBarras = buildSectionsFrom(EFFECTIVE.barras);
  }

  function refreshEverything() {
    rebuildEffectiveCatalog();
    renderSections(EFFECTIVE.sectionsRieles, 'panel-rieles-list', 'rieles');
    renderSections(EFFECTIVE.sectionsBarras, 'panel-barras-list', 'barras');
    renderCatalogo();
    updateSummary();
    applyFilters();
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

  function formatFechaLarga(iso) {
    if (!iso) return '-';
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  }

  // ---------- Aviso flotante (toast) ----------

  let toastTimer = null;
  function showToast(message) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
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
    return label;
  }

  function sectionCounts(section) {
    const total = section.items.length;
    const done = section.items.filter((it) => state.checked[it.id]).length;
    return { total, done };
  }

  function buildSectionEl(section, tabKey) {
    const wrap = document.createElement('section');
    wrap.className = 'cat-section';
    wrap.dataset.title = section.title;

    const { total, done } = sectionCounts(section);
    const isOpen = openSections[tabKey].has(section.title);
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
      if (nowOpen) openSections[tabKey].add(section.title);
      else openSections[tabKey].delete(section.title);
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
    sections.forEach((section) => {
      const { done } = sectionCounts(section);
      if (done > 0) openSections[tabKey].add(section.title);
      frag.appendChild(buildSectionEl(section, tabKey));
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
        `<button type="button" class="btn-icon btn-remove" aria-label="Eliminar">✕</button>`;
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
      if (!prod) {
        alert('Indica al menos el nombre del producto.');
        return;
      }
      state.otros.push({ id: 'o' + Date.now(), cat, prod, color });
      saveState();
      form.reset();
      renderOtros();
      updateSummary();
    });
  }

  // ---------- Catálogo (agregar / editar / eliminar productos) ----------

  function newCustomId() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function inputEl(value, placeholder) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value || '';
    input.placeholder = placeholder;
    input.className = 'catalogo-edit-input';
    return input;
  }

  function buildCatalogoRow(item) {
    const row = document.createElement('div');
    row.className = 'item-row catalogo-row';
    row.dataset.id = item.id;
    renderCatalogoRowView(row, item);
    return row;
  }

  function renderCatalogoRowView(row, item) {
    row.innerHTML = '';
    row.classList.remove('is-editing');

    const info = document.createElement('div');
    info.className = 'item-info';
    info.innerHTML =
      `<span class="item-name">${escapeHtml(item.prod)}</span>` +
      (item.color ? `<span class="item-color">${escapeHtml(item.color)}</span>` : '');

    const actions = document.createElement('div');
    actions.className = 'catalogo-row-actions';
    actions.innerHTML =
      `<button type="button" class="btn-icon btn-edit" aria-label="Editar">✎</button>` +
      `<button type="button" class="btn-icon btn-remove" aria-label="Eliminar">✕</button>`;
    actions.querySelector('.btn-edit').addEventListener('click', () => renderCatalogoRowEdit(row, item));
    actions.querySelector('.btn-remove').addEventListener('click', () => {
      const label = item.color ? `${item.prod} (${item.color})` : item.prod;
      if (!confirm(`¿Eliminar "${label}" del catálogo? Esta acción no se puede deshacer.`)) return;
      deleteCatalogItem(item);
    });

    row.appendChild(info);
    row.appendChild(actions);
  }

  function renderCatalogoRowEdit(row, item) {
    row.innerHTML = '';
    row.classList.add('is-editing');

    const grupoInput = inputEl(item.grupo, 'Grupo / sección');
    const prodInput = inputEl(item.prod, 'Producto');
    const colorInput = inputEl(item.color, 'Color (opcional)');
    const fields = document.createElement('div');
    fields.className = 'catalogo-edit-fields';
    fields.append(grupoInput, prodInput, colorInput);

    const actions = document.createElement('div');
    actions.className = 'catalogo-row-actions';
    actions.innerHTML =
      `<button type="button" class="btn-icon btn-save" aria-label="Guardar">✓</button>` +
      `<button type="button" class="btn-icon btn-cancel" aria-label="Cancelar">✕</button>`;
    actions.querySelector('.btn-save').addEventListener('click', () => {
      const grupo = grupoInput.value.trim();
      const prod = prodInput.value.trim();
      const color = colorInput.value.trim();
      if (!grupo || !prod) {
        alert('El grupo y el producto son obligatorios.');
        return;
      }
      saveCatalogEdit(item, { grupo, prod, color });
    });
    actions.querySelector('.btn-cancel').addEventListener('click', () => renderCatalogoRowView(row, item));

    row.appendChild(fields);
    row.appendChild(actions);
  }

  function saveCatalogEdit(item, patch) {
    if (item.custom) {
      const c = catalogEdits.custom.find((x) => x.id === item.id);
      if (c) Object.assign(c, patch);
    } else {
      catalogEdits.edits[item.id] = patch;
    }
    saveCatalogEdits();
    refreshEverything();
    showToast('Producto actualizado.');
  }

  function deleteCatalogItem(item) {
    if (item.custom) {
      catalogEdits.custom = catalogEdits.custom.filter((x) => x.id !== item.id);
    } else {
      catalogEdits.deleted[item.id] = true;
    }
    delete state.checked[item.id];
    saveState();
    saveCatalogEdits();
    refreshEverything();
    showToast('Producto eliminado del catálogo.');
  }

  function populateGruposDatalist() {
    const dl = document.getElementById('grupos-datalist');
    const sections = catalogoView === 'rieles' ? EFFECTIVE.sectionsRieles : EFFECTIVE.sectionsBarras;
    dl.innerHTML = sections.map((s) => `<option value="${escapeHtml(s.title)}"></option>`).join('');
  }

  function renderCatalogo() {
    document.querySelectorAll('.catalogo-switch-btn').forEach((b) => b.classList.toggle('active', b.dataset.cat === catalogoView));
    const sections = catalogoView === 'rieles' ? EFFECTIVE.sectionsRieles : EFFECTIVE.sectionsBarras;
    const container = document.getElementById('catalogo-list');
    container.innerHTML = '';
    if (sections.length === 0) {
      container.innerHTML = '<p class="empty-hint">No hay productos en este catálogo.</p>';
      return;
    }
    const frag = document.createDocumentFragment();
    sections.forEach((section) => {
      const wrap = document.createElement('section');
      wrap.className = 'cat-section';
      wrap.dataset.title = section.title;
      if (openCatalogoSections[catalogoView].has(section.title)) wrap.classList.add('open');

      const header = document.createElement('button');
      header.type = 'button';
      header.className = 'cat-header';
      header.innerHTML =
        `<span class="chevron">›</span>` +
        `<span class="cat-title">${escapeHtml(section.title)}</span>` +
        `<span class="cat-count">${section.items.length}</span>`;
      header.addEventListener('click', () => {
        const nowOpen = wrap.classList.toggle('open');
        if (nowOpen) openCatalogoSections[catalogoView].add(section.title);
        else openCatalogoSections[catalogoView].delete(section.title);
      });

      const body = document.createElement('div');
      body.className = 'cat-body';
      section.items.forEach((item) => body.appendChild(buildCatalogoRow(item)));

      wrap.appendChild(header);
      wrap.appendChild(body);
      frag.appendChild(wrap);
    });
    container.appendChild(frag);
  }

  function initCatalogoTab() {
    document.querySelectorAll('.catalogo-switch-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        catalogoView = btn.dataset.cat;
        renderCatalogo();
      });
    });

    const form = document.getElementById('producto-form');
    const addBtn = document.getElementById('btn-add-producto');
    const cancelBtn = document.getElementById('btn-cancel-producto');

    addBtn.addEventListener('click', () => {
      populateGruposDatalist();
      form.hidden = false;
      addBtn.hidden = true;
      document.getElementById('prod-grupo').focus();
    });
    cancelBtn.addEventListener('click', () => {
      form.reset();
      form.hidden = true;
      addBtn.hidden = false;
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const grupo = document.getElementById('prod-grupo').value.trim();
      const prod = document.getElementById('prod-nombre').value.trim();
      const color = document.getElementById('prod-color').value.trim();
      if (!grupo || !prod) {
        alert('Indica al menos el grupo/sección y el producto.');
        return;
      }
      catalogEdits.custom.push({ id: newCustomId(), catalogo: catalogoView, grupo, cat: '-Accesorio', prod, color });
      saveCatalogEdits();
      openCatalogoSections[catalogoView].add(grupo);
      refreshEverything();
      form.reset();
      form.hidden = true;
      addBtn.hidden = false;
      showToast('Producto agregado al catálogo.');
    });

    document.getElementById('btn-restaurar-catalogo').addEventListener('click', () => {
      const total = Object.keys(catalogEdits.edits).length + Object.keys(catalogEdits.deleted).length + catalogEdits.custom.length;
      if (total === 0) return;
      if (!confirm('¿Restaurar el catálogo a la versión original? Se perderán los productos agregados, editados o eliminados manualmente. No se puede deshacer.')) return;
      catalogEdits = defaultCatalogEdits();
      saveCatalogEdits();
      refreshEverything();
      showToast('Catálogo restaurado a la versión original.');
    });
  }

  // ---------- Resumen / filtros ----------

  function countMarked() {
    let lines = 0;
    EFFECTIVE.rieles.forEach((it) => { if (state.checked[it.id]) lines++; });
    EFFECTIVE.barras.forEach((it) => { if (state.checked[it.id]) lines++; });
    lines += state.otros.length;
    return { lines };
  }

  function catalogProgress(tabKey) {
    const list = tabKey === 'rieles' ? EFFECTIVE.rieles : tabKey === 'barras' ? EFFECTIVE.barras : null;
    if (!list) return null;
    const total = list.length;
    const done = list.filter((it) => state.checked[it.id]).length;
    return { total, done };
  }

  function updateSummary() {
    const { lines } = countMarked();
    document.getElementById('summary-lines').textContent = lines;
    document.getElementById('badge-otros').textContent = state.otros.length;
    document.getElementById('badge-otros').style.display = state.otros.length ? 'inline-flex' : 'none';
    document.getElementById('badge-historial').textContent = history.length;
    document.getElementById('badge-historial').style.display = history.length ? 'inline-flex' : 'none';

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
      const sections = activeTab === 'rieles' ? EFFECTIVE.sectionsRieles : EFFECTIVE.sectionsBarras;
      const section = sections.find((s) => s.title === secEl.dataset.title);
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
        const showToolbar = activeTab === 'rieles' || activeTab === 'barras';
        document.querySelector('.toolbar').style.display = showToolbar ? '' : 'none';
        if (!showToolbar) document.getElementById('tab-progress').style.visibility = 'hidden';
        if (activeTab === 'catalogo') renderCatalogo();
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

  function refreshHeaderForm() {
    document.getElementById('f-fecha').value = state.header.fecha;
    document.getElementById('f-observaciones').value = state.header.observaciones;
  }

  // ---------- Construcción de los datos del pedido (agrupado por sección) ----------

  function groupByGrupo(catalog) {
    const groups = [];
    const byTitle = new Map();
    catalog.forEach((it) => {
      if (!state.checked[it.id]) return;
      let g = byTitle.get(it.grupo);
      if (!g) {
        g = { title: it.grupo, rows: [] };
        byTitle.set(it.grupo, g);
        groups.push(g);
      }
      g.rows.push([it.prod, it.color || '']);
    });
    return groups;
  }

  function buildOrderData() {
    const rielesGroups = groupByGrupo(EFFECTIVE.rieles);
    const barrasGroups = groupByGrupo(EFFECTIVE.barras);
    const otros = state.otros.map((o) => [o.cat || '', o.prod, o.color || '']);
    return { rielesGroups, barrasGroups, otros };
  }

  function hasOrderData(data) {
    return data.rielesGroups.length > 0 || data.barrasGroups.length > 0 || data.otros.length > 0;
  }

  // ---------- Generación de PDF ----------

  function renderPdfDoc(header, data, totals) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const marginX = 40;
    let y = 50;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('PEDIDO DE MATERIAL', marginX, y);
    y += 26;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`Fecha: ${header.fecha || todayISO()}`, marginX, y);
    y += 20;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Solicitado por: ${header.solicitante || '-'}`, marginX, y);
    y += 14;
    if (header.observaciones) {
      const wrapped = doc.splitTextToSize(`Observaciones: ${header.observaciones}`, 515);
      doc.text(wrapped, marginX, y);
      y += wrapped.length * 12 + 4;
    }
    y += 8;

    function groupedBody(groups) {
      const rows = [];
      groups.forEach((g) => {
        rows.push([{ content: g.title, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [225, 232, 242], textColor: [27, 47, 75] } }]);
        g.rows.forEach((r) => rows.push(r));
      });
      return rows;
    }

    function printSection(title, groups) {
      if (!groups.length) return;
      if (y > 700) { doc.addPage(); y = 50; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(title, marginX, y);
      doc.autoTable({
        startY: y + 6,
        margin: { left: marginX, right: marginX },
        head: [['Producto', 'Color']],
        body: groupedBody(groups),
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [37, 61, 90] },
      });
      y = doc.lastAutoTable.finalY + 26;
    }

    printSection('Sistemas de Guías y Rieles', data.rielesGroups);
    printSection('Sistemas de Barras', data.barrasGroups);

    if (data.otros.length) {
      if (y > 700) { doc.addPage(); y = 50; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Productos adicionales', marginX, y);
      doc.autoTable({
        startY: y + 6,
        margin: { left: marginX, right: marginX },
        head: [['Categoría', 'Producto', 'Color']],
        body: data.otros,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [37, 61, 90] },
      });
      y = doc.lastAutoTable.finalY + 26;
    }

    if (y > 740) { doc.addPage(); y = 50; }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Total de productos marcados: ${totals.lines}`, marginX, y);

    return doc;
  }

  function generatePDF() {
    const data = buildOrderData();
    if (!hasOrderData(data)) {
      alert('No hay productos marcados. Marca al menos un producto antes de generar el pedido.');
      return;
    }
    const totals = countMarked();
    const doc = renderPdfDoc(state.header, data, totals);
    doc.save(`Pedido_Material_${state.header.fecha || todayISO()}.pdf`);
    saveToHistory(data, totals);
    performClear();
    showToast('Pedido guardado en el historial. Se vaciaron las marcas para el próximo pedido.');
  }

  // ---------- Vista de impresión ----------

  function groupsToHtml(groups) {
    if (!groups.length) return '';
    let rows = '';
    groups.forEach((g) => {
      rows += `<tr class="group-row"><td colspan="2">${escapeHtml(g.title)}</td></tr>`;
      g.rows.forEach((r) => { rows += `<tr><td>${escapeHtml(r[0])}</td><td>${escapeHtml(r[1])}</td></tr>`; });
    });
    return `<table><thead><tr><th>Producto</th><th>Color</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function buildPrintHtml(header, data, totals) {
    const otrosTable = () => {
      if (!data.otros.length) return '';
      return `<h2>Productos adicionales</h2><table><thead><tr><th>Categoría</th><th>Producto</th><th>Color</th></tr></thead>` +
        `<tbody>${data.otros.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    };
    return `<h1>Pedido de Material</h1>` +
      `<p class="print-fecha"><strong>Fecha:</strong> ${escapeHtml(header.fecha || todayISO())}</p>` +
      `<p><strong>Solicitado por:</strong> ${escapeHtml(header.solicitante || '-')}</p>` +
      (header.observaciones ? `<p><strong>Observaciones:</strong> ${escapeHtml(header.observaciones)}</p>` : '') +
      (data.rielesGroups.length ? `<h2>Sistemas de Guías y Rieles</h2>${groupsToHtml(data.rielesGroups)}` : '') +
      (data.barrasGroups.length ? `<h2>Sistemas de Barras</h2>${groupsToHtml(data.barrasGroups)}` : '') +
      otrosTable() +
      `<p class="print-total">Total de productos marcados: ${totals.lines}</p>`;
  }

  function printOrder() {
    const data = buildOrderData();
    if (!hasOrderData(data)) {
      alert('No hay productos marcados. Marca al menos un producto antes de imprimir.');
      return;
    }
    const totals = countMarked();
    document.getElementById('print-area').innerHTML = buildPrintHtml(state.header, data, totals);
    window.print();
    saveToHistory(data, totals);
    performClear();
    showToast('Pedido guardado en el historial. Se vaciaron las marcas para el próximo pedido.');
  }

  function printHistoryEntry(entry) {
    document.getElementById('print-area').innerHTML = buildPrintHtml(entry.header, entry.data, entry.totals);
    window.print();
  }

  // ---------- Historial de pedidos ----------

  function saveToHistory(data, totals) {
    if (totals.lines === 0) return;
    history.unshift({
      id: 'h' + Date.now(),
      createdAt: new Date().toISOString(),
      header: { ...state.header },
      data,
      totals,
    });
    saveHistory();
    renderHistory();
  }

  function renderHistory() {
    const container = document.getElementById('historial-list');
    container.innerHTML = '';
    if (history.length === 0) {
      container.innerHTML = '<p class="empty-hint">Todavía no has generado ningún pedido. Al tocar "Generar PDF" o "Imprimir" quedará guardado aquí.</p>';
      return;
    }
    const frag = document.createDocumentFragment();
    history.forEach((entry, i) => {
      const wrap = document.createElement('section');
      wrap.className = 'cat-section history-card';
      if (openHistory.has(entry.id)) wrap.classList.add('open');

      const header = document.createElement('button');
      header.type = 'button';
      header.className = 'cat-header history-header';
      header.innerHTML =
        `<span class="chevron">›</span>` +
        `<span class="history-info">` +
        `<span class="history-date">${escapeHtml(formatFechaLarga(entry.header.fecha))}</span>` +
        `<span class="history-meta">${escapeHtml(entry.header.solicitante || 'Sin nombre')} · ${entry.totals.lines} productos</span>` +
        `</span>`;
      header.addEventListener('click', () => {
        const nowOpen = wrap.classList.toggle('open');
        if (nowOpen) openHistory.add(entry.id); else openHistory.delete(entry.id);
      });

      const body = document.createElement('div');
      body.className = 'cat-body history-body';

      const otrosTable = () => {
        if (!entry.data.otros.length) return '';
        return `<h3>Otros</h3><div class="history-table-wrap"><table><thead><tr><th>Categoría</th><th>Producto</th><th>Color</th></tr></thead>` +
          `<tbody>${entry.data.otros.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      };
      body.innerHTML =
        (entry.header.observaciones ? `<p class="history-obs"><strong>Observaciones:</strong> ${escapeHtml(entry.header.observaciones)}</p>` : '') +
        (entry.data.rielesGroups.length ? `<h3>Guías y Rieles</h3><div class="history-table-wrap">${groupsToHtml(entry.data.rielesGroups)}</div>` : '') +
        (entry.data.barrasGroups.length ? `<h3>Barras</h3><div class="history-table-wrap">${groupsToHtml(entry.data.barrasGroups)}</div>` : '') +
        otrosTable();

      const actions = document.createElement('div');
      actions.className = 'history-actions';
      actions.innerHTML =
        `<button type="button" class="btn btn-secondary history-pdf">Descargar PDF</button>` +
        `<button type="button" class="btn btn-secondary history-print">Imprimir</button>` +
        `<button type="button" class="btn btn-ghost history-delete">Eliminar</button>`;
      actions.querySelector('.history-pdf').addEventListener('click', () => {
        const doc = renderPdfDoc(entry.header, entry.data, entry.totals);
        doc.save(`Pedido_Material_${entry.header.fecha || i}.pdf`);
      });
      actions.querySelector('.history-print').addEventListener('click', () => printHistoryEntry(entry));
      actions.querySelector('.history-delete').addEventListener('click', () => {
        if (!confirm('¿Eliminar este pedido del historial? No se puede deshacer.')) return;
        history = history.filter((h) => h.id !== entry.id);
        saveHistory();
        renderHistory();
        updateSummary();
      });
      body.appendChild(actions);

      wrap.appendChild(header);
      wrap.appendChild(body);
      frag.appendChild(wrap);
    });
    container.appendChild(frag);
  }

  function initHistoryClear() {
    document.getElementById('btn-clear-historial').addEventListener('click', () => {
      if (history.length === 0) return;
      if (!confirm('¿Vaciar todo el historial de pedidos? No se puede deshacer.')) return;
      history = [];
      saveHistory();
      renderHistory();
      updateSummary();
    });
  }

  // ---------- Vaciar marcas ----------

  function performClear() {
    state.checked = {};
    state.otros = [];
    state.header.observaciones = '';
    state.header.fecha = todayISO();
    saveState();
    openSections.rieles.clear();
    openSections.barras.clear();
    renderSections(EFFECTIVE.sectionsRieles, 'panel-rieles-list', 'rieles');
    renderSections(EFFECTIVE.sectionsBarras, 'panel-barras-list', 'barras');
    renderOtros();
    refreshHeaderForm();
    updateSummary();
    applyFilters();
  }

  function clearAll() {
    if (!confirm('¿Vaciar todo lo marcado y los productos adicionales? Los datos de solicitante se mantienen.')) return;
    performClear();
  }

  // ---------- Init ----------

  document.addEventListener('DOMContentLoaded', () => {
    rebuildEffectiveCatalog();

    initHeaderForm();
    initTabs();
    initOtroForm();
    initHistoryClear();
    initCatalogoTab();

    renderSections(EFFECTIVE.sectionsRieles, 'panel-rieles-list', 'rieles');
    renderSections(EFFECTIVE.sectionsBarras, 'panel-barras-list', 'barras');
    renderOtros();
    renderHistory();
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
