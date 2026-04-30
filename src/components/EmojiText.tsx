'use client';

import { ReactNode } from 'react';
import { FC } from 'react';

// Fluent UI Emoji (Flat style) — lazy import from react-fluentui-emoji
import IconFLollipop from 'react-fluentui-emoji/lib/flat/icons/IconFLollipop';
import IconFCandy from 'react-fluentui-emoji/lib/flat/icons/IconFCandy';
import IconFUnicorn from 'react-fluentui-emoji/lib/flat/icons/IconFUnicorn';
import IconFRabbitFace from 'react-fluentui-emoji/lib/flat/icons/IconFRabbitFace';
import IconFCatFace from 'react-fluentui-emoji/lib/flat/icons/IconFCatFace';
import IconFRedHeart from 'react-fluentui-emoji/lib/flat/icons/IconFRedHeart';
import IconFUpButton from 'react-fluentui-emoji/lib/flat/icons/IconFUpButton';

interface EmojiComponentProps {
  size?: string;
  className?: string;
}

const EMOJI_MAP: Record<string, FC<EmojiComponentProps>> = {
  '🍭': IconFLollipop,
  '🍬': IconFCandy,
  '🦄': IconFUnicorn,
  '🐰': IconFRabbitFace,
  '🐱': IconFCatFace,
  '♥': IconFRedHeart,
  '❤': IconFRedHeart,
  '🆙': IconFUpButton,
};

interface Props {
  children: string;
  className?: string;
}

/**
 * Renders emoji characters as Fluent UI Emoji SVGs.
 * Only handles the 5 section emoji used in this app.
 * Non-emoji text is rendered as normal text.
 */
export function EmojiText({ children, className }: Props) {
  const parts: ReactNode[] = [];
  let remaining = children;

  while (remaining.length > 0) {
    const cp = remaining.codePointAt(0);
    if (!cp) break;

    const char = String.fromCodePoint(cp);
    const Icon = EMOJI_MAP[char];

    if (Icon) {
      parts.push(<Icon key={`e${parts.length}`} size="1em" className="emoji-fluent" />);
      remaining = remaining.slice(char.length);
    } else {
      // Consume until next emoji
      let i = 1;
      while (i < remaining.length) {
        const nextCP = remaining.codePointAt(i);
        if (nextCP && EMOJI_MAP[String.fromCodePoint(nextCP)]) break;
        i += (nextCP && nextCP > 0xFFFF) ? 2 : 1;
      }
      parts.push(<span key={`t${parts.length}`}>{remaining.slice(0, i)}</span>);
      remaining = remaining.slice(i);
    }
  }

  return <span className={className}>{parts}</span>;
}
