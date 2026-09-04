import { supabase } from './supabaseClient.js';

const STORAGE_KEY = 'lads26_player_id';

const playingAsEl = document.getElementById('playing-as');
const tilesEl = document.getElementById('tiles');

const COMING_SOON = [
  { label: 'Leaderboard', emoji: '🏆' },
  { label: 'Admin', emoji: '🔧' },
  { label: 'Gallery', emoji: '📷' },
  { label: 'Expenses', emoji: '💷' },
  { label: 'Player Bios', emoji: '🧑‍🤝‍🧑' },
  { label: 'History', emoji: '📜' },
];

function tile({ href, emoji, label, subtitle, disabled }) {
  const el = document.createElement(href ? 'a' : 'div');
  el.className = 'tile' + (disabled ? ' tile--disabled' : '');
  if (href) el.href = href;
  el.innerHTML = `
    <span class="tile__emoji">${emoji}</span>
    <span class="tile__label">${label}</span>
    ${subtitle ? `<span class="tile__subtitle">${subtitle}</span>` : ''}
  `;
  return el;
}

async function init() {
  const playerId = localStorage.getItem(STORAGE_KEY);
  if (!playerId) {
    window.location.href = 'index.html';
    return;
  }

  const { data: player } = await supabase.from('players').select('name').eq('id', playerId).single();
  playingAsEl.textContent = player ? `Playing as ${player.name}` : '';

  const { data: courses } = await supabase.from('courses').select('day, name').order('day');
  const courseByDay = new Map((courses ?? []).map((c) => [c.day, c.name]));

  for (const day of [1, 2, 3]) {
    tilesEl.appendChild(
      tile({
        href: `matchday.html?day=${day}`,
        emoji: '⛳',
        label: `Match Day ${day}`,
        subtitle: courseByDay.get(day) ?? '',
      })
    );
  }

  for (const { label, emoji } of COMING_SOON) {
    tilesEl.appendChild(tile({ emoji, label, subtitle: 'Coming soon', disabled: true }));
  }
}

init();
