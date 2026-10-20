import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lazarus',
  description: 'Interactive documentation and software execution',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className="antialiased bg-[var(--color-surface-page)] text-[var(--color-text-primary)]">
        {children}
      </body>
    </html>
  );
}
