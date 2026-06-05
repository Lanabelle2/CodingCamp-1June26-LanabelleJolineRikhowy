'use strict';

/* Helpers */
const $ = id => document.getElementById(id);
const CIRCUMFERENCE = 2 * Math.PI * 88;

function pad(n) { return String(n).padStart(2, '0'); }

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

/* Storage */
const Store = {
  get(key, def) {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : def;
    } catch { return def; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }
};

/* State */
const state = {
  tasks: Store.get('ld_tasks', []),
  links: Store.get('ld_links', []),
  userName: Store.get('ld_name', ''),
  pomoDuration: Store.get('ld_pomo', 25),
  theme: Store.get('ld_theme', 'dark'),
};

/* ── CLOCK ── */
const Clock = (() => {
  const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];

  function greeting() {
    const h = new Date().getHours();
    const name = state.userName ? `, ${state.userName}` : '';
    if (h < 12) return `Good morning${name} ☀️`;
    if (h < 17) return `Good afternoon${name} 🌤️`;
    if (h < 21) return `Good evening${name} 🌆`;
    return `Good night${name} 🌙`;
  }

  function tick() {
    const now  = new Date();
    const h    = pad(now.getHours());
    const m    = pad(now.getMinutes());
    const s    = pad(now.getSeconds());
    const day  = DAYS[now.getDay()];
    const date = now.getDate();
    const mon  = MONTHS[now.getMonth()];
    const yr   = now.getFullYear();

    $('clockDisplay').textContent = `${h}:${m}:${s}`;
    $('dateDisplay').textContent  = `${day}, ${date} ${mon} ${yr}`;
    $('greetingText').textContent = greeting();
  }

  function init() { tick(); setInterval(tick, 1000); }

  return { init };
})();

/* ── TIMER ── */
const Timer = (() => {
  let totalSeconds = state.pomoDuration * 60;
  let remaining    = totalSeconds;
  let running      = false;
  let intervalId   = null;

  const display    = $('timerDisplay');
  const ring       = $('timerRingProgress');
  const stateLabel = $('timerStateLabel');
  const startBtn   = $('startStopTimer');
  const resetBtn   = $('resetTimer');

  function setDisplay(secs) {
    display.textContent = `${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`;
  }

  function setRing(secs) {
    const pct = secs / totalSeconds;
    ring.style.strokeDasharray  = CIRCUMFERENCE;
    ring.style.strokeDashoffset = CIRCUMFERENCE * (1 - pct);
    ring.classList.remove('is-warning', 'is-danger');
    if (pct <= 0.1)       ring.classList.add('is-danger');
    else if (pct <= 0.25) ring.classList.add('is-warning');
  }

  function render() {
    setDisplay(remaining);
    setRing(remaining);
    stateLabel.textContent = running ? 'Focusing…' : (remaining === totalSeconds ? 'Ready' : 'Paused');
    startBtn.textContent   = running ? '⏸ Pause' : (remaining < totalSeconds ? '▶ Resume' : '▶ Start');
    $('timerBadge').textContent = `${state.pomoDuration} min`;
  }

  function tick() {
    if (remaining <= 0) {
      stop(); stateLabel.textContent = 'Done! 🎉';
      toast('⏰ Focus session complete!'); return;
    }
    remaining--; render();
  }

  function start() { if (running) return; running = true; intervalId = setInterval(tick, 1000); render(); }
  function stop()  { running = false; clearInterval(intervalId); render(); }
  function toggle() { running ? stop() : start(); }

  function reset() { stop(); remaining = totalSeconds; render(); }

  function setDuration(mins) { stop(); totalSeconds = mins * 60; remaining = totalSeconds; render(); }

  startBtn.addEventListener('click', toggle);
  resetBtn.addEventListener('click', reset);

  function init() { render(); }

  return { init, setDuration };
})();

/* ── TODOS ── */
const Todos = (() => {
  const listEl   = $('taskList');
  const inputEl  = $('taskInput');
  const countEl  = $('todoCount');
  const doneEl   = $('completedCount');
  const clearBtn = $('clearDoneBtn');
  const addBtn   = $('addTaskBtn');

  function save() { Store.set('ld_tasks', state.tasks); }

  function updateStats() {
    const done = state.tasks.filter(t => t.done).length;
    countEl.textContent = `${state.tasks.length - done} left`;
    doneEl.textContent  = `${done} done`;
  }

  function escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function render() {
    listEl.innerHTML = '';
    if (state.tasks.length === 0) {
      listEl.innerHTML = '<li style="color:var(--text-muted);font-size:.85rem;padding:8px 0;">No tasks yet — add one above!</li>';
    } else {
      state.tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item${task.done ? ' is-done' : ''}`;
        li.dataset.id = task.id;
        li.innerHTML = `
          <button class="task-check${task.done ? ' checked' : ''}" data-action="check">${task.done ? '✓' : ''}</button>
          <span class="task-text">${escHtml(task.text)}</span>
          <div class="task-actions">
            <button class="task-action-btn" data-action="edit">✎</button>
            <button class="task-action-btn task-action-btn--delete" data-action="delete">✕</button>
          </div>`;
        listEl.appendChild(li);
      });
    }
    updateStats();
  }

  function addTask() {
    const text = inputEl.value.trim();
    if (!text) return;
    state.tasks.push({ id: Date.now(), text, done: false });
    save(); render();
    inputEl.value = '';
    inputEl.focus();
  }

  function startEdit(li, taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'task-text-edit';
    input.value = task.text;
    input.maxLength = 80;
    li.querySelector('.task-text').replaceWith(input);
    input.focus(); input.select();
    function commit() { const v = input.value.trim(); if (v) task.text = v; save(); render(); }
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') render(); });
  }

  listEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const li = btn.closest('.task-item');
    const taskId = Number(li.dataset.id);
    const action = btn.dataset.action;
    if (action === 'check') {
      const task = state.tasks.find(t => t.id === taskId);
      if (task) { task.done = !task.done; save(); render(); }
    }
    if (action === 'delete') { state.tasks = state.tasks.filter(t => t.id !== taskId); save(); render(); }
    if (action === 'edit')   { startEdit(li, taskId); }
  });

  addBtn.addEventListener('click', addTask);
  inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
  clearBtn.addEventListener('click', () => { state.tasks = state.tasks.filter(t => !t.done); save(); render(); });

  function init() { render(); }
  return { init };
})();

/* ── LINKS ── */
const Links = (() => {
  const grid       = $('linksGrid');
  const addLinkBtn = $('addLinkBtn');
  const modal      = $('linkModal');
  const closeBtn   = $('closeLinkModal');
  const saveBtn    = $('saveLinkBtn');
  const labelInput = $('linkLabelInput');
  const urlInput   = $('linkUrlInput');
  const modalTitle = $('linkModalTitle');

  let editingId = null;

  function save() { Store.set('ld_links', state.links); }

  function escHtml(str) { return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function faviconUrl(url) {
    try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`; }
    catch { return null; }
  }

  function render() {
    grid.innerHTML = '';
    if (state.links.length === 0) {
      grid.innerHTML = '<span class="links__empty">No links yet — click + to add one.</span>';
      return;
    }
    state.links.forEach(link => {
      const chip = document.createElement('a');
      chip.className = 'link-chip';
      chip.href = link.url;
      chip.target = '_blank';
      chip.rel = 'noopener noreferrer';
      chip.dataset.id = link.id;
      const fav = faviconUrl(link.url);
      chip.innerHTML = `
        ${fav ? `<img class="link-chip__favicon" src="${fav}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
        <span class="link-chip__label">${escHtml(link.label)}</span>
        <button class="link-chip__remove" data-action="remove" aria-label="Remove">✕</button>`;
      grid.appendChild(chip);
    });
  }

  grid.addEventListener('click', e => {
    const removeBtn = e.target.closest('[data-action="remove"]');
    if (removeBtn) {
      e.preventDefault();
      const id = Number(removeBtn.closest('.link-chip').dataset.id);
      state.links = state.links.filter(l => l.id !== id);
      save(); render();
    }
  });

  function openModal(link = null) {
    editingId = link ? link.id : null;
    modalTitle.textContent = link ? 'Edit Link' : 'Add Quick Link';
    labelInput.value = link ? link.label : '';
    urlInput.value   = link ? link.url : '';
    modal.classList.add('is-open');
    setTimeout(() => labelInput.focus(), 100);
  }

  function closeModal() { modal.classList.remove('is-open'); labelInput.value = ''; urlInput.value = ''; editingId = null; }

  function saveLink() {
    const label = labelInput.value.trim();
    let   url   = urlInput.value.trim();
    if (!label || !url) { toast('Please fill in both fields.'); return; }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    if (editingId) {
      const link = state.links.find(l => l.id === editingId);
      if (link) { link.label = label; link.url = url; }
    } else {
      state.links.push({ id: Date.now(), label, url });
    }
    save(); render(); closeModal();
    toast('Link saved!');
  }

  addLinkBtn.addEventListener('click', () => openModal());
  closeBtn.addEventListener('click', closeModal);
  saveBtn.addEventListener('click', saveLink);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveLink(); });

  function init() { render(); }
  return { init };
})();

/* ── SETTINGS ── */
const Settings = (() => {
  const modal     = $('settingsModal');
  const openBtn   = $('openSettings');
  const closeBtn  = $('closeSettings');
  const saveBtn   = $('saveSettings');
  const nameInput = $('nameInput');
  const pomoInput = $('pomodoroInput');
  const darkBtn   = $('themeDark');
  const lightBtn  = $('themeLight');

  let pendingTheme = state.theme;

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    darkBtn.classList.toggle('is-active',  theme === 'dark');
    lightBtn.classList.toggle('is-active', theme === 'light');
  }

  function openModal() {
    nameInput.value = state.userName;
    pomoInput.value = state.pomoDuration;
    pendingTheme    = state.theme;
    applyTheme(state.theme);
    modal.classList.add('is-open');
    setTimeout(() => nameInput.focus(), 100);
  }

  function closeModal() { modal.classList.remove('is-open'); applyTheme(state.theme); }

  function saveSettings() {
    const name = nameInput.value.trim();
    const mins = parseInt(pomoInput.value, 10);
    if (isNaN(mins) || mins < 1 || mins > 120) { toast('Pomodoro must be 1–120 minutes.'); return; }
    state.userName     = name;
    state.pomoDuration = mins;
    state.theme        = pendingTheme;
    Store.set('ld_name',  state.userName);
    Store.set('ld_pomo',  state.pomoDuration);
    Store.set('ld_theme', state.theme);
    applyTheme(state.theme);
    Timer.setDuration(mins);
    closeModal();
    toast('Settings saved ✓');
  }

  darkBtn.addEventListener('click',  () => { pendingTheme = 'dark';  applyTheme('dark'); });
  lightBtn.addEventListener('click', () => { pendingTheme = 'light'; applyTheme('light'); });
  openBtn.addEventListener('click',  openModal);
  closeBtn.addEventListener('click', closeModal);
  saveBtn.addEventListener('click',  saveSettings);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveSettings(); });
  pomoInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveSettings(); });

  function init() { applyTheme(state.theme); }
  return { init };
})();

/* Bootstrap */
document.addEventListener('DOMContentLoaded', () => {
  Settings.init();
  Clock.init();
  Timer.init();
  Todos.init();
  Links.init();
});