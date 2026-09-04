import { supabase } from './supabaseClient.js';
import { netScore, strokesReceived } from './scoring.js';
import {
  buildSides,
  computeMatchMinHandicap,
  relativeHandicap,
  computeHolePoints,
  netEagleAwards,
  teeTimeForMatch,
  pointsForDay,
} from './matchLogic.js';

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
// Lowest side/effective handicap in this match — match-play strokes are given off the
// *difference* between competing handicaps, not each side's full individual allowance.
let matchMinHandicap;
let matchPlayersFlat; // [{ playerId, name, color }] — the 3 individuals in this match, any format
let competitionTypes; // [{ id, name, points }]
// Map<holeNumber, Map<playerId, grossStrokes>>
let scoresByHole = new Map();
// Map<holeNumber, Map<competitionTypeId, winnerPlayerId>>
let bonusByHole = new Map();
let currentHole = 1;

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

// The side (if any) that receives an extra match-play stroke on this hole, based purely
// on handicaps and stroke index — independent of whether the hole has been scored yet.
function sideStrokeAdvantage(hole) {
  const withExtra = sides
    .map((s) => ({ side: s, extra: strokesReceived(relativeHandicap(s.handicap, matchMinHandicap), hole.stroke_index) }))
    .filter((x) => x.extra > 0);
  return withExtra.length === 1 ? withExtra[0].side : null;
}

function netEagleType() {
  return competitionTypes.find((ct) => ct.name === 'Net Eagle');
}

function bonusPointsByPlayer() {
  // Clutch Shot is logged here but scored as its own separate competition, not
  // accrued into these running bonus totals.
  const pointsByType = new Map(
    competitionTypes.filter((ct) => ct.counts_toward_bonus && !ct.is_automated).map((ct) => [ct.id, pointsForDay(ct, match.day)])
  );
  const totals = new Map(matchPlayersFlat.map((p) => [p.playerId, 0]));
  for (const winners of bonusByHole.values()) {
    for (const [typeId, winnerId] of winners) {
      if (!totals.has(winnerId) || !pointsByType.has(typeId)) continue;
      totals.set(winnerId, totals.get(winnerId) + pointsByType.get(typeId));
    }
  }
  for (const hole of holes) {
    const holeScores = scoresByHole.get(hole.hole_number) ?? new Map();
    for (const [playerId, pts] of netEagleAwards(match.format, sides, matchMinHandicap, hole, holeScores, netEagleType(), match.day)) {
      if (totals.has(playerId)) totals.set(playerId, totals.get(playerId) + pts);
    }
  }
  return totals;
}

function renderTotals() {
  const running = new Map(sides.map((s) => [s.key, 0]));
  for (const hole of holes) {
    const holeScores = scoresByHole.get(hole.hole_number) ?? new Map();
    const points = computeHolePoints(match.format, sides, matchMinHandicap, hole, holeScores);
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
      ${sides
        .flatMap((s) => (s.members ? s.members.map((m) => m.playerId) : s.playerIds))
        .map((playerId) => matchPlayersFlat.find((p) => p.playerId === playerId))
        .map(
          (p) => `
        <div class="totals__side" style="color:${p.color}">
          <strong>+${bonusTotals.get(p.playerId)}</strong>
          <span>${p.name}</span>
          <span class="totals__bonus-label">bonus</span>
        </div>`
        )
        .join('')}
    </div>
  `;
}

// One cell per hole: shows the winning side's points in their team colour, or the
// tied value in neutral black when nobody has a unique highest score that hole.
// Singles is 3-way, so a single coloured number can't show the full picture. Instead,
// render a small circle split by rank group: clear 1st/2nd/3rd -> top half winner colour,
// bottom half 2nd-place colour (3rd isn't shown). Tied 1st -> left/right split between the
// two tied colours. Clear winner with 2nd/3rd tied -> top half winner, bottom two quarters
// split between the tied pair. Full 3-way tie -> three equal thirds.
function singlesCircleHtml(points) {
  const sideByKey = (key) => sides.find((s) => s.key === key);
  const groups = new Map();
  for (const [key, pts] of points) {
    if (!groups.has(pts)) groups.set(pts, []);
    groups.get(pts).push(key);
  }
  const rankedPts = [...groups.keys()].sort((a, b) => b - a);

  let bg;
  if (rankedPts.length === 3) {
    const winnerColor = sideByKey(groups.get(rankedPts[0])[0]).color;
    const secondColor = sideByKey(groups.get(rankedPts[1])[0]).color;
    bg = `conic-gradient(from -90deg, ${winnerColor} 0deg 180deg, ${secondColor} 180deg 360deg)`;
  } else if (rankedPts.length === 2) {
    const topGroup = groups.get(rankedPts[0]);
    if (topGroup.length === 2) {
      const [a, b] = topGroup.map((k) => sideByKey(k).color);
      bg = `conic-gradient(${a} 0deg 180deg, ${b} 180deg 360deg)`;
    } else {
      const winnerColor = sideByKey(topGroup[0]).color;
      const [a, b] = groups.get(rankedPts[1]).map((k) => sideByKey(k).color);
      bg = `conic-gradient(from -90deg, ${winnerColor} 0deg 180deg, ${b} 180deg 270deg, ${a} 270deg 360deg)`;
    }
  } else {
    const [a, b, c] = [...points.keys()].map((k) => sideByKey(k).color);
    bg = `conic-gradient(${a} 0deg 120deg, ${b} 120deg 240deg, ${c} 240deg 360deg)`;
  }
  return `<span class="hole-summary__circle" style="background:${bg}"></span>`;
}

function renderHoleSummary() {
  const cells = holes.map((hole) => {
    const holeScores = scoresByHole.get(hole.hole_number) ?? new Map();
    const points = computeHolePoints(match.format, sides, matchMinHandicap, hole, holeScores);

    let valueHtml = '<span class="hole-summary__value hole-summary__value--empty">–</span>';
    if (points && match.format === 'singles') {
      valueHtml = singlesCircleHtml(points);
    } else if (points) {
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

    const advantageSide = sideStrokeAdvantage(hole);
    const numStyle = advantageSide ? ` style="color:${advantageSide.color};font-weight:800"` : '';
    const activeClass = hole.hole_number === currentHole ? ' hole-summary__cell--active' : '';
    return `
      <button type="button" class="hole-summary__cell${activeClass}" data-hole="${hole.hole_number}">
        <span class="hole-summary__num"${numStyle}>${hole.hole_number}</span>
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
  const manualTypes = competitionTypes.filter((ct) => !ct.is_automated);
  const bonusGridHtml = `
    <div class="bonus-grid">
      <div class="bonus-grid__row bonus-grid__row--auto" id="net-eagle-row"></div>
      <div class="bonus-grid__row bonus-grid__row--header">
        <span></span>
        <span>—</span>
        ${matchPlayersFlat.map((p) => `<span style="color:${p.color}">${p.name.split(' ')[0]}</span>`).join('')}
      </div>
      ${manualTypes
        .map((ct) => {
          const selected = bonusSelections.get(ct.id) ?? 'none';
          const options = [{ playerId: 'none', label: '—' }, ...matchPlayersFlat];
          return `
          <div class="bonus-grid__row">
            <span class="bonus-grid__label">${ct.name} <small>(${pointsForDay(ct, match.day)}pt)</small></span>
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
    <div class="hole-card__points" id="hole-points"></div>
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
        const net = netScore(gross, relativeHandicap(s.handicap, matchMinHandicap), hole.stroke_index);
        const el = holeCardEl.querySelector(`[data-net="${s.key === 'pair' || s.key === 'single' ? s.key : s.playerIds[0]}"]`);
        if (el) el.textContent = netLabel(net, hole.par);
      });
    } else {
      const [pairSide, singleSide] = sides;
      pairSide.members.forEach((m) => {
        const gross = previewScores.get(m.playerId);
        const net = netScore(gross, relativeHandicap(m.handicap, matchMinHandicap), hole.stroke_index);
        const el = holeCardEl.querySelector(`[data-net="${m.playerId}"]`);
        if (el) el.textContent = netLabel(net, hole.par);
      });
      const sm = singleSide.members[0];
      const gross = previewScores.get(sm.playerId);
      const net = netScore(gross, relativeHandicap(sm.handicap, matchMinHandicap), hole.stroke_index);
      const el = holeCardEl.querySelector(`[data-net="${sm.playerId}"]`);
      if (el) el.textContent = netLabel(net, hole.par);
    }

    const points = computeHolePoints(match.format, sides, matchMinHandicap, hole, previewScores);
    const pointsEl = document.getElementById('hole-points');
    if (points) {
      pointsEl.innerHTML = sides
        .map((s) => {
          const pts = points.get(s.key);
          return `<div style="color:${s.color}">${s.teamName}: ${pts}pt${pts === 1 ? '' : 's'}</div>`;
        })
        .join('');
    } else {
      pointsEl.innerHTML = '';
    }

    const netEagleRow = document.getElementById('net-eagle-row');
    const awards = netEagleAwards(match.format, sides, matchMinHandicap, hole, previewScores, netEagleType(), match.day);
    if (awards.size) {
      const byPlayer = new Map(matchPlayersFlat.map((p) => [p.playerId, p]));
      const text = [...awards.entries()]
        .map(([playerId, pts]) => `${byPlayer.get(playerId)?.name ?? ''} +${pts}pt${pts === 1 ? '' : 's'}`)
        .join(' · ');
      netEagleRow.innerHTML = `<span class="bonus-grid__label">🦅 Net Eagle <small>(auto)</small></span><span class="bonus-grid__auto-result">${text}</span>`;
    } else {
      netEagleRow.innerHTML = `<span class="bonus-grid__label">🦅 Net Eagle <small>(auto)</small></span><span class="bonus-grid__auto-result">—</span>`;
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
    for (const ct of manualTypes) {
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
  matchTitleEl.textContent = `Match ${globalMatchNumber} · ${teeTimeForMatch(match.day, match.match_number)}`;

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
    supabase.from('competition_types').select('id, name, points, points_day1, points_day2, points_day3, counts_toward_bonus, is_automated').order('sort_order'),
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

  sides = buildSides(match.format, match.day, matchPlayers);
  matchMinHandicap = computeMatchMinHandicap(sides);
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
