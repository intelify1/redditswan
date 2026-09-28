// Fonts are bundled from npm (@fontsource) so rendering never depends on a network font CDN.
import "@fontsource/montserrat/800.css";
import "@fontsource/montserrat/900.css";
import "@fontsource/arimo/400.css"; // Arial-metric-compatible, matches the reference card
import "@fontsource/arimo/700.css";
import { continueRender, delayRender } from "remotion";

const handle = delayRender("Loading fonts");
Promise.all([
  document.fonts.load('900 80px "Montserrat"'),
  document.fonts.load('800 80px "Montserrat"'),
  document.fonts.load('700 40px "Arimo"'),
  document.fonts.load('400 40px "Arimo"'),
  document.fonts.load('400 40px "Noto Color Emoji"', "🏆🥇💎🔥😂🤯🎖️🏅"),
])
  .then(() => continueRender(handle))
  .catch((e) => {
    console.error("Font load failed", e);
    continueRender(handle);
  });

export const CAPTION_FONT = '"Montserrat", sans-serif';
export const CARD_FONT = '"Arimo", sans-serif';
