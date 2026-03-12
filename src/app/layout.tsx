import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ChatFlow',
  description: 'Central interna de atendimento com PostgreSQL, API propria e Evolution API.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

