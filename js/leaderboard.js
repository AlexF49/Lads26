import { supabase } from './supabaseClient.js';
import { aggregateEvent } from './matchLogic.js';

const STORAGE_KEY = 'lads26_player_id';

const statusEl = document.getElementById('status');
const updatedAtEl = document.getElementById('updated-at');
const teamTabEl = document.getElementById('team-tab');
const individualTabEl = document.getElementById('individual-tab');

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

function matchCardHtml(m) {
  if (!m.setUp) {
    return `<div class="lb-match lb-match--empty">Match ${m.globalNumber} · Not set up yet</div>`;
  }
  return `
    <div class="lb-match">
      <div class="lb-match__title">
        <span>Match ${m.globalNumber} · ${FORMAT_LABEL[m.format] ?? m.format}</span>
        <span class="lb-match__status">${m.holesPlayed}/18 holes</span>
      </div>
      ${m.sides
        .map(
          (s) => `
        <div class="lb-match__side" style="color:${s.color}">
          <span class="lb-match__flag">${s.flagEmoji ?? ''}</span>
          <span class="lb-match__team">${s.teamName}</span>
          <span class="lb-match__names">${s.label}</span>
          <strong class="lb-match__points">${s.points}</strong>
          <span class="lb-match__bonus">${s.bonus ? `+${s.bonus} bonus` : ''}</span>
        </div>`
        )
        .join('')}
    </div>
  `;
}

function renderTeamTab(teamTotals, perMatch, courseByDay) {
  const byDay = new Map([1, 2, 3].map((d) => [d, perMatch.filter((m) => m.day === d)]));
  teamTabEl.innerHTML = `
    ${teamTotalsHtml(teamTotals)}
    ${[1, 2, 3]
      .map(
        (day) => `
      <h3 class="lb-day-heading">Day ${day} · ${courseByDay.get(day) ?? ''}</h3>
      <div class="lb-matches">${byDay.get(day).map(matchCardHtml).join('')}</div>
    `
      )
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
    supabase.from('courses').select('id, day, name'),
    supabase.from('holes').select('course_id, hole_number, par, stroke_index'),
    supabase.from('competition_types').select('id, name, points, counts_toward_bonus, is_automated'),
    supabase.from('competition_results').select('day, winner_id, competition_type_id'),
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
  });

  setStatus('');
  renderTeamTab(teamTotals, perMatch, courseByDay);
  renderIndividualTab(playerTotals);
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
    });
  });
}

function watchForChanges() {
  supabase
    .channel('leaderboard-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, loadAndRender)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'competition_results' }, loadAndRender)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'match_players' }, loadAndRender)
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
