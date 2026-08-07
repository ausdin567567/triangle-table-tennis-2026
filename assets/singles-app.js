// Interactive scoreboard for the 2026 Singles Tournament.
// Groups are the official 2026 draw (fixed). Match results are entered
// by the user and stored in localStorage. Each matchup is a set:
// best-of-3 games to 11 (win by 2). Group standings, knockout matchups,
// and the champion all recompute live from the entered game scores.

(function () {
  var STORAGE_KEY = "ttt2026_singles_state_v2";
  var GROUP_IDS = ["A", "B", "C", "D"];

  function emptyKnockoutSlot() {
    return { p1: null, p2: null, games: emptyGames() };
  }

  // OFFICIAL_GROUPS is defined in tournament-data.js (shared with the schedule page).

  function defaultState() {
    return {
      groups: {
        A: OFFICIAL_GROUPS.A.slice(),
        B: OFFICIAL_GROUPS.B.slice(),
        C: OFFICIAL_GROUPS.C.slice(),
        D: OFFICIAL_GROUPS.D.slice()
      },
      groupMatches: {
        A: roundRobinPairs(OFFICIAL_GROUPS.A),
        B: roundRobinPairs(OFFICIAL_GROUPS.B),
        C: roundRobinPairs(OFFICIAL_GROUPS.C),
        D: roundRobinPairs(OFFICIAL_GROUPS.D)
      },
      knockout: {
        qf: [emptyKnockoutSlot(), emptyKnockoutSlot(), emptyKnockoutSlot(), emptyKnockoutSlot()],
        sf: [emptyKnockoutSlot(), emptyKnockoutSlot()],
        final: emptyKnockoutSlot(),
        third: emptyKnockoutSlot()
      }
    };
  }

  // Only trust stored match data if it's for the same players in the same
  // order as the current official draw — otherwise a stale save (e.g. from
  // before the draw was finalized) could silently blank out real players.
  function matchesOfficialPairs(stored, ids) {
    if (!Array.isArray(stored)) return false;
    var official = roundRobinPairs(ids);
    if (stored.length !== official.length) return false;
    for (var i = 0; i < official.length; i++) {
      if (!stored[i] || stored[i].p1 !== official[i].p1 || stored[i].p2 !== official[i].p2) return false;
    }
    return true;
  }

  // A stored slot is only usable if it carries a well-formed 3-game array;
  // older saves used a different shape and would otherwise crash rendering.
  function loadSlot(stored, fallback) {
    if (!stored || !Array.isArray(stored.games) || stored.games.length !== 3) return fallback;
    var ok = stored.games.every(function (g) {
      return g && typeof g.a === "number" && typeof g.b === "number";
    });
    return ok ? stored : fallback;
  }

  function loadKnockout(stored, base) {
    if (!stored) return base;
    return {
      qf: base.qf.map(function (slot, i) { return loadSlot(stored.qf && stored.qf[i], slot); }),
      sf: base.sf.map(function (slot, i) { return loadSlot(stored.sf && stored.sf[i], slot); }),
      final: loadSlot(stored.final, base.final),
      third: loadSlot(stored.third, base.third)
    };
  }

  function loadState() {
    var base = defaultState();
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return base;
      var parsed = JSON.parse(raw);

      var groupMatches = {};
      GROUP_IDS.forEach(function (g) {
        var stored = parsed.groupMatches && parsed.groupMatches[g];
        groupMatches[g] = matchesOfficialPairs(stored, OFFICIAL_GROUPS[g]) ? stored : base.groupMatches[g];
      });

      return {
        groups: base.groups,
        groupMatches: groupMatches,
        knockout: loadKnockout(parsed.knockout, base.knockout)
      };
    } catch (e) {
      return base;
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  var state = loadState();

  function roundRobinPairs(ids) {
    var pairs = [];
    for (var i = 0; i < ids.length; i++) {
      for (var j = i + 1; j < ids.length; j++) {
        pairs.push({ p1: ids[i], p2: ids[j], games: emptyGames() });
      }
    }
    return pairs;
  }

  // Ranking and tiebreakers live in tournament-data.js (shared with doubles).
  function computeStandings(ids, matches) {
    return rankRoundRobin(ids, matches || []);
  }

  function allMatchesPlayed(matches) {
    return matches.length > 0 && matches.every(function (m) { return computeMatchFromGames(m.games).winner !== 0; });
  }

  // ---- Knockout bracket computation with cascading resets ----

  function resolveSlot(slot, p1, p2) {
    if (slot.p1 !== p1 || slot.p2 !== p2) {
      slot.p1 = p1;
      slot.p2 = p2;
      slot.games = emptyGames();
    }
    var mr = computeMatchFromGames(slot.games);
    var winner = null, loser = null;
    if (p1 && p2 && mr.winner) {
      winner = mr.winner === 1 ? p1 : p2;
      loser = winner === p1 ? p2 : p1;
    }
    return { p1: p1, p2: p2, games: slot.games, winner: winner, loser: loser };
  }

  function computeBracket() {
    var groupResults = {};
    GROUP_IDS.forEach(function (g) {
      var ids = state.groups[g];
      var standings = computeStandings(ids, state.groupMatches[g] || []);
      groupResults[g] = {
        standings: standings,
        complete: allMatchesPlayed(state.groupMatches[g] || []),
        winner: standings[0] ? standings[0].id : null,
        runnerup: standings[1] ? standings[1].id : null
      };
    });

    var qfPairs = [
      [groupResults.A.winner, groupResults.D.runnerup],
      [groupResults.C.winner, groupResults.B.runnerup],
      [groupResults.B.winner, groupResults.C.runnerup],
      [groupResults.D.winner, groupResults.A.runnerup]
    ];

    var qf = qfPairs.map(function (pair, i) {
      return resolveSlot(state.knockout.qf[i], pair[0], pair[1]);
    });

    var sfPairs = [
      [qf[0].winner, qf[1].winner],
      [qf[2].winner, qf[3].winner]
    ];
    var sf = sfPairs.map(function (pair, i) {
      return resolveSlot(state.knockout.sf[i], pair[0], pair[1]);
    });

    var final = resolveSlot(state.knockout.final, sf[0].winner, sf[1].winner);
    var third = resolveSlot(state.knockout.third, sf[0].loser, sf[1].loser);

    saveState(state);

    return { groupResults: groupResults, qf: qf, sf: sf, final: final, third: third };
  }

  // ---- Rendering ----

  function renderGroups(bracket) {
    var container = document.getElementById("groups-container");
    if (!container) return;

    var html = '<div class="group-grid">';
    GROUP_IDS.forEach(function (g) {
      var gr = bracket.groupResults[g];
      var standingsRows = gr.standings.map(function (row, idx) {
        var advancing = idx < 2;
        var p = getPlayer(row.id);
        return '<tr class="' + (advancing ? "advancing" : "") + '">' +
          '<td>' + (advancing ? '<span class="rank-badge">' + (idx + 1) + '</span>' : "") + p.flag + " " + p.name + '</td>' +
          '<td>' + row.wins + "–" + row.losses + '</td>' +
          '<td>' + row.gamesW + "–" + row.gamesL + '</td>' +
          '<td>' + row.pointsW + "–" + row.pointsL + '</td>' +
          '</tr>';
      }).join("");

      var matchRows = state.groupMatches[g].map(function (m, idx) {
        var p1 = getPlayer(m.p1), p2 = getPlayer(m.p2);
        var key = "group:" + g + ":" + idx;
        return renderGameTable(key, m.games, p1.flag + " " + p1.name, p2.flag + " " + p2.name, true, true);
      }).join("");

      html += '<div class="group-card">' +
        '<div class="group-head group-head-' + g.toLowerCase() + '">Group ' + g + (gr.complete ? "" : '<span class="group-provisional">Live</span>') + '<span class="count">' + state.groups[g].length + ' Players</span></div>' +
        '<div class="table-wrap"><table class="standings-mini"><thead><tr><th>Player</th><th>W–L</th><th>Games</th><th>Points</th></tr></thead><tbody>' + standingsRows + '</tbody></table></div>' +
        '<div class="match-list">' + matchRows + '</div>' +
      '</div>';
    });
    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll("input[data-match-key]").forEach(function (input) {
      input.addEventListener("input", function () {
        var key = input.getAttribute("data-match-key"); // "group:G:idx"
        var parts = key.split(":");
        var g = parts[1], idx = parseInt(parts[2], 10);
        var gameIdx = parseInt(input.getAttribute("data-game"), 10);
        var side = input.getAttribute("data-side");
        var val = Math.max(0, parseInt(input.value, 10) || 0);
        state.groupMatches[g][idx].games[gameIdx][side === "1" ? "a" : "b"] = val;
        saveState(state);
        renderAll();
      });
    });
  }

  function renderKnockoutMatch(slot, matchKey) {
    var p1 = slot.p1 ? getPlayer(slot.p1) : null;
    var p2 = slot.p2 ? getPlayer(slot.p2) : null;
    var label1 = p1 ? p1.flag + " " + p1.name : "TBD";
    var label2 = p2 ? p2.flag + " " + p2.name : "TBD";
    return '<div class="match-box' + (slot.winner ? " highlight" : "") + '">' +
      renderGameTable(matchKey, slot.games, label1, label2, !!slot.p1, !!slot.p2) +
    '</div>';
  }

  function renderBracket(bracket) {
    var container = document.getElementById("bracket-container");
    if (!container) return;

    var championHtml = "";
    if (bracket.final.winner) {
      var champ = getPlayer(bracket.final.winner);
      championHtml = '<div class="champion-banner">🏆 ' + champ.flag + " " + champ.name + " (" + champ.country + ") is the 2026 Singles Champion!" +
        (bracket.third.winner ? '<span class="sub">🥉 Third Place: ' + getPlayer(bracket.third.winner).flag + " " + getPlayer(bracket.third.winner).name + '</span>' : "") +
      '</div>';
    }

    var html = championHtml + '<div class="bracket">' +
      '<div class="bracket-round"><h4>Quarterfinals</h4>' +
        bracket.qf.map(function (slot, i) { return renderKnockoutMatch(slot, "qf" + i); }).join("") +
      '</div>' +
      '<div class="bracket-round"><h4>Semifinals</h4>' +
        bracket.sf.map(function (slot, i) { return renderKnockoutMatch(slot, "sf" + i); }).join("") +
      '</div>' +
      '<div class="bracket-round final-round"><h4>Final</h4>' +
        renderKnockoutMatch(bracket.final, "final") +
        '<div class="third-place-note">🥉 Third Place Match</div>' +
        renderKnockoutMatch(bracket.third, "third") +
      '</div>' +
    '</div>';

    container.innerHTML = html;

    container.querySelectorAll("input[data-match-key]").forEach(function (input) {
      input.addEventListener("input", function () {
        var key = input.getAttribute("data-match-key"); // qf0..qf3, sf0, sf1, final, third
        var gameIdx = parseInt(input.getAttribute("data-game"), 10);
        var side = input.getAttribute("data-side");
        var val = Math.max(0, parseInt(input.value, 10) || 0);
        var slot = key === "final" ? state.knockout.final : key === "third" ? state.knockout.third :
          key.indexOf("qf") === 0 ? state.knockout.qf[parseInt(key.slice(2), 10)] : state.knockout.sf[parseInt(key.slice(2), 10)];
        slot.games[gameIdx][side === "1" ? "a" : "b"] = val;
        saveState(state);
        renderAll();
      });
    });
  }

  function renderAll() {
    var bracket = computeBracket();
    renderGroups(bracket);
    renderBracket(bracket);
  }

  function resetAll() {
    if (!confirm("Reset all singles match results? This cannot be undone.")) return;
    state = defaultState();
    saveState(state);
    renderAll();
  }

  document.addEventListener("DOMContentLoaded", function () {
    var resetBtn = document.getElementById("reset-singles-btn");
    if (resetBtn) resetBtn.addEventListener("click", resetAll);
    renderAll();
  });
})();
