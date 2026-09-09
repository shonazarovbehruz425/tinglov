import { Scene } from '../types';

export const INITIAL_SCENES: Scene[] = [
  {
    id: 'oppogoy-yetti-gnom',
    title: 'Oppog‘oy va Yetti Gnom',
    movieName: 'Snow White and the Seven Dwarfs',
    coverEmoji: '🍎',
    difficulty: 'beginner',
    category: 'Cartoon',
    duration: '0:57',
    accent: 'American',
    videoUrl: '/cartoons/snow_white.mp4',
    cdnVideoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    streamingUrl: 'https://cdn.jsdelivr.net/gh/movielisten/assets@main/cartoons/snow_white.mp4',
    coverImage: '/cartoons/snow_white_poster.jpg',
    dialogues: [
      {
        id: 'sw-1',
        character: 'Oppog\'oy (Snow White)',
        characterAvatar: '👸',
        characterColor: '#38bdf8',
        startTime: 9.0,
        endTime: 10.8,
        text: 'Hello.',
        cleanText: 'Hello',
        uzbekTranslation: 'Salom.',
        russianTranslation: 'Привет.',
        wordDictionary: {
          hello: {
            word: 'hello',
            translation: 'salom',
            definition: 'Used as a greeting or to begin a conversation.',
            partOfSpeech: 'exclamation',
            phonetics: '/həˈloʊ/'
          }
        },
        tip: 'Qahramon qushchalar bilan salomlashmoqda.'
      },
      {
        id: 'sw-2',
        character: 'Oppog\'oy (Snow White)',
        characterAvatar: '👸',
        characterColor: '#38bdf8',
        startTime: 10.9,
        endTime: 12.4,
        text: 'How are you?',
        cleanText: 'How are you',
        uzbekTranslation: 'Qalaysiz? (Ahvolingiz yaxshimi?)',
        russianTranslation: 'Как дела?',
        wordDictionary: {
          how: {
            word: 'how are you',
            translation: 'ahvolingiz qanday / qalaysiz',
            definition: 'A friendly greeting asking about someone\'s condition.',
            partOfSpeech: 'phrase',
            phonetics: '/haʊ ɑːr juː/'
          }
        },
        tip: 'Ahvol so\'rash iborasi: "How are you?"'
      },
      {
        id: 'sw-3',
        character: 'Qushchalar',
        characterAvatar: '🐦',
        characterColor: '#f59e0b',
        startTime: 12.5,
        endTime: 14.8,
        text: 'I\'m good. Thanks.',
        cleanText: 'Im good Thanks',
        uzbekTranslation: 'Men yaxshiman. Rahmat.',
        russianTranslation: 'Я в порядке. Спасибо.',
        wordDictionary: {
          good: {
            word: 'good',
            translation: 'yaxshi',
            definition: 'To be in a positive state.',
            partOfSpeech: 'adjective',
            phonetics: '/ɡʊd/'
          },
          thanks: {
            word: 'thanks',
            translation: 'rahmat',
            definition: 'An expression of gratitude.',
            partOfSpeech: 'noun / exclamation',
            phonetics: '/θæŋks/'
          }
        },
        tip: '"I\'m good. Thanks."'
      },
      {
        id: 'sw-4',
        character: 'Kempir (Jodugar)',
        characterAvatar: '🧙‍♀️',
        characterColor: '#a855f7',
        startTime: 16.0,
        endTime: 18.2,
        text: 'Can I come in?',
        cleanText: 'Can I come in',
        uzbekTranslation: 'Kirsam bo\'ladimi?',
        russianTranslation: 'Можно войти?',
        wordDictionary: {
          come: {
            word: 'come in',
            translation: 'ichkariga kirmoq',
            definition: 'Enter a place.',
            partOfSpeech: 'phrasal verb',
            phonetics: '/kʌm ɪn/'
          }
        },
        tip: 'Ruxsat so\'rash: "Can I come in?"'
      },
      {
        id: 'sw-5',
        character: 'Oppog\'oy (Snow White)',
        characterAvatar: '👸',
        characterColor: '#38bdf8',
        startTime: 18.3,
        endTime: 19.8,
        text: 'Sure.',
        cleanText: 'Sure',
        uzbekTranslation: 'Albatta.',
        russianTranslation: 'Конечно.',
        wordDictionary: {
          sure: {
            word: 'sure',
            translation: 'albatta / shubhasiz',
            definition: 'Certainly; without doubt.',
            partOfSpeech: 'adverb',
            phonetics: '/ʃʊr/'
          }
        },
        tip: 'Taklifga ijobiy rozilik bildirish: "Sure."'
      },
      {
        id: 'sw-6',
        character: 'Kempir (Jodugar)',
        characterAvatar: '🧙‍♀️',
        characterColor: '#a855f7',
        startTime: 21.8,
        endTime: 24.2,
        text: 'Do you like apples?',
        cleanText: 'Do you like apples',
        uzbekTranslation: 'Olmani yoqtirasizmi?',
        russianTranslation: 'Ты любишь яблоки?',
        wordDictionary: {
          apples: {
            word: 'apples',
            translation: 'olmalar',
            definition: 'The round fruit of a tree.',
            partOfSpeech: 'noun (plural)',
            phonetics: '/ˈæp.əlz/'
          }
        },
        tip: 'Savol berish: "Do you like ...?"'
      },
      {
        id: 'sw-7',
        character: 'Oppog\'oy (Snow White)',
        characterAvatar: '👸',
        characterColor: '#38bdf8',
        startTime: 24.3,
        endTime: 27.5,
        text: 'Yes. I like apples.',
        cleanText: 'Yes I like apples',
        uzbekTranslation: 'Ha. Men olmani yoqtiraman.',
        russianTranslation: 'Да. Я люблю яблоки.',
        wordDictionary: {
          like: {
            word: 'like',
            translation: 'yoqtirmoq',
            definition: 'To find agreeable or enjoyable.',
            partOfSpeech: 'verb',
            phonetics: '/laɪk/'
          }
        },
        tip: 'Javob: "Yes. I like ..."'
      },
      {
        id: 'sw-8',
        character: 'Kempir (Jodugar)',
        characterAvatar: '🧙‍♀️',
        characterColor: '#a855f7',
        startTime: 28.8,
        endTime: 30.8,
        text: 'Help yourself.',
        cleanText: 'Help yourself',
        uzbekTranslation: 'Marhamat, oling (bemalol yeng).',
        russianTranslation: 'Угощайся.',
        wordDictionary: {
          help: {
            word: 'help yourself',
            translation: 'marhamat, oling / o\'zingizga xizmat qiling',
            definition: 'An invitation to take food or drink freely.',
            partOfSpeech: 'idiom',
            phonetics: '/help jʊərˈself/'
          }
        },
        tip: 'Mehmonga taom taklif qilish: "Help yourself."'
      },
      {
        id: 'sw-9',
        character: 'Oppog\'oy (Snow White)',
        characterAvatar: '👸',
        characterColor: '#38bdf8',
        startTime: 31.0,
        endTime: 32.5,
        text: 'Thanks.',
        cleanText: 'Thanks',
        uzbekTranslation: 'Rahmat.',
        russianTranslation: 'Спасибо.',
        wordDictionary: {
          thanks: {
            word: 'thanks',
            translation: 'rahmat',
            definition: 'Thank you.',
            partOfSpeech: 'exclamation',
            phonetics: '/θæŋks/'
          }
        },
        tip: 'Minnatdorchilik bildirish.'
      },
      {
        id: 'sw-10',
        character: 'Kempir (Jodugar)',
        characterAvatar: '🧙‍♀️',
        characterColor: '#a855f7',
        startTime: 35.5,
        endTime: 39.0,
        text: 'Do you want some more?',
        cleanText: 'Do you want some more',
        uzbekTranslation: 'Yana xohlaysizmi?',
        russianTranslation: 'Хочешь еще?',
        wordDictionary: {
          want: {
            word: 'want',
            translation: 'xohlamoq',
            definition: 'Desire to possess or do something.',
            partOfSpeech: 'verb',
            phonetics: '/wɑːnt/'
          }
        },
        tip: 'Yana taklif qilish: "Do you want some more?"'
      },
      {
        id: 'sw-11',
        character: 'Oppog\'oy (Snow White)',
        characterAvatar: '👸',
        characterColor: '#38bdf8',
        startTime: 39.0,
        endTime: 40.5,
        text: 'No, thanks.',
        cleanText: 'No thanks',
        uzbekTranslation: 'Yo\'q, rahmat.',
        russianTranslation: 'Нет, спасибо.',
        wordDictionary: {
          no: {
            word: 'no thanks',
            translation: 'yo\'q, rahmat',
            definition: 'Polite refusal.',
            partOfSpeech: 'phrase',
            phonetics: '/noʊ θæŋks/'
          }
        },
        tip: 'Xushmuomalalik bilan rad etish.'
      },
      {
        id: 'sw-12',
        character: 'Kempir (Jodugar)',
        characterAvatar: '🧙‍♀️',
        characterColor: '#a855f7',
        startTime: 47.0,
        endTime: 49.8,
        text: 'Are you okay?',
        cleanText: 'Are you okay',
        uzbekTranslation: 'Yaxshimisiz?',
        russianTranslation: 'Ты в порядке?',
        wordDictionary: {
          okay: {
            word: 'okay',
            translation: 'yaxshi / joyida',
            definition: 'Fine, well.',
            partOfSpeech: 'adjective',
            phonetics: '/oʊˈkeɪ/'
          }
        },
        tip: 'Hol-ahvol so\'rash: "Are you okay?"'
      },
      {
        id: 'sw-13',
        character: 'Oppog\'oy (Snow White)',
        characterAvatar: '👸',
        characterColor: '#38bdf8',
        startTime: 49.8,
        endTime: 52.0,
        text: 'I\'m okay. Thank you.',
        cleanText: 'Im okay Thank you',
        uzbekTranslation: 'Men yaxshiman. Rahmat sizga.',
        russianTranslation: 'Я в порядке. Спасибо.',
        wordDictionary: {
          thank: {
            word: 'thank you',
            translation: 'tashakkur / rahmat sizga',
            definition: 'Polite expression of gratitude.',
            partOfSpeech: 'phrase',
            phonetics: '/θæŋk juː/'
          }
        },
        tip: '"I\'m okay. Thank you."'
      },
      {
        id: 'sw-14',
        character: 'Oppog\'oy (Snow White)',
        characterAvatar: '👸',
        characterColor: '#38bdf8',
        startTime: 52.0,
        endTime: 54.5,
        text: 'I\'m so happy.',
        cleanText: 'Im so happy',
        uzbekTranslation: 'Men juda ham baxtiyorman.',
        russianTranslation: 'Я так счастлива.',
        wordDictionary: {
          happy: {
            word: 'happy',
            translation: 'baxtiyor / quvnoq',
            definition: 'Feeling pleasure or satisfaction.',
            partOfSpeech: 'adjective',
            phonetics: '/ˈhæp.i/'
          }
        },
        tip: '"so happy" — nihoyatda baxtiyor.'
      }
    ]
  }
];

