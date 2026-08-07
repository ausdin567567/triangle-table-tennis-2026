// Shared static roster data for the 2026 Triangle Table Tennis Tournament.

const SINGLES_PLAYERS = [
  { id: "noah", name: "Noah", country: "Spain", flag: "🇪🇸" },
  { id: "ishan", name: "Ishan", country: "Argentina", flag: "🇦🇷" },
  { id: "sarim", name: "Sarim", country: "Brazil", flag: "🇧🇷" },
  { id: "milon", name: "Milon", country: "France", flag: "🇫🇷" },
  { id: "hye", name: "Hye", country: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "ripon", name: "Ripon", country: "Belgium", flag: "🇧🇪" },
  { id: "shuvo", name: "Shuvo", country: "Morocco", flag: "🇲🇦" },
  { id: "ausdin", name: "Ausdin", country: "Switzerland", flag: "🇨🇭" },
  { id: "shams", name: "Shams", country: "Norway", flag: "🇳🇴" },
  { id: "swap", name: "Swap", country: "Portugal", flag: "🇵🇹" },
  { id: "hafiz", name: "Hafiz", country: "Colombia", flag: "🇨🇴" },
  { id: "rajib", name: "Rajib", country: "Egypt", flag: "🇪🇬" },
  { id: "quamrul", name: "Quamrul", country: "USA", flag: "🇺🇸" }
];

// Official 2026 singles group draw.
const OFFICIAL_GROUPS = {
  A: ["milon", "rajib", "swap"],
  B: ["hye", "ripon", "shams"],
  C: ["noah", "shuvo", "hafiz"],
  D: ["ishan", "sarim", "ausdin", "quamrul"]
};

// Official playing order for the 15 group stage matches.
const SINGLES_SCHEDULE = [
  ["quamrul", "sarim"],
  ["milon", "swap"],
  ["ausdin", "ishan"],
  ["noah", "shuvo"],
  ["hye", "shams"],
  ["ishan", "quamrul"],
  ["milon", "rajib"],
  ["noah", "hafiz"],
  ["sarim", "ausdin"],
  ["ripon", "shams"],
  ["rajib", "swap"],
  ["ausdin", "quamrul"],
  ["hye", "ripon"],
  ["ishan", "sarim"],
  ["shuvo", "hafiz"]
];

function getPlayer(id) {
  return SINGLES_PLAYERS.find(function (p) { return p.id === id; }) || null;
}

// Which group a pair of players belongs to (both must be in the same group).
function groupForPair(a, b) {
  var ids = Object.keys(OFFICIAL_GROUPS);
  for (var i = 0; i < ids.length; i++) {
    var members = OFFICIAL_GROUPS[ids[i]];
    if (members.indexOf(a) !== -1 && members.indexOf(b) !== -1) return ids[i];
  }
  return null;
}

function playerLabel(id) {
  var p = getPlayer(id);
  return p ? p.flag + " " + p.name : "TBD";
}

// ===== Round robin standings & tiebreakers =====
//
// Players are ranked by matches won. Ties are broken, in order, by:
//   1. Head to head record
//   2. Games won / games lost   (ratio)
//   3. Points won / points conceded (ratio)
//
// Following standard table tennis practice, every tiebreaker is calculated
// using ONLY the matches played between the tied players. If a tiebreaker
// splits a tied block into smaller groups, the process repeats within each
// remaining group.

function blankStandingsRow(id) {
  return {
    id: id, played: 0, wins: 0, losses: 0,
    gamesW: 0, gamesL: 0, pointsW: 0, pointsL: 0
  };
}

// Tally stats for `ids` across `matches`, counting only decided matches where
// both players are within `ids`.
function tallyStandings(ids, matches) {
  var rows = {};
  ids.forEach(function (id) { rows[id] = blankStandingsRow(id); });

  (matches || []).forEach(function (m) {
    if (!m || !rows.hasOwnProperty(m.p1) || !rows.hasOwnProperty(m.p2)) return;
    var mr = computeMatchFromGames(m.games);
    if (!mr.winner) return;

    var r1 = rows[m.p1], r2 = rows[m.p2];
    r1.played++; r2.played++;
    r1.gamesW += mr.gw1; r1.gamesL += mr.gw2;
    r2.gamesW += mr.gw2; r2.gamesL += mr.gw1;

    m.games.forEach(function (g) {
      if (gameResult(g.a, g.b) === 0) return;
      r1.pointsW += g.a; r1.pointsL += g.b;
      r2.pointsW += g.b; r2.pointsL += g.a;
    });

    if (mr.winner === 1) { r1.wins++; r2.losses++; }
    else { r2.wins++; r1.losses++; }
  });

  return ids.map(function (id) { return rows[id]; });
}

// A won/lost ratio. An unbeaten record (no losses) outranks any finite ratio.
function wlRatio(won, lost) {
  if (lost === 0) return won > 0 ? Infinity : 0;
  return won / lost;
}

// Comparator applying the three tiebreakers over a restricted set of matches.
function tiebreakComparator(ids, subMatches) {
  var byId = {};
  tallyStandings(ids, subMatches).forEach(function (r) { byId[r.id] = r; });

  return function (a, b) {
    var ra = byId[a.id], rb = byId[b.id];
    if (rb.wins !== ra.wins) return rb.wins - ra.wins;

    var gA = wlRatio(ra.gamesW, ra.gamesL), gB = wlRatio(rb.gamesW, rb.gamesL);
    if (gB !== gA) return gB - gA;

    var pA = wlRatio(ra.pointsW, ra.pointsL), pB = wlRatio(rb.pointsW, rb.pointsL);
    if (pB !== pA) return pB - pA;

    return 0;
  };
}

function matchesAmong(ids, matches) {
  return (matches || []).filter(function (m) {
    return m && ids.indexOf(m.p1) !== -1 && ids.indexOf(m.p2) !== -1;
  });
}

// Split an already-sorted list into runs the comparator considers equal.
function groupEqual(sorted, cmp) {
  var blocks = [], i = 0;
  while (i < sorted.length) {
    var j = i;
    while (j + 1 < sorted.length && cmp(sorted[j], sorted[j + 1]) === 0) j++;
    blocks.push(sorted.slice(i, j + 1));
    i = j + 1;
  }
  return blocks;
}

function resolveTiedBlock(block, allMatches) {
  var ids = block.map(function (r) { return r.id; });
  var cmp = tiebreakComparator(ids, matchesAmong(ids, allMatches));
  var sorted = block.slice().sort(cmp);

  var out = [];
  groupEqual(sorted, cmp).forEach(function (grp) {
    // Recurse only when the block actually got smaller, otherwise players are
    // tied on every criterion and the current order stands.
    if (grp.length > 1 && grp.length < block.length) {
      out = out.concat(resolveTiedBlock(grp, allMatches));
    } else {
      out = out.concat(grp);
    }
  });
  return out;
}

// Rank a round robin field. `matches` entries look like { p1, p2, games }.
function rankRoundRobin(ids, matches) {
  var rows = tallyStandings(ids, matches);
  rows.sort(function (a, b) { return b.wins - a.wins; });

  var byWins = function (a, b) { return b.wins - a.wins; };
  var ranked = [];
  groupEqual(rows, byWins).forEach(function (block) {
    ranked = ranked.concat(block.length > 1 ? resolveTiedBlock(block, matches) : block);
  });
  return ranked;
}

// ===== Table tennis scoring: games to 11, win by 2, best-of-3 games per set =====

function emptyGames() {
  return [{ a: 0, b: 0 }, { a: 0, b: 0 }, { a: 0, b: 0 }];
}

// Returns 0 (not decided yet), 1 (side a won), or 2 (side b won).
function gameResult(a, b) {
  a = a || 0; b = b || 0;
  if (a === 0 && b === 0) return 0;
  var max = Math.max(a, b), diff = Math.abs(a - b);
  if (max >= 11 && diff >= 2) return a > b ? 1 : 2;
  return 0;
}

// True when a game has reached 11+ but hasn't won by 2 yet (e.g. 11-10) — needs deuce play to continue.
function isInvalidGame(a, b) {
  a = a || 0; b = b || 0;
  if (a === 0 && b === 0) return false;
  var max = Math.max(a, b), diff = Math.abs(a - b);
  return max >= 11 && diff < 2;
}

// Clears game inputs that shouldn't be enterable yet: game 2 requires game 1 decided,
// game 3 only exists if games 1-2 split (one win each).
function normalizeGames(games) {
  var r0 = gameResult(games[0].a, games[0].b);
  if (r0 === 0) {
    games[1].a = 0; games[1].b = 0;
    games[2].a = 0; games[2].b = 0;
    return;
  }
  var r1 = gameResult(games[1].a, games[1].b);
  if (r1 === 0) {
    games[2].a = 0; games[2].b = 0;
    return;
  }
  if (r0 === r1) {
    games[2].a = 0; games[2].b = 0;
  }
}

// Best-of-3: first side to win 2 games takes the set/match.
function computeMatchFromGames(games) {
  var gw1 = 0, gw2 = 0, results = [];
  games.forEach(function (g) {
    var r = gameResult(g.a, g.b);
    results.push(r);
    if (r === 1) gw1++;
    else if (r === 2) gw2++;
  });
  return { gw1: gw1, gw2: gw2, winner: gw1 >= 2 ? 1 : (gw2 >= 2 ? 2 : 0), gameResults: results };
}

// Renders the compact 3-game score entry widget shared by singles groups,
// the knockout bracket, and the doubles schedule.
function renderGameTable(matchKey, games, p1Label, p2Label, p1Active, p2Active) {
  normalizeGames(games);
  var mr = computeMatchFromGames(games);
  var r0 = mr.gameResults[0], r1 = mr.gameResults[1];

  var game1Enabled = p1Active && p2Active;
  var game2Enabled = game1Enabled && r0 !== 0;
  var game3Enabled = game2Enabled && r1 !== 0 && r0 !== r1;
  var enabledByGame = [game1Enabled, game2Enabled, game3Enabled];

  function cell(side, gameIdx, value) {
    return '<input type="number" min="0" max="30" data-match-key="' + matchKey + '" data-game="' + gameIdx + '" data-side="' + side + '" value="' + value + '"' +
      (enabledByGame[gameIdx] ? "" : " disabled") + '>';
  }

  var warn = isInvalidGame(games[0].a, games[0].b) || isInvalidGame(games[1].a, games[1].b) || isInvalidGame(games[2].a, games[2].b);

  var resultText;
  if (!p1Active || !p2Active) {
    resultText = "Waiting on players";
  } else if (mr.winner) {
    resultText = "Set: " + mr.gw1 + "–" + mr.gw2 + " · " + (mr.winner === 1 ? p1Label : p2Label) + " wins";
  } else if (warn) {
    resultText = "Needs a 2-point win to finish the game";
  } else {
    resultText = "Set: " + mr.gw1 + "–" + mr.gw2 + " (in progress)";
  }

  return '<div class="set-editor">' +
    '<table class="game-table"><thead><tr><th></th><th>G1</th><th>G2</th><th>G3</th></tr></thead><tbody>' +
      '<tr><td class="gt-name' + (mr.winner === 1 ? " winner" : "") + '">' + p1Label + '</td>' +
        '<td>' + cell(1, 0, games[0].a) + '</td>' +
        '<td>' + cell(1, 1, games[1].a) + '</td>' +
        '<td>' + cell(1, 2, games[2].a) + '</td>' +
      '</tr>' +
      '<tr><td class="gt-name' + (mr.winner === 2 ? " winner" : "") + '">' + p2Label + '</td>' +
        '<td>' + cell(2, 0, games[0].b) + '</td>' +
        '<td>' + cell(2, 1, games[1].b) + '</td>' +
        '<td>' + cell(2, 2, games[2].b) + '</td>' +
      '</tr>' +
    '</tbody></table>' +
    '<div class="set-result' + (warn && !mr.winner ? " warn" : "") + '">' + resultText + '</div>' +
  '</div>';
}
