/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#080A0E",
        surface: "#0E121A",
        elevated: "#141A24",
        border: "#1E2638",
        subtle: "#151B26",
        bullish: "#10B981",
        bearish: "#EF4444",
        accent: "#3B82F6",
      },
    },
  },
  plugins: [],
}
