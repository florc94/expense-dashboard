// ---------- Config (change locale/currency here) ----------
const LOCALE = 'en-US';
const CURRENCY = 'USD';
const STORAGE_KEY = 'expenses-v2'; // new key: ignores the old sample data saved before

const CATS = {
  expense: ['Food', 'Transport', 'Housing', 'Utilities', 'Health', 'Leisure', 'Education', 'Other'],
  income: ['Salary', 'Freelance', 'Other income']
};
const COLORS = {
  Food: '#E4572E', Transport: '#2D5BD0', Housing: '#7B4FD1', Utilities: '#E0A100',
  Health: '#C02450', Leisure: '#17A2B8', Education: '#5C8A2B', Other: '#8A8F94',
  Salary: '#1B7F5C', Freelance: '#2FA97A', 'Other income': '#7BC6A4'
};

// ---------- Helpers ----------
const money = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY, maximumFractionDigits: 0 });
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()));
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function monthName(ym) {
  const [y, m] = ym.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
}
function shortMonth(ym) {
  const [y, m] = ym.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString(LOCALE, { month: 'short' });
}
function fmtDate(iso) {
  const [y, m, d] = iso.split('-');
  return new Date(+y, +m - 1, +d).toLocaleDateString(LOCALE, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------- Data ----------
function seed() {
  const out = [], now = new Date();
  for (let k = 5; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const y = d.getFullYear(), m = pad(d.getMonth() + 1);
    const add = (day, type, cat, amount, desc) =>
      out.push({ id: uid(), date: `${y}-${m}-${pad(day)}`, type, cat, amount, desc });
    // vary(base, pct): deterministic pseudo-random variation around a base amount
    const vary = (base, pct) => Math.round(base * (1 + Math.sin(k * 7 + base) * pct) / 10) * 10;
    add(1, 'income', 'Salary', vary(4200, 0.04), 'Monthly salary');
    if (k % 2 === 0) add(15, 'income', 'Freelance', vary(900, 0.3), 'Freelance project');
    add(3, 'expense', 'Housing', 1400, 'Rent');
    add(8, 'expense', 'Utilities', vary(220, 0.15), 'Power, gas and internet');
    add(5, 'expense', 'Food', vary(450, 0.2), 'Groceries');
    add(19, 'expense', 'Food', vary(280, 0.25), 'Eating out');
    add(10, 'expense', 'Transport', vary(240, 0.2), 'Fuel and transit');
    add(22, 'expense', 'Leisure', vary(190, 0.4), 'Movies and streaming');
    if (k % 3 === 0) add(12, 'expense', 'Health', vary(150, 0.3), 'Pharmacy');
    if (k % 2 === 1) add(17, 'expense', 'Education', 200, 'Online course');
  }
  return out;
}
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr)) return arr; }
  } catch (e) { /* storage unavailable: fall back to sample data */ }
  return []; // start empty (use seed() instead to start with sample data)
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(txs)); } catch (e) { /* ignore */ }
}

// ---------- State ----------
let txs = load();
const filters = { month: '', type: '', cat: '', q: '' };
let barChart, pieChart;

// ---------- Form & filters ----------
function fillFormCategories() {
  const type = document.querySelector('input[name=type]:checked').value;
  $('cat').innerHTML = CATS[type].map(c => `<option>${c}</option>`).join('');
}
function fillFilters() {
  const months = [...new Set(txs.map(t => t.date.slice(0, 7)))].sort().reverse();
  const current = ymd(new Date()).slice(0, 7);
  if (!filters.month || (filters.month !== 'all' && !months.includes(filters.month))) {
    filters.month = months.includes(current) ? current : (months[0] || 'all');
  }
  $('fm').innerHTML = `<option value="all">All months</option>` +
    months.map(m => `<option value="${m}">${monthName(m)}</option>`).join('');
  $('fm').value = filters.month;
  const all = [...CATS.expense, ...CATS.income];
  $('fc').innerHTML = `<option value="">All categories</option>` + all.map(c => `<option>${c}</option>`).join('');
  $('fc').value = filters.cat;
}
function filtered() {
  const q = filters.q.trim().toLowerCase();
  return txs
    .filter(t =>
      (filters.month === 'all' || t.date.startsWith(filters.month)) &&
      (!filters.type || t.type === filters.type) &&
      (!filters.cat || t.cat === filters.cat) &&
      (!q || (t.desc || '').toLowerCase().includes(q) || t.cat.toLowerCase().includes(q)))
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ---------- Rendering ----------
function renderList(items) {
  const ul = $('list');
  if (!items.length) {
    ul.innerHTML = `<li class="empty">No transactions match these filters. Try another month or add a new one.</li>`;
    return;
  }
  ul.innerHTML = '';
  items.forEach(t => {
    const li = document.createElement('li');
    li.className = 'row';
    const sign = t.type === 'income' ? '+' : '−';
    li.innerHTML = `<span class="dot" style="background:${COLORS[t.cat] || '#888'}"></span>
      <div><div></div><div class="d"></div></div>
      <span class="amt ${t.type === 'income' ? 'pos' : 'neg'}">${sign} ${money.format(t.amount)}</span>
      <button class="x" aria-label="Delete transaction" title="Delete">×</button>`;
    // textContent (not innerHTML) so user text can't inject HTML
    li.querySelector('div > div').textContent = t.desc || t.cat;
    li.querySelector('.d').textContent = `${t.cat} · ${fmtDate(t.date)}`;
    li.querySelector('.x').onclick = () => { txs = txs.filter(x => x.id !== t.id); save(); render(); };
    ul.appendChild(li);
  });
}

function renderKpis(items) {
  const income = items.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const spent = items.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - spent;
  $('kin').textContent = money.format(income);
  $('kout').textContent = money.format(spent);
  $('ksav').textContent = income > 0 ? Math.round(balance / income * 100) + '%' : '—';
  const b = $('bal');
  b.textContent = (balance < 0 ? '−' : '') + money.format(Math.abs(balance));
  b.className = balance < 0 ? 'neg' : 'pos';
  $('period').textContent = filters.month === 'all' ? 'All months' : monthName(filters.month);
}

function renderCharts(items) {
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.color = css('--muted');
  const grid = css('--line');

  // Last 6 months ending at the selected month (or the most recent one)
  const months = [...new Set(txs.map(t => t.date.slice(0, 7)))].sort();
  const end = filters.month !== 'all' ? filters.month : months[months.length - 1];
  const labels = [];
  if (end) {
    const [y, m] = end.split('-').map(Number);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      labels.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
    }
  }
  const sum = (ym, type) => txs
    .filter(t => t.date.startsWith(ym) && t.type === type && (!filters.cat || t.cat === filters.cat))
    .reduce((s, t) => s + t.amount, 0);

  const barData = {
    labels: labels.map(shortMonth),
    datasets: [
      { label: 'Income', data: labels.map(l => sum(l, 'income')), backgroundColor: css('--in'), borderRadius: 4 },
      { label: 'Expenses', data: labels.map(l => sum(l, 'expense')), backgroundColor: css('--out'), borderRadius: 4 }
    ]
  };

  const byCat = {};
  items.filter(t => t.type === 'expense').forEach(t => { byCat[t.cat] = (byCat[t.cat] || 0) + t.amount; });
  const cats = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]);
  const pieData = {
    labels: cats,
    datasets: [{ data: cats.map(c => byCat[c]), backgroundColor: cats.map(c => COLORS[c]), borderColor: css('--surface'), borderWidth: 2 }]
  };

  const tooltip = {
    callbacks: {
      label: c => ` ${c.dataset.label ? c.dataset.label + ': ' : c.label + ': '}${money.format(c.parsed.y ?? c.parsed)}`
    }
  };
  const compact = new Intl.NumberFormat(LOCALE, { notation: 'compact' });

  if (barChart) barChart.destroy();
  if (pieChart) pieChart.destroy();
  barChart = new Chart($('c1'), {
    type: 'bar', data: barData,
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' }, tooltip },
      scales: { y: { beginAtZero: true, grid: { color: grid }, ticks: { callback: v => compact.format(v) } }, x: { grid: { display: false } } }
    }
  });
  pieChart = new Chart($('c2'), {
    type: 'doughnut', data: pieData,
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } }, tooltip }
    }
  });
}

function render() {
  fillFilters();
  const items = filtered();
  renderKpis(items);
  renderList(items);
  renderCharts(items);
}

// ---------- Events ----------
document.querySelectorAll('input[name=type]').forEach(r => r.addEventListener('change', fillFormCategories));

$('f').addEventListener('submit', e => {
  e.preventDefault();
  const amount = parseFloat($('amount').value);
  const date = $('date').value;
  if (!(amount > 0)) { $('err').textContent = 'Enter an amount greater than zero.'; $('amount').focus(); return; }
  if (!date) { $('err').textContent = 'Pick a date.'; $('date').focus(); return; }
  $('err').textContent = '';
  txs.push({
    id: uid(), date,
    type: document.querySelector('input[name=type]:checked').value,
    cat: $('cat').value,
    amount: Math.round(amount),
    desc: $('desc').value.trim()
  });
  save();
  // Jump to the month of the new transaction and clear other filters so it is visible
  filters.month = date.slice(0, 7); filters.type = ''; filters.cat = ''; filters.q = '';
  $('ft').value = ''; $('fq').value = '';
  $('amount').value = ''; $('desc').value = '';
  render();
});

$('fm').onchange = e => { filters.month = e.target.value; render(); };
$('ft').onchange = e => { filters.type = e.target.value; render(); };
$('fc').onchange = e => { filters.cat = e.target.value; render(); };
$('fq').oninput = e => { filters.q = e.target.value; render(); };
$('reset').onclick = () => {
  txs = []; save();
  filters.month = ''; filters.type = ''; filters.cat = ''; filters.q = '';
  $('ft').value = ''; $('fq').value = '';
  render();
};
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);

// ---------- Init ----------
$('date').value = ymd(new Date());
fillFormCategories();
render();
