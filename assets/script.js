document.addEventListener("DOMContentLoaded", function () {
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");

  if (toggle && links) {
    toggle.addEventListener("click", function () {
      links.classList.toggle("open");
    });
  }

  var countdownEl = document.querySelector("[data-countdown-days]");
  if (countdownEl) {
    var target = new Date("2026-08-08T09:00:00");
    var now = new Date();
    var diffDays = Math.max(0, Math.ceil((target - now) / (1000 * 60 * 60 * 24)));
    countdownEl.textContent = diffDays;
  }
});
