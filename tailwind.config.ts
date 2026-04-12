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
          DEFAULT: "#559A32",
          light: "#7EF54B",
          dark: "#305D1D",
        },
        secondary: {
          DEFAULT: "#DAAF76",
          light: "#F0E6C8",
          dark: "#8D714C",
        },
        accent: {
          DEFAULT: "#F55705",
          light: "#FFD5A1",
          dark: "#8A6A41",
        },
        highlight: "#F55705",
        header: "#192E0F",
        success: "#16A34A",
        warning: "#EAB308",
        error: "#DC2626",
        fav: {
          DEFAULT: "#EC4899",
          light: "#FDF2F8",
          border: "#FBCFE8",
          text: "#DB2777",
          "match-bg": "#F3DFE8",
          "match-border": "#EDCFE4",
        },
        background: "#DDF7CA",
        surface: "#FFFEFC",
        text: {
          DEFAULT: "#335C1E",
          light: "#4e8e2c",
          muted: "#537649",
        },
      },
      fontFamily: {
        // https://fonts.google.com/specimen/Nunito
        sans: ["Nunito", "system-ui", "-apple-system", "sans-serif"],
        // https://fonts.google.com/specimen/Fredoka
        display: ["Fredoka", "system-ui", "sans-serif"],
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
