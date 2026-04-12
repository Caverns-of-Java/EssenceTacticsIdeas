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

/* Type selector with persistent custom types and positioned suggestion box */
const TypeSelector = (function(){
  const STORAGE_KEY = 'et_types_v1';
  const defaults = ['Class','Subclass','Creature','Concept'];
  let types = [];
  const box = document.createElement('div');
  function load(){
    try{ const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      types = Array.isArray(stored) && stored.length? stored : defaults.slice();
    }catch(e){ types = defaults.slice(); }
  }
  function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(types)); }
  function get(){ return types.slice(); }
  function addIfMissing(t){ if(!t) return; const norm = String(t).trim(); if(!norm) return; if(!types.includes(norm)) { types.unshift(norm); if(types.length>50) types.length=50; save(); } }

  function ensureBox(){ box.id='__et_type_box'; box.className='type-suggestions hidden'; document.body.appendChild(box); }

  function showFor(input){ ensureBox(); const rect = input.getBoundingClientRect(); box.style.left = (rect.left + window.scrollX) + 'px'; box.style.top = (rect.bottom + window.scrollY + 6) + 'px'; box.style.width = rect.width + 'px';
    const q = input.value.toLowerCase().trim();
    const items = types.filter(t=>t.toLowerCase().includes(q));
    box.innerHTML = '';
    items.forEach(t=>{
      const el = document.createElement('div'); el.className='item'; el.textContent = t;
      el.addEventListener('click', ()=>{ input.value = t; hide(); input.focus(); });
      box.appendChild(el);
    });
    if(items.length) box.classList.remove('hidden'); else box.classList.add('hidden');
  }
  function hide(){ box.classList.add('hidden'); }
  function attach(input){ input.addEventListener('input', ()=> showFor(input));
    input.addEventListener('focus', ()=> showFor(input));
    input.addEventListener('keydown', (ev)=>{ if(ev.key === 'Escape') hide(); if(ev.key === 'Enter'){ hide(); input.blur(); }});
  }
  document.addEventListener('click', (e)=>{ if(!box.contains(e.target) && e.target.id !== 'fld-type') hide(); });
  load();
  return { load, save, get, addIfMissing, attach, showFor, hide };
})();

const State = {
  ideas: [],
  async load(){
    try{
      const r = await ApiClient.fetchIdeas();
      if(r && r.success) this.ideas = r.data || [];
      else this.ideas = [];
    }catch(e){ console.error(e); }
  },
  find(id){ return this.ideas.find(i=>i.id==id); }
};

// UI
function $(sel){return document.querySelector(sel)}

function renderList(){
  const ul = $('#ideas-list'); ul.innerHTML = '';
  State.ideas.forEach(idea=>{
    const li = document.createElement('li');
    li.dataset.id = idea.id;
    li.addEventListener('click', ()=> showDetails(idea.id));

    const header = document.createElement('div');
    header.className = 'idea-header';

    const typeEl = document.createElement('span');
    typeEl.className = 'idea-type';
    typeEl.textContent = idea.type || '—';

    const nameEl = document.createElement('span');
    nameEl.className = 'idea-name';
    nameEl.textContent = `: ${idea.name || '—'}`;

    const tagsEl = document.createElement('span');
    tagsEl.className = 'idea-tags';
    tagsEl.textContent = idea.tags ? ` — ${idea.tags}` : '';

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

function showDetails(id){
  const idea = State.find(id);
  const panel = $('#detail-panel');
  panel.innerHTML = '';
  if(!idea){ panel.classList.add('hidden'); return }
  panel.classList.remove('hidden');
  const h = document.createElement('h2'); h.textContent = idea.name; panel.appendChild(h);
  const meta = document.createElement('div'); meta.textContent = `${idea.type} • ${idea.tags || ''}`; panel.appendChild(meta);
  const p = document.createElement('p'); p.textContent = idea.details || ''; panel.appendChild(p);
  
  // Edit button (styled below)
  
  const edit = document.createElement('button');
  edit.textContent = 'Edit';
  edit.className = 'btn btn-edit';
  edit.addEventListener('click', ()=> openEditForm(idea));

  const del = document.createElement('button');
  del.textContent = 'Delete';
  del.className = 'btn btn-delete';
  del.addEventListener('click', ()=> doDelete(idea.id));

  panel.appendChild(edit);
  panel.appendChild(del);
}

function openEditForm(idea){
  // switch to Add tab and populate
  // hide detail panel when editing
  $('#detail-panel').classList.add('hidden');
  $('#tab-add').click();
  $('#fld-type').value = idea.type;
  $('#fld-name').value = idea.name;
  $('#fld-tags').value = idea.tags || '';
  $('#fld-details').value = idea.details || '';
  $('#idea-form').dataset.editId = idea.id;
}

async function doDelete(id){
  if(!confirm('Delete this idea?')) return;
  try{
    const r = await ApiClient.deleteIdea(id);
    if(r && r.success) { await refresh(); $('#detail-panel').classList.add('hidden'); }
    else alert('Delete failed');
  }catch(e){ console.error(e); alert('Network error'); }
}

async function refresh(){ await State.load(); renderList(); }

async function init(){
  // initialize type selector
  TypeSelector.attach($('#fld-type'));

  // tabs
  $('#tab-list').addEventListener('click', ()=>{ $('#list-view').classList.remove('hidden'); $('#add-view').classList.add('hidden'); $('#tab-list').classList.add('active'); $('#tab-add').classList.remove('active'); });
  $('#tab-add').addEventListener('click', ()=>{ $('#list-view').classList.add('hidden'); $('#add-view').classList.remove('hidden'); $('#tab-add').classList.add('active'); $('#tab-list').classList.remove('active'); });
  $('#refresh').addEventListener('click', refresh);

  // form
  $('#idea-form').addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const data = {
      type: $('#fld-type').value,
      name: $('#fld-name').value.trim(),
      tags: $('#fld-tags').value.trim(),
      details: $('#fld-details').value.trim()
    };
    const editId = $('#idea-form').dataset.editId;
    try{
      if(editId){ data.id = Number(editId); const r = await ApiClient.updateIdea(data); delete $('#idea-form').dataset.editId; }
      else { const r = await ApiClient.addIdea(data); }
      // persist custom type if new
      TypeSelector.addIfMissing(data.type);
      await refresh(); $('#tab-list').click();
    }catch(e){ console.error(e); alert('Save failed'); }
  });
  $('#cancel').addEventListener('click', ()=>{ $('#idea-form').reset(); $('#tab-list').click(); delete $('#idea-form').dataset.editId; });

  // search
  $('#search').addEventListener('input', (e)=>{
    const q = e.target.value.toLowerCase();
    const items = document.querySelectorAll('#ideas-list li');
    items.forEach(li=>{ const txt = li.textContent.toLowerCase(); li.style.display = txt.includes(q)?'block':'none'; });
  });

  await refresh();
}

window.addEventListener('DOMContentLoaded', init);

// Register service worker for PWA functionality
window.addEventListener('load', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').then(reg => {
      console.log('ServiceWorker registered', reg.scope);
    }).catch(err => console.warn('ServiceWorker registration failed', err));
  }
});
