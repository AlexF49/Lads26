import { supabase } from './supabaseClient.js';

const STORAGE_KEY = 'lads26_player_id';

const statusEl = document.getElementById('status');
const playersBodyEl = document.getElementById('players-body');
const bonusBodyEl = document.getElementById('bonus-body');

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('status--error', isError);
}

function renderPlayers(players, teams) {
  playersBodyEl.innerHTML = players
    .map(
      (p) => `
    <tr data-player-id="${p.id}">
      <td>${p.name}</td>
      <td>
        <select class="admin-select" data-field="team_id">
          ${teams.map((t) => `<option value="${t.id}" ${t.id === p.team_id ? 'selected' : ''}>${t.name}</option>`).join('')}
        </select>
      </td>
      <td><input class="admin-input" type="number" data-field="seed" value="${p.seed ?? ''}" /></td>
      <td><input class="admin-input" type="number" data-field="handicap" value="${p.handicap ?? ''}" /></td>
      <td><input class="admin-input" type="number" data-field="handicap_day1" value="${p.handicap_day1 ?? ''}" /></td>
      <td><input class="admin-input" type="number" data-field="handicap_day2" value="${p.handicap_day2 ?? ''}" /></td>
      <td><input class="admin-input" type="number" data-field="handicap_day3" value="${p.handicap_day3 ?? ''}" /></td>
    </tr>`
    )
    .join('');

  playersBodyEl.querySelectorAll('[data-field]').forEach((el) => {
    el.addEventListener('change', async () => {
      const row = el.closest('[data-player-id]');
      const playerId = row.dataset.playerId;
      const field = el.dataset.field;
      const value = el.type === 'number' ? (el.value === '' ? null : parseInt(el.value, 10)) : el.value;

      const { error } = await supabase.from('players').update({ [field]: value }).eq('id', playerId);
      if (error) {
        setStatus(`Could not save: ${error.message}`, true);
        return;
      }
      setStatus('Saved ✓');
    });
  });
}

function renderBonusTypes(types) {
  bonusBodyEl.innerHTML = types
    .map(
      (ct) => `
    <tr data-type-id="${ct.id}">
      <td>${ct.name}</td>
      <td><input class="admin-input" type="number" data-field="points_day1" value="${ct.points_day1 ?? ct.points}" /></td>
      <td><input class="admin-input" type="number" data-field="points_day2" value="${ct.points_day2 ?? ct.points}" /></td>
      <td><input class="admin-input" type="number" data-field="points_day3" value="${ct.points_day3 ?? ct.points}" /></td>
    </tr>`
    )
    .join('');

  bonusBodyEl.querySelectorAll('[data-field]').forEach((el) => {
    el.addEventListener('change', async () => {
      const row = el.closest('[data-type-id]');
      const typeId = row.dataset.typeId;
      const field = el.dataset.field;
      const value = el.value === '' ? null : parseInt(el.value, 10);

      const { error } = await supabase.from('competition_types').update({ [field]: value }).eq('id', typeId);
      if (error) {
        setStatus(`Could not save: ${error.message}`, true);
        return;
      }
      setStatus('Saved ✓');
    });
  });
}

async function init() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    window.location.href = 'index.html';
    return;
  }

  setStatus('Loading…');

  const [{ data: teams, error: teamsError }, { data: players, error: playersError }, { data: types, error: typesError }] =
    await Promise.all([
      supabase.from('teams').select('id, name').order('id'),
      supabase.from('players').select('id, name, team_id, seed, handicap, handicap_day1, handicap_day2, handicap_day3').order('name'),
      supabase
        .from('competition_types')
        .select('id, name, points, points_day1, points_day2, points_day3, sort_order')
        .order('sort_order'),
    ]);

  if (teamsError || playersError || typesError) {
    setStatus(`Could not load admin data: ${(teamsError || playersError || typesError).message}`, true);
    return;
  }

  setStatus('');
  renderPlayers(players ?? [], teams ?? []);
  renderBonusTypes(types ?? []);
}

init();
