(() => {
  'use strict';

  // ---------- Urgencia ----------

  const URGENCIAS = [
    { value: 'no_hay', label: 'No hay', rank: 3 },
    { value: 'poco', label: 'Queda poco', rank: 2 },
    { value: 'por_si_acaso', label: 'Aún queda', rank: 1 },
  ];
  const URGENCIA_LABEL = Object.fromEntries(URGENCIAS.map((u) => [u.value, u.label]));
  const URGENCIA_RANK = Object.fromEntries(URGENCIAS.map((u) => [u.value, u.rank]));

  // ---------- Empleado (persistido en este teléfono) ----------

  const EMPLOYEE_KEY = 'inventarioEmpleadoNombre';
  let employeeName = (localStorage.getItem(EMPLOYEE_KEY) || '').trim();

  function setEmployeeName(name) {
    employeeName = name.trim();
    localStorage.setItem(EMPLOYEE_KEY, employeeName);
    document.getElementById('employee-name-label').textContent = employeeName;
  }

  // ---------- Estado en memoria ----------

  let catalogEdits = { edits: {}, deleted: {}, custom: [] };
  const EFFECTIVE = { rieles: [], barras: [], sectionsRieles: [], sectionsBarras: [] };
  let myRequests = new Map(); // product_id -> { id, urgencia }
  let myOtros = [];           // filas activas de "otros" del empleado actual

  let onlyMarked = false;
  let activeTab = 'rieles';
  let catalogoView = 'rieles';
  const openSections = { rieles: new Set(), barras: new Set() };
  const openCatalogoSections = { rieles: new Set(), barras: new Set() };

  let adminReports = [];
  let adminViewingReportId = 'current';

  const ACCENTS = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ñ: 'n', ü: 'u' };
  function norm(s) {
    return (s || '').toString().toLowerCase().replace(/[áéíóúñü]/g, (c) => ACCENTS[c] || c);
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function todayISO() { return new Date().toISOString().slice(0, 10); }

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

  function showError(message) {
    console.error(message);
    showToast(message);
  }

  // ---------- Empleado: modal de nombre ----------

  function initEmployeeName() {
    document.getElementById('employee-name-label').textContent = employeeName || '-';
    if (!employeeName) openEmployeeModal();

    document.getElementById('btn-change-employee').addEventListener('click', openEmployeeModal);
    document.getElementById('employee-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('employee-name-input');
      if (!input.value.trim()) return;
      setEmployeeName(input.value);
      document.getElementById('employee-modal').hidden = true;
      loadMyRequests();
    });
  }

  function openEmployeeModal() {
    const input = document.getElementById('employee-name-input');
    input.value = employeeName;
    document.getElementById('employee-modal').hidden = false;
    setTimeout(() => input.focus(), 50);
  }

  // ---------- Catálogo compartido (Supabase) ----------

  // Migración única: la app antes guardaba las ediciones del catálogo
  // (fabricante, ref. fabricante, productos agregados) en este localStorage
  // de cada teléfono. Al pasar a Supabase esos datos quedaron "huérfanos" en
  // el teléfono donde se habían escrito. Si siguen ahí, se suben una sola
  // vez al catálogo compartido para no perderlos.
  const LEGACY_CATALOG_KEY = 'inventarioCatalogoEditsV1';
  const LEGACY_MIGRATED_KEY = 'inventarioCatalogoMigradoV1';

  async function migrateLegacyCatalogIfNeeded() {
    if (localStorage.getItem(LEGACY_MIGRATED_KEY)) return;
    try {
      const raw = localStorage.getItem(LEGACY_CATALOG_KEY);
      if (!raw) { localStorage.setItem(LEGACY_MIGRATED_KEY, '1'); return; }
      const legacy = JSON.parse(raw);
      const edits = legacy.edits || {};
      const deleted = legacy.deleted || {};
      const custom = Array.isArray(legacy.custom) ? legacy.custom : [];

      const catalogoDe = (itemId) => (CATALOG_RIELES.some((it) => it.id === itemId) ? 'rieles' : 'barras');

      const editRows = Object.entries(edits).map(([itemId, patch]) => ({
        item_id: itemId, catalogo: catalogoDe(itemId), grupo: patch.grupo, producto: patch.prod,
        color: patch.color || null, fabricante: patch.fabricante || null, ref_fabricante: patch.refFabricante || null,
      }));
      const deletedRows = Object.keys(deleted).map((itemId) => ({ item_id: itemId, catalogo: catalogoDe(itemId) }));
      const customRows = custom.map((c) => ({
        id: c.id, catalogo: c.catalogo, grupo: c.grupo, cat: c.cat || '-Accesorio', producto: c.prod,
        color: c.color || null, fabricante: c.fabricante || null, ref_fabricante: c.refFabricante || null,
      }));

      if (editRows.length === 0 && deletedRows.length === 0 && customRows.length === 0) {
        localStorage.setItem(LEGACY_MIGRATED_KEY, '1');
        return;
      }

      const tasks = [];
      if (editRows.length) tasks.push(sb.from('inv_catalog_edits').upsert(editRows));
      if (deletedRows.length) tasks.push(sb.from('inv_catalog_deleted').upsert(deletedRows));
      if (customRows.length) tasks.push(sb.from('inv_catalog_custom').upsert(customRows));
      const results = await Promise.all(tasks);
      if (results.some((r) => r && r.error)) {
        showError('No se pudo recuperar tu catálogo anterior (fabricantes/referencias). Se reintentará más tarde.');
        return; // no marcamos como migrado: se reintenta en la próxima carga
      }
      localStorage.setItem(LEGACY_MIGRATED_KEY, '1');
      showToast('Se recuperaron los fabricantes y productos que tenías guardados antes.');
    } catch (e) {
      console.error(e);
    }
  }

  async function loadCatalogFromSupabase() {
    const [editsRes, deletedRes, customRes] = await Promise.all([
      sb.from('inv_catalog_edits').select('*'),
      sb.from('inv_catalog_deleted').select('*'),
      sb.from('inv_catalog_custom').select('*'),
    ]);
    if (editsRes.error || deletedRes.error || customRes.error) {
      showError('No se pudo cargar el catálogo compartido. Revisa tu conexión.');
      return;
    }
    catalogEdits.edits = {};
    (editsRes.data || []).forEach((row) => {
      catalogEdits.edits[row.item_id] = { grupo: row.grupo, prod: row.producto, color: row.color, fabricante: row.fabricante, refFabricante: row.ref_fabricante };
    });
    catalogEdits.deleted = {};
    (deletedRes.data || []).forEach((row) => { catalogEdits.deleted[row.item_id] = true; });
    catalogEdits.custom = (customRes.data || []).map((row) => ({
      id: row.id, catalogo: row.catalogo, grupo: row.grupo, cat: row.cat, prod: row.producto,
      color: row.color, fabricante: row.fabricante, refFabricante: row.ref_fabricante,
    }));
    rebuildEffectiveCatalog();
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
      .forEach((c) => out.push({ id: c.id, grupo: c.grupo, cat: c.cat || '-Accesorio', prod: c.prod, color: c.color || '', fabricante: c.fabricante || '', refFabricante: c.refFabricante || '', custom: true }));
    return out;
  }

  function buildSectionsFrom(list) {
    const sections = [];
    const byTitle = new Map();
    list.forEach((item) => {
      let sec = byTitle.get(item.grupo);
      if (!sec) { sec = { title: item.grupo, items: [] }; byTitle.set(item.grupo, sec); sections.push(sec); }
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

  function refreshCatalogUI() {
    renderSections(EFFECTIVE.sectionsRieles, 'panel-rieles-list', 'rieles');
    renderSections(EFFECTIVE.sectionsBarras, 'panel-barras-list', 'barras');
    renderCatalogo();
    updateSummary();
    applyFilters();
  }

  // ---------- Mis peticiones activas (semana en curso) ----------

  async function loadMyRequests() {
    if (!employeeName) return;
    const { data, error } = await sb
      .from('inv_requests')
      .select('*')
      .eq('empleado', employeeName)
      .is('report_id', null);
    if (error) {
      showError('No se pudieron cargar tus marcas. Revisa tu conexión.');
      return;
    }
    myRequests = new Map();
    myOtros = [];
    (data || []).forEach((row) => {
      if (row.catalogo === 'otros') {
        myOtros.push(row);
      } else {
        myRequests.set(row.product_id, { id: row.id, urgencia: row.urgencia });
      }
    });
    refreshCatalogUI();
    renderOtros();
  }

  async function setUrgencia(item, catalogo, value) {
    const current = myRequests.get(item.id);
    try {
      if (current && current.urgencia === value) {
        const { error } = await sb.from('inv_requests').delete().eq('id', current.id);
        if (error) throw error;
        myRequests.delete(item.id);
      } else if (current) {
        const { error } = await sb.from('inv_requests').update({ urgencia: value }).eq('id', current.id);
        if (error) throw error;
        myRequests.set(item.id, { id: current.id, urgencia: value });
      } else {
        const row = {
          catalogo, product_id: item.id, grupo: item.grupo, producto: item.prod,
          color: item.color || null, fabricante: item.fabricante || null, ref_fabricante: item.refFabricante || null,
          urgencia: value, empleado: employeeName,
        };
        const { data, error } = await sb.from('inv_requests').insert(row).select().single();
        if (error) throw error;
        myRequests.set(item.id, { id: data.id, urgencia: value });
      }
    } catch (e) {
      showError('No se pudo guardar. Revisa tu conexión a internet.');
    }
    updateSummary();
  }

  // ---------- Render de catálogos (secciones plegables) ----------

  function urgencyPicker(activeValue, onPick) {
    const wrap = document.createElement('div');
    wrap.className = 'urgencia-picker';
    URGENCIAS.forEach((u) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `urg-btn urg-${u.value}` + (activeValue === u.value ? ' active' : '');
      btn.textContent = u.label;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onPick(u.value, btn, wrap);
      });
      wrap.appendChild(btn);
    });
    return wrap;
  }

  function buildItemRow(item, catalogo) {
    const row = document.createElement('div');
    const current = myRequests.get(item.id);
    row.className = 'item-row cat-row' + (current ? ' is-checked' : '');
    row.dataset.id = item.id;
    row.dataset.search = norm([item.cat, item.prod, item.color, item.fabricante, item.refFabricante].join(' '));

    const info = document.createElement('div');
    info.className = 'item-info';
    const fabricanteTxt = [item.fabricante, item.refFabricante].filter(Boolean).join(' · ');
    info.innerHTML =
      `<span class="item-name">${escapeHtml(item.prod)}</span>` +
      (item.color ? `<span class="item-color">${escapeHtml(item.color)}</span>` : '') +
      (fabricanteTxt ? `<span class="item-fab">${escapeHtml(fabricanteTxt)}</span>` : '');

    const picker = urgencyPicker(current?.urgencia, async (value, btn, wrap) => {
      await setUrgencia(item, catalogo, value);
      const nowActive = myRequests.has(item.id);
      row.classList.toggle('is-checked', nowActive);
      wrap.querySelectorAll('.urg-btn').forEach((b) => b.classList.toggle('active', b === btn && nowActive));
    });

    row.appendChild(info);
    row.appendChild(picker);
    return row;
  }

  function sectionCounts(section) {
    const total = section.items.length;
    const done = section.items.filter((it) => myRequests.has(it.id)).length;
    return { total, done };
  }

  function buildSectionEl(section, tabKey) {
    const wrap = document.createElement('section');
    wrap.className = 'cat-section';
    wrap.dataset.title = section.title;

    const { total, done } = sectionCounts(section);
    if (openSections[tabKey].has(section.title)) wrap.classList.add('open');

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'cat-header';
    header.innerHTML =
      `<span class="chevron">›</span>` +
      `<span class="cat-title">${escapeHtml(section.title)}</span>` +
      `<span class="cat-count${done ? ' has-marked' : ''}">${done}/${total}</span>`;
    header.addEventListener('click', () => {
      const nowOpen = wrap.classList.toggle('open');
      if (nowOpen) openSections[tabKey].add(section.title); else openSections[tabKey].delete(section.title);
    });

    const body = document.createElement('div');
    body.className = 'cat-body';
    section.items.forEach((item) => body.appendChild(buildItemRow(item, tabKey)));

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

  // ---------- Otros (fuera de catálogo) ----------

  function renderOtros() {
    const container = document.getElementById('otros-list');
    container.innerHTML = '';
    if (myOtros.length === 0) {
      container.innerHTML = '<p class="empty-hint">No has agregado productos adicionales.</p>';
      return;
    }
    myOtros.forEach((o) => {
      const row = document.createElement('div');
      row.className = 'item-row is-checked otro-row';
      const fab = [o.fabricante, o.ref_fabricante].filter(Boolean).join(' · ');
      row.innerHTML =
        `<span class="check-box static urg-dot-${o.urgencia}" aria-hidden="true"></span>` +
        `<div class="item-info">` +
        `<span class="item-name">${escapeHtml(o.producto)}</span>` +
        (o.color ? `<span class="item-color">${escapeHtml(o.color)}</span>` : '') +
        (o.categoria ? `<span class="item-nota">${escapeHtml(o.categoria)}</span>` : '') +
        (fab ? `<span class="item-fab">${escapeHtml(fab)}</span>` : '') +
        `<span class="item-nota">${escapeHtml(URGENCIA_LABEL[o.urgencia] || '')}</span>` +
        `</div>` +
        `<button type="button" class="btn-icon btn-remove" aria-label="Eliminar">✕</button>`;
      row.querySelector('.btn-remove').addEventListener('click', async () => {
        try {
          const { error } = await sb.from('inv_requests').delete().eq('id', o.id);
          if (error) throw error;
          myOtros = myOtros.filter((x) => x.id !== o.id);
          renderOtros();
          updateSummary();
        } catch (e) {
          showError('No se pudo eliminar. Revisa tu conexión.');
        }
      });
      container.appendChild(row);
    });
  }

  function initOtroForm() {
    const form = document.getElementById('otro-form');
    let selectedUrgencia = null;
    document.querySelectorAll('#otro-urgencia .urg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedUrgencia = btn.dataset.urg;
        document.querySelectorAll('#otro-urgencia .urg-btn').forEach((b) => b.classList.toggle('active', b === btn));
      });
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cat = document.getElementById('otro-cat').value.trim();
      const prod = document.getElementById('otro-prod').value.trim();
      const color = document.getElementById('otro-color').value.trim();
      const fabricante = document.getElementById('otro-fabricante').value.trim();
      const refFabricante = document.getElementById('otro-ref').value.trim();
      if (!prod) { alert('Indica al menos el nombre del producto.'); return; }
      if (!selectedUrgencia) { alert('Indica la urgencia (No hay / Queda poco / Aún queda).'); return; }
      const productId = 'o-' + slugify([prod, color].join('-'));
      try {
        const { data, error } = await sb.from('inv_requests').insert({
          catalogo: 'otros', product_id: productId, grupo: null, categoria: cat || null,
          producto: prod, color: color || null, fabricante: fabricante || null, ref_fabricante: refFabricante || null,
          urgencia: selectedUrgencia, empleado: employeeName,
        }).select().single();
        if (error) throw error;
        myOtros.push(data);
        renderOtros();
        updateSummary();
        form.reset();
        selectedUrgencia = null;
        document.querySelectorAll('#otro-urgencia .urg-btn').forEach((b) => b.classList.remove('active'));
      } catch (e) {
        showError('No se pudo agregar. Revisa tu conexión.');
      }
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
      (item.color ? `<span class="item-color">${escapeHtml(item.color)}</span>` : '') +
      (item.fabricante || item.refFabricante ? `<span class="item-nota">${escapeHtml([item.fabricante, item.refFabricante].filter(Boolean).join(' · '))}</span>` : '');

    const actions = document.createElement('div');
    actions.className = 'catalogo-row-actions';
    actions.innerHTML =
      `<button type="button" class="btn-icon btn-edit" aria-label="Editar">✎</button>` +
      `<button type="button" class="btn-icon btn-remove" aria-label="Eliminar">✕</button>`;
    actions.querySelector('.btn-edit').addEventListener('click', () => renderCatalogoRowEdit(row, item));
    actions.querySelector('.btn-remove').addEventListener('click', async () => {
      const label = item.color ? `${item.prod} (${item.color})` : item.prod;
      if (!confirm(`¿Eliminar "${label}" del catálogo? Esta acción no se puede deshacer.`)) return;
      await deleteCatalogItem(item);
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
    const fabricanteInput = inputEl(item.fabricante, 'Fabricante (opcional)');
    const refInput = inputEl(item.refFabricante, 'Ref. fabricante (opcional)');
    const fields = document.createElement('div');
    fields.className = 'catalogo-edit-fields';
    fields.append(grupoInput, prodInput, colorInput, fabricanteInput, refInput);

    const actions = document.createElement('div');
    actions.className = 'catalogo-row-actions';
    actions.innerHTML =
      `<button type="button" class="btn-icon btn-save" aria-label="Guardar">✓</button>` +
      `<button type="button" class="btn-icon btn-cancel" aria-label="Cancelar">✕</button>`;
    actions.querySelector('.btn-save').addEventListener('click', async () => {
      const grupo = grupoInput.value.trim();
      const prod = prodInput.value.trim();
      const color = colorInput.value.trim();
      const fabricante = fabricanteInput.value.trim();
      const refFabricante = refInput.value.trim();
      if (!grupo || !prod) { alert('El grupo y el producto son obligatorios.'); return; }
      await saveCatalogEdit(item, { grupo, prod, color, fabricante, refFabricante });
    });
    actions.querySelector('.btn-cancel').addEventListener('click', () => renderCatalogoRowView(row, item));

    row.appendChild(fields);
    row.appendChild(actions);
  }

  async function saveCatalogEdit(item, patch) {
    try {
      if (item.custom) {
        const { error } = await sb.from('inv_catalog_custom').update({
          grupo: patch.grupo, producto: patch.prod, color: patch.color || null,
          fabricante: patch.fabricante || null, ref_fabricante: patch.refFabricante || null,
        }).eq('id', item.id);
        if (error) throw error;
        const c = catalogEdits.custom.find((x) => x.id === item.id);
        if (c) Object.assign(c, patch);
      } else {
        const catalogo = EFFECTIVE.rieles.some((it) => it.id === item.id) ? 'rieles' : 'barras';
        const { error } = await sb.from('inv_catalog_edits').upsert({
          item_id: item.id, catalogo, grupo: patch.grupo, producto: patch.prod, color: patch.color || null,
          fabricante: patch.fabricante || null, ref_fabricante: patch.refFabricante || null,
        });
        if (error) throw error;
        catalogEdits.edits[item.id] = patch;
      }
      rebuildEffectiveCatalog();
      refreshCatalogUI();
      showToast('Producto actualizado.');
    } catch (e) {
      showError('No se pudo guardar. Revisa tu conexión.');
    }
  }

  async function deleteCatalogItem(item) {
    try {
      if (item.custom) {
        const { error } = await sb.from('inv_catalog_custom').delete().eq('id', item.id);
        if (error) throw error;
        catalogEdits.custom = catalogEdits.custom.filter((x) => x.id !== item.id);
      } else {
        const catalogo = EFFECTIVE.rieles.some((it) => it.id === item.id) ? 'rieles' : 'barras';
        const { error } = await sb.from('inv_catalog_deleted').upsert({ item_id: item.id, catalogo });
        if (error) throw error;
        catalogEdits.deleted[item.id] = true;
      }
      rebuildEffectiveCatalog();
      refreshCatalogUI();
      showToast('Producto eliminado del catálogo.');
    } catch (e) {
      showError('No se pudo eliminar. Revisa tu conexión.');
    }
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
      header.innerHTML = `<span class="chevron">›</span><span class="cat-title">${escapeHtml(section.title)}</span><span class="cat-count">${section.items.length}</span>`;
      header.addEventListener('click', () => {
        const nowOpen = wrap.classList.toggle('open');
        if (nowOpen) openCatalogoSections[catalogoView].add(section.title); else openCatalogoSections[catalogoView].delete(section.title);
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
      btn.addEventListener('click', () => { catalogoView = btn.dataset.cat; renderCatalogo(); });
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
    cancelBtn.addEventListener('click', () => { form.reset(); form.hidden = true; addBtn.hidden = false; });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const grupo = document.getElementById('prod-grupo').value.trim();
      const prod = document.getElementById('prod-nombre').value.trim();
      const color = document.getElementById('prod-color').value.trim();
      const fabricante = document.getElementById('prod-fabricante').value.trim();
      const refFabricante = document.getElementById('prod-ref').value.trim();
      if (!grupo || !prod) { alert('Indica al menos el grupo/sección y el producto.'); return; }
      const list = catalogoView === 'rieles' ? EFFECTIVE.rieles : EFFECTIVE.barras;
      const yaExiste = list.some((it) => norm(it.prod) === norm(prod) && norm(it.color || '') === norm(color));
      if (yaExiste) {
        const seguir = confirm(`Ya existe "${prod}${color ? ' - ' + color : ''}" en el catálogo. Si querías agregarle fabricante o cambiar algo, cancela y usa el lápiz ✎ para editarlo en vez de crear uno duplicado.\n\n¿Agregarlo de todas formas como un producto nuevo?`);
        if (!seguir) return;
      }
      const id = newCustomId();
      try {
        const { error } = await sb.from('inv_catalog_custom').insert({
          id, catalogo: catalogoView, grupo, cat: '-Accesorio', producto: prod, color: color || null,
          fabricante: fabricante || null, ref_fabricante: refFabricante || null,
        });
        if (error) throw error;
        catalogEdits.custom.push({ id, catalogo: catalogoView, grupo, cat: '-Accesorio', prod, color, fabricante, refFabricante });
        openCatalogoSections[catalogoView].add(grupo);
        rebuildEffectiveCatalog();
        refreshCatalogUI();
        form.reset();
        form.hidden = true;
        addBtn.hidden = false;
        showToast('Producto agregado al catálogo.');
      } catch (e) {
        showError('No se pudo agregar. Revisa tu conexión.');
      }
    });

    document.getElementById('btn-restaurar-catalogo').addEventListener('click', async () => {
      const total = Object.keys(catalogEdits.edits).length + Object.keys(catalogEdits.deleted).length + catalogEdits.custom.length;
      if (total === 0) return;
      if (!confirm('¿Restaurar el catálogo a la versión original para TODOS los teléfonos? Se perderán los productos agregados, editados o eliminados manualmente. No se puede deshacer.')) return;
      try {
        await Promise.all([
          sb.from('inv_catalog_edits').delete().neq('item_id', ''),
          sb.from('inv_catalog_deleted').delete().neq('item_id', ''),
          sb.from('inv_catalog_custom').delete().neq('id', ''),
        ]);
        catalogEdits = { edits: {}, deleted: {}, custom: [] };
        rebuildEffectiveCatalog();
        refreshCatalogUI();
        showToast('Catálogo restaurado a la versión original.');
      } catch (e) {
        showError('No se pudo restaurar. Revisa tu conexión.');
      }
    });
  }

  // ---------- Resumen / filtros ----------

  function updateSummary() {
    document.getElementById('summary-lines').textContent = myRequests.size + myOtros.length;
    document.getElementById('badge-otros').textContent = myOtros.length;
    document.getElementById('badge-otros').style.display = myOtros.length ? 'inline-flex' : 'none';

    const progress = document.getElementById('tab-progress');
    const fill = document.getElementById('tab-progress-fill');
    const list = activeTab === 'rieles' ? EFFECTIVE.rieles : activeTab === 'barras' ? EFFECTIVE.barras : null;
    if (list) {
      const done = list.filter((it) => myRequests.has(it.id)).length;
      progress.style.visibility = 'visible';
      fill.style.width = (list.length ? (done / list.length) * 100 : 0) + '%';
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
        applyFilters();
        updateSummary();
      });
    });
  }

  // ---------- Vaciar mis marcas ----------

  async function clearMyRequests() {
    if (myRequests.size === 0 && myOtros.length === 0) return;
    if (!confirm('¿Vaciar todo lo que has marcado? No se puede deshacer.')) return;
    try {
      const { error } = await sb.from('inv_requests').delete().eq('empleado', employeeName).is('report_id', null);
      if (error) throw error;
      myRequests = new Map();
      myOtros = [];
      refreshCatalogUI();
      renderOtros();
      showToast('Tus marcas se vaciaron.');
    } catch (e) {
      showError('No se pudo vaciar. Revisa tu conexión.');
    }
  }

  // =========================================================
  // ADMIN
  // =========================================================

  function initAdmin() {
    document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('admin-email').value.trim();
      const password = document.getElementById('admin-password').value;
      const errEl = document.getElementById('admin-login-error');
      errEl.hidden = true;
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        errEl.textContent = 'No se pudo entrar: revisa el email y la contraseña.';
        errEl.hidden = false;
        return;
      }
      await showAdminPanel();
    });

    document.getElementById('btn-admin-logout').addEventListener('click', async () => {
      await sb.auth.signOut();
      document.getElementById('admin-panel').hidden = true;
      document.getElementById('admin-login-box').hidden = false;
    });

    document.getElementById('btn-cerrar-semana').addEventListener('click', async () => {
      if (!confirm('¿Cerrar la semana ahora y archivar todo lo pendiente en un informe nuevo?')) return;
      const { error } = await sb.rpc('inv_close_weekly_report');
      if (error) { showError('No se pudo cerrar la semana.'); return; }
      showToast('Semana cerrada. Informe generado.');
      await loadAdminReports();
      await renderAdminReportView();
    });

    document.getElementById('admin-report-select').addEventListener('change', async (e) => {
      adminViewingReportId = e.target.value;
      await renderAdminReportView();
    });

    document.getElementById('btn-admin-pdf').addEventListener('click', async () => {
      const { data, meta } = await fetchAdminReportData(adminViewingReportId);
      if (!hasReportData(data)) { alert('No hay productos en este informe.'); return; }
      const doc = renderAdminPdfDoc(data, meta);
      doc.save(`Informe_Inventario_${meta.label.replace(/[^\w]+/g, '_')}.pdf`);
    });
    document.getElementById('btn-admin-print').addEventListener('click', async () => {
      const { data, meta } = await fetchAdminReportData(adminViewingReportId);
      if (!hasReportData(data)) { alert('No hay productos en este informe.'); return; }
      document.getElementById('print-area').innerHTML = buildAdminPrintHtml(data, meta);
      window.print();
    });

    // Restaura sesión si ya había una activa
    sb.auth.getSession().then(({ data }) => {
      if (data.session) showAdminPanel();
    });
  }

  async function showAdminPanel() {
    document.getElementById('admin-login-box').hidden = true;
    document.getElementById('admin-panel').hidden = false;
    await loadAdminReports();
    adminViewingReportId = 'current';
    await renderAdminReportView();
  }

  async function loadAdminReports() {
    const { data, error } = await sb.from('inv_weekly_reports').select('*').order('created_at', { ascending: false });
    adminReports = error ? [] : (data || []);
    const select = document.getElementById('admin-report-select');
    select.innerHTML = '<option value="current">Semana en curso</option>' +
      adminReports.map((r) => `<option value="${r.id}">${escapeHtml(r.label)}</option>`).join('');
  }

  function urgenciaRankOf(v) { return URGENCIA_RANK[v] || 0; }

  async function fetchAdminReportData(reportId) {
    let query = sb.from('inv_requests').select('*');
    query = reportId === 'current' ? query.is('report_id', null) : query.eq('report_id', reportId);
    const { data, error } = await query;
    if (error) { showError('No se pudo cargar el informe.'); return { data: { rieles: [], barras: [], otros: [] }, meta: { label: '' } }; }

    const groups = { rieles: new Map(), barras: new Map(), otros: new Map() };
    (data || []).forEach((row) => {
      const bucket = groups[row.catalogo] || groups.otros;
      let entry = bucket.get(row.product_id);
      if (!entry) {
        entry = { grupo: row.grupo, categoria: row.categoria, producto: row.producto, color: row.color, fabricante: row.fabricante, refFabricante: row.ref_fabricante, urgencia: row.urgencia, empleados: new Set() };
        bucket.set(row.product_id, entry);
      }
      entry.empleados.add(row.empleado);
      if (urgenciaRankOf(row.urgencia) > urgenciaRankOf(entry.urgencia)) entry.urgencia = row.urgencia;
    });

    const toGroupsByGrupo = (map) => {
      const sections = [];
      const byTitle = new Map();
      map.forEach((entry) => {
        const title = entry.grupo || entry.categoria || 'Otros';
        let sec = byTitle.get(title);
        if (!sec) { sec = { title, rows: [] }; byTitle.set(title, sec); sections.push(sec); }
        sec.rows.push(entry);
      });
      return sections;
    };

    const label = reportId === 'current' ? `Semana en curso (${todayISO()})` : (adminReports.find((r) => r.id === reportId)?.label || 'Informe');
    return {
      data: { rieles: toGroupsByGrupo(groups.rieles), barras: toGroupsByGrupo(groups.barras), otros: toGroupsByGrupo(groups.otros) },
      meta: { label },
    };
  }

  function hasReportData(data) {
    return data.rieles.length > 0 || data.barras.length > 0 || data.otros.length > 0;
  }

  function entryRowHtml(entry) {
    return `<tr class="urg-row-${entry.urgencia}">` +
      `<td>${escapeHtml(entry.producto)}</td>` +
      `<td>${escapeHtml(entry.color || '')}</td>` +
      `<td>${escapeHtml(URGENCIA_LABEL[entry.urgencia] || '')}</td>` +
      `<td>${escapeHtml(entry.fabricante || '')}</td>` +
      `<td>${escapeHtml(entry.refFabricante || '')}</td>` +
      `<td>${escapeHtml([...entry.empleados].join(', '))}</td>` +
      `</tr>`;
  }

  function sectionsToHtml(sections) {
    if (!sections.length) return '';
    let rows = '';
    sections.forEach((sec) => {
      rows += `<tr class="group-row"><td colspan="6">${escapeHtml(sec.title)}</td></tr>`;
      sec.rows.forEach((entry) => { rows += entryRowHtml(entry); });
    });
    return `<table><thead><tr><th>Producto</th><th>Color</th><th>Urgencia</th><th>Fabricante</th><th>Ref.</th><th>Marcado por</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  async function renderAdminReportView() {
    const { data, meta } = await fetchAdminReportData(adminViewingReportId);
    const el = document.getElementById('admin-report-content');
    if (!hasReportData(data)) {
      el.innerHTML = '<p class="empty-hint">No hay productos marcados en este informe.</p>';
      return;
    }
    el.innerHTML =
      (data.rieles.length ? `<h3>Guías y Rieles</h3><div class="history-table-wrap">${sectionsToHtml(data.rieles)}</div>` : '') +
      (data.barras.length ? `<h3>Barras</h3><div class="history-table-wrap">${sectionsToHtml(data.barras)}</div>` : '') +
      (data.otros.length ? `<h3>Otros</h3><div class="history-table-wrap">${sectionsToHtml(data.otros)}</div>` : '');
  }

  function renderAdminPdfDoc(data, meta) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const marginX = 30;
    let y = 50;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('INFORME DE INVENTARIO', marginX, y);
    y += 20;
    doc.setFontSize(11);
    doc.text(meta.label, marginX, y);
    y += 20;

    function groupedBody(sections) {
      const rows = [];
      sections.forEach((sec) => {
        rows.push([{ content: sec.title, colSpan: 6, styles: { fontStyle: 'bold', fillColor: [225, 232, 242], textColor: [27, 47, 75] } }]);
        sec.rows.forEach((entry) => rows.push([
          entry.producto, entry.color || '', URGENCIA_LABEL[entry.urgencia] || '',
          entry.fabricante || '', entry.refFabricante || '', [...entry.empleados].join(', '),
        ]));
      });
      return rows;
    }

    function printSection(title, sections) {
      if (!sections.length) return;
      if (y > 700) { doc.addPage(); y = 50; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(title, marginX, y);
      doc.autoTable({
        startY: y + 6,
        margin: { left: marginX, right: marginX },
        head: [['Producto', 'Color', 'Urgencia', 'Fabricante', 'Ref.', 'Marcado por']],
        body: groupedBody(sections),
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [37, 61, 90] },
        columnStyles: { 1: { cellWidth: 60 }, 2: { cellWidth: 55 }, 3: { cellWidth: 65 }, 4: { cellWidth: 55 }, 5: { cellWidth: 90 } },
      });
      y = doc.lastAutoTable.finalY + 20;
    }

    printSection('Sistemas de Guías y Rieles', data.rieles);
    printSection('Sistemas de Barras', data.barras);
    printSection('Otros', data.otros);

    return doc;
  }

  function buildAdminPrintHtml(data, meta) {
    return `<h1>Informe de Inventario</h1><p class="print-fecha">${escapeHtml(meta.label)}</p>` +
      (data.rieles.length ? `<h2>Sistemas de Guías y Rieles</h2>${sectionsToHtml(data.rieles)}` : '') +
      (data.barras.length ? `<h2>Sistemas de Barras</h2>${sectionsToHtml(data.barras)}` : '') +
      (data.otros.length ? `<h2>Otros</h2>${sectionsToHtml(data.otros)}` : '');
  }

  // ---------- Init ----------

  document.addEventListener('DOMContentLoaded', async () => {
    initEmployeeName();
    initTabs();
    initOtroForm();
    initCatalogoTab();
    initAdmin();

    document.getElementById('search-input').addEventListener('input', applyFilters);
    document.getElementById('only-marked').addEventListener('change', (e) => { onlyMarked = e.target.checked; applyFilters(); });
    document.getElementById('btn-clear').addEventListener('click', clearMyRequests);

    await migrateLegacyCatalogIfNeeded();
    await loadCatalogFromSupabase();
    if (employeeName) await loadMyRequests();
    renderOtros();
    updateSummary();
    applyFilters();
  });
})();
