import type { Language } from '../types/duoplay';

export interface TranslationDictionary {
  langName: string;
  dir: 'ltr' | 'rtl';
  // Global / Toolbar
  roomLabel: string;
  copyShort: string;
  copiedShort: string;
  backToRoomMenu: string;
  micActive: string;
  micMuted: string;
  micOff: string;
  enableMic: string;
  leaveRoom: string;
  leaveConfirmTitle: string;
  leaveConfirmBody: string;
  leaveConfirmCancel: string;
  leaveConfirmConfirm: string;
  youTag: string;
  hostTag: string;
  guestTag: string;
  aiTag: string;
  statusReady: string;
  statusConnected: string;
  statusWaiting: string;
  orDivider: string;
  toastCodeCopied: string;
  toastLinkCopied: string;
  toastPartnerConnected: string;
  toastSoloStarted: string;
  // Home / Lobby
  lobbyHeadline: string;
  lobbySubtitlePrefix: string;
  lobbySubtitleStrong: string;
  lobbySubtitleSuffix: string;
  soloCta: string;
  yourNameLabel: string;
  yourNamePlaceholder: string;
  tabJoin: string;
  createBtn: string;
  creatingBtn: string;
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
  // Room Menu (Waiting Lounge)
  roomMenuTitle: string;
  roomMenuSubtitle: string;
  roomMenuWaitingGuest: string;
  roomMenuPartnerReady: string;
  roomMenuDiceLabel: string;
  roomMenuDice1: string;
  roomMenuDice2: string;
  roomMenuDiceHostHint: string;
  roomMenuParcheesiBadge: string;
  roomMenuParcheesiTitle: string;
  roomMenuParcheesiDesc: string;
  roomMenuPlayBtn: string;
  roomMenuPlayWaitingBtn: string;
  roomMenuGuestWaitingBadge: string;
  voiceSpeaking: string;
  voiceListening: string;
  voiceMuted: string;
  voiceNoMic: string;
  voiceWaitingSlot: string;
  // Live Chat & Reactions
  chatTitle: string;
  chatEmpty: string;
  chatPlaceholder: string;
  chatSendBtn: string;
  chatToggleLabel: string;
  // Toolbar & Settings
  toolbarAiShort: string;
  toolbarAiMode: string;
  toolbarLivePrefix: string;
  toolbarLanguageLabel: string;
  toolbarSfxLabel: string;
  toolbarSettingsLabel: string;
  // Error Boundary
  errorBoundaryTitle: string;
  errorBoundarySub: string;
  // Reconnecting
  reconnectingTitle: string;
}

export const TRANSLATIONS: Record<Language, TranslationDictionary> = {
  fr: {
    langName: 'Français',
    dir: 'ltr',
    roomLabel: 'Salon',
    copyShort: 'Copier',
    copiedShort: 'Copié',
    backToRoomMenu: 'Menu du salon',
    micActive: 'Micro actif',
    micMuted: 'Micro coupé',
    micOff: 'Micro inactif',
    enableMic: 'Activer micro',
    leaveRoom: 'Quitter le salon',
    leaveConfirmTitle: 'Quitter le salon ?',
    leaveConfirmBody: 'La partie et l’appel vocal seront fermés pour vous deux.',
    leaveConfirmCancel: 'Rester',
    leaveConfirmConfirm: 'Oui, quitter',
    youTag: '(Toi)',
    hostTag: 'Hôte',
    guestTag: 'Invité',
    aiTag: 'IA',
    statusReady: 'Prêt',
    statusConnected: 'Connecté',
    statusWaiting: 'En attente',
    orDivider: 'OU',
    toastCodeCopied: 'Code copié ! ✓',
    toastLinkCopied: 'Lien d’invitation copié ! ✓',
    toastPartnerConnected: 'Partenaire connecté dans le salon ! 🎉',
    toastSoloStarted: 'Mode Solo prêt avec Camille IA ✨',
    lobbyHeadline: 'Parcheesi en duo, vocal & chat en direct.',
    lobbySubtitlePrefix: 'Ouvre un salon privé pour jouer à ',
    lobbySubtitleStrong: 'Parcheesi (1 ou 2 dés)',
    lobbySubtitleSuffix: ' avec appel vocal et chat en direct, sans jamais couper.',
    soloCta: 'Jouer avec IA',
    yourNameLabel: 'Ton prénom',
    yourNamePlaceholder: 'Ex. Alex, Léa, Sam...',
    tabJoin: 'Rejoindre un salon',
    createBtn: 'Créer un salon',
    creatingBtn: 'Création...',
    shareCodeLabel: 'Code du salon',
    copyCodeBtn: 'Copier le code',
    codeCopiedBtn: 'Copié ! ✓',
    copyLinkBtn: 'Copier le lien d’invitation',
    linkCopiedBtn: 'Lien copié ! ✓',
    waitingPartner: 'En attente de ton/ta partenaire...',
    cancelBtn: 'Annuler',
    joinCodeLabel: 'Code à 4 caractères',
    joinBtn: 'Rejoindre',
    joiningBtn: 'Connexion...',
    errEnterNameCreate: 'Indique d’abord ton prénom pour créer le salon.',
    errEnterNameJoin: 'Indique d’abord ton prénom avant de rejoindre.',
    errInvalidCode: 'Saisis le code complet à 4 caractères du salon.',
    roomMenuTitle: 'Salon Parcheesi',
    roomMenuSubtitle: 'Discutez au micro ou par chat, choisissez le nombre de dés, puis lancez la partie.',
    roomMenuWaitingGuest: 'En attente de l’invité…',
    roomMenuPartnerReady: 'Prêts à jouer !',
    roomMenuDiceLabel: 'Mode de dés',
    roomMenuDice1: '🎲 1 Dé',
    roomMenuDice2: '🎲🎲 2 Dés',
    roomMenuDiceHostHint: 'Choisi par l’hôte',
    roomMenuParcheesiBadge: 'PLATEAU CLASSIQUE · 68 CASES',
    roomMenuParcheesiTitle: 'Parcheesi Royal',
    roomMenuParcheesiDesc: 'Sortie sur 5, captures +20, arrivée +10, animations fluides 60 fps.',
    roomMenuPlayBtn: '▶ Jouer à Parcheesi',
    roomMenuPlayWaitingBtn: 'En attente de l’invité…',
    roomMenuGuestWaitingBadge: '⏳ En attente que l’hôte lance Parcheesi...',
    voiceSpeaking: 'Parle…',
    voiceListening: 'Micro actif',
    voiceMuted: 'Micro coupé',
    voiceNoMic: 'Chat uniquement',
    voiceWaitingSlot: 'En attente d’un joueur…',
    chatTitle: 'Chat en direct',
    chatEmpty: 'Dis bonjour ou envoie une réaction !',
    chatPlaceholder: 'Écrire un message…',
    chatSendBtn: 'Envoyer',
    chatToggleLabel: 'Chat',
    toolbarAiShort: 'IA',
    toolbarAiMode: 'Mode IA',
    toolbarLivePrefix: 'Salon •',
    toolbarLanguageLabel: 'Langue',
    toolbarSfxLabel: 'Effets sonores',
    toolbarSettingsLabel: 'Paramètres',
    errorBoundaryTitle: 'Oups, Parcheesi a rencontré une erreur',
    errorBoundarySub: 'Ton salon, ton micro et le chat restent 100 % connectés.',
    reconnectingTitle: 'Reconnexion au salon en cours…',
  },
  en: {
    langName: 'English',
    dir: 'ltr',
    roomLabel: 'Room',
    copyShort: 'Copy',
    copiedShort: 'Copied',
    backToRoomMenu: 'Room Menu',
    micActive: 'Mic On',
    micMuted: 'Mic Muted',
    micOff: 'Mic Off',
    enableMic: 'Enable Mic',
    leaveRoom: 'Leave Room',
    leaveConfirmTitle: 'Leave the room?',
    leaveConfirmBody: 'This will close the match and voice call for both players.',
    leaveConfirmCancel: 'Stay',
    leaveConfirmConfirm: 'Yes, leave',
    youTag: '(You)',
    hostTag: 'Host',
    guestTag: 'Guest',
    aiTag: 'AI',
    statusReady: 'Ready',
    statusConnected: 'Connected',
    statusWaiting: 'Waiting',
    orDivider: 'OR',
    toastCodeCopied: 'Code copied! ✓',
    toastLinkCopied: 'Invite link copied! ✓',
    toastPartnerConnected: 'Partner joined the room! 🎉',
    toastSoloStarted: 'Solo AI mode ready with Camille AI ✨',
    lobbyHeadline: 'Duo Parcheesi with live voice & chat.',
    lobbySubtitlePrefix: 'Open a private room and play ',
    lobbySubtitleStrong: 'Parcheesi (1 or 2 Dice)',
    lobbySubtitleSuffix: ' with crisp voice audio and live chat that never drops.',
    soloCta: 'Play with AI',
    yourNameLabel: 'Your nickname',
    yourNamePlaceholder: 'e.g. Alex, Mia, Sam...',
    tabJoin: 'Join Room',
    createBtn: 'Create Room',
    creatingBtn: 'Creating...',
    shareCodeLabel: 'Room Code',
    copyCodeBtn: 'Copy code',
    codeCopiedBtn: 'Copied! ✓',
    copyLinkBtn: 'Copy invite link',
    linkCopiedBtn: 'Link copied! ✓',
    waitingPartner: 'Waiting for your partner...',
    cancelBtn: 'Cancel',
    joinCodeLabel: '4-character code',
    joinBtn: 'Join',
    joiningBtn: 'Joining...',
    errEnterNameCreate: 'Enter your nickname first to create a room.',
    errEnterNameJoin: 'Enter your nickname before joining.',
    errInvalidCode: 'Enter the full 4-character room code.',
    roomMenuTitle: 'Parcheesi Room',
    roomMenuSubtitle: 'Talk over voice or chat, pick 1 or 2 dice, then launch Parcheesi together.',
    roomMenuWaitingGuest: 'Waiting for guest…',
    roomMenuPartnerReady: 'Both players ready!',
    roomMenuDiceLabel: 'Dice Mode',
    roomMenuDice1: '🎲 1 Dice',
    roomMenuDice2: '🎲🎲 2 Dice',
    roomMenuDiceHostHint: 'Host choice',
    roomMenuParcheesiBadge: 'CLASSIC BOARD · 68 TILES',
    roomMenuParcheesiTitle: 'Royal Parcheesi',
    roomMenuParcheesiDesc: 'Exit on 5, capture +20, center home +10, smooth 60fps animations.',
    roomMenuPlayBtn: '▶ Play Parcheesi',
    roomMenuPlayWaitingBtn: 'Waiting for guest…',
    roomMenuGuestWaitingBadge: '⏳ Waiting for host to start Parcheesi...',
    voiceSpeaking: 'Speaking…',
    voiceListening: 'Mic active',
    voiceMuted: 'Mic muted',
    voiceNoMic: 'Chat only',
    voiceWaitingSlot: 'Waiting for player…',
    chatTitle: 'Live Chat',
    chatEmpty: 'Say hello or send a quick reaction!',
    chatPlaceholder: 'Type a message…',
    chatSendBtn: 'Send',
    chatToggleLabel: 'Chat',
    toolbarAiShort: 'AI',
    toolbarAiMode: 'AI Mode',
    toolbarLivePrefix: 'Room •',
    toolbarLanguageLabel: 'Language',
    toolbarSfxLabel: 'Sound effects',
    toolbarSettingsLabel: 'Settings',
    errorBoundaryTitle: 'Oops, Parcheesi hit an error',
    errorBoundarySub: 'Your room, voice call, and chat remain 100% connected.',
    reconnectingTitle: 'Reconnecting to your room…',
  },
  ar: {
    langName: 'العربية',
    dir: 'rtl',
    roomLabel: 'الغرفة',
    copyShort: 'نسخ',
    copiedShort: 'تم النسخ',
    backToRoomMenu: 'قائمة الغرفة',
    micActive: 'الميكروفون مفعل',
    micMuted: 'الميكروفون مكتوم',
    micOff: 'بدون ميكروفون',
    enableMic: 'تفعيل الميكروفون',
    leaveRoom: 'مغادرة الغرفة',
    leaveConfirmTitle: 'مغادرة الغرفة؟',
    leaveConfirmBody: 'سيتم إغلاق اللعبة والمكالمة الصوتية لكلا اللاعبين.',
    leaveConfirmCancel: 'البقاء',
    leaveConfirmConfirm: 'نعم، مغادرة',
    youTag: '(أنت)',
    hostTag: 'المضيف',
    guestTag: 'الضيف',
    aiTag: 'الذكاء الاصطناعي',
    statusReady: 'جاهز',
    statusConnected: 'متصل',
    statusWaiting: 'في الانتظار',
    orDivider: 'أو',
    toastCodeCopied: 'تم نسخ الرمز! ✓',
    toastLinkCopied: 'تم نسخ رابط الدعوة! ✓',
    toastPartnerConnected: 'انضم شريكك إلى الغرفة! 🎉',
    toastSoloStarted: 'وضع اللعب ضد الذكاء الاصطناعي جاهز ✨',
    lobbyHeadline: 'بارشيسي ثنائي مع صوت ودردشة مباشرة.',
    lobbySubtitlePrefix: 'افتح غرفة خاصة والعب ',
    lobbySubtitleStrong: 'بارشيسي (نرد واحد أو نردين)',
    lobbySubtitleSuffix: ' مع مكالمة صوتية ودردشة مباشرة بدون انقطاع.',
    soloCta: 'اللعب مع الذكاء الاصطناعي',
    yourNameLabel: 'اسمك',
    yourNamePlaceholder: 'مثال: سامي، سارة...',
    tabJoin: 'انضم إلى غرفة',
    createBtn: 'إنشاء غرفة',
    creatingBtn: 'جارٍ الإنشاء...',
    shareCodeLabel: 'رمز الغرفة',
    copyCodeBtn: 'نسخ الرمز',
    codeCopiedBtn: 'تم النسخ! ✓',
    copyLinkBtn: 'نسخ رابط الدعوة',
    linkCopiedBtn: 'تم نسخ الرابط! ✓',
    waitingPartner: 'في انتظار انضمام الشريك...',
    cancelBtn: 'إلغاء',
    joinCodeLabel: 'رمز من 4 أحرف/أرقام',
    joinBtn: 'انضمام',
    joiningBtn: 'جارٍ الاتصال...',
    errEnterNameCreate: 'أدخل اسمك أولاً لإنشاء الغرفة.',
    errEnterNameJoin: 'أدخل اسمك قبل الانضمام.',
    errInvalidCode: 'أدخل رمز الغرفة المكون من 4 أحرف أو أرقام.',
    roomMenuTitle: 'غرفة بارشيسي',
    roomMenuSubtitle: 'تحدثوا بالصوت أو الدردشة، اختر عدد النرد ثم ابدأ اللعبة.',
    roomMenuWaitingGuest: 'في انتظار الضيف…',
    roomMenuPartnerReady: 'الجميع جاهز للعب!',
    roomMenuDiceLabel: 'عدد النرد',
    roomMenuDice1: '🎲 نرد 1',
    roomMenuDice2: '🎲🎲 نردان 2',
    roomMenuDiceHostHint: 'اختيار المضيف',
    roomMenuParcheesiBadge: 'لوحة كلاسيكية · 68 خانة',
    roomMenuParcheesiTitle: 'بارشيسي الملكي',
    roomMenuParcheesiDesc: 'خروج بالرقم 5، أكل +20، وصول +10، حركات سلسة 60 إطار/ث.',
    roomMenuPlayBtn: '▶ ابدأ بارشيسي',
    roomMenuPlayWaitingBtn: 'في انتظار الضيف…',
    roomMenuGuestWaitingBadge: '⏳ في انتظار المضيف لبدء بارشيسي...',
    voiceSpeaking: 'يتحدث…',
    voiceListening: 'صوت مفعل',
    voiceMuted: 'مكتوم',
    voiceNoMic: 'دردشة فقط',
    voiceWaitingSlot: 'في انتظار لاعب…',
    chatTitle: 'دردشة مباشرة',
    chatEmpty: 'قل مرحباً أو أرسل تفاعلاً سريعاً!',
    chatPlaceholder: 'اكتب رسالة…',
    chatSendBtn: 'إرسال',
    chatToggleLabel: 'دردشة',
    toolbarAiShort: 'ذكاء',
    toolbarAiMode: 'وضع الذكاء الاصطناعي',
    toolbarLivePrefix: 'غرفة •',
    toolbarLanguageLabel: 'اللغة',
    toolbarSfxLabel: 'المؤثرات الصوتية',
    toolbarSettingsLabel: 'الإعدادات',
    errorBoundaryTitle: 'عذراً، حدث خطأ في بارشيسي',
    errorBoundarySub: 'تبقى غرفتك والمكالمة الصوتية والدردشة متصلة بالكامل.',
    reconnectingTitle: 'جارٍ إعادة الاتصال بالغرفة…',
  },
};
