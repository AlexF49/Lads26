// Shared handicap/points math used by the matchday scoring pages.

export function strokesReceived(handicap, strokeIndex) {
  const hcp = handicap ?? 0;
  const full = Math.floor(hcp / 18);
  const extra = strokeIndex <= (hcp % 18) ? 1 : 0;
  return full + extra;
}

export function netScore(grossStrokes, handicap, strokeIndex) {
  return grossStrokes - strokesReceived(handicap, strokeIndex);
}

export function pairHandicap(handicapA, handicapB) {
  return Math.round(((handicapA ?? 0) + (handicapB ?? 0)) / 2);
}

// Splits a descending points pool (e.g. [2, 0] or [2, 1, 0]) across net scores,
// giving the best (lowest) net score the top of the pool. Tied net scores split
// the pool slots they occupy evenly — e.g. two tied for best out of [2, 1, 0]
// each get (2 + 1) / 2 = 1.5, third gets 0.
export function splitPoints(nets, pool) {
  const n = nets.length;
  const order = nets.map((_, i) => i).sort((a, b) => nets[a] - nets[b]);
  const points = new Array(n).fill(0);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && nets[order[j + 1]] === nets[order[i]]) j++;
    const slice = pool.slice(i, j + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    for (let k = i; k <= j; k++) points[order[k]] = avg;
    i = j + 1;
  }
  return points;
}

export function twoWayPoints(netA, netB) {
  return splitPoints([netA, netB], [2, 0]);
}

export function threeWayPoints(net1, net2, net3) {
  return splitPoints([net1, net2, net3], [2, 1, 0]);
}
