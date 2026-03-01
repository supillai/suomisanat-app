/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#10243A",
        mist: "#F6FBFF",
        accent: "#0C8F8F",
        sun: "#FDBA41"
      }
    }
  },
  plugins: []
};