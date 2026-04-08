import type { Config } from "tailwindcss";

export default {
  content: [
    "./components/**/*.vue",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./composables/**/*.ts",
    "./app.vue",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#59aa35",
          light: "#7ef54b",
          dark: "#305d1d",
        },
        secondary: {
          DEFAULT: "#a8ed89",
          light: "#c0f0a8",
          dark: "#6bbf4a",
        },
        accent: {
          DEFAULT: "#d7a566",
          light: "#ffd5a1",
          dark: "#8a6a41",
        },
        highlight: "#f45201",
        header: "#1e1e1e",
        success: "#16A34A",
        warning: "#EAB308",
        error: "#DC2626",
        fav: {
          DEFAULT: "#EC4899",
          light: "#FDF2F8",
          border: "#FBCFE8",
          text: "#DB2777",
          "match-bg": "#F8F1F6",
          "match-border": "#EDCFE4",
        },
        background: "#dcffce",
        surface: "#FFFFFF",
        text: {
          DEFAULT: "#3d6e24",
          light: "#488a27",
          muted: "#547c3f",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      fontSize: {
        display: ["2.25rem", { lineHeight: "2.5rem", fontWeight: "700" }],
        heading: ["1.5rem", { lineHeight: "2rem", fontWeight: "600" }],
        subheading: ["1.125rem", { lineHeight: "1.75rem", fontWeight: "600" }],
      },
      spacing: {
        "18": "4.5rem",
        "88": "22rem",
      },
      borderRadius: {
        DEFAULT: "0.5rem",
      },
      maxWidth: {
        content: "1366px",
      },
    },
  },
  plugins: [],
} satisfies Config;
