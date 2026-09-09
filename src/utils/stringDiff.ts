import { DictationFeedback } from '../types';

/**
 * Normalizes text for comparison by removing punctuation and converting to lowercase.
 */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'’]/g, '')
    .trim();
}

export function splitIntoWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(w => w.length > 0);
}

/**
 * Compares user typed text against expected target sentence.
 */
export function evaluateDictation(userInput: string, targetText: string): DictationFeedback {
  const targetWords = splitIntoWords(targetText);
  const userWords = splitIntoWords(userInput);

  const tokens: DictationFeedback['userTokens'] = [];
  let correctCount = 0;
  let errorsCount = 0;

  for (let i = 0; i < targetWords.length; i++) {
    const expected = targetWords[i];
    const cleanExpected = normalizeWord(expected);
    const userWord = userWords[i];

    if (!userWord) {
      // User hasn't typed this word yet
      tokens.push({
        word: '',
        isCorrect: false,
        expectedWord: expected,
        status: 'missing'
      });
    } else {
      const cleanUser = normalizeWord(userWord);
      if (cleanUser === cleanExpected) {
        correctCount++;
        tokens.push({
          word: userWord,
          isCorrect: true,
          expectedWord: expected,
          status: 'correct'
        });
      } else {
        errorsCount++;
        tokens.push({
          word: userWord,
          isCorrect: false,
          expectedWord: expected,
          status: 'incorrect'
        });
      }
    }
  }

  // Handle any extra words typed beyond expected target
  if (userWords.length > targetWords.length) {
    for (let i = targetWords.length; i < userWords.length; i++) {
      errorsCount++;
      tokens.push({
        word: userWords[i],
        isCorrect: false,
        expectedWord: '',
        status: 'extra'
      });
    }
  }

  const isComplete = targetWords.length > 0 &&
    userWords.length === targetWords.length &&
    tokens.every(t => t.status === 'correct');

  const accuracy = targetWords.length > 0
    ? Math.round((correctCount / Math.max(targetWords.length, userWords.length)) * 100)
    : 0;

  return {
    userTokens: tokens,
    isComplete,
    accuracy,
    errorsCount,
    revealedCount: 0
  };
}

/**
 * Provides a smart hint by giving the next missing or incorrect word or first letters.
 */
export function getNextHint(userInput: string, targetText: string): { hintWord: string; index: number; partialHint: string } | null {
  const targetWords = splitIntoWords(targetText);
  const userWords = splitIntoWords(userInput);

  for (let i = 0; i < targetWords.length; i++) {
    const cleanExpected = normalizeWord(targetWords[i]);
    const cleanUser = userWords[i] ? normalizeWord(userWords[i]) : '';

    if (cleanUser !== cleanExpected) {
      const fullWord = targetWords[i];
      const partial = fullWord.length > 2 
        ? fullWord.slice(0, 2) + '...' 
        : fullWord.slice(0, 1) + '...';

      return {
        hintWord: fullWord,
        index: i,
        partialHint: partial
      };
    }
  }

  return null;
}
