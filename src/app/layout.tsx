import type { Metadata } from 'next';
import { Zen_Maru_Gothic, Noto_Sans_JP } from 'next/font/google';
import '@/styles/globals.css';
import { Providers } from './providers';

const zenMaru = Zen_Maru_Gothic({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-zen-maru',
});

const notoSansJP = Noto_Sans_JP({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-noto-sans-jp',
});

export const metadata: Metadata = {
  title: '🆙chan Token Claimer',
  description: 'Claim your 🆙chan tokens on LUKSO',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={`${zenMaru.variable} ${notoSansJP.variable}`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
