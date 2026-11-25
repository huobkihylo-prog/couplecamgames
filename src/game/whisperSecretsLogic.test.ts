import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WHISPER_DARES,
  WHISPER_MAX_LENGTH,
  WHISPER_PHRASES,
  computeComplicityHeat,
  formatWordHint,
  getWordHintLengths,
  isGuessMatch,
  normalizeGuessText,
  pickWhisperDare,
  pickWhisperIdea,
  smoothLipPosition,
  swapWhisperRole,
  updateKissHoldDuration,
} from './whisperSecretsLogic.ts';

test('French phrase bank has >= 30 varied phrases across all 3 levels and respects 60-char max', () => {
  const fr = WHISPER_PHRASES.fr;
  assert.ok(fr.doux.length >= 10, 'doux should have at least 10 phrases');
  assert.ok(fr.seduction.length >= 10, 'seduction should have at least 10 phrases');
  assert.ok(fr.intense.length >= 10, 'intense should have at least 10 phrases');

  const allFr = [...fr.doux, ...fr.seduction, ...fr.intense];
  assert.ok(allFr.length >= 30, `expected >= 30 FR phrases, got ${allFr.length}`);
  assert.equal(new Set(allFr).size, allFr.length, 'all FR phrases should be unique');
  for (const phrase of allFr) {
    assert.ok(
      phrase.length <= WHISPER_MAX_LENGTH,
      `phrase exceeds ${WHISPER_MAX_LENGTH} chars: "${phrase}" (${phrase.length})`,
    );
  }
});

test('French dare bank has >= 18 varied webcam-friendly dares across all 3 levels', () => {
  const fr = WHISPER_DARES.fr;
  assert.ok(fr.doux.length >= 6);
  assert.ok(fr.seduction.length >= 6);
  assert.ok(fr.intense.length >= 6);

  const allFr = [...fr.doux, ...fr.seduction, ...fr.intense];
  assert.ok(allFr.length >= 18, `expected >= 18 FR dares, got ${allFr.length}`);
  assert.equal(new Set(allFr).size, allFr.length, 'all FR dares should be unique');
});

test('pickWhisperIdea and pickWhisperDare avoid immediate repeats', () => {
  const first = WHISPER_PHRASES.fr.seduction[0];
  const picked = pickWhisperIdea('fr', 'seduction', first, () => 0);
  assert.notEqual(picked, first);

  const firstDare = WHISPER_DARES.fr.intense[0];
  const pickedDare = pickWhisperDare('fr', 'intense', firstDare, () => 0);
  assert.notEqual(pickedDare, firstDare);
});

test('normalizeGuessText and isGuessMatch ignore case, French accents, ligatures, and punctuation', () => {
  assert.equal(normalizeGuessText('  Mon Cœur bat pour toi ! '), 'mon coeur bat pour toi');
  assert.equal(isGuessMatch('Mon cœur bat pour toi', 'MON COEUR BAT POUR TOI!'), true);
  assert.equal(isGuessMatch('J’ai pensé à toi toute la journée', "J'ai pense a toi toute la journee."), true);
  assert.equal(isGuessMatch('Embrasse-moi vite', 'embrasse moi vite'), true);
  assert.equal(isGuessMatch('Tu es magnifique', 'Tu es fantastique'), false);
  assert.equal(isGuessMatch('Tu es magnifique', '   '), false);
});

test('formatWordHint and getWordHintLengths reveal only blanks and word sizes', () => {
  assert.equal(formatWordHint('Je t’aime'), '_ _   ·   _ _ _ _ _');
  assert.deepEqual(getWordHintLengths('Mon cœur bat'), [3, 4, 3]);
  assert.equal(formatWordHint('   '), '');
});

test('smoothLipPosition clamps extreme coordinates and interpolates smoothly', () => {
  const next = smoothLipPosition({ x: 0.5, y: 0.5 }, { x: 0.99, y: 0.02 }, 0.5);
  assert.ok(Math.abs(next.x - 0.675) < 1e-6);
  assert.ok(Math.abs(next.y - 0.325) < 1e-6);
});

test('updateKissHoldDuration requires mouthPucker > 0.65 sustained for >= 350ms', () => {
  // Below threshold does not accumulate
  const low = updateKissHoldDuration(0.2, 0.65, 0.2);
  assert.equal(low.holdSec, 0);
  assert.equal(low.triggered, false);

  // Above threshold for 200ms -> not yet triggered
  const step1 = updateKissHoldDuration(0, 0.72, 0.2);
  assert.equal(step1.triggered, false);
  assert.ok(Math.abs(step1.holdSec - 0.2) < 1e-6);

  // Another 160ms -> 360ms >= 350ms -> triggered!
  const step2 = updateKissHoldDuration(step1.holdSec, 0.78, 0.16);
  assert.equal(step2.triggered, true);
  assert.ok(step2.holdSec >= 0.35);
});

test('computeComplicityHeat increments cleanly and clamps within 0..100', () => {
  assert.equal(computeComplicityHeat(20, 'early_bonus'), 38);
  assert.equal(computeComplicityHeat(20, 'guessed'), 32);
  assert.equal(computeComplicityHeat(20, 'dare'), 26);
  assert.equal(computeComplicityHeat(95, 'early_bonus'), 100);
});

test('swapWhisperRole alternates whisperer and guesser cleanly', () => {
  assert.equal(swapWhisperRole('whisperer'), 'guesser');
  assert.equal(swapWhisperRole('guesser'), 'whisperer');
});
