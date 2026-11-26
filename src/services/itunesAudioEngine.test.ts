import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupeItunesTracks,
  DEFAULT_AUDIO_VOLUME,
  isAbortAudioError,
  isAutoplayBlockedError,
  isValidHttpsPreviewUrl,
  ITUNES_JSONP_TIMEOUT_MS,
  parseRawItunesResults,
  PLAYBACK_STALL_TIMEOUT_MS,
  SharedMusicAudioPlayer,
  type ItunesTrack,
  type SharedAudioElementLike,
} from './itunesAudioEngine';

function createFakeAudio(overrides?: Partial<SharedAudioElementLike>) {
  let playBehavior: (() => Promise<void> | undefined) | null = null;
  let pauseCalls = 0;
  let loadCalls = 0;
  let playCalls = 0;
  const attrs = new Map<string, string>();

  const el: SharedAudioElementLike = {
    src: '',
    preload: '',
    volume: 1,
    muted: false,
    loop: false,
    paused: true,
    currentTime: 0,
    readyState: 0,
    crossOrigin: undefined,
    play: () => {
      playCalls += 1;
      el.paused = false;
      if (playBehavior) return playBehavior();
      el.onplay?.();
      el.onplaying?.();
      return Promise.resolve();
    },
    pause: () => {
      pauseCalls += 1;
      el.paused = true;
      el.onpause?.();
    },
    load: () => {
      loadCalls += 1;
    },
    setAttribute: (k, v) => {
      attrs.set(k, v);
    },
    removeAttribute: (k) => {
      if (k === 'src') el.src = '';
      attrs.delete(k);
    },
    onplay: null,
    onplaying: null,
    ontimeupdate: null,
    onpause: null,
    onended: null,
    onerror: null,
    ...overrides,
  };

  return {
    el,
    setPlayBehavior(fn: () => Promise<void> | undefined) {
      playBehavior = fn;
    },
    stats: () => ({ playCalls, pauseCalls, loadCalls, attrs }),
  };
}

test('Audio engine constants match 7s JSONP timeout, 4s stall watchdog, and 0.85 default volume', () => {
  assert.equal(ITUNES_JSONP_TIMEOUT_MS, 7000);
  assert.equal(PLAYBACK_STALL_TIMEOUT_MS, 4000);
  assert.equal(DEFAULT_AUDIO_VOLUME, 0.85);
});

test('dedupeItunesTracks strictly keeps only valid https:// previewUrl entries and deduplicates', () => {
  const sample: ItunesTrack[] = [
    {
      trackId: 1,
      trackName: 'Blinding Lights',
      artistName: 'The Weeknd',
      collectionName: 'After Hours',
      previewUrl: 'https://audio-ssl.itunes.apple.com/track1.m4a',
      artworkUrl: '',
      artworkUrlHiRes: '',
    },
    {
      trackId: 2,
      trackName: 'Insecure Track',
      artistName: 'Someone',
      collectionName: 'Old',
      previewUrl: 'http://audio.itunes.apple.com/http-only.m4a',
      artworkUrl: '',
      artworkUrlHiRes: '',
    },
    {
      trackId: 3,
      trackName: 'Blinding Lights (Radio Edit)',
      artistName: 'The Weeknd',
      collectionName: 'After Hours',
      previewUrl: 'https://audio-ssl.itunes.apple.com/track1-dup.m4a',
      artworkUrl: '',
      artworkUrlHiRes: '',
    },
  ];

  assert.equal(isValidHttpsPreviewUrl('https://audio-ssl.itunes.apple.com/a.m4a'), true);
  assert.equal(isValidHttpsPreviewUrl('http://audio-ssl.itunes.apple.com/a.m4a'), false);
  assert.equal(isValidHttpsPreviewUrl(''), false);

  const out = dedupeItunesTracks(sample);
  assert.equal(out.length, 1);
  assert.equal(out[0].trackId, 1);
});

test('SharedMusicAudioPlayer uses one persistent HTMLAudioElement, never sets crossOrigin, and sets volume 0.85', async () => {
  let factoryCalls = 0;
  const fake = createFakeAudio();
  const player = new SharedMusicAudioPlayer({
    audioFactory: () => {
      factoryCalls += 1;
      return fake.el;
    },
  });

  const res1 = await player.playTrack('https://audio-ssl.itunes.apple.com/song-a.m4a');
  const res2 = await player.playTrack('https://audio-ssl.itunes.apple.com/song-b.m4a');

  assert.equal(res1.ok, true);
  assert.equal(res2.ok, true);
  assert.equal(factoryCalls, 1, 'Must reuse a single persistent HTMLAudioElement');
  assert.equal(fake.el.crossOrigin, undefined, 'Must NEVER set crossOrigin on iTunes audio');
  assert.equal(fake.el.preload, 'auto');
  assert.equal(fake.el.volume, 0.85);
});

test('unlock() resolving after playTrack() starts NEVER pauses or wipes the real track', async () => {
  const fake = createFakeAudio();
  let resolveUnlockPlay!: () => void;
  let callIndex = 0;

  fake.setPlayBehavior(() => {
    callIndex += 1;
    if (callIndex === 1) {
      return new Promise<void>((resolve) => {
        resolveUnlockPlay = resolve;
      });
    }
    fake.el.onplay?.();
    fake.el.onplaying?.();
    return Promise.resolve();
  });

  const player = new SharedMusicAudioPlayer({
    audioFactory: () => fake.el,
  });

  player.unlock();
  const playPromise = player.playTrack('https://audio-ssl.itunes.apple.com/real-hit.m4a');

  // Resolve the earlier silent WAV unlock promise AFTER playTrack was already invoked
  resolveUnlockPlay();
  const result = await playPromise;

  assert.equal(result.ok, true);
  assert.equal(fake.el.src, 'https://audio-ssl.itunes.apple.com/real-hit.m4a');
  assert.equal(fake.el.muted, false);
  assert.equal(player.isPlaying(), true);
});

test('AbortError during rapid play/pause or track switch is silently ignored without failing track', async () => {
  const fake = createFakeAudio();
  const failed: string[] = [];
  const blockedEvents: boolean[] = [];

  fake.setPlayBehavior(() => {
    const err = new Error('The play() request was interrupted by a call to pause().');
    err.name = 'AbortError';
    return Promise.reject(err);
  });

  assert.equal(isAbortAudioError(Object.assign(new Error('interrupted'), { name: 'AbortError' })), true);

  const player = new SharedMusicAudioPlayer({
    audioFactory: () => fake.el,
    onTrackFailed: (u) => failed.push(u),
    onAutoplayBlocked: (b) => blockedEvents.push(b),
  });

  const res = await player.playTrack('https://audio-ssl.itunes.apple.com/song-abort.m4a');
  assert.equal(res.aborted, true);
  assert.equal(res.blocked, false);
  assert.equal(failed.length, 0, 'AbortError must NOT trigger track failure');
  assert.equal(blockedEvents.length, 0, 'AbortError must NOT flag autoplay blocked');
});

test('NotAllowedError triggers autoplay-blocked callback and resumeAfterGesture recovers cleanly', async () => {
  const fake = createFakeAudio();
  const blockedEvents: boolean[] = [];
  const failed: string[] = [];
  let shouldBlock = true;

  fake.setPlayBehavior(() => {
    if (shouldBlock) {
      const err = new Error('play() failed because the user did not interact with the document first.');
      err.name = 'NotAllowedError';
      return Promise.reject(err);
    }
    fake.el.onplay?.();
    fake.el.onplaying?.();
    return Promise.resolve();
  });

  assert.equal(isAutoplayBlockedError(Object.assign(new Error('not allowed'), { name: 'NotAllowedError' })), true);

  const player = new SharedMusicAudioPlayer({
    audioFactory: () => fake.el,
    onAutoplayBlocked: (b) => blockedEvents.push(b),
    onTrackFailed: (u) => failed.push(u),
  });

  const first = await player.playTrack('https://audio-ssl.itunes.apple.com/mobile.m4a');
  assert.equal(first.ok, false);
  assert.equal(first.blocked, true);
  assert.equal(blockedEvents[blockedEvents.length - 1], true);
  assert.equal(failed.length, 0);

  shouldBlock = false;
  const resumed = await player.resumeAfterGesture();
  assert.equal(resumed, true);
  assert.equal(blockedEvents[blockedEvents.length - 1], false);
});

test('media error and stall timeout trigger onTrackFailed for auto-skip, while stopAndCleanup stays silent', async () => {
  const fake = createFakeAudio();
  const failures: Array<{ url: string; reason: string }> = [];

  // Never resolve play() to simulate a stalled stream
  fake.setPlayBehavior(() => new Promise<void>(() => {}));

  const player = new SharedMusicAudioPlayer({
    audioFactory: () => fake.el,
    stallTimeoutMs: 40,
    onTrackFailed: (url, reason) => failures.push({ url, reason }),
  });

  void player.playTrack('https://audio-ssl.itunes.apple.com/stalled.m4a');
  await new Promise((r) => setTimeout(r, 80));

  assert.equal(failures.length, 1);
  assert.equal(failures[0].url, 'https://audio-ssl.itunes.apple.com/stalled.m4a');
  assert.equal(failures[0].reason, 'stall-timeout');

  // Now simulate onerror on a broken track
  const fake2 = createFakeAudio();
  fake2.setPlayBehavior(() => {
    fake2.el.onerror?.();
    return Promise.resolve();
  });
  const failures2: Array<{ url: string; reason: string }> = [];
  const player2 = new SharedMusicAudioPlayer({
    audioFactory: () => fake2.el,
    onTrackFailed: (url, reason) => failures2.push({ url, reason }),
  });

  await player2.playTrack('https://audio-ssl.itunes.apple.com/broken.m4a');
  assert.equal(failures2.length, 1);
  assert.equal(failures2[0].reason, 'media-error');

  // Calling stopAndCleanup and firing onerror afterward must NOT emit onTrackFailed
  player2.stopAndCleanup();
  fake2.el.onerror?.();
  assert.equal(failures2.length, 1);
});

test('parseRawItunesResults parses proxy/iTunes/Deezer normalized payloads and filters out non-HTTPS previews', () => {
  const tracks = parseRawItunesResults({
    resultCount: 3,
    results: [
      {
        trackId: 101,
        trackName: 'Levitating',
        artistName: 'Dua Lipa',
        collectionName: 'Future Nostalgia',
        previewUrl: 'https://cdnt-preview.dzcdn.net/api/1/1/levitating.mp3',
        artworkUrl100: 'https://e-cdns-images.dzcdn.net/images/cover/abc/500x500-000000-80-0-0.jpg',
      },
      {
        trackId: 102,
        trackName: 'Invalid Preview',
        artistName: 'Nobody',
        previewUrl: 'http://insecure.example.com/a.mp3',
      },
      {
        trackId: 103,
        trackName: 'Blinding Lights',
        artistName: 'The Weeknd',
        previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/track.m4a',
        artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/100x100bb.jpg',
      },
    ],
  });

  assert.equal(tracks.length, 2);
  assert.equal(tracks[0].trackName, 'Levitating');
  assert.equal(tracks[0].previewUrl.startsWith('https://'), true);
  assert.equal(tracks[1].artworkUrlHiRes.includes('400x400bb'), true);
});
