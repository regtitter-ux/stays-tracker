/* ===================== Stays Tracker ===================== */
const STORE_KEY = 'stays-tracker/v1';

/* ---- persistence (localStorage = the "database" for this static site) ---- */
const load = () => {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch { return []; }
};
const save = () => localStorage.setItem(STORE_KEY, JSON.stringify(rows));

let rows = load();
let sortKey = 'addedAt';
let sortDir = 'desc';
let search = '';
let ownerFilter = '';

/* ---- helpers ---- */
const $ = (s) => document.querySelector(s);
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('en-US'));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function parseInvite(link) {
  if (!link) return null;
  const m = String(link).trim().match(/(?:discord(?:app)?\.(?:gg|com)\/(?:invite\/)?)?([a-zA-Z0-9-]{2,32})\/?$/);
  return m ? m[1] : null;
}
function iconUrl(id, icon) {
  if (!id || !icon) return null;
  const ext = icon.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${id}/${icon}.${ext}?size=64`;
}
const profitOf = (r) => num(r.sell) - num(r.buy);
const marginOf = (r) => (num(r.buy) > 0 ? (profitOf(r) / num(r.buy)) * 100 : null);

/* ---- Discord invite lookup (runs in the visitor's browser; API allows CORS) ---- */
async function fetchInvite(row) {
  const code = row.code;
  if (!code) { row.error = true; row.name = 'Invalid link'; return; }
  row.loading = true;
  try {
    const r = await fetch(`https://discord.com/api/v9/invites/${code}?with_counts=true`);
    if (!r.ok) throw new Error('not found');
    const d = await r.json();
    const g = d.guild || {};
    row.name = g.name || row.name || code;
    row.members = d.approximate_member_count ?? row.members ?? null;
    row.icon = iconUrl(g.id, g.icon);
    row.error = false;
  } catch {
    row.error = true;
    if (!row.name || row.name === 'Loading…') row.name = 'Not found';
  } finally {
    row.loading = false;
  }
}

/* ---- rendering ---- */
const tbody = $('#tbody');

function visibleRows() {
  let list = rows.slice();
  const q = search.trim().toLowerCase();
  if (q) list = list.filter((r) => (r.name || '').toLowerCase().includes(q) || (r.owner || '').toLowerCase().includes(q));
  if (ownerFilter) list = list.filter((r) => (r.owner || '') === ownerFilter);

  const dir = sortDir === 'asc' ? 1 : -1;
  list.sort((a, b) => {
    let va, vb;
    switch (sortKey) {
      case 'name': va = (a.name || '').toLowerCase(); vb = (b.name || '').toLowerCase(); break;
      case 'owner': va = (a.owner || '').toLowerCase(); vb = (b.owner || '').toLowerCase(); break;
      case 'members': va = num(a.members); vb = num(b.members); break;
      case 'buy': va = num(a.buy); vb = num(b.buy); break;
      case 'sell': va = num(a.sell); vb = num(b.sell); break;
      case 'profit': va = profitOf(a); vb = profitOf(b); break;
      case 'margin': va = marginOf(a) ?? -Infinity; vb = marginOf(b) ?? -Infinity; break;
      default: va = a.addedAt; vb = b.addedAt;
    }
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
  return list;
}

function rowHTML(r, i) {
  const ic = r.icon
    ? `<span class="srv-ic"><img src="${r.icon}" alt="" /></span>`
    : `<span class="srv-ic">${(r.name || '?').charAt(0).toUpperCase()}</span>`;
  const nameCls = r.loading ? 'loading' : r.error ? 'error' : '';
  const nameTxt = r.loading ? 'Loading…' : (r.name || '—');
  const p = profitOf(r);
  const pCls = p > 0 ? 'profit-pos' : p < 0 ? 'profit-neg' : 'profit-zero';
  const mg = marginOf(r);
  return `
    <tr data-id="${r.id}">
      <td class="td-idx">${i + 1}</td>
      <td>
        <div class="srv">
          ${ic}
          <div class="srv-meta">
            <div class="srv-name ${nameCls}" title="${(r.name || '').replace(/"/g, '&quot;')}">${nameTxt}</div>
            <a class="srv-link" href="https://discord.gg/${r.code}" target="_blank" rel="noopener">discord.gg/${r.code}</a>
          </div>
        </div>
      </td>
      <td class="td-num">${r.members != null ? fmt(r.members) : '—'}</td>
      <td><input class="cell-in" data-field="owner" value="${(r.owner || '').replace(/"/g, '&quot;')}" placeholder="—" /></td>
      <td><input class="cell-in num" data-field="buy" type="number" step="any" min="0" value="${r.buy ?? ''}" placeholder="0" /></td>
      <td><input class="cell-in num" data-field="sell" type="number" step="any" min="0" value="${r.sell ?? ''}" placeholder="0" /></td>
      <td class="td-num ${pCls}">${p ? (p > 0 ? '+' : '') + fmt(p) : '0'}</td>
      <td class="td-num ${pCls}">${mg == null ? '—' : (mg > 0 ? '+' : '') + mg.toFixed(0) + '%'}</td>
      <td>
        <button class="icon-btn refresh" title="Refresh from Discord" data-act="refresh">↻</button>
        <button class="icon-btn del" title="Delete" data-act="del">✕</button>
      </td>
    </tr>`;
}

function updateSummary(list) {
  $('#sumCount').textContent = fmt(list.length);
  $('#sumMembers').textContent = fmt(list.reduce((s, r) => s + num(r.members), 0));
  $('#sumBuy').textContent = fmt(list.reduce((s, r) => s + num(r.buy), 0));
  $('#sumSell').textContent = fmt(list.reduce((s, r) => s + num(r.sell), 0));
  const profit = list.reduce((s, r) => s + profitOf(r), 0);
  const el = $('#sumProfit');
  el.textContent = (profit > 0 ? '+' : '') + fmt(profit);
  el.style.color = profit > 0 ? 'var(--green)' : profit < 0 ? '#ff8ea1' : '';
}

function refreshOwnerFilter() {
  const owners = [...new Set(rows.map((r) => r.owner).filter(Boolean))].sort();
  const sel = $('#ownerFilter');
  const cur = sel.value;
  sel.innerHTML = '<option value="">All owners</option>' + owners.map((o) => `<option value="${o.replace(/"/g, '&quot;')}">${o}</option>`).join('');
  sel.value = owners.includes(cur) ? cur : '';
  ownerFilter = sel.value;
}

function render() {
  const list = visibleRows();
  tbody.innerHTML = list.map(rowHTML).join('');
  $('#empty').hidden = rows.length !== 0;
  updateSummary(rows);
  // header sort arrows
  document.querySelectorAll('th.sortable').forEach((th) => {
    const on = th.dataset.sort === sortKey;
    th.classList.toggle('sorted', on);
    th.dataset.arrow = on ? (sortDir === 'asc' ? '▲' : '▼') : '';
  });
}

/* ---- toast ---- */
let toastTimer;
function toast(msg) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---- actions ---- */
$('#addForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const link = $('#fLink').value.trim();
  const code = parseInvite(link);
  if (!code) return toast('Could not read an invite code from that link');
  if (rows.some((r) => r.code === code)) return toast('That server is already in the table');

  const row = { id: uid(), code, link, name: 'Loading…', members: null, icon: null, owner: $('#fOwner').value.trim(), buy: $('#fBuy').value ? num($('#fBuy').value) : '', sell: $('#fSell').value ? num($('#fSell').value) : '', addedAt: Date.now(), loading: true };
  rows.unshift(row);
  save(); render();
  e.target.reset();

  await fetchInvite(row);
  save(); refreshOwnerFilter(); render();
});

/* inline edits + row actions (event delegation) */
tbody.addEventListener('input', (e) => {
  const cell = e.target.closest('.cell-in');
  if (!cell) return;
  const tr = e.target.closest('tr');
  const row = rows.find((r) => r.id === tr.dataset.id);
  if (!row) return;
  const f = cell.dataset.field;
  row[f] = f === 'owner' ? cell.value : (cell.value === '' ? '' : num(cell.value));
  save();
  // live-update computed cells without full re-render (keeps focus)
  const p = profitOf(row);
  const mg = marginOf(row);
  const cells = tr.children;
  const pCls = p > 0 ? 'profit-pos' : p < 0 ? 'profit-neg' : 'profit-zero';
  cells[6].className = 'td-num ' + pCls;
  cells[6].textContent = p ? (p > 0 ? '+' : '') + fmt(p) : '0';
  cells[7].className = 'td-num ' + pCls;
  cells[7].textContent = mg == null ? '—' : (mg > 0 ? '+' : '') + mg.toFixed(0) + '%';
  updateSummary(rows);
});
tbody.addEventListener('change', (e) => {
  if (e.target.dataset.field === 'owner') refreshOwnerFilter();
});
tbody.addEventListener('click', async (e) => {
  const btn = e.target.closest('.icon-btn');
  if (!btn) return;
  const tr = e.target.closest('tr');
  const row = rows.find((r) => r.id === tr.dataset.id);
  if (!row) return;
  if (btn.dataset.act === 'del') {
    rows = rows.filter((r) => r.id !== row.id);
    save(); refreshOwnerFilter(); render();
    toast('Removed');
  } else if (btn.dataset.act === 'refresh') {
    row.loading = true; render();
    await fetchInvite(row);
    save(); render();
  }
});

/* filters */
$('#search').addEventListener('input', (e) => { search = e.target.value; render(); });
$('#ownerFilter').addEventListener('change', (e) => { ownerFilter = e.target.value; render(); });
$('#sortKey').addEventListener('change', (e) => { sortKey = e.target.value; render(); });
$('#sortDir').addEventListener('click', (e) => {
  sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  e.currentTarget.dataset.dir = sortDir;
  e.currentTarget.textContent = sortDir === 'asc' ? '↑ Asc' : '↓ Desc';
  render();
});
document.querySelectorAll('th.sortable').forEach((th) => {
  th.addEventListener('click', () => {
    const k = th.dataset.sort;
    if (sortKey === k) { sortDir = sortDir === 'asc' ? 'desc' : 'asc'; }
    else { sortKey = k; sortDir = 'desc'; }
    $('#sortKey').value = sortKey;
    $('#sortDir').dataset.dir = sortDir;
    $('#sortDir').textContent = sortDir === 'asc' ? '↑ Asc' : '↓ Desc';
    render();
  });
});

/* refresh all */
$('#refreshAll').addEventListener('click', async () => {
  if (!rows.length) return;
  rows.forEach((r) => (r.loading = true)); render();
  toast('Refreshing from Discord…');
  await Promise.all(rows.map((r) => fetchInvite(r)));
  save(); refreshOwnerFilter(); render();
  toast('Updated');
});

/* export / import */
$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `stays-tracker-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
$('#importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error('bad');
      rows = data.map((r) => ({ id: r.id || uid(), code: r.code || parseInvite(r.link), link: r.link, name: r.name || '', members: r.members ?? null, icon: r.icon || null, owner: r.owner || '', buy: r.buy ?? '', sell: r.sell ?? '', addedAt: r.addedAt || Date.now() }));
      save(); refreshOwnerFilter(); render();
      toast(`Imported ${rows.length} servers`);
    } catch { toast('Invalid file'); }
  };
  reader.readAsText(file);
  e.target.value = '';
});

/* clear all */
$('#clearAll').addEventListener('click', () => {
  if (!rows.length) return;
  if (!confirm('Delete all servers? This cannot be undone (export first to keep a copy).')) return;
  rows = []; save(); refreshOwnerFilter(); render();
});

/* init */
refreshOwnerFilter();
render();
