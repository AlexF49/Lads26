// Win predictor: projects each team's final matchplay total (bonus points excluded, since
// those are variable/admin-editable and unrelated to who's actually winning the golf) by
// Monte Carlo simulating every hole that hasn't been played yet, then seeing how often each
// team finishes on top. Built on top of matchLogic.js's aggregateEvent() output — it already
// knows, per match, which side each team is on, how many points they've won so far, and
// (via remainingHoles) exactly which holes are left and how many points each is worth.
//
// Every remaining hole is treated as a fair contest (a coin flip for 2-way matches, an equal
// three-way draw for singles), not biased by how a team has played so far. An early "form"
// signal was tried and removed: with only a handful of holes played, a small sample in one
// match (e.g. a 2-hole sweep) got extrapolated as if it applied to that team's whole day,
// including different opponents in matches that hadn't even started - producing false
// certainty (a 75% favourite from a functionally 1-hole lead). Treating every remaining hole
// as neutral means the projection is driven purely by real, banked points and how much of the
// event each team has left to play - which is exactly what "early in the tournament" should
// look like: close to parity, moving only as real results come in.

const TRIALS = 10000;

// Real matchplay holes do tie reasonably often (both sides net the same score) — without
// this the simulation would only ever produce clean sweeps, understating each team's floor.
const TIE_PROBABILITY = 0.2;

// 9 matches × 18 holes — the whole event, used to flatten win probability early on and as
// the worm chart's fixed x-axis scale.
export const TOTAL_HOLES = 162;

// Fisher-Yates shuffle — an unbiased random ordering, used to rank a 3-way singles hole
// with no team favoured over another.
function shuffled(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// One simulated pass over every unplayed hole in every match. Returns Map<teamId, pointsGained>.
function simulateRemaining(perMatch) {
  const deltas = new Map();
  const add = (teamId, pts) => deltas.set(teamId, (deltas.get(teamId) ?? 0) + pts);

  for (const m of perMatch) {
    if (!m.setUp || m.remainingHoles.length === 0) continue;

    for (const { pool } of m.remainingHoles) {
      if (m.sides.length === 2) {
        const [a, b] = m.sides;
        if (Math.random() < TIE_PROBABILITY) {
          add(a.teamId, pool / 2);
          add(b.teamId, pool / 2);
          continue;
        }
        const winner = Math.random() < 0.5 ? a : b;
        add(winner.teamId, pool);
      } else {
        const ranked = shuffled(m.sides);
        const splits = pool === 6 ? [4, 2, 0] : [2, 1, 0];
        ranked.forEach((s, i) => add(s.teamId, splits[i]));
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

  const winCounts = new Map(teamIds.map((id) => [id, 0]));
  const pointsSum = new Map(teamIds.map((id) => [id, 0]));

  for (let i = 0; i < trials; i++) {
    const deltas = simulateRemaining(perMatch);
    const finals = new Map(teamIds.map((id) => [id, currentPoints.get(id) + (deltas.get(id) ?? 0)]));

    let max = -Infinity;
    for (const v of finals.values()) if (v > max) max = v;
    const winners = teamIds.filter((id) => finals.get(id) === max);
    for (const id of winners) winCounts.set(id, winCounts.get(id) + 1 / winners.length);
    for (const id of teamIds) pointsSum.set(id, pointsSum.get(id) + finals.get(id));
  }

  // A handful of holes still creates a disproportionate swing in a single Monte Carlo draw -
  // whichever team's matches happen to have more pool still open (e.g. simply because their
  // opponent hasn't teed off yet) picks up a variance edge far bigger than that scheduling
  // quirk deserves. Blend the raw simulated win rate toward pure parity by how much of the
  // whole event has actually been played, so the projection reads as "close to even" this
  // early and only sharpens as real results accumulate.
  const progress = Math.min(1, totalHolesCompleted(perMatch) / TOTAL_HOLES);
  const neutralShare = 1 / teamIds.length;

  return teamIds.map((id) => ({
    teamId: id,
    currentPoints: currentPoints.get(id),
    projectedPoints: pointsSum.get(id) / trials,
    winProbability: progress * (winCounts.get(id) / trials) + (1 - progress) * neutralShare,
  }));
}

// Total holes completed across the whole event so far — the worm diagram's x-axis.
export function totalHolesCompleted(perMatch) {
  return perMatch.reduce((sum, m) => sum + (m.setUp ? m.holesPlayed : 0), 0);
}
