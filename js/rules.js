const STORAGE_KEY = 'lads26_player_id';

const contentEl = document.getElementById('rules-content');

// Sourced from https://sites.google.com/view/lads-lads-lads/rules
const FORMATS = [
  {
    title: 'Greensomes',
    rules: [
      `Handicap is average of player's handicap (following captain's allocation)`,
      'Two players playing one ball - Alternate shots.',
      'All Players Drive and then select one ball to play',
      'Each player must have at least 6 Drives',
      `2 Gruesome per team; Force other team to take the worse drive. Counts towards the player's 6 drives.`,
    ],
    scoring: ['Two Points per hole for a win; One for a draw', 'Double Points on last hole', '76 Points in the day across both matches.'],
    bonus: [
      `Closest to the Pin on all Par 3's across both groups`,
      'Net Eagle: 2 points (Adjusted HC)',
      'Long Putt (20ft): 2 points',
      'Drive the Green: 5 points',
    ],
  },
  {
    title: 'Betterball',
    rules: [
      'Each player plays their own ball',
      `Play to 100% of Handicap (following captain's allocation)`,
      'Best Net Score wins across the 4 players wins the hole.',
    ],
    scoring: ['Two Points per hole for a win; One for a draw', 'Double Points on last hole', '76 Points in the day across both matches.'],
    bonus: [
      'Hammer Clause - One team member must win the hole and the other at least tie. Double points if successful.',
      '2 Hammers per round. Retain if successful',
      `Closest to the Pin on all Par 3's across both groups`,
      'Net Eagle: 2 points (Original HC)',
      'Long Putt (20ft): 2 points',
      'Drive the Green: 5 points',
    ],
  },
  {
    title: 'Singles',
    rules: [
      '2 Independent matches per 4-ball.',
      'Each player plays their own ball',
      `Play to 100% of Handicap (following captain's allocation)`,
      'Best Net Score wins against their opposing player.',
    ],
    scoring: ['Two Points per hole for a win; One for a draw', 'Double Points on last hole', '152 Points in the day across 4 matches.'],
    bonus: [
      `Closest to the Pin on all Par 3's across both groups`,
      'Net Eagle: 2 points (Original HC)',
      'Long Putt (20ft): 2 points',
      'Drive the Green: 5 points',
    ],
  },
];

function list(items) {
  return `<ul class="rules-list">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
}

function render() {
  const formatsHtml = FORMATS.map(
    (f) => `
    <div class="rules-card">
      <h2 class="rules-card__title">${f.title}</h2>
      ${list(f.rules)}
      <h3 class="rules-card__subtitle">Scoring</h3>
      ${list(f.scoring)}
      <h3 class="rules-card__subtitle">Bonus Points</h3>
      ${list(f.bonus)}
    </div>`
  ).join('');

  contentEl.innerHTML = formatsHtml;
}

function init() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    window.location.href = 'index.html';
    return;
  }
  render();
}

init();
