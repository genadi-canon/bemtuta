import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["var(--font-rubik)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
