// Shared match-scoring logic used by both the single-match scoring page (match.js) and
// the season-wide team totals on the landing page (home.js) — kept in one place so the
// two never disagree on how points/handicaps are worked out.
import { netScore, pairHandicap, twoWayPoints, threeWayPoints } from './scoring.js';

export function handicapForDay(player, day) {
  return player[`handicap_day${day}`] ?? player.handicap ?? 0;
}

// Bonus/competition points are editable per day from the admin page; points_dayN falls
// back to the base points value for any competition type that hasn't been customised.
export function pointsForDay(competitionType, day) {
  return competitionType[`points_day${day}`] ?? competitionType.points;
}

// First tee time and gap are set per day; each day's 3 matches go off in match_number order.
const TEE_OFF_START = { 1: { hour: 14, minute: 42 }, 2: { hour: 9, minute: 12 }, 3: { hour: 9, minute: 56 } };
const TEE_GAP_MINUTES = 8;

export function teeTimeForMatch(day, matchNumber) {
  const start = TEE_OFF_START[day];
  if (!start || !matchNumber) return '';
  const totalMinutes = start.hour * 60 + start.minute + (matchNumber - 1) * TEE_GAP_MINUTES;
  const hour = Math.floor(totalMinutes / 60) % 24;
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
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

// Hole 18 is worth double points in every format.
function holeMultiplier(hole) {
  return hole.hole_number === 18 ? 2 : 1;
}

// holeScores: Map<playerId, grossStrokes>. Returns Map<sideKey, points> or null if incomplete.
export function computeHolePoints(format, sides, matchMinHandicap, hole, holeScores) {
  const mult = holeMultiplier(hole);

  if (format === 'greensomes') {
    const [pairSide, singleSide] = sides;
    const pairGross = holeScores.get(pairSide.playerIds[0]);
    const singleGross = holeScores.get(singleSide.playerIds[0]);
    if (pairGross == null || singleGross == null) return null;
    const netPair = netScore(pairGross, relativeHandicap(pairSide.handicap, matchMinHandicap), hole.stroke_index);
    const netSingle = netScore(singleGross, relativeHandicap(singleSide.handicap, matchMinHandicap), hole.stroke_index);
    const [p1, p2] = twoWayPoints(netPair, netSingle);
    return new Map([
      ['pair', p1 * mult],
      ['single', p2 * mult],
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
      ['pair', p1 * mult],
      ['single', p2 * mult],
    ]);
  }

  // singles
  const nets = sides.map((s) => {
    const gross = holeScores.get(s.playerIds[0]);
    return gross == null ? null : netScore(gross, relativeHandicap(s.handicap, matchMinHandicap), hole.stroke_index);
  });
  if (nets.some((v) => v == null)) return null;
  const pts = threeWayPoints(...nets);
  return new Map(sides.map((s, i) => [s.key, pts[i] * mult]));
}

// Net Eagle is automatic, not a manual pick: whenever a net score is 2-under-par or
// better (an eagle or anything stronger, e.g. albatross), that's worth the "Net Eagle"
// points. Greensomes splits it 1pt each across the pair (they share one score); every
// other side/format is fully individual, so a lone player scoring it keeps the full
// points. Returns Map<playerId, pointsAwarded>.
export function netEagleAwards(format, sides, matchMinHandicap, hole, holeScores, netEagleType, day) {
  const awards = new Map();
  if (!netEagleType) return awards;
  const eagleTarget = hole.par - 2;
  const fullPoints = pointsForDay(netEagleType, day);
  const perPlayer = format === 'greensomes' ? fullPoints / 2 : fullPoints;

  const check = (playerIds, gross, handicap) => {
    if (gross == null) return;
    const net = netScore(gross, relativeHandicap(handicap, matchMinHandicap), hole.stroke_index);
    if (net > eagleTarget) return;
    const share = format === 'greensomes' && playerIds.length > 1 ? perPlayer : fullPoints;
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

// Rolls up every match into team totals, per-match summaries, and individual player
// totals — the single source of truth for both the landing page's team cards and the
// leaderboard page. Every player on a side that wins/ties hole points gets full credit
// for those points (a pair isn't split); Net Eagle stays split per netEagleAwards above.
export function aggregateEvent({ teams, players, matches, matchPlayers, scores, courses, holes, competitionTypes, competitionResults }) {
  const holesByDay = new Map();
  for (const course of courses) {
    holesByDay.set(course.day, new Map(holes.filter((h) => h.course_id === course.id).map((h) => [h.hole_number, h])));
  }

  const matchPlayersByMatch = new Map();
  for (const mp of matchPlayers) {
    if (!matchPlayersByMatch.has(mp.match_id)) matchPlayersByMatch.set(mp.match_id, []);
    matchPlayersByMatch.get(mp.match_id).push(mp);
  }

  const scoresByMatch = new Map();
  for (const row of scores) {
    if (!scoresByMatch.has(row.match_id)) scoresByMatch.set(row.match_id, new Map());
    const byHole = scoresByMatch.get(row.match_id);
    if (!byHole.has(row.hole)) byHole.set(row.hole, new Map());
    byHole.get(row.hole).set(row.player_id, row.gross_strokes);
  }

  const playerById = new Map(players.map((p) => [p.id, p]));
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const netEagleType = competitionTypes.find((ct) => ct.name === 'Net Eagle');

  const teamTotalsMap = new Map(teams.map((t) => [t.id, { matchplay: 0, bonus: 0 }]));
  const playerTotalsMap = new Map(
    players.map((p) => [p.id, { playerId: p.id, name: p.name, teamId: p.team_id, holePoints: 0, bonusPoints: 0 }])
  );

  // Pass 1: build each match's sides + matchplay points, and Net Eagle bonus per side
  // (computed inline since it's derived per-hole). Also record which match/side each
  // player sits in per day, so manual bonus picks (pass 2) can be attributed correctly.
  const matchWork = [];
  const sideByDayPlayer = new Map(); // "day:playerId" -> { workIndex, sideKey }

  for (const match of matches) {
    const mps = matchPlayersByMatch.get(match.id) ?? [];
    const globalNumber = (match.day - 1) * 3 + match.match_number;
    const teeTime = teeTimeForMatch(match.day, match.match_number);
    if (mps.length === 0) {
      matchWork.push({ matchId: match.id, day: match.day, format: match.format, globalNumber, teeTime, setUp: false });
      continue;
    }

    const sides = buildSides(match.format, match.day, mps);
    const matchMinHandicap = computeMatchMinHandicap(sides);
    const holesForDay = holesByDay.get(match.day) ?? new Map();
    const scoresForMatch = scoresByMatch.get(match.id) ?? new Map();

    const sidePoints = new Map(sides.map((s) => [s.key, 0]));
    const sideBonus = new Map(sides.map((s) => [s.key, 0]));
    const workIndex = matchWork.length;
    for (const s of sides) {
      const ids = s.members ? s.members.map((m) => m.playerId) : s.playerIds;
      for (const pid of ids) sideByDayPlayer.set(`${match.day}:${pid}`, { workIndex, sideKey: s.key });
    }

    let holesPlayed = 0;

    for (const hole of holesForDay.values()) {
      const holeScores = scoresForMatch.get(hole.hole_number) ?? new Map();
      const points = computeHolePoints(match.format, sides, matchMinHandicap, hole, holeScores);
      if (points) {
        holesPlayed += 1;
        for (const [key, pts] of points) {
          sidePoints.set(key, sidePoints.get(key) + pts);
          const side = sides.find((s) => s.key === key);
          const playerIds = side.members ? side.members.map((m) => m.playerId) : side.playerIds;
          for (const pid of playerIds) {
            const pt = playerTotalsMap.get(pid);
            if (pt) pt.holePoints += pts; // full credit to every player on that side, no split
          }
          if (teamTotalsMap.has(side.teamId)) teamTotalsMap.get(side.teamId).matchplay += pts;
        }
      }

      const eagleAwards = netEagleAwards(match.format, sides, matchMinHandicap, hole, holeScores, netEagleType, match.day);
      for (const [pid, pts] of eagleAwards) {
        const pt = playerTotalsMap.get(pid);
        if (pt) pt.bonusPoints += pts;
        const teamId = playerById.get(pid)?.team_id;
        if (teamTotalsMap.has(teamId)) teamTotalsMap.get(teamId).bonus += pts;
        const mapping = sideByDayPlayer.get(`${match.day}:${pid}`);
        if (mapping && mapping.workIndex === workIndex) sideBonus.set(mapping.sideKey, sideBonus.get(mapping.sideKey) + pts);
      }
    }

    matchWork.push({
      matchId: match.id,
      day: match.day,
      format: match.format,
      globalNumber,
      teeTime,
      setUp: true,
      complete: holesPlayed === 18,
      holesPlayed,
      sides,
      sidePoints,
      sideBonus,
    });
  }

  // Pass 2: manual bonus picks (Net Eagle is automatic and already handled in pass 1).
  // Clutch Shot counts toward each player's individual leaderboard total, but stays out
  // of team/match totals — it's tracked as its own separate individual competition there.
  const teamBonusTypeIds = new Set(
    competitionTypes.filter((ct) => ct.counts_toward_bonus && !ct.is_automated).map((ct) => ct.id)
  );
  const playerBonusTypeById = new Map(competitionTypes.filter((ct) => !ct.is_automated).map((ct) => [ct.id, ct]));
  for (const row of competitionResults) {
    const playerType = playerBonusTypeById.get(row.competition_type_id);
    if (playerType != null) {
      const pt = playerTotalsMap.get(row.winner_id);
      if (pt) pt.bonusPoints += pointsForDay(playerType, row.day);
    }

    if (!teamBonusTypeIds.has(row.competition_type_id)) continue;
    const teamPts = pointsForDay(playerType, row.day);
    const teamId = playerById.get(row.winner_id)?.team_id;
    if (teamTotalsMap.has(teamId)) teamTotalsMap.get(teamId).bonus += teamPts;
    const mapping = sideByDayPlayer.get(`${row.day}:${row.winner_id}`);
    if (mapping) {
      const m = matchWork[mapping.workIndex];
      m.sideBonus.set(mapping.sideKey, m.sideBonus.get(mapping.sideKey) + teamPts);
    }
  }

  // Pass 3: flatten matchWork into the plain objects callers use.
  const perMatch = matchWork.map((m) =>
    m.setUp === false
      ? m
      : {
          matchId: m.matchId,
          day: m.day,
          format: m.format,
          globalNumber: m.globalNumber,
          teeTime: m.teeTime,
          setUp: true,
          complete: m.complete,
          holesPlayed: m.holesPlayed,
          sides: m.sides.map((s) => ({
            key: s.key,
            label: s.label,
            names: s.namesWithHandicap.map((n) => n.name),
            teamId: s.teamId,
            teamName: s.teamName,
            color: s.color,
            flagEmoji: s.flagEmoji,
            points: m.sidePoints.get(s.key),
            bonus: m.sideBonus.get(s.key),
          })),
        }
  );

  const teamTotals = teams.map((t) => {
    const v = teamTotalsMap.get(t.id);
    return { ...t, matchplay: v.matchplay, bonus: v.bonus, total: v.matchplay + v.bonus };
  });

  const playerTotals = [...playerTotalsMap.values()]
    .map((p) => ({ ...p, total: p.holePoints + p.bonusPoints, team: teamById.get(p.teamId) }))
    .sort((a, b) => b.total - a.total);

  perMatch.sort((a, b) => a.globalNumber - b.globalNumber);

  return { perMatch, teamTotals, playerTotals };
}
