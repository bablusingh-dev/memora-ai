import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'Memora AI | Notebook LLM Alternative',
  description: 'Production-grade Notebook LLM alternative with Vectorless ParadeDB BM25 Search & Clerk Auth',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <body className="antialiased bg-background text-foreground min-h-screen">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
