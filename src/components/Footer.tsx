'use client';

import { profileUrl } from '@/config/tokens';
import { EmojiText } from './EmojiText';

export function Footer() {
  return (
    <footer className="app-footer">
      <EmojiText>Made with ♥ by</EmojiText>
      <a href={profileUrl('0xbcA4eEBea76926c49C64AB86A527CC833eFa3B2D')}
         target="_blank" className="link"
         style={{ display: 'inline-flex', alignItems: 'center' }}>
        <EmojiText>🆙chan</EmojiText>
      </a>
      <span style={{ color: 'var(--c-text-muted)', fontSize: 10 }}>|</span>
      <a href="https://x.com/UPchan_lyx" target="_blank" className="link"
         style={{ display: 'inline-flex', alignItems: 'center' }}>
        <svg viewBox="0 0 24 24" width={9} height={9} fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </a>
    </footer>
  );
}
