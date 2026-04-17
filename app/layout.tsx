import { Inter, Geist } from 'next/font/google'
import './globals.css'
import DevNavigator from './_components/DevNavigator'
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className={inter.className} suppressHydrationWarning>
        {children}
        <DevNavigator />
      </body>
    </html>
  )
}