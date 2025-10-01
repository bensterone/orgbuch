// app.js (ES module)
// - enthält TreeStore + TreeRenderer + UIManager (wie vorher)
// - lazy-load für Editor.js (core + tools) & bpmn-js modeler
// - Editor init happens when entering edit mode (for documents).
// - BPMN Modeler init happens when opening process view.

/* ===========================
   CDN URLs (change versions if needed)
   - Editor.js core & tools (jsDelivr)
   - bpmn-js modeler (unpkg / jsDelivr)
   Sources: jsDelivr / editorjs docs / bpmn.io
   (see citations in assistant message)
   =========================== */
const CDN = {
  editor: 'https://cdn.jsdelivr.net/npm/@editorjs/editorjs@2.31.0/dist/editorjs.umd.js',
  header: 'https://cdn.jsdelivr.net/npm/@editorjs/header@2.8.8/dist/header.umd.js',
  list: 'https://cdn.jsdelivr.net/npm/@editorjs/list@2.0.8/dist/list.umd.js',
  quote: 'https://cdn.jsdelivr.net/npm/@editorjs/quote@2.6.0/dist/quote.umd.js',
  code: 'https://cdn.jsdelivr.net/npm/@editorjs/code@2.9.0/dist/code.umd.js',
  delimiter: 'https://cdn.jsdelivr.net/npm/@editorjs/delimiter@1.4.0/dist/delimiter.umd.js',
  marker: 'https://cdn.jsdelivr.net/npm/@editorjs/marker@1.4.0/dist/marker.umd.js',
  checklist: 'https://cdn.jsdelivr.net/npm/@editorjs/checklist@1.6.0/dist/checklist.umd.js',
  // bpmn modeler (UMD bundle)
  bpmnModeler: 'https://unpkg.com/bpmn-js/dist/bpmn-modeler.production.min.js'
};

/* ==========================
   Helper: dynamic script loader
   ========================== */
function loadScript(src, attrs = {}) {
  return new Promise((resolve, reject) => {
    // avoid duplicate loads
    if (document.querySelector(`script[src="${src}"]`)) {
      // wait a tick to ensure global is ready
      setTimeout(resolve, 50);
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
    s.onload = () => resolve();
    s.onerror = (e) => reject(new Error(`Failed to load script ${src}`));
    document.head.appendChild(s);
  });
}

/* ==========================
   Editor loader: loads Editor.js core + tools and returns class map for tools
   - Uses the UMD bundles which expose globals (EditorJS, Header, List, Quote, CodeTool, Delimiter, Marker, Checklist)
   - Returns { EditorJS, tools: { header: Header, ... } }
   ========================== */
let _editorLib = null;
async function ensureEditor() {
  if (_editorLib) return _editorLib;

  // Load core + tools sequentially (tools depend on EditorJS global API but not strictly in order)
  await loadScript(CDN.editor);
  // load tools
  await Promise.all([
    loadScript(CDN.header),
    loadScript(CDN.list),
    loadScript(CDN.quote),
    loadScript(CDN.code),
    loadScript(CDN.delimiter),
    loadScript(CDN.marker),
    loadScript(CDN.checklist)
  ]);

  // Map globals to tool classes (UMD exposes globals named Header, List, etc.)
  const tools = {};
  if (window.Header) tools.header = window.Header;
  if (window.List) tools.list = window.List;
  if (window.Quote) tools.quote = window.Quote;
  if (window.CodeTool) tools.code = window.CodeTool;
  if (window.Delimiter) tools.delimiter = window.Delimiter;
  if (window.Marker) tools.marker = window.Marker;
  if (window.Checklist) tools.checklist = window.Checklist;

  if (!window.EditorJS) throw new Error('EditorJS not available after loading script.');
  _editorLib = { EditorJS: window.EditorJS, tools };
  return _editorLib;
}

/* ==========================
   BPMN loader: loads bpmn-js modeler (global: BpmnJS)
   - returns the global constructor (window.BpmnJS)
   ========================== */
let _bpmnLib = null;
async function ensureBpmn() {
  if (_bpmnLib) return _bpmnLib;
  await loadScript(CDN.bpmnModeler);
  if (!window.BpmnJS && !window.bpmnjs && !window.bpmnModeler) {
    // older bundles expose BpmnJS
    if (!window.BpmnJS) throw new Error('bpmn-js not available after loading script.');
  }
  // common exposure is window.BpmnJS or window.bpmnjs
  _bpmnLib = window.BpmnJS || window.bpmnjs || window.bpmnModeler;
  if (!_bpmnLib) throw new Error('bpmn-js constructor not found on window.');
  return _bpmnLib;
}

/* ==========================
   (The rest is the same TreeStore/TreeRenderer/UIManager implementation,
    but with Editor + BPMN wiring)
   ========================== */

/* defaultData (same structure as before) */
const defaultData = {
  "WBG Zentrum": {
    id: 'wbg-root',
    icon: '🏢',
    type: 'root',
    children: {
      "Organigramm": {
        id: 'org-chart',
        icon: '📊',
        type: 'organigram'
      },
      "Unternehmen": {
        id: 'company-folder',
        icon: '🏬',
        type: 'folder',
        children: {
          "Vision und Leitbild": {
            id: 'vision-doc',
            icon: '👁️',
            type: 'document',
            editorData: {
              blocks: [
                { type: 'header', data: { text: 'Unsere Vision', level: 1 } },
                { type: 'paragraph', data: { text: 'Als Wohnungsbaugenossenschaft schaffen wir bezahlbaren, qualitätsvollen Wohnraum in Prenzlauer Berg und fördern das Gemeinschaftsgefühl unserer Mitglieder.' } },
                { type: 'header', data: { text: 'Unsere Werte', level: 2 } },
                { type: 'list', data: { style: 'unordered', items: ['Solidarität und Gemeinschaft','Nachhaltigkeit und Verantwortung','Transparenz und Vertrauen','Qualität und Zuverlässigkeit'] } }
              ]
            }
          }
        }
      },
      "Regelungen": {
        id: 'regulations-folder',
        icon: '📋',
        type: 'folder',
        children: {
          "Arbeitszeit": {
            id: 'worktime-doc',
            icon: '⏰',
            type: 'document',
            editorData: {
              blocks: [
                { type: 'header', data: { text: 'Arbeitszeitregelung', level: 1 } },
                { type: 'paragraph', data: { text: 'Regelung der Arbeitszeiten für alle Mitarbeiter der WBG Zentrum.' } }
              ]
            }
          }
        }
      },
      "Prozesse": {
        id: 'processes-folder',
        icon: '⚙️',
        type: 'folder',
        children: {
          "Wohnungswirtschaft": {
            id: 'housing-process',
            icon: '🏠',
            type: 'process',
            content: { type: 'bpmn', title: 'Mieterwechselprozess', bpmnXml: null }
          }
        }
      }
    }
  }
};

/* TreeStore (same as before) */
class TreeStore {
  constructor(data) {
    this.data = data ? JSON.parse(JSON.stringify(data)) : JSON.parse(JSON.stringify(defaultData));
    this.counter = 1000;
    this.index = [];
  }
  getRoot() { return this.data; }
  getNode(path) {
    if (!path) return null;
    const parts = path.split('/');
    let cur = this.data;
    for (const part of parts) {
      if (!cur[part]) return null;
      cur = cur[part];
    }
    return cur;
  }
  addItem(parentPath, name, template) {
    const parent = parentPath ? this.getNode(parentPath) : null;
    if (!parent) return null;
    if (!parent.children) parent.children = {};
    let finalName = name; let i = 1;
    while (parent.children[finalName]) finalName = `${name} (${i++})`;
    parent.children[finalName] = JSON.parse(JSON.stringify(template));
    parent.children[finalName].id = `id_${this.counter++}`;
    return `${parentPath}/${finalName}`;
  }
  removeItem(path) {
    const parts = path.split('/'); const name = parts.pop(); const parentPath = parts.join('/');
    const parent = parentPath ? this.getNode(parentPath) : this.data;
    if (parent && parent.children && parent.children[name]) { delete parent.children[name]; return true; }
    return false;
  }
  renameItem(path, newName) {
    const parts = path.split('/'); const name = parts.pop(); const parentPath = parts.join('/');
    const parent = parentPath ? this.getNode(parentPath) : this.data;
    if (!parent || !parent.children || !parent.children[name]) return null;
    if (parent.children[newName]) return null;
    parent.children[newName] = parent.children[name]; delete parent.children[name]; return `${parentPath}/${newName}`;
  }
  buildIndex() {
    const out = [];
    const walk = (node, path = '') => {
      for (const [k, v] of Object.entries(node)) {
        const p = path ? `${path}/${k}` : k;
        out.push({ name: k, path: p, type: v.type, icon: v.icon });
        if (v.children) walk(v.children, p);
      }
    };
    walk(this.data, '');
    this.index = out; return out;
  }
  export() { return JSON.stringify(this.data, null, 2); }
  import(json) { try { const parsed = JSON.parse(json); if (!parsed || typeof parsed !== 'object') return false; this.data = parsed; return true; } catch (e) { return false; } }
}

/* TreeRenderer (same as before) */
class TreeRenderer {
  constructor(container, store) {
    this.container = container; this.store = store; this.onSelect = () => {};
  }
  render() {
    this.container.innerHTML = '';
    const root = this.store.getRoot();
    for (const [k, v] of Object.entries(root)) {
      const node = this._createNode(k, v, k);
      this.container.appendChild(node);
    }
  }
  _createNode(name, obj, path) {
    const el = document.createElement('div');
    el.className = 'tree-node';
    el.setAttribute('role', 'treeitem');
    el.tabIndex = 0;
    el.dataset.path = path;
    el.dataset.type = obj.type || 'item';
    const iconSpan = document.createElement('span'); iconSpan.className = 'icon'; iconSpan.textContent = obj.icon || '📁';
    const labelSpan = document.createElement('span'); labelSpan.className = 'label'; labelSpan.textContent = name;
    el.appendChild(iconSpan); el.appendChild(labelSpan);
    el.addEventListener('click', (e) => { e.stopPropagation(); this._clearSelection(); el.setAttribute('aria-selected', 'true'); this.onSelect(path, obj.type); });
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); const ev = new CustomEvent('tree-contextmenu', { detail: { path, type: obj.type, event: e } }); el.dispatchEvent(ev); });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
    if (obj.children && Object.keys(obj.children).length > 0) {
      const childrenWrap = document.createElement('div'); childrenWrap.className = 'tree-children';
      for (const [k, v] of Object.entries(obj.children)) {
        const childPath = `${path}/${k}`; const childNode = this._createNode(k, v, childPath); childrenWrap.appendChild(childNode);
      }
      el.appendChild(childrenWrap);
    }
    return el;
  }
  _clearSelection() { this.container.querySelectorAll('[aria-selected="true"]').forEach(n => n.removeAttribute('aria-selected')); }
}

async function enterEdit(node) {
  try {
    const { EditorJS, tools } = await ensureEditor();
    const editor = new EditorJS({
      holder: 'editorjs',
      data: node.editorData || { blocks: [] },
      tools: {
        header: { class: tools.header },
        list: { class: tools.list },
        quote: { class: tools.quote },
        code: { class: tools.code },
        delimiter: tools.delimiter ? { class: tools.delimiter } : undefined,
        marker: tools.marker ? { class: tools.marker } : undefined,
        checklist: tools.checklist ? { class: tools.checklist } : undefined
      }
    });
    // speichern, zerstören etc.
  } catch (err) {
    console.error('Editor loading error:', err);
  }
}

/* UIManager (enhanced: Editor + BPMN wiring) */
class UIManager {
  constructor() {
    this.store = new TreeStore(JSON.parse(JSON.stringify(defaultData)));
    this.renderer = new TreeRenderer(document.getElementById('tree'), this.store);
    this.currentPath = null;

    // Editor instance
    this._editorInstance = null;
    this._editorReady = false;

    // BPMN modeler instance
    this._bpmnModeler = null;

    this._bind();
    this.renderer.onSelect = (path, type) => this.showItem(path, type);
    this.store.buildIndex();
    this.renderer.render();
    this._populateQuickAccess();

    // tree context
    document.getElementById('tree').addEventListener('tree-contextmenu', (e) => {
      const { path, type, event } = e.detail; this._showContextMenu(path, type, event);
    });
    document.addEventListener('click', () => this._hideContextMenu());
  }

  _bind() {
    document.getElementById('btn-export').addEventListener('click', () => this._export());
    document.getElementById('btn-import').addEventListener('click', () => this._triggerImport());
    document.getElementById('import-file').addEventListener('change', (e) => this._handleImport(e));
    document.getElementById('edit-btn').addEventListener('click', () => this._enterEdit());
    document.getElementById('save-btn').addEventListener('click', () => this._saveEdit());
    document.getElementById('cancel-btn').addEventListener('click', () => this._cancelEdit());
    document.getElementById('search-input').addEventListener('input', (e) => this._search(e.target.value));

    // BPMN controls
    document.getElementById('import-bpmn').addEventListener('click', () => document.getElementById('import-bpmn-file').click());
    document.getElementById('import-bpmn-file').addEventListener('change', (e) => this._importBpmnFile(e));
    document.getElementById('export-bpmn').addEventListener('click', () => this._exportBpmnXml());
    document.getElementById('new-bpmn').addEventListener('click', () => this._newBpmn());
  }

  _populateQuickAccess() {
    const qa = document.getElementById('quick-access'); qa.innerHTML = '';
    const roots = this.store.buildIndex().slice(0, 6);
    for (const r of roots) {
      const btn = document.createElement('button'); btn.className = 'btn'; btn.textContent = `${r.icon || ''} ${r.name}`;
      btn.addEventListener('click', () => { const target = this.renderer.container.querySelector(`[data-path="${r.path}"]`); target?.click(); });
      qa.appendChild(btn);
    }
  }

  showItem(path, type) {
    this.currentPath = path;
    const node = this.store.getNode(path);
    this._updateBreadcrumb(path);
    this._hideAllViews();
    if (type === 'document') this._showDocument(node, path);
    else if (type === 'process') this._showProcess(node, path);
    else if (type === 'organigram') this._showOrganigram(node, path);
    else this._showWelcome();
  }

  _updateBreadcrumb(path) {
    const bc = document.getElementById('breadcrumb'); bc.innerHTML = '';
    const parts = path.split('/'); let accum = [];
    parts.forEach((part, idx) => {
      accum.push(part);
      const btn = document.createElement('button'); btn.className = 'btn'; btn.textContent = part;
      btn.addEventListener('click', () => { const p = accum.join('/'); const target = this.renderer.container.querySelector(`[data-path="${p}"]`); target?.click(); });
      bc.appendChild(btn);
      if (idx < parts.length - 1) { const sep = document.createElement('span'); sep.textContent = '›'; sep.style.margin = '0 6px'; sep.style.color = 'var(--muted)'; bc.appendChild(sep); }
    });
  }

  _hideAllViews() {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  }

  _showWelcome() {
    const welcome = document.getElementById('welcome'); welcome.classList.remove('hidden'); welcome.classList.add('active');
  }

  _showDocument(node, path) {
    document.getElementById('doc-title').textContent = path.split('/').pop();
    const view = document.getElementById('doc-view'); view.classList.remove('hidden'); view.classList.add('active');
    const content = document.getElementById('doc-content');
    if (node && node.editorData && Array.isArray(node.editorData.blocks)) {
      content.innerHTML = node.editorData.blocks.map(b => {
        if (b.type === 'header') return `<h${b.data.level}>${this._escape(b.data.text)}</h${b.data.level}>`;
        if (b.type === 'paragraph') return `<p>${this._escape(b.data.text)}</p>`;
        if (b.type === 'list') {
          if (b.data.style === 'ordered') return `<ol>${b.data.items.map(it => `<li>${this._escape(it)}</li>`).join('')}</ol>`;
          else return `<ul>${b.data.items.map(it => `<li>${this._escape(it)}</li>`).join('')}</ul>`;
        }
        return `<div>${this._escape(JSON.stringify(b))}</div>`;
      }).join('');
    } else {
      content.textContent = 'Kein Inhalt verfügbar.';
    }
    // hide editor controls
    document.getElementById('editor-root').classList.add('hidden'); document.getElementById('editor-root').innerHTML = '';
    document.getElementById('save-btn').classList.add('hidden'); document.getElementById('cancel-btn').classList.add('hidden');
    document.getElementById('edit-btn').classList.remove('hidden');
    content.focus();
  }

  _escape(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* === EDITOR INTEGRATION ===
     - On _enterEdit(): ensureEditor() -> create EditorJS instance in #editorjs container inside #editor-root
     - On save: call editor.save() to collect data and persist into node.editorData
  */
  async _enterEdit() {
    const node = this.store.getNode(this.currentPath);
    if (!node || node.type !== 'document') return;

    // prepare editor container
    const editorRoot = document.getElementById('editor-root');
    editorRoot.classList.remove('hidden'); editorRoot.innerHTML = `
      <div id="editorjs"></div>
      <div style="margin-top:8px;">
        <small style="color:var(--muted)">Editor: Editor.js (WYSIWYG). Änderungen nach "Speichern" werden in das JSON-Dokument übernommen.</small>
      </div>
    `;

    document.getElementById('save-btn').classList.remove('hidden'); document.getElementById('cancel-btn').classList.remove('hidden'); document.getElementById('edit-btn').classList.add('hidden');

    try {
      // lazy load Editor.js + tools
      const lib = await ensureEditor(); // loads EditorJS and tools, returns {EditorJS, tools}
      const EditorJS = lib.EditorJS;
      const tools = lib.tools;

      // Destroy previous instance if exists
      if (this._editorInstance && typeof this._editorInstance.destroy === 'function') {
        try { await this._editorInstance.destroy(); } catch (e) { /* ignore */ }
        this._editorInstance = null;
      }

      // Initialize Editor.js
      this._editorInstance = new EditorJS({
        holder: 'editorjs',
        autofocus: true,
        data: node.editorData || { blocks: [] },
        tools: {
          header: { class: tools.header, shortcut: 'CMD+SHIFT+H' },
          list: { class: tools.list, shortcut: 'CMD+SHIFT+L' },
          quote: { class: tools.quote, shortcut: 'CMD+SHIFT+Q' },
          code: { class: tools.code },
          delimiter: tools.delimiter ? { class: tools.delimiter } : undefined,
          marker: tools.marker ? { class: tools.marker } : undefined,
          checklist: tools.checklist ? { class: tools.checklist } : undefined
        },
        onReady: () => {
          this._editorReady = true;
        },
        onChange: async () => {
          // optional: show auto-save indicator or similar
        }
      });
    } catch (err) {
      console.error('Editor initialization failed', err);
      alert('Fehler beim Laden des Editors. Prüfe die Konsole.');
      // fallback: show raw JSON textarea
      const editorRootFallback = document.getElementById('editor-root'); editorRootFallback.innerHTML = '';
      const ta = document.createElement('textarea'); ta.className = 'form'; ta.style.width = '100%'; ta.style.minHeight = '220px';
      ta.value = JSON.stringify(node.editorData || { blocks: [] }, null, 2);
      editorRootFallback.appendChild(ta);
    }
  }

  async _saveEdit() {
    const node = this.store.getNode(this.currentPath);
    if (!node || node.type !== 'document') return;
    if (this._editorInstance && this._editorReady && typeof this._editorInstance.save === 'function') {
      try {
        const output = await this._editorInstance.save();
        node.editorData = output;
        // re-render document, re-index, re-render tree
        this.store.buildIndex(); this.renderer.render(); this._populateQuickAccess();
        this.showItem(this.currentPath, node.type);
        // destroy editor to free resources
        try { await this._editorInstance.destroy(); } catch (e) { /* ignore */ }
        this._editorInstance = null; this._editorReady = false;
        alert('Änderungen gespeichert.');
      } catch (err) {
        console.error('Save failed', err); alert('Speichern fehlgeschlagen. Details in Konsole.');
      }
    } else {
      // fallback: if editor isn't available (e.g., textarea)
      const ta = document.querySelector('#editor-root textarea');
      if (ta) {
        try {
          const json = JSON.parse(ta.value);
          node.editorData = json; this.store.buildIndex(); this.renderer.render(); this._populateQuickAccess();
          this.showItem(this.currentPath, node.type); alert('Änderungen gespeichert (Fallback).');
        } catch (e) { alert('Ungültiges JSON.'); }
      }
    }
  }

  _cancelEdit() {
    // destroy editor if present
    if (this._editorInstance && typeof this._editorInstance.destroy === 'function') {
      try { this._editorInstance.destroy(); } catch (e) { /* ignore */ }
    }
    this._editorInstance = null; this._editorReady = false;
    document.getElementById('editor-root').classList.add('hidden'); document.getElementById('editor-root').innerHTML = '';
    document.getElementById('save-btn').classList.add('hidden'); document.getElementById('cancel-btn').classList.add('hidden');
    document.getElementById('edit-btn').classList.remove('hidden');
  }

  /* === BPMN Integration ===
     - ensureBpmn() loads the modeler constructor and we instantiate it in #bpmn-canvas.
     - We provide import/export XML and a "new" starter diagram
  */
  async _showProcess(node, path) {
    document.getElementById('process-title').textContent = path.split('/').pop();
    const view = document.getElementById('process-view'); view.classList.remove('hidden'); view.classList.add('active');
    const canvas = document.getElementById('bpmn-canvas');
    canvas.innerHTML = ''; // container for bpmn modeler
    // initialize modeler
    try {
      const BpmnJS = await ensureBpmn(); // returns constructor
      // destroy previous modeler if exists
      if (this._bpmnModeler) { try { this._bpmnModeler.destroy(); } catch (e) { /* ignore */ } this._bpmnModeler = null; }
      this._bpmnModeler = new BpmnJS({ container: '#bpmn-canvas' });

      // If node.content.bpmnXml exists, import it; otherwise create default diagram
      const xml = node?.content?.bpmnXml || this._defaultBpmnXml();
      await this._importXmlToModeler(xml);
      // remember current node for export etc.
      this._currentBpmnNodePath = path;
      this._currentBpmnNode = node;
    } catch (err) {
      console.error('BPMN init failed', err); alert('Fehler beim Laden von bpmn-js. Details in Konsole.');
    }
  }

  _defaultBpmnXml() {
    // minimal valid BPMN diagram (simple process)
    return `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="Process_1" isExecutable="false">
    <startEvent id="StartEvent_1" name="Start" />
    <task id="Task_1" name="Aufgabe" />
    <endEvent id="EndEvent_1" name="Ende" />
    <sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1" />
    <sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="EndEvent_1" />
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1"/>
  </bpmndi:BPMNDiagram>
</definitions>`;
  }

  async _importXmlToModeler(xml) {
    if (!this._bpmnModeler) return;
    try {
      await this._bpmnModeler.importXML(xml);
    } catch (err) {
      console.error('Import XML error', err);
      alert('Fehler beim Importieren des BPMN-XML. Details in Konsole.');
    }
  }

  async _exportBpmnXml() {
    if (!this._bpmnModeler || !this._currentBpmnNode) { alert('Kein Prozess aktiv.'); return; }
    try {
      const result = await this._bpmnModeler.saveXML({ format: true });
      const xml = result.xml;
      // save into node content
      this._currentBpmnNode.content = this._currentBpmnNode.content || {};
      this._currentBpmnNode.content.bpmnXml = xml;
      // offer download
      const blob = new Blob([xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${this._currentBpmnNodePath.replace(/\//g, '_')}.bpmn`; a.click(); URL.revokeObjectURL(url);
      alert('BPMN XML exportiert und in Node gespeichert.');
    } catch (err) {
      console.error('Export BPMN error', err); alert('Fehler beim Exportieren. Details in Konsole.');
    }
  }

  async _importBpmnFile(e) {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const xml = ev.target.result;
      if (!this._bpmnModeler || !this._currentBpmnNode) {
        alert('Kein aktiver Prozess zum Importieren.');
        return;
      }
      try {
        await this._importXmlToModeler(xml);
        // save into node
        this._currentBpmnNode.content = this._currentBpmnNode.content || {};
        this._currentBpmnNode.content.bpmnXml = xml;
        alert('BPMN importiert und in Node gespeichert.');
      } catch (err) {
        console.error('Import BPMN failed', err); alert('Import fehlgeschlagen. Details in Konsole.');
      }
    };
    reader.readAsText(f);
  }

  async _newBpmn() {
    if (!this._bpmnModeler || !this._currentBpmnNode) return;
    const xml = this._defaultBpmnXml();
    await this._importXmlToModeler(xml);
    this._currentBpmnNode.content = this._currentBpmnNode.content || {};
    this._currentBpmnNode.content.bpmnXml = xml;
    alert('Neues BPMN-Diagramm erstellt.');
  }

  _showOrganigram(node, path) {
    const view = document.getElementById('org-view'); view.classList.remove('hidden'); view.classList.add('active');
    const canvas = document.getElementById('org-canvas'); canvas.textContent = 'Organigramm (statisch)';
  }

  /* rest: export/import tree, search, context menu, rename/duplicate/delete (same as earlier) */

  _export() {
    const data = this.store.export();
    const blob = new Blob([data], { type: 'application/json' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'wbg-zentrum-export.json'; a.click(); URL.revokeObjectURL(url);
  }
  _triggerImport() { document.getElementById('import-file').value = null; document.getElementById('import-file').click(); }
  _handleImport(e) {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader(); reader.onload = (ev) => {
      const ok = this.store.import(ev.target.result);
      if (ok) { this.renderer.render(); this.store.buildIndex(); this._populateQuickAccess(); alert('Import erfolgreich.'); } else { alert('Ungültige Datei.'); }
    }; reader.readAsText(f);
  }
  _search(q) {
    const container = this.renderer.container;
    if (!q || q.trim() === '') { this.renderer.render(); return; }
    const idx = this.store.buildIndex(); const res = idx.filter(i => i.name.toLowerCase().includes(q.toLowerCase()) || i.path.toLowerCase().includes(q.toLowerCase()));
    container.innerHTML = '';
    if (res.length === 0) { const empty = document.createElement('div'); empty.className = 'tree-node'; empty.textContent = 'Keine Treffer'; container.appendChild(empty); return; }
    for (const r of res) { const node = document.createElement('div'); node.className = 'tree-node'; node.textContent = `${r.icon || ''} ${r.path}`; node.addEventListener('click', () => { const t = this.renderer.container.querySelector(`[data-path="${r.path}"]`); if (t) t.click(); else this.showItem(r.path, r.type); }); container.appendChild(node); }
  }

  _showContextMenu(path, type, e) {
    const menu = document.getElementById('context-menu'); menu.innerHTML = '';
    const items = [{ id: 'edit', label: 'Bearbeiten' }, { id: 'rename', label: 'Umbenennen' }, { id: 'duplicate', label: 'Duplizieren' }, { id: 'delete', label: 'Löschen' }];
    for (const it of items) {
      const el = document.createElement('div'); el.className = 'context-item'; el.textContent = it.label; el.style.padding = '8px 12px'; el.style.cursor = 'pointer';
      el.addEventListener('click', (ev) => { ev.stopPropagation(); this._handleContextAction(it.id, path, type); this._hideContextMenu(); });
      menu.appendChild(el);
    }
    menu.style.left = `${e.pageX}px`; menu.style.top = `${e.pageY}px`; menu.classList.remove('hidden');
  }
  _hideContextMenu() { const menu = document.getElementById('context-menu'); if (menu) menu.classList.add('hidden'); }

  _handleContextAction(action, path, type) {
    if (!path) return;
    switch (action) {
      case 'edit': this.showItem(path, type); if (type === 'document') this._enterEdit(); break;
      case 'rename': this._renameItem(path); break;
      case 'duplicate': this._duplicateItem(path); break;
      case 'delete': this._deleteItem(path); break;
      default: break;
    }
  }

  _renameItem(path) {
    const parts = path.split('/'); const currentName = parts.pop(); const newName = prompt('Neuer Name:', currentName);
    if (!newName || newName.trim() === '' || newName.trim() === currentName) return; const res = this.store.renameItem(path, newName.trim());
    if (res) { this.renderer.render(); this.store.buildIndex(); alert('Umbenennung erfolgreich.'); } else { alert('Fehler beim Umbenennen.'); }
  }

  _duplicateItem(path) {
    const node = this.store.getNode(path); if (!node) { alert('Element nicht gefunden.'); return; }
    const parts = path.split('/'); const name = parts.pop(); const parentPath = parts.join('/'); const parent = parentPath ? this.store.getNode(parentPath) : this.store.getRoot();
    if (!parent || !parent.children) { alert('Kann nicht duplizieren.'); return; }
    let newName = `${name} (Kopie)`; let i = 1; while (parent.children[newName]) newName = `${name} (Kopie ${i++})`;
    parent.children[newName] = JSON.parse(JSON.stringify(node)); this.renderer.render(); this.store.buildIndex(); alert('Duplikat erstellt.');
  }

  _deleteItem(path) {
    const parts = path.split('/'); const name = parts.pop(); if (!confirm(`Möchten Sie "${name}" wirklich löschen?`)) return; const ok = this.store.removeItem(path);
    if (ok) { this.renderer.render(); this.store.buildIndex(); this._showWelcome(); alert('Gelöscht.'); } else { alert('Fehler beim Löschen.'); }
  }
}
async function showProcess(node) {
  try {
    const BpmnModeler = await ensureBpmn();
    const modeler = new BpmnModeler({ container: '#bpmn-canvas' });
    const xml = node.content?.bpmnXml || defaultBpmnXml();
    await modeler.importXML(xml);
    // speichern etc.
  } catch (err) {
    console.error('BPMN error:', err);
  }
}

/* App init */
window.addEventListener('DOMContentLoaded', () => {
  window.app = new UIManager();
});
