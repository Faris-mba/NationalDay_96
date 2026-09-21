import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        saudi: {
          50: "#e9f5ef",
          100: "#c7e6d6",
          300: "#5fb98c",
          500: "#0a8f4a",
          600: "#006C35",
          700: "#005528",
          800: "#00401e",
          900: "#002c14",
        },
        gold: {
          300: "#f4dd8f",
          400: "#e8c65c",
          500: "#D4AF37",
          600: "#b08f22",
        },
        falcons: "#0a8f4a",
        elite: "#E8B923",
        ink: "#04140b",
      },
      fontFamily: {
        sans: ["var(--font-arabic)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "score-pop": {
          "0%": { transform: "scale(1)" },
          "35%": { transform: "scale(1.35)", filter: "brightness(1.6)" },
          "100%": { transform: "scale(1)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(28px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.85)" },
          "70%": { transform: "scale(1.04)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(212,175,55,0.65)" },
          "100%": { boxShadow: "0 0 0 28px rgba(212,175,55,0)" },
        },
        "bar-grow": {
          "0%": { width: "0%" },
          "100%": { width: "var(--bar-w)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "score-pop": "score-pop 700ms ease-out",
        "slide-up": "slide-up 420ms ease-out both",
        "pop-in": "pop-in 380ms cubic-bezier(.2,.9,.3,1.3) both",
        "pulse-ring": "pulse-ring 1.4s ease-out infinite",
        "bar-grow": "bar-grow 900ms cubic-bezier(.2,.8,.3,1) both",
        shimmer: "shimmer 2.6s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
