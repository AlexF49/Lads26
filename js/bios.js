import { supabase } from './supabaseClient.js';

const STORAGE_KEY = 'lads26_player_id';

const statusEl = document.getElementById('status');
const teamTabsEl = document.getElementById('team-tabs');
const playersRowEl = document.getElementById('players-row');
const bioCardEl = document.getElementById('bio-card');
const bioModalBackdropEl = document.getElementById('bio-modal-backdrop');
const bioFormEl = document.getElementById('bio-form');
const bioTextareaEl = document.getElementById('bio-textarea');
const bioModalErrorEl = document.getElementById('bio-modal-error');
const bioCancelBtnEl = document.getElementById('bio-cancel-btn');

let currentPlayer = null;
let currentTeam = null;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('status--error', isError);
}

// Seeding order from Lads 2026.xlsx, Setup tab (Seed 1/2/3 columns per team).
const SEED_ORDER = [
  'Nick Bourne',
  'Ben Brown',
  'James Pilling',
  'James Kibbey',
  'Alan Forrest',
  'Alex Robinson',
  'Paul Cooper',
  'Andrew Conway',
  'Jamie March',
];

function initials(name) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function avatarHtml(player, color) {
  if (player.photo_url) {
    return `<img class="bio-avatar__img" src="${player.photo_url}" alt="${player.name}" />`;
  }
  return `<span class="bio-avatar__initials" style="background:${color}">${initials(player.name)}</span>`;
}

function renderBioCard(player, team) {
  currentPlayer = player;
  currentTeam = team;
  const affiliations = player.stats?.teams;
  const record = player.stats?.record;
  bioCardEl.hidden = false;
  bioCardEl.style.borderColor = team.color_hex;
  bioCardEl.innerHTML = `
    <div class="bio-card__header" style="color:${team.color_hex}">
      <div class="bio-avatar bio-avatar--large">${avatarHtml(player, team.color_hex)}</div>
      <div>
        <h2 class="bio-card__name">${player.name}</h2>
        <p class="bio-card__team">${team.flag_emoji ?? ''} ${team.name}</p>
      </div>
    </div>
    <div class="bio-card__stats">
      ${record != null ? `<span class="bio-card__stat"><strong>${record}</strong> win${record === 1 ? '' : 's'}</span>` : ''}
      ${player.handicap != null ? `<span class="bio-card__stat"><strong>${player.handicap}</strong> handicap</span>` : ''}
    </div>
    ${affiliations ? `<p class="bio-card__affiliations">${affiliations}</p>` : ''}
    <p class="bio-card__bio">${player.bio ?? 'Bio coming soon.'}</p>
    <button type="button" class="bio-card__edit-btn${player.bio_updated ? ' bio-card__edit-btn--done' : ''}" id="edit-bio-btn">✏️ Update Bio</button>
  `;
  bioCardEl.querySelector('#edit-bio-btn').addEventListener('click', openBioModal);
  bioCardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openBioModal() {
  bioModalErrorEl.hidden = true;
  bioTextareaEl.value = currentPlayer?.bio ?? '';
  bioModalBackdropEl.hidden = false;
  bioTextareaEl.focus();
}

function closeBioModal() {
  bioModalBackdropEl.hidden = true;
}

bioCancelBtnEl.addEventListener('click', closeBioModal);
bioModalBackdropEl.addEventListener('click', (e) => {
  if (e.target === bioModalBackdropEl) closeBioModal();
});

bioFormEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentPlayer) return;

  const text = bioTextareaEl.value.trim();
  const { error } = await supabase.from('players').update({ bio: text, bio_updated: true }).eq('id', currentPlayer.id);
  if (error) {
    bioModalErrorEl.textContent = `Could not save: ${error.message}`;
    bioModalErrorEl.hidden = false;
    return;
  }

  currentPlayer.bio = text;
  currentPlayer.bio_updated = true;
  closeBioModal();
  renderBioCard(currentPlayer, currentTeam);
});

function renderPlayers(teamPlayers, team) {
  playersRowEl.innerHTML = teamPlayers
    .map(
      (p) => `
    <button type="button" class="bio-player" data-player-id="${p.id}">
      <span class="bio-avatar">${avatarHtml(p, team.color_hex)}</span>
      <span class="bio-player__name">${p.name}</span>
    </button>`
    )
    .join('');

  playersRowEl.querySelectorAll('[data-player-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      playersRowEl.querySelectorAll('.bio-player').forEach((b) => b.classList.remove('bio-player--active'));
      btn.classList.add('bio-player--active');
      const player = teamPlayers.find((p) => p.id === btn.dataset.playerId);
      renderBioCard(player, team);
    });
  });
}

async function init() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    window.location.href = 'index.html';
    return;
  }

  setStatus('Loading…');

  const [{ data: teams, error: teamsError }, { data: players, error: playersError }] = await Promise.all([
    supabase.from('teams').select('id, name, color_hex, flag_emoji').order('id'),
    supabase.from('players').select('id, name, team_id, bio, bio_updated, photo_url, stats, handicap'),
  ]);

  if (teamsError || playersError || !teams || !players) {
    setStatus(`Could not load players: ${(teamsError || playersError)?.message ?? 'unknown error'}`, true);
    return;
  }

  setStatus('');

  const bySeed = (a, b) => SEED_ORDER.indexOf(a.name) - SEED_ORDER.indexOf(b.name);
  const playersByTeam = new Map(teams.map((t) => [t.id, players.filter((p) => p.team_id === t.id).sort(bySeed)]));

  function selectTeam(team) {
    teamTabsEl.querySelectorAll('.lb-tab').forEach((b) => b.classList.remove('lb-tab--active'));
    teamTabsEl.querySelector(`[data-team-id="${team.id}"]`).classList.add('lb-tab--active');
    bioCardEl.hidden = true;
    renderPlayers(playersByTeam.get(team.id) ?? [], team);
  }

  teamTabsEl.innerHTML = teams
    .map((t, i) => `<button type="button" class="lb-tab${i === 0 ? ' lb-tab--active' : ''}" data-team-id="${t.id}">${t.flag_emoji ?? ''} ${t.name}</button>`)
    .join('');

  teamTabsEl.querySelectorAll('[data-team-id]').forEach((btn) => {
    btn.addEventListener('click', () => selectTeam(teams.find((t) => t.id === btn.dataset.teamId)));
  });

  selectTeam(teams[0]);
}

init();
