import type { GameId, HubCategory, Language } from '../types/duoplay';

export interface TranslationDictionary {
  langName: string;
  dir: 'ltr' | 'rtl';
  // Global / Toolbar
  soloModeBanner: string;
  roomLabel: string;
  copyShort: string;
  copiedShort: string;
  changeGame: string;
  micActive: string;
  micMuted: string;
  leave: string;
  youTag: string;
  enableCamera: string;
  // Lobby
  lobbyHeadline: string;
  lobbySubtitlePrefix: string;
  lobbySubtitleStrong: string;
  lobbySubtitleSuffix: string;
  lobbySpecs: string;
  soloCta: string;
  soloHint: string;
  yourNameLabel: string;
  yourNamePlaceholder: string;
  tabCreate: string;
  tabJoin: string;
  createDesc: string;
  createBtn: string;
  shareCodeLabel: string;
  copyCodeBtn: string;
  codeCopiedBtn: string;
  copyLinkBtn: string;
  linkCopiedBtn: string;
  waitingPartner: string;
  cancelBtn: string;
  joinCodeLabel: string;
  joinBtn: string;
  joiningBtn: string;
  errEnterNameCreate: string;
  errEnterNameJoin: string;
  errInvalidCode: string;
  // Hub
  hubTitle: string;
  hubSubtitle: string;
  gamesAvailable: string;
  camReady: string;
  camLoading: string;
  camFallback: string;
  partnerAiSub: string;
  partnerLiveSub: string;
  categories: Record<HubCategory, string>;
  games: Record<
    GameId,
    {
      badge: string;
      title: string;
      shortDesc: string;
      description: string;
      cta: string;
    }
  >;
  // Shared Game HUD
  pause: string;
  resume: string;
  restart: string;
  playAgain: string;
  backToHub: string;
  pausedTitle: string;
  gameOverTitle: string;
  victoryTitle: string;
  scoreLabel: string;
  recordLabel: string;
  roundLabel: string;
  // Stare Duel (Duel de Regard)
  stareTitle: string;
  stareDesc: string;
  stareStartBtn: string;
  stareNextRoundBtn: string;
  stareDistractionBtn: string;
  stareDistractionCooldown: string;
  stareTestBlinkBtn: string;
  stareEyeOpen: string;
  stareEyeBlinked: string;
  stareNextTrap: string;
  stareYouWonRound: string;
  starePartnerWonRound: string;
  stareMatchWon: string;
  stareMatchLost: string;
  stareFlyAlert: string;
  stareFlashAlert: string;
  stareDontBlink: string;
  stareSensorReady: string;
  stareSensorFallback: string;
  // Miam Mania (Attrape-Bouche)
  miamTitle: string;
  miamDesc: string;
  miamModeDuel: string;
  miamModeCoop: string;
  miamStartBtn: string;
  miamMouthOpen: string;
  miamMouthClosed: string;
  miamHoldOpenHint: string;
  miamSensorReady: string;
  miamSensorFallback: string;
  miamCoupleScore: string;
  miamPartnerMouth: string;
  miamCaughtLabel: string;
  miamStreakLabel: string;
  miamLivesLeft: string;
  // Kiss Bounce (Pluie de Bisous)
  kissTitle: string;
  kissDesc: string;
  kissStartBtn: string;
  kissSendBtn: string;
  kissExchangeLabel: string;
  kissAuroraLabel: string;
  kissSensorReady: string;
  kissSensorFallback: string;
  kissCaughtHand: string;
  kissCaughtKiss: string;
  kissPuckerHint: string;
  // Constellations à Deux
  constellationTitle: string;
  constellationDesc: string;
  constellationStartBtn: string;
  constellationNextBtn: string;
  constellationTouchHint: string;
  constellationSensorReady: string;
  constellationSensorFallback: string;
  constellationCompletedLabel: string;
  constellationUnlockedLabel: string;
  constellationNames: Record<'heart' | 'moon' | 'infinity' | 'twins', string>;
  constellationPrompts: string[];
}

export const TRANSLATIONS: Record<Language, TranslationDictionary> = {
  fr: {
    langName: 'Français',
    dir: 'ltr',
    soloModeBanner: 'Mode Test Solo · Partenaire IA',
    roomLabel: 'Salon',
    copyShort: 'Copier',
    copiedShort: 'Copié',
    changeGame: 'Changer de jeu',
    micActive: 'Micro actif',
    micMuted: 'Micro coupé',
    leave: 'Quitter',
    youTag: '(Toi)',
    enableCamera: 'Activer caméra',
    lobbyHeadline: 'Votre soirée jeux à deux, même à distance.',
    lobbySubtitlePrefix: 'Connectez-vous une seule fois face caméra par code ou lien privé, puis enchaînez librement nos ',
    lobbySubtitleStrong: '8 mini-jeux en duo',
    lobbySubtitleSuffix: ' — sans jamais couper l’appel.',
    lobbySpecs: '100 % navigateur (PeerJS) · Webcam MediaPipe · Jouable assis',
    soloCta: 'Mode Test Solo (Partenaire IA)',
    soloHint: 'Essaie immédiatement les 8 jeux face à Camille IA, avec ou sans webcam.',
    yourNameLabel: 'Ton prénom',
    yourNamePlaceholder: 'Ex. Alex, Léa, Sam...',
    tabCreate: 'Créer un salon',
    tabJoin: 'Rejoindre un salon',
    createDesc: 'Génère un code privé à 4 chiffres et partage-le à ton/ta partenaire pour ouvrir la vidéo, le micro et le hub CoupleCam Play.',
    createBtn: 'Créer un salon (Hôte)',
    shareCodeLabel: 'Code du salon à partager',
    copyCodeBtn: 'Copier le code',
    codeCopiedBtn: 'Code copié',
    copyLinkBtn: 'Copier le lien d’invitation directe',
    linkCopiedBtn: 'Lien d’invitation copié !',
    waitingPartner: 'En attente de ton/ta partenaire...',
    cancelBtn: 'Annuler',
    joinCodeLabel: 'Code du salon (4 chiffres)',
    joinBtn: 'Rejoindre le salon (Invité)',
    joiningBtn: 'Connexion en cours...',
    errEnterNameCreate: 'Indique d’abord ton prénom pour ouvrir le salon.',
    errEnterNameJoin: 'Indique d’abord ton prénom avant de rejoindre.',
    errInvalidCode: 'Saisis le code complet à 4 chiffres du salon.',
    hubTitle: 'Choisissez votre prochain jeu',
    hubSubtitle: 'Un clic lance la partie instantanément sur vos deux écrans sans couper l’appel.',
    gamesAvailable: '8 jeux disponibles',
    camReady: 'Suivi webcam MediaPipe prêt',
    camLoading: 'Chargement de MediaPipe...',
    camFallback: 'Mode clavier / souris prêt',
    partnerAiSub: 'Partenaire IA synchronisé',
    partnerLiveSub: 'Connecté en direct (PeerJS)',
    categories: {
      all: 'Tous',
      drole: '😂 Drôle',
      action: '⚡ Action',
      aventure: '🧭 Aventure',
      romantique: '❤️ Romantique',
      amusant: '🎉 Amusant',
    },
    games: {
      laugh: {
        badge: '01 · FaceLandmarker · Fous rires',
        title: 'Tu ris, tu perds',
        shortDesc: 'Détection sourire en duel',
        description:
          'Garde ton sérieux pendant que ton/ta partenaire tente de te faire craquer avec des défis complices. Le moindre sourire détecté par webcam te coûte la manche.',
        cta: 'Lancer Tu ris, tu perds',
      },
      'stare-duel': {
        badge: '02 · FaceLandmarker (Yeux) · Fous rires',
        title: 'Duel de Regard',
        shortDesc: 'Le premier qui cligne perd',
        description:
          'Vos deux visages en gros plan face au chrono : interdiction de cligner ! Toutes les 5 s, des mouches virtuelles et flashs surprises piègent votre adversaire.',
        cta: 'Lancer Duel de Regard',
      },
      'miam-mania': {
        badge: '03 · FaceLandmarker (Bouche) · Grimaces',
        title: 'Miam Mania',
        shortDesc: 'Attrape-bouche bonus & pièges',
        description:
          'Ouvre grand la bouche pour gober fraises, pizzas et cœurs (+10 pts) en gardant la bouche fermée devant les piments et vieilles chaussettes (−1 vie). Duel ou coop !',
        cta: 'Lancer Miam Mania',
      },
      funambules: {
        badge: '04 · Inclinaison de la tête · Coopération',
        title: 'Les Funambules',
        shortDesc: 'Équilibre à deux sur fil',
        description:
          'Traversez 100 mètres ensemble au-dessus des toits parisiens. Penchez la tête à gauche ou à droite en tandem pour contrer les rafales et garder le balancier droit.',
        cta: 'Lancer Les Funambules',
      },
      'ninja-fruits': {
        badge: '05 · HandLandmarker (Index) · Action Duo',
        title: 'Ninja Fruits en Duo',
        shortDesc: 'Lames laser & Fruits Géants',
        description:
          'Tranchez les fruits ensemble avec votre traînée laser pour booster le multiplicateur, esquivez les bombes au centre et coupez les Fruits Géants à deux lames.',
        cta: 'Lancer Ninja Fruits en Duo',
      },
      'air-hockey': {
        badge: '06 · HandLandmarker (Paume) · Duel Néon',
        title: 'Air Hockey des Mains',
        shortDesc: 'Duel néon à la paume',
        description:
          'Vos deux écrans forment un terrain néon partagé. Contrôlez votre raquette à la paume : plus votre frappe est rapide à l’impact, plus le palet accélère. Premier à 7 buts.',
        cta: 'Lancer Air Hockey des Mains',
      },
      'kiss-bounce': {
        badge: '07 · Face + HandLandmarker · Romantique',
        title: 'Pluie de Bisous',
        shortDesc: 'Bisous lumineux & aurore boréale',
        description:
          'Envoie un bisou à la caméra pour faire voler un cœur lumineux chez ton/ta partenaire. Attrapez-le à la main ou renvoyez un bisou pour illuminer l’aurore boréale au piano.',
        cta: 'Lancer Pluie de Bisous',
      },
      constellations: {
        badge: '08 · HandLandmarker (Index) · Complicité',
        title: 'Constellations à Deux',
        shortDesc: 'Étoiles reliées & questions intimes',
        description:
          'Reliez vos deux curseurs d’étoiles dans un ciel nocturne apaisant pour tracer cœur, lune et infini — et débloquer une question complice ou un souvenir à partager à l’oral.',
        cta: 'Lancer Constellations à Deux',
      },
    },
    pause: 'Pause',
    resume: 'Reprendre',
    restart: 'Recommencer',
    playAgain: 'Rejouer',
    backToHub: 'Retour au Hub',
    pausedTitle: 'Partie en pause',
    gameOverTitle: 'Manche terminée',
    victoryTitle: 'Victoire !',
    scoreLabel: 'Score',
    recordLabel: 'Record',
    roundLabel: 'Manche',
    stareTitle: 'Duel de Regard (Le Premier qui Cligne)',
    stareDesc:
      'Fixez-vous en gros plan sans cligner des yeux. Toutes les 5 secondes un piège visuel (mouche ou flash) surgit — et vous pouvez envoyer vos propres distractions !',
    stareStartBtn: 'Lancer le duel de regard',
    stareNextRoundBtn: 'Manche suivante',
    stareDistractionBtn: 'Envoyer une distraction',
    stareDistractionCooldown: 'Recharge',
    stareTestBlinkBtn: 'Simuler un clignement (Espace)',
    stareEyeOpen: 'Yeux ouverts',
    stareEyeBlinked: 'Clignement !',
    stareNextTrap: 'Piège auto dans',
    stareYouWonRound: 'a cligné en premier ! Tu remportes la manche.',
    starePartnerWonRound: 'Tu as cligné des yeux ! Point pour ton/ta partenaire.',
    stareMatchWon: 'Regard d’acier ! Tu remportes le duel.',
    stareMatchLost: 'remporte le duel de regard !',
    stareFlyAlert: 'BZZZ ! Mouche sur le nez !',
    stareFlashAlert: 'FLASH SURPRISE !',
    stareDontBlink: 'NE CLIGNE PAS !',
    stareSensorReady: 'Capteur yeux (eyeBlinkLeft / Right) actif',
    stareSensorFallback: 'Sans caméra : appuie sur Espace pour tester un clignement',
    miamTitle: 'Miam Mania (Attrape-Bouche)',
    miamDesc:
      'Déplace ta tête et ouvre grand la bouche pour gober fraises, pizzas et cœurs (+10 pts). Garde la bouche bien fermée devant les piments et vieilles chaussettes (−1 vie) !',
    miamModeDuel: 'Duel de score',
    miamModeCoop: 'Score commun',
    miamStartBtn: 'À table ! Lancer la partie',
    miamMouthOpen: 'BOUCHE OUVERTE',
    miamMouthClosed: 'Bouche fermée',
    miamHoldOpenHint: 'Souris pour bouger · Maintiens Clic ou Espace pour ouvrir la bouche',
    miamSensorReady: 'Capteur bouche (jawOpen + position) actif',
    miamSensorFallback: 'Déplace la souris + maintiens Clic ou Espace pour gober',
    miamCoupleScore: 'Score du couple',
    miamPartnerMouth: 'Bouche partenaire',
    miamCaughtLabel: 'Bonus gobés',
    miamStreakLabel: 'Série',
    miamLivesLeft: 'Vies',
    kissTitle: 'Pluie de Bisous (Kiss Bounce)',
    kissDesc:
      'Fais un bisou à la caméra pour envoyer un cœur lumineux. Attrape les cœurs avec la main ou renvoie un bisou au bon timing pour illuminer l’aurore boréale et jouer au piano.',
    kissStartBtn: 'Allumer le ciel boréal',
    kissSendBtn: 'Envoyer un bisou (Espace)',
    kissExchangeLabel: 'Échanges',
    kissAuroraLabel: 'Aurore',
    kissSensorReady: 'Capteurs bisou (mouthPucker) + main actifs',
    kissSensorFallback: 'Souris pour attraper · Espace ou bouton pour envoyer un bisou',
    kissCaughtHand: 'Attrapé à la main !',
    kissCaughtKiss: 'Bisou parfait !',
    kissPuckerHint: 'Fais un bisou ou appuie sur Espace',
    constellationTitle: 'Constellations à Deux',
    constellationDesc:
      'Guide le bout de ton index vers chaque étoile numérotée avec ton/ta partenaire. Quand vos deux doigts lumineux se rejoignent, la constellation s’illumine et révèle une question complice.',
    constellationStartBtn: 'Contempler le ciel à deux',
    constellationNextBtn: 'Constellation suivante',
    constellationTouchHint: 'Rejoignez ensemble l’étoile',
    constellationSensorReady: 'Capteur index (landmark 8) actif',
    constellationSensorFallback: 'Déplace la souris vers chaque étoile numérotée',
    constellationCompletedLabel: 'Constellations',
    constellationUnlockedLabel: 'Question complice débloquée',
    constellationNames: {
      heart: 'Le Cœur Boréal',
      moon: 'Le Croissant de Lune',
      infinity: 'La Boucle de l’Infini',
      twins: 'Les Étoiles Jumelles',
    },
    constellationPrompts: [
      'Quel est ton moment préféré qu’on a vécu cette année ?',
      'Quelle petite habitude chez moi te fait toujours sourire en secret ?',
      'Si on pouvait se téléporter quelque part ce soir, où m’emmènerais-tu ?',
      'Quel souvenir de nous deux aimerais-tu revivre au ralenti ?',
      'Qu’est-ce qui te manque le plus quand on est loin l’un de l’autre ?',
      'Quelle chanson te fait immédiatement penser à nous ?',
    ],
  },
  en: {
    langName: 'English',
    dir: 'ltr',
    soloModeBanner: 'Solo Test Mode · AI Partner',
    roomLabel: 'Room',
    copyShort: 'Copy',
    copiedShort: 'Copied',
    changeGame: 'Switch Game',
    micActive: 'Mic On',
    micMuted: 'Mic Muted',
    leave: 'Leave',
    youTag: '(You)',
    enableCamera: 'Enable Camera',
    lobbyHeadline: 'Your date-night arcade, even miles apart.',
    lobbySubtitlePrefix: 'Connect once face-to-face via room code or private invite link, then jump freely across ',
    lobbySubtitleStrong: '8 live duo mini-games',
    lobbySubtitleSuffix: ' — without ever dropping the call.',
    lobbySpecs: '100% Browser P2P (PeerJS) · MediaPipe Webcam · Seated Play',
    soloCta: 'Solo Test Mode (AI Partner)',
    soloHint: 'Try all 8 games right away with Camille AI, with or without a webcam.',
    yourNameLabel: 'Your name',
    yourNamePlaceholder: 'e.g. Alex, Mia, Sam...',
    tabCreate: 'Create Room',
    tabJoin: 'Join Room',
    createDesc: 'Generate a private 4-digit room code and share it with your partner to launch live video, audio, and the CoupleCam Play hub.',
    createBtn: 'Create Room (Host)',
    shareCodeLabel: 'Room code to share',
    copyCodeBtn: 'Copy code',
    codeCopiedBtn: 'Code copied',
    copyLinkBtn: 'Copy direct invite link',
    linkCopiedBtn: 'Invite link copied!',
    waitingPartner: 'Waiting for your partner...',
    cancelBtn: 'Cancel',
    joinCodeLabel: 'Room code (4 digits)',
    joinBtn: 'Join Room (Guest)',
    joiningBtn: 'Connecting...',
    errEnterNameCreate: 'Enter your name first to open a room.',
    errEnterNameJoin: 'Enter your name before joining.',
    errInvalidCode: 'Enter the full 4-digit room code.',
    hubTitle: 'Pick your next game',
    hubSubtitle: 'One click launches the game on both screens instantly without dropping the call.',
    gamesAvailable: '8 games available',
    camReady: 'MediaPipe webcam tracking ready',
    camLoading: 'Loading MediaPipe...',
    camFallback: 'Keyboard / mouse controls ready',
    partnerAiSub: 'Synced AI partner',
    partnerLiveSub: 'Connected live (PeerJS)',
    categories: {
      all: 'All',
      drole: '😂 Funny',
      action: '⚡ Action',
      aventure: '🧭 Adventure',
      romantique: '❤️ Romantic',
      amusant: '🎉 Fun',
    },
    games: {
      laugh: {
        badge: '01 · FaceLandmarker · Try Not to Laugh',
        title: 'You Laugh, You Lose',
        shortDesc: 'Webcam smile duel',
        description:
          'Keep a straight face while your partner tries to crack you up with playful prompts. The tiniest smile detected on camera costs you the round.',
        cta: 'Play You Laugh, You Lose',
      },
      'stare-duel': {
        badge: '02 · FaceLandmarker (Eyes) · Staring Contest',
        title: 'Staring Duel',
        shortDesc: 'First to blink loses',
        description:
          'Close-up staring contest against the clock: do not blink! Every 5 seconds, virtual flies and surprise flashes try to break your focus.',
        cta: 'Play Staring Duel',
      },
      'miam-mania': {
        badge: '03 · FaceLandmarker (Mouth) · Catch Game',
        title: 'Yum Mania',
        shortDesc: 'Mouth-catch food & traps',
        description:
          'Move your head and open wide to chomp strawberries, pizza & hearts (+10 pts), while keeping your mouth shut for chilies & old socks (−1 life). Duel or co-op!',
        cta: 'Play Yum Mania',
      },
      funambules: {
        badge: '04 · Head Tilt · Co-op Balance',
        title: 'The Tightrope Walkers',
        shortDesc: 'Co-op head-tilt balance',
        description:
          'Cross 100 meters together above Parisian rooftops. Tilt your heads in sync to counter sudden wind gusts and keep the balance pole steady.',
        cta: 'Play Tightrope Walkers',
      },
      'ninja-fruits': {
        badge: '05 · HandLandmarker (Index) · Duo Action',
        title: 'Duo Fruit Ninja',
        shortDesc: 'Laser blades & Giant Fruits',
        description:
          'Slice fruit arcs together with glowing laser trails to stack multipliers, dodge center bombs, and slice Giant Fruits simultaneously with both blades.',
        cta: 'Play Duo Fruit Ninja',
      },
      'air-hockey': {
        badge: '06 · HandLandmarker (Palm) · Neon Duel',
        title: 'Hand Air Hockey',
        shortDesc: 'Neon palm-paddle duel',
        description:
          'Your two screens form one shared neon air hockey rink. Control your mallet with your palm: faster strikes launch the puck harder. First to 7 goals wins.',
        cta: 'Play Hand Air Hockey',
      },
      'kiss-bounce': {
        badge: '07 · Face + HandLandmarker · Romantic',
        title: 'Kiss Bounce',
        shortDesc: 'Glowing kisses & aurora sky',
        description:
          'Blow a kiss to the camera to float a glowing heart to your partner. Catch it by hand or blow a kiss back on cue to light up the northern lights with soft piano notes.',
        cta: 'Play Kiss Bounce',
      },
      constellations: {
        badge: '08 · HandLandmarker (Index) · Intimate Co-op',
        title: 'Constellations for Two',
        shortDesc: 'Starlight trails & sweet prompts',
        description:
          'Meet fingertips in a calm starry sky to trace hearts, moons, and infinity loops together — unlocking an intimate question or memory to share aloud.',
        cta: 'Play Constellations for Two',
      },
    },
    pause: 'Pause',
    resume: 'Resume',
    restart: 'Restart',
    playAgain: 'Play Again',
    backToHub: 'Back to Hub',
    pausedTitle: 'Game Paused',
    gameOverTitle: 'Round Over',
    victoryTitle: 'Victory!',
    scoreLabel: 'Score',
    recordLabel: 'Best',
    roundLabel: 'Round',
    stareTitle: 'Staring Duel (First to Blink)',
    stareDesc:
      'Stare close-up without blinking. Every 5 seconds a visual trap (buzzing fly or surprise flash) hits the screen — plus you can trigger your own distractions!',
    stareStartBtn: 'Start Staring Duel',
    stareNextRoundBtn: 'Next Round',
    stareDistractionBtn: 'Send a Distraction',
    stareDistractionCooldown: 'Recharging',
    stareTestBlinkBtn: 'Simulate Blink (Space)',
    stareEyeOpen: 'Eyes Wide Open',
    stareEyeBlinked: 'Blinked!',
    stareNextTrap: 'Auto trap in',
    stareYouWonRound: 'blinked first! You win the round.',
    starePartnerWonRound: 'You blinked! Point goes to your partner.',
    stareMatchWon: 'Eyes of steel! You win the staring duel.',
    stareMatchLost: 'wins the staring duel!',
    stareFlyAlert: 'BZZZ! Fly on your nose!',
    stareFlashAlert: 'SURPRISE FLASH!',
    stareDontBlink: 'DON’T BLINK!',
    stareSensorReady: 'Eye blink sensor (eyeBlinkLeft / Right) active',
    stareSensorFallback: 'No camera: press Space to test blinking',
    miamTitle: 'Yum Mania (Mouth Catch)',
    miamDesc:
      'Move your head and open your mouth wide to chomp strawberries, pizza & hearts (+10 pts). Keep your mouth shut when spicy chilies & old socks fall (−1 life)!',
    miamModeDuel: 'Score Duel',
    miamModeCoop: 'Shared Score',
    miamStartBtn: 'Dig In! Start Game',
    miamMouthOpen: 'MOUTH OPEN',
    miamMouthClosed: 'Mouth Closed',
    miamHoldOpenHint: 'Move mouse · Hold Click or Space to open mouth',
    miamSensorReady: 'Mouth sensor (jawOpen + position) active',
    miamSensorFallback: 'Move mouse + hold Click or Space to chomp',
    miamCoupleScore: 'Couple Score',
    miamPartnerMouth: 'Partner Mouth',
    miamCaughtLabel: 'Treats Caught',
    miamStreakLabel: 'Streak',
    miamLivesLeft: 'Lives',
    kissTitle: 'Kiss Bounce',
    kissDesc:
      'Blow a kiss to send a glowing heart across the night sky. Catch incoming hearts with your hand or blow a kiss back on cue to illuminate the aurora borealis and play piano notes.',
    kissStartBtn: 'Light Up the Aurora',
    kissSendBtn: 'Blow a Kiss (Space)',
    kissExchangeLabel: 'Exchanges',
    kissAuroraLabel: 'Aurora',
    kissSensorReady: 'Kiss (mouthPucker) + hand sensors active',
    kissSensorFallback: 'Move mouse to catch · Space or button to blow a kiss',
    kissCaughtHand: 'Caught by hand!',
    kissCaughtKiss: 'Perfect kiss return!',
    kissPuckerHint: 'Blow a kiss or press Space',
    constellationTitle: 'Constellations for Two',
    constellationDesc:
      'Guide your fingertip to each numbered star with your partner. When both glowing cursors meet on a star, the constellation traces across the sky and unlocks a sweet question.',
    constellationStartBtn: 'Enter the Starry Sky',
    constellationNextBtn: 'Next Constellation',
    constellationTouchHint: 'Meet together on star',
    constellationSensorReady: 'Index fingertip sensor (landmark 8) active',
    constellationSensorFallback: 'Move your mouse onto each numbered star',
    constellationCompletedLabel: 'Constellations',
    constellationUnlockedLabel: 'Intimate Question Unlocked',
    constellationNames: {
      heart: 'The Aurora Heart',
      moon: 'The Crescent Moon',
      infinity: 'The Infinity Loop',
      twins: 'The Twin Stars',
    },
    constellationPrompts: [
      'What is your favorite moment we have shared this year?',
      'Which tiny habit of mine always makes you smile secretly?',
      'If we could teleport anywhere tonight, where would you take me?',
      'Which memory of us would you love to relive in slow motion?',
      'What do you miss the most whenever we are miles apart?',
      'Which song instantly reminds you of us?',
    ],
  },
  ar: {
    langName: 'العربية',
    dir: 'rtl',
    soloModeBanner: 'وضع التجربة الفردي · شريك ذكاء اصطناعي',
    roomLabel: 'الغرفة',
    copyShort: 'نسخ',
    copiedShort: 'تم النسخ',
    changeGame: 'تغيير اللعبة',
    micActive: 'الميكروفون يعمل',
    micMuted: 'الميكروفون مكتوم',
    leave: 'خروج',
    youTag: '(أنت)',
    enableCamera: 'تفعيل الكاميرا',
    lobbyHeadline: 'أمسية ألعاب رومانسية معاً، حتى عن بُعد.',
    lobbySubtitlePrefix: 'اتصلا مرة واحدة بالكاميرا عبر رمز الغرفة أو رابط الدعوة الخاص، ثم تنقّلا بحرية بين ',
    lobbySubtitleStrong: '8 ألعاب ثنائية مباشرة',
    lobbySubtitleSuffix: ' — دون قطع المكالمة أبداً.',
    lobbySpecs: '100٪ عبر المتصفح (PeerJS) · تتبع الكاميرا MediaPipe · لعب جالساً',
    soloCta: 'وضع التجربة الفردي (شريك ذكاء اصطناعي)',
    soloHint: 'جرّب جميع الألعاب الـ 8 فوراً مع كاميل الذكية، بكاميرا أو بدونها.',
    yourNameLabel: 'اسمك',
    yourNamePlaceholder: 'مثال: سارة، آدم، نور...',
    tabCreate: 'إنشاء غرفة',
    tabJoin: 'الانضمام لغرفة',
    createDesc: 'أنشئ رمزاً خاصاً من 4 أرقام وشاركه مع شريكك لفتح الفيديو والصوت ومركز ألعاب CoupleCam Play.',
    createBtn: 'إنشاء غرفة (المضيف)',
    shareCodeLabel: 'رمز الغرفة للمشاركة',
    copyCodeBtn: 'نسخ الرمز',
    codeCopiedBtn: 'تم نسخ الرمز',
    copyLinkBtn: 'نسخ رابط الدعوة المباشر',
    linkCopiedBtn: 'تم نسخ رابط الدعوة!',
    waitingPartner: 'في انتظار شريكك...',
    cancelBtn: 'إلغاء',
    joinCodeLabel: 'رمز الغرفة (4 أرقام)',
    joinBtn: 'دخول الغرفة (ضيف)',
    joiningBtn: 'جارٍ الاتصال...',
    errEnterNameCreate: 'أدخل اسمك أولاً لإنشاء الغرفة.',
    errEnterNameJoin: 'أدخل اسمك قبل الانضمام.',
    errInvalidCode: 'أدخل رمز الغرفة المكوّن من 4 أرقام.',
    hubTitle: 'اختارا لعبتكما التالية',
    hubSubtitle: 'نقرة واحدة تبدأ اللعبة فوراً على الشاشتين دون قطع مكالمة الفيديو.',
    gamesAvailable: '8 ألعاب متاحة',
    camReady: 'تتبع الكاميرا MediaPipe جاهز',
    camLoading: 'جارٍ تحميل MediaPipe...',
    camFallback: 'وضع لوحة المفاتيح / الفأرة جاهز',
    partnerAiSub: 'شريك ذكاء اصطناعي متزامن',
    partnerLiveSub: 'متصل مباشرة (PeerJS)',
    categories: {
      all: 'الكل',
      drole: '😂 مضحك',
      action: '⚡ أكشن',
      aventure: '🧭 مغامرة',
      romantique: '❤️ رومانسي',
      amusant: '🎉 ممتع',
    },
    games: {
      laugh: {
        badge: '01 · تتبع الوجه · تحدي الضحك',
        title: 'إذا ضحكت تخسر',
        shortDesc: 'تحدي الابتسامة بالكاميرا',
        description:
          'حافظ على ملامح جادة بينما يحاول شريكك إضحاكك بتحديات طريفة. أصغر ابتسامة تلتقطها الكاميرا تكلّفك الجولة.',
        cta: 'ابدأ إذا ضحكت تخسر',
      },
      'stare-duel': {
        badge: '02 · تتبع العيون · مضحك',
        title: 'تحدي التحديق',
        shortDesc: 'أول من يرمش يخسر',
        description:
          'وجهاكما عن قرب أمام المؤقت: ممنوع الرمش! كل 5 ثوانٍ تظهر ذبابة افتراضية أو وميض مفاجئ لتشتيت الخصم.',
        cta: 'ابدأ تحدي التحديق',
      },
      'miam-mania': {
        badge: '03 · تتبع الفم · حركات طريفة',
        title: 'ميام مانيا',
        shortDesc: 'التقط الطعام بفمك وتجنب الفخاخ',
        description:
          'حرّك رأسك وافتح فمك لالتهام الفراولة والبيتزا والقلوب (+10 نقاط) وأغلق فمك أمام الفلفل الحار والجوارب القديمة (−1 حياة). تحدي أو تعاوني!',
        cta: 'ابدأ ميام مانيا',
      },
      funambules: {
        badge: '04 · إمالة الرأس · تعاوني',
        title: 'المشي على الحبل',
        shortDesc: 'توازن مشترك بإمالة الرأس',
        description:
          'اعبرا 100 متر معاً فوق أسطح باريس. أمل رأسك يميناً أو يساراً بالتناغم لمقاومة الرياح والحفاظ على التوازن.',
        cta: 'ابدأ المشي على الحبل',
      },
      'ninja-fruits': {
        badge: '05 · تتبع اليد (السبابة) · أكشن ثنائي',
        title: 'نينجا الفواكه الثنائي',
        shortDesc: 'شفرات ليزر وفواكه عملاقة',
        description:
          'قطّعا الفواكه معاً بشعاع الليزر لمضاعفة النقاط، وتجنّبا القنابل في الوسط، واقطعا الفواكه العملاقة معاً في نفس اللحظة.',
        cta: 'ابدأ نينجا الفواكه',
      },
      'air-hockey': {
        badge: '06 · تتبع راحة اليد · تحدي نيون',
        title: 'هوكي الهواء باليد',
        shortDesc: 'مبارزة نيون براحة اليد',
        description:
          'شاشتاكما تشكّلان ملعب هوكي نيون واحد. كلما تحركت يدك أسرع لحظة الضربة زادت سرعة القرص نحو شريكك. أول من يسجل 7 أهداف يفوز.',
        cta: 'ابدأ هوكي الهواء',
      },
      'kiss-bounce': {
        badge: '07 · تتبع القبلة + اليد · رومانسي',
        title: 'مطر القبلات',
        shortDesc: 'قلوب مضيئة وشفق قطبي بالبيانو',
        description:
          'أرسل قبلة للكاميرا ليطير قلب مضيء نحو شريكك. التقطه باليد أو أرسل قبلة في الوقت المناسب لإضاءة الشفق القطبي وعزف نغمات بيانو عذبة.',
        cta: 'ابدأ مطر القبلات',
      },
      constellations: {
        badge: '08 · تتبع السبابة · رومانسية وتقارب',
        title: 'كوكبة النجوم معاً',
        shortDesc: 'نجوم مضيئة وأسئلة دافئة',
        description:
          'اجعلا أصابعكما المضيئة تلتقي على النجوم المرقّمة لرسم قلب أو قمر أو رمز اللانهاية — وكشف سؤال عاطفي أو ذكرى جميلة تتشاركانها صوتياً.',
        cta: 'ابدأ كوكبة النجوم',
      },
    },
    pause: 'إيقاف مؤقت',
    resume: 'استئناف',
    restart: 'إعادة البدء',
    playAgain: 'العب مجدداً',
    backToHub: 'العودة للقائمة',
    pausedTitle: 'اللعبة متوقفة مؤقتاً',
    gameOverTitle: 'انتهت الجولة',
    victoryTitle: 'انتصار!',
    scoreLabel: 'النقاط',
    recordLabel: 'أفضل نتيجة',
    roundLabel: 'الجولة',
    stareTitle: 'تحدي التحديق (أول من يرمش يخسر)',
    stareDesc:
      'حدّقا في بعضكما عن قرب دون رمش. كل 5 ثوانٍ يظهر فخ بصري (ذبابة أو وميض مفاجئ) — ويمكنك إرسال تشتيت فوري لشريكك!',
    stareStartBtn: 'ابدأ تحدي التحديق',
    stareNextRoundBtn: 'الجولة التالية',
    stareDistractionBtn: 'إرسال تشتيت للخصم',
    stareDistractionCooldown: 'إعادة الشحن',
    stareTestBlinkBtn: 'محاكاة رمشة (مسافة)',
    stareEyeOpen: 'العيون مفتوحة',
    stareEyeBlinked: 'رمشت!',
    stareNextTrap: 'فخ تلقائي خلال',
    stareYouWonRound: 'رمش أولاً! فزت بالجولة.',
    starePartnerWonRound: 'لقد رمشت! النقطة تذهب لشريكك.',
    stareMatchWon: 'نظرة فولاذية! فزت بتحدي التحديق.',
    stareMatchLost: 'فاز بتحدي التحديق!',
    stareFlyAlert: 'بززز! ذبابة على أنفك!',
    stareFlashAlert: 'وميض مفاجئ!',
    stareDontBlink: 'لا ترمش!',
    stareSensorReady: 'مستشعر العيون (eyeBlinkLeft / Right) نشط',
    stareSensorFallback: 'بدون كاميرا: اضغط مسافة لتجربة الرمش',
    miamTitle: 'ميام مانيا (التقاط بالفم)',
    miamDesc:
      'حرّك رأسك وافتح فمك لالتقاط الفراولة والبيتزا والقلوب (+10 نقاط). أبقِ فمك مغلقاً عند سقوط الفلفل الحار والجوارب القديمة (−1 حياة)!',
    miamModeDuel: 'منافسة النقاط',
    miamModeCoop: 'نقاط مشتركة',
    miamStartBtn: 'بالهناء! ابدأ اللعب',
    miamMouthOpen: 'الفم مفتوح',
    miamMouthClosed: 'الفم مغلق',
    miamHoldOpenHint: 'حرّك الفأرة · اضغط باستمرار أو مسافة لفتح الفم',
    miamSensorReady: 'مستشعر الفم (jawOpen + الموقع) نشط',
    miamSensorFallback: 'حرّك الفأرة + اضغط باستمرار أو مسافة للالتهام',
    miamCoupleScore: 'نقاط الثنائي',
    miamPartnerMouth: 'فم الشريك',
    miamCaughtLabel: 'الأطعمة الملتقطة',
    miamStreakLabel: 'سلسلة متتالية',
    miamLivesLeft: 'الأرواح',
    kissTitle: 'مطر القبلات (Kiss Bounce)',
    kissDesc:
      'أرسل قبلة للكاميرا ليحلق قلب مضيء نحو شريكك. التقط القلوب بيدك أو ردّ بقبلة في الوقت المناسب لإضاءة الشفق القطبي وعزف نغمات البيانو.',
    kissStartBtn: 'أضئ سماء الشفق القطبي',
    kissSendBtn: 'إرسال قبلة (مسافة)',
    kissExchangeLabel: 'تبادل القبلات',
    kissAuroraLabel: 'الشفق',
    kissSensorReady: 'مستشعرا القبلة (mouthPucker) واليد نشطان',
    kissSensorFallback: 'حرّك الفأرة للالتقاط · مسافة أو الزر لإرسال قبلة',
    kissCaughtHand: 'التقاط باليد!',
    kissCaughtKiss: 'قبلة متبادلة رائعة!',
    kissPuckerHint: 'أرسل قبلة أو اضغط مسافة',
    constellationTitle: 'كوكبة النجوم معاً',
    constellationDesc:
      'وجّه طرف إصبعك نحو كل نجمة مرقّمة مع شريكك. عندما يلتقي شعاعاكما على النجمة تُرسم الكوكبة وتفتح سؤالاً رومانسياً للحديث.',
    constellationStartBtn: 'استكشفا السماء معاً',
    constellationNextBtn: 'الكوكبة التالية',
    constellationTouchHint: 'التقيا معاً على النجمة',
    constellationSensorReady: 'مستشعر السبابة (landmark 8) نشط',
    constellationSensorFallback: 'حرّك الفأرة فوق كل نجمة مرقّمة',
    constellationCompletedLabel: 'الكوكبات',
    constellationUnlockedLabel: 'سؤال دافئ للحديث',
    constellationNames: {
      heart: 'قلب الشفق',
      moon: 'هلال القمر',
      infinity: 'حلقة اللانهاية',
      twins: 'النجمتان التوأم',
    },
    constellationPrompts: [
      'ما هي أجمل لحظة عشناها معاً خلال هذا العام؟',
      'ما هي العادة الصغيرة فيّ التي تجعلك تبتسم دائماً؟',
      'لو استطعنا السفر لأي مكان الليلة، إلى أين ستأخذني؟',
      'ما هي الذكرى التي تتمنى أن نعيشها مجدداً بالحركة البطيئة؟',
      'ما أكثر شيء تشتاق إليه عندما نكون بعيدين عن بعضنا؟',
      'ما هي الأغنية التي تذكّرك بنا فور سماعها؟',
    ],
  },
};
