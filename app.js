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

// A deal is written as "$price:amount" (e.g. $1:10 = $1 for 10 stays). "-" / empty = no data.
function parseDeal(str) {
  if (str == null) return null;
  const s = String(str).trim();
  if (s === '' || s === '-' || s === '—') return null;
  const m = s.match(/^\$?\s*([0-9]*\.?[0-9]+)\s*[:/]\s*([0-9]*\.?[0-9]+)\s*$/);
  if (!m) return null;
  const price = parseFloat(m[1]);
  const amount = parseFloat(m[2]);
  if (!(amount > 0)) return null;
  return { price, amount, rate: price / amount }; // rate = $ per stay
}
const trimNum = (n) => (Math.round(n * 1000) / 1000).toString();
// Normalize a raw deal string for display; keep "—" when there is no data.
const dealText = (str) => { const d = parseDeal(str); return d ? `$${trimNum(d.price)}:${trimNum(d.amount)}` : '—'; };
const rateOf = (str) => { const d = parseDeal(str); return d ? d.rate : null; };
const money = (n) => (n == null ? '—' : (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }));

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
  const NULLS = []; // rows with no value for the current key always sink to the bottom
  const keyed = list.filter((r) => {
    const v = sortVal(r);
    if (v == null || v === '') { NULLS.push(r); return false; }
    return true;
  });
  keyed.sort((a, b) => {
    const va = sortVal(a), vb = sortVal(b);
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
  return keyed.concat(NULLS);

  function sortVal(r) {
    switch (sortKey) {
      case 'name': return (r.name || '').toLowerCase();
      case 'owner': return (r.owner || '').toLowerCase() || null;
      case 'members': return r.members == null ? null : num(r.members);
      case 'buy': return rateOf(r.buy);
      case 'sell': return rateOf(r.sell);
      default: return r.addedAt;
    }
  }
}

function rowHTML(r, i) {
  const ic = r.icon
    ? `<span class="srv-ic"><img src="${r.icon}" alt="" /></span>`
    : `<span class="srv-ic">${(r.name || '?').charAt(0).toUpperCase()}</span>`;
  const nameCls = r.loading ? 'loading' : r.error ? 'error' : '';
  const nameTxt = r.loading ? 'Loading…' : (r.name || '—');
  const buyRate = rateOf(r.buy);
  const sellRate = rateOf(r.sell);
  const rateTxt = (v) => (v != null ? `${money(v)}/stay` : '');
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
      <td class="cell-deal">
        <input class="cell-in num" data-field="buy" value="${(r.buy ?? '').toString().replace(/"/g, '&quot;')}" placeholder="$1:10 / -" />
        <div class="cell-rate" data-rate="buy">${rateTxt(buyRate)}</div>
      </td>
      <td class="cell-deal">
        <input class="cell-in num" data-field="sell" value="${(r.sell ?? '').toString().replace(/"/g, '&quot;')}" placeholder="$1:10 / -" />
        <div class="cell-rate" data-rate="sell">${rateTxt(sellRate)}</div>
      </td>
      <td>
        <button class="icon-btn refresh" title="Refresh from Discord" data-act="refresh">↻</button>
        <button class="icon-btn del" title="Delete" data-act="del">✕</button>
      </td>
    </tr>`;
}

function updateSummary(list) {
  $('#sumCount').textContent = fmt(list.length);
  $('#sumMembers').textContent = fmt(list.reduce((s, r) => s + num(r.members), 0));
  const sellRates = list.map((r) => rateOf(r.sell)).filter((v) => v != null);
  const buyRates = list.map((r) => rateOf(r.buy)).filter((v) => v != null);
  $('#sumSellers').textContent = fmt(sellRates.length);
  $('#sumBuyers').textContent = fmt(buyRates.length);
  $('#sumCheap').textContent = sellRates.length ? money(Math.min(...sellRates)) : '—';
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

  const row = { id: uid(), code, link, name: 'Loading…', members: null, icon: null, owner: $('#fOwner').value.trim(), buy: $('#fBuy').value.trim(), sell: $('#fSell').value.trim(), addedAt: Date.now(), loading: true };
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
  row[f] = cell.value; // owner / buy / sell are all free-text (buy/sell use "$price:amount" or "-")
  save();
  // live-update the $/stay hint under the edited deal cell (keeps input focus)
  if (f === 'buy' || f === 'sell') {
    const rate = rateOf(cell.value);
    const hint = cell.parentElement.querySelector('.cell-rate');
    if (hint) hint.textContent = rate != null ? `${money(rate)}/stay` : '';
  }
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
