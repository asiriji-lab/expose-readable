import { Inter } from 'next/font/google'
import './globals.css'
import DevNavigator from './_components/DevNavigator'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning>
        {children}
        <DevNavigator />
      </body>
    </html>
  )
}