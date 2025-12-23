import { Playfair_Display, Inter } from 'next/font/google'

export const serif = Playfair_Display({ 
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
})

export const sans = Inter({ 
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

