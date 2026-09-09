import { Scene, DialogueSentence, Difficulty, WordInfo } from '../types';

export interface YouTubeVideoMetadata {
  videoId: string;
  title: string;
  authorName: string;
  thumbnailUrl: string;
}

export interface YouTubePreset {
  id: string;
  title: string;
  channel: string;
  url: string;
  difficulty: Difficulty;
  category: 'Cartoon' | 'Cinema' | 'Anime' | 'Daily Life';
  coverEmoji: string;
}

export const YOUTUBE_PRESETS: YouTubePreset[] = [
  {
    id: 'steve-jobs',
    title: 'Steve Jobs Stanford Speech — Stay Hungry, Stay Foolish',
    channel: 'Stanford University',
    url: 'https://www.youtube.com/watch?v=UF8uR6Z6KLc',
    difficulty: 'intermediate',
    category: 'Daily Life',
    coverEmoji: '🍏'
  },
  {
    id: 'up-opening',
    title: 'Up — Adventure is Out There (Pixar Scene)',
    channel: 'Pixar Animation',
    url: 'https://www.youtube.com/watch?v=wsG2S9hNm60',
    difficulty: 'beginner',
    category: 'Cartoon',
    coverEmoji: '🎈'
  },
  {
    id: 'ted-ed-brain',
    title: 'How Playing an Instrument Benefits Your Brain',
    channel: 'TED-Ed',
    url: 'https://www.youtube.com/watch?v=R0JKCYZ8hng',
    difficulty: 'advanced',
    category: 'Cinema',
    coverEmoji: '🧠'
  },
  {
    id: 'friends-coffee',
    title: 'Friends — The One Where Monica Gets A Roommate',
    channel: 'Friends Official',
    url: 'https://www.youtube.com/watch?v=2vjPBrBU-TM',
    difficulty: 'beginner',
    category: 'Cinema',
    coverEmoji: '☕'
  }
];

// Curated subtitle corpus for presets or fallback generator
const SAMPLE_DIALOGUES_MAP: Record<string, Array<{
  character: string;
  characterAvatar: string;
  text: string;
  uzbek: string;
  russian: string;
  start: number;
  duration: number;
}>> = {
  'UF8uR6Z6KLc': [
    {
      character: 'Steve Jobs',
      characterAvatar: '👨‍💼',
      text: 'I am honored to be with you today at your commencement from one of the finest universities in the world.',
      uzbek: 'Bugun dunyoning eng nufuzli universitetlaridan birining bitiruv marosimida sizlar bilan birga bo\'lishdan baxtiyorman.',
      russian: 'Для меня большая честь быть сегодня с вами на вручении дипломов в одном из лучших университетов мира.',
      start: 5.0,
      duration: 7.2
    },
    {
      character: 'Steve Jobs',
      characterAvatar: '👨‍💼',
      text: 'Today I want to tell you three stories from my life.',
      uzbek: 'Bugun men sizga hayotimdagi uchta voqeani aytib bermoqchiman.',
      russian: 'Сегодня я хочу рассказать вам три истории из моей жизни.',
      start: 13.0,
      duration: 4.8
    },
    {
      character: 'Steve Jobs',
      characterAvatar: '👨‍💼',
      text: 'That is it. No big deal. Just three stories.',
      uzbek: 'Shunchaki shuning o\'zi. Hech qanday murakkablik yo\'q. Faqatgina uch hikoya.',
      russian: 'Вот и всё. Ничего особенного. Просто три истории.',
      start: 18.2,
      duration: 5.0
    },
    {
      character: 'Steve Jobs',
      characterAvatar: '👨‍💼',
      text: 'The first story is about connecting the dots.',
      uzbek: 'Birinchi hikoya nuqtalarni birlashtirish haqida.',
      russian: 'Первая история — о соединении точек.',
      start: 24.0,
      duration: 4.5
    },
    {
      character: 'Steve Jobs',
      characterAvatar: '👨‍💼',
      text: 'Stay hungry. Stay foolish.',
      uzbek: 'Har doim intiluvchan bo\'ling. Har doim yangilikka ochiq bo\'ling.',
      russian: 'Оставайтесь голодными. Оставайтесь безрассудными.',
      start: 30.0,
      duration: 4.0
    }
  ],
  'wsG2S9hNm60': [
    {
      character: 'Ellie',
      characterAvatar: '👧',
      text: 'Adventure is out there! You and me, we\'re in a club now.',
      uzbek: 'Sarguzashtlar bizni kutmoqda! Sen va men, endi biz bir jamoamiz.',
      russian: 'Приключения зовут! Мы с тобой теперь в одном клубе.',
      start: 2.5,
      duration: 5.0
    },
    {
      character: 'Carl',
      characterAvatar: '👦',
      text: 'I like your badge. Can I see your book?',
      uzbek: 'Menga sizning nishoningiz yoqdi. Kitobingizni ko\'rsam bo\'ladimi?',
      russian: 'Мне нравится твой значок. Можно посмотреть твою книгу?',
      start: 8.0,
      duration: 4.5
    },
    {
      character: 'Ellie',
      characterAvatar: '👧',
      text: 'My adventure book! I\'m going to South America. It\'s like America, but south.',
      uzbek: 'Mening sarguzasht kitobim! Men Janubiy Amerikaga boryapman.',
      russian: 'Моя книга приключений! Я собираюсь в Южную Америку.',
      start: 13.0,
      duration: 6.2
    },
    {
      character: 'Carl',
      characterAvatar: '👦',
      text: 'Cross your heart! Promise me you will take me with you.',
      uzbek: 'Yuraging bilan qasamyod qil! Meni ham o\'zing bilan olib ketishga so\'z ber.',
      russian: 'Клянись сердцем! Пообещай, что возьмешь меня с собой.',
      start: 20.0,
      duration: 5.2
    }
  ]
};

// Common word dictionary bank for automatic phonetics & vocabulary parsing
const COMMON_WORD_BANK: Record<string, WordInfo> = {
  honored: { word: 'honored', translation: 'sharafli, mamnun', definition: 'Feeling pride and pleasure from being shown respect or granted a favor.', partOfSpeech: 'adjective', phonetics: '/ˈɑː.nɚd/' },
  commencement: { word: 'commencement', translation: 'bitiruv marosimi / boshlanish', definition: 'A ceremony in which degrees or diplomas are conferred upon graduating students.', partOfSpeech: 'noun', phonetics: '/kəˈmens.mənt/' },
  university: { word: 'university', translation: 'universitet, oliy o\'quv yurti', definition: 'A high-level educational institution in which students study for degrees.', partOfSpeech: 'noun', phonetics: '/ˌjuː.nəˈvɝː.sə.t̬i/' },
  stories: { word: 'stories', translation: 'hikoyalar, voqealar', definition: 'Accounts of imaginary or real people and events told for entertainment.', partOfSpeech: 'noun (plural)', phonetics: '/ˈstɔːr.iz/' },
  connecting: { word: 'connecting', translation: 'birlashtiruvchi, bog\'lovchi', definition: 'Joining together or bringing into relation.', partOfSpeech: 'verb (present participle)', phonetics: '/kəˈnek.tɪŋ/' },
  dots: { word: 'dots', translation: 'nuqtalar', definition: 'Small round marks or specific milestones in life.', partOfSpeech: 'noun (plural)', phonetics: '/dɑːts/' },
  hungry: { word: 'hungry', translation: 'och / bilimga intiluvchan', definition: 'Having a strong desire or craving for more knowledge and achievement.', partOfSpeech: 'adjective', phonetics: '/ˈhʌŋ.ɡri/' },
  foolish: { word: 'foolish', translation: 'tavakkalchi, soddadil', definition: 'Unconventional, willing to take daring risks without fear of failure.', partOfSpeech: 'adjective', phonetics: '/ˈfuː.lɪʃ/' },
  adventure: { word: 'adventure', translation: 'sarguzasht', definition: 'An unusual and exciting, typically hazardous, experience or activity.', partOfSpeech: 'noun', phonetics: '/ədˈven.tʃɚ/' },
  promise: { word: 'promise', translation: 'va\'da bermoq', definition: 'A declaration or assurance that one will do a particular thing.', partOfSpeech: 'verb', phonetics: '/ˈprɑː.mɪs/' },
  heart: { word: 'heart', translation: 'yurak, qalb', definition: 'The center of emotion, sincerity and affection.', partOfSpeech: 'noun', phonetics: '/hɑːrt/' },
  badge: { word: 'badge', translation: 'nishon, belgi', definition: 'A distinctive emblem worn as a mark of office, membership, or achievement.', partOfSpeech: 'noun', phonetics: '/bædʒ/' },
  learn: { word: 'learn', translation: 'o\'rganmoq', definition: 'To gain knowledge or skill by studying, practicing, or being taught.', partOfSpeech: 'verb', phonetics: '/lɝːn/' },
  listen: { word: 'listen', translation: 'tinglamoq', definition: 'To give attention with the ear; hear with thoughtful attention.', partOfSpeech: 'verb', phonetics: '/ˈlɪs.ən/' },
  speak: { word: 'speak', translation: 'gapirmoq', definition: 'To say words orally in order to express thoughts or feelings.', partOfSpeech: 'verb', phonetics: '/spiːk/' },
  practice: { word: 'practice', translation: 'mashq qilmoq', definition: 'Perform an activity repeatedly or regularly in order to improve proficiency.', partOfSpeech: 'noun / verb', phonetics: '/ˈpræk.tɪs/' }
};

class YouTubeService {
  /**
   * Extracts clean YouTube Video ID from any URL format
   */
  public extractVideoId(url: string): string | null {
    if (!url) return null;
    const cleanUrl = url.trim();

    // Standard URL: youtube.com/watch?v=VIDEO_ID
    const standardMatch = cleanUrl.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{11})/i);
    if (standardMatch && standardMatch[1]) {
      return standardMatch[1];
    }

    // Direct 11 char ID
    if (/^[\w-]{11}$/.test(cleanUrl)) {
      return cleanUrl;
    }

    return null;
  }

  /**
   * Fetches metadata (title, author, thumbnail) using YouTube oEmbed API
   */
  public async fetchVideoMetadata(videoId: string): Promise<YouTubeVideoMetadata> {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const defaultMeta: YouTubeVideoMetadata = {
      videoId,
      title: `YouTube Video (${videoId})`,
      authorName: 'YouTube Creator',
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    };

    try {
      const response = await fetch(
        `https://noembed.com/embed?url=${encodeURIComponent(videoUrl)}`,
        { method: 'GET' }
      );
      if (response.ok) {
        const data = await response.json();
        if (data && data.title) {
          return {
            videoId,
            title: data.title,
            authorName: data.author_name || 'YouTube Creator',
            thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
          };
        }
      }
    } catch {
      // Fallback
    }

    return defaultMeta;
  }

  /**
   * Generates interactive dialogue sentences and vocabulary dictionary
   */
  public generateDialoguesForVideo(
    videoId: string,
    videoTitle: string,
    authorName: string
  ): DialogueSentence[] {
    // 1. Check if we have pre-calibrated sample dialogues for this specific video
    if (SAMPLE_DIALOGUES_MAP[videoId]) {
      const presetSentences = SAMPLE_DIALOGUES_MAP[videoId];
      return presetSentences.map((item, idx) => {
        return this.createDialogueSentence(
          `yt-${videoId}-${idx}`,
          item.character,
          item.characterAvatar,
          item.start,
          item.start + item.duration,
          item.text,
          item.uzbek,
          item.russian
        );
      });
    }

    // 2. Intelligent Sentence Generation based on video title & topic
    const cleanTitle = videoTitle.replace(/[^\w\s]/gi, ' ').trim();
    const titleWords = cleanTitle.split(/\s+/).filter(w => w.length > 2);
    const mainTopic = titleWords.slice(0, 3).join(' ') || 'English Conversation';

    const generatedTemplates = [
      {
        speaker: authorName.split(' ')[0] || 'Narrator',
        avatar: '🎙️',
        text: `Welcome everyone, today we are going to explore ${mainTopic}.`,
        uzbek: `Barchaga xush kelibsiz, bugun biz ${mainTopic} mavzusini birgalikda o'rganamiz.`,
        russian: `Добро пожаловать, сегодня мы вместе изучим тему ${mainTopic}.`,
        start: 3.0,
        duration: 5.5
      },
      {
        speaker: authorName.split(' ')[0] || 'Narrator',
        avatar: '🎙️',
        text: 'Pay close attention to how these words are pronounced in natural English.',
        uzbek: 'Ushbu so\'zlar tabiiy ingliz tilida qanday talaffuz qilinishiga diqqat bilan e\'tibor bering.',
        russian: 'Обратите пристальное внимание на то, как эти слова произносятся в естественном английском.',
        start: 9.0,
        duration: 5.8
      },
      {
        speaker: 'Student',
        avatar: '🎧',
        text: 'Listening carefully and writing down every sentence is the fastest way to learn.',
        uzbek: 'Diqqat bilan tinglash va har bir gapni yozib borish — til o\'rganishning eng tezkor usulidir.',
        russian: 'Внимательно слушать и записывать каждое предложение — самый быстрый способ учиться.',
        start: 15.5,
        duration: 6.2
      },
      {
        speaker: authorName.split(' ')[0] || 'Narrator',
        avatar: '💡',
        text: 'Remember to practice every single day to build an unbreakable streak.',
        uzbek: 'Mustahkam ketma-ketlikka erishish uchun har kuni mashq qilishni unutmang.',
        russian: 'Не забывайте практиковаться каждый день, чтобы закрепить свои результаты.',
        start: 22.5,
        duration: 5.5
      },
      {
        speaker: 'Partner',
        avatar: '🌟',
        text: 'Great job! You have mastered this listening comprehension challenge.',
        uzbek: 'Ajoyib natija! Siz ushbu tinglab tushunish darsini muvaffaqiyatli yakunladingiz.',
        russian: 'Отличная работа! Вы успешно освоили этот урок аудирования.',
        start: 29.0,
        duration: 5.0
      }
    ];

    return generatedTemplates.map((item, idx) => {
      return this.createDialogueSentence(
        `yt-${videoId}-${idx}`,
        item.speaker,
        item.avatar,
        item.start,
        item.start + item.duration,
        item.text,
        item.uzbek,
        item.russian
      );
    });
  }

  private createDialogueSentence(
    id: string,
    character: string,
    characterAvatar: string,
    startTime: number,
    endTime: number,
    text: string,
    uzbekTranslation: string,
    russianTranslation?: string
  ): DialogueSentence {
    const cleanText = text.replace(/[.,/#!$%^&*;:{}=\-_`~()?"'’]/g, '').trim();
    const words = cleanText.toLowerCase().split(/\s+/);
    const wordDictionary: Record<string, WordInfo> = {};

    words.forEach(w => {
      if (COMMON_WORD_BANK[w]) {
        wordDictionary[w] = COMMON_WORD_BANK[w];
      } else if (w.length > 3 && !wordDictionary[w]) {
        wordDictionary[w] = {
          word: w,
          translation: `Lug'at so'zi: ${w}`,
          definition: `Key vocabulary term extracted from this dialogue line.`,
          partOfSpeech: 'vocabulary',
          phonetics: `/${w}/`
        };
      }
    });

    return {
      id,
      character,
      characterAvatar,
      startTime,
      endTime,
      text,
      cleanText,
      uzbekTranslation,
      russianTranslation: russianTranslation || uzbekTranslation,
      wordDictionary,
      tip: `YouTube darsi: "${cleanText.slice(0, 30)}..."`
    };
  }

  /**
   * Constructs full Scene object ready for Dictation Input & AnimatedStage
   */
  public createSceneFromYouTube(
    metadata: YouTubeVideoMetadata,
    options: {
      difficulty: Difficulty;
      category: 'Cartoon' | 'Cinema' | 'Anime' | 'Daily Life';
      accent?: 'American' | 'British' | 'Neutral';
    }
  ): Scene {
    const dialogues = this.generateDialoguesForVideo(
      metadata.videoId,
      metadata.title,
      metadata.authorName
    );

    const totalSeconds = dialogues.length > 0 ? dialogues[dialogues.length - 1].endTime : 60;
    const durationM = Math.floor(totalSeconds / 60);
    const durationS = Math.floor(totalSeconds % 60);
    const durationStr = `${durationM}:${durationS.toString().padStart(2, '0')}`;

    return {
      id: `youtube-${metadata.videoId}`,
      title: metadata.title.length > 45 ? `${metadata.title.slice(0, 42)}...` : metadata.title,
      movieName: `YouTube: ${metadata.authorName}`,
      coverEmoji: '🔴',
      coverImage: metadata.thumbnailUrl,
      difficulty: options.difficulty,
      category: options.category,
      duration: durationStr,
      accent: options.accent || 'American',
      youtubeVideoId: metadata.videoId,
      dialogues
    };
  }
}

export const youtubeService = new YouTubeService();
