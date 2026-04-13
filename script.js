// Minimal frontend: API client + state + simple UI wiring

const ApiClient = {
  async fetchIdeas(){
    const url = CONFIG.API_URL;
    const res = await fetch(url);
    if(!res.ok) throw new Error('Network error');
    return res.json();
  },
  async postAction(payload){
    const url = CONFIG.API_URL;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    if(!res.ok) throw new Error('Network error');
    return res.json();
  },
  addIdea(data){ return this.postAction(Object.assign({ action: 'add' }, data)); },
  updateIdea(data){ return this.postAction(Object.assign({ action: 'update' }, data)); },
  deleteIdea(id){ return this.postAction({ action: 'delete', id }); }
};

const TypeSelector = (function(){
  const STORAGE_KEY = 'et_types_v1';
  const defaults = ['Class', 'Subclass', 'Creature', 'Concept'];
  let types = [];
  const box = document.createElement('div');

  function load(){
    try{
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      types = Array.isArray(stored) && stored.length ? stored : defaults.slice();
    }catch(e){
      types = defaults.slice();
    }
  }

  function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(types)); }

  function addIfMissing(t){
    if(!t) return;
    const norm = String(t).trim();
    if(!norm) return;
    if(!types.includes(norm)){
      types.unshift(norm);
      if(types.length > 50) types.length = 50;
      save();
    }
  }

  function ensureBox(){
    box.id = '__et_type_box';
    box.className = 'type-suggestions hidden';
    document.body.appendChild(box);
  }

  function hide(){ box.classList.add('hidden'); }

  function showFor(input){
    ensureBox();
    const rect = input.getBoundingClientRect();
    box.style.left = (rect.left + window.scrollX) + 'px';
    box.style.top = (rect.bottom + window.scrollY + 6) + 'px';
    box.style.width = rect.width + 'px';

    const q = input.value.toLowerCase().trim();
    const items = types.filter(t => t.toLowerCase().includes(q));
    box.innerHTML = '';

    items.forEach(t => {
      const el = document.createElement('div');
      el.className = 'item';
      el.textContent = t;
      el.addEventListener('click', ()=>{
        input.value = t;
        hide();
        input.focus();
      });
      box.appendChild(el);
    });

    if(items.length) box.classList.remove('hidden');
    else box.classList.add('hidden');
  }

  function attach(input){
    if(!input) return;
    input.addEventListener('input', ()=> showFor(input));
    input.addEventListener('focus', ()=> showFor(input));
    input.addEventListener('keydown', (ev)=>{
      if(ev.key === 'Escape') hide();
      if(ev.key === 'Enter'){
        hide();
        input.blur();
      }
    });
  }

  document.addEventListener('click', (e)=>{
    if(!box.contains(e.target) && e.target.id !== 'fld-type' && e.target.id !== 'fld-type-edit') hide();
  });

  load();
  return { addIfMissing, attach, hide, showFor };
})();

function normalizeDeleted(val){
  if(val === true) return true;
  if(val === false) return false;
  if(val === undefined || val === null) return false;
  if(typeof val === 'string'){
    const v = val.trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes' || v === 'deleted' || v === 'y';
  }
  if(typeof val === 'number') return val !== 0;
  return Boolean(val);
}

const State = {
  ideas: [],
  async load(){
    try{
      setStatus('loading');
      const r = await ApiClient.fetchIdeas();
      if(r && r.success){
        this.ideas = (r.data || []).map(item => {
          item.deleted = normalizeDeleted(item.deleted);
          return item;
        });
        setStatus('ready');
      } else {
        this.ideas = [];
        setStatus('error', r && r.message ? r.message : 'No data');
      }
    }catch(e){
      console.error(e);
      setStatus('error', e.message);
    }
  },
  find(id){ return this.ideas.find(i => String(i.id) === String(id)); }
};

let editMode = false;
let currentEditId = null;

function $(sel){ return document.querySelector(sel); }

async function withButtonLoading(buttonEl, action){
  if(!buttonEl) return action();
  if(buttonEl.disabled) return false;
  const prevText = buttonEl.textContent;
  try{
    buttonEl.disabled = true;
    buttonEl.classList.add('loading');
    return await action();
  } finally {
    buttonEl.disabled = false;
    buttonEl.classList.remove('loading');
    if(prevText) buttonEl.textContent = prevText;
  }
}

function setStatus(state, text){
  const el = document.getElementById('status-chip');
  if(!el) return;
  el.className = 'status-chip';
  if(state === 'ready') el.classList.add('status-ready');
  else if(state === 'loading') el.classList.add('status-loading');
  else if(state === 'error') el.classList.add('status-error');
  el.textContent = text || (state === 'loading' ? 'Loading' : state === 'ready' ? 'Ready' : 'Error');
}

function setActiveTab(name){
  const tabs = ['#tab-list', '#tab-add', '#tab-edit', '#tab-bin'];
  tabs.forEach(s => { const e = $(s); if(e) e.classList.remove('active'); });

  const views = ['#list-view', '#add-view', '#edit-view', '#bin-view'];
  views.forEach(s => { const e = $(s); if(e) e.classList.add('hidden'); });

  const panel = $('#detail-panel');
  if(panel) panel.classList.add('hidden');

  if(name === 'list'){
    $('#list-view').classList.remove('hidden');
    $('#tab-list').classList.add('active');
  } else if(name === 'add'){
    $('#add-view').classList.remove('hidden');
    $('#tab-add').classList.add('active');
  } else if(name === 'edit'){
    const tabEdit = $('#tab-edit');
    if(tabEdit) tabEdit.removeAttribute('disabled');
    $('#edit-view').classList.remove('hidden');
    $('#tab-edit').classList.add('active');
  } else if(name === 'bin'){
    const binView = $('#bin-view');
    const binTab = $('#tab-bin');
    if(binView) binView.classList.remove('hidden');
    if(binTab) binTab.classList.add('active');
    renderBin();
  }
}

function renderList(){
  const ul = $('#ideas-list');
  if(!ul) return;
  ul.innerHTML = '';

  State.ideas.filter(idea => !idea.deleted).forEach(idea => {
    const li = document.createElement('li');
    li.dataset.id = idea.id;
    li.addEventListener('click', ()=> enterEditMode(idea));

    const header = document.createElement('div');
    header.className = 'idea-header';

    const typeEl = document.createElement('span');
    typeEl.className = 'idea-type';
    typeEl.textContent = idea.type || '-';

    const nameEl = document.createElement('span');
    nameEl.className = 'idea-name';
    nameEl.textContent = ': ' + (idea.name || '-');

    const tagsEl = document.createElement('span');
    tagsEl.className = 'idea-tags';
    tagsEl.textContent = idea.tags ? ' - ' + idea.tags : '';

    header.appendChild(typeEl);
    header.appendChild(nameEl);
    header.appendChild(tagsEl);

    const details = document.createElement('div');
    details.className = 'idea-details';
    details.textContent = idea.details || '';

    li.appendChild(header);
    if(details.textContent) li.appendChild(details);
    ul.appendChild(li);
  });
}

function renderBin(){
  const ul = $('#bin-list');
  if(!ul) return;
  ul.innerHTML = '';

  const deleted = State.ideas.filter(idea => idea.deleted);
  if(!deleted.length){
    const msg = document.createElement('div');
    msg.className = 'empty-bin';
    msg.textContent = 'No deleted items.';
    ul.appendChild(msg);
    return;
  }

  deleted.forEach(idea => {
    const li = document.createElement('li');
    li.dataset.id = idea.id;
    li.className = 'bin-item';

    const header = document.createElement('div');
    header.className = 'idea-header';

    const typeEl = document.createElement('span');
    typeEl.className = 'idea-type';
    typeEl.textContent = idea.type || '-';

    const nameEl = document.createElement('span');
    nameEl.className = 'idea-name';
    nameEl.textContent = ': ' + (idea.name || '-');

    const tagsEl = document.createElement('span');
    tagsEl.className = 'idea-tags';
    tagsEl.textContent = idea.tags ? ' - ' + idea.tags : '';

    header.appendChild(typeEl);
    header.appendChild(nameEl);
    header.appendChild(tagsEl);

    const details = document.createElement('div');
    details.className = 'idea-details';
    details.textContent = idea.details || '';

    const restore = document.createElement('button');
    restore.className = 'btn btn-secondary';
    restore.textContent = 'Restore';
    restore.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      doRestore(idea.id);
    });

    li.appendChild(header);
    if(details.textContent) li.appendChild(details);
    li.appendChild(restore);
    li.addEventListener('click', ()=> showDetails(idea.id));
    ul.appendChild(li);
  });
}

function showDetails(id){
  const idea = State.find(id);
  const panel = $('#detail-panel');
  if(!panel) return;

  panel.innerHTML = '';
  if(!idea){
    panel.classList.add('hidden');
    return;
  }

  panel.classList.remove('hidden');

  const h = document.createElement('h2');
  h.textContent = idea.name || '';
  panel.appendChild(h);

  const meta = document.createElement('div');
  meta.textContent = (idea.type || '') + ' • ' + (idea.tags || '');
  panel.appendChild(meta);

  const p = document.createElement('p');
  p.textContent = idea.details || '';
  panel.appendChild(p);

  if(idea.deleted){
    const restore = document.createElement('button');
    restore.textContent = 'Restore';
    restore.className = 'btn btn-secondary';
    restore.addEventListener('click', ()=> doRestore(idea.id));
    panel.appendChild(restore);
  } else {
    const edit = document.createElement('button');
    edit.textContent = 'Edit';
    edit.className = 'btn btn-edit';
    edit.addEventListener('click', ()=> enterEditMode(idea));

    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.className = 'btn btn-delete';
    del.addEventListener('click', async (ev)=>{
      const btn = ev.currentTarget;
      await withButtonLoading(btn, ()=> doDelete(idea.id));
    });

    panel.appendChild(edit);
    panel.appendChild(del);
  }
}

function enterEditMode(idea){
  editMode = true;
  currentEditId = idea.id;
  $('#fld-type-edit').value = idea.type || '';
  $('#fld-name-edit').value = idea.name || '';
  $('#fld-tags-edit').value = idea.tags || '';
  $('#fld-details-edit').value = idea.details || '';
  setActiveTab('edit');
  TypeSelector.attach($('#fld-type-edit'));
}

function exitEditMode(){
  editMode = false;
  currentEditId = null;
  const tabEdit = $('#tab-edit');
  if(tabEdit){
    tabEdit.setAttribute('disabled', '');
    tabEdit.classList.remove('active');
  }
  const detail = $('#detail-panel');
  if(detail) detail.classList.add('hidden');
}

async function doDelete(id){
  if(!confirm('Delete this idea?')) return false;
  try{
    setStatus('loading', 'Deleting...');
    const r = await ApiClient.updateIdea({ id, deleted: true });
    if(r && r.success){
      const item = State.find(id);
      if(item) item.deleted = true;
      renderList();
      renderBin();
      $('#detail-panel').classList.add('hidden');
      setStatus('ready');
      return true;
    } else {
      setStatus('error', 'Delete failed');
      alert('Delete failed');
      return false;
    }
  }catch(e){
    console.error(e);
    setStatus('error', 'Delete failed');
    alert('Network error');
    return false;
  }
}

async function doRestore(id){
  try{
    const r = await ApiClient.updateIdea({ id, deleted: false });
    if(r && r.success){
      const item = State.find(id);
      if(item) item.deleted = false;
      renderList();
      renderBin();
      setActiveTab('list');
    } else {
      alert('Restore failed');
    }
  }catch(e){
    console.error(e);
    alert('Network error');
  }
}

async function refresh(){
  await State.load();
  renderList();
  renderBin();
}

async function init(){
  TypeSelector.attach($('#fld-type'));

  $('#tab-list').addEventListener('click', ()=> setActiveTab('list'));
  $('#tab-add').addEventListener('click', ()=>{
    const form = $('#idea-form');
    form.reset();
    delete form.dataset.editId;
    exitEditMode();
    setActiveTab('add');
  });
  $('#tab-edit').addEventListener('click', ()=>{
    const tab = $('#tab-edit');
    if(tab.hasAttribute('disabled')) return;
    setActiveTab('edit');
  });
  const tabBin = $('#tab-bin');
  if(tabBin){
    tabBin.addEventListener('click', ()=>{
      setActiveTab('bin');
    });
  }
  $('#refresh').addEventListener('click', refresh);

  $('#idea-form').addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const data = {
      type: $('#fld-type').value,
      name: $('#fld-name').value.trim(),
      tags: $('#fld-tags').value.trim(),
      details: $('#fld-details').value.trim()
    };
    const form = $('#idea-form');
    const submitBtn = form.querySelector('button[type="submit"]');
    const prevText = submitBtn ? submitBtn.textContent : null;
    const editId = form.dataset.editId;

    try{
      if(submitBtn){ submitBtn.disabled = true; submitBtn.classList.add('loading'); }
      setStatus('loading');
      if(editId){
        data.id = Number(editId);
        await ApiClient.updateIdea(data);
        delete form.dataset.editId;
      } else {
        await ApiClient.addIdea(data);
      }
      TypeSelector.addIfMissing(data.type);
      await refresh();
      setActiveTab('list');
      setStatus('ready');
    }catch(e){
      console.error(e);
      setStatus('error', 'Save failed');
      alert('Save failed');
    }finally{
      if(submitBtn){
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        if(prevText) submitBtn.textContent = prevText;
      }
    }
  });

  $('#cancel').addEventListener('click', ()=>{
    $('#idea-form').reset();
    delete $('#idea-form').dataset.editId;
    setActiveTab('list');
  });

  $('#edit-idea-form').addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    if(!editMode || !currentEditId) return;

    const data = {
      id: currentEditId,
      type: $('#fld-type-edit').value,
      name: $('#fld-name-edit').value.trim(),
      tags: $('#fld-tags-edit').value.trim(),
      details: $('#fld-details-edit').value.trim()
    };

    const form = $('#edit-idea-form');
    const submitBtn = form.querySelector('button[type="submit"]');
    const prevText = submitBtn ? submitBtn.textContent : null;

    try{
      if(submitBtn){ submitBtn.disabled = true; submitBtn.classList.add('loading'); }
      setStatus('loading');
      await ApiClient.updateIdea(data);
      TypeSelector.addIfMissing(data.type);
      exitEditMode();
      await refresh();
      setActiveTab('list');
      setStatus('ready');
    }catch(e){
      console.error(e);
      setStatus('error', 'Save failed');
      alert('Save failed');
    }finally{
      if(submitBtn){
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        if(prevText) submitBtn.textContent = prevText;
      }
    }
  });

  $('#cancel-edit').addEventListener('click', ()=>{
    exitEditMode();
    setActiveTab('list');
  });

  $('#delete-edit').addEventListener('click', async (ev)=>{
    if(!editMode || !currentEditId) return;
    const btn = ev.currentTarget;
    const ok = await withButtonLoading(btn, ()=> doDelete(currentEditId));
    if(ok){
      exitEditMode();
      setActiveTab('list');
    }
  });

  $('#search').addEventListener('input', (e)=>{
    const q = e.target.value.toLowerCase();
    const items = document.querySelectorAll('#ideas-list li');
    items.forEach(li => {
      const txt = li.textContent.toLowerCase();
      li.style.display = txt.includes(q) ? 'block' : 'none';
    });
  });

  const sb = $('#search-bin');
  if(sb){
    sb.addEventListener('input', (e)=>{
      const q = e.target.value.toLowerCase();
      const items = document.querySelectorAll('#bin-list li');
      items.forEach(li => {
        const txt = li.textContent.toLowerCase();
        li.style.display = txt.includes(q) ? 'block' : 'none';
      });
    });
  }

  await refresh();
  setActiveTab('list');
}

window.addEventListener('DOMContentLoaded', init);

window.addEventListener('load', () => {
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('service-worker.js').then(reg => {
      console.log('ServiceWorker registered', reg.scope);
    }).catch(err => console.warn('ServiceWorker registration failed', err));
  }
});
