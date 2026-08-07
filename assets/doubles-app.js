// Interactive scoreboard for the 2026 Doubles Tournament.
// Team names and round robin match results are entered by the user and
// stored in localStorage. Each matchup is a set: best-of-3 games to 11
// (win by 2). Standings recompute live from the entered game scores.

(function () {
  var STORAGE_KEY = "ttt2026_doubles_state_v2";

  // Fixed round-robin pairing by team index (0-5), 5 rounds x 3 matches.
  var SCHEDULE = [
    [[0, 5], [1, 4], [2, 3]],
    [[0, 4], [5, 3], [1, 2]],
    [[0, 3], [4, 2], [5, 1]],
    [[0, 2], [3, 1], [4, 5]],
    [[0, 1], [2, 5], [3, 4]]
  ];

  function defaultState() {
    var teams = [1, 2, 3, 4, 5, 6].map(function (n) { return "Team " + n; });
    var matches = [];
    SCHEDULE.forEach(function (round, rIdx) {
      round.forEach(function (pair) {
        matches.push({ round: rIdx + 1, t1: pair[0], t2: pair[1], games: emptyGames() });
      });
    });
    return { teams: teams, matches: matches };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      if (!parsed.teams || parsed.teams.length !== 6 || !parsed.matches || parsed.matches.length !== 15) {
        return defaultState();
      }
      return parsed;
    } catch (e) {
      return defaultState();
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  var state = loadState();

  // Ranking and tiebreakers live in tournament-data.js (shared with singles):
  // matches won, then head to head, games ratio, and points ratio among the
  // tied teams only.
  function computeStandings() {
    var ids = state.teams.map(function (_, idx) { return idx; });
    var matches = state.matches.map(function (m) {
      return { p1: m.t1, p2: m.t2, games: m.games };
    });
    return rankRoundRobin(ids, matches).map(function (row) {
      row.name = state.teams[row.id];
      return row;
    });
  }

  function renderTeamNames() {
    var container = document.getElementById("teams-container");
    if (!container) return;
    var html = '<div class="roster-grid">' + state.teams.map(function (name, idx) {
      return '<div class="player-chip"><span class="flag">🏓</span><div style="width:100%;">' +
        '<input class="team-name-input" data-team="' + idx + '" value="' + name.replace(/"/g, "&quot;") + '">' +
        '<div class="country">Doubles Team</div></div></div>';
    }).join("") + '</div>';
    container.innerHTML = html;

    container.querySelectorAll("input[data-team]").forEach(function (input) {
      input.addEventListener("input", function () {
        var idx = parseInt(input.getAttribute("data-team"), 10);
        state.teams[idx] = input.value || ("Team " + (idx + 1));
        saveState(state);
        renderSchedule();
        renderStandings();
      });
    });
  }

  function renderSchedule() {
    var container = document.getElementById("schedule-container");
    if (!container) return;

    var byRound = {};
    state.matches.forEach(function (m, idx) {
      m._idx = idx;
      (byRound[m.round] = byRound[m.round] || []).push(m);
    });

    var rowsHtml = Object.keys(byRound).sort(function (a, b) { return a - b; }).map(function (roundNum) {
      var cells = byRound[roundNum].map(function (m) {
        var t1 = state.teams[m.t1], t2 = state.teams[m.t2];
        return '<td>' + renderGameTable("d:" + m._idx, m.games, t1, t2, true, true) + '</td>';
      }).join("");
      return '<tr><td>Round ' + roundNum + '</td>' + cells + '</tr>';
    }).join("");

    container.innerHTML =
      '<div class="table-wrap"><table class="tt-table">' +
        '<thead><tr><th>Round</th><th>Match 1</th><th>Match 2</th><th>Match 3</th></tr></thead>' +
        '<tbody>' + rowsHtml + '</tbody>' +
      '</table></div>';

    container.querySelectorAll("input[data-match-key]").forEach(function (input) {
      input.addEventListener("input", function () {
        var key = input.getAttribute("data-match-key"); // "d:idx"
        var idx = parseInt(key.split(":")[1], 10);
        var gameIdx = parseInt(input.getAttribute("data-game"), 10);
        var side = input.getAttribute("data-side");
        var val = Math.max(0, parseInt(input.value, 10) || 0);
        state.matches[idx].games[gameIdx][side === "1" ? "a" : "b"] = val;
        saveState(state);
        renderSchedule();
        renderStandings();
      });
    });
  }

  function renderStandings() {
    var container = document.getElementById("standings-container");
    if (!container) return;
    var standings = computeStandings();
    var rowsHtml = standings.map(function (row, i) {
      return '<tr' + (i === 0 && row.played > 0 ? ' style="background:#fff8e6;"' : '') + '>' +
        '<td>' + (i + 1) + '</td>' +
        '<td class="team-chip">🏓 ' + row.name + (i === 0 && row.played === 5 ? " 🏆" : "") + '</td>' +
        '<td>' + row.played + '</td>' +
        '<td>' + row.wins + "–" + row.losses + '</td>' +
        '<td>' + row.gamesW + "–" + row.gamesL + '</td>' +
        '<td>' + row.pointsW + "–" + row.pointsL + '</td>' +
      '</tr>';
    }).join("");

    container.innerHTML =
      '<div class="table-wrap"><table class="tt-table">' +
        '<thead><tr><th>#</th><th>Team</th><th>P</th><th>W–L</th><th>Games</th><th>Points</th></tr></thead>' +
        '<tbody>' + rowsHtml + '</tbody>' +
      '</table></div>';
  }

  function resetAll() {
    if (!confirm("Reset all doubles team names and match results? This cannot be undone.")) return;
    state = defaultState();
    saveState(state);
    renderTeamNames();
    renderSchedule();
    renderStandings();
  }

  document.addEventListener("DOMContentLoaded", function () {
    var resetBtn = document.getElementById("reset-doubles-btn");
    if (resetBtn) resetBtn.addEventListener("click", resetAll);
    renderTeamNames();
    renderSchedule();
    renderStandings();
  });
})();
