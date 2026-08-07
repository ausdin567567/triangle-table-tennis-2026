// Match schedule for the 2026 Singles Tournament group stage.
// Displays the official playing order and reflects live results from the
// scores entered on the singles page (shared localStorage state).

(function () {
  var STORAGE_KEY = "ttt2026_singles_state_v2";

  // Read saved group match results defensively — the schedule page never
  // writes state, and must not break on older or malformed saves.
  function loadResults() {
    var byPair = {};
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return byPair;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.groupMatches) return byPair;

      Object.keys(parsed.groupMatches).forEach(function (g) {
        var matches = parsed.groupMatches[g];
        if (!Array.isArray(matches)) return;
        matches.forEach(function (m) {
          if (!m || !m.p1 || !m.p2 || !Array.isArray(m.games)) return;
          var valid = m.games.every(function (game) {
            return game && typeof game.a === "number" && typeof game.b === "number";
          });
          if (!valid) return;
          byPair[pairKey(m.p1, m.p2)] = m;
        });
      });
    } catch (e) {
      return {};
    }
    return byPair;
  }

  function pairKey(a, b) {
    return [a, b].sort().join("|");
  }

  function resultCell(a, b, results) {
    var m = results[pairKey(a, b)];
    if (!m) return '<span class="sched-status pending">Not played</span>';

    var mr = computeMatchFromGames(m.games);
    if (!mr.winner) {
      var started = m.games.some(function (g) { return g.a > 0 || g.b > 0; });
      return started
        ? '<span class="sched-status live">In progress</span>'
        : '<span class="sched-status pending">Not played</span>';
    }

    // Scores are stored relative to m.p1 / m.p2, which may differ in order
    // from how the match is listed in the schedule.
    var winnerId = mr.winner === 1 ? m.p1 : m.p2;
    var winnerGames = mr.winner === 1 ? mr.gw1 : mr.gw2;
    var loserGames = mr.winner === 1 ? mr.gw2 : mr.gw1;
    var w = getPlayer(winnerId);

    var gameScores = m.games
      .filter(function (g) { return gameResult(g.a, g.b) !== 0; })
      .map(function (g) {
        // Present each game from the winner's perspective.
        var wa = winnerId === m.p1 ? g.a : g.b;
        var wb = winnerId === m.p1 ? g.b : g.a;
        return wa + "-" + wb;
      })
      .join(", ");

    return '<span class="sched-status done">' + w.flag + " " + w.name + " won " +
      winnerGames + "–" + loserGames + '</span>' +
      '<span class="sched-games">' + gameScores + '</span>';
  }

  function render() {
    var container = document.getElementById("schedule-list");
    if (!container) return;

    var results = loadResults();

    var rows = SINGLES_SCHEDULE.map(function (pair, idx) {
      var a = getPlayer(pair[0]);
      var b = getPlayer(pair[1]);
      var g = groupForPair(pair[0], pair[1]);

      return '<tr>' +
        '<td class="sched-num">' + (idx + 1) + '</td>' +
        '<td><span class="sched-group group-' + (g || "").toLowerCase() + '">' + (g || "?") + '</span></td>' +
        '<td class="sched-match">' +
          '<span class="sched-player">' + a.flag + " " + a.name + '</span>' +
          '<span class="sched-v">v</span>' +
          '<span class="sched-player">' + b.flag + " " + b.name + '</span>' +
        '</td>' +
        '<td class="sched-result">' + resultCell(pair[0], pair[1], results) + '</td>' +
      '</tr>';
    }).join("");

    container.innerHTML =
      '<div class="table-wrap"><table class="tt-table sched-table">' +
        '<thead><tr><th>#</th><th>Group</th><th>Match</th><th>Result</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table></div>';
  }

  document.addEventListener("DOMContentLoaded", render);
})();
