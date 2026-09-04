import { supabase } from './supabaseClient.js';
import { teeTimeForMatch } from './matchLogic.js';

const STORAGE_KEY = 'lads26_player_id';

const params = new URLSearchParams(window.location.search);
const day = parseInt(params.get('day'), 10);

const dayTitleEl = document.getElementById('day-title');
const courseNameEl = document.getElementById('course-name');
const statusEl = document.getElementById('status');
const matchesEl = document.getElementById('matches');

const FORMAT_BY_DAY = { 1: 'greensomes', 2: 'betterball', 3: 'singles' };
const SLOT_CONFIG = {
  greensomes: { labels: ['Pair player 1', 'Pair player 2', 'Single player'], sides: ['pair', 'pair', 'single'] },
  betterball: { labels: ['Pair player 1', 'Pair player 2', 'Single player'], sides: ['pair', 'pair', 'single'] },
  singles: { labels: ['Player A', 'Player B', 'Player C'], sides: ['single', 'single', 'single'] },
};

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('status--error', isError);
}

async function ensureMatches() {
  const format = FORMAT_BY_DAY[day];
  const { data: existing, error } = await supabase.from('matches').select('id, match_number').eq('day', day);
  if (error) throw error;

  const have = new Set((existing ?? []).map((m) => m.match_number));
  const missing = [1, 2, 3].filter((n) => !have.has(n));
  if (missing.length) {
    const { error: insertError } = await supabase
      .from('matches')
      .insert(missing.map((match_number) => ({ day, match_number, format })));
    if (insertError) throw insertError;
  }

  const { data: matches, error: refetchError } = await supabase
    .from('matches')
    .select('id, match_number, format')
    .eq('day', day)
    .order('match_number');
  if (refetchError) throw refetchError;
  return matches;
}

function renderAssignedCard(match, players, globalMatchNumber) {
  const card = document.createElement('section');
  card.className = 'match-card';

  const pair = players.filter((p) => p.side === 'pair');
  const singles = players.filter((p) => p.side === 'single');

  const sideHtml = (list, label) =>
    list.length
      ? `<p class="match-card__side"><strong>${label}:</strong> ${list
          .map((p) => `<span style="color:${p.teams.color_hex}">${p.name}</span>`)
          .join(' & ')}</p>`
      : '';

  card.innerHTML = `
    <div class="match-card__header">
      <h3>Match ${globalMatchNumber} · ${teeTimeForMatch(day, match.match_number)}</h3>
      <button type="button" class="edit-btn" data-match-id="${match.id}">Edit</button>
    </div>
    ${match.format === 'singles' ? sideHtml(singles, 'Players') : sideHtml(pair, 'Pair') + sideHtml(singles, 'Single')}
    <a class="score-link" href="match.html?id=${match.id}">Enter scores →</a>
  `;

  card.querySelector('.edit-btn').addEventListener('click', async () => {
    await supabase.from('match_players').delete().eq('match_id', match.id);
    render();
  });

  return card;
}

function renderPickerCard(match, allPlayers, assignedElsewhere, globalMatchNumber) {
  const card = document.createElement('section');
  card.className = 'match-card';
  const config = SLOT_CONFIG[match.format];

  const available = allPlayers.filter((p) => !assignedElsewhere.has(p.id));

  const selectsHtml = config.labels
    .map(
      (label, i) => `
      <label class="picker-label">
        ${label}
        <select data-slot="${i}">
          <option value="">Select…</option>
          ${available.map((p) => `<option value="${p.id}">${p.name} (${p.teams.name})</option>`).join('')}
        </select>
      </label>`
    )
    .join('');

  card.innerHTML = `
    <div class="match-card__header">
      <h3>Match ${globalMatchNumber} · ${teeTimeForMatch(day, match.match_number)}</h3>
    </div>
    <form class="picker-form">
      ${selectsHtml}
      <p class="picker-error" hidden></p>
      <button type="submit" class="save-btn">Save match</button>
    </form>
  `;

  const form = card.querySelector('form');
  const errorEl = card.querySelector('.picker-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    const selects = [...form.querySelectorAll('select')];
    const chosenIds = selects.map((s) => s.value);

    if (chosenIds.some((id) => !id)) {
      errorEl.textContent = 'Pick a player for every slot.';
      errorEl.hidden = false;
      return;
    }
    if (new Set(chosenIds).size !== chosenIds.length) {
      errorEl.textContent = 'Each player can only appear once in a match.';
      errorEl.hidden = false;
      return;
    }

    const byId = new Map(allPlayers.map((p) => [p.id, p]));
    const rows = chosenIds.map((playerId, i) => ({
      match_id: match.id,
      player_id: playerId,
      team_id: byId.get(playerId).team_id,
      side: config.sides[i],
    }));

    const { error } = await supabase.from('match_players').insert(rows);
    if (error) {
      errorEl.textContent = error.message;
      errorEl.hidden = false;
      return;
    }
    render();
  });

  return card;
}

async function render() {
  setStatus('Loading matches…');
  matchesEl.innerHTML = '';

  let matches;
  try {
    matches = await ensureMatches();
  } catch (err) {
    setStatus(`Could not load matches: ${err.message}`, true);
    return;
  }

  const matchIds = matches.map((m) => m.id);

  const [{ data: matchPlayers, error: mpError }, { data: allPlayers, error: playersError }] = await Promise.all([
    supabase
      .from('match_players')
      .select('match_id, player_id, side, players ( name, team_id, teams ( name, color_hex ) )')
      .in('match_id', matchIds),
    supabase.from('players').select('id, name, team_id, teams ( name, color_hex )').order('name'),
  ]);

  if (mpError || playersError) {
    setStatus(`Could not load players: ${(mpError || playersError).message}`, true);
    return;
  }

  // Flatten the nested player info the join above pulls in.
  const flatMatchPlayers = (matchPlayers ?? []).map((mp) => ({
    match_id: mp.match_id,
    player_id: mp.player_id,
    side: mp.side,
    name: mp.players.name,
    teams: mp.players.teams,
  }));

  const assignedElsewhere = new Set(flatMatchPlayers.map((mp) => mp.player_id));

  setStatus('');
  matches.forEach((match, i) => {
    const globalMatchNumber = (day - 1) * 3 + match.match_number;
    const playersInMatch = flatMatchPlayers.filter((mp) => mp.match_id === match.id);
    if (playersInMatch.length > 0) {
      matchesEl.appendChild(renderAssignedCard(match, playersInMatch, globalMatchNumber));
    } else {
      matchesEl.appendChild(renderPickerCard(match, allPlayers, assignedElsewhere, globalMatchNumber));
    }
  });
}

async function init() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    window.location.href = 'index.html';
    return;
  }
  if (![1, 2, 3].includes(day)) {
    setStatus('Unknown day.', true);
    return;
  }

  const { data: course } = await supabase.from('courses').select('name').eq('day', day).single();
  dayTitleEl.textContent = `Match Day ${day}`;
  courseNameEl.textContent = course?.name ?? '';

  render();
}

init();
