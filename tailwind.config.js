/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class', // reliable dark mode toggling
    content: [
        './entrypoints/**/*.{html,ts,tsx}',
        './components/**/*.{html,ts,tsx}',
        './shared/**/*.{html,ts,tsx}',
    ],
    theme: {
        extend: {
            colors: {
                zinc: {
                    50: '#fafafa',
                    100: '#f4f4f5',
                    200: '#e4e4e7',
                    800: '#27272a',
                    900: '#18181b',
                    950: '#09090b',
                },
                indigo: {
                    500: '#6366f1',
                    600: '#4f46e5',
                },
                emerald: {
                    500: '#10b981',
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            borderRadius: {
                'xl': '10px',
                'full': '9999px',
            },
            boxShadow: {
                sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
            },
            transitionProperty: {
                'all': 'all',
            },
            transitionDuration: {
                '200': '200ms',
            },
            transitionTimingFunction: {
                'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
            },
            letterSpacing: {
                tightest: '-0.02em',
            }
        },
    },
    plugins: [],
}
