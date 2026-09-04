import { supabase } from './supabaseClient.js';
import { pointsForDay } from './matchLogic.js';

const STORAGE_KEY = 'lads26_player_id';

const formatRowEl = document.getElementById('format-row');
const contentEl = document.getElementById('rules-content');

// Sourced from https://sites.google.com/view/lads-lads-lads/rules
const FORMATS = [
  {
    title: 'Greensomes',
    emoji: '⛳',
    day: 1,
    rules: [
      `Handicap is average of player's handicap`,
      'Two players playing one ball - Alternate shots.',
      'All Players Drive and then select one ball to play',
      'Each player must have at least 6 Drives',
      `2 Gruesome per team; Force other team to take the worse drive. Counts towards the player's 6 drives.`,
    ],
    scoring: [
      'Two Points per hole for a win; One for a draw',
      'Double Points on last hole',
      "76 points available per team across the day's 2 matches (114 points total across all 3 matches).",
    ],
  },
  {
    title: 'Betterball',
    emoji: '⛳',
    day: 2,
    rules: [
      'Each player plays their own ball',
      `Play to 100% of Handicap (following captain's allocation)`,
      'Best Net Score wins across the 3 players wins the hole.',
    ],
    scoring: [
      'Two Points per hole for a win; One for a draw',
      'Double Points on last hole',
      "76 points available per team across the day's 2 matches (114 points total across all 3 matches).",
    ],
    extraBonus: [
      'Hammer Clause - One team member must win the hole and the other at least tie. Double points if successful.',
      'The single player must beat both scores',
      '2 Hammers per round. Retain if successful',
    ],
  },
  {
    title: 'Singles',
    emoji: '⛳',
    day: 3,
    rules: [
      'Singles Matchplay against your own seeded opponents.',
      'Each player plays their own ball',
      'Play to 100% of Handicap',
      'Best Net Score wins against their opposing player.',
    ],
    scoring: [
      '3 points on the hole with 2 for a win and 1 for a second place. Shared holes will split the points at that level.',
      'Double Points on last hole',
      "114 points available per team across the day's 3 matches (171 points total across all 3 matches).",
    ],
  },
];

function list(items) {
  return `<ul class="rules-list">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
}

// Bonus point values come live from the admin page (competition_types.points_dayN) so the
// Rules page never drifts out of sync with what's actually configured.
function bonusLines(ctByName, day) {
  const pts = (name) => {
    const ct = ctByName.get(name);
    return ct ? pointsForDay(ct, day) : null;
  };
  const pt = (n) => `${n} point${n === 1 ? '' : 's'}`;

  const lines = [];
  const nearest = pts('Nearest the Pin');
  if (nearest != null) lines.push(`Closest to the Pin on all Par 3's across both groups: ${pt(nearest)}`);
  const eagle = pts('Net Eagle');
  if (eagle != null) lines.push(`Net Eagle: ${pt(eagle)} (${day === 1 ? 'Adjusted' : 'Original'} HC)`);
  const longPutt = pts('Long Putt');
  if (longPutt != null) lines.push(`Long Putt (20ft): ${pt(longPutt)}`);
  const chipIn = pts('Chip In');
  if (chipIn != null) lines.push(`Chip In: ${pt(chipIn)}`);
  const driveGreen = pts('Drive the Green');
  if (driveGreen != null) lines.push(`Drive the Green: ${pt(driveGreen)}`);
  const clutch = pts('Clutch Shot');
  if (clutch != null) lines.push(`Clutch Shot: ${pt(clutch)} (individual leaderboard only)`);
  if (day === 3) {
    const ballbag = pts('Ballbag');
    if (ballbag != null) lines.push(`Ballbag: ${pt(ballbag)}`);
  }
  return lines;
}

function renderFormatCard(f, ctByName) {
  contentEl.hidden = false;
  contentEl.innerHTML = `
    <div class="rules-card">
      <h2 class="rules-card__title">${f.title}</h2>
      ${list(f.rules)}
      <h3 class="rules-card__subtitle">Scoring</h3>
      ${list(f.scoring)}
      <h3 class="rules-card__subtitle">Bonus Points</h3>
      ${list([...(f.extraBonus ?? []), ...bonusLines(ctByName, f.day)])}
    </div>`;
  contentEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function render(competitionTypes) {
  const ctByName = new Map(competitionTypes.map((ct) => [ct.name, ct]));

  function selectFormat(f) {
    formatRowEl.querySelectorAll('.bio-player').forEach((b) => b.classList.remove('bio-player--active'));
    formatRowEl.querySelector(`[data-format="${f.title}"]`).classList.add('bio-player--active');
    renderFormatCard(f, ctByName);
  }

  formatRowEl.innerHTML = FORMATS.map(
    (f) => `
    <button type="button" class="bio-player" data-format="${f.title}">
      <span class="bio-avatar"><span class="bio-avatar__initials" style="background:#0b3d1e">${f.emoji}</span></span>
      <span class="bio-player__name">${f.title}</span>
    </button>`
  ).join('');

  formatRowEl.querySelectorAll('[data-format]').forEach((btn) => {
    btn.addEventListener('click', () => selectFormat(FORMATS.find((f) => f.title === btn.dataset.format)));
  });
}

async function init() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    window.location.href = 'index.html';
    return;
  }

  const { data: competitionTypes, error } = await supabase
    .from('competition_types')
    .select('id, name, points, points_day1, points_day2, points_day3, sort_order')
    .order('sort_order');

  if (error) {
    contentEl.hidden = false;
    contentEl.innerHTML = `<p class="status status--error">Could not load bonus points: ${error.message}</p>`;
    return;
  }

  render(competitionTypes ?? []);
}

init();
