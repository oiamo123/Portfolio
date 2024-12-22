/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  darkmode: "selector",
  theme: {
    extend: {
      scale: {
        // 175: "1.75",
        // 200: "2.00",
      },
    },
  },
  plugins: [],
};
