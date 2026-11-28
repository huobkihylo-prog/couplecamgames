/**
 * Verified Apple iTunes preview catalog (permanent unsigned audio-ssl.itunes.apple.com M4A previews).
 * Used strictly as a resilient last-resort safety net when live iTunes/Apple RSS/Deezer searches
 * are blocked or rate-limited (e.g. mobile 5G CGNAT 429 or iOS WebKit ITP inside embedded iframes).
 */

import type { ItunesTrack } from "../services/itunesAudioEngine";

interface CompactVerifiedTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  previewUrl: string;
  artworkUrl: string;
}

const RAW_VERIFIED_CATALOG: Record<string, readonly CompactVerifiedTrack[]> = {
  "quiz:all-hits": [
    {
      "trackId": 1676308593,
      "trackName": "Blinding Lights (Live)",
      "artistName": "The Weeknd",
      "collectionName": "Live At SoFi Stadium",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/97/37/18/97371865-a05c-3e72-3085-6ec952214c6b/mzaf_6605689750628043254.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/03/2d/c1/032dc13a-dce4-672a-b501-d16d3b31be07/23UMGIM20988.rgb.jpg/100x100bb.jpg"
    },
    {
      "trackId": 992389153,
      "trackName": "Lamaallem",
      "artistName": "Saad Lamjarred",
      "collectionName": "Lamaallem - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/10/8b/58/108b58ff-13d3-9c63-f656-a4edf255631d/mzaf_8631182694702136423.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music1/v4/f2/60/8c/f2608cc5-2a01-3dd7-a3e5-58364d6971c9/444676.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1444872841,
      "trackName": "Alors on danse",
      "artistName": "Stromae",
      "collectionName": "Alors on danse - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/87/84/ae/8784ae2b-8e39-0053-23ad-940bf2f69d87/mzaf_16356168226426243495.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/a8/69/90/a869906a-dd48-b772-785b-871459b36df2/10UMGIM03438.rgb.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1538003843,
      "trackName": "Levitating",
      "artistName": "Dua Lipa",
      "collectionName": "Future Nostalgia",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/59/dc/4d/59dc4dda-93ff-8f1c-c536-f005f6ea6af5/mzaf_3066686759813252385.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/6c/11/d6/6c11d681-aa3a-d59e-4c2e-f77e181026ab/190295092665.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1515962883,
      "trackName": "Djadja (feat. Maluma) [Remix]",
      "artistName": "Aya Nakamura",
      "collectionName": "Djadja (feat. Maluma) [Remix] - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/25/d5/d4/25d5d40e-d4a3-b331-4c96-d58352ca0572/mzaf_201874037025452055.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/0a/fb/17/0afb1761-a448-0d5c-0924-00cfa110dd2d/190295200220.jpg/100x100bb.jpg"
    },
    {
      "trackId": 943946671,
      "trackName": "Uptown Funk (feat. Bruno Mars)",
      "artistName": "Mark Ronson",
      "collectionName": "Uptown Special",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/91/99/1f/91991fe5-aa77-87e4-edbc-6d68c95e5f18/mzaf_10685317694850942114.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/7e/30/c5/7e30c572-aa47-5f7b-c6fd-42d50cd2c56d/886444959797.jpg/100x100bb.jpg"
    },
    {
      "trackId": 749321955,
      "trackName": "Bella",
      "artistName": "GIMS",
      "collectionName": "Subliminal la face cachée",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/da/65/36/da653671-307d-2a5a-9a40-5fc39b06884c/mzaf_13624804469544949041.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/0d/d7/a8/0dd7a80c-a96b-0b9b-97e4-5a8ee603032d/dj.cnmkrwhy.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1444321282,
      "trackName": "Diamonds",
      "artistName": "Rihanna",
      "collectionName": "Diamonds - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/26/97/fb/2697fb36-8ef2-9d18-0a2e-6545947b4445/mzaf_9032202105098805603.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/a0/1a/10/a01a1080-7b1d-e475-a03c-394e5cbba66c/12UMGIM53876.rgb.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1444050114,
      "trackName": "Aicha",
      "artistName": "Khaled",
      "collectionName": "Hafla (Live)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/65/06/85/650685d0-f95b-226a-0a23-5f323e418a56/mzaf_8168518316703416063.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/16/72/6b/16726b64-b2bd-33a1-a54d-aa582748d87e/00731453988125.rgb.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1122773680,
      "trackName": "Viva La Vida",
      "artistName": "Coldplay",
      "collectionName": "Viva La Vida or Death and All His Friends",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/a3/30/8e/a3308eed-d8b7-e0b3-f09d-5e1b0f4d660a/mzaf_8517946447501075134.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/52/aa/85/52aa851f-15b7-6322-f91f-df84b15b7b19/190295978044.jpg/100x100bb.jpg"
    },
    {
      "trackId": 617154366,
      "trackName": "Get Lucky",
      "artistName": "Daft Punk, Pharrell Williams & Nile Rodgers",
      "collectionName": "Random Access Memories",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/57/a5/85/57a585aa-f1bc-7619-881b-f8a04a5541d5/mzaf_6906185026678279401.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/100x100bb.jpg"
    },
    {
      "trackId": 371784883,
      "trackName": "Waka Waka (This Time for Africa) [The Official 2010 FIFA World Cup (TM) Song] [feat. Freshlyground] [Single]",
      "artistName": "Shakira",
      "collectionName": "Listen Up! The Official 2010 FIFA World Cup Album",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/98/88/e5/9888e55d-4daf-0e96-480b-a38259013586/mzaf_9048311608369053538.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/3e/3a/73/3e3a73da-e19e-b26c-ec19-9da6a5da93fa/mzi.ixhiugev.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1193701392,
      "trackName": "Shape of You",
      "artistName": "Ed Sheeran",
      "collectionName": "÷ (Deluxe)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/44/c7/4f/44c74f0d-72dc-6143-d4d0-ba14d661ca0d/mzaf_9566898362556366703.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/15/e6/e8/15e6e8a4-4190-6a8b-86c3-ab4a51b88288/190295851286.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1440830407,
      "trackName": "Dernière danse",
      "artistName": "Indila",
      "collectionName": "Mini World",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/a9/e8/a2/a9e8a200-80a0-41d2-5a55-ebcdfb55980d/mzaf_14817390791569895987.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/49/58/30/49583018-308b-431d-c691-4a28e78be8cd/14UMGIM01109.rgb.jpg/100x100bb.jpg"
    },
    {
      "trackId": 269573364,
      "trackName": "Billie Jean",
      "artistName": "Michael Jackson",
      "collectionName": "Thriller",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/dc/bc/8a/dcbc8a3e-4ce1-c00d-cc02-eda2212053c7/mzaf_8347559338388601510.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/32/4f/fd/324ffda2-9e51-8f6a-0c2d-c6fd2b41ac55/074643811224.jpg/100x100bb.jpg"
    },
    {
      "trackId": 863835363,
      "trackName": "Happy (From \"Despicable Me 2\")",
      "artistName": "Pharrell Williams",
      "collectionName": "G I R L",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/ed/a0/19/eda019cf-2794-66d1-208d-2e2e74c26c3d/mzaf_16469762943852039623.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/76/ff/5e/76ff5ee0-7ab4-2ac2-2598-486a9ccc06e1/886444516877.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1041473132,
      "trackName": "Sapés comme jamais (feat. Niska) [Pilule Bleue]",
      "artistName": "GIMS",
      "collectionName": "Mon cœur avait raison",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/22/8a/16/228a164a-f332-8d69-7dcf-f75c17aac046/mzaf_233589998052192942.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/39/e2/bd/39e2bd70-a7da-2815-cf12-0cb9f6f62ba0/886445517385.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1674691586,
      "trackName": "Flowers",
      "artistName": "Miley Cyrus",
      "collectionName": "Endless Summer Vacation",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/68/9e/f7/689ef7fe-14fe-a846-c87f-7d3b2d6344b1/mzaf_4167137058064023087.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/8c/67/ff/8c67ff91-31c3-3fef-1884-ce3ec89f3af4/196589946874.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1161504024,
      "trackName": "24K Magic",
      "artistName": "Bruno Mars",
      "collectionName": "24K Magic",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/45/c4/cb/45c4cb28-670f-f1fe-9678-7fa1601bbb5a/mzaf_2006385778979520718.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/e3/47/a0/e347a0cc-87ce-5d05-d560-176c7d48f66e/075679904119.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1505683980,
      "trackName": "Save Your Tears",
      "artistName": "The Weeknd",
      "collectionName": "After Hours (Deluxe)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/8b/38/17/8b3817e4-c0e9-7e02-2654-3e2ecee93603/mzaf_18415642125637540903.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/83/3a/f7/833af71b-2e0c-3303-24f5-8f5c546c073b/20UMGIM21167.rgb.jpg/100x100bb.jpg"
    }
  ],
  "quiz:pop-intl": [
    {
      "trackId": 1484636829,
      "trackName": "Don't Start Now",
      "artistName": "Dua Lipa",
      "collectionName": "Don't Start Now - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/24/3d/34/243d3413-a0fc-b229-f54a-1715ebd3a9ca/mzaf_11578996572221800393.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/41/ee/66/41ee66fa-f8dd-7e82-155a-3a1b360dc562/190295322175.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1440870375,
      "trackName": "Starboy (feat. Daft Punk)",
      "artistName": "The Weeknd",
      "collectionName": "Starboy",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/11/71/d6/1171d6ad-3c96-e027-2af6-58028426588c/mzaf_15137631797407745471.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b5/92/bb/b592bb72-52e3-e756-9b26-9f56d08f47ab/16UMGIM67864.rgb.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1441154437,
      "trackName": "Umbrella (feat. JAŸ-Z)",
      "artistName": "Rihanna",
      "collectionName": "Good Girl Gone Bad: Reloaded",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/7b/45/22/7b452241-882c-409b-3a9b-23306b14286a/mzaf_8588243939716013218.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/2b/c0/81/2bc081c8-25f0-ba43-d451-587a54613778/16UMGIM59202.rgb.jpg/100x100bb.jpg"
    },
    {
      "trackId": 573962551,
      "trackName": "Locked Out of Heaven",
      "artistName": "Bruno Mars",
      "collectionName": "Unorthodox Jukebox",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/d5/05/04/d5050434-1278-6b8e-9cd8-6261ea319fd1/mzaf_9746689865251353718.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e0/a4/7c/e0a47c6f-005a-9f9f-ce29-8e858e2bcfcb/075679957283.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1450695739,
      "trackName": "bad guy",
      "artistName": "Billie Eilish",
      "collectionName": "WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/c3/87/1f/c3871f7e-3260-d615-1c66-5fdca2c3a48f/mzaf_10721331211699880949.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1a/37/d1/1a37d1b1-8508-54f2-f541-bf4e437dda76/19UMGIM05028.rgb.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1440933651,
      "trackName": "Shake It Off",
      "artistName": "Taylor Swift",
      "collectionName": "1989 (Deluxe Edition)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/11/d5/6d/11d56d4a-ce23-e793-8681-70dc4d35d931/mzaf_5886436202259848624.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a7/98/d8/a798d867-344d-2bf2-fbfe-d2d1412dcef8/14UMDIM03793.rgb.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1193701400,
      "trackName": "Perfect",
      "artistName": "Ed Sheeran",
      "collectionName": "÷ (Deluxe)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/c7/ba/bc/c7babc66-f598-aaa6-bcf6-307281795817/mzaf_16337361235117168274.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/15/e6/e8/15e6e8a4-4190-6a8b-86c3-ab4a51b88288/190295851286.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1817217063,
      "trackName": "Hips Don't Lie (feat. Wyclef Jean)",
      "artistName": "Shakira",
      "collectionName": "Oral Fixation, Vol. 2 (Expanded Edition)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/ac/c7/61/acc7619f-c1e3-e0a5-df9b-0329a35af062/mzaf_13106936727189536738.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/0d/b5/8a/0db58a8b-7b17-dd53-3464-116a415d0f49/196872648836.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1445294323,
      "trackName": "Poker Face (Piano & Voice Version) [Live]",
      "artistName": "Lady Gaga",
      "collectionName": "The Cherrytree Sessions (Live) - EP",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/0d/59/63/0d5963d2-53fa-49ed-e071-3ae94b7741b0/mzaf_14015742864021737007.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/47/cb/59/47cb59b3-3848-b235-b038-dd5dc62f66e7/00602517988811.rgb.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1122782283,
      "trackName": "Yellow",
      "artistName": "Coldplay",
      "collectionName": "Parachutes",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/66/f3/1a/66f31a76-a6ed-cb4c-f353-23310a7ae9a8/mzaf_10593596652344378873.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/f5/93/8c/f5938c49-964c-31d1-4b33-78b634f71fb7/190295978075.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1544491233,
      "trackName": "Rolling in the Deep",
      "artistName": "Adele",
      "collectionName": "21",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/4c/4f/03/4c4f032a-3d2b-853d-da81-996602355b42/mzaf_11625850023134180491.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/eb/ca/25/ebca2596-cd1e-b295-91a3-771c868d0a79/191404113868.png/100x100bb.jpg"
    },
    {
      "trackId": 201274644,
      "trackName": "Crazy in Love (feat. JAŸ-Z)",
      "artistName": "Beyoncé",
      "collectionName": "Dangerously in Love",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/7a/7f/b3/7a7fb397-c707-f7a6-93be-1db3cd1c7fcb/mzaf_10719026518601275807.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music/03/c5/d4/mzi.ldvrmhxt.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1440829610,
      "trackName": "Sorry",
      "artistName": "Justin Bieber",
      "collectionName": "Purpose (Deluxe)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/66/eb/29/66eb29c0-c2f9-d9df-8af3-3bf2562c9d7c/mzaf_4099789285264521999.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/75/11/84/751184b0-77df-1eff-bb20-dac03247425d/15UMGIM59808.rgb.jpg/100x100bb.jpg"
    },
    {
      "trackId": 882945383,
      "trackName": "Chandelier",
      "artistName": "Sia",
      "collectionName": "1000 Forms of Fear",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/f0/de/66/f0de661c-299a-b7ae-80d9-4f35f79875b1/mzaf_10598240417031133475.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/00/bf/72/00bf72a2-3e50-e5e7-ae78-dc35bbf9bcda/886444578219.jpg/100x100bb.jpg"
    },
    {
      "trackId": 716192625,
      "trackName": "Firework",
      "artistName": "Katy Perry",
      "collectionName": "Teenage Dream",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/ab/27/3b/ab273b22-1eb1-dd49-5332-5ef70c35683b/mzaf_4912325324633099647.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/c8/d3/42/c8d342af-26d9-3ec2-c511-e1eaf860e299/13UABIM57787.rgb.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1615585008,
      "trackName": "As It Was",
      "artistName": "Harry Styles",
      "collectionName": "Harry's House",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/67/10/16/67101606-3869-ca44-6c03-e13d6322cb51/mzaf_1135399237022217274.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/2a/19/fb/2a19fb85-2f70-9e44-f2a9-82abe679b88e/886449990061.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1440855562,
      "trackName": "Sugar",
      "artistName": "Maroon 5",
      "collectionName": "V (Deluxe)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/1b/3f/68/1b3f68e0-3c42-f367-cd0f-e46c746e0668/mzaf_15052021441666328650.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/b7/25/76/b72576f1-072e-3da2-60d5-2724a9bccf4a/14UMGIM31673.rgb.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1440872929,
      "trackName": "Wake Me Up",
      "artistName": "Avicii",
      "collectionName": "True",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/68/1e/60/681e601f-e1f2-4ebb-37de-adf00bdf57b6/mzaf_8266263075137964740.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/18/5b/1e/185b1ef5-5d97-19d8-aebf-8e29e41874ef/13UAAIM59255.rgb.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1476095084,
      "trackName": "Bad Romance",
      "artistName": "Lady Gaga",
      "collectionName": "The Fame Monster (Deluxe Edition)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/8b/61/91/8b619112-037f-cf92-6ea2-49b2c2e6da93/mzaf_15075202270114110481.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/1f/25/c4/1f25c4bf-7f7a-ff26-8769-20ab6052dadf/09UMGIM40719.rgb.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1468058171,
      "trackName": "Cruel Summer",
      "artistName": "Taylor Swift",
      "collectionName": "Lover",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/44/af/81/44af8168-9609-1b85-5048-ada08dceacf3/mzaf_1341699644335558812.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/49/3d/ab/493dab54-f920-9043-6181-80993b8116c9/19UMGIM53909.rgb.jpg/100x100bb.jpg"
    }
  ],
  "quiz:rai-chaabi": [
    {
      "trackId": 992389153,
      "trackName": "Lamaallem",
      "artistName": "Saad Lamjarred",
      "collectionName": "Lamaallem - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/10/8b/58/108b58ff-13d3-9c63-f656-a4edf255631d/mzaf_8631182694702136423.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music1/v4/f2/60/8c/f2608cc5-2a01-3dd7-a3e5-58364d6971c9/444676.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1566382631,
      "trackName": "Didi",
      "artistName": "Khaled",
      "collectionName": "Khaled",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/9d/61/8a/9d618ac8-0ef3-109a-0a3b-c9fa4385b153/mzaf_5933319126833270422.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/65/42/61/6542610d-1f3f-5e90-b075-10d28ffa6c86/21UMGIM40583.rgb.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1814636055,
      "trackName": "C'est la vie",
      "artistName": "Khaled",
      "collectionName": "Mariage Algérien",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/93/01/f6/9301f642-62df-fd4a-c49b-462cecc23891/mzaf_2189771895642097557.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/6e/83/e3/6e83e372-1f89-da23-de07-128c515c4060/3664216088350.png/100x100bb.jpg"
    },
    {
      "trackId": 1749009381,
      "trackName": "La matebkich Galbi La",
      "artistName": "Cheb Hasni",
      "collectionName": "La matebkich Galbi La - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/f9/6c/cb/f96ccbc8-4b3c-3e92-8e1c-6109f421f037/mzaf_7795791472348547243.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/9e/df/4a/9edf4abc-0936-08fb-a0f2-94541885a06f/859788978748_cover.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1738498107,
      "trackName": "ElGrandeToto (Mghayer V2)",
      "artistName": "Young Enma",
      "collectionName": "ElGrandeToto (Mghayer V2) - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/0c/d5/7c/0cd57cea-7114-87e8-edb1-4ed773221582/mzaf_11045329402525561303.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/a9/ad/87/a9ad875d-c519-296c-24aa-3f7fd609377c/artwork.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1442189581,
      "trackName": "Slay (feat. ElGrandeToto)",
      "artistName": "Manal",
      "collectionName": "Slay (feat. ElGrandeToto) - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/99/f3/dc/99f3dc65-e270-644b-50fe-98e2e68562bb/mzaf_6061329628266509817.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/32/f7/11/32f71199-f994-5111-2deb-704b46d8c4d2/886447438510.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1425765235,
      "trackName": "Décapotable",
      "artistName": "Zouhair Bahaoui",
      "collectionName": "Décapotable - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/ae/58/4a/ae584a95-a1bd-1068-530b-ba3c6aa9d6d9/mzaf_14803657415581177189.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/73/4a/4f/734a4fdf-1d5d-44a3-29dd-b403dd9255c8/913789.jpg/100x100bb.jpg"
    },
    {
      "trackId": 713933094,
      "trackName": "Ah W Noss",
      "artistName": "Nancy Ajram",
      "collectionName": "Greatest Hits",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/f5/60/c9/f560c900-8ace-ccc7-415a-129e8d542cf1/mzaf_15605253058122848544.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music/v4/0f/83/68/0f83680e-7ffd-4f9b-ca3c-b29a4d9d9795/05099926400051.jpg/100x100bb.jpg"
    },
    {
      "trackId": 880940097,
      "trackName": "Tamly Maak",
      "artistName": "Amr Diab",
      "collectionName": "Tamally Maak",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/5e/df/09/5edf0981-ce52-4740-f0b2-f6ad0760afcb/mzaf_17144740537777531434.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music69/v4/31/4d/d4/314dd42d-3246-e7a3-107a-3d521fa9a7e2/dj.iiicnpub.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1392403250,
      "trackName": "Mazal Mazal",
      "artistName": "Douzi",
      "collectionName": "Mazal Mazal - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/f9/02/94/f9029418-b07c-a332-5c4b-03fc1dff87d0/mzaf_2240617232928509055.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/95/f4/42/95f44230-0c57-a27b-96c5-d64654ad1f98/Mazal_Mazal.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1452869512,
      "trackName": "Tellement N'Brick",
      "artistName": "Faudel",
      "collectionName": "1, 2, 3 Soleils (Live à Bercy)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/fa/d0/d8/fad0d8d4-9ce0-8858-3889-de0e3c8664ac/mzaf_3162675115594338168.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/ce/ad/35/cead35dc-ce5e-a2cf-2e21-be197f66e84c/00731454719124.rgb.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1361097791,
      "trackName": "Ghazali",
      "artistName": "Saad Lamjarred",
      "collectionName": "Ghazali - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/0a/09/71/0a097195-6bc7-308f-2525-5610b7a55718/mzaf_9256772928588909894.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/69/dd/e9/69dde989-3d0d-71d3-3edc-6933b1eb7654/839612.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1444050114,
      "trackName": "Aicha",
      "artistName": "Khaled",
      "collectionName": "Hafla (Live)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/65/06/85/650685d0-f95b-226a-0a23-5f323e418a56/mzaf_8168518316703416063.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/16/72/6b/16726b64-b2bd-33a1-a54d-aa582748d87e/00731453988125.rgb.jpg/100x100bb.jpg"
    },
    {
      "trackId": 6835929374,
      "trackName": "TTN",
      "artistName": "Miimii KDS, Lejuh & PYROMAN",
      "collectionName": "TTN - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/28/c9/67/28c967c0-5dd9-cb3f-c852-834ec1e99c8b/mzaf_7914812876603235949.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/03/82/84/038284a0-d2c4-f637-065c-c91c7477bf36/26UM1IM47887.rgb.jpg/170x170bb.png"
    },
    {
      "trackId": 6835380292,
      "trackName": "Enkonpatib",
      "artistName": "Camilo Show, Wilfredo Benavides Fernandez & ecri20 guitare",
      "collectionName": "Enkonpatib - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/b9/ea/65/b9ea65cd-b4d4-e3b8-2c59-aaf7240045dc/mzaf_15599707082601858685.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/cf/45/c5/cf45c503-1c7b-d239-d8d4-1fa8ecd30786/3667007280964_cover.jpg/170x170bb.png"
    },
    {
      "trackId": 6829385477,
      "trackName": "Karma (feat. Toma)",
      "artistName": "NUNCHI",
      "collectionName": "Karma (feat. Toma) - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/a4/6d/12/a46d12b4-dc36-396b-7cbc-5a8f3600506f/mzaf_5177038261512925687.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/c8/20/fe/c820fe70-4755-41df-c0c8-02480c59f5fd/859750019547_cover.jpg/170x170bb.png"
    },
    {
      "trackId": 1296697430,
      "trackName": "Over the Rainbow",
      "artistName": "Israel Kamakawiwo'ole",
      "collectionName": "Somewhere Over The Rainbow: The Best of Israel Kamakawiwo'ole",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/f7/16/76/f71676f1-0f76-c36f-c179-921dbd6a623a/mzaf_12782181527516942387.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e1/48/6d/e1486d07-6c2a-11df-977c-87e1e27f660e/761268591227.png/170x170bb.png"
    },
    {
      "trackId": 6838869229,
      "trackName": "Doudou an mwen",
      "artistName": "Mikl & LÉA CHURROS",
      "collectionName": "Doudou an mwen - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/6c/72/b9/6c72b99d-76b7-60f7-952d-489e242f677b/mzaf_5077871223881778154.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/9d/bc/b9/9dbcb971-f696-57fe-5204-5a6de072c8f8/859751915183_cover.jpg/170x170bb.png"
    },
    {
      "trackId": 6827650039,
      "trackName": "Ya Niveau",
      "artistName": "Dj Kawest & Oswald",
      "collectionName": "Ya Niveau - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/f9/ce/6b/f9ce6bce-9e43-e1f7-4bcd-8fb48df50b86/mzaf_7233361839352647223.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/3d/a7/5e/3da75e78-e1df-51c1-c5ed-8ccc946b57d7/3596975210799_cover.jpg/170x170bb.png"
    },
    {
      "trackId": 449756911,
      "trackName": "Ça fait rire les oiseaux",
      "artistName": "La Compagnie Créole",
      "collectionName": "Ça fait rire les oiseaux",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/b2/ab/2d/b2ab2dbe-dc0e-93e1-3e41-6ebf77b161ca/mzaf_257021641930030555.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/c0/49/61/c0496146-56a9-42eb-8f4f-580b8a53d273/5060107729896_cover.jpg/170x170bb.png"
    }
  ],
  "quiz:rap": [
    {
      "trackId": 1530578950,
      "trackName": "Damso",
      "artistName": "Polokus",
      "collectionName": "Jeter l'encre, Vol. 1",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/8c/24/6c/8c246c4e-d2b5-c552-9955-1a0e2dc60174/mzaf_15807891247625113322.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4b/4a/95/4b4a95f5-9c5b-a33a-0cb2-1f510f17baea/cover.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1406109863,
      "trackName": "God's Plan",
      "artistName": "Drake",
      "collectionName": "Scorpion",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/c6/4a/be/c64abe74-adb4-cff5-005d-0fab3d72a806/mzaf_10276154697254415719.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/bb/6d/8f/bb6d8f67-6d04-10b5-dd62-eb5809ac54fc/00602567879152.rgb.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1440903439,
      "trackName": "Lose Yourself",
      "artistName": "Eminem",
      "collectionName": "8 Mile (Music from and Inspired By the Motion Picture)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/13/5a/61/135a6154-8ca2-0523-1fa2-f4ac0ea9e1e7/mzaf_13242749689945681184.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/08/23/fc/0823fcd9-cb44-695b-32bf-b3bf51d9f800/00606949351229.rgb.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1444156738,
      "trackName": "Still D.R.E. (feat. Snoop Dogg)",
      "artistName": "Dr. Dre",
      "collectionName": "2001",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/00/b8/01/00b801d0-ca58-5b96-a07c-4933b6784ca6/mzaf_17927713563224179032.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/27/6b/4c/276b4c69-99cb-6209-2fd8-3edd17ccfd06/00602517641228.rgb.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1663287497,
      "trackName": "Gazo - Die (feat. Future is Offline) [Remix]",
      "artistName": "XCESS Entertainment",
      "collectionName": "Hurt",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview123/v4/57/75/19/5775190c-84ee-c638-695e-074774a8b20e/mzaf_13220864094656637281.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music123/v4/42/4d/6f/424d6f11-7e9e-cbe5-974b-7ee74712e0a4/artwork.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1681386956,
      "trackName": "Dkr Booba Instrumental",
      "artistName": "Ng Beats",
      "collectionName": "Dkr Booba Instrumental - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/2f/1f/23/2f1f233f-e7ec-e27f-7617-a7efdff6aebf/mzaf_10237360222356661384.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/4d/27/55/4d2755ac-6e36-a47e-88c0-6be2fbeb60b7/42981_b201bf314b0205e8383a7eaecb8d70d8.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1889860646,
      "trackName": "Soleil",
      "artistName": "GIMS",
      "collectionName": "Soleil - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/f8/0d/17/f80d172a-546a-807f-57d2-4a821c412279/mzaf_9764132341514981407.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/76/1b/29/761b2990-5c9e-e19a-9326-0d8720c95ee5/cover.jpg/170x170bb.png"
    },
    {
      "trackId": 6813131671,
      "trackName": "Pilé",
      "artistName": "Mauvais Djo",
      "collectionName": "L'undertaker",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/aa/6c/cc/aa6ccc38-8f47-2d92-17a4-a216d4ef6b4a/mzaf_9971383291067045588.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/10/af/e5/10afe5ad-0520-3991-2590-6039b2d4e412/26UM1IM20129.rgb.jpg/170x170bb.png"
    },
    {
      "trackId": 6823416238,
      "trackName": "CONTRADICTION",
      "artistName": "Khaly",
      "collectionName": "CONTRADICTION - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/a6/c5/21/a6c5212f-29e0-240b-c461-e6127ee25ead/mzaf_5225101696920854775.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b1/00/02/b100023a-711d-8b51-4491-5b6d80b15b2d/artwork.jpg/170x170bb.png"
    },
    {
      "trackId": 6791127322,
      "trackName": "VIVE LA MONNAIE",
      "artistName": "GIMS & Mauvais Djo",
      "collectionName": "VIVE LA MONNAIE - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/54/7d/45/547d45b9-4f00-d6d2-2d9b-16e815d1997f/mzaf_16224467724020796348.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/9d/a1/ec/9da1ec57-d4bb-28fc-7e61-5fa0e9cecb52/cover.jpg/170x170bb.png"
    },
    {
      "trackId": 799176215,
      "trackName": "J'oublie tout",
      "artistName": "Jul",
      "collectionName": "Dans ma paranoïa",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/a0/b5/d6/a0b5d649-2699-41d1-cf8a-666f144d4085/mzaf_1694267499262591574.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/52/1b/66/521b6644-19b6-2c93-e484-ac815d3ec027/3700187655792.jpg/170x170bb.png"
    },
    {
      "trackId": 6801543935,
      "trackName": "CHAOS",
      "artistName": "NAOHS",
      "collectionName": "CHAOS - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/ff/9c/9b/ff9c9b4f-ddec-4236-1f11-5769352f0a2f/mzaf_6247810253760643209.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a4/76/b9/a476b947-cfd7-3aff-ffd5-1ed0c975c3fa/885288287806.jpg/170x170bb.png"
    },
    {
      "trackId": 6813131674,
      "trackName": "Maladie",
      "artistName": "Mauvais Djo",
      "collectionName": "L'undertaker",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/b2/8c/30/b28c30b9-fb70-163d-1f04-65dbf757457a/mzaf_8011829443161344108.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/10/af/e5/10afe5ad-0520-3991-2590-6039b2d4e412/26UM1IM20129.rgb.jpg/170x170bb.png"
    },
    {
      "trackId": 362286893,
      "trackName": "Wati By Night",
      "artistName": "Sexion d'Assaut",
      "collectionName": "L'école des points vitaux",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/74/ca/77/74ca7783-0613-bd0d-7997-54fc38edc081/mzaf_5507572617435853154.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music/8c/94/00/mzi.smkgyzob.jpg/170x170bb.png"
    },
    {
      "trackId": 1789976930,
      "trackName": "À genoux (feat. Kalipsxau)",
      "artistName": "Meryl",
      "collectionName": "À genoux (feat. Kalipsxau) - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/a9/1d/53/a91d53f7-8b94-64b7-f3b9-c2fbbabe05a8/mzaf_10173779565960655043.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/14/4b/44/144b4451-7c87-496d-12ea-1839b0690a06/artwork.jpg/170x170bb.png"
    },
    {
      "trackId": 1605189373,
      "trackName": "Gangsta's Paradise (feat. L.V.) [2023 Remaster]",
      "artistName": "Coolio",
      "collectionName": "Gangsta's Paradise (Deluxe Edition)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/c1/28/9e/c1289efd-07f3-d33c-4f83-ee46496b131c/mzaf_1464096825618179366.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/c2/23/0b/c2230b5f-e753-e9b0-c032-b9ea0713450f/016998513262.png/170x170bb.png"
    },
    {
      "trackId": 6773813568,
      "trackName": "Sexy Nana",
      "artistName": "Aya Nakamura & La Rvfleuze",
      "collectionName": "Destinée Supremacy",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/f9/94/9c/f9949ce2-ba0b-6462-5256-244446f89b80/mzaf_13747837366424637703.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/c0/a6/48/c0a6489f-3952-720b-a2ed-a96a28e2aa26/1200214235055.jpg/170x170bb.png"
    },
    {
      "trackId": 1721572043,
      "trackName": "Stupeflip vite !!! (feat. Cadillac)",
      "artistName": "Stupeflip",
      "collectionName": "Stupeflip vite !!! (feat. Cadillac) - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/6c/43/22/6c432257-18a4-666f-9ab4-549b7cb43621/mzaf_608192429431724577.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/cc/bc/da/ccbcdad9-f532-b3c9-23f7-f9eaecfdd90f/Cover.jpg/170x170bb.png"
    },
    {
      "trackId": 6778879023,
      "trackName": "Uber",
      "artistName": "Franglish, KeBlack & Mauvais Djo",
      "collectionName": "ENERGY",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/8e/0d/63/8e0d63ce-257c-0356-7d5f-cccf10e86229/mzaf_7182311484678180345.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/0d/8c/ba/0d8cba40-8c78-b2b6-4d33-8dad8ef244f4/cover.jpg/170x170bb.png"
    },
    {
      "trackId": 573195077,
      "trackName": "Things I've Seen (Radio Edit)",
      "artistName": "Spooks",
      "collectionName": "Things I've Seen (Music From the Motion Picture Soundtrack Once In the Life) - EP",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/9a/5e/f0/9a5ef033-26fd-efae-01ee-df7ff1cf66b0/mzaf_1723653517742250708.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music/v4/92/f2/60/92f26038-6624-da5b-6e45-b70ba70bd299/894231543524.jpg/170x170bb.png"
    }
  ],
  "quiz:movies-disney": [
    {
      "trackId": 6812476962,
      "trackName": "Starting From Zero (feat. Michael McDonald)",
      "artistName": "Justice",
      "collectionName": "Grand Theft Auto VI: The Album",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/e6/26/c5/e626c539-2b95-20b7-7421-a80f881374d9/mzaf_3568245790740408733.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/5d/d3/1c/5dd31c9c-1e1c-0bbc-104f-4a42e2bb4c59/075679556424.jpg/170x170bb.png"
    },
    {
      "trackId": 1437333914,
      "trackName": "You'll Be In My Heart",
      "artistName": "Phil Collins",
      "collectionName": "Tarzan (Original Motion Picture Soundtrack)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/08/fc/47/08fc476e-a468-6d99-7a38-10dd069438ad/mzaf_9160167947158091816.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/09/ff/d4/09ffd48c-f525-ae2b-be96-b12696d83a49/18UMGIM62087.rgb.jpg/170x170bb.png"
    },
    {
      "trackId": 1049529730,
      "trackName": "Carol of the Bells",
      "artistName": "John Williams",
      "collectionName": "Home Alone (Original Motion Picture Soundtrack) [Anniversary Edition]",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/d7/fd/62/d7fd62ef-0305-5392-94aa-61ae99c42a8f/mzaf_12756192223055445254.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/9c/01/3b/9c013b6d-a316-3119-a94a-c2ef2fbfbefa/886445465518.jpg/170x170bb.png"
    },
    {
      "trackId": 6832795710,
      "trackName": "Magic",
      "artistName": "Hailee Steinfeld",
      "collectionName": "Hexed (Original Motion Picture Soundtrack)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/a6/81/05/a681055f-8f18-0067-a6af-3e014a8ce556/mzaf_8675560579637996562.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/9f/ab/46/9fab469d-f081-f506-923e-bebc465989bd/26UM1IM44364.rgb.jpg/170x170bb.png"
    },
    {
      "trackId": 1440913942,
      "trackName": "Where Are You Christmas",
      "artistName": "Faith Hill",
      "collectionName": "Dr. Seuss' How the Grinch Stole Christmas (Original Motion Picture Soundtrack)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/44/bb/60/44bb60ad-0c7c-b14c-db18-feb2d7add743/mzaf_7089983332519400238.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/f1/8c/84/f18c84df-fea5-8281-9035-7d53d362e435/00606949076528.rgb.jpg/170x170bb.png"
    },
    {
      "trackId": 1434372043,
      "trackName": "Always Remember Us This Way",
      "artistName": "Lady Gaga",
      "collectionName": "A Star Is Born Soundtrack",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/e4/b8/f3/e4b8f37d-91b4-ca6f-d903-604bb3ada165/mzaf_17531851350070402784.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b1/9f/ef/b19fef51-79de-a940-e8ab-9e4e07b04d96/18UMGIM53752.rgb.jpg/170x170bb.png"
    },
    {
      "trackId": 1049529734,
      "trackName": "Somewhere in My Memory (Chorus & Orchestra Version)",
      "artistName": "John Williams",
      "collectionName": "Home Alone (Original Motion Picture Soundtrack) [Anniversary Edition]",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/3e/05/43/3e05439d-f3f4-3198-a1ee-bc2c42630a93/mzaf_9781291485407434494.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/9c/01/3b/9c013b6d-a316-3119-a94a-c2ef2fbfbefa/886445465518.jpg/170x170bb.png"
    },
    {
      "trackId": 388151901,
      "trackName": "I Will Always Love You",
      "artistName": "Whitney Houston",
      "collectionName": "The Bodyguard (Original Soundtrack Album)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/03/d2/1a/03d21aca-c69e-09af-03ef-118004e68ab5/mzaf_17408932698913708736.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/82/f3/e9/82f3e968-8174-c5eb-7fc5-36384d050129/dj.mdauihuy.jpg/170x170bb.png"
    },
    {
      "trackId": 467980724,
      "trackName": "A Thousand Years",
      "artistName": "Christina Perri",
      "collectionName": "The Twilight Saga: Breaking Dawn, Pt. 1 (Original Motion Picture Soundtrack) [Deluxe Version]",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/8e/3a/e7/8e3ae749-5e13-a9ca-fef6-61d615bc3087/mzaf_5415208554281396500.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/f5/2e/83/f52e8357-9cf4-e644-c365-3c21839f85ac/mzi.staekbjw.jpg/170x170bb.png"
    },
    {
      "trackId": 27560445,
      "trackName": "Believe",
      "artistName": "Josh Groban",
      "collectionName": "The Polar Express (Soundtrack from the Motion Picture)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/bd/3d/f0/bd3df073-7acb-c43a-ffaf-7ba4459300e6/mzaf_4833475734353123748.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/c2/ed/2f/c2ed2f54-b593-16af-569d-4812d30a9756/s06.txmfdwfu.jpg/170x170bb.png"
    },
    {
      "trackId": 1440832696,
      "trackName": "Gonna Fly Now (Theme From \"Rocky\")",
      "artistName": "Bill Conti",
      "collectionName": "Rocky (Original Motion Picture Score)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/ea/02/6d/ea026df4-5a5d-f6a0-c526-2a9958c4c22a/mzaf_6885755452086543650.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/66/5d/4e/665d4e4b-223d-4e8e-ceac-79c0c502d749/00602547272881.rgb.jpg/170x170bb.png"
    },
    {
      "trackId": 1049529635,
      "trackName": "O Holy Night",
      "artistName": "John Williams",
      "collectionName": "Home Alone (Original Motion Picture Soundtrack) [Anniversary Edition]",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/8e/46/db/8e46dbfc-1dc1-ec7c-e6ca-668f0ef4f9c6/mzaf_8751828494073053508.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/9c/01/3b/9c013b6d-a316-3119-a94a-c2ef2fbfbefa/886445465518.jpg/170x170bb.png"
    },
    {
      "trackId": 387193955,
      "trackName": "Danger Zone",
      "artistName": "Kenny Loggins",
      "collectionName": "Top Gun (Original Motion Picture Soundtrack) [Special Expanded Edition]",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/8d/c8/19/8dc81935-5620-0b29-3f4c-acc3f6479796/mzaf_14998514993249023640.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/81/2f/27/812f27f8-4c88-7b16-8a54-5113fa169781/dj.jvcruggi.jpg/170x170bb.png"
    },
    {
      "trackId": 1164757336,
      "trackName": "Holding Out for a Hero",
      "artistName": "Bonnie Tyler",
      "collectionName": "Footloose (Original Motion Picture Soundtrack)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/af/64/9c/af649c31-3655-14e6-7fe5-216a6f78ff67/mzaf_15929190961841576220.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/ab/e1/f9/abe1f91c-4f32-4384-6632-13334c07c4b2/886446159812.jpg/170x170bb.png"
    },
    {
      "trackId": 1440845808,
      "trackName": "Love Me Like You Do",
      "artistName": "Ellie Goulding",
      "collectionName": "Fifty Shades of Grey (Original Motion Picture Soundtrack)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/e2/21/36/e2213685-b698-b67d-36e4-33e94a8977cc/mzaf_14038067521690556637.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/fd/7a/13/fd7a1394-5ce1-6da6-93ad-977533762a1f/15UMGIM00463.rgb.jpg/170x170bb.png"
    },
    {
      "trackId": 1049528540,
      "trackName": "Main Title \"Somewhere in My Memory\" (From \"Home Alone\") [Voice]",
      "artistName": "John Williams, The American Boychoir & Boston Pops Orchestra",
      "collectionName": "Home Alone (Original Motion Picture Soundtrack) [Anniversary Edition]",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/16/44/74/1644742a-a0e1-544c-4334-0d41b5564ca8/mzaf_6885251853002580231.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/9c/01/3b/9c013b6d-a316-3119-a94a-c2ef2fbfbefa/886445465518.jpg/170x170bb.png"
    },
    {
      "trackId": 6825133727,
      "trackName": "My Kinda Love",
      "artistName": "STELLA LEFTY & Bailey Zimmerman",
      "collectionName": "Nobody Wants This: Season 3 (Soundtrack from the Netflix Series)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/15/f1/4c/15f14c83-655a-492d-35cd-7959a1fd58cd/mzaf_16949757549719806850.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/94/db/43/94db4394-368c-e7b7-b520-72b847908968/075679550705.jpg/170x170bb.png"
    },
    {
      "trackId": 1440857081,
      "trackName": "Young and Beautiful",
      "artistName": "Lana Del Rey",
      "collectionName": "The Great Gatsby (Music From Baz Luhrmann's Film)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/d7/0b/8a/d70b8adf-8a27-aafa-76a4-f59200be9ab0/mzaf_6008955516336655319.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/e3/e3/13/e3e31393-abf5-e9b1-edc4-20ede35d0c75/13UMGIM43701.rgb.jpg/170x170bb.png"
    },
    {
      "trackId": 6819036611,
      "trackName": "Who I Hope To Be",
      "artistName": "for KING & COUNTRY, Lucas Leach, Beth Easdown, India Brown, Charles Esten & Angel",
      "collectionName": "Drummer Boy (Original Motion Picture Soundtrack)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/06/95/a3/0695a3ee-1c77-ff38-8648-869c6cd7d90c/mzaf_5638050268128870988.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/35/fe/0a/35fe0aac-055d-4633-5aa0-01b0bde3a954/194646569462.png/170x170bb.png"
    },
    {
      "trackId": 1440626764,
      "trackName": "Let It Go",
      "artistName": "Idina Menzel",
      "collectionName": "Frozen (Original Motion Picture Soundtrack) [Deluxe Edition]",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/6c/4e/be/6c4ebef9-901d-e32f-c770-cf26ee589179/mzaf_7585957285423980495.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/e7/ed/8a/e7ed8a2c-4835-e4dc-efec-5e81abd6c241/13DMGIM04438.rgb.jpg/170x170bb.png"
    }
  ],
  "freeze:party-pop": [
    {
      "trackId": 943946671,
      "trackName": "Uptown Funk (feat. Bruno Mars)",
      "artistName": "Mark Ronson",
      "collectionName": "Uptown Special",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/91/99/1f/91991fe5-aa77-87e4-edbc-6d68c95e5f18/mzaf_10685317694850942114.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/7e/30/c5/7e30c572-aa47-5f7b-c6fd-42d50cd2c56d/886444959797.jpg/100x100bb.jpg"
    },
    {
      "trackId": 371784883,
      "trackName": "Waka Waka (This Time for Africa) [The Official 2010 FIFA World Cup (TM) Song] [feat. Freshlyground] [Single]",
      "artistName": "Shakira",
      "collectionName": "Listen Up! The Official 2010 FIFA World Cup Album",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/98/88/e5/9888e55d-4daf-0e96-480b-a38259013586/mzaf_9048311608369053538.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/3e/3a/73/3e3a73da-e19e-b26c-ec19-9da6a5da93fa/mzi.ixhiugev.jpg/100x100bb.jpg"
    },
    {
      "trackId": 863835363,
      "trackName": "Happy (From \"Despicable Me 2\")",
      "artistName": "Pharrell Williams",
      "collectionName": "G I R L",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/ed/a0/19/eda019cf-2794-66d1-208d-2e2e74c26c3d/mzaf_16469762943852039623.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/76/ff/5e/76ff5ee0-7ab4-2ac2-2598-486a9ccc06e1/886444516877.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1440769310,
      "trackName": "I Gotta Feeling",
      "artistName": "Black Eyed Peas",
      "collectionName": "THE E.N.D. (THE ENERGY NEVER DIES)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/88/5e/6a/885e6adb-f307-d849-a3e0-47280088b5a4/mzaf_12588254824919596992.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/42/fc/47/42fc4794-3c69-8c00-e528-1c7e92b5ac93/09UMGIM13833.rgb.jpg/100x100bb.jpg"
    },
    {
      "trackId": 6824538714,
      "trackName": "BAD TIMES",
      "artistName": "Imael Angel & Cali Bee",
      "collectionName": "BAD TIMES - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/a0/20/6b/a0206bdd-2595-0048-fffc-a8e1e52ecea6/mzaf_12743903273075580494.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/08/48/e5/0848e51a-c14d-1d5f-494e-871b561ed0f4/26UM1IM27351.rgb.jpg/170x170bb.png"
    },
    {
      "trackId": 6772906505,
      "trackName": "Soon (feat. Gaëtan Roussel)",
      "artistName": "Mosimann",
      "collectionName": "Soon (feat. Gaëtan Roussel) - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/df/7d/66/df7d6657-b19e-c70f-7b63-9883fac8b790/mzaf_7795672723860442801.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/aa/b3/9d/aab39d7b-c44e-a5fd-e654-e6dc530b7c79/196874423875.jpg/170x170bb.png"
    },
    {
      "trackId": 6808607421,
      "trackName": "Pumped Up Kicks",
      "artistName": "Bormin'",
      "collectionName": "Pumped Up Kicks - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/c5/00/ef/c500ef15-4881-842d-8fee-20981c16d737/mzaf_2055614741624319180.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/6c/72/21/6c72216f-4169-69c5-253e-1559796b9675/3596975182096_cover.jpg/170x170bb.png"
    },
    {
      "trackId": 6826227338,
      "trackName": "My life, My rules",
      "artistName": "DjElynzoo",
      "collectionName": "My life, My rules - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/ea/07/98/ea079872-b2a1-14af-49fa-6f12314c657f/mzaf_16023176340308694754.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/f5/31/6d/f5316d37-57d2-1512-5f41-b9b7b513c2ad/artwork.jpg/170x170bb.png"
    },
    {
      "trackId": 6796089742,
      "trackName": "Pieces Of Me",
      "artistName": "Kimo Sounds",
      "collectionName": "Pieces Of Me - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/1e/e4/b6/1ee4b651-cf39-8070-a2f0-584bf0f7741a/mzaf_16226860616067501674.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/c3/b7/c4/c3b7c440-76a3-98fd-1b0b-2f4db11e56b0/883310529344.jpg/170x170bb.png"
    },
    {
      "trackId": 540024185,
      "trackName": "History Repeating (feat. Miss Shirley Bassey) [Knee Length Mix]",
      "artistName": "Propellerheads",
      "collectionName": "Decksandrumsandrockandroll",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/5c/0c/8e/5c0c8ee6-2ae7-e995-710b-b8c98a27aa50/mzaf_5940867461458750833.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/c1/25/b9/c125b9ac-e674-1102-407a-c2e06a8ca232/cover.jpg/170x170bb.png"
    },
    {
      "trackId": 6824538503,
      "trackName": "BAD TIMES (Long Version)",
      "artistName": "Imael Angel & Cali Bee",
      "collectionName": "BAD TIMES (Long Version) - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/44/3e/94/443e944b-51bf-851d-da0e-f38ac1c1a189/mzaf_5881459731312254413.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/e8/e9/55/e8e95567-e54f-8e96-9950-e389509d27bb/26UM1IM27739.rgb.jpg/170x170bb.png"
    },
    {
      "trackId": 6779346898,
      "trackName": "Jealous Girl",
      "artistName": "overtones",
      "collectionName": "Jealous Girl - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/e2/d9/a9/e2d9a97c-daae-9206-9349-2453c77c48d0/mzaf_7370147333264115642.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/34/65/6e/34656e21-a244-8a03-598c-5a0167b01914/1963623271389.jpg/170x170bb.png"
    },
    {
      "trackId": 6802751941,
      "trackName": "Paid to Exist",
      "artistName": "brux XTN",
      "collectionName": "Paid to Exist - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/9d/94/9f/9d949f3d-a862-6b37-d05f-31132485b2cb/mzaf_1550983079867635265.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/3f/80/4e/3f804ed5-afa5-5e54-a82e-1fc7c20b763a/612891196290.jpg/170x170bb.png"
    },
    {
      "trackId": 1835869544,
      "trackName": "Sarà perchè ti amo",
      "artistName": "DJ Antoine, Paolo Ortelli & Jay C",
      "collectionName": "Sarà perchè ti amo - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/45/2a/e7/452ae790-7bc4-ce4d-01bf-d36b48bb3198/mzaf_13994782092954612683.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/70/9c/f0/709cf0ba-daa0-1898-51db-f9d964ccbc44/0000000101318_cover.jpg/170x170bb.png"
    },
    {
      "trackId": 1733047520,
      "trackName": "World, Hold On (Children of the Sky) [feat. Steve Edwards]",
      "artistName": "Bob Sinclar",
      "collectionName": "Western Dream",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/8c/b6/cd/8cb6cde1-00a7-2b6c-9003-6de0b7c13cf8/mzaf_15627113171192670079.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b6/8c/f1/b68cf12b-de23-8c41-26c0-87f992089926/3596974587397_cover.jpg/170x170bb.png"
    },
    {
      "trackId": 697195941,
      "trackName": "Something About Us",
      "artistName": "Daft Punk",
      "collectionName": "Discovery",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/e5/6e/07/e56e0775-d44c-fc79-a8d8-78b46a825738/mzaf_9538225478116277548.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/fd/4a/77/fd4a77db-0ebc-d043-41a2-f32fa1bb0fb4/dj.qrikkdwj.jpg/170x170bb.png"
    },
    {
      "trackId": 6792537379,
      "trackName": "Happiness Is So Sad",
      "artistName": "Swedish House Mafia & Lykke Li",
      "collectionName": "Happiness Is So Sad - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/20/b4/73/20b4735b-8821-db34-9d98-042b09d3836b/mzaf_5234972172603467106.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/cf/19/9c/cf199c26-6f59-a4b6-4309-c597ceea14d2/14006.jpg/170x170bb.png"
    },
    {
      "trackId": 1888531832,
      "trackName": "Camilla",
      "artistName": "Jude York",
      "collectionName": "Camilla - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/f7/63/08/f763082c-1747-f361-c2d1-88daa4ffd099/mzaf_9264287211128725981.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/e0/7d/9e/e07d9e66-4149-b040-239b-4de5781c5dc0/5026854972190.jpg/170x170bb.png"
    },
    {
      "trackId": 1748138755,
      "trackName": "Lake Shore Drive",
      "artistName": "Theo Parrish",
      "collectionName": "Baby Steps - EP",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/d1/5a/32/d15a322c-2178-c728-a9a8-902e5f67635c/mzaf_12539013295606848378.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/5c/76/6d/5c766de5-d8f6-51d2-db53-b2796b7fa1f0/4050486921296_cover.jpg/170x170bb.png"
    },
    {
      "trackId": 1783998383,
      "trackName": "Cola",
      "artistName": "CamelPhat & Elderbrook",
      "collectionName": "Cola - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/35/98/b4/3598b477-14a2-1063-ac76-14df1ea07f0e/mzaf_18428237531243601895.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/c7/c7/a0/c7c7a005-6cbe-a1a7-78c7-a97afb5d15da/826194369798.png/170x170bb.png"
    }
  ],
  "freeze:chaabi-rai": [
    {
      "trackId": 992389153,
      "trackName": "Lamaallem",
      "artistName": "Saad Lamjarred",
      "collectionName": "Lamaallem - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/10/8b/58/108b58ff-13d3-9c63-f656-a4edf255631d/mzaf_8631182694702136423.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music1/v4/f2/60/8c/f2608cc5-2a01-3dd7-a3e5-58364d6971c9/444676.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1814636055,
      "trackName": "C'est la vie",
      "artistName": "Khaled",
      "collectionName": "Mariage Algérien",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/93/01/f6/9301f642-62df-fd4a-c49b-462cecc23891/mzaf_2189771895642097557.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/6e/83/e3/6e83e372-1f89-da23-de07-128c515c4060/3664216088350.png/100x100bb.jpg"
    },
    {
      "trackId": 1392403250,
      "trackName": "Mazal Mazal",
      "artistName": "Douzi",
      "collectionName": "Mazal Mazal - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/f9/02/94/f9029418-b07c-a332-5c4b-03fc1dff87d0/mzaf_2240617232928509055.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/95/f4/42/95f44230-0c57-a27b-96c5-d64654ad1f98/Mazal_Mazal.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1425765235,
      "trackName": "Décapotable",
      "artistName": "Zouhair Bahaoui",
      "collectionName": "Décapotable - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/ae/58/4a/ae584a95-a1bd-1068-530b-ba3c6aa9d6d9/mzaf_14803657415581177189.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/73/4a/4f/734a4fdf-1d5d-44a3-29dd-b403dd9255c8/913789.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1452869512,
      "trackName": "Tellement N'Brick",
      "artistName": "Faudel",
      "collectionName": "1, 2, 3 Soleils (Live à Bercy)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/fa/d0/d8/fad0d8d4-9ce0-8858-3889-de0e3c8664ac/mzaf_3162675115594338168.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/ce/ad/35/cead35dc-ce5e-a2cf-2e21-be197f66e84c/00731454719124.rgb.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1074294455,
      "trackName": "Josephine",
      "artistName": "Reda Taliani",
      "collectionName": "Raï Anthology by DJ Kim: Le meilleur du Raï et Raï'n'B",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/fb/5d/77/fb5d774a-05f5-0b7e-2554-eaa861d7c033/mzaf_15596545408637464772.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music49/v4/4f/20/7e/4f207e9d-0e3c-b32b-6f47-367292bddea2/3596973348098_cover.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1566382631,
      "trackName": "Didi",
      "artistName": "Khaled",
      "collectionName": "Khaled",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/9d/61/8a/9d618ac8-0ef3-109a-0a3b-c9fa4385b153/mzaf_5933319126833270422.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/65/42/61/6542610d-1f3f-5e90-b075-10d28ffa6c86/21UMGIM40583.rgb.jpg/100x100bb.jpg"
    },
    {
      "trackId": 715535103,
      "trackName": "Abdel Kader",
      "artistName": "Khaled",
      "collectionName": "N'Ssi N'Ssi",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/82/c1/ce/82c1ce40-308d-9b97-b197-45694e851ca5/mzaf_1319997336006167967.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music4/v4/2f/c2/63/2fc263a5-9294-2ff7-12bd-ce4f203e4670/05060001271804_Cover.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1361097791,
      "trackName": "Ghazali",
      "artistName": "Saad Lamjarred",
      "collectionName": "Ghazali - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/0a/09/71/0a097195-6bc7-308f-2525-5610b7a55718/mzaf_9256772928588909894.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/69/dd/e9/69dde989-3d0d-71d3-3edc-6933b1eb7654/839612.jpg/100x100bb.jpg"
    },
    {
      "trackId": 6835929374,
      "trackName": "TTN",
      "artistName": "Miimii KDS, Lejuh & PYROMAN",
      "collectionName": "TTN - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/28/c9/67/28c967c0-5dd9-cb3f-c852-834ec1e99c8b/mzaf_7914812876603235949.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/03/82/84/038284a0-d2c4-f637-065c-c91c7477bf36/26UM1IM47887.rgb.jpg/170x170bb.png"
    },
    {
      "trackId": 6835380292,
      "trackName": "Enkonpatib",
      "artistName": "Camilo Show, Wilfredo Benavides Fernandez & ecri20 guitare",
      "collectionName": "Enkonpatib - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/b9/ea/65/b9ea65cd-b4d4-e3b8-2c59-aaf7240045dc/mzaf_15599707082601858685.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/cf/45/c5/cf45c503-1c7b-d239-d8d4-1fa8ecd30786/3667007280964_cover.jpg/170x170bb.png"
    },
    {
      "trackId": 6829385477,
      "trackName": "Karma (feat. Toma)",
      "artistName": "NUNCHI",
      "collectionName": "Karma (feat. Toma) - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/a4/6d/12/a46d12b4-dc36-396b-7cbc-5a8f3600506f/mzaf_5177038261512925687.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/c8/20/fe/c820fe70-4755-41df-c0c8-02480c59f5fd/859750019547_cover.jpg/170x170bb.png"
    },
    {
      "trackId": 1296697430,
      "trackName": "Over the Rainbow",
      "artistName": "Israel Kamakawiwo'ole",
      "collectionName": "Somewhere Over The Rainbow: The Best of Israel Kamakawiwo'ole",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/f7/16/76/f71676f1-0f76-c36f-c179-921dbd6a623a/mzaf_12782181527516942387.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e1/48/6d/e1486d07-6c2a-11df-977c-87e1e27f660e/761268591227.png/170x170bb.png"
    },
    {
      "trackId": 6838869229,
      "trackName": "Doudou an mwen",
      "artistName": "Mikl & LÉA CHURROS",
      "collectionName": "Doudou an mwen - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/6c/72/b9/6c72b99d-76b7-60f7-952d-489e242f677b/mzaf_5077871223881778154.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/9d/bc/b9/9dbcb971-f696-57fe-5204-5a6de072c8f8/859751915183_cover.jpg/170x170bb.png"
    },
    {
      "trackId": 6827650039,
      "trackName": "Ya Niveau",
      "artistName": "Dj Kawest & Oswald",
      "collectionName": "Ya Niveau - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/f9/ce/6b/f9ce6bce-9e43-e1f7-4bcd-8fb48df50b86/mzaf_7233361839352647223.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/3d/a7/5e/3da75e78-e1df-51c1-c5ed-8ccc946b57d7/3596975210799_cover.jpg/170x170bb.png"
    },
    {
      "trackId": 449756911,
      "trackName": "Ça fait rire les oiseaux",
      "artistName": "La Compagnie Créole",
      "collectionName": "Ça fait rire les oiseaux",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/b2/ab/2d/b2ab2dbe-dc0e-93e1-3e41-6ebf77b161ca/mzaf_257021641930030555.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/c0/49/61/c0496146-56a9-42eb-8f4f-580b8a53d273/5060107729896_cover.jpg/170x170bb.png"
    },
    {
      "trackId": 1391620841,
      "trackName": "Gortoz a Ran",
      "artistName": "Denez Prigent & Lisa Gerrard",
      "collectionName": "Irvi",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/d6/8c/de/d68cdea2-99f7-f8c1-27a8-b38e1d117109/mzaf_13162575893630729264.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/de/f2/cc/def2cc72-e3b1-3891-ae86-520fd3f77b4c/00602567733683.rgb.jpg/170x170bb.png"
    },
    {
      "trackId": 449751141,
      "trackName": "Le bal masqué",
      "artistName": "La Compagnie Créole",
      "collectionName": "C'est bon pour le moral - Best of La Compagnie Créole",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/43/b7/3c/43b73c1f-39e5-d236-4fe0-7e5b973d43e4/mzaf_12984940028395379504.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music/4c/e3/8d/mzi.zkeryvgk.jpg/170x170bb.png"
    },
    {
      "trackId": 6833324599,
      "trackName": "Last Dance (feat. Fanny J)",
      "artistName": "Mickael Guirand",
      "collectionName": "Last Dance (feat. Fanny J) - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/60/b5/2c/60b52ccd-48d0-777a-0f43-0765a2f7413f/mzaf_2241540138662119018.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/3f/a4/0e/3fa40e02-80d9-a451-c867-44a2088de278/artwork.jpg/170x170bb.png"
    },
    {
      "trackId": 192760096,
      "trackName": "7 Seconds (Duet With Neneh Cherry)",
      "artistName": "Youssou N'Dour & Neneh Cherry",
      "collectionName": "The Guide (Wommat)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/b8/f0/44/b8f0447b-a6fd-0d07-0865-015cf3219021/mzaf_8299834836992802727.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music/cc/9c/b6/mzi.xjgugmig.jpg/170x170bb.png"
    }
  ],
  "freeze:reggaeton-latino": [
    {
      "trackId": 6796864754,
      "trackName": "BbY WOW",
      "artistName": "KAROL G, Judeline & rusowsky",
      "collectionName": "NO ME ARREPIENTO DE SENTIR TANTO",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/f3/08/da/f308da3d-00cc-7682-7be9-87cb882f4ea5/mzaf_129115212197250565.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/2b/66/b2/2b66b26c-ab23-faa1-c4ee-06fa2cce8f76/26UM1IM00558.rgb.jpg/170x170bb.png"
    },
    {
      "trackId": 255615879,
      "trackName": "Feliz Navidad",
      "artistName": "José Feliciano",
      "collectionName": "Feliz Navidad",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/f3/d0/ba/f3d0ba5b-10d3-5c9c-1d08-c995412e0ff8/mzaf_9340026112499486674.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/cf/a7/f8/cfa7f807-e9a6-758d-97e0-f1cd843b5a20/mzi.vcbwvmqu.jpg/170x170bb.png"
    },
    {
      "trackId": 6810810195,
      "trackName": "Bonito, Bonito",
      "artistName": "Thiago Navarro Music",
      "collectionName": "Bonito, Bonito - EP",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/3c/20/d8/3c20d86e-b6ed-5ccf-0e51-23965f57d281/mzaf_16567794836623302846.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/77/47/fc/7747fc1e-8167-5de6-b8e7-cf9b1038aea3/882436183713_cover.jpg/170x170bb.png"
    },
    {
      "trackId": 6826504729,
      "trackName": "POKITO",
      "artistName": "Daddy Yankee & Diljit Dosanjh",
      "collectionName": "LA POSTAL",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/42/51/0a/42510ae4-97bb-e7c2-716b-d51a4a26ba07/mzaf_6647161232748581410.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/24/2a/a4/242aa4a9-808f-419f-289c-e7e6a1517c08/4593106.jpg/170x170bb.png"
    },
    {
      "trackId": 6820600198,
      "trackName": "Dame Hombro",
      "artistName": "Bulin 47 & Kevin Wai",
      "collectionName": "Dame Hombro - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/1f/42/f7/1f42f7cb-1602-bbe3-b736-0fa7a6b6ae98/mzaf_17788669514827869747.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/25/2a/28/252a28ba-d75d-84c5-2f81-0514213b3b0c/708208172962_cover.jpg/170x170bb.png"
    },
    {
      "trackId": 6836099141,
      "trackName": "Máscara",
      "artistName": "Yandel & Grupo Frontera",
      "collectionName": "Máscara - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/e1/39/06/e1390672-2a80-0b0e-62f4-b5cebac83807/mzaf_6571684701762202206.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/65/86/03/6586039c-b1e5-19a6-6107-50bebe7368aa/711641308478.jpg/170x170bb.png"
    },
    {
      "trackId": 1794892230,
      "trackName": "Amor",
      "artistName": "Emmanuel Cortes",
      "collectionName": "Memorias <3",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/f7/37/d0/f737d03b-3d9b-09f6-79dd-03e4e406e441/mzaf_11525452344587100241.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/b1/b3/7d/b1b37d1d-bf5b-bfa8-2991-7d3d67f6db86/197953846561.jpg/170x170bb.png"
    },
    {
      "trackId": 1440636498,
      "trackName": "Danza Kuduro (feat. Lucenzo)",
      "artistName": "Don Omar",
      "collectionName": "Meet The Orphans (Deluxe Edition)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/19/ee/06/19ee06be-a55b-39f2-c367-ffb0b577bc42/mzaf_864096193827270374.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/be/9d/22/be9d22c2-99b2-9e26-11dd-d1a043779b8d/10UMGIM27798.rgb.jpg/170x170bb.png"
    },
    {
      "trackId": 1787022572,
      "trackName": "NUEVAYoL",
      "artistName": "Bad Bunny",
      "collectionName": "DeBÍ TiRAR MáS FOToS",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/2e/97/55/2e97555a-1ed3-9e07-de57-07e1213186c9/mzaf_7594924455925081680.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/90/5e/7e/905e7ed5-a8fa-a8f3-cd06-0028fdf3afaa/199066342442.jpg/170x170bb.png"
    },
    {
      "trackId": 6797924422,
      "trackName": "Alma Rota",
      "artistName": "Dalvin La Melodia & El Blachy",
      "collectionName": "La Bachata Volvió",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/03/e5/7e/03e57eb1-b01e-cd1e-1c1f-2bda0e0691a5/mzaf_2358081871921899576.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/01/07/d0/0107d0df-020a-9b50-21b2-81f31a271f44/881453506222_cover.jpg/170x170bb.png"
    },
    {
      "trackId": 6838963151,
      "trackName": "GRACIAS X TODO",
      "artistName": "Feid & Snoop Dogg",
      "collectionName": "GRACIAS X TODO - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/6e/34/2d/6e342dc9-7308-b7e0-5afc-755bf987ee4e/mzaf_13588776844227091977.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/d8/f1/47/d8f147ed-a477-bce4-6755-fc5ea0ec04b6/26UM1IM50688.rgb.jpg/170x170bb.png"
    },
    {
      "trackId": 1564402493,
      "trackName": "Se Me Nota (Agárrame) [Prod By B - One]",
      "artistName": "Chimbala & Omega",
      "collectionName": "Se Me Nota (Agárrame) - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/5e/c4/63/5ec46344-bf75-dccb-263b-5251581dad1f/mzaf_7998088671834397681.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/30/11/16/30111644-4dd5-5ab2-cb7d-29545485bdf8/812429011891.png/170x170bb.png"
    },
    {
      "trackId": 1752031539,
      "trackName": "Si Antes Te Hubiera Conocido",
      "artistName": "KAROL G",
      "collectionName": "Si Antes Te Hubiera Conocido - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/0f/07/33/0f0733c9-76b3-39f9-9115-9031acd75839/mzaf_249954100848422596.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a0/60/94/a060947c-54d8-0fad-c558-eed12600224c/24UMGIM62705.rgb.jpg/170x170bb.png"
    },
    {
      "trackId": 1786000124,
      "trackName": "Gasolina",
      "artistName": "Daddy Yankee",
      "collectionName": "Barrio Fino (Deluxe Version)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/6c/56/33/6c5633cf-a5f0-d489-f3e2-4fdd9b821ef3/mzaf_417409533127729756.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/2f/66/f0/2f66f0f1-c3c2-9dc0-8391-04804cabc8cf/24CRGIM46808.rgb.jpg/170x170bb.png"
    },
    {
      "trackId": 1891416939,
      "trackName": "Amnesia",
      "artistName": "Dalvin La Melodia",
      "collectionName": "Amnesia - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/ca/98/90/ca9890f7-5b0c-ad8d-d560-95414e89eed1/mzaf_18143084622118895637.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/d0/4d/d8/d04dd8d2-3692-47ec-0bac-c25724b1af73/824296242681_cover.jpg/170x170bb.png"
    },
    {
      "trackId": 1447401620,
      "trackName": "Despacito",
      "artistName": "Luis Fonsi & Daddy Yankee",
      "collectionName": "VIDA",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/0d/cb/ec/0dcbec41-5e9e-bd09-7cdd-fdff44acdf78/mzaf_17345185466754008149.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/e2/ef/f0/e2eff0bc-c51d-7de5-9280-6891ddcee71b/18UMGIM85289.rgb.jpg/170x170bb.png"
    },
    {
      "trackId": 6796864749,
      "trackName": "Alguien que te amaba",
      "artistName": "KAROL G",
      "collectionName": "NO ME ARREPIENTO DE SENTIR TANTO",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/59/54/0f/59540f4d-338b-d752-7f03-8a9ed3947874/mzaf_15005249266867167792.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/2b/66/b2/2b66b26c-ab23-faa1-c4ee-06fa2cce8f76/26UM1IM00558.rgb.jpg/170x170bb.png"
    },
    {
      "trackId": 1301513530,
      "trackName": "La Chona",
      "artistName": "Los Tucanes de Tijuana",
      "collectionName": "Para Tucancillos y Tucancillas",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/3c/94/3b/3c943bb2-9400-3aa9-91eb-3ff13d6ac92e/mzaf_10100104700067888212.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/fc/0b/00/fc0b0020-aaac-4804-e556-d10f73e7f905/018736747175_cover.jpg/170x170bb.png"
    },
    {
      "trackId": 6763670998,
      "trackName": "Desde Que Te Tengo",
      "artistName": "Carín León",
      "collectionName": "MUDA",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/22/9d/0e/229d0ef9-db77-1567-5933-87d710a45af2/mzaf_4617441480256354806.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/24/ff/f8/24fff8e9-1e7f-5aaf-9295-e13045a2010d/00823375143574_Cover.jpg/170x170bb.png"
    },
    {
      "trackId": 6797924420,
      "trackName": "Qué Fue Lo Que Me Hiciste",
      "artistName": "Dalvin La Melodia",
      "collectionName": "La Bachata Volvió",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/99/0f/f1/990ff1d5-e147-bc89-a2f2-dff69e3ae4f2/mzaf_8276407309265025035.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/01/07/d0/0107d0df-020a-9b50-21b2-81f31a271f44/881453506222_cover.jpg/170x170bb.png"
    }
  ],
  "freeze:disco-funk": [
    {
      "trackId": 617154366,
      "trackName": "Get Lucky",
      "artistName": "Daft Punk, Pharrell Williams & Nile Rodgers",
      "collectionName": "Random Access Memories",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/57/a5/85/57a585aa-f1bc-7619-881b-f8a04a5541d5/mzaf_6906185026678279401.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1422648513,
      "trackName": "Dancing Queen",
      "artistName": "ABBA",
      "collectionName": "ABBA Gold: Greatest Hits",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/ec/b1/63/ecb163bc-aff2-4dd2-d40b-c044f0b9fa4d/mzaf_4358783485405794088.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/60/f8/a6/60f8a6bc-e875-238d-f2f8-f34a6034e6d2/14UMGIM07615.rgb.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1479062292,
      "trackName": "Virtual Insanity",
      "artistName": "Jamiroquai",
      "collectionName": "Travelling Without Moving (20th Anniversary Edition) [2016 Remaster]",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/69/a8/60/69a860a4-22e0-acf2-ee5e-0ee2adc6911e/mzaf_13346004038842782241.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/a1/35/fe/a135fe18-654d-9f23-4235-c06614add855/886447942017.jpg/100x100bb.jpg"
    },
    {
      "trackId": 1893157347,
      "trackName": "My Life",
      "artistName": "Durand Bernarr",
      "collectionName": "BERNARR.",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/97/78/b0/9778b05b-2419-511d-747a-58cfbbde95fc/mzaf_2054201213803645088.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/a9/a3/ad/a9a3adca-9f0d-8b58-b997-4b835c71cd86/663918967751.jpg/170x170bb.png"
    },
    {
      "trackId": 714401905,
      "trackName": "You Are My Lady",
      "artistName": "Freddie Jackson",
      "collectionName": "Rock Me Tonight",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/a0/c4/ef/a0c4ef24-62b2-6ad2-a25e-fbc136dbe118/mzaf_17048220903210475631.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/23/45/1a/23451a51-b148-be12-a7c0-03b20aeabd76/00077774617055.jpg/170x170bb.png"
    },
    {
      "trackId": 140250886,
      "trackName": "Through the Fire",
      "artistName": "Chaka Khan",
      "collectionName": "I Feel for You",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/a7/5e/3a/a75e3a03-11a5-1775-1666-e6a3bc0564f6/mzaf_5323535976921656865.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/9d/c2/c4/9dc2c49d-82ba-a79c-7274-e1b7c537caad/mzi.pdtcyntm.jpg/170x170bb.png"
    },
    {
      "trackId": 266611666,
      "trackName": "Ain't Nobody",
      "artistName": "Chaka Khan",
      "collectionName": "Epiphany: The Best of Chaka Khan, Vol. 1",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/71/42/7b/71427b93-9917-e3a9-a243-3d59725069b0/mzaf_6898539609186099191.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/13/55/fb/1355fbb0-60f1-d15e-12cb-ad0008b99524/mzi.zqdpvvdq.jpg/170x170bb.png"
    },
    {
      "trackId": 1456444818,
      "trackName": "September",
      "artistName": "Earth, Wind & Fire",
      "collectionName": "Greatest Hits",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/77/93/c4/7793c4f4-a834-97f0-ec38-685e2d3d95d3/mzaf_4969122594945994096.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/5d/66/3b/5d663b1f-dcc9-030d-0cf1-fc5d344d391d/886447618448.jpg/170x170bb.png"
    },
    {
      "trackId": 1443807267,
      "trackName": "Sweet Thing (feat. Chaka Khan)",
      "artistName": "Rufus",
      "collectionName": "Rufus featuring Chaka Khan",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/f6/79/65/f6796599-e2ba-893e-f3e1-6c9346cfe8f6/mzaf_5222262792054631842.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/99/ce/d5/99ced51d-3cfb-a6fa-4a99-92181ec7fa88/00076743137327.rgb.jpg/170x170bb.png"
    },
    {
      "trackId": 6826024130,
      "trackName": "Hey Boo, Come Slide With Me",
      "artistName": "The Kisha & Bruce Collection",
      "collectionName": "Hey Boo, Come Slide With Me - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/89/29/b0/8929b02f-ee08-3ac1-6586-ef577fa58672/mzaf_1958526879251895053.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/92/f3/eb/92f3eb0b-d4e9-b754-a493-759c66c08148/artwork.jpg/170x170bb.png"
    },
    {
      "trackId": 391725492,
      "trackName": "Lovely Day",
      "artistName": "Bill Withers",
      "collectionName": "The Best Of Bill Withers: Lean On Me",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/4d/4f/4d/4d4f4def-089f-5ead-eb65-c2e754c4eb0b/mzaf_17532940935688196080.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/3a/93/40/3a9340a1-73f7-5bbb-86a2-15a4ba20acea/884977735840.jpg/170x170bb.png"
    },
    {
      "trackId": 303078892,
      "trackName": "Aquarius/Let the Sunshine In",
      "artistName": "The 5th Dimension",
      "collectionName": "The Age of Aquarius (2000 Remaster)",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/7c/14/86/7c148689-85ab-964e-a4b1-c50595f84e5a/mzaf_17778885856522172830.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/2d/73/43/2d734337-5ee2-d9eb-58b7-21cb094c1c9a/744659966620.jpg/170x170bb.png"
    },
    {
      "trackId": 1473304352,
      "trackName": "Take Your Time (Do It Right)",
      "artistName": "The S.O.S. Band",
      "collectionName": "Best Of",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/b0/7b/f4/b07bf4e7-fa19-95b8-f993-2f1313936f3a/mzaf_2618211538505296239.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/c4/88/52/c48852ff-b542-2884-a696-ca39e0b4cdf3/19UMGIM65658.rgb.jpg/170x170bb.png"
    },
    {
      "trackId": 140249673,
      "trackName": "I Feel for You",
      "artistName": "Chaka Khan",
      "collectionName": "I Feel for You",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/4c/ce/5a/4cce5a51-0f21-b743-a6d3-de066f72af44/mzaf_10188608860824014133.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/9d/c2/c4/9dc2c49d-82ba-a79c-7274-e1b7c537caad/mzi.pdtcyntm.jpg/170x170bb.png"
    },
    {
      "trackId": 281615481,
      "trackName": "I'm Every Woman",
      "artistName": "Chaka Khan",
      "collectionName": "Chaka",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/f3/86/38/f3863874-0f3c-bf90-a9d7-923e0232a057/mzaf_17218644943705010665.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music/6e/15/77/mzi.hknzkbyg.jpg/170x170bb.png"
    },
    {
      "trackId": 604770244,
      "trackName": "Smooth Operator (Single Version)",
      "artistName": "Sade",
      "collectionName": "The Best of Sade",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/c6/db/56/c6db5666-4464-a6e5-d6e8-8d481b926e70/mzaf_17727462257578713488.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/5f/ad/2a/5fad2aca-d998-701d-7b27-c074339d5fd0/886972262628.jpg/170x170bb.png"
    },
    {
      "trackId": 714402070,
      "trackName": "Rock Me Tonight (For Old Times Sake)",
      "artistName": "Freddie Jackson",
      "collectionName": "Rock Me Tonight",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/fb/96/c1/fb96c1cf-9024-65ed-bc88-18d9e014092a/mzaf_4297484288672612394.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/23/45/1a/23451a51-b148-be12-a7c0-03b20aeabd76/00077774617055.jpg/170x170bb.png"
    },
    {
      "trackId": 6800127968,
      "trackName": "Fly U Out",
      "artistName": "Lucky Daye & Leon Thomas",
      "collectionName": "Fly U Out - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/c7/e7/70/c7e77063-3e1b-74f9-32ca-98828bca7999/mzaf_15647044438000166776.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/90/c7/90/90c79044-4e3a-558a-a217-a1717cdfe2fc/054391216953.jpg/170x170bb.png"
    },
    {
      "trackId": 6837250660,
      "trackName": "I Still Got Fire",
      "artistName": "RAY JOHNS",
      "collectionName": "I Still Got Fire - Single",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/3c/fa/9c/3cfa9c09-9a7e-5958-65b6-d98351c3931c/mzaf_4710539591426950063.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/7b/41/ca/7b41ca1f-2a63-0825-e092-e53a12cb90a8/7333614215564.jpg/170x170bb.png"
    },
    {
      "trackId": 840431935,
      "trackName": "I Wanna Dance with Somebody (Who Loves Me)",
      "artistName": "Whitney Houston",
      "collectionName": "Whitney",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/7b/67/fd/7b67fd07-6a7a-0362-135c-878ac5799f2c/mzaf_11309521725869189721.plus.aac.p.m4a",
      "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/86/b5/25/86b525b1-bff1-4bf6-6112-531251b3d672/dj.hthdmusj.jpg/170x170bb.png"
    }
  ]
};

function upgradeArt(url: string): string {
  if (!url) return "";
  return url.replace(/100x100bb/i, "400x400bb").replace(/170x170bb/i, "400x400bb").replace(/60x60bb/i, "400x400bb");
}

export function getVerifiedItunesFallbackCatalog(categoryKey?: string): ItunesTrack[] {
  const raw =
    (categoryKey && RAW_VERIFIED_CATALOG[categoryKey]) ||
    RAW_VERIFIED_CATALOG["quiz:all-hits"] ||
    [];
  return raw.map((item) => ({
    trackId: item.trackId,
    trackName: item.trackName,
    artistName: item.artistName,
    collectionName: item.collectionName,
    previewUrl: item.previewUrl,
    artworkUrl: item.artworkUrl,
    artworkUrlHiRes: upgradeArt(item.artworkUrl),
  }));
}
