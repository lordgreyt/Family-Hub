import { useState } from 'react';
import { getAnimatedEmojiUrl } from '../utils/emoji';

interface AvatarEmojiProps {
  emoji: string;
  size?: number;
  style?: React.CSSProperties;
}

/**
 * Renders an emoji avatar. Prefers the animated GIF from local /emojis/.
 * Falls back to a CSS-animated emoji character if the image can't be loaded.
 */
export const AvatarEmoji = ({ emoji, size = 42, style }: AvatarEmojiProps) => {
  const [imgFailed, setImgFailed] = useState(false);
  const animatedUrl = getAnimatedEmojiUrl(emoji);
  const imgSize = Math.round(size * 0.75);

  // Try animated GIF first
  if (animatedUrl && !imgFailed) {
    return (
      <img
        src={animatedUrl}
        alt={emoji}
        width={imgSize}
        height={imgSize}
        loading="lazy"
        onError={() => setImgFailed(true)}
        style={{
          display: 'block',
          objectFit: 'contain',
          ...style,
        }}
      />
    );
  }

  // Fallback: CSS-animated emoji character
  return (
    <span
      role="img"
      aria-label={emoji}
      className={imgFailed ? 'avatar-emoji-animated' : undefined}
      style={{
        fontSize: `${size * 0.55}px`,
        lineHeight: 1,
        ...style,
      }}
    >
      {emoji}
    </span>
  );
};
