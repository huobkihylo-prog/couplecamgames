import type { HubCategory } from '../types/duoplay';

export interface CategoryThemeSpec {
  id: HubCategory;
  /** Warm cream / soft pastel page background */
  pageBg: string;
  /** Primary CTA coral fill */
  primaryGradient: string;
  /** High-contrast foreground text on primaryGradient */
  primaryText: string;
  /** Subtle soft shadow for cards & CTAs */
  glowShadow: string;
  /** Accent hex for icons, rings, and highlights */
  accentHex: string;
  /** Secondary accent hex */
  secondaryHex: string;
  /** Subtle hairline border */
  borderColor: string;
  /** Badge surface tint */
  badgeBg: string;
  /** Badge legible text color */
  badgeText: string;
}

export const CATEGORY_THEMES: Record<HubCategory, CategoryThemeSpec> = {
  all: {
    id: 'all',
    pageBg: '#FAF7F2',
    primaryGradient: '#FF6B57',
    primaryText: '#FFFFFF',
    glowShadow: '0 6px 20px -4px rgba(255, 107, 87, 0.32)',
    accentHex: '#FF6B57',
    secondaryHex: '#7C5CFC',
    borderColor: '#EAE4DC',
    badgeBg: '#FFE8E2',
    badgeText: '#1F242D',
  },
  drole: {
    id: 'drole',
    pageBg: '#FAF7F2',
    primaryGradient: '#FF6B57',
    primaryText: '#FFFFFF',
    glowShadow: '0 6px 20px -4px rgba(255, 107, 87, 0.32)',
    accentHex: '#FF6B57',
    secondaryHex: '#EAB308',
    borderColor: '#EAE4DC',
    badgeBg: '#FEF6DC',
    badgeText: '#1F242D',
  },
  action: {
    id: 'action',
    pageBg: '#FAF7F2',
    primaryGradient: '#FF6B57',
    primaryText: '#FFFFFF',
    glowShadow: '0 6px 20px -4px rgba(255, 107, 87, 0.32)',
    accentHex: '#FF6B57',
    secondaryHex: '#0EA5E9',
    borderColor: '#EAE4DC',
    badgeBg: '#FDEEE7',
    badgeText: '#1F242D',
  },
  aventure: {
    id: 'aventure',
    pageBg: '#FAF7F2',
    primaryGradient: '#FF6B57',
    primaryText: '#FFFFFF',
    glowShadow: '0 6px 20px -4px rgba(255, 107, 87, 0.32)',
    accentHex: '#10B981',
    secondaryHex: '#FF6B57',
    borderColor: '#EAE4DC',
    badgeBg: '#E6F6EF',
    badgeText: '#1F242D',
  },
  romantique: {
    id: 'romantique',
    pageBg: '#FAF7F2',
    primaryGradient: '#FF6B57',
    primaryText: '#FFFFFF',
    glowShadow: '0 6px 20px -4px rgba(255, 107, 87, 0.32)',
    accentHex: '#EC4899',
    secondaryHex: '#7C5CFC',
    borderColor: '#EAE4DC',
    badgeBg: '#FCEAF0',
    badgeText: '#1F242D',
  },
  amusant: {
    id: 'amusant',
    pageBg: '#FAF7F2',
    primaryGradient: '#FF6B57',
    primaryText: '#FFFFFF',
    glowShadow: '0 6px 20px -4px rgba(255, 107, 87, 0.32)',
    accentHex: '#7C5CFC',
    secondaryHex: '#FF6B57',
    borderColor: '#EAE4DC',
    badgeBg: '#EFE9FB',
    badgeText: '#1F242D',
  },
  sensuel: {
    id: 'sensuel',
    pageBg: '#FAF7F2',
    primaryGradient: '#FF6B57',
    primaryText: '#FFFFFF',
    glowShadow: '0 6px 20px -4px rgba(255, 107, 87, 0.32)',
    accentHex: '#E11D48',
    secondaryHex: '#FF6B57',
    borderColor: '#EAE4DC',
    badgeBg: '#FCEAF0',
    badgeText: '#1F242D',
  },
  musique: {
    id: 'musique',
    pageBg: '#FAF7F2',
    primaryGradient: '#FF6B57',
    primaryText: '#FFFFFF',
    glowShadow: '0 6px 20px -4px rgba(255, 107, 87, 0.32)',
    accentHex: '#7C5CFC',
    secondaryHex: '#0EA5E9',
    borderColor: '#EAE4DC',
    badgeBg: '#E6F3FC',
    badgeText: '#1F242D',
  },
};
