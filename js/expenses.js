import { supabase } from './supabaseClient.js';

const STORAGE_KEY = 'lads26_player_id';

const statusEl = document.getElementById('status');
const totalsRowEl = document.getElementById('totals-row');
const expensesBodyEl = document.getElementById('expenses-body');
const addBtn = document.getElementById('add-expense-btn');
const exportBtn = document.getElementById('export-btn');
const modalBackdrop = document.getElementById('modal-backdrop');
const expenseForm = document.getElementById('expense-form');
const cancelBtn = document.getElementById('cancel-btn');
const modalErrorEl = document.getElementById('modal-error');
const playerFieldEl = document.getElementById('field-player');
const itemFieldEl = document.getElementById('field-item');
const currencyFieldEl = document.getElementById('field-currency');
const amountFieldEl = document.getElementById('field-amount');

const CURRENCY_SYMBOL = { EUR: '€', GBP: '£', USD: '$' };

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('status--error', isError);
}

let currentExpenses = [];

function formatAmount(amount, currency) {
  return `${CURRENCY_SYMBOL[currency] ?? ''}${Number(amount).toFixed(2)}`;
}

function renderTotals(expenses) {
  const totals = new Map();
  for (const e of expenses) {
    totals.set(e.currency, (totals.get(e.currency) ?? 0) + Number(e.amount));
  }
  totalsRowEl.innerHTML = [...totals.entries()]
    .map(([currency, total]) => `<div class="expenses-totals__item">Total ${currency}: <strong>${formatAmount(total, currency)}</strong></div>`)
    .join('');
}

function renderTable(expenses) {
  expensesBodyEl.innerHTML = expenses
    .map(
      (e) => `
      <tr>
        <td>${e.players?.name ?? 'Unknown'}</td>
        <td>${e.description}</td>
        <td>${formatAmount(e.amount, e.currency)}</td>
        <td>${new Date(e.created_at).toLocaleDateString()}</td>
      </tr>`
    )
    .join('');
  renderTotals(expenses);
}

async function loadExpenses() {
  const { data, error } = await supabase
    .from('expenses')
    .select('id, description, amount, currency, created_at, players ( name )')
    .order('created_at', { ascending: false });

  if (error) {
    setStatus(`Could not load expenses: ${error.message}`, true);
    return;
  }
  setStatus('');
  currentExpenses = data ?? [];
  renderTable(currentExpenses);
}

function openModal() {
  expenseForm.reset();
  modalErrorEl.hidden = true;
  modalBackdrop.hidden = false;
}

function closeModal() {
  modalBackdrop.hidden = true;
}

async function populatePlayerDropdown() {
  const { data, error } = await supabase.from('players').select('id, name').order('name');
  if (error) {
    setStatus(`Could not load players: ${error.message}`, true);
    return;
  }
  playerFieldEl.innerHTML = data.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
}

function exportToExcel() {
  const rows = [
    ['Player', 'Item', 'Currency', 'Amount', 'Date'],
    ...currentExpenses.map((e) => [
      e.players?.name ?? 'Unknown',
      e.description,
      e.currency,
      Number(e.amount),
      new Date(e.created_at).toLocaleDateString(),
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
  XLSX.writeFile(wb, 'Lads2026-Expenses.xlsx');
}

expenseForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  modalErrorEl.hidden = true;

  const playerId = playerFieldEl.value;
  const item = itemFieldEl.value.trim();
  const currency = currencyFieldEl.value;
  const amount = parseFloat(amountFieldEl.value);

  if (!playerId || !item || !amount || amount <= 0) {
    modalErrorEl.textContent = 'Please fill in every field with a valid amount.';
    modalErrorEl.hidden = false;
    return;
  }

  const { error } = await supabase
    .from('expenses')
    .insert({ player_id: playerId, description: item, amount, currency });

  if (error) {
    modalErrorEl.textContent = error.message;
    modalErrorEl.hidden = false;
    return;
  }

  closeModal();
  loadExpenses();
});

addBtn.addEventListener('click', openModal);
cancelBtn.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (e) => {
  if (e.target === modalBackdrop) closeModal();
});
exportBtn.addEventListener('click', exportToExcel);

async function init() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    window.location.href = 'index.html';
    return;
  }
  setStatus('Loading…');
  await populatePlayerDropdown();
  await loadExpenses();
}

init();
