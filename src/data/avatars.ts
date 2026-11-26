export interface StudioAvatarOption {
  id: string;
  label: string;
  kind: 'image' | 'art';
  src?: string;
  artId?: ArtAvatarId;
  accent: string;
}

export type ArtAvatarId = 'berge' | 'kosmos' | 'prisma' | 'aurora' | 'duene';

export interface StudioAvatarCategory {
  id: 'portraits' | 'animals' | 'art';
  label: string;
  items: StudioAvatarOption[];
}

export const STUDIO_AVATAR_CATEGORIES: StudioAvatarCategory[] = [
  {
    id: 'portraits',
    label: 'Portraits',
    items: [
      { id: 'avatar:papa', label: 'Klassisch', kind: 'image', src: '/avatars/papa.jpg', accent: '#6D5DF0' },
      { id: 'avatar:mann', label: 'Sportlich', kind: 'image', src: '/avatars/mann.jpg', accent: '#4B8DFF' },
      { id: 'avatar:mama', label: 'Warm', kind: 'image', src: '/avatars/mama.jpg', accent: '#F5A06B' },
      { id: 'avatar:frau', label: 'Modern', kind: 'image', src: '/avatars/frau.jpg', accent: '#F27A9B' },
      { id: 'avatar:junge', label: 'Junior', kind: 'image', src: '/avatars/junge.jpg', accent: '#5A7BF5' },
      { id: 'avatar:maedchen', label: 'Kreativ', kind: 'image', src: '/avatars/maedchen.jpg', accent: '#4FC3A1' },
    ],
  },
  {
    id: 'animals',
    label: 'Tiere',
    items: [
      { id: 'avatar:fuchs', label: 'Fuchs', kind: 'image', src: '/avatars/fuchs.jpg', accent: '#E87A48' },
      { id: 'avatar:wolf', label: 'Wolf', kind: 'image', src: '/avatars/wolf.jpg', accent: '#64748B' },
      { id: 'avatar:eule', label: 'Eule', kind: 'image', src: '/avatars/eule.jpg', accent: '#5B4BE0' },
      { id: 'avatar:katze', label: 'Katze', kind: 'image', src: '/avatars/katze.jpg', accent: '#E58A9E' },
      { id: 'avatar:loewe', label: 'Löwe', kind: 'image', src: '/avatars/loewe.jpg', accent: '#C87D4B' },
    ],
  },
  {
    id: 'art',
    label: 'Natur & Kunst',
    items: [
      { id: 'avatar:welle', label: 'Ozean', kind: 'image', src: '/avatars/welle.jpg', accent: '#20BFA9' },
      { id: 'art:berge', label: 'Alpenglühen', kind: 'art', artId: 'berge', accent: '#5A4BE0' },
      { id: 'art:prisma', label: 'Prisma', kind: 'art', artId: 'prisma', accent: '#6D5DF0' },
      { id: 'art:kosmos', label: 'Kosmos', kind: 'art', artId: 'kosmos', accent: '#31268E' },
      { id: 'art:aurora', label: 'Nordlicht', kind: 'art', artId: 'aurora', accent: '#1E9A78' },
      { id: 'art:duene', label: 'Abendgold', kind: 'art', artId: 'duene', accent: '#E8835B' },
    ],
  },
];

export const ALL_STUDIO_AVATARS: StudioAvatarOption[] = STUDIO_AVATAR_CATEGORIES.flatMap(c => c.items);

export const STUDIO_AVATAR_BY_ID: Record<string, StudioAvatarOption> = Object.fromEntries(
  ALL_STUDIO_AVATARS.map(a => [a.id, a])
);

export const ONBOARDING_AVATARS: StudioAvatarOption[] = [
  STUDIO_AVATAR_BY_ID['avatar:papa'],
  STUDIO_AVATAR_BY_ID['avatar:mama'],
  STUDIO_AVATAR_BY_ID['avatar:mann'],
  STUDIO_AVATAR_BY_ID['avatar:frau'],
  STUDIO_AVATAR_BY_ID['avatar:junge'],
  STUDIO_AVATAR_BY_ID['avatar:maedchen'],
  STUDIO_AVATAR_BY_ID['avatar:fuchs'],
  STUDIO_AVATAR_BY_ID['avatar:wolf'],
  STUDIO_AVATAR_BY_ID['avatar:welle'],
  STUDIO_AVATAR_BY_ID['art:berge'],
].filter(Boolean);

export const STUDIO_GRADIENTS: { id: string; label: string; value: string; solid: string }[] = [
  { id: 'indigo', label: 'Indigo Iris', value: 'linear-gradient(135deg, #3A2FC0 0%, #6D5DF0 60%, #A995F7 100%)', solid: '#6D5DF0' },
  { id: 'sunset', label: 'Lila Pfirsich', value: 'linear-gradient(135deg, #4B3CD6 0%, #B48BF2 52%, #F7B69B 100%)', solid: '#9B86F4' },
  { id: 'midnight', label: 'Mitternacht', value: 'linear-gradient(135deg, #17143A 0%, #342B87 60%, #5B4EE0 100%)', solid: '#342B87' },
  { id: 'ocean', label: 'Ozean', value: 'linear-gradient(135deg, #1E6BE0 0%, #4B8DFF 55%, #6AD7C4 100%)', solid: '#4B8DFF' },
  { id: 'mint', label: 'Salbei Mint', value: 'linear-gradient(135deg, #178668 0%, #4FC3A1 65%, #9AE7CF 100%)', solid: '#4FC3A1' },
  { id: 'rose', label: 'Rosé', value: 'linear-gradient(135deg, #C73E6E 0%, #F27A9B 60%, #F9C0A6 100%)', solid: '#F27A9B' },
  { id: 'copper', label: 'Kupfer', value: 'linear-gradient(135deg, #C95B3C 0%, #F5A06B 60%, #FAD6A5 100%)', solid: '#F5A06B' },
  { id: 'slate', label: 'Schiefer', value: 'linear-gradient(135deg, #2B3347 0%, #525E7A 60%, #8A96B0 100%)', solid: '#525E7A' },
];

export function extractInitials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'FH';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function isPhotoAvatar(avatar?: string): boolean {
  return Boolean(avatar && avatar.startsWith('data:image/'));
}

export function isMonogramAvatar(avatar?: string): boolean {
  return Boolean(avatar && avatar.startsWith('monogram:'));
}

export function getMonogramText(avatar: string): string {
  return avatar.replace(/^monogram:/, '').trim().slice(0, 2).toUpperCase() || 'FH';
}

/**
 * Crops an uploaded image file to a centered square and compresses it into a lightweight JPEG Data URL
 * suitable for storing directly in Firebase Realtime Database user profiles.
 */
export function compressImageFileToAvatarDataUrl(file: File, targetSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Bildformat wird nicht unterstützt.'));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;

        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas nicht verfügbar.'));
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, side, side, 0, 0, targetSize, targetSize);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
