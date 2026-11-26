import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQuizRoundsFromTracks,
  planSoloAiQuizAnswer,
  resolveQuizRoundScores,
  scoreQuizAnswer,
  MUSIC_QUIZ_CATEGORIES,
} from './musicQuizLogic';
import { dedupeItunesTracks, type ItunesTrack } from '../services/itunesAudioEngine';

function makeTrack(id: number, trackName: string, artistName: string): ItunesTrack {
  return {
    trackId: id,
    trackName,
    artistName,
    collectionName: 'Album',
    previewUrl: `https://audio-ssl.itunes.apple.com/preview/${id}.m4a`,
    artworkUrl: `https://is1-ssl.mzstatic.com/image/${id}/100x100bb.jpg`,
    artworkUrlHiRes: `https://is1-ssl.mzstatic.com/image/${id}/400x400bb.jpg`,
  };
}

test('dedupeItunesTracks removes duplicate titles and invalid previews', () => {
  const input: ItunesTrack[] = [
    makeTrack(1, 'Lm3allem', 'Saad Lamjarred'),
    makeTrack(2, 'Lm3allem (Radio Edit)', 'Saad Lamjarred'),
    { ...makeTrack(3, 'No Preview Song', 'Artist'), previewUrl: '' },
    makeTrack(4, 'Aïcha', 'Cheb Khaled'),
  ];
  const deduped = dedupeItunesTracks(input);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].trackName, 'Lm3allem');
  assert.equal(deduped[1].trackName, 'Aïcha');
});

test('buildQuizRoundsFromTracks builds 5 rounds with 4 unique options and valid correctIndex', () => {
  const pool = [
    makeTrack(1, 'Lm3allem', 'Saad Lamjarred'),
    makeTrack(2, 'Aïcha', 'Cheb Khaled'),
    makeTrack(3, 'Mghayer', 'ElGrandeToto'),
    makeTrack(4, 'Slay', 'Manal'),
    makeTrack(5, 'Décapotable', 'Zouhair Bahaoui'),
    makeTrack(6, 'Ya Tabtab', 'Nancy Ajram'),
    makeTrack(7, 'Tamally Maak', 'Amr Diab'),
  ];
  let seed = 0.25;
  const rng = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const rounds = buildQuizRoundsFromTracks(pool, 5, rng);
  assert.equal(rounds.length, 5);
  for (let i = 0; i < rounds.length; i += 1) {
    const r = rounds[i];
    assert.equal(r.round, i + 1);
    assert.equal(r.totalRounds, 5);
    assert.equal(r.options.length, 4);
    assert.ok(r.correctIndex >= 0 && r.correctIndex < 4);
    const titles = new Set(r.options.map((o) => o.title));
    assert.equal(titles.size, 4);
    assert.ok(r.previewUrl.startsWith('https://'));
  }
});

test('scoreQuizAnswer awards +3 (<5s), +2 (<10s), +1 (<15s), 0 on wrong', () => {
  assert.equal(scoreQuizAnswer(2.4, true), 3);
  assert.equal(scoreQuizAnswer(4.99, true), 3);
  assert.equal(scoreQuizAnswer(5.0, true), 2);
  assert.equal(scoreQuizAnswer(9.8, true), 2);
  assert.equal(scoreQuizAnswer(10.0, true), 1);
  assert.equal(scoreQuizAnswer(14.9, true), 1);
  assert.equal(scoreQuizAnswer(2.0, false), 0);
});

test('resolveQuizRoundScores awards +1 speed bonus strictly to fastest correct player', () => {
  const res = resolveQuizRoundScores(
    { optionIndex: 2, elapsedSec: 4.1, isCorrect: true },
    { optionIndex: 2, elapsedSec: 7.4, isCorrect: true },
  );
  assert.equal(res.fastestPlayer, 'host');
  assert.equal(res.hostBasePoints, 3);
  assert.equal(res.hostSpeedBonus, 1);
  assert.equal(res.hostTotalPoints, 4);
  assert.equal(res.guestBasePoints, 2);
  assert.equal(res.guestSpeedBonus, 0);
  assert.equal(res.guestTotalPoints, 2);

  const resGuestOnly = resolveQuizRoundScores(
    { optionIndex: 0, elapsedSec: 2.0, isCorrect: false },
    { optionIndex: 2, elapsedSec: 11.2, isCorrect: true },
  );
  assert.equal(resGuestOnly.fastestPlayer, 'guest');
  assert.equal(resGuestOnly.hostTotalPoints, 0);
  assert.equal(resGuestOnly.guestTotalPoints, 2); // 1 base + 1 speed bonus
});

test('planSoloAiQuizAnswer responds within 3s to 11s', () => {
  for (let i = 0; i < 30; i += 1) {
    const plan = planSoloAiQuizAnswer(1);
    assert.ok(plan.delaySec >= 3 && plan.delaySec <= 11);
    assert.ok(plan.optionIndex >= 0 && plan.optionIndex <= 3);
    assert.equal(plan.isCorrect, plan.optionIndex === 1);
  }
});

test('rai-chaabi category includes requested Maghreb & Oriental artists', () => {
  const rai = MUSIC_QUIZ_CATEGORIES.find((c) => c.id === 'rai-chaabi');
  assert.ok(rai);
  const terms = [...rai.primaryTerms, ...rai.fallbackTerms];
  for (const artist of [
    'Saad Lamjarred',
    'Cheb Khaled',
    'Cheb Hasni',
    'ElGrandeToto',
    'Manal',
    'Zouhair Bahaoui',
    'Nancy Ajram',
    'Amr Diab',
  ]) {
    assert.ok(terms.includes(artist), `Missing artist ${artist}`);
  }
});
