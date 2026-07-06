/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['var(--font-sans)', 'sans-serif'],
                display: ['var(--font-display)', 'sans-serif'],
            },
            colors: {
                volt: {
                    50: '#f9feb7',
                    100: '#f2fd85',
                    200: '#ebfa57',
                    300: '#bef264', // Electric Lime
                    400: '#a3e635',
                    500: '#84cc16',
                    600: '#65a30d',
                },
                cyber: {
                    950: '#040405', // Deep terminal black
                    900: '#0c0d0f', // Dark gray card
                    800: '#181a1f', // Soft dark border
                    700: '#2b2e36', // Hover border
                }
            }
        },
    },
    plugins: [],
}
