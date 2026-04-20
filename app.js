const API_KEY = 'YOUR_ANTHROPIC_API_KEY_HERE';

let D = null;
let logState = { intensity: 3, exercises: [], template: null };
let sheetCat = 'all';
let charts = {};
let recsLoaded = false;

// ── Boot ──────────────────────────────────────────────────────
async function init() {
  try {
    const r = await fetch('data.json?v=' + Date.now());
    D = await r.json();
  } catch (e) {
    document.body.innerHTML = '<p style="padding:40px;font-family:monospace;color:#fff;background:#111;height:100vh">Could not load data.json.<br><br>Run via a server: <code>npx serve .</code><br>or push to GitHub Pages.</p>';
    return;
  }
  setupTabs();
  setupLog();
  setupSheet();
  renderHome();
}

// ── Tabs ──────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = btn.dataset.screen;
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.screen').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('screen-' + s).classList.add('active');
      if (s === 'history')  renderHistory();
      if (s === 'progress') renderProgress();
      if (s === 'coach')    renderRecs();
      if (s === 'log')      resetLog();
    });
  });
}

// ── HOME ──────────────────────────────────────────────────────
function renderHome() {
  const now = new Date();
  const h = now.getHours();
  document.getElementById('greeting-text').textContent =
    h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  document.getElementById('today-text').textContent =
    now.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' });

  const active = D.sessions.filter(s => s.type !== 'rest');
  const wkStart = getWeekStart(now);
  const thisWeek = active.filter(s => new Date(s.date + 'T12:00:00') >= wkStart).length;
  const sorted = [...D.sessions].sort((a,b) => b.date.localeCompare(a.date));
  const last = sorted.find(s => s.type !== 'rest');
  const dAgo = last ? Math.floor((now - new Date(last.date + 'T12:00:00')) / 86400000) : null;

  document.getElementById('home-metrics').innerHTML = `
    <div class="metric-card"><div class="metric-label">Sessions</div><div class="metric-value">${active.length}</div></div>
    <div class="metric-card"><div class="metric-label">This week</div><div class="metric-value">${thisWeek}</div></div>
    <div class="metric-card"><div class="metric-label">Last session</div><div class="metric-value" style="font-size:20px">${dAgo === 0 ? 'Today' : dAgo === 1 ? 'Yesterday' : (dAgo ?? '—') + '<span class="metric-unit">d</span>'}</div></div>
    <div class="metric-card"><div class="metric-label">Avg/week</div><div class="metric-value">${avgPerWeek()}<span class="metric-unit">×</span></div></div>
  `;

  document.getElementById('recent-cards').innerHTML =
    sorted.slice(0, 5).map(s => sessionCard(s)).join('');

  document.getElementById('mile-list').innerHTML = `
    <div class="mile-row"><span class="mile-label">Pull-up assist</span><span><span class="mile-old">–20kg</span><span class="mile-arrow">→</span><span class="mile-val">–10 kg</span></span></div>
    <div class="mile-row"><span class="mile-label">Interval speed</span><span><span class="mile-old">12 km/h</span><span class="mile-arrow">→</span><span class="mile-val">14 km/h</span></span></div>
    <div class="mile-row"><span class="mile-label">Vertical row</span><span><span class="mile-val">39 kg · 3×10</span></span></div>
    <div class="mile-row"><span class="mile-label">Frequency</span><span><span class="mile-old">3×/wk</span><span class="mile-arrow">→</span><span class="mile-val">4–5×/wk</span></span></div>
    <div class="mile-row"><span class="mile-label">Body weight</span><span><span class="mile-val">+2 kg</span></span></div>
  `;
}

function sessionCard(s) {
  const pips = [1,2,3,4,5].map(i =>
    `<span class="pip ${i <= s.intensity ? 'on' : ''}"></span>`).join('');
  const ds = new Date(s.date + 'T12:00:00').toLocaleDateString('en-GB',
    { day:'numeric', month:'short' });
  let detail = '';
  if (s.exercises && s.exercises.length) {
    detail = s.exercises.map(e => {
      const def = D.exercises.find(x => x.id === e.id);
      const nm = def ? def.name : e.id;
      const parts = [];
      if (e.kg != null) parts.push(e.kg < 0 ? `assist ${Math.abs(e.kg)}kg` : `${e.kg}kg`);
      if (e.sets) parts.push(`${e.sets}×${e.reps || (e.secs ? e.secs + 's' : '')}`);
      if (e.mins) parts.push(`${e.mins}min`);
      if (e.note) parts.push(e.note);
      return `<div class="s-ex-row"><span class="s-ex-name">${nm}</span><span>${parts.join(' · ')}</span></div>`;
    }).join('');
  }
  if (s.notes) detail += `<div class="s-notes">${s.notes}</div>`;

  return `<div class="s-card" onclick="this.classList.toggle('open')">
    <div class="s-card-head">
      <span class="s-card-date">${ds}</span>
      <span class="tag tag-${s.type}">${typeLabel(s.type)}</span>
    </div>
    <div class="s-card-meta">
      ${s.duration_min ? s.duration_min + ' min' : ''}
      <span class="pips">${pips}</span>
    </div>
    ${detail ? `<div class="s-card-detail">${detail}</div>` : ''}
  </div>`;
}

// ── HISTORY ───────────────────────────────────────────────────
function renderHistory() {
  const ft = document.getElementById('filter-type').value;
  const sorted = [...D.sessions].sort((a,b) => b.date.localeCompare(a.date));
  const list = ft === 'all' ? sorted : sorted.filter(s => s.type === ft);
  document.getElementById('history-list').innerHTML = list.map(s => sessionCard(s)).join('');
  document.getElementById('filter-type').onchange = renderHistory;
}

// ── LOG ───────────────────────────────────────────────────────
function setupLog() {
  document.getElementById('f-date').value = todayStr();

  document.querySelectorAll('.int-dot').forEach(d => {
    d.addEventListener('click', () => {
      document.querySelectorAll('.int-dot').forEach(x => x.classList.remove('sel'));
      d.classList.add('sel');
      logState.intensity = parseInt(d.dataset.v);
    });
  });

  const trow = document.getElementById('template-row');
  trow.innerHTML = D.templates.map(t => `
    <div class="tmpl-btn" data-tid="${t.id}" onclick="pickTemplate('${t.id}',this)">
      <div class="tmpl-emoji">${t.emoji}</div>
      <div class="tmpl-name">${t.name}</div>
      <div class="tmpl-count">${t.exercises.length} exercises</div>
    </div>`).join('');

  document.getElementById('add-ex-btn').addEventListener('click', openSheet);
  document.getElementById('save-btn').addEventListener('click', saveSession);
}

function resetLog() {
  logState = { intensity: 3, exercises: [], template: null };
  document.getElementById('f-date').value = todayStr();
  document.getElementById('f-dur').value = '';
  document.getElementById('f-notes').value = '';
  document.querySelectorAll('.int-dot').forEach(d => d.classList.toggle('sel', d.dataset.v === '3'));
  document.querySelectorAll('.tmpl-btn').forEach(b => b.classList.remove('sel'));
  renderExList();
  document.getElementById('save-feedback').textContent = '';
}

function pickTemplate(tid, el) {
  if (logState.template === tid) {
    el.classList.remove('sel');
    logState.template = null;
    logState.exercises = [];
  } else {
    document.querySelectorAll('.tmpl-btn').forEach(b => b.classList.remove('sel'));
    el.classList.add('sel');
    const tmpl = D.templates.find(t => t.id === tid);
    logState.template = tid;
    logState.exercises = tmpl.exercises.map(exId => {
      const def = D.exercises.find(e => e.id === exId);
      if (!def) return null;
      const last = lastUsed(exId);
      return { exId, ...((last || def.default) || {}) };
    }).filter(Boolean);
    // set intensity
    document.querySelectorAll('.int-dot').forEach(d =>
      d.classList.toggle('sel', parseInt(d.dataset.v) === tmpl.intensity));
    logState.intensity = tmpl.intensity;
  }
  renderExList();
}

function renderExList() {
  const el = document.getElementById('ex-list');
  if (!logState.exercises.length) {
    el.innerHTML = '<div class="ex-empty">Pick a template or tap + Add</div>';
    return;
  }
  el.innerHTML = logState.exercises.map((ex, i) => {
    const def = D.exercises.find(e => e.id === ex.exId);
    const name = def ? def.name : ex.exId;
    const cat = def ? def.category : '';
    let fields = '';
    if (ex.kg != null)   fields += exField(i, 'kg',   ex.kg,   'kg');
    if (ex.sets != null) fields += exField(i, 'sets', ex.sets, 'sets');
    if (ex.reps != null) fields += exField(i, 'reps', ex.reps, 'reps');
    if (ex.secs != null) fields += exField(i, 'secs', ex.secs, 'sec');
    if (ex.mins != null) fields += exField(i, 'mins', ex.mins, 'min');
    return `<div class="ex-row">
      <div class="ex-row-head">
        <div><div class="ex-row-name">${name}</div><div class="ex-cat-pill">${cat}</div></div>
        <div class="ex-remove" onclick="removeEx(${i})">×</div>
      </div>
      <div class="ex-fields">${fields}</div>
      <div class="ex-f ex-note"><input type="text" placeholder="note" value="${ex.note||''}" oninput="updEx(${i},'note',this.value)"></div>
    </div>`;
  }).join('');
}

function exField(i, key, val, lbl) {
  return `<div class="ex-f">
    <div class="ex-f-label">${lbl}</div>
    <input type="number" value="${val}" step="${key==='kg'?0.5:1}" inputmode="decimal"
      oninput="updEx(${i},'${key}',parseFloat(this.value)||0)">
  </div>`;
}

function updEx(i, key, val) { logState.exercises[i][key] = val; }
function removeEx(i) { logState.exercises.splice(i, 1); renderExList(); }

function lastUsed(exId) {
  const sorted = [...D.sessions].sort((a,b) => b.date.localeCompare(a.date));
  for (const s of sorted) {
    const ex = (s.exercises || []).find(e => e.id === exId);
    if (ex) { const {id, ...rest} = ex; return rest; }
  }
  return null;
}

function saveSession() {
  const date = document.getElementById('f-date').value;
  if (!date) return;
  const dur = parseInt(document.getElementById('f-dur').value) || 0;
  const notes = document.getElementById('f-notes').value.trim();
  let type = 'full';
  if (logState.template) {
    const tmpl = D.templates.find(t => t.id === logState.template);
    if (tmpl) type = tmpl.type;
  }
  const compSet = new Set(logState.exercises.map(e => {
    const def = D.exercises.find(x => x.id === e.exId);
    return def ? def.category : null;
  }).filter(Boolean));

  D.sessions.push({
    id: Date.now(), date, type,
    duration_min: dur,
    intensity: logState.intensity,
    components: [...compSet],
    exercises: logState.exercises.map(e => ({
      id: e.exId,
      ...(e.kg != null ? {kg:e.kg} : {}),
      ...(e.sets != null ? {sets:e.sets} : {}),
      ...(e.reps != null ? {reps:e.reps} : {}),
      ...(e.secs != null ? {secs:e.secs} : {}),
      ...(e.mins != null ? {mins:e.mins} : {}),
      ...(e.note ? {note:e.note} : {})
    })),
    notes,
    week: isoWeek(new Date(date + 'T12:00:00'))
  });
  D.sessions.sort((a,b) => a.date.localeCompare(b.date));

  document.getElementById('save-feedback').textContent = 'Saved! Share with Claude to update data.json';
  setTimeout(() => document.getElementById('save-feedback').textContent = '', 4000);
  recsLoaded = false;
  renderHome();
  resetLog();
}

// ── SHEET ─────────────────────────────────────────────────────
function setupSheet() {
  const cats = ['all','cardio','strength','core','mobility','physio'];
  document.getElementById('sheet-cats').innerHTML = cats.map(c =>
    `<div class="cat-pill ${c==='all'?'on':''}" data-c="${c}">${c}</div>`).join('');
  document.getElementById('sheet-cats').querySelectorAll('.cat-pill').forEach(p => {
    p.addEventListener('click', () => {
      document.querySelectorAll('.cat-pill').forEach(x => x.classList.remove('on'));
      p.classList.add('on');
      sheetCat = p.dataset.c;
      renderSheetList();
    });
  });
  document.getElementById('ex-search').addEventListener('input', renderSheetList);
  document.getElementById('sheet-backdrop', document.getElementById('ex-sheet')).addEventListener('click', e => {
    if (e.target === document.getElementById('ex-sheet')) closeSheet();
  });
  document.getElementById('ex-sheet').addEventListener('click', e => {
    if (e.target === document.getElementById('ex-sheet')) closeSheet();
  });
  document.getElementById('btn-create').addEventListener('click', createEx);
}

function openSheet() {
  document.getElementById('ex-sheet').style.display = 'flex';
  document.getElementById('ex-search').value = '';
  sheetCat = 'all';
  document.querySelectorAll('.cat-pill').forEach(p => p.classList.toggle('on', p.dataset.c === 'all'));
  renderSheetList();
  setTimeout(() => document.getElementById('ex-search').focus(), 80);
}

function closeSheet() {
  document.getElementById('ex-sheet').style.display = 'none';
}

function renderSheetList() {
  const q = document.getElementById('ex-search').value.toLowerCase().trim();
  const list = D.exercises.filter(e => {
    const catOk = sheetCat === 'all' || e.category === sheetCat;
    const nameOk = !q || e.name.toLowerCase().includes(q);
    return catOk && nameOk;
  });

  const newZone = document.getElementById('sheet-new');
  if (!list.length && q) {
    newZone.style.display = 'block';
    document.querySelector('.sheet-new-label').textContent = `"${q}" not found — create it?`;
  } else {
    newZone.style.display = 'none';
  }

  document.getElementById('sheet-list').innerHTML = list.map(e => {
    const last = lastUsed(e.id);
    let meta = e.category;
    if (last) {
      const p = [
        last.kg != null ? (last.kg < 0 ? `assist ${Math.abs(last.kg)}kg` : `${last.kg}kg`) : '',
        last.sets ? `${last.sets}×${last.reps || (last.secs ? last.secs+'s' : '')}` : '',
        last.mins ? `${last.mins}min` : ''
      ].filter(Boolean).join(' · ');
      if (p) meta += ' · ' + p;
    }
    return `<div class="sheet-ex" onclick="addExFromSheet('${e.id}')">
      <div>
        <div class="sheet-ex-name">${e.name}</div>
        <div class="sheet-ex-meta">${meta}</div>
      </div>
      <div class="sheet-add">+</div>
    </div>`;
  }).join('');
}

function addExFromSheet(exId) {
  const def = D.exercises.find(e => e.id === exId);
  if (!def) return;
  const last = lastUsed(exId);
  logState.exercises.push({ exId, ...((last || def.default) || {}) });
  renderExList();
  closeSheet();
}

function createEx() {
  const name = document.getElementById('ex-search').value.trim();
  const cat = document.getElementById('new-cat').value;
  if (!name) return;
  const id = name.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
  if (!D.exercises.find(e => e.id === id)) {
    D.exercises.push({ id, name, category: cat, default: { sets:3, reps:10 } });
  }
  logState.exercises.push({ exId: id, sets:3, reps:10 });
  renderExList();
  closeSheet();
}

// ── PROGRESS ──────────────────────────────────────────────────
function renderProgress() {
  const byW = {};
  D.sessions.forEach(s => {
    if (!byW[s.week]) byW[s.week] = { n:0, ints:[], durs:[] };
    if (s.type !== 'rest') {
      byW[s.week].n++;
      byW[s.week].ints.push(s.intensity);
      if (s.duration_min) byW[s.week].durs.push(s.duration_min);
    }
  });
  const wks = Object.keys(byW).sort().slice(-8);
  const labels = wks.map(w => w.replace(/\d{4}-/,''));
  const counts = wks.map(w => byW[w].n);
  const ints   = wks.map(w => { const a=byW[w].ints; return a.length ? parseFloat((a.reduce((x,y)=>x+y,0)/a.length).toFixed(1)) : 0; });
  const durs   = wks.map(w => { const a=byW[w].durs; return a.length ? Math.round(a.reduce((x,y)=>x+y,0)/a.length) : 0; });

  Object.values(charts).forEach(c => c.destroy());
  charts = {};

  const g = 'rgba(255,255,255,0.07)';
  const tk = { font:{family:'DM Mono',size:10}, color:'#7a7a74' };
  const base = (yExtra={}) => ({
    responsive:true, maintainAspectRatio:false,
    plugins:{legend:{display:false}},
    scales:{
      x:{grid:{display:false},ticks:tk},
      y:{grid:{color:g},ticks:{...tk,...yExtra}}
    }
  });
  charts.f = new Chart(document.getElementById('c-freq'), { type:'bar', data:{labels, datasets:[{data:counts,backgroundColor:'#4a9e6a',borderRadius:4}]}, options:base({stepSize:1,beginAtZero:true}) });
  charts.i = new Chart(document.getElementById('c-int'),  { type:'line', data:{labels, datasets:[{data:ints,borderColor:'#c49a3a',backgroundColor:'rgba(196,154,58,0.1)',tension:0.3,pointRadius:4,fill:true}]}, options:base({min:0,max:5,stepSize:1}) });
  charts.d = new Chart(document.getElementById('c-dur'),  { type:'bar', data:{labels, datasets:[{data:durs,backgroundColor:'#4a82c0',borderRadius:4}]}, options:base({beginAtZero:true}) });
}

// ── RECS ──────────────────────────────────────────────────────
async function renderRecs(force=false) {
  if (recsLoaded && !force) return;
  const list = document.getElementById('recs-list');
  const loading = document.getElementById('recs-loading');
  loading.style.display = 'block';
  list.innerHTML = '';

  const p = D.profile;
  const sorted = [...D.sessions].sort((a,b)=>a.date.localeCompare(b.date));
  const history = sorted.map(s => {
    const exs = (s.exercises||[]).map(e => {
      const def = D.exercises.find(x=>x.id===e.id);
      const nm = def?def.name:e.id;
      const parts = [
        e.kg!=null?(e.kg<0?`assist ${Math.abs(e.kg)}kg`:`${e.kg}kg`):'',
        e.sets?`${e.sets}×${e.reps||''}`:'' ,
        e.mins?`${e.mins}min`:'',
        e.note||''
      ].filter(Boolean).join(' ');
      return nm + (parts ? ' ('+parts+')' : '');
    }).join(', ');
    return `${s.date} [${typeLabel(s.type)}, i${s.intensity}/5, ${s.duration_min}min]${exs?'\n  '+exs:''}${s.notes?'\n  '+s.notes:''}`;
  }).join('\n\n');

  const prompt = `Personal trainer. Analyse training and give 5 specific actionable recommendations.
Profile: ${p.gender}, ${p.age}yo, ${p.height_cm}cm, ${p.weight_kg}kg.
History:\n${history}
Context: returned after 3-week break, wrist irritation managed, pull-ups -10kg assist, running to 14km/h, 4-5×/week.
ONLY return JSON array, no markdown: [{"type":"good|warn|info","title":"...","body":"2-3 sentences."},...]`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:1000, messages:[{role:'user',content:prompt}] })
    });
    const data = await res.json();
    const text = data.content?.map(c=>c.text||'').join('').trim();
    const recs = JSON.parse(text.replace(/```json|```/g,'').trim());
    loading.style.display = 'none';
    list.innerHTML = recs.map(r =>
      `<div class="rec-card ${r.type}"><div class="rec-title">${r.title}</div><div class="rec-body">${r.body}</div></div>`
    ).join('') + `<div class="recs-ts">Generated ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</div>`;
    recsLoaded = true;
  } catch(e) {
    loading.style.display = 'none';
    list.innerHTML = `<div class="rec-card warn"><div class="rec-title">API key needed</div><div class="rec-body">Open app.js line 1 and replace YOUR_ANTHROPIC_API_KEY_HERE with your key from console.anthropic.com</div></div>`;
  }

  document.getElementById('refresh-recs').onclick = () => { recsLoaded = false; renderRecs(true); };
}

// ── Helpers ───────────────────────────────────────────────────
function typeLabel(t) {
  return {full:'Full',cardio:'Cardio',strength:'Strength',core:'Core',light:'Light',activity:'Activity',rest:'Rest'}[t]||t;
}
function todayStr() { return new Date().toISOString().slice(0,10); }
function getWeekStart(d) {
  const m = new Date(d); m.setDate(d.getDate()-((d.getDay()+6)%7)); m.setHours(0,0,0,0); return m;
}
function isoWeek(d) {
  const j = new Date(d.getFullYear(),0,4);
  return `${d.getFullYear()}-W${String(Math.ceil(((d-j)/86400000+j.getDay()+1)/7)).padStart(2,'0')}`;
}
function avgPerWeek() {
  const byW = {};
  D.sessions.filter(s=>s.type!=='rest').forEach(s=>{ byW[s.week]=(byW[s.week]||0)+1; });
  const v = Object.values(byW);
  return v.length ? (v.reduce((a,b)=>a+b,0)/v.length).toFixed(1) : 0;
}

init();
