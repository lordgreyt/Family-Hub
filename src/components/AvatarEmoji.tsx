import React, { useId, useState } from 'react';
import { getAnimatedEmojiUrl } from '../utils/emoji';
import { STUDIO_AVATAR_BY_ID, getMonogramText, isMonogramAvatar, isPhotoAvatar } from '../data/avatars';
import type { ArtAvatarId } from '../data/avatars';

interface AvatarEmojiProps {
  emoji: string;
  size?: number;
  style?: React.CSSProperties;
}

const ArtAvatarSvg: React.FC<{ artId: ArtAvatarId; size: number; style?: React.CSSProperties }> = ({ artId, size, style }) => {
  const rawId = useId();
  const id = `av${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const content = (() => {
    switch (artId) {
      case 'berge':
        return (
          <>
            <defs>
              <linearGradient id={`${id}sky`} x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#3529B8" />
                <stop offset="48%" stopColor="#856FF0" />
                <stop offset="82%" stopColor="#F2A9BE" />
                <stop offset="100%" stopColor="#FCD0B1" />
              </linearGradient>
              <radialGradient id={`${id}sun`} cx="60" cy="46" r="24" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFF5E1" />
                <stop offset="65%" stopColor="#FCD3A8" />
                <stop offset="100%" stopColor="#F5A06B" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${id}m1`} x1="60" y1="54" x2="60" y2="120" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#5C4CD8" />
                <stop offset="100%" stopColor="#281F78" />
              </linearGradient>
              <linearGradient id={`${id}m2`} x1="60" y1="68" x2="60" y2="120" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#3B2FA8" />
                <stop offset="100%" stopColor="#171247" />
              </linearGradient>
            </defs>
            <rect width="120" height="120" fill={`url(#${id}sky)`} />
            <circle cx="60" cy="46" r="24" fill={`url(#${id}sun)`} />
            <circle cx="60" cy="46" r="13" fill="#FFF4E0" fillOpacity="0.92" />
            <path d="M-8 120L36 58L66 86L92 54L128 120Z" fill={`url(#${id}m1)`} />
            <path d="M36 58L49 70L36 74L27 69Z" fill="#E8DFFF" fillOpacity="0.45" />
            <path d="M92 54L103 68L91 71L82 65Z" fill="#FFE0CF" fillOpacity="0.5" />
            <path d="M-10 120L24 80L56 98L84 72L130 120Z" fill={`url(#${id}m2)`} />
            <path d="M-10 120L46 92L78 106L128 90V120Z" fill="#17143A" fillOpacity="0.72" />
          </>
        );

      case 'prisma':
        return (
          <>
            <defs>
              <linearGradient id={`${id}bg`} x1="10" y1="8" x2="112" y2="114" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#EDE9FF" />
                <stop offset="55%" stopColor="#F5E6F5" />
                <stop offset="100%" stopColor="#FCE7DA" />
              </linearGradient>
              <linearGradient id={`${id}ring`} x1="22" y1="22" x2="96" y2="96" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#4334C8" />
                <stop offset="50%" stopColor="#7C6DF7" />
                <stop offset="100%" stopColor="#F2A9BE" />
              </linearGradient>
              <radialGradient id={`${id}orb`} cx="72" cy="46" r="26" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFF5EB" />
                <stop offset="45%" stopColor="#F9C09F" />
                <stop offset="100%" stopColor="#E87A96" />
              </radialGradient>
            </defs>
            <rect width="120" height="120" fill={`url(#${id}bg)`} />
            <circle cx="52" cy="64" r="32" stroke={`url(#${id}ring)`} strokeWidth="14" fill="none" />
            <circle cx="72" cy="48" r="21" fill={`url(#${id}orb)`} />
            <ellipse cx="66" cy="41" rx="7" ry="4.5" transform="rotate(-25 66 41)" fill="#FFFFFF" fillOpacity="0.55" />
            <path d="M24 64A32 32 0 0 1 56 32" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.65" />
          </>
        );

      case 'kosmos':
        return (
          <>
            <defs>
              <radialGradient id={`${id}space`} cx="45" cy="38" r="88" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#3B2FB5" />
                <stop offset="52%" stopColor="#1D1756" />
                <stop offset="100%" stopColor="#0E0B2B" />
              </radialGradient>
              <linearGradient id={`${id}planet`} x1="36" y1="34" x2="86" y2="86" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#9B86F4" />
                <stop offset="55%" stopColor="#5242D4" />
                <stop offset="100%" stopColor="#261C78" />
              </linearGradient>
              <linearGradient id={`${id}orbit`} x1="14" y1="74" x2="106" y2="46" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FCD9A8" stopOpacity="0.95" />
                <stop offset="50%" stopColor="#F2A9BE" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.7" />
              </linearGradient>
            </defs>
            <rect width="120" height="120" fill={`url(#${id}space)`} />
            <circle cx="24" cy="28" r="1.5" fill="#FFFFFF" fillOpacity="0.8" />
            <circle cx="94" cy="24" r="1.8" fill="#FFD68A" fillOpacity="0.85" />
            <circle cx="88" cy="92" r="1.4" fill="#FFFFFF" fillOpacity="0.65" />
            <circle cx="28" cy="90" r="1.2" fill="#C7B6F7" fillOpacity="0.75" />
            <circle cx="60" cy="60" r="26" fill={`url(#${id}planet)`} />
            <ellipse cx="60" cy="60" rx="46" ry="13" transform="rotate(-18 60 60)" stroke={`url(#${id}orbit)`} strokeWidth="4.5" fill="none" />
            <path d="M36 52A26 26 0 0 1 82 47" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeOpacity="0.35" />
          </>
        );

      case 'aurora':
        return (
          <>
            <defs>
              <linearGradient id={`${id}bg`} x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#12183B" />
                <stop offset="55%" stopColor="#1C3463" />
                <stop offset="100%" stopColor="#122240" />
              </linearGradient>
              <linearGradient id={`${id}rib1`} x1="10" y1="20" x2="110" y2="85" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#4FC3A1" stopOpacity="0.9" />
                <stop offset="55%" stopColor="#6CE5C5" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#6D5DF0" stopOpacity="0.85" />
              </linearGradient>
              <linearGradient id={`${id}rib2`} x1="15" y1="35" x2="105" y2="95" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#8B7DF8" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#4FC3A1" stopOpacity="0.65" />
              </linearGradient>
            </defs>
            <rect width="120" height="120" fill={`url(#${id}bg)`} />
            <path d="M-8 66C18 32 48 80 76 42C96 15 112 28 128 22V68C104 82 78 58 52 84C28 106 8 86 -8 92Z" fill={`url(#${id}rib1)`} />
            <path d="M-6 86C24 60 56 96 86 64C104 46 116 52 128 48V120H-6Z" fill={`url(#${id}rib2)`} fillOpacity="0.55" />
            <path d="M-4 120L32 88L62 104L92 84L126 120Z" fill="#0D1330" />
            <circle cx="88" cy="24" r="1.6" fill="#FFFFFF" fillOpacity="0.85" />
            <circle cx="34" cy="22" r="1.3" fill="#A6F5DC" fillOpacity="0.8" />
          </>
        );

      case 'duene':
        return (
          <>
            <defs>
              <linearGradient id={`${id}sky`} x1="60" y1="0" x2="60" y2="120" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FCE7D6" />
                <stop offset="55%" stopColor="#F9C1A2" />
                <stop offset="100%" stopColor="#E48175" />
              </linearGradient>
              <linearGradient id={`${id}d1`} x1="0" y1="64" x2="120" y2="120" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#E88B63" />
                <stop offset="100%" stopColor="#B84F5E" />
              </linearGradient>
              <linearGradient id={`${id}d2`} x1="0" y1="80" x2="120" y2="120" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#9A3E5D" />
                <stop offset="100%" stopColor="#3A2563" />
              </linearGradient>
            </defs>
            <rect width="120" height="120" fill={`url(#${id}sky)`} />
            <circle cx="60" cy="48" r="19" fill="#FFF7EA" fillOpacity="0.92" />
            <path d="M-8 84C24 64 58 68 88 80C104 86 116 82 128 76V120H-8Z" fill={`url(#${id}d1)`} />
            <path d="M-8 100C28 84 68 102 104 88C114 84 122 86 128 88V120H-8Z" fill={`url(#${id}d2)`} />
          </>
        );
    }
  })();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ width: '100%', height: '100%', display: 'block', ...style }}
    >
      {content}
    </svg>
  );
};

/**
 * Renders a user's profile avatar:
 * - Studio portrait / animal / art image (`avatar:*`)
 * - Editorial vector art (`art:*`)
 * - Uploaded personal photo (`data:image/*`)
 * - Typographic monogram (`monogram:*`)
 * - Legacy emoji fallback (for existing users prior to switching)
 */
export const AvatarEmoji = ({ emoji, size = 42, style }: AvatarEmojiProps) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  // 1. Curated studio image or art avatar
  const studio = emoji ? STUDIO_AVATAR_BY_ID[emoji] : undefined;
  if (studio) {
    if (studio.kind === 'art' && studio.artId) {
      return <ArtAvatarSvg artId={studio.artId} size={size} style={style} />;
    }
    if (studio.src && failedSrc !== studio.src) {
      return (
        <img
          key={studio.src}
          src={studio.src}
          alt={studio.label}
          width={size}
          height={size}
          onError={() => setFailedSrc(studio.src!)}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            objectFit: 'cover',
            ...style,
          }}
        />
      );
    }
    // Safe fallback if a studio image ever fails to load (never render raw "avatar:..." id as text)
    return (
      <span
        aria-label={studio.label}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          fontWeight: 800,
          fontSize: `${Math.max(10, Math.round(size * 0.38))}px`,
          lineHeight: 1,
          ...style,
        }}
      >
        {studio.label.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  // 2. Uploaded personal photo (Data URL)
  if (isPhotoAvatar(emoji)) {
    return (
      <img
        src={emoji}
        alt="Profilbild"
        width={size}
        height={size}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          objectFit: 'cover',
          ...style,
        }}
      />
    );
  }

  // 3. Pro typographic monogram
  if (isMonogramAvatar(emoji)) {
    const letters = getMonogramText(emoji);
    const fontSize = Math.max(10, Math.round(size * (letters.length > 1 ? 0.39 : 0.48)));
    return (
      <span
        aria-label={`Initialen ${letters}`}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          fontWeight: 800,
          fontSize: `${fontSize}px`,
          letterSpacing: '-0.03em',
          lineHeight: 1,
          userSelect: 'none',
          background: 'radial-gradient(circle at 28% 22%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 60%)',
          textShadow: '0 1px 4px rgba(23,20,58,0.22)',
          ...style,
        }}
      >
        {letters}
      </span>
    );
  }

  // 4. Legacy emoji fallback (animated GIF or character)
  const animatedUrl = getAnimatedEmojiUrl(emoji);
  const imgSize = Math.round(size * 0.75);

  if (animatedUrl && failedSrc !== animatedUrl) {
    return (
      <img
        key={animatedUrl}
        src={animatedUrl}
        alt={emoji}
        width={imgSize}
        height={imgSize}
        loading="lazy"
        onError={() => setFailedSrc(animatedUrl)}
        style={{
          display: 'block',
          objectFit: 'contain',
          ...style,
        }}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={emoji}
      className={failedSrc === animatedUrl ? 'avatar-emoji-animated' : undefined}
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
