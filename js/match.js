import { supabase } from './supabaseClient.js';
import { netScore, pairHandicap, twoWayPoints, threeWayPoints } from './scoring.js';

const STORAGE_KEY = 'lads26_player_id';

const params = new URLSearchParams(window.location.search);
const matchId = params.get('id');

const backLinkEl = document.getElementById('back-link');
const matchTitleEl = document.getElementById('match-title');
const matchPlayersEl = document.getElementById('match-players');
const statusEl = document.getElementById('status');
const totalsEl = document.getElementById('totals');
const holeSummaryEl = document.getElementById('hole-summary');
const holeCardEl = document.getElementById('hole-card');

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('status--error', isError);
}

let match; // { id, day, match_number, format }
let holes; // [{ hole_number, par, stroke_index }]
let sides; // format-specific participant description, see buildSides()
let matchPlayersFlat; // [{ playerId, name, color }] — the 3 individuals in this match, any format
let competitionTypes; // [{ id, name, points }]
// Map<holeNumber, Map<playerId, grossStrokes>>
let scoresByHole = new Map();
// Map<holeNumber, Map<competitionTypeId, winnerPlayerId>>
let bonusByHole = new Map();
let currentHole = 1;

function handicapForDay(player) {
  return player[`handicap_day${match.day}`] ?? player.handicap ?? 0;
}

function buildSides(matchPlayers) {
  const byId = (id) => matchPlayers.find((mp) => mp.player_id === id);

  if (match.format === 'greensomes') {
    const pair = matchPlayers.filter((mp) => mp.side === 'pair');
    const single = matchPlayers.find((mp) => mp.side === 'single');
    // Greensomes plays one shared ball, so the pair plays off one combined handicap
    // (average of the two) — both names show that same number, per the xlsx convention.
    const pairHcp = pairHandicap(handicapForDay(pair[0].players), handicapForDay(pair[1].players));
    return [
      {
        key: 'pair',
        label: pair.map((p) => p.players.name).join(' & '),
        color: pair[0].players.teams.color_hex,
        teamName: pair[0].players.teams.name,
        flagEmoji: pair[0].players.teams.flag_emoji,
        playerIds: pair.map((p) => p.player_id),
        handicap: pairHcp,
        namesWithHandicap: pair.map((p) => ({ name: p.players.name, handicap: pairHcp })),
      },
      {
        key: 'single',
        label: single.players.name,
        color: single.players.teams.color_hex,
        teamName: single.players.teams.name,
        flagEmoji: single.players.teams.flag_emoji,
        playerIds: [single.player_id],
        handicap: handicapForDay(single.players),
        namesWithHandicap: [{ name: single.players.name, handicap: handicapForDay(single.players) }],
      },
    ];
  }

  if (match.format === 'betterball') {
    const pair = matchPlayers.filter((mp) => mp.side === 'pair');
    const single = matchPlayers.find((mp) => mp.side === 'single');
    return [
      {
        key: 'pair',
        label: pair.map((p) => p.players.name).join(' & '),
        color: pair[0].players.teams.color_hex,
        teamName: pair[0].players.teams.name,
        flagEmoji: pair[0].players.teams.flag_emoji,
        members: pair.map((p) => ({
          playerId: p.player_id,
          label: p.players.name,
          handicap: handicapForDay(p.players),
        })),
        namesWithHandicap: pair.map((p) => ({ name: p.players.name, handicap: handicapForDay(p.players) })),
      },
      {
        key: 'single',
        label: single.players.name,
        color: single.players.teams.color_hex,
        teamName: single.players.teams.name,
        flagEmoji: single.players.teams.flag_emoji,
        members: [{ playerId: single.player_id, label: single.players.name, handicap: handicapForDay(single.players) }],
        namesWithHandicap: [{ name: single.players.name, handicap: handicapForDay(single.players) }],
      },
    ];
  }

  // singles — 3 independent players
  return matchPlayers.map((mp) => ({
    key: mp.player_id,
    label: mp.players.name,
    color: mp.players.teams.color_hex,
    teamName: mp.players.teams.name,
    flagEmoji: mp.players.teams.flag_emoji,
    playerIds: [mp.player_id],
    handicap: handicapForDay(mp.players),
    namesWithHandicap: [{ name: mp.players.name, handicap: handicapForDay(mp.players) }],
  }));
}

function stepper(id, value, min = 1, max = 15) {
  return `
    <div class="stepper" data-stepper="${id}">
      <button type="button" class="stepper__btn" data-action="dec">−</button>
      <span class="stepper__value" data-value>${value}</span>
      <button type="button" class="stepper__btn" data-action="inc">+</button>
    </div>
  `;
}

function wireStepper(container, id, min, max, onChange) {
  const el = container.querySelector(`[data-stepper="${id}"]`);
  const valueEl = el.querySelector('[data-value]');
  el.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (!action) return;
    let value = parseInt(valueEl.textContent, 10);
    value = action === 'inc' ? Math.min(max, value + 1) : Math.max(min, value - 1);
    valueEl.textContent = value;
    onChange(value);
  });
}

function netLabel(net, par) {
  const toPar = net - par;
  if (toPar === 0) return `Net ${net} (par)`;
  return `Net ${net} (${toPar > 0 ? '+' : ''}${toPar})`;
}

function computeHolePoints(hole, holeScores) {
  // holeScores: Map<playerId, grossStrokes>. Returns Map<sideKey, points> or null if incomplete.
  if (match.format === 'greensomes') {
    const [pairSide, singleSide] = sides;
    const pairGross = holeScores.get(pairSide.playerIds[0]);
    const singleGross = holeScores.get(singleSide.playerIds[0]);
    if (pairGross == null || singleGross == null) return null;
    const netPair = netScore(pairGross, pairSide.handicap, hole.stroke_index);
    const netSingle = netScore(singleGross, singleSide.handicap, hole.stroke_index);
    const [p1, p2] = twoWayPoints(netPair, netSingle);
    return new Map([
      ['pair', p1],
      ['single', p2],
    ]);
  }

  if (match.format === 'betterball') {
    const [pairSide, singleSide] = sides;
    const pairNets = pairSide.members.map((m) => holeScores.get(m.playerId));
    const singleGross = holeScores.get(singleSide.members[0].playerId);
    if (pairNets.some((v) => v == null) || singleGross == null) return null;
    const netA = netScore(pairNets[0], pairSide.members[0].handicap, hole.stroke_index);
    const netB = netScore(pairNets[1], pairSide.members[1].handicap, hole.stroke_index);
    const bestPairNet = Math.min(netA, netB);
    const netSingle = netScore(singleGross, singleSide.members[0].handicap, hole.stroke_index);
    const [p1, p2] = twoWayPoints(bestPairNet, netSingle);
    return new Map([
      ['pair', p1],
      ['single', p2],
    ]);
  }

  // singles
  const nets = sides.map((s) => {
    const gross = holeScores.get(s.playerIds[0]);
    return gross == null ? null : netScore(gross, s.handicap, hole.stroke_index);
  });
  if (nets.some((v) => v == null)) return null;
  const pts = threeWayPoints(...nets);
  return new Map(sides.map((s, i) => [s.key, pts[i]]));
}

function bonusPointsByPlayer() {
  // Clutch Shot is logged here but scored as its own separate competition, not
  // accrued into these running bonus totals.
  const pointsByType = new Map(
    competitionTypes.filter((ct) => ct.counts_toward_bonus).map((ct) => [ct.id, ct.points])
  );
  const totals = new Map(matchPlayersFlat.map((p) => [p.playerId, 0]));
  for (const winners of bonusByHole.values()) {
    for (const [typeId, winnerId] of winners) {
      if (!totals.has(winnerId) || !pointsByType.has(typeId)) continue;
      totals.set(winnerId, totals.get(winnerId) + pointsByType.get(typeId));
    }
  }
  return totals;
}

function renderTotals() {
  const running = new Map(sides.map((s) => [s.key, 0]));
  for (const hole of holes) {
    const holeScores = scoresByHole.get(hole.hole_number) ?? new Map();
    const points = computeHolePoints(hole, holeScores);
    if (!points) continue;
    for (const [key, pts] of points) {
      running.set(key, running.get(key) + pts);
    }
  }

  const bonusTotals = bonusPointsByPlayer();

  totalsEl.innerHTML = `
    <div class="totals__row">
      ${sides
        .map(
          (s) => `
        <div class="totals__side" style="color:${s.color}">
          <span class="totals__team">${s.flagEmoji ?? ''} ${s.teamName}</span>
          <strong>${running.get(s.key)}</strong>
          <div class="totals__names">
            ${s.namesWithHandicap.map((n) => `<span>${n.name} (${n.handicap})</span>`).join('')}
          </div>
        </div>`
        )
        .join('')}
    </div>
    <div class="totals__row totals__row--bonus">
      ${matchPlayersFlat
        .map(
          (p) =>
            `<div class="totals__side" style="color:${p.color}"><strong>+${bonusTotals.get(p.playerId)}</strong><span>${p.name} bonus</span></div>`
        )
        .join('')}
    </div>
  `;
}

// One cell per hole: shows the winning side's points in their team colour, or the
// tied value in neutral black when nobody has a unique highest score that hole.
function renderHoleSummary() {
  const cells = holes.map((hole) => {
    const holeScores = scoresByHole.get(hole.hole_number) ?? new Map();
    const points = computeHolePoints(hole, holeScores);

    let valueHtml = '<span class="hole-summary__value hole-summary__value--empty">–</span>';
    if (points) {
      const entries = [...points.entries()];
      const maxPts = Math.max(...entries.map(([, pts]) => pts));
      const winners = entries.filter(([, pts]) => pts === maxPts);
      if (winners.length === 1) {
        const side = sides.find((s) => s.key === winners[0][0]);
        valueHtml = `<span class="hole-summary__value" style="color:${side.color}">${maxPts}</span>`;
      } else {
        valueHtml = `<span class="hole-summary__value hole-summary__value--tie">${maxPts}</span>`;
      }
    }

    const activeClass = hole.hole_number === currentHole ? ' hole-summary__cell--active' : '';
    return `
      <button type="button" class="hole-summary__cell${activeClass}" data-hole="${hole.hole_number}">
        <span class="hole-summary__num">${hole.hole_number}</span>
        ${valueHtml}
      </button>
    `;
  });

  holeSummaryEl.innerHTML = `
    <div class="hole-summary__row">${cells.slice(0, 9).join('')}</div>
    <div class="hole-summary__row">${cells.slice(9, 18).join('')}</div>
  `;

  holeSummaryEl.querySelectorAll('[data-hole]').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentHole = parseInt(btn.dataset.hole, 10);
      renderHole();
    });
  });
}

function renderHole() {
  const hole = holes[currentHole - 1];
  const holeScores = new Map(scoresByHole.get(currentHole) ?? []);

  let inputsHtml = '';
  if (match.format === 'greensomes') {
    const [pairSide, singleSide] = sides;
    const pairVal = holeScores.get(pairSide.playerIds[0]) ?? hole.par;
    const singleVal = holeScores.get(singleSide.playerIds[0]) ?? hole.par;
    inputsHtml = `
      <div class="score-row" style="color:${pairSide.color}">
        <span class="score-row__label">${pairSide.label}</span>
        ${stepper('pair', pairVal)}
        <span class="score-row__net" data-net="pair"></span>
      </div>
      <div class="score-row" style="color:${singleSide.color}">
        <span class="score-row__label">${singleSide.label}</span>
        ${stepper('single', singleVal)}
        <span class="score-row__net" data-net="single"></span>
      </div>
    `;
  } else if (match.format === 'betterball') {
    const [pairSide, singleSide] = sides;
    inputsHtml =
      pairSide.members
        .map((m) => {
          const val = holeScores.get(m.playerId) ?? hole.par;
          return `
          <div class="score-row" style="color:${pairSide.color}">
            <span class="score-row__label">${m.label}</span>
            ${stepper(m.playerId, val)}
            <span class="score-row__net" data-net="${m.playerId}"></span>
          </div>`;
        })
        .join('') +
      (() => {
        const m = singleSide.members[0];
        const val = holeScores.get(m.playerId) ?? hole.par;
        return `
          <div class="score-row" style="color:${singleSide.color}">
            <span class="score-row__label">${m.label}</span>
            ${stepper(m.playerId, val)}
            <span class="score-row__net" data-net="${m.playerId}"></span>
          </div>`;
      })();
  } else {
    inputsHtml = sides
      .map((s) => {
        const val = holeScores.get(s.playerIds[0]) ?? hole.par;
        return `
        <div class="score-row" style="color:${s.color}">
          <span class="score-row__label">${s.label}</span>
          ${stepper(s.playerIds[0], val)}
          <span class="score-row__net" data-net="${s.playerIds[0]}"></span>
        </div>`;
      })
      .join('');
  }

  const bonusSelections = bonusByHole.get(currentHole) ?? new Map();
  const bonusGridHtml = `
    <div class="bonus-grid">
      <div class="bonus-grid__row bonus-grid__row--header">
        <span></span>
        <span>—</span>
        ${matchPlayersFlat.map((p) => `<span style="color:${p.color}">${p.name.split(' ')[0]}</span>`).join('')}
      </div>
      ${competitionTypes
        .map((ct) => {
          const selected = bonusSelections.get(ct.id) ?? 'none';
          const options = [{ playerId: 'none', label: '—' }, ...matchPlayersFlat];
          return `
          <div class="bonus-grid__row">
            <span class="bonus-grid__label">${ct.name} <small>(${ct.points}pt)</small></span>
            ${options
              .map(
                (o) => `
              <label class="bonus-grid__radio">
                <input type="radio" name="bonus-${ct.id}" value="${o.playerId}" ${o.playerId === selected ? 'checked' : ''} />
              </label>`
              )
              .join('')}
          </div>`;
        })
        .join('')}
    </div>
  `;

  holeCardEl.innerHTML = `
    <div class="hole-card__nav">
      <button type="button" id="prev-hole" ${currentHole === 1 ? 'disabled' : ''}>&larr; Prev</button>
      <span>Hole ${currentHole} of 18</span>
      <button type="button" id="next-hole" ${currentHole === 18 ? 'disabled' : ''}>Next &rarr;</button>
    </div>
    <p class="hole-card__meta">Par ${hole.par} · Stroke Index ${hole.stroke_index}</p>
    ${inputsHtml}
    <p class="hole-card__points" id="hole-points"></p>
    <h4 class="bonus-grid__title">Bonus shots</h4>
    ${bonusGridHtml}
    <button type="button" id="save-hole" class="save-btn">Save${currentHole < 18 ? ' & Next' : ''}</button>
  `;

  document.getElementById('prev-hole').addEventListener('click', () => {
    currentHole -= 1;
    renderHole();
  });
  document.getElementById('next-hole').addEventListener('click', () => {
    currentHole += 1;
    renderHole();
  });

  // Live net/points preview as steppers change, without requiring a save first.
  function currentInputValues() {
    const values = new Map();
    holeCardEl.querySelectorAll('[data-stepper]').forEach((el) => {
      values.set(el.dataset.stepper, parseInt(el.querySelector('[data-value]').textContent, 10));
    });
    return values;
  }

  function updatePreview() {
    const values = currentInputValues();
    const previewScores = new Map();

    if (match.format === 'greensomes') {
      previewScores.set(sides[0].playerIds[0], values.get('pair'));
      previewScores.set(sides[1].playerIds[0], values.get('single'));
    } else if (match.format === 'betterball') {
      const [pairSide, singleSide] = sides;
      pairSide.members.forEach((m) => previewScores.set(m.playerId, values.get(m.playerId)));
      previewScores.set(singleSide.members[0].playerId, values.get(singleSide.members[0].playerId));
    } else {
      sides.forEach((s) => previewScores.set(s.playerIds[0], values.get(s.playerIds[0])));
    }

    // per-row net labels
    if (match.format === 'greensomes' || match.format === 'singles') {
      sides.forEach((s) => {
        const gross = previewScores.get(s.playerIds[0]);
        const net = netScore(gross, s.handicap, hole.stroke_index);
        const el = holeCardEl.querySelector(`[data-net="${s.key === 'pair' || s.key === 'single' ? s.key : s.playerIds[0]}"]`);
        if (el) el.textContent = netLabel(net, hole.par);
      });
    } else {
      const [pairSide, singleSide] = sides;
      pairSide.members.forEach((m) => {
        const gross = previewScores.get(m.playerId);
        const net = netScore(gross, m.handicap, hole.stroke_index);
        const el = holeCardEl.querySelector(`[data-net="${m.playerId}"]`);
        if (el) el.textContent = netLabel(net, hole.par);
      });
      const sm = singleSide.members[0];
      const gross = previewScores.get(sm.playerId);
      const net = netScore(gross, sm.handicap, hole.stroke_index);
      const el = holeCardEl.querySelector(`[data-net="${sm.playerId}"]`);
      if (el) el.textContent = netLabel(net, hole.par);
    }

    const points = computeHolePoints(hole, previewScores);
    const pointsEl = document.getElementById('hole-points');
    if (points) {
      pointsEl.textContent = sides.map((s) => `${s.label}: ${points.get(s.key)}pt`).join(' · ');
    } else {
      pointsEl.textContent = '';
    }

    return previewScores;
  }

  const stepperIds = match.format === 'betterball' ? [...sides[0].members.map((m) => m.playerId), sides[1].members[0].playerId] : match.format === 'greensomes' ? ['pair', 'single'] : sides.map((s) => s.playerIds[0]);

  stepperIds.forEach((id) => wireStepper(holeCardEl, id, 1, 15, updatePreview));

  updatePreview();

  document.getElementById('save-hole').addEventListener('click', async () => {
    const previewScores = updatePreview();
    const rows = [];

    if (match.format === 'greensomes') {
      const [pairSide, singleSide] = sides;
      const pairGross = previewScores.get(pairSide.playerIds[0]);
      for (const playerId of pairSide.playerIds) {
        rows.push({ match_id: matchId, player_id: playerId, day: match.day, hole: currentHole, gross_strokes: pairGross });
      }
      rows.push({
        match_id: matchId,
        player_id: singleSide.playerIds[0],
        day: match.day,
        hole: currentHole,
        gross_strokes: previewScores.get(singleSide.playerIds[0]),
      });
    } else if (match.format === 'betterball') {
      const [pairSide, singleSide] = sides;
      pairSide.members.forEach((m) => {
        rows.push({ match_id: matchId, player_id: m.playerId, day: match.day, hole: currentHole, gross_strokes: previewScores.get(m.playerId) });
      });
      const sm = singleSide.members[0];
      rows.push({ match_id: matchId, player_id: sm.playerId, day: match.day, hole: currentHole, gross_strokes: previewScores.get(sm.playerId) });
    } else {
      sides.forEach((s) => {
        rows.push({ match_id: matchId, player_id: s.playerIds[0], day: match.day, hole: currentHole, gross_strokes: previewScores.get(s.playerIds[0]) });
      });
    }

    const { error } = await supabase.from('scores').upsert(rows, { onConflict: 'player_id,day,hole' });
    if (error) {
      setStatus(`Could not save: ${error.message}`, true);
      return;
    }

    scoresByHole.set(currentHole, new Map(rows.map((r) => [r.player_id, r.gross_strokes])));

    // Bonus shots: one radio group per category, "none" means no winner logged this hole.
    const bonusUpserts = [];
    const bonusDeletes = [];
    const newBonusSelections = new Map();
    for (const ct of competitionTypes) {
      const checked = holeCardEl.querySelector(`input[name="bonus-${ct.id}"]:checked`)?.value ?? 'none';
      if (checked === 'none') {
        bonusDeletes.push(ct.id);
      } else {
        newBonusSelections.set(ct.id, checked);
        bonusUpserts.push({ day: match.day, hole: currentHole, competition_type_id: ct.id, winner_id: checked });
      }
    }

    if (bonusUpserts.length) {
      const { error: bonusError } = await supabase
        .from('competition_results')
        .upsert(bonusUpserts, { onConflict: 'day,hole,competition_type_id' });
      if (bonusError) {
        setStatus(`Could not save bonus shots: ${bonusError.message}`, true);
        return;
      }
    }
    if (bonusDeletes.length) {
      const { error: bonusDeleteError } = await supabase
        .from('competition_results')
        .delete()
        .eq('day', match.day)
        .eq('hole', currentHole)
        .in('competition_type_id', bonusDeletes);
      if (bonusDeleteError) {
        setStatus(`Could not save bonus shots: ${bonusDeleteError.message}`, true);
        return;
      }
    }
    bonusByHole.set(currentHole, newBonusSelections);

    setStatus('Saved ✓');
    renderTotals();

    if (currentHole < 18) {
      currentHole += 1;
      renderHole();
    } else {
      renderHoleSummary();
    }
  });

  renderHoleSummary();
}

async function init() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    window.location.href = 'index.html';
    return;
  }
  if (!matchId) {
    setStatus('No match specified.', true);
    return;
  }

  setStatus('Loading match…');

  const { data: matchRow, error: matchError } = await supabase
    .from('matches')
    .select('id, day, match_number, format')
    .eq('id', matchId)
    .single();

  if (matchError || !matchRow) {
    setStatus(`Could not load match: ${matchError?.message ?? 'not found'}`, true);
    return;
  }
  match = matchRow;
  backLinkEl.href = `matchday.html?day=${match.day}`;

  const globalMatchNumber = (match.day - 1) * 3 + match.match_number;
  matchTitleEl.textContent = `Match ${globalMatchNumber}`;

  const [
    { data: matchPlayers, error: mpError },
    { data: course, error: courseError },
    { data: existingScores, error: scoresError },
    { data: types, error: typesError },
    { data: existingBonus, error: bonusError },
  ] = await Promise.all([
    supabase
      .from('match_players')
      .select('player_id, side, players ( name, handicap, handicap_day1, handicap_day2, handicap_day3, team_id, teams ( name, color_hex, flag_emoji ) )')
      .eq('match_id', matchId),
    supabase.from('courses').select('id').eq('day', match.day).single(),
    supabase.from('scores').select('player_id, hole, gross_strokes').eq('match_id', matchId),
    supabase.from('competition_types').select('id, name, points, counts_toward_bonus').order('sort_order'),
    supabase.from('competition_results').select('hole, competition_type_id, winner_id').eq('day', match.day),
  ]);

  if (mpError || courseError || scoresError || typesError || bonusError) {
    setStatus(`Could not load match data: ${(mpError || courseError || scoresError || typesError || bonusError).message}`, true);
    return;
  }
  competitionTypes = types;

  if (!matchPlayers || matchPlayers.length === 0) {
    setStatus('This match has no players set up yet.', true);
    matchPlayersEl.textContent = '';
    holeCardEl.innerHTML = `<a class="score-link" href="matchday.html?day=${match.day}">Go set up this match →</a>`;
    return;
  }

  const { data: holesData, error: holesError } = await supabase
    .from('holes')
    .select('hole_number, par, stroke_index')
    .eq('course_id', course.id)
    .order('hole_number');
  if (holesError) {
    setStatus(`Could not load holes: ${holesError.message}`, true);
    return;
  }
  holes = holesData;

  sides = buildSides(matchPlayers);
  matchPlayersEl.textContent = sides.map((s) => s.label).join(' vs ');
  matchPlayersFlat = matchPlayers.map((mp) => ({
    playerId: mp.player_id,
    name: mp.players.name,
    color: mp.players.teams.color_hex,
  }));

  scoresByHole = new Map();
  for (const row of existingScores ?? []) {
    if (!scoresByHole.has(row.hole)) scoresByHole.set(row.hole, new Map());
    scoresByHole.get(row.hole).set(row.player_id, row.gross_strokes);
  }

  bonusByHole = new Map();
  for (const row of existingBonus ?? []) {
    if (!bonusByHole.has(row.hole)) bonusByHole.set(row.hole, new Map());
    bonusByHole.get(row.hole).set(row.competition_type_id, row.winner_id);
  }

  // Resume at the first hole without a full set of saved scores. Every format writes
  // one scores row per player in the match (3), even greensomes where the pair share
  // one gross value across both their rows.
  const requiredPlayerCount = matchPlayers.length;
  currentHole = holes.find((h) => (scoresByHole.get(h.hole_number)?.size ?? 0) < requiredPlayerCount)?.hole_number ?? 18;

  setStatus('');
  renderTotals();
  renderHole();
}

init();
