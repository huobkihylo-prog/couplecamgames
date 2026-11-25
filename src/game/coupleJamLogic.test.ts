import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceJamRound,
  buildInitialsHint,
  computeJamPoints,
  computeMysteryBlurPx,
  createAirPlayMemory,
  detectAirPlayTriggers,
  JAM_MUSICAL_DARES,
  JAM_SONG_BANK,
  launchBlindTestRound,
  launchInstrumentRound,
  matchMusicalAnswer,
  normalizeMusicalText,
  resolveJamRound,
  SOLO_BLINDTEST_ARTISTS,
  startJamMatch,
  triggerJamBuzzer,
} from './coupleJamLogic';
import {
  DARBOUKA_ZONES,
  GUITAR_CHORDS,
  GUITAR_STRINGS,
  OUD_NOTES,
  PIANO_ACCIDENTAL_KEYS,
  PIANO_WHITE_KEYS,
} from '../services/jamAudioEngine';

test('curated song bank has at least 24 songs and all guide notes map to valid instrument note IDs', () => {
  assert.ok(JAM_SONG_BANK.length >= 24, `Expected >= 24 songs, got ${JAM_SONG_BANK.length}`);
  assert.ok(SOLO_BLINDTEST_ARTISTS.length >= 20, 'Expected >= 20 solo blind test artists');
  assert.ok(JAM_MUSICAL_DARES.length >= 10, 'Expected >= 10 musical dares');

  const validIds: Record<string, Set<string>> = {
    darbouka: new Set(DARBOUKA_ZONES.map((z) => z.id)),
    guitar: new Set([...GUITAR_STRINGS.map((s) => s.id), ...GUITAR_CHORDS.map((c) => c.id)]),
    piano: new Set([...PIANO_WHITE_KEYS.map((k) => k.id), ...PIANO_ACCIDENTAL_KEYS.map((k) => k.id)]),
    oud: new Set(OUD_NOTES.map((n) => n.id)),
  };

  for (const song of JAM_SONG_BANK) {
    assert.ok(song.guideNotes.length >= 6, `Song ${song.id} should have >= 6 guide notes`);
    const valid = validIds[song.recommendedInstrument];
    for (const step of song.guideNotes) {
      assert.ok(
        valid.has(step.noteId),
        `Invalid noteId ${step.noteId} for instrument ${song.recommendedInstrument} in ${song.id}`,
      );
    }
  }
});

test('smart musical answer matching ignores case, accents, feat suffixes, and minor typos', () => {
  assert.equal(normalizeMusicalText('La Lettre à Élise (feat. Orchestra)'), 'lettre elise');
  assert.equal(matchMusicalAnswer('bella ciao', 'Bella Ciao', 'La Casa de Papel'), true);
  assert.equal(matchMusicalAnswer('Bela Ciao', 'Bella Ciao', 'La Casa de Papel'), true);
  assert.equal(matchMusicalAnswer('aicha', 'Aïcha', 'Cheb Khaled'), true);
  assert.equal(matchMusicalAnswer('Cheb Khaled', 'Aïcha', 'Cheb Khaled', [], true), true);
  assert.equal(matchMusicalAnswer('stromaé', 'Papaoutai (feat. Remix)', 'Stromae', [], true), true);
  assert.equal(matchMusicalAnswer('completely wrong answer', 'Bella Ciao', 'La Casa de Papel'), false);
});

test('scoring awards +3 fast bonus, +2 mid, +1 late, and deducts 0.5 per hint cleanly', () => {
  const btFast = computeJamPoints('blind-test', 6.5, 0);
  assert.equal(btFast.points, 3);
  assert.equal(btFast.fastBonus, true);

  const btFastWithHint = computeJamPoints('blind-test', 8.0, 1);
  assert.equal(btFastWithHint.points, 2.5);
  assert.equal(btFastWithHint.fastBonus, true);

  const btLateWith2Hints = computeJamPoints('blind-test', 25, 2);
  assert.equal(btLateWith2Hints.points, 0.5); // minimum floor 0.5
  assert.equal(btLateWith2Hints.fastBonus, false);

  const instFast = computeJamPoints('guess-instrument', 15, 0);
  assert.equal(instFast.points, 3);
  assert.equal(instFast.fastBonus, true);

  const instMid = computeJamPoints('guess-instrument', 26, 0);
  assert.equal(instMid.points, 2);
  assert.equal(instMid.fastBonus, false);
});

test('blind test state machine handles launch, buzzer pause, reveal, role swap, and match completion', () => {
  let st = startJamMatch('blind-test', 5, false);
  assert.equal(st.phase, 'PREP');
  assert.equal(st.performer, 'host');

  st = launchBlindTestRound(st, {
    source: 'itunes',
    previewUrl: 'https://example.com/demo.m4a',
    artworkUrl: 'https://example.com/art.jpg',
    trackName: 'Papaoutai',
    artistName: 'Stromae',
    playbackRate: 1.35,
    duration: 30,
  });
  assert.equal(st.phase, 'PLAYING');
  assert.equal(st.timeLeftSec, 30);

  st = triggerJamBuzzer(st, 'guest');
  assert.equal(st.phase, 'BUZZER');
  assert.equal(st.isPaused, true);
  assert.equal(st.buzzerLeftSec, 6);

  // Guest answers fast (elapsed = 5s)
  st = resolveJamRound({ ...st, timeLeftSec: 25 }, true, 'Stromae');
  assert.equal(st.phase, 'REVEAL');
  assert.equal(st.scores.guest, 3);
  assert.equal(st.outcome?.fastBonus, true);
  assert.equal(st.outcome?.revealTitle, 'Papaoutai');

  st = advanceJamRound(st);
  assert.equal(st.phase, 'PREP');
  assert.equal(st.round, 2);
  assert.equal(st.performer, 'guest');

  // Round 5 finishes match
  const endState = advanceJamRound({ ...st, round: 5, phase: 'REVEAL' });
  assert.equal(endState.phase, 'MATCH_OVER');
  assert.ok(endState.finalDareText.length > 5);
});

test('instrument round miss awards 0 points and assigns a musical dare', () => {
  let st = startJamMatch('guess-instrument', 5, false);
  st = launchInstrumentRound(st, {
    songId: 'bella-ciao',
    title: 'Bella Ciao',
    artist: 'La Casa de Papel',
    category: 'Pop & Hits',
    instrument: 'piano',
    antiCheatMute: true,
  });
  assert.equal(st.phase, 'PLAYING');
  assert.equal(st.antiCheatMute, true);

  st = resolveJamRound({ ...st, timeLeftSec: 0 }, false);
  assert.equal(st.phase, 'REVEAL');
  assert.equal(st.scores.guest, 0);
  assert.equal(st.outcome?.guessed, false);
  assert.ok(st.outcome?.dareText && st.outcome.dareText.length > 5);
});

test('mystery blur clarifies over time, halves on hint, and hits 0 on reveal', () => {
  const startBlur = computeMysteryBlurPx(30, 30, false, false);
  const lateBlur = computeMysteryBlurPx(5, 30, false, false);
  const hintBlur = computeMysteryBlurPx(30, 30, true, false);
  const revealedBlur = computeMysteryBlurPx(15, 30, false, true);

  assert.ok(startBlur >= 24);
  assert.ok(lateBlur < startBlur);
  assert.ok(hintBlur < startBlur * 0.6);
  assert.equal(revealedBlur, 0);
  assert.equal(buildInitialsHint('Bella Ciao'), 'B•••• C•••');
});

test('air-play detector respects 160ms cooldown and guitar string crossing', () => {
  const mem = createAirPlayMemory();

  // Darbouka center hit (DOUM)
  const hit1 = detectAirPlayTriggers('darbouka', [{ id: 0, x: 0.5, y: 0.54, prevY: 0.45 }], mem, 1000);
  assert.deepEqual(hit1, ['doum']);

  // Immediate re-trigger within 160ms is blocked
  const blocked = detectAirPlayTriggers('darbouka', [{ id: 0, x: 0.5, y: 0.56, prevY: 0.48 }], mem, 1080);
  assert.deepEqual(blocked, []);

  // After 160ms with downward strike it fires again
  const hit2 = detectAirPlayTriggers('darbouka', [{ id: 0, x: 0.5, y: 0.56, prevY: 0.49 }], mem, 1200);
  assert.deepEqual(hit2, ['doum']);

  // Guitar crossing top string (sy = 0.16)
  const gMem = createAirPlayMemory();
  const strum = detectAirPlayTriggers('guitar', [{ id: 0, x: 0.5, y: 0.22, prevY: 0.1 }], gMem, 2000);
  assert.deepEqual(strum, ['s6']);
});
