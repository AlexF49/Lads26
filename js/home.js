import { supabase } from './supabaseClient.js';
import { aggregateEvent } from './matchLogic.js';
import { buildPrediction } from './predictor.js';

const STORAGE_KEY = 'lads26_player_id';

const playingAsEl = document.getElementById('playing-as');
const teamScoresEl = document.getElementById('team-scores');
const matchCentreTilesEl = document.getElementById('tiles-match-centre');
const informationTilesEl = document.getElementById('tiles-information');

const MATCH_CENTRE_COMING_SOON = [];
const INFORMATION_COMING_SOON = [{ label: 'Info', emoji: 'ℹ️' }];

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

async function loadEventData() {
  const [
    { data: teams },
    { data: players },
    { data: matches },
    { data: matchPlayers },
    { data: scores },
    { data: courses },
    { data: holes },
    { data: competitionTypes },
    { data: competitionResults },
    { data: hammers },
  ] = await Promise.all([
    supabase.from('teams').select('id, name, color_hex, flag_emoji').order('id'),
    supabase.from('players').select('id, name, team_id').order('seed'),
    supabase.from('matches').select('id, day, match_number, format'),
    supabase
      .from('match_players')
      .select(
        'match_id, player_id, side, players ( name, handicap, handicap_day1, handicap_day2, handicap_day3, team_id, teams ( name, color_hex, flag_emoji ) )'
      ),
    supabase.from('scores').select('match_id, day, hole, player_id, gross_strokes'),
    supabase.from('courses').select('id, day, start_hole'),
    supabase.from('holes').select('course_id, hole_number, par, stroke_index'),
    supabase.from('competition_types').select('id, name, points, points_day1, points_day2, points_day3, counts_toward_bonus, is_automated'),
    supabase.from('competition_results').select('day, winner_id, competition_type_id'),
    supabase.from('hammers').select('match_id, hole, side'),
  ]);

  if (!teams || !players || !matches) return null;

  const rosterByTeam = new Map(teams.map((t) => [t.id, []]));
  for (const p of players) {
    if (rosterByTeam.has(p.team_id)) rosterByTeam.get(p.team_id).push(p.name);
  }

  const { teamTotals, perMatch } = aggregateEvent({
    teams,
    players,
    matches: matches ?? [],
    matchPlayers: matchPlayers ?? [],
    scores: scores ?? [],
    courses: courses ?? [],
    holes: holes ?? [],
    competitionTypes: competitionTypes ?? [],
    competitionResults: competitionResults ?? [],
    hammers: hammers ?? [],
  });

  const predictions = buildPrediction({ teamTotals, perMatch });
  const winProbabilityByTeam = new Map(predictions.map((p) => [p.teamId, p.winProbability]));

  return teamTotals.map((t) => ({
    ...t,
    roster: rosterByTeam.get(t.id) ?? [],
    winProbability: winProbabilityByTeam.get(t.id) ?? 0,
  }));
}

function renderTeamScores(teamTotals) {
  teamScoresEl.innerHTML = teamTotals
    .map(
      (t) => `
    <div class="team-score-card" style="border-color:${t.color_hex}; color:${t.color_hex}">
      <div class="team-score-card__body">
        <div class="team-score-card__flag">${t.flag_emoji ?? ''}</div>
        <div class="team-score-card__name">${t.name}</div>
        <div class="team-score-card__members">${t.roster.map((name) => `<span>${name}</span>`).join('')}</div>
        <div class="team-score-card__total">${t.total}</div>
        <div class="team-score-card__breakdown">
          <span>Matchplay ${t.matchplay}</span>
          <span>Bonus +${t.bonus}</span>
        </div>
      </div>
      <div class="team-score-card__predictor" style="background:${t.color_hex}">
        <span class="team-score-card__predictor-pct">${Math.round(t.winProbability * 100)}%</span>
        <span class="team-score-card__predictor-label">to win</span>
      </div>
    </div>`
    )
    .join('');
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
    matchCentreTilesEl.appendChild(
      tile({
        href: `matchday.html?day=${day}`,
        emoji: '⛳',
        label: `Match Day ${day}`,
        subtitle: courseByDay.get(day) ?? '',
      })
    );
  }

  matchCentreTilesEl.appendChild(tile({ href: 'leaderboard.html', emoji: '🏆', label: 'Leaderboard' }));
  matchCentreTilesEl.appendChild(tile({ href: 'rules.html', emoji: '📖', label: 'Rules' }));
  for (const { label, emoji } of MATCH_CENTRE_COMING_SOON) {
    matchCentreTilesEl.appendChild(tile({ emoji, label, subtitle: 'Coming soon', disabled: true }));
  }

  informationTilesEl.appendChild(tile({ href: 'bios.html', emoji: '🧑‍🤝‍🧑', label: 'Player Bios' }));
  informationTilesEl.appendChild(tile({ href: 'history.html', emoji: '📜', label: 'History' }));
  informationTilesEl.appendChild(tile({ href: 'expenses.html', emoji: '💷', label: 'Expenses' }));
  informationTilesEl.appendChild(tile({ href: 'gallery.html', emoji: '📷', label: 'Gallery' }));
  informationTilesEl.appendChild(tile({ href: 'admin.html', emoji: '🔧', label: 'Admin' }));
  for (const { label, emoji } of INFORMATION_COMING_SOON) {
    informationTilesEl.appendChild(tile({ emoji, label, subtitle: 'Coming soon', disabled: true }));
  }

  document.querySelectorAll('.lb-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.lb-tab').forEach((b) => b.classList.remove('lb-tab--active'));
      btn.classList.add('lb-tab--active');
      const tab = btn.dataset.tab;
      matchCentreTilesEl.hidden = tab !== 'match-centre';
      informationTilesEl.hidden = tab !== 'information';
    });
  });

  const teamTotals = await loadEventData();
  if (teamTotals) renderTeamScores(teamTotals);
}

init();
