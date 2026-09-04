import { supabase } from './supabaseClient.js';
import { buildSides, computeMatchMinHandicap, computeHolePoints, netEagleAwards } from './matchLogic.js';

const STORAGE_KEY = 'lads26_player_id';

const playingAsEl = document.getElementById('playing-as');
const teamScoresEl = document.getElementById('team-scores');
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

// Season-wide team totals: matchplay points across every match with saved scores, plus
// bonus points (manual picks + automatic Net Eagle) earned by any player on that team —
// reuses the exact same scoring logic as the per-match page (js/matchLogic.js).
async function loadTeamScores() {
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
  ] = await Promise.all([
    supabase.from('teams').select('id, name, color_hex, flag_emoji').order('id'),
    supabase.from('players').select('id, name, team_id').order('name'),
    supabase.from('matches').select('id, day, format'),
    supabase
      .from('match_players')
      .select(
        'match_id, player_id, side, players ( name, handicap, handicap_day1, handicap_day2, handicap_day3, team_id, teams ( name, color_hex, flag_emoji ) )'
      ),
    supabase.from('scores').select('match_id, day, hole, player_id, gross_strokes'),
    supabase.from('courses').select('id, day'),
    supabase.from('holes').select('course_id, hole_number, par, stroke_index'),
    supabase.from('competition_types').select('id, name, points, counts_toward_bonus, is_automated'),
    supabase.from('competition_results').select('winner_id, competition_type_id'),
  ]);

  if (!teams || !players || !matches) return null;

  const holesByDay = new Map();
  for (const course of courses ?? []) {
    holesByDay.set(
      course.day,
      new Map((holes ?? []).filter((h) => h.course_id === course.id).map((h) => [h.hole_number, h]))
    );
  }

  const matchPlayersByMatch = new Map();
  for (const mp of matchPlayers ?? []) {
    if (!matchPlayersByMatch.has(mp.match_id)) matchPlayersByMatch.set(mp.match_id, []);
    matchPlayersByMatch.get(mp.match_id).push(mp);
  }

  const scoresByMatch = new Map();
  for (const row of scores ?? []) {
    if (!scoresByMatch.has(row.match_id)) scoresByMatch.set(row.match_id, new Map());
    const byHole = scoresByMatch.get(row.match_id);
    if (!byHole.has(row.hole)) byHole.set(row.hole, new Map());
    byHole.get(row.hole).set(row.player_id, row.gross_strokes);
  }

  const playerTeam = new Map(players.map((p) => [p.id, p.team_id]));
  const netEagleType = (competitionTypes ?? []).find((ct) => ct.name === 'Net Eagle');

  const matchplayByTeam = new Map(teams.map((t) => [t.id, 0]));
  const bonusByTeam = new Map(teams.map((t) => [t.id, 0]));

  for (const match of matches) {
    const mps = matchPlayersByMatch.get(match.id) ?? [];
    if (mps.length === 0) continue;

    const sides = buildSides(match.format, match.day, mps);
    const matchMinHandicap = computeMatchMinHandicap(sides);
    const holesForDay = holesByDay.get(match.day) ?? new Map();
    const scoresForMatch = scoresByMatch.get(match.id) ?? new Map();

    for (const hole of holesForDay.values()) {
      const holeScores = scoresForMatch.get(hole.hole_number) ?? new Map();

      const points = computeHolePoints(match.format, sides, matchMinHandicap, hole, holeScores);
      if (points) {
        for (const [key, pts] of points) {
          const side = sides.find((s) => s.key === key);
          if (matchplayByTeam.has(side.teamId)) {
            matchplayByTeam.set(side.teamId, matchplayByTeam.get(side.teamId) + pts);
          }
        }
      }

      const eagleAwards = netEagleAwards(match.format, sides, matchMinHandicap, hole, holeScores, netEagleType);
      for (const [playerId, pts] of eagleAwards) {
        const teamId = playerTeam.get(playerId);
        if (bonusByTeam.has(teamId)) bonusByTeam.set(teamId, bonusByTeam.get(teamId) + pts);
      }
    }
  }

  const bonusPointsByTypeId = new Map(
    (competitionTypes ?? []).filter((ct) => ct.counts_toward_bonus && !ct.is_automated).map((ct) => [ct.id, ct.points])
  );
  for (const row of competitionResults ?? []) {
    if (!bonusPointsByTypeId.has(row.competition_type_id)) continue;
    const teamId = playerTeam.get(row.winner_id);
    if (bonusByTeam.has(teamId)) bonusByTeam.set(teamId, bonusByTeam.get(teamId) + bonusPointsByTypeId.get(row.competition_type_id));
  }

  const rosterByTeam = new Map(teams.map((t) => [t.id, []]));
  for (const p of players) {
    if (rosterByTeam.has(p.team_id)) rosterByTeam.get(p.team_id).push(p.name);
  }

  return teams.map((t) => ({
    ...t,
    roster: rosterByTeam.get(t.id) ?? [],
    matchplay: matchplayByTeam.get(t.id) ?? 0,
    bonus: bonusByTeam.get(t.id) ?? 0,
  }));
}

function renderTeamScores(teamTotals) {
  teamScoresEl.innerHTML = teamTotals
    .map(
      (t) => `
    <div class="team-score-card" style="border-color:${t.color_hex}; color:${t.color_hex}">
      <div class="team-score-card__flag">${t.flag_emoji ?? ''}</div>
      <div class="team-score-card__name">${t.name}</div>
      <div class="team-score-card__members">${t.roster.join(', ')}</div>
      <div class="team-score-card__total">${t.matchplay + t.bonus}</div>
      <div class="team-score-card__breakdown">
        <span>Matchplay ${t.matchplay}</span>
        <span>Bonus +${t.bonus}</span>
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

  const teamTotals = await loadTeamScores();
  if (teamTotals) renderTeamScores(teamTotals);
}

init();
