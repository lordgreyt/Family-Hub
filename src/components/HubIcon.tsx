import React, { useId } from 'react';

export type HubIconName =
  | 'home'
  | 'tasks'
  | 'grades'
  | 'vocab'
  | 'n26'
  | 'shopping'
  | 'pantry'
  | 'packlist'
  | 'holiday'
  | 'expenses'
  | 'surgery'
  | 'budget'
  | 'smarthome'
  | 'stars'
  | 'setup'
  | 'depot_haus'
  | 'depot_strom'
  | 'depot_urlaub'
  | 'depot_auto'
  | 'depot_notgroschen'
  | 'depot_steuer'
  | 'depot_geschenke'
  | 'depot_kinder'
  | 'depot_technik'
  | 'depot_garten'
  | 'depot_hund'
  | 'depot_kleidung'
  | 'depot_sparen'
  | 'cat_essen'
  | 'cat_handwerk'
  | 'cat_hygiene'
  | 'cat_sport'
  | 'cat_unterhaltung'
  | 'cat_waki'
  | 'alert'
  | 'history'
  | 'weekly_stars'
  | 'flame';

interface HubIconProps {
  name: HubIconName;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const BgSquircle = ({ id, c1, c2 }: { id: string; c1: string; c2: string }) => (
  <>
    <defs>
      <linearGradient id={`${id}bg`} x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
        <stop stopColor={c1} stopOpacity="0.22" />
        <stop offset="1" stopColor={c2} stopOpacity="0.08" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="44" height="44" rx="14" fill={`url(#${id}bg)`} />
  </>
);

function renderIconContent(name: HubIconName, id: string): React.ReactNode {
  switch (name) {
    /* ── 1. NAVIGATION & MODULE ─────────────────────────────────────────── */
    case 'home':
      return (
        <>
          <BgSquircle id={id} c1="#6D5DF0" c2="#F2A9BE" />
          <defs>
            <linearGradient id={`${id}a`} x1="10" y1="10" x2="38" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="#7B6CF8" />
              <stop offset="1" stopColor="#3F34C4" />
            </linearGradient>
            <linearGradient id={`${id}b`} x1="18" y1="24" x2="30" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFD8B8" />
              <stop offset="1" stopColor="#F2A9BE" />
            </linearGradient>
          </defs>
          <path d="M10 22.5L24 11L38 22.5V36C38 37.66 36.66 39 35 39H13C11.34 39 10 37.66 10 36V22.5Z" fill={`url(#${id}a)`} />
          <path d="M7.5 23.5L22.4 11.2C23.33 10.43 24.67 10.43 25.6 11.2L40.5 23.5" stroke="#3F34C4" strokeWidth="3.2" strokeLinecap="round" />
          <rect x="19.5" y="25.5" width="9" height="13.5" rx="4.5" fill={`url(#${id}b)`} />
          <circle cx="24" cy="19.5" r="2.6" fill="#FFFFFF" fillOpacity="0.85" />
        </>
      );

    case 'tasks':
      return (
        <>
          <BgSquircle id={id} c1="#6D5DF0" c2="#4FC3A1" />
          <defs>
            <linearGradient id={`${id}a`} x1="12" y1="9" x2="36" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#7E70FA" />
              <stop offset="1" stopColor="#483AD2" />
            </linearGradient>
            <linearGradient id={`${id}b`} x1="25" y1="25" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#5ED8B3" />
              <stop offset="1" stopColor="#1E9A78" />
            </linearGradient>
          </defs>
          <rect x="11" y="10" width="23" height="29" rx="6" fill={`url(#${id}a)`} />
          <rect x="17" y="7" width="11" height="5.5" rx="2.75" fill="#C7B6F7" />
          <rect x="16" y="18" width="12" height="2.6" rx="1.3" fill="#FFFFFF" fillOpacity="0.75" />
          <rect x="16" y="24" width="9" height="2.6" rx="1.3" fill="#FFFFFF" fillOpacity="0.5" />
          <circle cx="33" cy="33" r="8.5" fill={`url(#${id}b)`} stroke="#FFFFFF" strokeWidth="2" />
          <path d="M29.4 33.2L31.9 35.7L36.8 30.5" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );

    case 'grades':
      return (
        <>
          <BgSquircle id={id} c1="#4B8DFF" c2="#6D5DF0" />
          <defs>
            <linearGradient id={`${id}a`} x1="8" y1="14" x2="40" y2="32" gradientUnits="userSpaceOnUse">
              <stop stopColor="#5EA0FF" />
              <stop offset="1" stopColor="#3F34C4" />
            </linearGradient>
          </defs>
          <path d="M14 24.5V32.5C14 35.5 18.5 37.5 24 37.5C29.5 37.5 34 35.5 34 32.5V24.5L24 29L14 24.5Z" fill="#6D5DF0" fillOpacity="0.8" />
          <path d="M24 12L40 19.5L24 27L8 19.5L24 12Z" fill={`url(#${id}a)`} />
          <path d="M37 21V31" stroke="#FF9F2D" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="37" cy="32.5" r="2.6" fill="#FFD66B" />
        </>
      );

    case 'vocab':
      return (
        <>
          <BgSquircle id={id} c1="#4B8DFF" c2="#A68BF0" />
          <defs>
            <linearGradient id={`${id}a`} x1="9" y1="11" x2="29" y2="29" gradientUnits="userSpaceOnUse">
              <stop stopColor="#69A7FF" />
              <stop offset="1" stopColor="#3A74E8" />
            </linearGradient>
            <linearGradient id={`${id}b`} x1="20" y1="21" x2="39" y2="39" gradientUnits="userSpaceOnUse">
              <stop stopColor="#9A8AF8" />
              <stop offset="1" stopColor="#5B4BE0" />
            </linearGradient>
          </defs>
          <rect x="8" y="10" width="22" height="18" rx="6" fill={`url(#${id}a)`} />
          <path d="M13 27L11 32L17 28" fill="#3A74E8" />
          <rect x="18" y="20" width="22" height="18" rx="6" fill={`url(#${id}b)`} stroke="#FFFFFF" strokeWidth="1.8" />
          <text x="19" y="23" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="800" fontFamily="Figtree,sans-serif">A</text>
          <text x="29" y="33" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="800" fontFamily="Figtree,sans-serif">Ü</text>
        </>
      );

    case 'n26':
      return (
        <>
          <BgSquircle id={id} c1="#3F34C4" c2="#4FC3A1" />
          <defs>
            <linearGradient id={`${id}a`} x1="8" y1="13" x2="40" y2="35" gradientUnits="userSpaceOnUse">
              <stop stopColor="#483BD4" />
              <stop offset="0.6" stopColor="#7667F4" />
              <stop offset="1" stopColor="#4FC3A1" />
            </linearGradient>
          </defs>
          <rect x="7" y="12" width="34" height="24" rx="7" fill={`url(#${id}a)`} />
          <rect x="12" y="18" width="8" height="6" rx="1.8" fill="#FFD66B" />
          <rect x="12" y="28.5" width="11" height="2.4" rx="1.2" fill="#FFFFFF" fillOpacity="0.75" />
          <circle cx="33" cy="29.5" r="3.2" fill="#F2A9BE" fillOpacity="0.9" />
          <circle cx="29.2" cy="29.5" r="3.2" fill="#FFD66B" fillOpacity="0.8" />
        </>
      );

    case 'shopping':
      return (
        <>
          <BgSquircle id={id} c1="#4FC3A1" c2="#F5A06B" />
          <defs>
            <linearGradient id={`${id}a`} x1="10" y1="18" x2="38" y2="39" gradientUnits="userSpaceOnUse">
              <stop stopColor="#5CD3AF" />
              <stop offset="1" stopColor="#1E9A78" />
            </linearGradient>
          </defs>
          <circle cx="19" cy="18" r="5" fill="#F27A9B" />
          <circle cx="29" cy="17.5" r="5.2" fill="#FFD66B" />
          <path d="M9 21H39L35.8 35.5C35.4 37.5 33.6 39 31.5 39H16.5C14.4 39 12.6 37.5 12.2 35.5L9 21Z" fill={`url(#${id}a)`} />
          <path d="M16 21L20 12M32 21L28 12" stroke="#1E9A78" strokeWidth="2.6" strokeLinecap="round" />
          <rect x="18" y="27" width="12" height="2.6" rx="1.3" fill="#FFFFFF" fillOpacity="0.75" />
        </>
      );

    case 'pantry':
      return (
        <>
          <BgSquircle id={id} c1="#4B8DFF" c2="#4FC3A1" />
          <defs>
            <linearGradient id={`${id}a`} x1="13" y1="8" x2="35" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#87B8FF" />
              <stop offset="1" stopColor="#4B8DFF" />
            </linearGradient>
          </defs>
          <rect x="13" y="8" width="22" height="32" rx="6" fill={`url(#${id}a)`} />
          <path d="M13 21.5H35" stroke="#FFFFFF" strokeWidth="2.2" strokeOpacity="0.85" />
          <rect x="17" y="12.5" width="2.5" height="5.5" rx="1.25" fill="#FFFFFF" fillOpacity="0.9" />
          <rect x="17" y="25" width="2.5" height="8" rx="1.25" fill="#FFFFFF" fillOpacity="0.9" />
          <circle cx="30" cy="14.5" r="2.2" fill="#A6F5DC" />
        </>
      );

    case 'packlist':
      return (
        <>
          <BgSquircle id={id} c1="#F5A06B" c2="#F27A9B" />
          <defs>
            <linearGradient id={`${id}a`} x1="11" y1="14" x2="37" y2="39" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFB17A" />
              <stop offset="1" stopColor="#E8725A" />
            </linearGradient>
          </defs>
          <path d="M18.5 14V11.5C18.5 9.8 19.8 8.5 21.5 8.5H26.5C28.2 8.5 29.5 9.8 29.5 11.5V14" stroke="#C95944" strokeWidth="2.8" strokeLinecap="round" />
          <rect x="10" y="14" width="28" height="24" rx="6" fill={`url(#${id}a)`} />
          <rect x="16" y="14" width="3.5" height="24" fill="#FFFFFF" fillOpacity="0.32" />
          <rect x="28.5" y="14" width="3.5" height="24" fill="#FFFFFF" fillOpacity="0.32" />
          <circle cx="24" cy="26" r="3.5" fill="#FFF3E0" />
        </>
      );

    case 'holiday':
      return (
        <>
          <BgSquircle id={id} c1="#FF9F2D" c2="#4B8DFF" />
          <defs>
            <linearGradient id={`${id}a`} x1="10" y1="10" x2="36" y2="36" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFD66B" />
              <stop offset="1" stopColor="#FF9F2D" />
            </linearGradient>
            <linearGradient id={`${id}b`} x1="8" y1="28" x2="40" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="#65A6FF" />
              <stop offset="1" stopColor="#3B7AE8" />
            </linearGradient>
          </defs>
          <circle cx="24" cy="21" r="9.5" fill={`url(#${id}a)`} />
          <path d="M8 31.5C13 28.5 18 28.5 24 31.5C30 34.5 35 34.5 40 31.5V35.5C40 37.5 38.4 39 36.4 39H11.6C9.6 39 8 37.5 8 35.5V31.5Z" fill={`url(#${id}b)`} />
          <text x="24" y="24.5" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="800" fontFamily="Figtree,sans-serif">€</text>
        </>
      );

    case 'expenses':
      return (
        <>
          <BgSquircle id={id} c1="#6D5DF0" c2="#F27A9B" />
          <defs>
            <linearGradient id={`${id}a`} x1="9" y1="14" x2="38" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="#7B6DF6" />
              <stop offset="1" stopColor="#3F34C4" />
            </linearGradient>
            <linearGradient id={`${id}b`} x1="12" y1="9" x2="34" y2="18" gradientUnits="userSpaceOnUse">
              <stop stopColor="#65DDB8" />
              <stop offset="1" stopColor="#28A985" />
            </linearGradient>
          </defs>
          <rect x="13" y="10" width="22" height="10" rx="4" transform="rotate(-5 13 10)" fill={`url(#${id}b)`} />
          <rect x="9" y="15" width="30" height="23" rx="7" fill={`url(#${id}a)`} />
          <rect x="27" y="22.5" width="13" height="8" rx="4" fill="#F2A9BE" />
          <circle cx="31.5" cy="26.5" r="2" fill="#FFFFFF" />
        </>
      );

    case 'surgery':
      return (
        <>
          <BgSquircle id={id} c1="#F27A9B" c2="#6D5DF0" />
          <defs>
            <linearGradient id={`${id}a`} x1="10" y1="10" x2="38" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F78EAB" />
              <stop offset="1" stopColor="#D4416E" />
            </linearGradient>
          </defs>
          <path d="M24 38.5C24 38.5 10 30.2 10 19.8C10 14.8 13.8 11 18.4 11C21.1 11 23 12.5 24 14.2C25 12.5 26.9 11 29.6 11C34.2 11 38 14.8 38 19.8C38 30.2 24 38.5 24 38.5Z" fill={`url(#${id}a)`} />
          <path d="M15.5 24H19.5L21.8 19L25.5 28L28 23.5H32.5" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );

    case 'budget':
      return (
        <>
          <BgSquircle id={id} c1="#4FC3A1" c2="#6D5DF0" />
          <defs>
            <linearGradient id={`${id}a`} x1="12" y1="8" x2="36" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#7667F4" />
              <stop offset="1" stopColor="#3F34C4" />
            </linearGradient>
          </defs>
          <rect x="11" y="8" width="26" height="32" rx="7" fill={`url(#${id}a)`} />
          <rect x="15.5" y="12.5" width="17" height="7" rx="3" fill="#B5F2DF" />
          <circle cx="17.5" cy="25.5" r="2.2" fill="#FFFFFF" fillOpacity="0.85" />
          <circle cx="24" cy="25.5" r="2.2" fill="#FFFFFF" fillOpacity="0.85" />
          <circle cx="30.5" cy="25.5" r="2.2" fill="#FFD66B" />
          <circle cx="17.5" cy="32.5" r="2.2" fill="#FFFFFF" fillOpacity="0.85" />
          <circle cx="24" cy="32.5" r="2.2" fill="#FFFFFF" fillOpacity="0.85" />
          <circle cx="30.5" cy="32.5" r="2.2" fill="#F2A9BE" />
        </>
      );

    case 'smarthome':
      return (
        <>
          <BgSquircle id={id} c1="#6D5DF0" c2="#FF9F2D" />
          <defs>
            <linearGradient id={`${id}a`} x1="10" y1="10" x2="38" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="#7D6EF6" />
              <stop offset="1" stopColor="#3F34C4" />
            </linearGradient>
          </defs>
          <rect x="10" y="10" width="28" height="28" rx="7" fill="#ECE8FF" stroke={`url(#${id}a)`} strokeWidth="2.5" />
          <rect x="12" y="12" width="24" height="5" rx="2" fill={`url(#${id}a)`} />
          <rect x="12" y="19" width="24" height="4.5" rx="2" fill="#7D6EF6" fillOpacity="0.72" />
          <circle cx="31" cy="31" r="4.5" fill="#FFD66B" />
          <path d="M15 33C18.5 29.5 22.5 29.5 26 33" stroke="#4FC3A1" strokeWidth="2.4" strokeLinecap="round" />
        </>
      );

    case 'stars':
      return (
        <>
          <BgSquircle id={id} c1="#FF9F2D" c2="#FFD66B" />
          <defs>
            <linearGradient id={`${id}a`} x1="12" y1="8" x2="36" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFE074" />
              <stop offset="0.55" stopColor="#FFA933" />
              <stop offset="1" stopColor="#F07C2E" />
            </linearGradient>
          </defs>
          <path d="M24 8.5L28.6 17.8L38.9 19.3L31.4 26.6L33.2 36.8L24 32L14.8 36.8L16.6 26.6L9.1 19.3L19.4 17.8L24 8.5Z" fill={`url(#${id}a)`} />
          <path d="M24 12.2L26.9 18.2L20.5 20.5L24 12.2Z" fill="#FFFFFF" fillOpacity="0.45" />
          <circle cx="37" cy="12" r="2" fill="#FFD66B" />
        </>
      );

    case 'setup':
      return (
        <>
          <BgSquircle id={id} c1="#6D5DF0" c2="#9B86F4" />
          <defs>
            <linearGradient id={`${id}a`} x1="11" y1="11" x2="37" y2="37" gradientUnits="userSpaceOnUse">
              <stop stopColor="#8B7DF7" />
              <stop offset="1" stopColor="#4A3DC8" />
            </linearGradient>
          </defs>
          <circle cx="24" cy="24" r="11" stroke={`url(#${id}a)`} strokeWidth="5.5" strokeDasharray="6.5 4.2" />
          <circle cx="24" cy="24" r="8.5" fill={`url(#${id}a)`} />
          <circle cx="24" cy="24" r="3.6" fill="#FFFFFF" />
        </>
      );

    /* ── 2. N26 DEPOT-BILDERCHEN ────────────────────────────────────────── */
    case 'depot_haus':
      return (
        <>
          <BgSquircle id={id} c1="#6D5DF0" c2="#F5A06B" />
          <defs>
            <linearGradient id={`${id}a`} x1="10" y1="12" x2="36" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="#7B6DF6" />
              <stop offset="1" stopColor="#3F34C4" />
            </linearGradient>
            <linearGradient id={`${id}c`} x1="28" y1="26" x2="40" y2="39" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFE07D" />
              <stop offset="1" stopColor="#F59E2D" />
            </linearGradient>
          </defs>
          <path d="M9 22.5L22.5 11.5L36 22.5V35.5C36 37.2 34.7 38.5 33 38.5H12C10.3 38.5 9 37.2 9 35.5V22.5Z" fill={`url(#${id}a)`} />
          <rect x="17" y="25" width="7" height="13.5" rx="3.5" fill="#ECE8FF" />
          <circle cx="34" cy="33" r="7.5" fill={`url(#${id}c)`} stroke="#FFFFFF" strokeWidth="2" />
          <text x="34" y="36.2" textAnchor="middle" fill="#FFFFFF" fontSize="9.5" fontWeight="800" fontFamily="Figtree,sans-serif">€</text>
        </>
      );

    case 'depot_strom':
      return (
        <>
          <BgSquircle id={id} c1="#FF9F2D" c2="#FFD66B" />
          <defs>
            <linearGradient id={`${id}a`} x1="14" y1="8" x2="34" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFE16B" />
              <stop offset="1" stopColor="#FF8C24" />
            </linearGradient>
          </defs>
          <circle cx="24" cy="24" r="14" fill="#FFF3D4" />
          <path d="M26.5 9.5L14.5 25.5H23.5L21.5 38.5L33.5 22.5H24.5L26.5 9.5Z" fill={`url(#${id}a)`} />
        </>
      );

    case 'depot_urlaub':
      return (
        <>
          <BgSquircle id={id} c1="#4B8DFF" c2="#F9C9A8" />
          <defs>
            <linearGradient id={`${id}a`} x1="10" y1="10" x2="38" y2="36" gradientUnits="userSpaceOnUse">
              <stop stopColor="#5AA0FF" />
              <stop offset="1" stopColor="#356EE8" />
            </linearGradient>
          </defs>
          <circle cx="33" cy="14" r="5" fill="#FFD66B" />
          <path d="M10 26L37 15L29 36L23.5 27.5L10 26Z" fill={`url(#${id}a)`} />
          <path d="M23.5 27.5L37 15" stroke="#FFFFFF" strokeWidth="1.8" strokeOpacity="0.7" />
          <path d="M11 37C16 34.5 21 34.5 26 37C31 39.5 35 39.5 39 37" stroke="#4FC3A1" strokeWidth="2.4" strokeLinecap="round" />
        </>
      );

    case 'depot_auto':
      return (
        <>
          <BgSquircle id={id} c1="#F5A06B" c2="#6D5DF0" />
          <defs>
            <linearGradient id={`${id}a`} x1="8" y1="16" x2="40" y2="34" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFA96B" />
              <stop offset="1" stopColor="#E86E58" />
            </linearGradient>
          </defs>
          <path d="M13.5 22L16.5 15.5C17.2 14 18.7 13 20.4 13H27.6C29.3 13 30.8 14 31.5 15.5L34.5 22H13.5Z" fill="#C7B6F7" />
          <rect x="8.5" y="21" width="31" height="12" rx="5.5" fill={`url(#${id}a)`} />
          <circle cx="15" cy="33" r="4" fill="#17143A" stroke="#FFFFFF" strokeWidth="1.6" />
          <circle cx="33" cy="33" r="4" fill="#17143A" stroke="#FFFFFF" strokeWidth="1.6" />
          <rect x="11.5" y="25" width="4.5" height="2.6" rx="1.3" fill="#FFF3C4" />
          <rect x="32" y="25" width="4.5" height="2.6" rx="1.3" fill="#FFF3C4" />
        </>
      );

    case 'depot_notgroschen':
      return (
        <>
          <BgSquircle id={id} c1="#4FC3A1" c2="#3F34C4" />
          <defs>
            <linearGradient id={`${id}a`} x1="12" y1="9" x2="36" y2="39" gradientUnits="userSpaceOnUse">
              <stop stopColor="#58D4AE" />
              <stop offset="1" stopColor="#1E9A78" />
            </linearGradient>
          </defs>
          <path d="M24 9L37 14V24.5C37 32 31.4 37.3 24 40C16.6 37.3 11 32 11 24.5V14L24 9Z" fill={`url(#${id}a)`} />
          <path d="M18.5 24.2L22.3 28L30 20" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );

    case 'depot_steuer':
      return (
        <>
          <BgSquircle id={id} c1="#6D5DF0" c2="#4B8DFF" />
          <defs>
            <linearGradient id={`${id}a`} x1="12" y1="9" x2="36" y2="39" gradientUnits="userSpaceOnUse">
              <stop stopColor="#8A7DF8" />
              <stop offset="1" stopColor="#4A3DD4" />
            </linearGradient>
          </defs>
          <rect x="12" y="9" width="24" height="30" rx="5.5" fill={`url(#${id}a)`} />
          <rect x="17" y="15" width="14" height="2.5" rx="1.25" fill="#FFFFFF" fillOpacity="0.85" />
          <rect x="17" y="20.5" width="10" height="2.5" rx="1.25" fill="#FFFFFF" fillOpacity="0.6" />
          <circle cx="30" cy="31" r="6" fill="#FFD66B" stroke="#FFFFFF" strokeWidth="1.8" />
          <text x="30" y="34" textAnchor="middle" fill="#17143A" fontSize="8.5" fontWeight="800" fontFamily="Figtree,sans-serif">%</text>
        </>
      );

    case 'depot_geschenke':
      return (
        <>
          <BgSquircle id={id} c1="#F27A9B" c2="#FF9F2D" />
          <defs>
            <linearGradient id={`${id}a`} x1="10" y1="17" x2="38" y2="39" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F78EAB" />
              <stop offset="1" stopColor="#D94A78" />
            </linearGradient>
          </defs>
          <rect x="11" y="21" width="26" height="17" rx="5" fill={`url(#${id}a)`} />
          <rect x="9" y="16" width="30" height="6.5" rx="3" fill="#F2A9BE" />
          <rect x="22" y="16" width="4" height="22" fill="#FFD66B" />
          <path d="M24 16C20 11 15 11.5 16.5 15C17.5 16.5 21 16 24 16ZM24 16C28 11 33 11.5 31.5 15C30.5 16.5 27 16 24 16Z" fill="#FF9F2D" />
        </>
      );

    case 'depot_kinder':
      return (
        <>
          <BgSquircle id={id} c1="#F2A9BE" c2="#FFD66B" />
          <defs>
            <linearGradient id={`${id}a`} x1="10" y1="15" x2="38" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F6A2BD" />
              <stop offset="1" stopColor="#E46990" />
            </linearGradient>
          </defs>
          <ellipse cx="24" cy="27" rx="13" ry="10" fill={`url(#${id}a)`} />
          <circle cx="35.5" cy="26.5" r="3.5" fill="#F2A9BE" />
          <circle cx="16.5" cy="18.5" r="3.5" fill="#E46990" />
          <rect x="21" y="19" width="6" height="2.4" rx="1.2" fill="#FFFFFF" fillOpacity="0.8" />
          <circle cx="24" cy="13.5" r="4.5" fill="#FFD66B" stroke="#FFFFFF" strokeWidth="1.5" />
        </>
      );

    case 'depot_technik':
      return (
        <>
          <BgSquircle id={id} c1="#4B8DFF" c2="#6D5DF0" />
          <defs>
            <linearGradient id={`${id}a`} x1="10" y1="12" x2="38" y2="32" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6DA6FF" />
              <stop offset="1" stopColor="#3F34C4" />
            </linearGradient>
          </defs>
          <rect x="10" y="12" width="28" height="19" rx="4.5" fill={`url(#${id}a)`} />
          <rect x="13" y="15" width="22" height="13" rx="2.5" fill="#ECE8FF" fillOpacity="0.25" />
          <path d="M7 34.5H41" stroke="#3F34C4" strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="24" cy="21.5" r="3.2" fill="#6DF2C9" />
        </>
      );

    case 'depot_garten':
      return (
        <>
          <BgSquircle id={id} c1="#43C773" c2="#20BFA9" />
          <defs>
            <linearGradient id={`${id}a`} x1="11" y1="11" x2="37" y2="37" gradientUnits="userSpaceOnUse">
              <stop stopColor="#60DC90" />
              <stop offset="1" stopColor="#1E9A78" />
            </linearGradient>
          </defs>
          <path d="M24 37V22" stroke="#1E9A78" strokeWidth="3" strokeLinecap="round" />
          <path d="M24 24C24 14 33 11 37 11C37 19 32 25 24 24Z" fill={`url(#${id}a)`} />
          <path d="M24 28C24 20 15 17 11 17C11 24 16 29 24 28Z" fill="#4FC3A1" />
        </>
      );

    case 'depot_hund':
      return (
        <>
          <BgSquircle id={id} c1="#F5A06B" c2="#F2A9BE" />
          <defs>
            <linearGradient id={`${id}a`} x1="12" y1="12" x2="36" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFB176" />
              <stop offset="1" stopColor="#DE7B42" />
            </linearGradient>
          </defs>
          <circle cx="15" cy="20" r="3.6" fill={`url(#${id}a)`} />
          <circle cx="21" cy="14.5" r="3.8" fill={`url(#${id}a)`} />
          <circle cx="27.5" cy="14.5" r="3.8" fill={`url(#${id}a)`} />
          <circle cx="33" cy="20" r="3.6" fill={`url(#${id}a)`} />
          <path d="M16.5 29.5C16.5 25.5 20 22.5 24 22.5C28 22.5 31.5 25.5 31.5 29.5C31.5 33.5 28.5 36 24 36C19.5 36 16.5 33.5 16.5 29.5Z" fill={`url(#${id}a)`} />
        </>
      );

    case 'depot_kleidung':
      return (
        <>
          <BgSquircle id={id} c1="#F27A9B" c2="#9B86F4" />
          <defs>
            <linearGradient id={`${id}a`} x1="10" y1="12" x2="38" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="#A68BF0" />
              <stop offset="1" stopColor="#6D5DF0" />
            </linearGradient>
          </defs>
          <path d="M16 12L10 17.5L14 23L17 20.5V36H31V20.5L34 23L38 17.5L32 12H28.5C27.5 14.8 25.8 16 24 16C22.2 16 20.5 14.8 19.5 12H16Z" fill={`url(#${id}a)`} />
        </>
      );

    case 'depot_sparen':
      return (
        <>
          <BgSquircle id={id} c1="#4FC3A1" c2="#FFD66B" />
          <defs>
            <linearGradient id={`${id}a`} x1="12" y1="10" x2="36" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFE07A" />
              <stop offset="1" stopColor="#F59E2D" />
            </linearGradient>
          </defs>
          <ellipse cx="22" cy="34" rx="11" ry="4" fill="#E68A1E" />
          <ellipse cx="22" cy="29" rx="11" ry="4" fill="#FFA834" />
          <ellipse cx="22" cy="24" rx="11" ry="4" fill={`url(#${id}a)`} />
          <circle cx="34" cy="16" r="6" fill="#4FC3A1" stroke="#FFFFFF" strokeWidth="1.8" />
          <path d="M31.5 16H36.5M34 13.5V18.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
        </>
      );

    /* ── 3. ZUSÄTZLICHE AUSGABEN-KATEGORIEN ─────────────────────────────── */
    case 'cat_essen':
      return (
        <>
          <BgSquircle id={id} c1="#F5A06B" c2="#F27A9B" />
          <defs>
            <linearGradient id={`${id}a`} x1="14" y1="14" x2="34" y2="34" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFAE70" />
              <stop offset="1" stopColor="#E26478" />
            </linearGradient>
          </defs>
          <circle cx="24" cy="24" r="10.5" fill={`url(#${id}a)`} />
          <circle cx="24" cy="24" r="6.5" fill="#FFFFFF" fillOpacity="0.88" />
          <path d="M9.5 14V21.5M12 14V21.5M10.75 21.5V34" stroke="#C95944" strokeWidth="2" strokeLinecap="round" />
          <path d="M37.5 14V34M37.5 14C35.2 15.5 35 19.5 35.2 23H37.5" stroke="#C95944" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );

    case 'cat_handwerk':
      return (
        <>
          <BgSquircle id={id} c1="#6D5DF0" c2="#F5A06B" />
          <defs>
            <linearGradient id={`${id}a`} x1="16" y1="10" x2="34" y2="26" gradientUnits="userSpaceOnUse">
              <stop stopColor="#7B6DF6" />
              <stop offset="1" stopColor="#3F34C4" />
            </linearGradient>
          </defs>
          <path d="M13 35L26 22" stroke="#F5A06B" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M20.5 16.5L26 11C28.5 11 32 13 35 16L31.5 19.5L35 23L31 27L20.5 16.5Z" fill={`url(#${id}a)`} />
        </>
      );

    case 'cat_hygiene':
      return (
        <>
          <BgSquircle id={id} c1="#4B8DFF" c2="#4FC3A1" />
          <defs>
            <linearGradient id={`${id}a`} x1="14" y1="10" x2="34" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="#74C3FF" />
              <stop offset="1" stopColor="#3B82F6" />
            </linearGradient>
          </defs>
          <path d="M24 10C24 10 13 21.5 13 28.5C13 34.5 17.9 39 24 39C30.1 39 35 34.5 35 28.5C35 21.5 24 10 24 10Z" fill={`url(#${id}a)`} />
          <path d="M19 29C19 31.8 21.2 34 24 34" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeOpacity="0.75" />
        </>
      );

    case 'cat_sport':
      return (
        <>
          <BgSquircle id={id} c1="#43C773" c2="#4B8DFF" />
          <rect x="11" y="17" width="6" height="14" rx="3" fill="#20BFA9" />
          <rect x="31" y="17" width="6" height="14" rx="3" fill="#20BFA9" />
          <rect x="15" y="21.5" width="18" height="5" rx="2.5" fill="#3F34C4" />
        </>
      );

    case 'cat_unterhaltung':
      return (
        <>
          <BgSquircle id={id} c1="#6D5DF0" c2="#F27A9B" />
          <defs>
            <linearGradient id={`${id}a`} x1="10" y1="12" x2="38" y2="36" gradientUnits="userSpaceOnUse">
              <stop stopColor="#8A7DF8" />
              <stop offset="1" stopColor="#F27A9B" />
            </linearGradient>
          </defs>
          <rect x="9" y="13" width="30" height="22" rx="6" fill={`url(#${id}a)`} />
          <polygon points="21,19 30,24 21,29" fill="#FFFFFF" />
        </>
      );

    case 'cat_waki':
      return (
        <>
          <BgSquircle id={id} c1="#43C773" c2="#4FC3A1" />
          <polygon points="20,11 11,27 29,27" fill="#2FB36B" />
          <polygon points="30,15 22,29 38,29" fill="#4FC3A1" />
          <rect x="18.5" y="27" width="3" height="9" rx="1.5" fill="#A06B47" />
          <rect x="28.5" y="29" width="3" height="7" rx="1.5" fill="#A06B47" />
        </>
      );

    /* ── 4. STATUS & HELFER-BILDERCHEN ──────────────────────────────────── */
    case 'alert':
      return (
        <>
          <BgSquircle id={id} c1="#FF9F2D" c2="#F27A9B" />
          <defs>
            <linearGradient id={`${id}a`} x1="12" y1="10" x2="36" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFB74D" />
              <stop offset="1" stopColor="#F27A54" />
            </linearGradient>
          </defs>
          <path d="M22.2 11.4C23 10 25 10 25.8 11.4L38.2 33.4C39 34.8 38 36.5 36.4 36.5H11.6C10 36.5 9 34.8 9.8 33.4L22.2 11.4Z" fill={`url(#${id}a)`} />
          <rect x="22.6" y="19" width="2.8" height="8" rx="1.4" fill="#FFFFFF" />
          <circle cx="24" cy="31" r="1.8" fill="#FFFFFF" />
        </>
      );

    case 'history':
      return (
        <>
          <BgSquircle id={id} c1="#4FC3A1" c2="#4B8DFF" />
          <defs>
            <linearGradient id={`${id}a`} x1="11" y1="11" x2="37" y2="37" gradientUnits="userSpaceOnUse">
              <stop stopColor="#58D4AE" />
              <stop offset="1" stopColor="#1E9A78" />
            </linearGradient>
          </defs>
          <circle cx="24" cy="24" r="13.5" fill={`url(#${id}a)`} />
          <path d="M24 16.5V24.5L29.5 27.5" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );

    case 'weekly_stars':
      return (
        <>
          <BgSquircle id={id} c1="#6D5DF0" c2="#FF9F2D" />
          <rect x="10" y="13" width="28" height="25" rx="6" fill="#6D5DF0" />
          <rect x="10" y="13" width="28" height="8" rx="4" fill="#3F34C4" />
          <path d="M24 22.5L26 26.5L30.5 27.1L27.2 30.3L28 34.8L24 32.6L20 34.8L20.8 30.3L17.5 27.1L22 26.5L24 22.5Z" fill="#FFD66B" />
        </>
      );

    case 'flame':
      return (
        <>
          <BgSquircle id={id} c1="#FF9F2D" c2="#F27A9B" />
          <defs>
            <linearGradient id={`${id}a`} x1="14" y1="10" x2="34" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFD66B" />
              <stop offset="0.55" stopColor="#FF8C32" />
              <stop offset="1" stopColor="#E84B6E" />
            </linearGradient>
          </defs>
          <path d="M24.5 9C24.5 9 34 16 34 25.5C34 32 29.5 37.5 24 37.5C18.5 37.5 14 32.5 14 26.5C14 22.5 16.5 19 18.5 17C18.5 20 20.5 21.5 20.5 21.5C20.5 16.5 24.5 9 24.5 9Z" fill={`url(#${id}a)`} />
          <path d="M24 24.5C24 24.5 28 27.5 28 31.2C28 33.8 26.2 35.8 24 35.8C21.8 35.8 20 33.8 20 31.2C20 28.5 24 24.5 24 24.5Z" fill="#FFF3C4" />
        </>
      );
  }
}

export const HubIcon: React.FC<HubIconProps> = ({ name, size = 36, className, style }) => {
  const rawId = useId();
  const id = `fh${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0, ...style }}
    >
      {renderIconContent(name, id)}
    </svg>
  );
};

/** Automatische Zuordnung eines N26 Depot-Namens zum passenden Bilderchen */
export function depotIconKey(name?: string): HubIconName {
  const n = (name || '').toLowerCase();
  if (/haus|nebenkosten|wohn|immo|dach/.test(n)) return 'depot_haus';
  if (/strom|energie|solar|gas|heiz/.test(n)) return 'depot_strom';
  if (/urlaub|reise|ferien|flug|sommer/.test(n)) return 'depot_urlaub';
  if (/auto|tüv|tuev|wagen|kfz|tank|reifen/.test(n)) return 'depot_auto';
  if (/steuer|versich|rechnung|behörd/.test(n)) return 'depot_steuer';
  if (/not|puffer|sicher|reserve/.test(n)) return 'depot_notgroschen';
  if (/geschenk|weihnacht|geburtstag/.test(n)) return 'depot_geschenke';
  if (/kind|mia|leo|schule|kita|bildung/.test(n)) return 'depot_kinder';
  if (/tech|smart|handy|laptop|pc|elektr/.test(n)) return 'depot_technik';
  if (/garten|pflanz|werkzeug|handwerk/.test(n)) return 'depot_garten';
  if (/hund|tier|katze|futter/.test(n)) return 'depot_hund';
  if (/kleid|mode|schuh|shop/.test(n)) return 'depot_kleidung';
  if (/op|gesund|arzt|zahn|med/.test(n)) return 'surgery';
  return 'depot_sparen';
}

export const DepotIcon: React.FC<{ name?: string; size?: number; className?: string; style?: React.CSSProperties }> = ({
  name,
  size = 36,
  className,
  style,
}) => <HubIcon name={depotIconKey(name)} size={size} className={className} style={style} />;

const EXPENSE_CATEGORY_MAP: Record<string, HubIconName> = {
  'Essen gehen': 'cat_essen',
  'Geschenke': 'depot_geschenke',
  'Gesundheit': 'surgery',
  'Handwerk': 'cat_handwerk',
  'Haus': 'depot_haus',
  'Hund': 'depot_hund',
  'Hygiene': 'cat_hygiene',
  'Kinder': 'depot_kinder',
  'Kleidung': 'depot_kleidung',
  'Korrektur': 'depot_strom',
  'Lebensmittel': 'shopping',
  'Rechnungen': 'depot_steuer',
  'Sparen': 'depot_sparen',
  'Sport': 'cat_sport',
  'Unterhaltung': 'cat_unterhaltung',
  'Verkehr': 'depot_auto',
  'Waki': 'cat_waki',
  'Wohnen': 'depot_haus',
  'Familie': 'depot_kinder',
  'Freizeit': 'cat_essen',
  'Auto': 'depot_auto',
};

export function expenseCategoryIconKey(category?: string): HubIconName {
  if (!category) return 'expenses';
  return EXPENSE_CATEGORY_MAP[category] || depotIconKey(category);
}

export const ExpenseCategoryIcon: React.FC<{ category?: string; size?: number; className?: string; style?: React.CSSProperties }> = ({
  category,
  size = 36,
  className,
  style,
}) => <HubIcon name={expenseCategoryIconKey(category)} size={size} className={className} style={style} />;

const NAV_PATH_MAP: Record<string, HubIconName> = {
  '/': 'home',
  '/tasks': 'tasks',
  '/grades': 'grades',
  '/vokabeln': 'vocab',
  '/n26': 'n26',
  '/einkaufsliste': 'shopping',
  '/vorrat': 'pantry',
  '/packliste': 'packlist',
  '/urlaubsbudget': 'holiday',
  '/expenses': 'expenses',
  '/op-finanzen': 'surgery',
  '/budget': 'budget',
  '/smart-home': 'smarthome',
  '/rewards': 'stars',
  '/setup': 'setup',
};

export function navIconKey(path: string): HubIconName {
  return NAV_PATH_MAP[path] || 'home';
}
