// Win predictor: projects each team's final matchplay total (bonus points excluded, since
// those are variable/admin-editable and unrelated to who's actually winning the golf) by
// Monte Carlo simulating every hole that hasn't been played yet, then seeing how often each
// team finishes on top. Built on top of matchLogic.js's aggregateEvent() output — it already
// knows, per match, which side each team is on, how many points they've won so far, and
// (via remainingHoles) exactly which holes are left and how many points each is worth.

const TRIALS = 10000;

// Simulated hole outcomes lean on "form": each team's own points-won/points-available rate
// in that format so far this event, blended with a neutral prior so a tiny early sample
// doesn't swing to a false 90/10 read. FORM_PRIOR_WEIGHT is how many points of neutral
// evidence the prior counts for — bigger = slower to trust observed form.
const FORM_PRIOR_WEIGHT = 10;

// Real matchplay holes do tie reasonably often (both sides net the same score) — without
// this the simulation would only ever produce clean sweeps, understating each team's floor.
const TIE_PROBABILITY = 0.2;

function totalPoolForFormat(format) {
  return format === 'singles' ? 57 : 38;
}

function neutralPrior(format) {
  return format === 'singles' ? 1 / 3 : 0.5;
}

// Per-team-per-day points won and points available, from holes already played.
function buildFormInputs(perMatch) {
  const won = new Map();
  const available = new Map();
  for (const m of perMatch) {
    if (!m.setUp) continue;
    const remainingPool = m.remainingHoles.reduce((sum, h) => sum + h.pool, 0);
    const playedPool = totalPoolForFormat(m.format) - remainingPool;
    for (const s of m.sides) {
      const key = `${s.teamId}:${m.day}`;
      won.set(key, (won.get(key) ?? 0) + s.points);
      available.set(key, (available.get(key) ?? 0) + playedPool);
    }
  }
  return { won, available };
}

function blendedForm(teamId, day, format, formInputs) {
  const key = `${teamId}:${day}`;
  const w = formInputs.won.get(key) ?? 0;
  const a = formInputs.available.get(key) ?? 0;
  const prior = neutralPrior(format);
  return (FORM_PRIOR_WEIGHT * prior + w) / (FORM_PRIOR_WEIGHT + a);
}

// Plackett-Luce ranking: repeatedly draws a "winner" from the remaining pool weighted by
// form, so higher form is more likely to rank first but never guaranteed to.
function weightedRankOrder(entries) {
  const pool = [...entries];
  const order = [];
  while (pool.length) {
    const total = pool.reduce((sum, p) => sum + p.weight, 0);
    let r = Math.random() * total;
    let idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].weight;
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    order.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return order;
}

// One simulated pass over every unplayed hole in every match. Returns Map<teamId, pointsGained>.
function simulateRemaining(perMatch, formInputs) {
  const deltas = new Map();
  const add = (teamId, pts) => deltas.set(teamId, (deltas.get(teamId) ?? 0) + pts);

  for (const m of perMatch) {
    if (!m.setUp || m.remainingHoles.length === 0) continue;
    const formByTeam = new Map(m.sides.map((s) => [s.teamId, blendedForm(s.teamId, m.day, m.format, formInputs)]));

    for (const { pool } of m.remainingHoles) {
      if (m.sides.length === 2) {
        const [a, b] = m.sides;
        if (Math.random() < TIE_PROBABILITY) {
          add(a.teamId, pool / 2);
          add(b.teamId, pool / 2);
          continue;
        }
        const fa = formByTeam.get(a.teamId);
        const fb = formByTeam.get(b.teamId);
        const winner = Math.random() < fa / (fa + fb) ? a : b;
        add(winner.teamId, pool);
      } else {
        const entries = m.sides.map((s) => ({ teamId: s.teamId, weight: formByTeam.get(s.teamId) }));
        const ranked = weightedRankOrder(entries);
        const splits = pool === 6 ? [4, 2, 0] : [2, 1, 0];
        ranked.forEach((r, i) => add(r.teamId, splits[i]));
      }
    }
  }
  return deltas;
}

// { teamTotals, perMatch } is exactly aggregateEvent()'s return shape (playerTotals unused).
// Returns [{ teamId, currentPoints, projectedPoints, winProbability }], matchplay-only.
export function buildPrediction({ teamTotals, perMatch }, trials = TRIALS) {
  const teamIds = teamTotals.map((t) => t.id);
  const currentPoints = new Map(teamTotals.map((t) => [t.id, t.matchplay]));
  const formInputs = buildFormInputs(perMatch);

  const winCounts = new Map(teamIds.map((id) => [id, 0]));
  const pointsSum = new Map(teamIds.map((id) => [id, 0]));

  for (let i = 0; i < trials; i++) {
    const deltas = simulateRemaining(perMatch, formInputs);
    const finals = new Map(teamIds.map((id) => [id, currentPoints.get(id) + (deltas.get(id) ?? 0)]));

    let max = -Infinity;
    for (const v of finals.values()) if (v > max) max = v;
    const winners = teamIds.filter((id) => finals.get(id) === max);
    for (const id of winners) winCounts.set(id, winCounts.get(id) + 1 / winners.length);
    for (const id of teamIds) pointsSum.set(id, pointsSum.get(id) + finals.get(id));
  }

  return teamIds.map((id) => ({
    teamId: id,
    currentPoints: currentPoints.get(id),
    projectedPoints: pointsSum.get(id) / trials,
    winProbability: winCounts.get(id) / trials,
  }));
}

// Total holes completed across the whole event so far — the worm diagram's x-axis.
export function totalHolesCompleted(perMatch) {
  return perMatch.reduce((sum, m) => sum + (m.setUp ? m.holesPlayed : 0), 0);
}
