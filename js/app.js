import { supabase } from './supabaseClient.js';

const STORAGE_KEY = 'lads26_player_id';

const statusEl = document.getElementById('status');
const teamsEl = document.getElementById('teams');
const confirmEl = document.getElementById('confirm');
const confirmNameEl = document.getElementById('confirm-name');
const changePlayerBtn = document.getElementById('change-player');

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('status--error', isError);
}

function showConfirm(player) {
  confirmNameEl.textContent = player.name;
  teamsEl.hidden = true;
  confirmEl.hidden = false;
}

function showSelection() {
  confirmEl.hidden = true;
  teamsEl.hidden = false;
}

function selectPlayer(player) {
  localStorage.setItem(STORAGE_KEY, player.id);
  showConfirm(player);
}

function renderTeams(players) {
  const byTeam = new Map();
  for (const player of players) {
    const team = player.teams;
    if (!byTeam.has(team.id)) byTeam.set(team.id, { team, players: [] });
    byTeam.get(team.id).players.push(player);
  }

  teamsEl.innerHTML = '';
  for (const { team, players: teamPlayers } of byTeam.values()) {
    const section = document.createElement('section');
    section.className = 'team';
    section.style.setProperty('--team-color', team.color_hex);

    const heading = document.createElement('h2');
    heading.className = 'team__name';
    heading.textContent = team.name;
    section.appendChild(heading);

    const list = document.createElement('div');
    list.className = 'team__players';
    for (const player of teamPlayers) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'player-btn';
      btn.textContent = player.name;
      btn.addEventListener('click', () => selectPlayer(player));
      list.appendChild(btn);
    }
    section.appendChild(list);

    teamsEl.appendChild(section);
  }
}

async function init() {
  setStatus('Connecting to Supabase…');

  const { data: players, error } = await supabase
    .from('players')
    .select('id, name, teams ( id, name, color_hex )')
    .order('name');

  if (error) {
    setStatus(`Could not load players: ${error.message}`, true);
    return;
  }

  setStatus(`Connected — ${players.length} players loaded`);
  renderTeams(players);

  const savedId = localStorage.getItem(STORAGE_KEY);
  if (savedId) {
    const saved = players.find((p) => p.id === savedId);
    if (saved) showConfirm(saved);
  }
}

changePlayerBtn.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  showSelection();
});

init();
