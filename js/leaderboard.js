import { supabase } from './supabaseClient.js';
import { aggregateEvent } from './matchLogic.js';
import { buildPrediction } from './predictor.js';

const STORAGE_KEY = 'lads26_player_id';

const statusEl = document.getElementById('status');
const updatedAtEl = document.getElementById('updated-at');
const teamTabEl = document.getElementById('team-tab');
const individualTabEl = document.getElementById('individual-tab');
const predictorTabEl = document.getElementById('predictor-tab');

const FORMAT_LABEL = { greensomes: 'Greensomes', betterball: 'Betterball', singles: 'Singles' };

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('status--error', isError);
}

function teamTotalsHtml(teamTotals) {
  return `
    <div class="team-scores lb-team-totals">
      ${teamTotals
        .map(
          (t) => `
        <div class="team-score-card" style="border-color:${t.color_hex}; color:${t.color_hex}">
          <div class="team-score-card__flag">${t.flag_emoji ?? ''}</div>
          <div class="team-score-card__name">${t.name}</div>
          <div class="team-score-card__total">${t.total}</div>
          <div class="team-score-card__breakdown">
            <span>Matchplay ${t.matchplay}</span>
            <span>Bonus +${t.bonus}</span>
          </div>
        </div>`
        )
        .join('')}
    </div>
  `;
}

function teamBlockHtml(s, align) {
  return `
    <div class="lb-match__team lb-match__team--${align}" style="color:${s.color}">
      <div class="lb-match__team-name">${s.flagEmoji ?? ''} ${s.teamName}</div>
      <div class="lb-match__team-players">${s.names.map((n) => `<span>${n}</span>`).join('')}</div>
      ${s.bonus ? `<div class="lb-match__team-bonus">+${s.bonus} bonus</div>` : ''}
    </div>
  `;
}

function matchCardHtml(m) {
  if (!m.setUp) {
    return `<div class="lb-match lb-match--empty">Match ${m.globalNumber} · ${m.teeTime} · Not set up yet</div>`;
  }

  const scoreHtml = m.sides
    .map((s) => `<strong style="color:${s.color}">${s.points}</strong>`)
    .join('<span class="lb-match__dash">–</span>');

  const bodyHtml =
    m.sides.length === 2
      ? `
        ${teamBlockHtml(m.sides[0], 'left')}
        <div class="lb-match__score">${scoreHtml}</div>
        ${teamBlockHtml(m.sides[1], 'right')}
      `
      : `
        <div class="lb-match__score lb-match__score--multi">${scoreHtml}</div>
        <div class="lb-match__teams-row">${m.sides.map((s) => teamBlockHtml(s, 'center')).join('')}</div>
      `;

  return `
    <div class="lb-match">
      <div class="lb-match__row">${bodyHtml}</div>
      <div class="lb-match__footer">
        <span>Match ${m.globalNumber} · ${m.teeTime}</span>
        <span>${m.holesPlayed}/18 holes</span>
      </div>
    </div>
  `;
}

function renderTeamTab(teamTotals, perMatch, courseByDay) {
  const byDay = new Map([1, 2, 3].map((d) => [d, perMatch.filter((m) => m.day === d)]));
  teamTabEl.innerHTML = `
    ${teamTotalsHtml(teamTotals)}
    ${[1, 2, 3]
      .map((day) => {
        const format = byDay.get(day)[0]?.format;
        return `
      <h3 class="lb-day-heading">Day ${day} · ${FORMAT_LABEL[format] ?? format} · ${courseByDay.get(day) ?? ''}</h3>
      <div class="lb-matches">${byDay.get(day).map(matchCardHtml).join('')}</div>
    `;
      })
      .join('')}
  `;
}

function renderIndividualTab(playerTotals) {
  individualTabEl.innerHTML = `
    <div class="lb-players">
      ${playerTotals
        .map(
          (p, i) => `
        <div class="lb-player-row">
          <span class="lb-player-row__rank">${i + 1}</span>
          <span class="lb-player-row__flag">${p.team?.flag_emoji ?? ''}</span>
          <div class="lb-player-row__info">
            <span class="lb-player-row__name" style="color:${p.team?.color_hex ?? 'inherit'}">${p.name}</span>
            <span class="lb-player-row__detail">${p.holePoints} holes + ${p.bonusPoints} bonus</span>
          </div>
          <strong class="lb-player-row__total">${p.total}</strong>
        </div>`
        )
        .join('')}
    </div>
  `;
}

// Hand-rolled SVG line chart (no charting library) plotting each team's win probability
// against total holes completed across the event — the "worm diagram" of swinging fortunes.
function wormChartSvg(history, teamTotals) {
  const teamsById = new Map(teamTotals.map((t) => [t.id, t]));
  const byTeam = new Map();
  for (const row of history) {
    if (!byTeam.has(row.team_id)) byTeam.set(row.team_id, []);
    byTeam.get(row.team_id).push(row);
  }

  const W = 320;
  const H = 160;
  const PAD = 10;
  const maxHoles = Math.max(1, ...history.map((r) => r.holes_completed));
  const x = (h) => PAD + (h / maxHoles) * (W - 2 * PAD);
  const y = (p) => PAD + (1 - p) * (H - 2 * PAD);

  const lines = [...byTeam.entries()]
    .map(([teamId, rows]) => {
      const team = teamsById.get(teamId);
      const sorted = [...rows].sort((a, b) => a.holes_completed - b.holes_completed);
      const points = sorted.map((r) => `${x(r.holes_completed).toFixed(1)},${y(r.win_probability).toFixed(1)}`).join(' ');
      return `<polyline points="${points}" fill="none" stroke="${team?.color_hex ?? '#999'}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />`;
    })
    .join('');

  return `
    <svg viewBox="0 0 ${W} ${H}" class="worm-chart">
      <line x1="${PAD}" y1="${y(0.5).toFixed(1)}" x2="${W - PAD}" y2="${y(0.5).toFixed(1)}" class="worm-chart__midline" />
      ${lines}
    </svg>
  `;
}

function renderPredictorTab(teamTotals, predictions, history) {
  const teamsById = new Map(teamTotals.map((t) => [t.id, t]));
  const ranked = [...predictions].sort((a, b) => b.winProbability - a.winProbability);

  predictorTabEl.innerHTML = `
    <div class="predictor-current">
      ${ranked
        .map((p) => {
          const team = teamsById.get(p.teamId);
          return `
          <div class="predictor-team" style="color:${team?.color_hex}">
            <span class="predictor-team__flag">${team?.flag_emoji ?? ''}</span>
            <span class="predictor-team__name">${team?.name ?? ''}</span>
            <strong class="predictor-team__pct">${Math.round(p.winProbability * 100)}%</strong>
            <span class="predictor-team__proj">proj. ${p.projectedPoints.toFixed(1)} pts</span>
          </div>`;
        })
        .join('')}
    </div>
    <h3 class="lb-day-heading">Win probability over the event</h3>
    ${history.length ? wormChartSvg(history, teamTotals) : '<p class="predictor-empty">No holes scored yet.</p>'}
    <p class="predictor-note">Matchplay points only — bonus points are excluded since they're variable.</p>
  `;
}

async function loadAndRender() {
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
    { data: predictionHistory },
  ] = await Promise.all([
    supabase.from('teams').select('id, name, color_hex, flag_emoji').order('id'),
    supabase.from('players').select('id, name, team_id').order('name'),
    supabase.from('matches').select('id, day, match_number, format'),
    supabase
      .from('match_players')
      .select(
        'match_id, player_id, side, players ( name, handicap, handicap_day1, handicap_day2, handicap_day3, team_id, teams ( name, color_hex, flag_emoji ) )'
      ),
    supabase.from('scores').select('match_id, day, hole, player_id, gross_strokes'),
    supabase.from('courses').select('id, day, name, start_hole'),
    supabase.from('holes').select('course_id, hole_number, par, stroke_index'),
    supabase.from('competition_types').select('id, name, points, points_day1, points_day2, points_day3, counts_toward_bonus, is_automated'),
    supabase.from('competition_results').select('day, winner_id, competition_type_id'),
    supabase.from('hammers').select('match_id, hole, side'),
    supabase.from('prediction_snapshots').select('holes_completed, team_id, win_probability').order('holes_completed'),
  ]);

  if (!teams || !players || !matches) {
    setStatus('Could not load leaderboard data.', true);
    return;
  }

  const courseByDay = new Map((courses ?? []).map((c) => [c.day, c.name]));

  const { perMatch, teamTotals, playerTotals } = aggregateEvent({
    teams,
    players,
    matches,
    matchPlayers: matchPlayers ?? [],
    scores: scores ?? [],
    courses: courses ?? [],
    holes: holes ?? [],
    competitionTypes: competitionTypes ?? [],
    competitionResults: competitionResults ?? [],
    hammers: hammers ?? [],
  });

  const predictions = buildPrediction({ teamTotals, perMatch });

  setStatus('');
  renderTeamTab(teamTotals, perMatch, courseByDay);
  renderIndividualTab(playerTotals);
  renderPredictorTab(teamTotals, predictions, predictionHistory ?? []);
  updatedAtEl.textContent = `Live · updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function wireTabs() {
  document.querySelectorAll('.lb-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.lb-tab').forEach((b) => b.classList.remove('lb-tab--active'));
      btn.classList.add('lb-tab--active');
      const tab = btn.dataset.tab;
      teamTabEl.hidden = tab !== 'team';
      individualTabEl.hidden = tab !== 'individual';
      predictorTabEl.hidden = tab !== 'predictor';
    });
  });
}

function watchForChanges() {
  supabase
    .channel('leaderboard-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, loadAndRender)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'competition_results' }, loadAndRender)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'match_players' }, loadAndRender)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hammers' }, loadAndRender)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'prediction_snapshots' }, loadAndRender)
    .subscribe();
}

async function init() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    window.location.href = 'index.html';
    return;
  }
  wireTabs();
  setStatus('Loading leaderboard…');
  await loadAndRender();
  watchForChanges();
}

init();
