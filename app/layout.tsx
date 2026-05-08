import { IBM_Plex_Sans } from 'next/font/google';
import './globals.css';
import { cn } from "@/lib/utils";
import { ClerkProvider } from '@clerk/nextjs';

const ibmPlexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-sans' });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider dynamic>
      <html lang="en" className={cn("font-sans", ibmPlexSans.variable)}>
        <body className="antialiased" suppressHydrationWarning>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}