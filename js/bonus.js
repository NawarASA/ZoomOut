// The "Bonus round: 4K" card on the end screen. The game itself is its own page (4k.html, js/4k.js).
import { boardFor, store, scoreOf, tier, MAX } from "./4k-core.js";

const $ = id => document.getElementById(id);

// game.js: today's daily puzzle is finished and its end screen is showing.
addEventListener("zoomout:daily-end-shown", ({ detail }) => {
  const board = boardFor(detail.date), state = store.get().boards[detail.date];
  $("bonus-card-text").textContent = state?.done ? `You shot it in ${tier(scoreOf(board, state) / MAX)}. See your result.` : board.question;
  $("bonus-open").textContent = state?.done ? "See result" : "Play 4K";
  $("bonus-open").href = "4k.html" + location.search; // keeps Discord's Activity details in the address
  $("bonus-card").hidden = false;
});
