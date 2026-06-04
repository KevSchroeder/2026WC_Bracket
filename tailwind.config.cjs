/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#060912', 2: '#0a0f22' },
        card: { DEFAULT: '#121a38', 2: '#0e1430', 3: '#161f44' },
        line: { DEFAULT: '#283260', soft: '#1d264b' },
        ink: '#eaf0ff',
        muted: { DEFAULT: '#94a2cc', 2: '#6b78a3' },
        accent: { DEFAULT: '#ff2e7e', 2: '#7b5cff', 3: '#19d8d8' },
        gold: '#ffce4a',
        silver: '#cfd9ee',
        bronze: '#e0a06a',
        green: { DEFAULT: '#2bed6b', dim: 'rgba(43,237,107,0.55)' },
      },
      backgroundImage: {
        'brand-grad': 'linear-gradient(135deg,#ff2e7e 0%,#7b5cff 52%,#19d8d8 100%)',
        'grad-soft': 'linear-gradient(135deg,rgba(255,46,126,.18),rgba(123,92,255,.16) 55%,rgba(25,216,216,.16))',
        'card-grad': 'linear-gradient(180deg,#121a38,#0e1430)',
        'bg-grad': 'linear-gradient(180deg,#0a0f22,#060912)',
      },
      fontFamily: {
        sora: ['Sora', 'Inter', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 18px 50px -18px rgba(0,0,0,.7)',
        glow: '0 10px 26px -10px rgba(123,92,255,.8)',
        'glow-green': '0 0 8px rgba(43,237,107,0.55)',
      },
      animation: {
        'won-flash': 'wonFlash 0.55s ease',
        'fill-in': 'fillIn 0.4s cubic-bezier(0.2,0.9,0.2,1)',
        'pick-pop': 'pickPop 0.42s cubic-bezier(0.2,1.4,0.4,1)',
        'view-in': 'viewIn 0.45s cubic-bezier(0.2,0.7,0.2,1)',
        'float': 'float 18s ease-in-out infinite',
        'champ-in': 'champIn 0.6s cubic-bezier(0.2,1.3,0.3,1)',
      },
      keyframes: {
        wonFlash: { '0%': { background: 'rgba(255,255,255,.5)' }, '100%': {} },
        fillIn: { from: { opacity: '0', transform: 'translateX(-6px)' }, to: { opacity: '1', transform: 'none' } },
        pickPop: { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.05)' }, '100%': { transform: 'scale(1)' } },
        viewIn: { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'none' } },
        float: { '0%,100%': { transform: 'translate(0,0) scale(1)' }, '50%': { transform: 'translate(30px,-26px) scale(1.08)' } },
        champIn: { from: { opacity: '0', transform: 'scale(.8) translateY(20px)' }, to: { opacity: '1', transform: 'none' } },
      },
    },
  },
  plugins: [],
}
