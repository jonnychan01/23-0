/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Bebas Neue'", "cursive"],
        mono:    ["'Share Tech Mono'", "monospace"],
        body:    ["'Barlow Condensed'", "sans-serif"],
      },
      colors: {
        pitch:  "#0a1a0f",
        turf:   "#0f2318",
        grass:  "#163020",
        gold:   "#f5c842",
        amber:  "#e8a020",
        chalk:  "#e8ede9",
        dim:    "#8a9e8d",
        red:    "#d94040",
        win:    "#3ecf6a",
      },
      keyframes: {
        reel: {
          "0%":   { transform: "translateY(0)" },
          "100%": { transform: "translateY(-100%)" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "50%":       { opacity: "0.85" },
        },
        reveal: {
          "0%":   { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scanline: {
          "0%":   { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
      },
      animation: {
        reel:     "reel 0.08s linear infinite",
        flicker:  "flicker 3s ease-in-out infinite",
        reveal:   "reveal 0.4s ease forwards",
        scanline: "scanline 4s linear infinite",
      },
    },
  },
  plugins: [],
};
