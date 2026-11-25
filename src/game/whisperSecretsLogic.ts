import type { Language, WhisperLevel, WhisperRole } from '../types/duoplay';

export const WHISPER_DURATION_SEC = 15;
export const WHISPER_MAX_LENGTH = 60;
export const KISS_PUCKER_THRESHOLD = 0.65;
export const KISS_HOLD_REQUIRED_SEC = 0.35; // 350 ms continuous hold

export const WHISPER_PHRASES: Record<Language, Record<WhisperLevel, string[]>> = {
  fr: {
    doux: [
      'Tu es magnifique ce soir',
      'J’adore ton sourire',
      'Tu me manques tellement',
      'Embrasse-moi vite',
      'Ton regard me fait fondre',
      'J’ai pensé à toi toute la journée',
      'Reste blotti contre moi',
      'Tu illumines ma soirée',
      'J’aime le son de ta voix',
      'Fais-moi un clin d’œil',
      'Mon cœur bat pour toi',
      'Je suis fou de toi',
    ],
    seduction: [
      'J’ai envie de t’embrasser dans le cou',
      'Ton parfum me rend dingue',
      'Approche tes lèvres de l’écran',
      'Tu es irrésistible quand tu souris',
      'J’ai un secret à te chuchoter',
      'Mords doucement ta lèvre inférieure',
      'Ce soir c’est toi qui commandes',
      'Je rêve de te retrouver seul à seul',
      'Ton regard me fait perdre mes mots',
      'Garde tes yeux plongés dans les miens',
      'J’adore quand tu te rapproches',
      'Tu fais monter la température',
    ],
    intense: [
      'Je veux te couvrir de baisers ce soir',
      'Viens te perdre dans mes bras',
      'Dis-moi ce que tu veux que je te fasse',
      'J’ai très envie de toi maintenant',
      'Fais-moi frissonner juste avec ton regard',
      'Ce soir on ne dort pas tôt',
      'Mes mains rêvent de te toucher',
      'Chuchote-moi ton plus beau désir',
      'Je brûle d’envie de t’embrasser',
      'Tu me fais complètement craquer',
      'Laisse-moi t’embrasser partout',
      'Je ne pense qu’à nos retrouvailles',
    ],
  },
  en: {
    doux: [
      'You look gorgeous tonight',
      'I adore your smile',
      'I miss you so much',
      'Kiss me right now',
      'Your eyes make me melt',
      'I thought about you all day',
      'Stay close to me tonight',
      'You light up my whole evening',
      'I love the sound of your voice',
      'My heart beats only for you',
    ],
    seduction: [
      'I want to kiss your neck softly',
      'Bring your lips closer to the screen',
      'You are irresistible when you smile',
      'I have a secret to whisper to you',
      'Bite your lower lip slowly',
      'Tonight you are in charge',
      'Your gaze makes me lose my words',
      'Keep your eyes locked on mine',
      'You are turning up the heat',
      'I love when you lean in closer',
    ],
    intense: [
      'I want to cover you in kisses tonight',
      'Come get lost in my arms',
      'Tell me what you want me to do',
      'I crave you right this second',
      'Give me chills with just your eyes',
      'We are staying up late tonight',
      'Whisper your boldest desire to me',
      'I am burning to kiss your lips',
      'You drive me completely wild',
      'All I think about is holding you',
    ],
  },
  ar: {
    doux: [
      'أنت رائع الجمال الليلة',
      'أعشق ابتسامتك الدافئة',
      'أشتاق إليك كثيراً الآن',
      'أرسل لي قبلة سريعة',
      'نظرتك تذيب قلبي دائماً',
      'فكرت بك طوال اليوم',
      'أحب صوتك الهادئ جداً',
      'أنت تضيء ليلتي كلها',
      'قلبي ينبض لأجلك فقط',
      'لا أستطيع التوقف عن حبك',
    ],
    seduction: [
      'أريد أن أقبلك بنعومة الليلة',
      'قرّب شفتيك أكثر من الكاميرا',
      'أنت لا تُقاوم حين تبتسم',
      'لدي سر سأهمسه لك وحدك',
      'الليلة أنت من يتحكم باللعبة',
      'نظرتك تنسيني كل الكلمات',
      'أبقِ عينيك في عينيّ الآن',
      'أنت ترفع حرارة الأجواء هنا',
      'أحب حين تقترب مني ببطء',
      'عطرك يخطر في بالي الآن',
    ],
    intense: [
      'أريد أن أغمرك بالقبلات الليلة',
      'تعال واختبئ بين ذراعيّ',
      'أخبرني بما تتمنى أن أفعله لك',
      'أشتاق لقربك بجنون هذه اللحظة',
      'اهمس لي بأجرأ أمنية لديك',
      'هذه الليلة لن ننام مبكراً',
      'نظرتك تجعلني أرتجف شوقاً',
      'أحترق شوقاً للقاء قريب بيننا',
      'أنت تجعلني أفقد صوابي تماماً',
      'كل تفكيري الآن في لقائنا القادم',
    ],
  },
};

export const WHISPER_DARES: Record<Language, Record<WhisperLevel, string[]>> = {
  fr: {
    doux: [
      'Envoie 3 baisers soufflés au ralenti vers la caméra.',
      'Regarde ton/ta partenaire droit dans les yeux pendant 10 secondes sans détourner le regard.',
      'Fais-lui un compliment sincère et poétique à voix basse.',
      'Dessine un cœur dans l’air avec ton doigt tout en souriant.',
      'Chuchote son prénom de la manière la plus tendre possible.',
      'Raconte en une phrase le moment où tu as craqué pour lui/elle.',
      'Fais un clin d’œil complice suivi d’un baiser sur le bout des doigts.',
    ],
    seduction: [
      'Rapproche-toi tout près de la caméra et chuchote un vrai secret à voix très basse.',
      'Effleure lentement ta nuque ou ta clavicule en gardant le contact visuel.',
      'Mords doucement ta lèvre inférieure pendant 4 secondes sans rire.',
      'Décris en 3 mots ce que tu feras dès nos prochaines retrouvailles.',
      'Fais un compliment audacieux sur la partie de son visage que tu préfères.',
      'Parle à voix suave et grave pendant toute la manche suivante.',
      'Envoie un baiser brûlant en posant tes doigts sur la caméra.',
    ],
    intense: [
      'Chuchote au micro pendant 8 secondes un scénario romantique pour notre prochaine soirée.',
      'Ferme les yeux 3 secondes, puis ouvre-les en lançant ton regard le plus magnétique.',
      'Dis à voix très basse la chose la plus tentante que tu aies envie de lui faire ce soir.',
      'Laisse ton/ta partenaire choisir un gage surprise à réaliser à notre prochain rendez-vous.',
      'Envoie un baiser lent dans le cou… mimé face caméra avec intensité.',
      'Avoue un fantasme tendre ou audacieux que tu n’as jamais osé dire à voix haute.',
      'Rapproche tes lèvres à quelques centimètres de l’objectif et murmure « Je te veux ».',
    ],
  },
  en: {
    doux: [
      'Blow 3 slow-motion kisses straight into the camera.',
      'Hold warm eye contact for 10 full seconds without looking away.',
      'Whisper one heartfelt compliment in your softest voice.',
      'Trace a glowing heart in the air while smiling at the lens.',
      'Say your partner’s name in the sweetest tone you can.',
      'Share in one sentence the exact moment you fell for them.',
    ],
    seduction: [
      'Lean close to the camera and whisper a real secret barely above a breath.',
      'Slowly trace your collarbone while holding unbroken eye contact.',
      'Gently bite your lower lip for 4 seconds without laughing.',
      'Describe in 3 bold words what you will do the next time you meet.',
      'Give a daring compliment about your favorite feature on their face.',
      'Use your smoothest, velvet voice for the entire next round.',
    ],
    intense: [
      'Whisper an 8-second intimate wish for your next evening together.',
      'Close your eyes for 3 seconds, then open them with your most magnetic gaze.',
      'Say softly into the mic the most tempting thing on your mind tonight.',
      'Let your partner claim one custom date-night wish for your next reunion.',
      'Mime a slow, lingering kiss toward the lens with full intensity.',
      'Confess a bold romantic thought you have never said aloud before.',
    ],
  },
  ar: {
    doux: [
      'أرسل 3 قبلات بطيئة جداً نحو الكاميرا بابتسامة دافئة.',
      'انظر مباشرة في عيني شريكك لمدة 10 ثوانٍ كاملة دون تشتت.',
      'اهمس له بمجاملة صادقة ورومانسية بصوت خافت جداً.',
      'ارسم قلباً في الهواء بإصبعك مع نظرة حنونة.',
      'انطق اسم شريكك بأرقّ وألطف نبرة ممكنة.',
      'اذكر في جملة واحدة اللحظة التي وقعت فيها بحبه.',
    ],
    seduction: [
      'اقترب كثيراً من الكاميرا واهمس بسِر حقيقي بصوت ناعم.',
      'حافظ على نظرة ساحرة ومباشرة للكاميرا لمدة 6 ثوانٍ.',
      'صف في 3 كلمات ما ستفعله فور لقائكما القادم.',
      'أهدِ شريكك إطراءً جريئاً حول أجمل ما يعجبك في ملامحه.',
      'تحدث بنبرة هادئة ودافئة طوال الجولة القادمة.',
      'أرسل قبلة دافئة عبر لمس عدسة الكاميرا بلطف.',
    ],
    intense: [
      'اهمس في الميكروفون لمدة 8 ثوانٍ بتصور رومانسي لأمسيتكما القادمة.',
      'أغمض عينيك 3 ثوانٍ ثم افتحهما بأكثر نظرة جذابة لديك.',
      'قل بصوت منخفض أكثر فكرة رومانسية جريئة تدور في ذهنك الآن.',
      'دع شريكك يختار أمنية خاصة تنفذها في لقائكما القادم.',
      'أرسل قبلة بطيئة وعميقة نحو الكاميرا بكامل الإحساس.',
      'اعترف بأمنية عاطفية جميلة لم يسبق أن قلتها بصوت عالٍ.',
    ],
  },
};

export function pickWhisperIdea(
  lang: Language,
  level: WhisperLevel,
  excludeText?: string,
  rng: () => number = Math.random,
): string {
  const pool = WHISPER_PHRASES[lang]?.[level] ?? WHISPER_PHRASES.fr[level];
  if (pool.length <= 1) return pool[0] ?? '';
  const filtered = excludeText ? pool.filter((p) => p !== excludeText) : pool;
  const source = filtered.length > 0 ? filtered : pool;
  const idx = Math.floor(rng() * source.length) % source.length;
  return source[idx];
}

export function pickWhisperDare(
  lang: Language,
  level: WhisperLevel,
  excludeText?: string,
  rng: () => number = Math.random,
): string {
  const pool = WHISPER_DARES[lang]?.[level] ?? WHISPER_DARES.fr[level];
  if (pool.length <= 1) return pool[0] ?? '';
  const filtered = excludeText ? pool.filter((d) => d !== excludeText) : pool;
  const source = filtered.length > 0 ? filtered : pool;
  const idx = Math.floor(rng() * source.length) % source.length;
  return source[idx];
}

/**
 * Normalizes a secret phrase or user guess for forgiving matching:
 * - case-insensitive
 * - expands French ligatures (œ -> oe, æ -> ae)
 * - accent-insensitive (Unicode NFD diacritic strip)
 * - punctuation & extra-whitespace insensitive (works for Latin & Arabic scripts)
 */
export function normalizeGuessText(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/['’`´]/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Strip Arabic diacritics (tashkeel) and normalize alef variants
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isGuessMatch(secretText: string, guessText: string): boolean {
  const a = normalizeGuessText(secretText);
  const b = normalizeGuessText(guessText);
  if (!a || !b) return false;
  return a === b;
}

/**
 * Produces a clean length hint ("_ _   _ _ _ _") revealing only word lengths, never letters.
 */
export function formatWordHint(secretText: string): string {
  const words = secretText
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return '';

  return words
    .map((word) => {
      const letterCount = Array.from(word).filter((ch) => /[\p{L}\p{N}]/u.test(ch)).length;
      const count = Math.max(1, letterCount);
      return Array.from({ length: count }, () => '_').join(' ');
    })
    .join('   ·   ');
}

export function getWordHintLengths(secretText: string): number[] {
  return secretText
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const letterCount = Array.from(word).filter((ch) => /[\p{L}\p{N}]/u.test(ch)).length;
      return Math.max(1, letterCount);
    });
}

export interface LipPoint {
  x: number;
  y: number;
}

export function smoothLipPosition(
  prev: LipPoint,
  raw: LipPoint,
  alpha = 0.26,
): LipPoint {
  const clampedX = Math.max(0.15, Math.min(0.85, raw.x));
  const clampedY = Math.max(0.15, Math.min(0.85, raw.y));
  const a = Math.max(0.05, Math.min(1, alpha));
  return {
    x: prev.x + (clampedX - prev.x) * a,
    y: prev.y + (clampedY - prev.y) * a,
  };
}

/**
 * Tracks continuous kiss hold (mouthPucker > 0.65 held for >= 350ms).
 * Resets cleanly if mouthPucker drops below threshold.
 */
export function updateKissHoldDuration(
  prevHoldSec: number,
  mouthPucker: number,
  dtSec: number,
): { holdSec: number; triggered: boolean } {
  if (mouthPucker <= KISS_PUCKER_THRESHOLD) {
    return { holdSec: 0, triggered: false };
  }
  const safeDt = Math.max(0, Math.min(0.25, dtSec));
  const nextHold = prevHoldSec + safeDt;
  return {
    holdSec: nextHold,
    triggered: nextHold >= KISS_HOLD_REQUIRED_SEC,
  };
}

export type WhisperHeatOutcome = 'early_bonus' | 'guessed' | 'dare';

export function computeComplicityHeat(currentHeat: number, outcome: WhisperHeatOutcome): number {
  const delta = outcome === 'early_bonus' ? 18 : outcome === 'guessed' ? 12 : 6;
  return Math.max(0, Math.min(100, Math.round(currentHeat + delta)));
}

export function swapWhisperRole(role: WhisperRole): WhisperRole {
  return role === 'whisperer' ? 'guesser' : 'whisperer';
}
