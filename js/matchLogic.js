// Shared match-scoring logic used by both the single-match scoring page (match.js) and
// the season-wide team totals on the landing page (home.js) — kept in one place so the
// two never disagree on how points/handicaps are worked out.
import { netScore, pairHandicap, twoWayPoints, threeWayPoints } from './scoring.js';

export function handicapForDay(player, day) {
  return player[`handicap_day${day}`] ?? player.handicap ?? 0;
}

// matchPlayers: rows from match_players joined with players(..., teams(...)).
export function buildSides(format, day, matchPlayers) {
  if (format === 'greensomes') {
    const pair = matchPlayers.filter((mp) => mp.side === 'pair');
    const single = matchPlayers.find((mp) => mp.side === 'single');
    // Greensomes plays one shared ball, so the pair plays off one combined handicap
    // (average of the two) — both names show that same number, per the xlsx convention.
    const pairHcp = pairHandicap(handicapForDay(pair[0].players, day), handicapForDay(pair[1].players, day));
    return [
      {
        key: 'pair',
        label: pair.map((p) => p.players.name).join(' & '),
        color: pair[0].players.teams.color_hex,
        teamId: pair[0].players.team_id,
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
        teamId: single.players.team_id,
        teamName: single.players.teams.name,
        flagEmoji: single.players.teams.flag_emoji,
        playerIds: [single.player_id],
        handicap: handicapForDay(single.players, day),
        namesWithHandicap: [{ name: single.players.name, handicap: handicapForDay(single.players, day) }],
      },
    ];
  }

  if (format === 'betterball') {
    const pair = matchPlayers.filter((mp) => mp.side === 'pair');
    const single = matchPlayers.find((mp) => mp.side === 'single');
    return [
      {
        key: 'pair',
        label: pair.map((p) => p.players.name).join(' & '),
        color: pair[0].players.teams.color_hex,
        teamId: pair[0].players.team_id,
        teamName: pair[0].players.teams.name,
        flagEmoji: pair[0].players.teams.flag_emoji,
        // Representative handicap for this side (used only to find the match's lowest
        // handicap — min(min(a,b), c) === min(a,b,c), so this doesn't skew that). Actual
        // scoring below always uses each member's own individual handicap.
        handicap: Math.min(handicapForDay(pair[0].players, day), handicapForDay(pair[1].players, day)),
        members: pair.map((p) => ({
          playerId: p.player_id,
          label: p.players.name,
          handicap: handicapForDay(p.players, day),
        })),
        namesWithHandicap: pair.map((p) => ({ name: p.players.name, handicap: handicapForDay(p.players, day) })),
      },
      {
        key: 'single',
        label: single.players.name,
        color: single.players.teams.color_hex,
        teamId: single.players.team_id,
        teamName: single.players.teams.name,
        flagEmoji: single.players.teams.flag_emoji,
        handicap: handicapForDay(single.players, day),
        members: [
          { playerId: single.player_id, label: single.players.name, handicap: handicapForDay(single.players, day) },
        ],
        namesWithHandicap: [{ name: single.players.name, handicap: handicapForDay(single.players, day) }],
      },
    ];
  }

  // singles — 3 independent players
  return matchPlayers.map((mp) => ({
    key: mp.player_id,
    label: mp.players.name,
    color: mp.players.teams.color_hex,
    teamId: mp.players.team_id,
    teamName: mp.players.teams.name,
    flagEmoji: mp.players.teams.flag_emoji,
    playerIds: [mp.player_id],
    handicap: handicapForDay(mp.players, day),
    namesWithHandicap: [{ name: mp.players.name, handicap: handicapForDay(mp.players, day) }],
  }));
}

export function computeMatchMinHandicap(sides) {
  return Math.min(...sides.map((s) => s.handicap));
}

// Match-play strokes are given off the *difference* from the lowest handicap in this
// match, not each side's full individual allowance — the lowest handicap plays scratch.
export function relativeHandicap(handicap, matchMinHandicap) {
  return handicap - matchMinHandicap;
}

// holeScores: Map<playerId, grossStrokes>. Returns Map<sideKey, points> or null if incomplete.
export function computeHolePoints(format, sides, matchMinHandicap, hole, holeScores) {
  if (format === 'greensomes') {
    const [pairSide, singleSide] = sides;
    const pairGross = holeScores.get(pairSide.playerIds[0]);
    const singleGross = holeScores.get(singleSide.playerIds[0]);
    if (pairGross == null || singleGross == null) return null;
    const netPair = netScore(pairGross, relativeHandicap(pairSide.handicap, matchMinHandicap), hole.stroke_index);
    const netSingle = netScore(singleGross, relativeHandicap(singleSide.handicap, matchMinHandicap), hole.stroke_index);
    const [p1, p2] = twoWayPoints(netPair, netSingle);
    return new Map([
      ['pair', p1],
      ['single', p2],
    ]);
  }

  if (format === 'betterball') {
    const [pairSide, singleSide] = sides;
    const pairNets = pairSide.members.map((m) => holeScores.get(m.playerId));
    const singleGross = holeScores.get(singleSide.members[0].playerId);
    if (pairNets.some((v) => v == null) || singleGross == null) return null;
    const netA = netScore(pairNets[0], relativeHandicap(pairSide.members[0].handicap, matchMinHandicap), hole.stroke_index);
    const netB = netScore(pairNets[1], relativeHandicap(pairSide.members[1].handicap, matchMinHandicap), hole.stroke_index);
    const bestPairNet = Math.min(netA, netB);
    const netSingle = netScore(
      singleGross,
      relativeHandicap(singleSide.members[0].handicap, matchMinHandicap),
      hole.stroke_index
    );
    const [p1, p2] = twoWayPoints(bestPairNet, netSingle);
    return new Map([
      ['pair', p1],
      ['single', p2],
    ]);
  }

  // singles
  const nets = sides.map((s) => {
    const gross = holeScores.get(s.playerIds[0]);
    return gross == null ? null : netScore(gross, relativeHandicap(s.handicap, matchMinHandicap), hole.stroke_index);
  });
  if (nets.some((v) => v == null)) return null;
  const pts = threeWayPoints(...nets);
  return new Map(sides.map((s, i) => [s.key, pts[i]]));
}

// Net Eagle is automatic, not a manual pick: whenever a net score is 2 under par, that's
// worth the "Net Eagle" points. Greensomes splits it 1pt each across the pair (they share
// one score); every other side/format is fully individual, so a lone player scoring it
// keeps the full points. Returns Map<playerId, pointsAwarded>.
export function netEagleAwards(format, sides, matchMinHandicap, hole, holeScores, netEagleType) {
  const awards = new Map();
  if (!netEagleType) return awards;
  const eagleTarget = hole.par - 2;
  const perPlayer = format === 'greensomes' ? netEagleType.points / 2 : netEagleType.points;

  const check = (playerIds, gross, handicap) => {
    if (gross == null) return;
    const net = netScore(gross, relativeHandicap(handicap, matchMinHandicap), hole.stroke_index);
    if (net !== eagleTarget) return;
    const share = format === 'greensomes' && playerIds.length > 1 ? perPlayer : netEagleType.points;
    playerIds.forEach((id) => awards.set(id, share));
  };

  if (format === 'greensomes') {
    const [pairSide, singleSide] = sides;
    check(pairSide.playerIds, holeScores.get(pairSide.playerIds[0]), pairSide.handicap);
    check([singleSide.playerIds[0]], holeScores.get(singleSide.playerIds[0]), singleSide.handicap);
  } else if (format === 'betterball') {
    const [pairSide, singleSide] = sides;
    pairSide.members.forEach((m) => check([m.playerId], holeScores.get(m.playerId), m.handicap));
    const sm = singleSide.members[0];
    check([sm.playerId], holeScores.get(sm.playerId), sm.handicap);
  } else {
    sides.forEach((s) => check([s.playerIds[0]], holeScores.get(s.playerIds[0]), s.handicap));
  }

  return awards;
}
