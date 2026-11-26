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
  cameraActiveBadge: string;
  cameraOffBadge: string;
  statusReady: string;
  statusConnected: string;
  statusWaiting: string;
  orDivider: string;
  launchShort: string;
  sensorFace: string;
  sensorHands: string;
  sensorFaceHands: string;
  loadingDetectionTitle: string;
  loadingDetectionSub: string;
  toastCodeCopied: string;
  toastLinkCopied: string;
  toastPartnerConnected: string;
  toastSoloStarted: string;
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
  // Murmures Secrets (Whisper Secrets)
  whisperTitle: string;
  whisperSubtitle: string;
  whisperRoleWhisperer: string;
  whisperRoleGuesser: string;
  whisperSoloSwitchRole: string;
  whisperInputLabel: string;
  whisperInputPlaceholder: string;
  whisperLevelDoux: string;
  whisperLevelSeduction: string;
  whisperLevelIntense: string;
  whisperIdeaBtn: string;
  whisperHintToggle: string;
  whisperLaunchBtn: string;
  whisperPartnerWriting: string;
  whisperPartnerWritingSub: string;
  whisperMicMutedBadge: string;
  whisperMicVirtualBadge: string;
  whisperMicOpenPartner: string;
  whisperZoomLips: string;
  whisperZoomFullFace: string;
  whisperFoundBtn: string;
  whisperKissHint: string;
  whisperKissProgress: string;
  whisperQuickGuessPlaceholder: string;
  whisperQuickGuessBtn: string;
  whisperWordHintLabel: string;
  whisperRevealHeading: string;
  whisperBonusKissBadge: string;
  whisperBonusMatchBadge: string;
  whisperBonusEarlyBadge: string;
  whisperVerdictGuessedBtn: string;
  whisperVerdictMissedBtn: string;
  whisperDareTitle: string;
  whisperHeatLabel: string;
  whisperScoreLabel: string;
  whisperNextRoundBtn: string;
  whisperWaitingVerdict: string;
  whisperPanicBtn: string;
  whisperPanicRestoreBtn: string;
  whisperPanicBanner: string;
  whisperPanicHint: string;
  whisperSoloAiPreparing: string;
  whisperSoloPreviewHint: string;
  // Slingshot Duo (Lance-Pierre Néon)
  slingTitle: string;
  slingDesc: string;
  slingModeCoop: string;
  slingModeDuel: string;
  slingStartBtn: string;
  slingSensorReady: string;
  slingSensorFallback: string;
  slingTimeLabel: string;
  slingTeamScoreLabel: string;
  slingTrickShotsLabel: string;
  slingFusionsLabel: string;
  slingStunnedBadge: string;
  slingPinchHint: string;
  slingWaitingHost: string;
  // X O Néon (Morpion Caméra)
  xoTitle: string;
  xoDesc: string;
  xoStartBtn: string;
  xoVariantInfinite: string;
  xoVariantClassic: string;
  xoThemeXo: string;
  xoThemeHearts: string;
  xoFormatFirstTo3: string;
  xoFormatFree: string;
  xoYourTurn: string;
  xoPartnerTurn: string;
  xoAiThinking: string;
  xoFadingHint: string;
  xoHoverHint: string;
  xoSensorReady: string;
  xoSensorFallback: string;
  xoRoundWinYou: string;
  xoRoundWinPartner: string;
  xoRoundDraw: string;
  xoNextRoundBtn: string;
  xoMatchWinYou: string;
  xoMatchWinPartner: string;
  xoDareLabel: string;
  xoRematchBtn: string;
  xoDares: string[];
  // Parchisi Duo (Royal Love Edition)
  parchisiTitle: string;
  parchisiDesc: string;
  parchisiModeExpress: string;
  parchisiModeExpressHint: string;
  parchisiModeClassic: string;
  parchisiModeClassicHint: string;
  parchisiStartBtn: string;
  parchisiRollBtn: string;
  parchisiHandDiceToggle: string;
  parchisiHandShakeHint: string;
  parchisiAutoMoveToggle: string;
  parchisiYourTurnRoll: string;
  parchisiYourTurnMove: string;
  parchisiBonus20Prompt: string;
  parchisiBonus10Prompt: string;
  parchisiPartnerTurn: string;
  parchisiAiThinking: string;
  parchisiNoMovesToast: string;
  parchisiSixBonusSeven: string;
  parchisiTripleSixCursed: string;
  parchisiTripleSixSpared: string;
  parchisiMercyTitle: string;
  parchisiMercySub: string;
  parchisiMercyNoMercyBtn: string;
  parchisiMercyOfferDareBtn: string;
  parchisiMercyWaitingPartner: string;
  parchisiMercyPartnerOffered: string;
  parchisiMercyAcceptBtn: string;
  parchisiMercyDeclineBtn: string;
  parchisiMercyValidateBtn: string;
  parchisiMercyCancelBtn: string;
  parchisiMercyAiPerforming: string;
  parchisiTenderHeartBadge: string;
  parchisiKarmaTitle: string;
  parchisiKarmaContinueBtn: string;
  parchisiEmotes: Record<'yum' | 'mercy' | 'blocked' | 'lucky', string>;
  parchisiVictoryTitle: string;
  parchisiStatCaptures: string;
  parchisiStatDares: string;
  parchisiStatSixes: string;
  parchisiFinalDareLabel: string;
  parchisiKarmaCards: { title: string; body: string }[];
  parchisiMercyDares: string[];
  parchisiFinalDares: string[];
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
    cameraActiveBadge: 'Caméra active',
    cameraOffBadge: 'Aperçu avatar',
    statusReady: 'Prêt',
    statusConnected: 'Connecté',
    statusWaiting: 'En attente',
    orDivider: 'OU',
    launchShort: 'Lancer',
    sensorFace: 'Visage',
    sensorHands: 'Mains',
    sensorFaceHands: 'Visage & Mains',
    loadingDetectionTitle: 'Initialisation de la détection...',
    loadingDetectionSub: 'Préparation de la caméra et des capteurs MediaPipe.',
    toastCodeCopied: 'Code copié ! ✓',
    toastLinkCopied: 'Lien d’invitation copié ! ✓',
    toastPartnerConnected: 'Partenaire connecté ! Bonne partie 🎉',
    toastSoloStarted: 'Mode Solo activé avec Camille IA ✨',
    lobbyHeadline: 'Jouez à deux face caméra, en un clic.',
    lobbySubtitlePrefix: 'Ouvre un salon privé et enchaîne nos ',
    lobbySubtitleStrong: '12 mini-jeux en duo',
    lobbySubtitleSuffix: ' sur PC ou téléphone sans couper l’appel.',
    lobbySpecs: '100 % navigateur (PeerJS) · Webcam MediaPipe · PC & Téléphone',
    soloCta: 'Tester en Solo (avec l’IA)',
    soloHint: 'Essaie immédiatement les 12 jeux face à Camille IA, avec ou sans webcam.',
    yourNameLabel: 'Ton prénom',
    yourNamePlaceholder: 'Ex. Alex, Léa, Sam...',
    tabCreate: 'Créer un salon',
    tabJoin: 'Rejoindre un salon',
    createDesc: 'Crée un code privé de 4 caractères (lettres et chiffres) et partage-le à ton/ta partenaire.',
    createBtn: 'Créer un salon',
    shareCodeLabel: 'Code du salon à partager',
    copyCodeBtn: 'Copier le code',
    codeCopiedBtn: 'Copié ! ✓',
    copyLinkBtn: 'Copier le lien direct',
    linkCopiedBtn: 'Lien copié ! ✓',
    waitingPartner: 'En attente de ton/ta partenaire...',
    cancelBtn: 'Annuler',
    joinCodeLabel: 'Code du salon (4 lettres/chiffres)',
    joinBtn: 'Rejoindre',
    joiningBtn: 'Connexion...',
    errEnterNameCreate: 'Indique d’abord ton prénom pour ouvrir le salon.',
    errEnterNameJoin: 'Indique d’abord ton prénom avant de rejoindre.',
    errInvalidCode: 'Saisis le code complet à 4 caractères du salon.',
    hubTitle: 'Choisissez votre prochain jeu',
    hubSubtitle: 'Un clic lance la partie instantanément sur vos deux écrans sans couper l’appel.',
    gamesAvailable: '12 jeux disponibles',
    camReady: 'Suivi webcam MediaPipe prêt',
    camLoading: 'Chargement de MediaPipe...',
    camFallback: 'Mode clavier / tactile prêt',
    partnerAiSub: 'Partenaire IA synchronisé',
    partnerLiveSub: 'Connecté en direct (PeerJS)',
    categories: {
      all: '✨ Tous',
      drole: '😂 Drôle',
      action: '⚡ Action',
      aventure: '🧭 Aventure',
      romantique: '❤️ Romantique',
      amusant: '🎉 Amusant',
      sensuel: '🔥 Sensuel',
      musique: '🎵 Musique',
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

      'whisper-secrets': {
        badge: '09 · FaceLandmarker (Zoom Lèvres) · Sensuel',
        title: 'Murmures Secrets',
        shortDesc: 'Lecture sur les lèvres & gages sensuels',
        description:
          'Écris une phrase secrète et murmure-la micro coupé pendant 15 secondes sous zoom lèvres automatique. Un bisou valide immédiatement (+2 pts), sinon un gage complice tombe.',
        cta: 'Lancer Murmures Secrets',
      },
      'slingshot-duo': {
        badge: '10 · HandLandmarker (Pince 1 Main) · Action',
        title: 'Slingshot Duo',
        shortDesc: 'Lance-pierre néon à 1 main, ricochets & fusion dorée',
        description:
          'Pince pouce et index pour tendre ton lance-pierre néon, vise avec la parabole et relâche ! Ricochets TRICK SHOT, cible Fusion Dorée à deux, boules explosives et bombes.',
        cta: 'Lancer Slingshot Duo',
      },
      'xo-neon': {
        badge: '11 · HandLandmarker (Index & Pince) · Amusant',
        title: 'X O Néon',
        shortDesc: 'Morpion caméra en Mode Infini avec curseur de bluff',
        description:
          'Place tes X et O dans les airs à l’index ou par pince rapide ! Mode Infini 3 pièces max sans match nul, curseur de bluff en direct, chrono 12s et gage de couple final.',
        cta: 'Lancer X O Néon',
      },
      'parchisi-duo': {
        badge: '12 · Plateau Royal 68 cases · Dé à la main',
        title: 'Parchisi Duo',
        shortDesc: 'Royal Love Edition : 68 cases, Rachat par Gage & Karma Couple',
        description:
          'Véritable plateau de Parchisi royal à 68 cases ! Lance le dé en secouant la main, forme des barrages, profite du Rachat par Gage lors des captures et tire des cartes Karma Couple.',
        cta: 'Lancer Parchisi Duo',
      },
      'music-quiz': {
        badge: '11 · Quiz Musical iTunes · 4 Choix',
        title: 'Quiz Éclair 4 Choix',
        shortDesc: 'Devine la chanson parmi 4 titres en 15s chrono',
        description:
          'Un vrai extrait musical se lance sur vos deux écrans ! Trouve le bon titre parmi 4 choix avant ton partenaire pour rafler le bonus vitesse (+3 pts + ⚡+1 pt).',
        cta: 'Lancer Quiz Éclair',
      },
      'freeze-dance': {
        badge: '12 · Musique & Caméra · Fous Rires',
        title: '1, 2, 3… Statue Musicale',
        shortDesc: 'Dansez face caméra et figez-vous dès que le son coupe !',
        description:
          'Dansez sur des tubes festifs devant la caméra : dès que la musique coupe d’un coup, FREEZE ! Jugez-vous en 1 clic et récoltez des gages rigolos si ça bouge.',
        cta: 'Lancer Statue Musicale',
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
    whisperTitle: 'Murmures Secrets',
    whisperSubtitle: 'Lecture sur les lèvres, micro coupé & lueur bougie',
    whisperRoleWhisperer: 'Chuchoteur',
    whisperRoleGuesser: 'Devineur',
    whisperSoloSwitchRole: 'Tester l’autre rôle',
    whisperInputLabel: 'Ton murmure secret (privé, max 60 car.)',
    whisperInputPlaceholder: 'Écris un mot ou une courte phrase à murmurer...',
    whisperLevelDoux: '✨ Doux',
    whisperLevelSeduction: '🌹 Séduction',
    whisperLevelIntense: '🔥 Intense',
    whisperIdeaBtn: '✨ Idée',
    whisperHintToggle: 'Indice longueur',
    whisperLaunchBtn: 'Lancer le murmure (15s)',
    whisperPartnerWriting: 'Ton partenaire écrit un murmure secret...',
    whisperPartnerWritingSub: 'Prépare-toi à lire sur ses lèvres dès le départ du chrono.',
    whisperMicMutedBadge: '🔇 Micro coupé — Murmure maintenant !',
    whisperMicVirtualBadge: '🔇 Micro virtuel coupé — Murmure maintenant !',
    whisperMicOpenPartner: '🎙️ Ton micro reste ouvert : devine à voix haute ou tape ci-dessous',
    whisperZoomLips: 'Zoom Lèvres',
    whisperZoomFullFace: 'Visage entier',
    whisperFoundBtn: 'Trouvé ! 💖',
    whisperKissHint: 'Ou envoie un bisou à la caméra (350 ms) pour valider +2 pts',
    whisperKissProgress: 'Bisou détecté...',
    whisperQuickGuessPlaceholder: 'Tape ta proposition rapide...',
    whisperQuickGuessBtn: 'Valider',
    whisperWordHintLabel: 'Indice longueur',
    whisperRevealHeading: 'Le murmure secret était',
    whisperBonusKissBadge: '💖 Validé par un bisou ! (+2 pts)',
    whisperBonusMatchBadge: '✨ Mot exact deviné ! (+2 pts)',
    whisperBonusEarlyBadge: '💖 Trouvé avant la fin ! (+2 pts)',
    whisperVerdictGuessedBtn: 'Il/Elle a deviné ! (+1 pt)',
    whisperVerdictMissedBtn: 'Raté (Tirer un gage)',
    whisperDareTitle: 'Gage complice',
    whisperHeatLabel: 'Complicité / Chaleur',
    whisperScoreLabel: 'Score',
    whisperNextRoundBtn: 'Manche suivante (Inverser les rôles)',
    whisperWaitingVerdict: 'En attente du verdict de ton partenaire...',
    whisperPanicBtn: 'Flou / Panique',
    whisperPanicRestoreBtn: 'Lever le voile',
    whisperPanicBanner: 'Écran discret activé · Vidéos floutées & sons coupés',
    whisperPanicHint: 'Raccourci : Espace',
    whisperSoloAiPreparing: 'Camille IA choisit un murmure secret...',
    whisperSoloPreviewHint: 'Aperçu solo du zoom lèvres MediaPipe en direct',
    slingTitle: 'Slingshot Duo (Lance-Pierre Néon)',
    slingDesc:
      'Pince le pouce et l’index sur ton lance-pierre néon, tire en arrière pour viser la parabole et ouvre les doigts pour tirer !',
    slingModeCoop: '🤝 Coopération (90s)',
    slingModeDuel: '⚔️ Duel (90s)',
    slingStartBtn: 'Tendre le lance-pierre',
    slingSensorReady: 'Main détectée · Pince pouce + index pour tirer',
    slingSensorFallback: 'Cliquer-glisser sur ton lance-pierre pour tirer',
    slingTimeLabel: 'Temps',
    slingTeamScoreLabel: 'Score Duo',
    slingTrickShotsLabel: 'Trick Shots',
    slingFusionsLabel: 'Fusions Dorées',
    slingStunnedBadge: 'ÉTOURDI',
    slingPinchHint: 'Pince + tire en arrière · Relâche pour tirer',
    slingWaitingHost: 'L’hôte choisit le mode et lance la partie…',
    xoTitle: 'X O Néon (Morpion Caméra)',
    xoDesc:
      'Pointe l’index sur une case et pince (ou maintiens 1,2s) pour poser ton symbole ! En Mode Infini, ta 4e pièce efface la plus ancienne.',
    xoStartBtn: 'Lancer la partie néon',
    xoVariantInfinite: '♾️ Infini (0 nul)',
    xoVariantClassic: '🎯 Classique',
    xoThemeXo: 'X / O Néon',
    xoThemeHearts: '💖 / ⭐ Couple',
    xoFormatFirstTo3: 'Premier à 3',
    xoFormatFree: 'Manche libre',
    xoYourTurn: 'À ton tour !',
    xoPartnerTurn: 'Tour de',
    xoAiThinking: 'réfléchit…',
    xoFadingHint: 'La case qui clignote disparaît au prochain coup',
    xoHoverHint: 'Pince rapide, maintiens 1,2s ou clique une case libre',
    xoSensorReady: 'Index détecté · Pince ou maintiens 1,2s sur une case',
    xoSensorFallback: 'Clique ou touche une case libre pour jouer',
    xoRoundWinYou: 'Manche gagnée !',
    xoRoundWinPartner: 'remporte la manche !',
    xoRoundDraw: 'Égalité parfaite !',
    xoNextRoundBtn: 'Manche suivante',
    xoMatchWinYou: 'Victoire du match !',
    xoMatchWinPartner: 'remporte le match !',
    xoDareLabel: 'Gage de couple pour le perdant',
    xoRematchBtn: 'Revanche',
    xoDares: [
      'Envoie 3 bisous caméra au ralenti avec ton regard le plus charmeur.',
      'Fais une déclaration d’amour ultra dramatique de 10 secondes comme au cinéma.',
      'Imite la façon dont ton/ta partenaire réagit quand il/elle gagne à un jeu.',
      'Raconte le tout premier détail qui t’a fait craquer chez ton/ta partenaire.',
      'Chante le refrain de votre chanson préférée (ou d’une chanson d’amour) pendant 8 secondes.',
      'Promets un petit-déjeuner au lit ou un massage d’épaules à la prochaine rencontre !',
      'Fais 3 compliments sincères et précis sans répéter un seul adjectif.',
      'Prends une pose de star de cinéma devant la webcam pendant 5 secondes sans rire.',
      'Choisis le prochain film ou la prochaine sortie de votre futur rendez-vous !',
      'Chuchote un secret mignon ou un souvenir préféré de vous deux à la caméra.',
    ],
    parchisiTitle: 'Parchisi Duo · Royal Love',
    parchisiDesc:
      'Plateau authentique à 68 cases, barrages stratégiques, Rachat par Gage sur capture et cartes ❤️ Karma Couple.',
    parchisiModeExpress: '⚡ Express Couple',
    parchisiModeExpressHint: '1 pion déjà sorti · Sortie sur 5 ou 6 (8–12 min)',
    parchisiModeClassic: '👑 Classique Pur',
    parchisiModeClassicHint: 'Tous dans la maison · Sortie sur 5 uniquement',
    parchisiStartBtn: 'Lancer la partie royale',
    parchisiRollBtn: 'Lancer le dé',
    parchisiHandDiceToggle: 'Dé à la main',
    parchisiHandShakeHint: 'Secoue la main devant la caméra pour lancer !',
    parchisiAutoMoveToggle: 'Coup auto',
    parchisiYourTurnRoll: 'À toi de lancer le dé !',
    parchisiYourTurnMove: 'Choisis un pion lumineux à déplacer',
    parchisiBonus20Prompt: '🔥 BONUS +20 CASES ! Choisis un pion',
    parchisiBonus10Prompt: '👑 BONUS +10 CASES ! Choisis un pion',
    parchisiPartnerTurn: 'Tour de',
    parchisiAiThinking: 'joue son tour…',
    parchisiNoMovesToast: 'Aucun mouvement possible',
    parchisiSixBonusSeven: '✨ 4 pions sortis : le 6 vaut 7 cases !',
    parchisiTripleSixCursed: '⚡ Trois 6 d’affilée ! Le dernier pion retourne à la maison !',
    parchisiTripleSixSpared: '⚡ Trois 6 d’affilée ! Pion sauvé car déjà dans le couloir final.',
    parchisiMercyTitle: 'Capture Royale !',
    parchisiMercySub: 'Tu viens de rattraper le pion de ton partenaire. Que décides-tu ?',
    parchisiMercyNoMercyBtn: '😈 Sans pitié ! (+20 cases)',
    parchisiMercyOfferDareBtn: '💘 Proposer un Gage pour l’épargner',
    parchisiMercyWaitingPartner: 'En attente de la réponse de ton partenaire…',
    parchisiMercyPartnerOffered: 'Ton partenaire te propose un Gage pour sauver ton pion !',
    parchisiMercyAcceptBtn: '💘 Accepter et faire le gage !',
    parchisiMercyDeclineBtn: 'Refuser (retour maison)',
    parchisiMercyValidateBtn: '✅ Gage réussi ! Épargner (+10 cases)',
    parchisiMercyCancelBtn: '😈 Annuler (Sans pitié +20)',
    parchisiMercyAiPerforming: 'relève ton gage devant la caméra avec enthousiasme !',
    parchisiTenderHeartBadge: 'Cœur Tendre',
    parchisiKarmaTitle: 'Carte ❤️ Karma Couple',
    parchisiKarmaContinueBtn: 'Continuer',
    parchisiEmotes: {
      yum: 'Miam !',
      mercy: 'Pitié !',
      blocked: 'Bloqué !',
      lucky: 'Chanceux',
    },
    parchisiVictoryTitle: 'Règne Royal !',
    parchisiStatCaptures: 'Pions mangés',
    parchisiStatDares: 'Gages réussis',
    parchisiStatSixes: 'Nombre de 6',
    parchisiFinalDareLabel: 'Gage Final du Perdant',
    parchisiKarmaCards: [
      { title: '🛡️ Bouclier d’Amour', body: 'Ce pion est immunisé contre toute capture jusqu’à ton prochain tour !' },
      { title: '⚡ Turbo +3 cases', body: 'Élan amoureux ! Ton pion fonce immédiatement de 3 cases supplémentaires.' },
      { title: '🎲 Relance Gratuite', body: 'La chance sourit aux amoureux : tu gagnes immédiatement un lancer bonus !' },
      { title: '💌 Question Secrète', body: 'Partage à l’oral : quel est votre plus beau souvenir vécu ensemble ?' },
      { title: '😊 Défi Sourire', body: 'Regarde ton/ta partenaire droit dans les yeux sans rire pendant tout son prochain tour !' },
      { title: '✨ Compliment Express', body: 'Fais-lui un compliment ultra précis sur ce que tu aimes le plus aujourd’hui.' },
      { title: '🛡️ Bouclier d’Amour', body: 'Protection royale activée ! Aucun pion adverse ne peut manger ce pion ce tour-ci.' },
      { title: '⚡ Turbo +3 cases', body: 'Vent favorable ! Ton pion bondit de +3 cases sur le plateau.' },
      { title: '🎲 Relance Gratuite', body: 'Coup de cœur du destin : relance le dé gratuitement dès maintenant !' },
      { title: '💋 Bisou Porte-Bonheur', body: 'Envoie un bisou caméra à ton/ta partenaire pour bénir ton prochain lancer de dé.' },
      { title: '👀 Regard Magnétique', body: 'Fais ton regard le plus intense devant la caméra pendant 4 secondes.' },
      { title: '🎵 Chanson de Couple', body: 'Fredonne pendant 5 secondes une chanson qui te fait penser à vous deux.' },
      { title: '🌙 Rêve à Deux', body: 'Décris en une phrase votre prochaine escapade idéale ensemble.' },
      { title: '🔥 Aveu Complice', body: 'Avoue une petite manie adorable de ton/ta partenaire qui te fait fondre.' },
      { title: '🥂 Promesse Royale', body: 'Promets une petite attention douce pour votre prochain rendez-vous !' },
      { title: '👑 Surnom Royal', body: 'Donne à ton/ta partenaire un surnom royal mignon à utiliser jusqu’à la fin de la partie.' },
    ],
    parchisiMercyDares: [
      'Envoie 3 bisous à la caméra avec un grand sourire !',
      'Dis 2 choses que tu adores chez moi en me regardant dans les yeux.',
      'Fais ton regard le plus séducteur pendant 5 secondes devant la caméra.',
      'Chante 1 phrase d’une chanson d’amour en direct !',
      'Fais un cœur avec tes deux mains et chuchote mon prénom.',
      'Imite ma réaction quand je fais un 6 au dé !',
      'Donne-moi un compliment royal digne d’un film romantique.',
      'Fais une révérence ou un salut royal devant la webcam.',
      'Dis-moi en 5 secondes pourquoi tu as trop de chance de m’avoir !',
      'Fais un clin d’œil au ralenti suivi d’un bisou soufflé.',
      'Invente sur le champ un petit surnom romantique pour moi.',
      'Promets-moi un gros câlin de 20 secondes à notre prochaine rencontre !',
    ],
    parchisiFinalDares: [
      'Prépare ou offre la boisson / collation préférée du gagnant lors de votre prochaine soirée !',
      'Fais un discours de 15 secondes couronnant ton/ta partenaire « Champion(ne) Suprême du Parchisi ».',
      'Le gagnant choisit le prochain film ou la prochaine série que vous regarderez ensemble !',
      'Envoie 5 bisous caméra avec 5 expressions différentes (timide, star, dramatique, royal, complice).',
      'Promets un massage des épaules de 10 minutes à votre prochaine rencontre !',
      'Chante le refrain de la chanson choisie par le gagnant pendant 10 secondes.',
      'Écris un message d’amour surprise au gagnant dans les 5 prochaines minutes.',
      'Laisse le gagnant choisir le thème de votre prochain rendez-vous en amoureux !',
      'Raconte ton moment préféré de cette partie avec une voix de commentateur sportif.',
      'Fais une déclaration romantique digne d’une fin de comédie romantique devant la caméra !',
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
    cameraActiveBadge: 'Camera active',
    cameraOffBadge: 'Avatar preview',
    statusReady: 'Ready',
    statusConnected: 'Connected',
    statusWaiting: 'Waiting',
    orDivider: 'OR',
    launchShort: 'Play',
    sensorFace: 'Face',
    sensorHands: 'Hands',
    sensorFaceHands: 'Face & Hands',
    loadingDetectionTitle: 'Initializing tracking...',
    loadingDetectionSub: 'Preparing your camera and MediaPipe sensors.',
    toastCodeCopied: 'Code copied! ✓',
    toastLinkCopied: 'Invite link copied! ✓',
    toastPartnerConnected: 'Partner connected! Have fun 🎉',
    toastSoloStarted: 'Solo mode ready with Camille AI ✨',
    lobbyHeadline: 'Play face-to-face in one tap.',
    lobbySubtitlePrefix: 'Open a private room and jump across ',
    lobbySubtitleStrong: '12 live duo mini-games',
    lobbySubtitleSuffix: ' on PC or phone without dropping the call.',
    lobbySpecs: '100% Browser P2P (PeerJS) · MediaPipe Webcam · PC & Mobile',
    soloCta: 'Try Solo (with AI)',
    soloHint: 'Try all 12 games right away with Camille AI, with or without a webcam.',
    yourNameLabel: 'Your name',
    yourNamePlaceholder: 'e.g. Alex, Mia, Sam...',
    tabCreate: 'Create Room',
    tabJoin: 'Join Room',
    createDesc: 'Generate a private 4-character code (letters & digits) and share it with your partner.',
    createBtn: 'Create Room',
    shareCodeLabel: 'Room code to share',
    copyCodeBtn: 'Copy code',
    codeCopiedBtn: 'Copied! ✓',
    copyLinkBtn: 'Copy direct link',
    linkCopiedBtn: 'Link copied! ✓',
    waitingPartner: 'Waiting for your partner...',
    cancelBtn: 'Cancel',
    joinCodeLabel: 'Room code (4 letters/digits)',
    joinBtn: 'Join',
    joiningBtn: 'Connecting...',
    errEnterNameCreate: 'Enter your name first to open a room.',
    errEnterNameJoin: 'Enter your name before joining.',
    errInvalidCode: 'Enter the full 4-character room code.',
    hubTitle: 'Pick your next game',
    hubSubtitle: 'One click launches the game on both screens instantly without dropping the call.',
    gamesAvailable: '12 games available',
    camReady: 'MediaPipe webcam tracking ready',
    camLoading: 'Loading MediaPipe...',
    camFallback: 'Keyboard / touch controls ready',
    partnerAiSub: 'Synced AI partner',
    partnerLiveSub: 'Connected live (PeerJS)',
    categories: {
      all: '✨ All',
      drole: '😂 Funny',
      action: '⚡ Action',
      aventure: '🧭 Adventure',
      romantique: '❤️ Romantic',
      amusant: '🎉 Fun',
      sensuel: '🔥 Sensual',
      musique: '🎵 Music',
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

      'whisper-secrets': {
        badge: '09 · FaceLandmarker (Lip Zoom) · Sensual',
        title: 'Secret Whispers',
        shortDesc: 'Silent lip-reading & playful dares',
        description:
          'Write a private phrase and whisper it muted for 15 seconds with automatic lip zoom. Blow a kiss to validate early (+2 pts), or draw a sensual webcam dare.',
        cta: 'Play Secret Whispers',
      },
      'slingshot-duo': {
        badge: '10 · HandLandmarker (1-Hand Pinch) · Action',
        title: 'Slingshot Duo',
        shortDesc: '1-hand neon slingshot, trick ricochets & golden fusion',
        description:
          'Pinch thumb and index on your neon slingshot, pull back to aim the parabolic arc, and open fingers to fire! Wall trick shots, co-op Golden Fusion, explosives & bombs.',
        cta: 'Play Slingshot Duo',
      },
      'xo-neon': {
        badge: '11 · HandLandmarker (Index & Pinch) · Fun',
        title: 'X O Neon',
        shortDesc: 'Camera Tic-Tac-Toe in Infinite Mode with live bluff cursor',
        description:
          'Place glowing X & O marks in mid-air with your index finger or quick pinch! Infinite 3-piece mode with zero draws, live partner bluff cursor, 12s timer & couple dare.',
        cta: 'Play X O Neon',
      },
      'parchisi-duo': {
        badge: '12 · Royal 68-Square Board · Hand Dice',
        title: 'Parchisi Duo',
        shortDesc: 'Royal Love Edition: 68 squares, Mercy Dares & Karma Cards',
        description:
          'Authentic 68-square royal Parchisi board! Shake your hand to roll the 3D die, build blockades, offer Couple Mercy Dares on captures, and draw Karma Couple surprise cards.',
        cta: 'Play Parchisi Duo',
      },
      'music-quiz': {
        badge: '11 · iTunes Music Quiz · 4 Choices',
        title: 'Lightning 4-Choice Quiz',
        shortDesc: 'Name the real hit song in 15s flat',
        description:
          'A real hit snippet plays in sync on both screens! Pick the right track among 4 choices faster than your partner to grab the speed bonus (+3 pts + ⚡+1 pt).',
        cta: 'Play Lightning Quiz',
      },
      'freeze-dance': {
        badge: '12 · Music & Camera · Laughs',
        title: '1, 2, 3… Musical Statue',
        shortDesc: 'Dance on camera and FREEZE the second the music stops!',
        description:
          'Dance live on camera to upbeat hits: when the music cuts abruptly, FREEZE! Judge each other in 1 tap and trigger hilarious dares whenever someone moves.',
        cta: 'Play Musical Statue',
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
    whisperTitle: 'Secret Whispers',
    whisperSubtitle: 'Silent lip-reading, auto-mute & candlelight glow',
    whisperRoleWhisperer: 'Whisperer',
    whisperRoleGuesser: 'Guesser',
    whisperSoloSwitchRole: 'Test other role',
    whisperInputLabel: 'Your secret whisper (private, max 60 chars)',
    whisperInputPlaceholder: 'Type a word or short phrase to whisper...',
    whisperLevelDoux: '✨ Sweet',
    whisperLevelSeduction: '🌹 Seduction',
    whisperLevelIntense: '🔥 Intense',
    whisperIdeaBtn: '✨ Idea',
    whisperHintToggle: 'Length hint',
    whisperLaunchBtn: 'Start whisper (15s)',
    whisperPartnerWriting: 'Your partner is writing a secret whisper...',
    whisperPartnerWritingSub: 'Get ready to read their lips as soon as the timer starts.',
    whisperMicMutedBadge: '🔇 Mic muted — Whisper now!',
    whisperMicVirtualBadge: '🔇 Virtual mic muted — Whisper now!',
    whisperMicOpenPartner: '🎙️ Your mic stays live: guess aloud or type below',
    whisperZoomLips: 'Lip Zoom',
    whisperZoomFullFace: 'Full Face',
    whisperFoundBtn: 'Guessed! 💖',
    whisperKissHint: 'Or blow a kiss to the camera (350 ms) for +2 pts bonus',
    whisperKissProgress: 'Kiss detected...',
    whisperQuickGuessPlaceholder: 'Type a quick guess...',
    whisperQuickGuessBtn: 'Check',
    whisperWordHintLabel: 'Length hint',
    whisperRevealHeading: 'The secret whisper was',
    whisperBonusKissBadge: '💖 Validated with a kiss! (+2 pts)',
    whisperBonusMatchBadge: '✨ Exact match guessed! (+2 pts)',
    whisperBonusEarlyBadge: '💖 Guessed before time! (+2 pts)',
    whisperVerdictGuessedBtn: 'They guessed it! (+1 pt)',
    whisperVerdictMissedBtn: 'Missed (Draw a dare)',
    whisperDareTitle: 'Playful dare',
    whisperHeatLabel: 'Complicity / Heat',
    whisperScoreLabel: 'Score',
    whisperNextRoundBtn: 'Next round (Swap roles)',
    whisperWaitingVerdict: 'Waiting for your partner’s verdict...',
    whisperPanicBtn: 'Blur / Panic',
    whisperPanicRestoreBtn: 'Clear blur',
    whisperPanicBanner: 'Privacy veil active · Videos blurred & SFX muted',
    whisperPanicHint: 'Shortcut: Space',
    whisperSoloAiPreparing: 'Camille AI is picking a secret whisper...',
    whisperSoloPreviewHint: 'Live solo preview of MediaPipe lip-zoom',
    slingTitle: 'Slingshot Duo (Neon Slingshot)',
    slingDesc:
      'Pinch thumb and index near your neon slingshot, pull back to aim the parabolic curve, and open your fingers to fire!',
    slingModeCoop: '🤝 Co-op (90s)',
    slingModeDuel: '⚔️ Duel (90s)',
    slingStartBtn: 'Load the Slingshot',
    slingSensorReady: 'Hand ready · Pinch thumb + index to pull & release',
    slingSensorFallback: 'Click & drag your slingshot to aim and fire',
    slingTimeLabel: 'Time',
    slingTeamScoreLabel: 'Duo Score',
    slingTrickShotsLabel: 'Trick Shots',
    slingFusionsLabel: 'Golden Fusions',
    slingStunnedBadge: 'STUNNED',
    slingPinchHint: 'Pinch + pull back · Open fingers to shoot',
    slingWaitingHost: 'Host is choosing the mode and starting…',
    xoTitle: 'X O Neon (Camera Tic-Tac-Toe)',
    xoDesc:
      'Point your index finger at a square and pinch (or hold 1.2s) to place your mark! In Infinite Mode, your 4th piece removes your oldest one.',
    xoStartBtn: 'Start Neon Match',
    xoVariantInfinite: '♾️ Infinite (No draws)',
    xoVariantClassic: '🎯 Classic',
    xoThemeXo: 'X / O Neon',
    xoThemeHearts: '💖 / ⭐ Couple',
    xoFormatFirstTo3: 'First to 3',
    xoFormatFree: 'Free play',
    xoYourTurn: 'Your turn!',
    xoPartnerTurn: 'Turn:',
    xoAiThinking: 'is thinking…',
    xoFadingHint: 'The pulsing piece disappears on the next move',
    xoHoverHint: 'Quick pinch, hold 1.2s, or tap any empty square',
    xoSensorReady: 'Index tracked · Pinch or hold 1.2s to lock move',
    xoSensorFallback: 'Click or tap any empty square to play',
    xoRoundWinYou: 'Round won!',
    xoRoundWinPartner: 'wins the round!',
    xoRoundDraw: 'Perfect draw!',
    xoNextRoundBtn: 'Next Round',
    xoMatchWinYou: 'Match Victory!',
    xoMatchWinPartner: 'wins the match!',
    xoDareLabel: 'Couple dare for the loser',
    xoRematchBtn: 'Rematch',
    xoDares: [
      'Blow 3 slow-motion kisses to the camera with your most charming gaze.',
      'Deliver a dramatic 10-second movie love speech straight to the webcam.',
      'Imitate how your partner celebrates whenever they win a game.',
      'Share the very first little thing that made you fall for your partner.',
      'Sing 8 seconds of your favorite love song right now.',
      'Owe your partner breakfast in bed or a shoulder massage next time you meet!',
      'Give 3 genuine compliments in a row without repeating a single adjective.',
      'Strike a red-carpet celebrity pose for 5 seconds without laughing.',
      'Let the winner pick your next movie night or date-night plan!',
      'Whisper your favorite memory of the two of you to the camera.',
    ],
    parchisiTitle: 'Parchisi Duo · Royal Love',
    parchisiDesc:
      'Authentic 68-square board, strategic blockades, Couple Mercy Dares on capture & ❤️ Karma Couple cards.',
    parchisiModeExpress: '⚡ Express Couple',
    parchisiModeExpressHint: '1 pawn out at start · Exit on 5 or 6 (8–12 min)',
    parchisiModeClassic: '👑 Pure Classic',
    parchisiModeClassicHint: 'All pawns in base · Exit on 5 only',
    parchisiStartBtn: 'Start Royal Match',
    parchisiRollBtn: 'Roll Dice',
    parchisiHandDiceToggle: 'Hand Shake Dice',
    parchisiHandShakeHint: 'Shake your hand in front of the camera to roll!',
    parchisiAutoMoveToggle: 'Auto-move',
    parchisiYourTurnRoll: 'Your turn to roll!',
    parchisiYourTurnMove: 'Tap a glowing pawn to move',
    parchisiBonus20Prompt: '🔥 +20 BONUS SPACES! Pick a pawn',
    parchisiBonus10Prompt: '👑 +10 BONUS SPACES! Pick a pawn',
    parchisiPartnerTurn: 'Turn:',
    parchisiAiThinking: 'is taking a turn…',
    parchisiNoMovesToast: 'No valid moves available',
    parchisiSixBonusSeven: '✨ All 4 pawns out: a 6 counts as 7 spaces!',
    parchisiTripleSixCursed: '⚡ Three 6s in a row! Last moved pawn returns home!',
    parchisiTripleSixSpared: '⚡ Three 6s in a row! Pawn spared safely in the final corridor.',
    parchisiMercyTitle: 'Royal Capture!',
    parchisiMercySub: 'You caught your partner’s pawn! What will you choose?',
    parchisiMercyNoMercyBtn: '😈 No Mercy! (+20 spaces)',
    parchisiMercyOfferDareBtn: '💘 Offer a Dare to Spare Them',
    parchisiMercyWaitingPartner: 'Waiting for your partner’s response…',
    parchisiMercyPartnerOffered: 'Your partner offered a Dare to save your pawn!',
    parchisiMercyAcceptBtn: '💘 Accept & Do the Dare!',
    parchisiMercyDeclineBtn: 'Decline (go back to base)',
    parchisiMercyValidateBtn: '✅ Dare Done! Spare (+10 spaces)',
    parchisiMercyCancelBtn: '😈 Cancel (No Mercy +20)',
    parchisiMercyAiPerforming: 'enthusiastically performs your dare on camera!',
    parchisiTenderHeartBadge: 'Tender Heart',
    parchisiKarmaTitle: '❤️ Karma Couple Card',
    parchisiKarmaContinueBtn: 'Continue',
    parchisiEmotes: {
      yum: 'Yum!',
      mercy: 'Mercy!',
      blocked: 'Blocked!',
      lucky: 'Lucky!',
    },
    parchisiVictoryTitle: 'Royal Victory!',
    parchisiStatCaptures: 'Captures',
    parchisiStatDares: 'Dares Done',
    parchisiStatSixes: 'Sixes Rolled',
    parchisiFinalDareLabel: 'Final Loser Dare',
    parchisiKarmaCards: [
      { title: '🛡️ Love Shield', body: 'This pawn is immune to capture until your next turn!' },
      { title: '⚡ Turbo +3 Spaces', body: 'Romantic boost! Your pawn dashes forward 3 extra spaces immediately.' },
      { title: '🎲 Free Reroll', body: 'Fortune favors love: you earn an immediate bonus dice roll!' },
      { title: '💌 Secret Question', body: 'Share aloud: what is your favorite memory we’ve made together?' },
      { title: '😊 Smile Challenge', body: 'Look into your partner’s eyes without laughing during their entire next turn!' },
      { title: '✨ Express Compliment', body: 'Give one ultra-specific compliment about what you love most today.' },
      { title: '🛡️ Love Shield', body: 'Royal protection active! No rival pawn can capture this piece this round.' },
      { title: '⚡ Turbo +3 Spaces', body: 'Tailwind! Your pawn leaps forward +3 spaces on the board.' },
      { title: '🎲 Free Reroll', body: 'Lucky destiny: roll the royal die again right now!' },
      { title: '💋 Lucky Kiss', body: 'Blow a kiss to the camera to bless your next dice roll.' },
      { title: '👀 Magnetic Gaze', body: 'Give your most charming movie-star stare to the camera for 4 seconds.' },
      { title: '🎵 Couple Anthem', body: 'Hum 5 seconds of a song that reminds you of the two of us.' },
      { title: '🌙 Dream Getaway', body: 'Describe our next dream weekend trip in one sentence.' },
      { title: '🔥 Sweet Confession', body: 'Confess one tiny adorable habit of your partner that melts your heart.' },
      { title: '🥂 Royal Promise', body: 'Promise one thoughtful surprise for your next date together!' },
      { title: '👑 Royal Nickname', body: 'Give your partner a cute royal nickname to use until the end of the game.' },
    ],
    parchisiMercyDares: [
      'Blow 3 kisses to the camera with your biggest smile!',
      'Say 2 things you adore about me while looking into the camera.',
      'Hold your most charming gaze for 5 seconds on camera.',
      'Sing 1 line of a love song live right now!',
      'Make a heart with both hands and whisper my name.',
      'Imitate how I react whenever I roll a 6!',
      'Give me a royal compliment straight out of a romance movie.',
      'Do a dramatic royal bow or salute on webcam.',
      'Tell me in 5 seconds why you are so lucky to have me!',
      'Give a slow-motion wink followed by a blown kiss.',
      'Invent a sweet romantic nickname for me on the spot.',
      'Promise me a 20-second hug next time we see each other!',
    ],
    parchisiFinalDares: [
      'Treat the winner to their favorite snack or drink on your next date night!',
      'Give a 15-second speech crowning your partner Supreme Parchisi Champion.',
      'The winner picks the next movie or series you watch together!',
      'Blow 5 kisses with 5 different expressions (shy, dramatic, movie star, royal, playful).',
      'Owe the winner a 10-minute shoulder massage next time you meet!',
      'Sing 10 seconds of a chorus chosen by the winner.',
      'Send the winner a sweet surprise love note within the next 5 minutes.',
      'Let the winner plan the entire theme of your next date night!',
      'Recap your favorite moment of this match like a sports commentator.',
      'Deliver a full rom-com ending speech straight to the webcam!',
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
    cameraActiveBadge: 'الكاميرا نشطة',
    cameraOffBadge: 'معاينة الأفاتار',
    statusReady: 'جاهز',
    statusConnected: 'متصل',
    statusWaiting: 'في الانتظار',
    orDivider: 'أو',
    launchShort: 'ابدأ',
    sensorFace: 'الوجه',
    sensorHands: 'اليدان',
    sensorFaceHands: 'الوجه واليدان',
    loadingDetectionTitle: 'جارٍ تهيئة التتبع...',
    loadingDetectionSub: 'إعداد الكاميرا ومستشعرات MediaPipe.',
    toastCodeCopied: 'تم نسخ الرمز! ✓',
    toastLinkCopied: 'تم نسخ رابط الدعوة! ✓',
    toastPartnerConnected: 'تم اتصال الشريك! استمتعا باللعب 🎉',
    toastSoloStarted: 'تم تفعيل الوضع الفردي مع كاميل الذكية ✨',
    lobbyHeadline: 'العبا معاً أمام الكاميرا بنقرة واحدة.',
    lobbySubtitlePrefix: 'افتحا غرفة خاصة واستمتعا بـ ',
    lobbySubtitleStrong: '12 لعبة ثنائية مباشرة',
    lobbySubtitleSuffix: ' على الكمبيوتر أو الهاتف دون قطع المكالمة.',
    lobbySpecs: '100٪ عبر المتصفح (PeerJS) · تتبع الكاميرا MediaPipe · للكمبيوتر والهاتف',
    soloCta: 'تجربة فردية (مع الذكاء الاصطناعي)',
    soloHint: 'جرّب جميع الألعاب الـ 12 فوراً مع كاميل الذكية، بكاميرا أو بدونها.',
    yourNameLabel: 'اسمك',
    yourNamePlaceholder: 'مثال: سارة، آدم، نور...',
    tabCreate: 'إنشاء غرفة',
    tabJoin: 'الانضمام لغرفة',
    createDesc: 'أنشئ رمزاً خاصاً من 4 أحرف وأرقام وشاركه مع شريكك.',
    createBtn: 'إنشاء غرفة',
    shareCodeLabel: 'رمز الغرفة للمشاركة',
    copyCodeBtn: 'نسخ الرمز',
    codeCopiedBtn: 'تم النسخ! ✓',
    copyLinkBtn: 'نسخ الرابط المباشر',
    linkCopiedBtn: 'تم نسخ الرابط! ✓',
    waitingPartner: 'في انتظار شريكك...',
    cancelBtn: 'إلغاء',
    joinCodeLabel: 'رمز الغرفة (4 أحرف/أرقام)',
    joinBtn: 'انضمام',
    joiningBtn: 'جارٍ الاتصال...',
    errEnterNameCreate: 'أدخل اسمك أولاً لإنشاء الغرفة.',
    errEnterNameJoin: 'أدخل اسمك قبل الانضمام.',
    errInvalidCode: 'أدخل رمز الغرفة المكوّن من 4 أحرف/أرقام.',
    hubTitle: 'اختارا لعبتكما التالية',
    hubSubtitle: 'نقرة واحدة تبدأ اللعبة فوراً على الشاشتين دون قطع مكالمة الفيديو.',
    gamesAvailable: '12 لعبة متاحة',
    camReady: 'تتبع الكاميرا MediaPipe جاهز',
    camLoading: 'جارٍ تحميل MediaPipe...',
    camFallback: 'وضع لوحة المفاتيح / اللمس جاهز',
    partnerAiSub: 'شريك ذكاء اصطناعي متزامن',
    partnerLiveSub: 'متصل مباشرة (PeerJS)',
    categories: {
      all: '✨ الكل',
      drole: '😂 مضحك',
      action: '⚡ أكشن',
      aventure: '🧭 مغامرة',
      romantique: '❤️ رومانسي',
      amusant: '🎉 ممتع',
      sensuel: '🔥 حسي',
      musique: '🎵 موسيقى',
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

      'whisper-secrets': {
        badge: '09 · تقريب الشفاه التلقائي · حسي',
        title: 'همسات سرية',
        shortDesc: 'قراءة الشفاه الصامتة وتحديات جريئة',
        description:
          'اكتب عبارة سرية واهمس بها دون صوت لمدة 15 ثانية مع تقريب تلقائي للشفاه. أرسل قبلة للتأكيد الفوري (+2 نقطة)، وإلا يظهر تحدٍ حسي ممتع.',
        cta: 'ابدأ همسات سرية',
      },
      'slingshot-duo': {
        badge: '10 · تتبع اليد (قرص بإصبعين) · أكشن',
        title: 'مقلاع النيون الثنائي',
        shortDesc: 'تصويب بيد واحدة، ارتدادات وهدف الاندماج الذهبي',
        description:
          'اقرص الإبهام والسبابة لشد مقلاع النيون، صوّب بالمسار المنحني وأطلق! ارتدادات ذكية، هدف الاندماج الذهبي معاً، كرات متفجرة وقنابل.',
        cta: 'ابدأ مقلاع النيون',
      },
      'xo-neon': {
        badge: '11 · تتبع السبابة والقرص · ممتع',
        title: 'X O نيون',
        shortDesc: 'إكس أو بالكاميرا بوضع لا نهائي ومؤشر تمويه مباشر',
        description:
          'ضع رموز X و O في الهواء بالسبابة أو القرص السريع! وضع لا نهائي بدون تعادل (3 رموز كحد أقصى)، مؤشر تمويه مباشر وتحدي لطيف للخاسر.',
        cta: 'ابدأ X O نيون',
      },
      'parchisi-duo': {
        badge: '12 · لوح ملكي 68 خانة · نرد باليد',
        title: 'بارتشيسي ثنائي',
        shortDesc: 'إصدار الحب الملكي: 68 خانة، فداء بالتحدي وبطاقات كارما',
        description:
          'لوح بارتشيسي ملكي أصيل من 68 خانة! هزّ يدك لرمي النرد، ابنِ حواجز، اعرض تحدياً لإنقاذ بيدق شريكك واسحب بطاقات كارما الثنائي.',
        cta: 'ابدأ بارتشيسي ثنائي',
      },
      'music-quiz': {
        badge: '11 · اختبار موسيقي · 4 اختيارات',
        title: 'اختبار البرق 4 اختيارات',
        shortDesc: 'خمّن الأغنية الحقيقية خلال 15 ثانية فقط',
        description:
          'يبدأ مقطع موسيقي حقيقي معاً على الشاشتين! اختر الأغنية الصحيحة من بين 4 خيارات أسرع من شريكك لكسب نقاط السرعة.',
        cta: 'ابدأ اختبار البرق',
      },
      'freeze-dance': {
        badge: '12 · موسيقى وكاميرا · ضحك وحماس',
        title: '1، 2، 3… تمثال موسيقي',
        shortDesc: 'ارقصا أمام الكاميرا وتجمّدا فور توقف الموسيقى!',
        description:
          'ارقصا على أنغام حماسية أمام الكاميرا، وعندما تتوقف الموسيقى فجأة: تجمّد تماماً! احكما على بعضكما بنقرة واحدة مع تحديات طريفة.',
        cta: 'ابدأ التمثال الموسيقي',
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
    whisperTitle: 'همسات سرية',
    whisperSubtitle: 'قراءة الشفاه الصامتة، كتم تلقائي وإضاءة الشموع',
    whisperRoleWhisperer: 'الهامس',
    whisperRoleGuesser: 'المخمّن',
    whisperSoloSwitchRole: 'جرّب الدور الآخر',
    whisperInputLabel: 'همستك السرية (خاصة، 60 حرفاً كحد أقصى)',
    whisperInputPlaceholder: 'اكتب كلمة أو جملة قصيرة لتهمس بها...',
    whisperLevelDoux: '✨ ناعم',
    whisperLevelSeduction: '🌹 إغراء',
    whisperLevelIntense: '🔥 جريء',
    whisperIdeaBtn: '✨ فكرة',
    whisperHintToggle: 'تلميح الطول',
    whisperLaunchBtn: 'ابدأ الهمس (15 ث)',
    whisperPartnerWriting: 'شريكك يكتب همسة سرية...',
    whisperPartnerWritingSub: 'استعد لقراءة شفتيه فور انطلاق المؤقت.',
    whisperMicMutedBadge: '🔇 الميكروفون مكتوم — اهمس الآن!',
    whisperMicVirtualBadge: '🔇 الميكروفون الافتراضي مكتوم — اهمس الآن!',
    whisperMicOpenPartner: '🎙️ ميكروفونك مفتوح: خمّن بصوت عالٍ أو اكتب أدناه',
    whisperZoomLips: 'تقريب الشفاه',
    whisperZoomFullFace: 'الوجه كاملاً',
    whisperFoundBtn: 'عرفها! 💖',
    whisperKissHint: 'أو أرسل قبلة للكاميرا (350 مللي ثانية) للحصول على +2 نقطة',
    whisperKissProgress: 'تم التقاط القبلة...',
    whisperQuickGuessPlaceholder: 'اكتب تخمينك السريع...',
    whisperQuickGuessBtn: 'تأكيد',
    whisperWordHintLabel: 'تلميح الطول',
    whisperRevealHeading: 'الهمسة السرية كانت',
    whisperBonusKissBadge: '💖 تأكيد بقبلة! (+2 نقطة)',
    whisperBonusMatchBadge: '✨ إجابة مطابقة تماماً! (+2 نقطة)',
    whisperBonusEarlyBadge: '💖 تم التخمين قبل الوقت! (+2 نقطة)',
    whisperVerdictGuessedBtn: 'خمّنها بنجاح! (+1 نقطة)',
    whisperVerdictMissedBtn: 'أخطأ (سحب تحدٍ)',
    whisperDareTitle: 'تحدي جريء',
    whisperHeatLabel: 'التقارب / الحرارة',
    whisperScoreLabel: 'النقاط',
    whisperNextRoundBtn: 'الجولة التالية (تبديل الأدوار)',
    whisperWaitingVerdict: 'بانتظار قرار شريكك...',
    whisperPanicBtn: 'تمويه / خصوصية',
    whisperPanicRestoreBtn: 'إزالة التمويه',
    whisperPanicBanner: 'الوضع السري مفعّل · تم تمويه الفيديو وكتم المؤثرات',
    whisperPanicHint: 'اختصار: مسافة',
    whisperSoloAiPreparing: 'كاميل الذكية تختار همسة سرية...',
    whisperSoloPreviewHint: 'معاينة فردية لتقريب الشفاه عبر MediaPipe',
    slingTitle: 'مقلاع النيون الثنائي (Slingshot Duo)',
    slingDesc:
      'اقرص الإبهام والسبابة على مقلاعك النيوني، اسحب للخلف للتصويب بالمنحنى وافتح أصابعك للإطلاق!',
    slingModeCoop: '🤝 تعاون (90ث)',
    slingModeDuel: '⚔️ تحدي (90ث)',
    slingStartBtn: 'شد المقلاع النيوني',
    slingSensorReady: 'تم رصد اليد · اقرص الإبهام والسبابة للشد والإطلاق',
    slingSensorFallback: 'اضغط واسحب على مقلاعك للتصويب والإطلاق',
    slingTimeLabel: 'الوقت',
    slingTeamScoreLabel: 'نتيجة الثنائي',
    slingTrickShotsLabel: 'تسديدات مرتدة',
    slingFusionsLabel: 'اندماج ذهبي',
    slingStunnedBadge: 'مذهول',
    slingPinchHint: 'اقرص واسحب للخلف · افتح أصابعك للإطلاق',
    slingWaitingHost: 'المضيف يختار الوضع ويبدأ المباراة…',
    xoTitle: 'X O نيون (إكس أو بالكاميرا)',
    xoDesc:
      'أشر بالسبابة على خانة واقرص (أو انتظر 1.2ث) لوضع رمزك! في الوضع اللانهائي تختفي أقدم قطعة عند وضع الرابعة.',
    xoStartBtn: 'ابدأ مباراة النيون',
    xoVariantInfinite: '♾️ لا نهائي (بلا تعادل)',
    xoVariantClassic: '🎯 كلاسيكي',
    xoThemeXo: 'X / O نيون',
    xoThemeHearts: '💖 / ⭐ ثنائي',
    xoFormatFirstTo3: 'أول من يصل إلى 3',
    xoFormatFree: 'جولة حرة',
    xoYourTurn: 'دورك الآن!',
    xoPartnerTurn: 'دور',
    xoAiThinking: 'يفكّر…',
    xoFadingHint: 'القطعة الوامضة ستختفي عند النقلة التالية',
    xoHoverHint: 'قرص سريع أو ثبات 1.2ث أو نقرة على خانة فارغة',
    xoSensorReady: 'تم رصد السبابة · اقرص أو اثبت 1.2ث للعب',
    xoSensorFallback: 'انقر أو المس أي خانة فارغة للعب',
    xoRoundWinYou: 'فزت بالجولة!',
    xoRoundWinPartner: 'يفوز بالجولة!',
    xoRoundDraw: 'تعادل متكافئ!',
    xoNextRoundBtn: 'الجولة التالية',
    xoMatchWinYou: 'فوز بالمباراة!',
    xoMatchWinPartner: 'يفوز بالمباراة!',
    xoDareLabel: 'تحدٍ لطيف للخاسر',
    xoRematchBtn: 'إعادة المباراة',
    xoDares: [
      'أرسل 3 قبلات بالكاميرا بالحركة البطيئة مع ألطف نظرة لديك.',
      'ألقِ اعتراف حب درامي لمدة 10 ثوانٍ كأفلام السينما.',
      'قلّد طريقة احتفال شريكك عندما يفوز في أي لعبة.',
      'اذكر أول تفصيل صغير جعلك تقع في حب شريكك.',
      'غنّ مقطعاً قصيراً من أغنيتكما المفضلة لمدة 8 ثوانٍ.',
      'عِد شريكك بإفطار مميز أو جلسة تدليك في لقائكما القادم!',
      'قدّم 3 مجاملات صادقة متتالية دون تكرار أي صفة.',
      'قف وقفة نجوم السينما أمام الكاميرا لمدة 5 ثوانٍ دون أن تضحك.',
      'دع الفائز يختار فيلم السهرة أو موعدكما القادم!',
      'اهمس بأجمل ذكرى تجمعكما أمام الكاميرا.',
    ],
    parchisiTitle: 'بارتشيسي ثنائي · الحب الملكي',
    parchisiDesc:
      'لوح ملكي من 68 خانة، حواجز استراتيجية، إنقاذ بالتحدي عند الأسر وبطاقات ❤️ كارما الثنائي.',
    parchisiModeExpress: '⚡ وضع سريع للثنائي',
    parchisiModeExpressHint: 'بيدق خارج القاعدة منذ البداية · خروج عند 5 أو 6',
    parchisiModeClassic: '👑 وضع كلاسيكي أصيل',
    parchisiModeClassicHint: 'جميع البيادق في القاعدة · خروج عند 5 فقط',
    parchisiStartBtn: 'ابدأ المباراة الملكية',
    parchisiRollBtn: 'رمي النرد',
    parchisiHandDiceToggle: 'رمي باليد',
    parchisiHandShakeHint: 'هزّ يدك أمام الكاميرا لرمي النرد!',
    parchisiAutoMoveToggle: 'حركة تلقائية',
    parchisiYourTurnRoll: 'دورك لرمي النرد!',
    parchisiYourTurnMove: 'اختر بيدقاً مضيئاً للتحرك',
    parchisiBonus20Prompt: '🔥 مكافأة +20 خانة! اختر بيدقاً',
    parchisiBonus10Prompt: '👑 مكافأة +10 خانات! اختر بيدقاً',
    parchisiPartnerTurn: 'دور',
    parchisiAiThinking: 'يلعب دوره…',
    parchisiNoMovesToast: 'لا توجد حركة متاحة',
    parchisiSixBonusSeven: '✨ جميع البيادق خارج القاعدة: الرقم 6 يساوي 7 خانات!',
    parchisiTripleSixCursed: '⚡ ثلاث ستات متتالية! يعود آخر بيدق للقاعدة!',
    parchisiTripleSixSpared: '⚡ ثلاث ستات متتالية! البيدق آمن في الممر النهائي.',
    parchisiMercyTitle: 'أسر ملكي!',
    parchisiMercySub: 'أمسكت ببيدق شريكك! ماذا ستختار؟',
    parchisiMercyNoMercyBtn: '😈 بلا رحمة! (+20 خانة)',
    parchisiMercyOfferDareBtn: '💘 اقتراح تحدٍ للعفو عنه',
    parchisiMercyWaitingPartner: 'بانتظار رد شريكك…',
    parchisiMercyPartnerOffered: 'شريكك يعرض عليك تحدياً لإنقاذ بيدقك!',
    parchisiMercyAcceptBtn: '💘 قبول وتنفيذ التحدي!',
    parchisiMercyDeclineBtn: 'رفض (العودة للقاعدة)',
    parchisiMercyValidateBtn: '✅ تم التحدي! عفو (+10 خانات)',
    parchisiMercyCancelBtn: '😈 إلغاء (بلا رحمة +20)',
    parchisiMercyAiPerforming: 'ينفّذ التحدي أمام الكاميرا بحماس!',
    parchisiTenderHeartBadge: 'قلب حنون',
    parchisiKarmaTitle: 'بطاقة ❤️ كارما الثنائي',
    parchisiKarmaContinueBtn: 'متابعة',
    parchisiEmotes: {
      yum: 'لذيذ!',
      mercy: 'رحمة!',
      blocked: 'محاصر!',
      lucky: 'محظوظ!',
    },
    parchisiVictoryTitle: 'انتصار ملكي!',
    parchisiStatCaptures: 'البيادق المأسورة',
    parchisiStatDares: 'التحديات المنجزة',
    parchisiStatSixes: 'عدد الستات',
    parchisiFinalDareLabel: 'التحدي النهائي للخاسر',
    parchisiKarmaCards: [
      { title: '🛡️ درع الحب', body: 'هذا البيدق محمي من الأسر حتى دورك القادم!' },
      { title: '⚡ توربو +3 خانات', body: 'دفعة حماسية! يتقدم بيدقك 3 خانات إضافية فوراً.' },
      { title: '🎲 رمية مجانية', body: 'الحظ يبتسم للعشاق: احصل على رمية نرد إضافية فوراً!' },
      { title: '💌 سؤال سري', body: 'شارك شريكك: ما هي أجمل ذكرى عشتماها معاً؟' },
      { title: '😊 تحدي الابتسامة', body: 'انظر في عيني شريكك دون أن تضحك طوال دوره القادم!' },
      { title: '✨ مجاملة سريعة', body: 'قدّم مجاملة دقيقة وصادقة لشريكك الآن.' },
      { title: '🛡️ درع الحب', body: 'حماية ملكية مفعّلة! لا يمكن أسر هذا البيدق في هذه الجولة.' },
      { title: '⚡ توربو +3 خانات', body: 'رياح مواتية! يقفز بيدقك 3 خانات للأمام.' },
      { title: '🎲 رمية مجانية', body: 'مكافأة القدر: ارمِ النرد مجاناً مرة أخرى!' },
      { title: '💋 قبلة الحظ', body: 'أرسل قبلة للكاميرا لتبارك رمية النرد القادمة.' },
      { title: '👀 نظرة ساحرة', body: 'وجّه أروع نظرة سينمائية للكاميرا لمدة 4 ثوانٍ.' },
      { title: '🎵 أغنية الثنائي', body: 'دندن 5 ثوانٍ من أغنية تذكّرك بشريكك.' },
      { title: '🌙 حلم مشترك', body: 'صف رحلتكما المثالية القادمة في جملة واحدة.' },
      { title: '🔥 اعتراف لطيف', body: 'اعترف بعادة صغيرة لطيفة في شريكك تجعلك تبتسم دائماً.' },
      { title: '🥂 وعد ملكي', body: 'عِد شريكك بمفاجأة جميلة في لقائكما القادم!' },
      { title: '👑 لقب ملكي', body: 'اختر لشريكك لقباً ملكياً لطيفاً حتى نهاية المباراة.' },
    ],
    parchisiMercyDares: [
      'أرسل 3 قبلات للكاميرا مع ابتسامة عريضة!',
      'اذكر شيئين تحبهما فيّ وأنت تنظر إلى الكاميرا.',
      'وجّه أجمل نظرة لديك للكاميرا لمدة 5 ثوانٍ.',
      'غنّ جملة واحدة من أغنية رومانسية مباشرة!',
      'ارسم قلباً بيديك واهمس باسمي.',
      'قلّد ردة فعلي عندما أحصل على الرقم 6!',
      'قدّم لي مجاملة ملكية كأفلام السينما.',
      'قدّم تحية ملكية رائعة أمام الكاميرا.',
      'أخبرني في 5 ثوانٍ لماذا أنت محظوظ بوجودي!',
      'غمزة بالحركة البطيئة تليها قبلة طائرة.',
      'اخترع لي لقباً رومانسياً لطيفاً فوراً.',
      'عِدني بعناق دافئ لمدة 20 ثانية في لقائنا القادم!',
    ],
    parchisiFinalDares: [
      'أحضر مشروب أو وجبة الفائز المفضلة في سهرتكما القادمة!',
      'ألقِ خطاباً مدته 15 ثانية لتتويج شريكك بطل البارتشيسي الملكي.',
      'الفائز يختار الفيلم أو المسلسل القادم الذي ستشاهدانه معاً!',
      'أرسل 5 قبلات بـ 5 تعابير مختلفة أمام الكاميرا.',
      'عِد الفائز بجلسة تدليك مريحة للكتفين في لقائكما القادم!',
      'غنّ 10 ثوانٍ من الأغنية التي يختارها الفائز.',
      'أرسل رسالة حب مفاجئة للفائز خلال 5 دقائق.',
      'دع الفائز يخطط لفكرة موعدكما الرومانسي القادم!',
      'علّق على أجمل لحظة في المباراة بصوت معلق رياضي.',
      'ألقِ جملة ختامية رومانسية كأفلام الحب أمام الكاميرا!',
    ],
  },
};
