import type { HubCategory } from '../types/duoplay';

export interface CategoryThemeSpec {
  id: HubCategory;
  /** Rich colorful multi-halo page background */
  pageBg: string;
  /** Vivid button & active tab gradient */
  primaryGradient: string;
  /** High-contrast foreground text on primaryGradient (WCAG AA+) */
  primaryText: string;
  /** Soft colored shadow for cards & CTAs */
  glowShadow: string;
  /** Accent hex for icons, rings, and highlights */
  accentHex: string;
  /** Secondary accent hex */
  secondaryHex: string;
  /** Subtle border highlight on hover/active */
  borderColor: string;
  /** Badge surface tint */
  badgeBg: string;
  /** Badge legible text color */
  badgeText: string;
}

export const CATEGORY_THEMES: Record<HubCategory, CategoryThemeSpec> = {
  // Violet Électrique (#7C3AED) -> Rose Corail (#FF4D8D) -> Bleu Ciel (#38BDF8)
  all: {
    id: 'all',
    pageBg:
      'radial-gradient(1050px 620px at 14% 4%, rgba(124, 58, 237, 0.44), transparent 62%), radial-gradient(880px 560px at 88% 10%, rgba(255, 77, 141, 0.34), transparent 60%), radial-gradient(800px 540px at 50% 96%, rgba(56, 189, 248, 0.24), transparent 65%), linear-gradient(155deg, #161130 0%, #1F153D 52%, #131B36 100%)',
    primaryGradient: 'linear-gradient(135deg, #7C3AED 0%, #FF4D8D 55%, #38BDF8 100%)',
    primaryText: '#FFFFFF',
    glowShadow: '0 14px 32px -8px rgba(124, 58, 237, 0.52)',
    accentHex: '#FF4D8D',
    secondaryHex: '#38BDF8',
    borderColor: 'rgba(192, 132, 252, 0.45)',
    badgeBg: 'rgba(124, 58, 237, 0.28)',
    badgeText: '#F5F3FF',
  },
  // Jaune Mangue (#FACC15) -> Orange Tangerine (#FB923C) -> Rose Pop (#EC4899)
  drole: {
    id: 'drole',
    pageBg:
      'radial-gradient(1000px 600px at 15% 5%, rgba(250, 204, 21, 0.34), transparent 60%), radial-gradient(860px 540px at 85% 12%, rgba(251, 146, 60, 0.34), transparent 60%), radial-gradient(780px 520px at 50% 98%, rgba(236, 72, 153, 0.28), transparent 64%), linear-gradient(155deg, #271710 0%, #331823 52%, #211428 100%)',
    primaryGradient: 'linear-gradient(135deg, #FACC15 0%, #FB923C 55%, #EC4899 100%)',
    primaryText: '#1C1018',
    glowShadow: '0 14px 32px -8px rgba(251, 146, 60, 0.5)',
    accentHex: '#FACC15',
    secondaryHex: '#FB923C',
    borderColor: 'rgba(250, 204, 21, 0.5)',
    badgeBg: 'rgba(250, 204, 21, 0.22)',
    badgeText: '#FEF9C3',
  },
  // Rouge Néon (#EF4444) -> Orange Feu (#F97316) -> Cyan Électrique (#06B6D4)
  action: {
    id: 'action',
    pageBg:
      'radial-gradient(1000px 600px at 14% 6%, rgba(239, 68, 68, 0.38), transparent 60%), radial-gradient(840px 520px at 86% 12%, rgba(249, 115, 22, 0.32), transparent 58%), radial-gradient(780px 520px at 52% 96%, rgba(6, 182, 212, 0.28), transparent 64%), linear-gradient(155deg, #251018 0%, #241427 50%, #0D2130 100%)',
    primaryGradient: 'linear-gradient(135deg, #EF4444 0%, #F97316 55%, #06B6D4 100%)',
    primaryText: '#FFFFFF',
    glowShadow: '0 14px 32px -8px rgba(239, 68, 68, 0.52)',
    accentHex: '#F97316',
    secondaryHex: '#06B6D4',
    borderColor: 'rgba(249, 115, 22, 0.5)',
    badgeBg: 'rgba(239, 68, 68, 0.28)',
    badgeText: '#FFEDD5',
  },
  // Vert Émeraude (#10B981) -> Turquoise (#14B8A6) -> Or (#F59E0B)
  aventure: {
    id: 'aventure',
    pageBg:
      'radial-gradient(1020px 600px at 16% 6%, rgba(16, 185, 129, 0.36), transparent 60%), radial-gradient(860px 520px at 86% 14%, rgba(20, 184, 166, 0.32), transparent 58%), radial-gradient(760px 520px at 50% 96%, rgba(245, 158, 11, 0.22), transparent 64%), linear-gradient(155deg, #0C2320 0%, #0F292E 52%, #1D2118 100%)',
    primaryGradient: 'linear-gradient(135deg, #10B981 0%, #14B8A6 55%, #F59E0B 100%)',
    primaryText: '#071F1B',
    glowShadow: '0 14px 32px -8px rgba(16, 185, 129, 0.48)',
    accentHex: '#34D399',
    secondaryHex: '#F59E0B',
    borderColor: 'rgba(52, 211, 153, 0.5)',
    badgeBg: 'rgba(16, 185, 129, 0.25)',
    badgeText: '#D1FAE5',
  },
  // Rose Framboise (#F43F5E) -> Lavande (#C084FC) -> Doré (#FBBF24)
  romantique: {
    id: 'romantique',
    pageBg:
      'radial-gradient(1020px 600px at 16% 6%, rgba(244, 63, 94, 0.38), transparent 60%), radial-gradient(880px 540px at 86% 14%, rgba(192, 132, 252, 0.34), transparent 60%), radial-gradient(760px 520px at 50% 96%, rgba(251, 191, 36, 0.22), transparent 64%), linear-gradient(155deg, #2B1022 0%, #291538 52%, #24192E 100%)',
    primaryGradient: 'linear-gradient(135deg, #F43F5E 0%, #C084FC 58%, #FBBF24 100%)',
    primaryText: '#FFFFFF',
    glowShadow: '0 14px 32px -8px rgba(244, 63, 94, 0.5)',
    accentHex: '#FB7185',
    secondaryHex: '#C084FC',
    borderColor: 'rgba(244, 63, 94, 0.5)',
    badgeBg: 'rgba(244, 63, 94, 0.26)',
    badgeText: '#FFE4E6',
  },
  // Indigo (#6366F1) -> Fuchsia (#D946EF) -> Vert Menthe (#34D399)
  amusant: {
    id: 'amusant',
    pageBg:
      'radial-gradient(1020px 600px at 14% 6%, rgba(99, 102, 241, 0.42), transparent 60%), radial-gradient(860px 540px at 86% 12%, rgba(217, 70, 239, 0.34), transparent 58%), radial-gradient(760px 520px at 50% 96%, rgba(52, 211, 153, 0.24), transparent 64%), linear-gradient(155deg, #16153A 0%, #2A143B 52%, #11262D 100%)',
    primaryGradient: 'linear-gradient(135deg, #6366F1 0%, #D946EF 55%, #34D399 100%)',
    primaryText: '#FFFFFF',
    glowShadow: '0 14px 32px -8px rgba(217, 70, 239, 0.48)',
    accentHex: '#E879F9',
    secondaryHex: '#34D399',
    borderColor: 'rgba(217, 70, 239, 0.5)',
    badgeBg: 'rgba(99, 102, 241, 0.3)',
    badgeText: '#FAE8FF',
  },
  // Bordeaux profond (#4C0519) -> Rose Velours (#BE123C) -> Or Ambré (#F59E0B)
  sensuel: {
    id: 'sensuel',
    pageBg:
      'radial-gradient(1020px 580px at 18% 6%, rgba(190, 18, 60, 0.44), transparent 62%), radial-gradient(820px 520px at 84% 14%, rgba(245, 158, 11, 0.24), transparent 60%), linear-gradient(155deg, #320413 0%, #4C0519 48%, #1C0814 100%)',
    primaryGradient: 'linear-gradient(135deg, #BE123C 0%, #E11D48 52%, #F59E0B 100%)',
    primaryText: '#FFFFFF',
    glowShadow: '0 14px 32px -8px rgba(190, 18, 60, 0.55)',
    accentHex: '#F59E0B',
    secondaryHex: '#FB7185',
    borderColor: 'rgba(245, 158, 11, 0.48)',
    badgeBg: 'rgba(190, 18, 60, 0.34)',
    badgeText: '#FEF3C7',
  },
};
