import { logger } from '../utils/logger';
import { APP_LANGUAGE_KEY as LANG_STORAGE_KEY } from './storageKeys';

export type AppLanguage = 'uz' | 'en' | 'ru';

export interface TranslationDictionary {
  appName: string;
  appTagline: string;
  library: string;
  vocab: string;
  newScene: string;
  youtubeImport: string;
  youtubeImportTitle: string;
  youtubeImportDesc: string;
  youtubeUrlPlaceholder: string;
  youtubePasteBtn: string;
  youtubePresetsTitle: string;
  youtubeGenerateBtn: string;
  youtubeGenerating: string;
  tour: string;
  sound: string;
  themeDay: string;
  themeNight: string;
  dayStreak: string;
  userLevel: string;
  credits: string;
  creditsLeft: string;
  goPremium: string;
  upgrade: string;
  freePlan: string;
  viewProfile: string;
  manageAccount: string;
  affiliateProgram: string;
  affiliateNew: string;
  joinCommunity: string;
  language: string;
  signOut: string;
  signOutConfirm: string;
  
  // Hero & Catalog
  featuredLesson: string;
  startPractice: string;
  allCategories: string;
  cartoons: string;
  cinema: string;
  anime: string;
  dailyLife: string;
  searchPlaceholder: string;
  scenesCount: string;
  minutesUnit: string;
  dialoguesCount: string;
  
  // Stats Tiles
  statsTitle: string;
  streakDays: string;
  avgAccuracy: string;
  typingSpeed: string;
  wordsTyped: string;
  completedScenes: string;
  savedWordsCount: string;
  
  // Stage & Player
  tabDescription: string;
  tabMaterials: string;
  tabTask: string;
  tabHighScores: string;
  highScoresTitle: string;
  noHighScoresYet: string;
  firstPlace: string;
  secondPlace: string;
  thirdPlace: string;
  accuracyLabel: string;
  speedWpmLabel: string;
  timeSpentLabel: string;
  youMadeTop3: string;
  share: string;
  translationLabel: string;
  materialsTitle: string;
  taskInstruction: string;
  replay: string;
  prevReplica: string;
  nextReplica: string;
  speedLabel: string;
  backToLibrary: string;
  cdnStreamBadge: string;
  liveStreamBadge: string;
  localFallbackBadge: string;
  
  // Dictation & Practice
  listenAndType: string;
  wordsCountLabel: string;
  typePlaceholder: string;
  accuracyLive: string;
  shadowingBtn: string;
  hintBtn: string;
  revealBtn: string;
  clearBtn: string;
  currentReplica: string;
  characterLabel: string;
  hotkeyReplay: string;
  hotkeySlow: string;
  hotkeyHint: string;
  hotkeyShadowing: string;
  bilingualSubtitles: string;
  subtitlesLocked: string;
  subtitlesUnlocked: string;
  subtitlesForceShow: string;
  subtitlesHide: string;
  searchWordTitle: string;
  foundDialoguesCount: string;
  noDialoguesFound: string;
  jumpToDialogue: string;
  
  // Shadowing Modal
  shadowingTitle: string;
  shadowingSubtitle: string;
  listenCharacterVoice: string;
  clickMicToSpeak: string;
  recordingNow: string;
  analyzingSpeech: string;
  tryAgain: string;
  congratsPassed: string;
  continueBtn: string;
  feedbackPerfect: string;
  feedbackGood: string;
  feedbackNeedsWork: string;
  xpRewardBonus: string;
  
  // Profile & Settings
  editProfile: string;
  yourName: string;
  userHandle: string;
  save: string;
  cancel: string;
  nextLevelXP: string;
  selectLanguage: string;
  langUzbek: string;
  langEnglish: string;
  langRussian: string;
  
  // Friend Challenge
  challengeFriendBtn: string;
  challengeModalTitle: string;
  challengeModalDesc: string;
  challengePreviewText: string;
  copyChallengeLink: string;
  linkCopiedSuccess: string;
  challengeBannerTitle: string;
  challengeBannerText: string;
  challengeAcceptBtn: string;
  shareViaTelegram: string;
}

export const TRANSLATIONS: Record<AppLanguage, TranslationDictionary> = {
  uz: {
    appName: 'Tinglov',
    appTagline: 'Kinolar orqali ingliz tilini o‘rganing',
    library: 'Katalog',
    vocab: 'Lug‘at',
    newScene: 'Yangi',
    youtubeImport: 'YouTube Import',
    youtubeImportTitle: 'YouTube Dars Generatori',
    youtubeImportDesc: 'Ixtiyoriy YouTube video havolasini kiritib, o‘zingiz uchun to‘liq interaktiv diktant darsini yarating',
    youtubeUrlPlaceholder: 'https://www.youtube.com/watch?v=... yoki youtu.be/...',
    youtubePasteBtn: 'Qo‘yish',
    youtubePresetsTitle: 'Mashhur tayyor videolar:',
    youtubeGenerateBtn: 'Darsni Generatsiya Qilish',
    youtubeGenerating: 'Video tahlil qilinmoqda va dars yaratilmoqda...',
    tour: 'Qo‘llanma',
    sound: 'Ovoz',
    themeDay: 'Kunduzgi rejim',
    themeNight: 'Tungi rejim',
    dayStreak: 'kun streak',
    userLevel: 'Daraja',
    credits: 'Kreditlar',
    creditsLeft: 'ta qoldi',
    goPremium: 'Premiumga o‘tish',
    upgrade: 'Upgrade',
    freePlan: 'Bepul reja',
    viewProfile: 'Profilni ko‘rish',
    manageAccount: 'Sozlamalar',
    affiliateProgram: 'Do‘stlarni taklif qilish',
    affiliateNew: 'Yangi',
    joinCommunity: 'Hamjamiyatga qo‘shilish',
    language: 'Til (Language)',
    signOut: 'Akkauntdan chiqish',
    signOutConfirm: 'Haqiqatan ham akkauntdan chiqmoqchimisiz?',
    
    featuredLesson: 'Asosiy Tavsiya Darsi',
    startPractice: 'Mashqni boshlash',
    allCategories: 'Barchasi',
    cartoons: 'Multfilmlar',
    cinema: 'Kinolar',
    anime: 'Anime',
    dailyLife: 'Kundalik hayot',
    searchPlaceholder: 'Multfilm, kino yoki iboralarni qidirish...',
    scenesCount: 'ta video dars',
    minutesUnit: 'daqiqa',
    dialoguesCount: 'ta replika',
    
    statsTitle: 'Mening O‘sish Ko‘rsatkichlarim',
    streakDays: 'Ketma-ket kun',
    avgAccuracy: 'O‘rtacha aniqlik',
    typingSpeed: 'Yozish tezligi',
    wordsTyped: 'Jami yozilgan so‘zlar',
    completedScenes: 'Tugatilgan darslar',
    savedWordsCount: 'Saqlangan so‘zlar',
    
    tabDescription: 'Tavsif (Description)',
    tabMaterials: 'Lug‘at (Materials)',
    tabTask: 'Topshiriq (Home task)',
    tabHighScores: '🏆 TOP 3 Reyting',
    highScoresTitle: 'Ushbu videoni eng tez va xatosiz yozgan rekordchilar',
    noHighScoresYet: 'Hozircha hech kim ushbu videoni yozmagan. Birinchi bo‘lib TOP-1 ga chiqing!',
    firstPlace: '1-o‘rin (Oltin)',
    secondPlace: '2-o‘rin (Kumush)',
    thirdPlace: '3-o‘rin (Bronza)',
    accuracyLabel: 'Aniqlik',
    speedWpmLabel: 'Tezlik',
    timeSpentLabel: 'Vaqt',
    youMadeTop3: 'Tabriklaymiz! Siz ushbu videoda TOP 3 rekordchilar qatoriga kirdingiz! 🏆',
    share: 'Ulashish',
    translationLabel: 'Tarjimasi:',
    materialsTitle: 'Ushbu replikadagi so‘zlar:',
    taskInstruction: 'Topshiriq: Jumlani 100% aniqlikda va yordamsiz yozishga harakat qiling (+25 XP ball).',
    replay: 'Qayta eshitish',
    prevReplica: 'Oldingi',
    nextReplica: 'Keyingi',
    speedLabel: 'Tezlik:',
    backToLibrary: 'Katalogga qaytish',
    cdnStreamBadge: 'CDN Stream',
    liveStreamBadge: 'Live Stream',
    localFallbackBadge: 'Local Fallback',
    
    listenAndType: 'Eshitilgan replikani yozing:',
    wordsCountLabel: 'ta so‘z',
    typePlaceholder: 'Jumlani yozing...',
    accuracyLive: 'Aniqlik:',
    shadowingBtn: 'Ovozli takrorlash',
    hintBtn: 'Yordam',
    revealBtn: 'Ko‘rish',
    clearBtn: 'Tozalash',
    currentReplica: 'Joriy replika:',
    characterLabel: 'Qahramon:',
    hotkeyReplay: 'Qayta eshitish',
    hotkeySlow: 'Sekinlashtirish',
    hotkeyHint: 'Yordam',
    hotkeyShadowing: 'Shadowing',
    bilingualSubtitles: 'Parallel Subtitrlar',
    subtitlesLocked: 'Diktant yakunlangach ochiladi',
    subtitlesUnlocked: 'Diktant yakunlandi • Subtitrlar ochildi',
    subtitlesForceShow: 'Hozir ko‘rsatish',
    subtitlesHide: 'Yashirish',
    searchWordTitle: 'So‘z bo‘yicha topilgan lavhalar',
    foundDialoguesCount: 'ta lavhada aytilgan',
    noDialoguesFound: 'so‘zi aytilgan kino lavhasi topilmadi',
    jumpToDialogue: 'Lavhani tinglash',
    
    shadowingTitle: 'Shadowing Mode: Ovozli Takrorlash',
    shadowingSubtitle: 'Eshitgan jumlani mikrofonga aniq talaffuz bilan qaytaring',
    listenCharacterVoice: 'Qahramon ovozini tinglash',
    clickMicToSpeak: 'Mikrofonni bosing va ovoz chiqarib gapiring',
    recordingNow: 'Tinglanmoqda... Marhamat, gapiring',
    analyzingSpeech: 'AI talaffuzingizni tahlil qilmoqda...',
    tryAgain: 'Qayta urinish',
    congratsPassed: 'Ajoyib natija! Talaffuz muvaffaqiyatli topshirildi.',
    continueBtn: 'Davom etish',
    feedbackPerfect: 'Mukammal! Talaffuzingiz nihoyatda aniq va ravon.',
    feedbackGood: 'Yaxshi! Kichik noaniqliklar bor, lekin juda tushunarli.',
    feedbackNeedsWork: 'Harakat qiling! So‘zlarni aniqroq talaffuz qilishga e’tibor bering.',
    xpRewardBonus: 'XP mukofoti olindi!',
    
    editProfile: 'Profilni tahrirlash',
    yourName: 'Ismingiz:',
    userHandle: 'Foydalanuvchi nomi (@handle):',
    save: 'Saqlash',
    cancel: 'Bekor qilish',
    nextLevelXP: 'Keyingi darajagacha:',
    selectLanguage: 'Tilni tanlang',
    langUzbek: 'O‘zbekcha',
    langEnglish: 'English',
    langRussian: 'Русский',
    
    // Friend Challenge
    challengeFriendBtn: 'Do‘stga Challenge Yuborish',
    challengeModalTitle: 'Do‘stlar bilan Bellashuv (Challenge)',
    challengeModalDesc: 'Ushbu kinodagi natijangiz bilan do‘stingizni chaqiring va bellashing!',
    challengePreviewText: 'Men bu sahnani {accuracy}% bilan yozdim, sen ham sinab ko‘r!',
    copyChallengeLink: 'Havolani nusxalash',
    linkCopiedSuccess: 'Havola nusxalandi! Do‘stlaringizga yuboring.',
    challengeBannerTitle: 'Do‘stingiz sizni bellashuvga chaqirdi!',
    challengeBannerText: '{userName} ushbu sahnani {accuracy}% aniqlikda {wpm} wpm tezlik bilan yozdi. O‘zib keta olasizmi?',
    challengeAcceptBtn: 'Bellashuvni Boshlash',
    shareViaTelegram: 'Telegram orqali yuborish'
  },
  
  en: {
    appName: 'Tinglov',
    appTagline: 'Master English listening through cinema and cartoons',
    library: 'Library',
    vocab: 'Vocabulary',
    newScene: 'Add Scene',
    youtubeImport: 'YouTube Import',
    youtubeImportTitle: 'YouTube Lesson Generator',
    youtubeImportDesc: 'Paste any YouTube video link to generate an interactive dictation lesson automatically',
    youtubeUrlPlaceholder: 'https://www.youtube.com/watch?v=... or youtu.be/...',
    youtubePasteBtn: 'Paste',
    youtubePresetsTitle: 'Popular study presets:',
    youtubeGenerateBtn: 'Generate Lesson',
    youtubeGenerating: 'Analyzing video and generating dictation...',
    tour: 'Guide',
    sound: 'Sound',
    themeDay: 'Light Mode',
    themeNight: 'Dark Mode',
    dayStreak: 'day streak',
    userLevel: 'Level',
    credits: 'Credits',
    creditsLeft: 'left',
    goPremium: 'Go Premium',
    upgrade: 'Upgrade',
    freePlan: 'Free Plan',
    viewProfile: 'View profile',
    manageAccount: 'Settings',
    affiliateProgram: 'Affiliate program',
    affiliateNew: 'New',
    joinCommunity: 'Join Community',
    language: 'Language',
    signOut: 'Sign Out',
    signOutConfirm: 'Are you sure you want to sign out?',
    
    featuredLesson: 'Featured Lesson',
    startPractice: 'Start Practice',
    allCategories: 'All Categories',
    cartoons: 'Cartoons',
    cinema: 'Cinema',
    anime: 'Anime',
    dailyLife: 'Daily Life',
    searchPlaceholder: 'Search movies, cartoons or phrases...',
    scenesCount: 'video lessons',
    minutesUnit: 'min',
    dialoguesCount: 'dialogues',
    
    statsTitle: 'Learning Progress & Stats',
    streakDays: 'Day Streak',
    avgAccuracy: 'Average Accuracy',
    typingSpeed: 'Typing Speed',
    wordsTyped: 'Total Words Typed',
    completedScenes: 'Completed Lessons',
    savedWordsCount: 'Saved Words',
    
    tabDescription: 'Description',
    tabMaterials: 'Materials',
    tabTask: 'Home Task',
    tabHighScores: '🏆 TOP 3 Scores',
    highScoresTitle: 'Top 3 Fastest & Most Accurate Typists',
    noHighScoresYet: 'No records yet for this video. Be the first to claim #1!',
    firstPlace: '1st Place (Gold)',
    secondPlace: '2nd Place (Silver)',
    thirdPlace: '3rd Place (Bronze)',
    accuracyLabel: 'Accuracy',
    speedWpmLabel: 'Speed',
    timeSpentLabel: 'Time',
    youMadeTop3: 'Congratulations! You made it into the TOP 3 leaderboard! 🏆',
    share: 'Share',
    translationLabel: 'Translation:',
    materialsTitle: 'Vocabulary in this dialogue:',
    taskInstruction: 'Goal: Type the entire sentence with 100% accuracy without using hints (+25 XP).',
    replay: 'Replay Audio',
    prevReplica: 'Previous',
    nextReplica: 'Next',
    speedLabel: 'Speed:',
    backToLibrary: 'Back to Library',
    cdnStreamBadge: 'CDN Stream',
    liveStreamBadge: 'Live Stream',
    localFallbackBadge: 'Local Fallback',
    
    listenAndType: 'Type the heard dialogue:',
    wordsCountLabel: 'words',
    typePlaceholder: 'Type the sentence here...',
    accuracyLive: 'Accuracy:',
    shadowingBtn: 'Shadowing Practice',
    hintBtn: 'Hint',
    revealBtn: 'Reveal',
    clearBtn: 'Clear',
    currentReplica: 'Current line:',
    characterLabel: 'Speaker:',
    hotkeyReplay: 'Replay',
    hotkeySlow: 'Slow Down',
    hotkeyHint: 'Hint',
    hotkeyShadowing: 'Shadowing',
    bilingualSubtitles: 'Bilingual Subtitles',
    subtitlesLocked: 'Reveals after dictation',
    subtitlesUnlocked: 'Dictation complete • Subtitles unlocked',
    subtitlesForceShow: 'Show now',
    subtitlesHide: 'Hide',
    searchWordTitle: 'Scenes with this spoken word',
    foundDialoguesCount: 'dialogue clips found',
    noDialoguesFound: 'no scene found with this spoken word',
    jumpToDialogue: 'Play Dialogue',
    
    shadowingTitle: 'Shadowing Mode: Voice Practice',
    shadowingSubtitle: 'Listen closely and repeat into the microphone with clear pronunciation',
    listenCharacterVoice: 'Listen to Original Line',
    clickMicToSpeak: 'Click the microphone and speak aloud',
    recordingNow: 'Listening... Speak now',
    analyzingSpeech: 'AI is analyzing your pronunciation...',
    tryAgain: 'Try Again',
    congratsPassed: 'Awesome! Pronunciation benchmark achieved.',
    continueBtn: 'Continue',
    feedbackPerfect: 'Perfect! Your pronunciation is clear and natural.',
    feedbackGood: 'Good job! Minor accent nuances, but very understandable.',
    feedbackNeedsWork: 'Keep practicing! Focus on articulation and phonetics.',
    xpRewardBonus: 'Bonus XP awarded!',
    
    editProfile: 'Edit Profile',
    yourName: 'Your Name:',
    userHandle: 'Username (@handle):',
    save: 'Save Changes',
    cancel: 'Cancel',
    nextLevelXP: 'To next level:',
    selectLanguage: 'Select Language',
    langUzbek: 'O‘zbekcha',
    langEnglish: 'English',
    langRussian: 'Русский',
    
    // Friend Challenge
    challengeFriendBtn: 'Challenge a Friend',
    challengeModalTitle: 'Friend Challenge',
    challengeModalDesc: 'Share your accuracy and challenge a friend to beat your typing score!',
    challengePreviewText: 'I typed this scene with {accuracy}%, can you beat it?',
    copyChallengeLink: 'Copy Challenge Link',
    linkCopiedSuccess: 'Link copied! Send it to your friend.',
    challengeBannerTitle: 'Your friend challenged you!',
    challengeBannerText: '{userName} completed this scene with {accuracy}% accuracy at {wpm} wpm. Can you beat them?',
    challengeAcceptBtn: 'Accept Challenge',
    shareViaTelegram: 'Share via Telegram'
  },
  
  ru: {
    appName: 'Tinglov',
    appTagline: 'Учите английский язык на слух по мультфильмам и фильмам',
    library: 'Каталог',
    vocab: 'Словарь',
    newScene: 'Добавить',
    youtubeImport: 'Импорт с YouTube',
    youtubeImportTitle: 'Генератор уроков с YouTube',
    youtubeImportDesc: 'Вставьте любую ссылку на YouTube, чтобы автоматически сгенерировать интерактивный урок аудирования',
    youtubeUrlPlaceholder: 'https://www.youtube.com/watch?v=... или youtu.be/...',
    youtubePasteBtn: 'Вставить',
    youtubePresetsTitle: 'Популярные готовые видео:',
    youtubeGenerateBtn: 'Сгенерировать урок',
    youtubeGenerating: 'Анализируем видео и создаем интерактивный урок...',
    tour: 'Гайд',
    sound: 'Звук',
    themeDay: 'Светлая тема',
    themeNight: 'Темная тема',
    dayStreak: 'дней подряд',
    userLevel: 'Уровень',
    credits: 'Кредиты',
    creditsLeft: 'осталось',
    goPremium: 'Перейти на Pro',
    upgrade: 'Upgrade',
    freePlan: 'Бесплатный план',
    viewProfile: 'Мой профиль',
    manageAccount: 'Настройки',
    affiliateProgram: 'Партнерская программа',
    affiliateNew: 'New',
    joinCommunity: 'Сообщество в Discord',
    language: 'Язык (Language)',
    signOut: 'Выйти из аккаунта',
    signOutConfirm: 'Вы действительно хотите выйти из аккаунта?',
    
    featuredLesson: 'Рекомендованный Урок',
    startPractice: 'Начать тренировку',
    allCategories: 'Все категории',
    cartoons: 'Мультфильмы',
    cinema: 'Кино и сериалы',
    anime: 'Аниме',
    dailyLife: 'Повседневная жизнь',
    searchPlaceholder: 'Поиск мультфильмов, фильмов или фраз...',
    scenesCount: 'видеоуроков',
    minutesUnit: 'мин',
    dialoguesCount: 'реплик',
    
    statsTitle: 'Прогресс и статистика обучения',
    streakDays: 'Дней подряд (Streak)',
    avgAccuracy: 'Средняя точность',
    typingSpeed: 'Скорость набора',
    wordsTyped: 'Набрано слов',
    completedScenes: 'Пройдено сцен',
    savedWordsCount: 'Сохранено слов',
    
    tabDescription: 'Описание',
    tabMaterials: 'Словарь сцены',
    tabTask: 'Домашнее задание',
    tabHighScores: '🏆 ТОП 3 Рекорды',
    highScoresTitle: 'ТОП 3 самых быстрых и безошибочных участников',
    noHighScoresYet: 'Пока никто не прошел это видео. Станьте первым в ТОП-1!',
    firstPlace: '1-е место (Золото)',
    secondPlace: '2-е место (Серебро)',
    thirdPlace: '3-е место (Бронза)',
    accuracyLabel: 'Точность',
    speedWpmLabel: 'Скорость',
    timeSpentLabel: 'Время',
    youMadeTop3: 'Поздравляем! Вы вошли в ТОП 3 рекордсменов этого видео! 🏆',
    share: 'Поделиться',
    translationLabel: 'Перевод:',
    materialsTitle: 'Слова в этой реплике:',
    taskInstruction: 'Цель: наберите всю фразу со 100% точностью без подсказок (+25 XP).',
    replay: 'Слушать снова',
    prevReplica: 'Назад',
    nextReplica: 'Вперед',
    speedLabel: 'Скорость:',
    backToLibrary: 'В каталог уроков',
    cdnStreamBadge: 'CDN Stream',
    liveStreamBadge: 'Live Stream',
    localFallbackBadge: 'Local Fallback',
    
    listenAndType: 'Напишите услышанную фразу:',
    wordsCountLabel: 'слов',
    typePlaceholder: 'Введите услышанную фразу...',
    accuracyLive: 'Точность:',
    shadowingBtn: 'Озвучить (Shadowing)',
    hintBtn: 'Подсказка',
    revealBtn: 'Открыть',
    clearBtn: 'Очистить',
    currentReplica: 'Текущая реплика:',
    characterLabel: 'Персонаж:',
    hotkeyReplay: 'Повторить',
    hotkeySlow: 'Замедлить',
    hotkeyHint: 'Подсказка',
    hotkeyShadowing: 'Shadowing',
    bilingualSubtitles: 'Двуязычные субтитры',
    subtitlesLocked: 'Откроется после диктанта',
    subtitlesUnlocked: 'Диктант завершен • Субтитры открыты',
    subtitlesForceShow: 'Показать сейчас',
    subtitlesHide: 'Скрыть',
    searchWordTitle: 'Сцены с этим произнесенным словом',
    foundDialoguesCount: 'реплик найдено',
    noDialoguesFound: 'сцен с этим словом не найдено',
    jumpToDialogue: 'Слушать сцену',
    
    shadowingTitle: 'Режим Shadowing: Отработка произношения',
    shadowingSubtitle: 'Внимательно послушайте и повторите в микрофон с чистым произношением',
    listenCharacterVoice: 'Послушать оригинальную озвучку',
    clickMicToSpeak: 'Нажмите на микрофон и произнесите фразу',
    recordingNow: 'Идет запись... Говорите сейчас',
    analyzingSpeech: 'ИИ оценивает ваше произношение...',
    tryAgain: 'Попробовать снова',
    congratsPassed: 'Отлично! Произношение успешно подтверждено.',
    continueBtn: 'Продолжить',
    feedbackPerfect: 'Идеально! Чистое, естественное и уверенное произношение.',
    feedbackGood: 'Хорошо! Есть небольшие шероховатости, но речь вполне понятна.',
    feedbackNeedsWork: 'Нужно потренироваться! Четче артикулируйте звуки.',
    xpRewardBonus: 'Начислены бонусные XP!',
    
    editProfile: 'Редактировать профиль',
    yourName: 'Ваше имя:',
    userHandle: 'Имя пользователя (@handle):',
    save: 'Сохранить',
    cancel: 'Отмена',
    nextLevelXP: 'До следующего уровня:',
    selectLanguage: 'Выберите язык интерфейса',
    langUzbek: 'O‘zbekcha',
    langEnglish: 'English',
    langRussian: 'Русский',
    
    // Friend Challenge
    challengeFriendBtn: 'Бросить вызов другу',
    challengeModalTitle: 'Дуэль с другом (Challenge)',
    challengeModalDesc: 'Поделитесь своим результатом и бросьте вызов другу, чтобы узнать, кто напишет быстрее!',
    challengePreviewText: 'Я прошел эту сцену с точностью {accuracy}%, попробуй превзойти меня!',
    copyChallengeLink: 'Скопировать ссылку',
    linkCopiedSuccess: 'Ссылка скопирована! Отправьте её другу.',
    challengeBannerTitle: 'Вам бросили вызов!',
    challengeBannerText: '{userName} прошел эту сцену с точностью {accuracy}% и скоростью {wpm} wpm. Сможете лучше?',
    challengeAcceptBtn: 'Принять вызов',
    shareViaTelegram: 'Отправить в Telegram'
  }
};

class I18nService {
  private currentLang: AppLanguage = 'uz';
  private listeners: Array<(lang: AppLanguage) => void> = [];

  constructor() {
    const saved = localStorage.getItem(LANG_STORAGE_KEY) as AppLanguage | null;
    if (saved && (saved === 'uz' || saved === 'en' || saved === 'ru')) {
      this.currentLang = saved;
    } else {
      this.currentLang = 'uz';
    }
  }

  public getLanguage(): AppLanguage {
    return this.currentLang;
  }

  public setLanguage(lang: AppLanguage): void {
    if (lang === 'uz' || lang === 'en' || lang === 'ru') {
      this.currentLang = lang;
      localStorage.setItem(LANG_STORAGE_KEY, lang);
      this.notifyListeners();
    }
  }

  public t(): TranslationDictionary {
    return TRANSLATIONS[this.currentLang];
  }

  public getLanguageLabel(lang: AppLanguage = this.currentLang): string {
    switch (lang) {
      case 'uz': return 'O‘zbekcha';
      case 'en': return 'English';
      case 'ru': return 'Русский';
      default: return 'O‘zbekcha';
    }
  }

  public getSentenceTranslation(dialogue: { text: string; uzbekTranslation: string; russianTranslation?: string }): string {
    if (this.currentLang === 'en') {
      return dialogue.text;
    } else if (this.currentLang === 'ru') {
      return dialogue.russianTranslation || dialogue.uzbekTranslation;
    } else {
      return dialogue.uzbekTranslation;
    }
  }

  public subscribe(callback: (lang: AppLanguage) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(cb => {
      try {
        cb(this.currentLang);
      } catch (err) {
        logger.error('Error in i18n listener:', err);
      }
    });
  }
}

export const i18n = new I18nService();
