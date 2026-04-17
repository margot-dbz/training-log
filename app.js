// ── Config ────────────────────────────────────────────────────
const API_KEY = 'YOUR_ANTHROPIC_API_KEY_HERE';

// ── State ─────────────────────────────────────────────────────
let D = null; // data.json contents
let logState = {
  intensity: 3,
  exercises: [],   // { exId, kg, sets, reps, secs, mins, note }
  activeTemplate: null
};
let modalCatFilter = 'all';
let charts = {};

// ── Boot ──────────────────────────────────────────────────────
async function init() {
  try {
    const r = await fetch('data.json?v=' + Date.now());
    D = await r.json();
  } catch (e) {
    document.body.innerHTML = '<p style="padding:40px;font-family:monospace">Could not load data.json — make sure you\'re running via a local server (e.g. <code>npx serve .</code>), not opening the file directly.</p>';
    return;
  }
  setupNav();
  setupLog();
  renderDashboard();
  renderProfileSidebar();
}

// ── Nav ───────────────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.tab;
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + t).classList.add('active');
      if (t === 'log')      resetLog();
      if (t === 'history')  renderHistory();
      if (t === 'progress') renderProgress();
      if (t === 'coach')    renderRecs();
    });
  });
}

// ── Sidebar profile ───────────────────────────────────────────
function renderProfileSidebar() {
  const p = D.profile;
  document.getElementById('profile-summary').textContent =
    `${p.age}y · ${p.height_cm}cm · ${p.weight_kg}kg`;
}

// ── Dashboard ─────────────────────────────────────────────────
function renderDashboard() {
  const now = new Date();
  document.getElementById('today-date').textContent =
    now.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const h = now.getHours();
  document.getElementById('greeting').textContent =
    h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';

  const active = D.sessions.filter(s => s.type !== 'rest');
  const wkStart = weekStart(now);
  const thisWeek = active.filter(s => new Date(s.date + 'T12:00:00') >= wkStart).length;
  const sorted = [...D.sessions].sort((a,b) => b.date.localeCompare(a.date));
  const last = sorted.find(s => s.type !== 'rest');
  const daysAgo = last ? Math.floor((now - new Date(last.date + 'T12:00:00')) / 86400000) : null;
  const avgWk = avgPerWeek();

  document.getElementById('dashboard-metrics').innerHTML = `
    <div class="metric"><div class="metric-label">Total sessions</div><div class="metric-value">${active.length}</div></div>
    <div class="metric"><div class="metric-label">This week</div><div class="metric-value">${thisWeek}</div></div>
    <div class="metric"><div class="metric-label">Last session</div><div class="metric-value">${daysAgo === 0 ? 'Today' : daysAgo === 1 ? '1<span class="metric-unit">d ago</span>' : (daysAgo ?? '—') + '<span class="metric-unit">d ago</span>'}</div></div>
    <div class="metric"><div class="metric-label">Avg / week</div><div class="metric-value">${avgWk}<span class="metric-unit">×</span></div></div>
  `;

  document.getElementById('recent-list').innerHTML =
    sorted.slice(0,6).map(s => sessionRowHTML(s)).join('');
  bindSessionRows('#recent-list');

  document.getElementById('milestones-list').innerHTML = `
    <div class="milestone-row"><span class="milestone-label">Pull-up assist</span><span><span class="milestone-old">–20 kg</span><span class="milestone-arrow">→</span><span class="milestone-val">–10 kg</span></span></div>
    <div class="milestone-row"><span class="milestone-label">Interval speed</span><span><span class="milestone-old">12 km/h</span><span class="milestone-arrow">→</span><span class="milestone-val">14 km/h</span></span></div>
    <div class="milestone-row"><span class="milestone-label">Vertical row</span><span><span class="milestone-val">39 kg · 3×10</span></span></div>
    <div class="milestone-row"><span class="milestone-label">Frequency</span><span><span class="milestone-old">3×/wk</span><span class="milestone-arrow">→</span><span class="milestone-val">4–5×/wk</span></span></div>
    <div class="milestone-row"><span class="milestone-label">Body weight</span><span><span class="milestone-val">+2 kg</span></span></div>
  `;
}

// ── Session row HTML ──────────────────────────────────────────
function sessionRowHTML(s) {
  const pips = [1,2,3,4,5].map(i =>
    `<span class="pip ${i <= s.intensity ? 'on' : ''}"></span>`).join('');
  const typeTag = `<span class="tag tag-${s.type === 'activity' ? 'activity' : s.type === 'rest' ? 'rest' : 'type'}">${typeLabel(s.type)}</span>`;
  const d = new Date(s.date + 'T12:00:00');
  const ds = d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'2-digit' });

  let exHTML = '';
  if (s.exercises && s.exercises.length) {
    exHTML = s.exercises.map(e => {
      const def = D.exercises.find(x => x.id === e.id);
      const name = def ? def.name : e.id;
      const parts = [];
      if (e.kg != null) parts.push(e.kg < 0 ? `assist ${Math.abs(e.kg)} kg` : `${e.kg} kg`);
      if (e.sets) parts.push(`${e.sets}×${e.reps || e.secs + 's' || ''}`);
      if (e.mins) parts.push(`${e.mins} min`);
      if (e.note) parts.push(e.note);
      return `<div class="session-ex-row"><span class="session-ex-name">${name}</span><span>${parts.join(' · ')}</span></div>`;
    }).join('');
  }
  const notesHTML = s.notes ? `<div class="session-notes-text">${s.notes}</div>` : '';

  return `<div class="session-row" onclick="this.classList.toggle('expanded')">
    <div class="session-head">
      <span class="session-date">${ds}</span>
      <div class="tags">${typeTag}</div>
    </div>
    <div class="session-meta">${s.duration_min ? s.duration_min + ' min &nbsp;·&nbsp; ' : ''}<span class="pips">${pips}</span></div>
    <div class="session-exercises">${exHTML}${notesHTML}</div>
  </div>`;
}

function bindSessionRows(scope = '') {
  // rows are now handled by inline onclick
}

// ── History ───────────────────────────────────────────────────
function renderHistory() {
  const ft = document.getElementById('filter-type').value;
  const sorted = [...D.sessions].sort((a,b) => b.date.localeCompare(a.date));
  const list = ft === 'all' ? sorted : sorted.filter(s => s.type === ft);
  document.getElementById('history-list').innerHTML = list.map(s => sessionRowHTML(s)).join('');
  document.getElementById('filter-type').onchange = renderHistory;
}

// ── Log session ───────────────────────────────────────────────
function setupLog() {
  document.getElementById('f-date').value = todayStr();
  document.getElementById('f-date').addEventListener('change', e => {
    document.getElementById('log-date-display').textContent =
      new Date(e.target.value + 'T12:00:00').toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' });
  });

  // intensity picker
  document.querySelectorAll('.int-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.int-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      logState.intensity = parseInt(btn.dataset.v);
    });
  });

  // templates
  const tg = document.getElementById('template-grid');
  tg.innerHTML = D.templates.map(t => `
    <button class="template-btn" data-tid="${t.id}">
      <span class="template-emoji">${t.emoji}</span>
      <div>
        <div class="template-name">${t.name}</div>
        <div class="template-count">${t.exercises.length} exercises</div>
      </div>
    </button>
  `).join('');
  tg.querySelectorAll('.template-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tid = btn.dataset.tid;
      if (logState.activeTemplate === tid) {
        // deselect
        btn.classList.remove('active');
        logState.activeTemplate = null;
        logState.exercises = [];
      } else {
        tg.querySelectorAll('.template-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadTemplate(tid);
      }
      renderExerciseList();
    });
  });

  // add exercise button
  document.getElementById('add-exercise-btn').addEventListener('click', openModal);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('exercise-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('exercise-modal')) closeModal();
  });

  // search
  document.getElementById('exercise-search').addEventListener('input', renderModalList);

  // category filters
  const cats = ['all','cardio','strength','core','mobility','physio'];
  document.getElementById('modal-cats').innerHTML = cats.map(c =>
    `<div class="cat-filter ${c==='all'?'active':''}" data-c="${c}">${c}</div>`).join('');
  document.getElementById('modal-cats').querySelectorAll('.cat-filter').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.cat-filter').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      modalCatFilter = el.dataset.c;
      renderModalList();
    });
  });

  // create new exercise
  document.getElementById('create-exercise-btn').addEventListener('click', createAndAddExercise);

  // save
  document.getElementById('save-btn').addEventListener('click', saveSession);
}

function resetLog() {
  logState = { intensity: 3, exercises: [], activeTemplate: null };
  document.getElementById('f-date').value = todayStr();
  document.getElementById('f-dur').value = '';
  document.getElementById('f-notes').value = '';
  document.querySelectorAll('.int-btn').forEach(b => b.classList.toggle('selected', b.dataset.v === '3'));
  document.querySelectorAll('.template-btn').forEach(b => b.classList.remove('active'));
  renderExerciseList();
  document.getElementById('log-date-display').textContent = '';
}

function loadTemplate(tid) {
  const tmpl = D.templates.find(t => t.id === tid);
  if (!tmpl) return;
  logState.activeTemplate = tid;
  logState.exercises = tmpl.exercises.map(exId => {
    const def = D.exercises.find(e => e.id === exId);
    if (!def) return null;
    const last = lastUsed(exId);
    return { exId, ...((last || def.default) || {}) };
  }).filter(Boolean);

  // auto-set intensity from template
  document.querySelectorAll('.int-btn').forEach(b =>
    b.classList.toggle('selected', parseInt(b.dataset.v) === tmpl.intensity));
  logState.intensity = tmpl.intensity;
}

function lastUsed(exId) {
  // find most recent session that includes this exercise
  const sorted = [...D.sessions].sort((a,b) => b.date.localeCompare(a.date));
  for (const s of sorted) {
    if (!s.exercises) continue;
    const ex = s.exercises.find(e => e.id === exId);
    if (ex) {
      const { id, ...rest } = ex;
      return rest;
    }
  }
  return null;
}

function renderExerciseList() {
  const container = document.getElementById('exercise-list');
  if (!logState.exercises.length) {
    container.innerHTML = '<div class="empty-exercises">Tap a template above or add exercises individually</div>';
    return;
  }
  container.innerHTML = logState.exercises.map((ex, i) => {
    const def = D.exercises.find(e => e.id === ex.exId);
    const name = def ? def.name : ex.exId;
    const cat = def ? def.category : '';

    let fields = '';
    if (ex.kg != null) fields += numField(i, 'kg', ex.kg, 'kg');
    if (ex.sets != null) fields += numField(i, 'sets', ex.sets, 'sets');
    if (ex.reps != null) fields += numField(i, 'reps', ex.reps, 'reps');
    if (ex.secs != null) fields += numField(i, 'secs', ex.secs, 'sec');
    if (ex.mins != null) fields += numField(i, 'mins', ex.mins, 'min');
    fields += `<div class="ex-note-field"><input type="text" placeholder="note" value="${ex.note||''}" oninput="updateExField(${i},'note',this.value)"></div>`;

    return `<div class="ex-log-row">
      <div class="ex-log-name">${name} <span class="ex-cat-label">${cat}</span></div>
      <div class="ex-log-fields">${fields}</div>
      <div class="ex-remove" onclick="removeExercise(${i})">×</div>
    </div>`;
  }).join('');
}

function numField(i, key, val, label) {
  return `<div class="ex-num-field">
    <div class="ex-num-label">${label}</div>
    <input type="number" value="${val}" step="${key==='kg'?0.5:1}" oninput="updateExField(${i},'${key}',parseFloat(this.value)||0)">
  </div>`;
}

function updateExField(i, key, val) {
  logState.exercises[i][key] = val;
}

function removeExercise(i) {
  logState.exercises.splice(i, 1);
  renderExerciseList();
}

// ── Modal ─────────────────────────────────────────────────────
function openModal() {
  document.getElementById('exercise-modal').style.display = 'flex';
  document.getElementById('exercise-search').value = '';
  modalCatFilter = 'all';
  document.querySelectorAll('.cat-filter').forEach(x => x.classList.toggle('active', x.dataset.c === 'all'));
  renderModalList();
  setTimeout(() => document.getElementById('exercise-search').focus(), 50);
}

function closeModal() {
  document.getElementById('exercise-modal').style.display = 'none';
}

function renderModalList() {
  const q = document.getElementById('exercise-search').value.toLowerCase().trim();
  const list = D.exercises.filter(e => {
    const catOk = modalCatFilter === 'all' || e.category === modalCatFilter;
    const nameOk = !q || e.name.toLowerCase().includes(q);
    return catOk && nameOk;
  });

  const newZone = document.getElementById('modal-new-zone');

  if (!list.length && q) {
    // suggest creating new
    newZone.style.display = 'block';
    document.querySelector('#modal-new-zone .modal-new-label').textContent =
      `"${q}" not found — create it?`;
  } else {
    newZone.style.display = 'none';
  }

  document.getElementById('modal-exercise-list').innerHTML = list.map(e => {
    const last = lastUsed(e.id);
    const meta = last
      ? [last.kg != null ? last.kg + ' kg' : '', last.sets ? last.sets + '×' + (last.reps || last.secs + 's') : '', last.mins ? last.mins + 'min' : ''].filter(Boolean).join(' · ')
      : 'no history yet';
    return `<div class="modal-ex-item" onclick="addExerciseFromModal('${e.id}')">
      <div>
        <div class="modal-ex-name">${e.name}</div>
        <div class="modal-ex-meta">${e.category} · ${meta}</div>
      </div>
      <div class="modal-ex-add">+</div>
    </div>`;
  }).join('');
}

function addExerciseFromModal(exId) {
  const def = D.exercises.find(e => e.id === exId);
  if (!def) return;
  const last = lastUsed(exId);
  logState.exercises.push({ exId, ...((last || def.default) || {}) });
  renderExerciseList();
  closeModal();
}

function createAndAddExercise() {
  const name = document.getElementById('exercise-search').value.trim();
  const cat = document.getElementById('new-ex-cat').value;
  if (!name) return;
  const id = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  if (D.exercises.find(e => e.id === id)) {
    addExerciseFromModal(id);
    return;
  }
  const newEx = { id, name, category: cat, default: { sets: 3, reps: 10 } };
  D.exercises.push(newEx);
  logState.exercises.push({ exId: id, sets: 3, reps: 10 });
  renderExerciseList();
  closeModal();
  showMsg('save-msg', `"${name}" added to your exercise library`);
}

// ── Save session ──────────────────────────────────────────────
function saveSession() {
  const date = document.getElementById('f-date').value;
  const dur = parseInt(document.getElementById('f-dur').value) || 0;
  const notes = document.getElementById('f-notes').value.trim();
  if (!date) return;

  // derive type from template or exercises
  let type = 'full';
  if (logState.activeTemplate) {
    const tmpl = D.templates.find(t => t.id === logState.activeTemplate);
    if (tmpl) type = tmpl.type;
  }

  // derive components
  const compSet = new Set(logState.exercises.map(e => {
    const def = D.exercises.find(x => x.id === e.exId);
    return def ? def.category : null;
  }).filter(Boolean));

  const sessionExercises = logState.exercises.map(e => ({
    id: e.exId,
    ...(e.kg != null ? { kg: e.kg } : {}),
    ...(e.sets != null ? { sets: e.sets } : {}),
    ...(e.reps != null ? { reps: e.reps } : {}),
    ...(e.secs != null ? { secs: e.secs } : {}),
    ...(e.mins != null ? { mins: e.mins } : {}),
    ...(e.note ? { note: e.note } : {})
  }));

  const session = {
    id: Date.now(),
    date, type,
    duration_min: dur,
    intensity: logState.intensity,
    components: [...compSet],
    exercises: sessionExercises,
    notes,
    week: isoWeek(new Date(date + 'T12:00:00'))
  };

  D.sessions.push(session);
  D.sessions.sort((a, b) => a.date.localeCompare(b.date));

  showMsg('save-msg', 'Saved! Share sessions with Claude to update data.json');
  resetLog();
  renderDashboard();
}

// ── Progress charts ───────────────────────────────────────────
function renderProgress() {
  const byWeek = {};
  D.sessions.forEach(s => {
    if (!byWeek[s.week]) byWeek[s.week] = { count:0, ints:[], durs:[] };
    if (s.type !== 'rest') {
      byWeek[s.week].count++;
      byWeek[s.week].ints.push(s.intensity);
      if (s.duration_min) byWeek[s.week].durs.push(s.duration_min);
    }
  });

  const weeks = Object.keys(byWeek).sort().slice(-10);
  const labels = weeks.map(w => w.replace(/\d{4}-/, ''));
  const counts = weeks.map(w => byWeek[w].count);
  const avgInts = weeks.map(w => {
    const a = byWeek[w].ints;
    return a.length ? parseFloat((a.reduce((x,y)=>x+y,0)/a.length).toFixed(1)) : 0;
  });
  const avgDurs = weeks.map(w => {
    const a = byWeek[w].durs;
    return a.length ? Math.round(a.reduce((x,y)=>x+y,0)/a.length) : 0;
  });

  Object.values(charts).forEach(c => c.destroy());
  charts = {};

  const g = 'rgba(0,0,0,0.06)';
  const tick = { font:{ family:'DM Mono', size:11 } };
  const base = (extra={}) => ({ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ x:{grid:{display:false},ticks:tick}, y:{grid:{color:g},ticks:{...tick,...extra}} } });

  charts.freq = new Chart(document.getElementById('chart-freq'), { type:'bar', data:{ labels, datasets:[{ data:counts, backgroundColor:'#2d5a3d', borderRadius:4 }] }, options:base({stepSize:1,beginAtZero:true}) });
  charts.int  = new Chart(document.getElementById('chart-int'),  { type:'line', data:{ labels, datasets:[{ data:avgInts, borderColor:'#8b3a2a', backgroundColor:'rgba(139,58,42,0.08)', tension:0.3, pointRadius:4, fill:true }] }, options:base({min:0,max:5,stepSize:1}) });
  charts.dur  = new Chart(document.getElementById('chart-dur'),  { type:'bar', data:{ labels, datasets:[{ data:avgDurs, backgroundColor:'#1e4a7a', borderRadius:4 }] }, options:base({beginAtZero:true}) });
}

// ── AI Recs ───────────────────────────────────────────────────
async function renderRecs(force=false) {
  const container = document.getElementById('recs-container');
  const loading   = document.getElementById('recs-loading');
  if (container.dataset.loaded && !force) return;

  loading.style.display = 'block';
  container.innerHTML = '';

  const p = D.profile;
  const sorted = [...D.sessions].sort((a,b)=>a.date.localeCompare(b.date));
  const history = sorted.map(s => {
    const exList = (s.exercises||[]).map(e => {
      const def = D.exercises.find(x=>x.id===e.id);
      const nm = def ? def.name : e.id;
      const parts = [e.kg!=null?(e.kg<0?`assist ${Math.abs(e.kg)}kg`:`${e.kg}kg`):'', e.sets?`${e.sets}×${e.reps||''}`:'' , e.mins?`${e.mins}min`:'', e.note||''].filter(Boolean).join(' ');
      return `${nm}${parts?' ('+parts+')':''}`;
    }).join(', ');
    return `${s.date} [${typeLabel(s.type)}, intensity ${s.intensity}/5, ${s.duration_min}min]${exList?'\n  '+exList:''}${s.notes?'\n  Note: '+s.notes:''}`;
  }).join('\n\n');

  const prompt = `You are a personal trainer. Analyse this training data and give 5 specific, actionable recommendations.

Profile: ${p.gender}, ${p.age}yo, ${p.height_cm}cm, ${p.weight_kg}kg.

Training history:
${history}

Context: User recently returned after a 3-week break. Has had wrist irritation (managed with wrist-safe sessions). Pull-ups improved from ~-20kg to -10kg assist. Running intervals up to 14km/h. Training 4-5×/week.

Return ONLY a JSON array, no markdown, no extra text:
[{"type":"good|warn|info","title":"Short title","body":"2–3 sentence specific recommendation."},...]`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:1000, messages:[{role:'user',content:prompt}] })
    });
    const result = await res.json();
    const text = result.content?.map(c=>c.text||'').join('').trim();
    const recs = JSON.parse(text.replace(/```json|```/g,'').trim());
    loading.style.display = 'none';
    container.innerHTML = recs.map(r =>
      `<div class="rec-card ${r.type}"><div class="rec-title">${r.title}</div><div class="rec-body">${r.body}</div></div>`
    ).join('') + `<div class="recs-ts">Generated ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</div>`;
    container.dataset.loaded = '1';
  } catch(e) {
    loading.style.display = 'none';
    container.innerHTML = `<div class="rec-card warn"><div class="rec-title">API key needed</div><div class="rec-body">Open app.js and replace YOUR_ANTHROPIC_API_KEY_HERE on line 2 with your key from console.anthropic.com</div></div>`;
  }

  document.getElementById('refresh-recs').onclick = () => {
    delete container.dataset.loaded;
    renderRecs(true);
  };
}

// ── Helpers ───────────────────────────────────────────────────
function typeLabel(t) {
  return {full:'Full',cardio:'Cardio',strength:'Strength',core:'Core',light:'Light',activity:'Activity',rest:'Rest'}[t]||t;
}
function todayStr() { return new Date().toISOString().slice(0,10); }
function weekStart(d) {
  const m = new Date(d); m.setDate(d.getDate()-((d.getDay()+6)%7)); m.setHours(0,0,0,0); return m;
}
function isoWeek(d) {
  const jan4 = new Date(d.getFullYear(),0,4);
  const wk = Math.ceil(((d-jan4)/86400000+jan4.getDay()+1)/7);
  return `${d.getFullYear()}-W${String(wk).padStart(2,'0')}`;
}
function avgPerWeek() {
  const byW = {};
  D.sessions.filter(s=>s.type!=='rest').forEach(s=>{ byW[s.week]=(byW[s.week]||0)+1; });
  const v = Object.values(byW);
  return v.length ? (v.reduce((a,b)=>a+b,0)/v.length).toFixed(1) : 0;
}
function showMsg(id, txt) {
  const el = document.getElementById(id);
  el.textContent = txt;
  setTimeout(()=>el.textContent='', 4000);
}

init();
