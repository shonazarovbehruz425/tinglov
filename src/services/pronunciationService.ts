export interface WordPronunciationResult {
  expectedWord: string;
  spokenWord: string;
  isCorrect: boolean;
  similarity: number; // 0 to 100
  status: 'perfect' | 'good' | 'imperfect' | 'missed';
  tip?: string;
}

export interface PronunciationAssessment {
  overallScore: number; // 0 to 100
  fluencyScore: number;
  accuracyScore: number;
  verdict: 'Mukammal! 🌟' | 'Juda yaxshi! 👏' | 'Yaxshi, yana ozgina! 👍' | 'Qayta urinib ko‘ring 🔄';
  feedbackUz: string;
  words: WordPronunciationResult[];
  transcript: string;
  durationSeconds: number;
}

/**
 * Normalizes speech text for fair phonetic & lexical comparison
 */
export function cleanSpokenText(text: string): string {
  return text
    .toLowerCase()
    // Curly apostrophes (U+2019) first normalize to ASCII ' so a single
    // strip class below removes both variants.
    .replace(/’/g, "'")
    // NOTE: the class must contain an apostrophe: without it "don't" survived
    // cleaning as "don't" and never matched the contraction map keys ("dont").
    // (The class previously had a duplicated `!` where `'` belongs — typo.)
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, '')
    .trim();
}

/**
 * Calculates Levenshtein edit distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix = Array.from({ length: bn + 1 }, () => new Array(an + 1).fill(0));

  for (let i = 0; i <= an; i++) matrix[0][i] = i;
  for (let j = 0; j <= bn; j++) matrix[j][0] = j;

  for (let j = 1; j <= bn; j++) {
    for (let i = 1; i <= an; i++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[j][i] = matrix[j - 1][i - 1];
      } else {
        matrix[j][i] = Math.min(
          matrix[j - 1][i - 1] + 1, // substitution
          matrix[j][i - 1] + 1,     // insertion
          matrix[j - 1][i] + 1      // deletion
        );
      }
    }
  }

  return matrix[bn][an];
}

/**
 * Calculates string similarity percentage (0-100)
 */
function wordSimilarity(a: string, b: string): number {
  const cleanA = cleanSpokenText(a);
  const cleanB = cleanSpokenText(b);

  if (cleanA === cleanB) return 100;
  if (!cleanA || !cleanB) return 0;

  // Handle common colloquial contractions
  const contractions: Record<string, string> = {
    "im": "i am",
    "dont": "do not",
    "didnt": "did not",
    "cant": "can not",
    "wont": "will not",
    "youre": "you are",
    "theyre": "they are",
    "were": "we are",
    "whats": "what is",
    "thats": "that is",
    "gonna": "going to",
    "wanna": "want to"
  };

  if (contractions[cleanA] === cleanB || contractions[cleanB] === cleanA) {
    return 95;
  }

  // Common phonetic approximations & homophones
  const phoneticMap: Record<string, string> = {
    "ph": "f",
    "gh": "f",
    "ck": "k",
    "wr": "r",
    "kn": "n",
    "c": "k"
  };

  const toPhonetic = (str: string) => {
    let p = str;
    for (const [k, v] of Object.entries(phoneticMap)) {
      p = p.replace(new RegExp(k, 'g'), v);
    }
    return p;
  };

  if (toPhonetic(cleanA) === toPhonetic(cleanB)) {
    return 95;
  }

  const maxLen = Math.max(cleanA.length, cleanB.length);
  const distance = levenshteinDistance(cleanA, cleanB);
  const sim = Math.round(((maxLen - distance) / maxLen) * 100);
  return Math.max(0, Math.min(100, sim));
}

/**
 * Compares recognized speech transcript against target sentence with deep alignment
 */
export function evaluatePronunciation(
  spokenText: string,
  targetText: string,
  durationSeconds: number = 2.0
): PronunciationAssessment {
  const targetWords = targetText.trim().split(/\s+/).filter(w => w.length > 0);
  const spokenWords = spokenText.trim().split(/\s+/).filter(w => w.length > 0);

  const wordResults: WordPronunciationResult[] = [];
  let totalWordScore = 0;
  let perfectWordsCount = 0;

  // Align spoken words with expected words using best-match lookahead
  let spokenIndex = 0;

  for (let i = 0; i < targetWords.length; i++) {
    const expected = targetWords[i];

    let bestMatchWord = '';
    let highestSim = 0;
    let matchedOffset = -1;

    // Search window in spoken words (current index + next 2 words)
    const windowEnd = Math.min(spokenWords.length, spokenIndex + 3);
    for (let s = spokenIndex; s < windowEnd; s++) {
      const sim = wordSimilarity(expected, spokenWords[s]);
      if (sim > highestSim) {
        highestSim = sim;
        bestMatchWord = spokenWords[s];
        matchedOffset = s;
      }
    }

    if (highestSim >= 65 && matchedOffset !== -1) {
      spokenIndex = matchedOffset + 1;
    } else {
      bestMatchWord = spokenWords[spokenIndex] || '';
      highestSim = bestMatchWord ? wordSimilarity(expected, bestMatchWord) : 0;
      if (bestMatchWord) spokenIndex++;
    }

    let status: WordPronunciationResult['status'] = 'missed';
    let tip: string | undefined = undefined;

    if (highestSim >= 90) {
      status = 'perfect';
      perfectWordsCount++;
    } else if (highestSim >= 75) {
      status = 'good';
    } else if (highestSim >= 45) {
      status = 'imperfect';
      tip = `"${expected}" so‘zini aniqroq talaffuz qiling`;
    } else {
      status = 'missed';
      tip = `"${expected}" so‘zi aytilmadi yoki eshitilmadi`;
    }

    totalWordScore += highestSim;
    wordResults.push({
      expectedWord: expected,
      spokenWord: bestMatchWord,
      isCorrect: highestSim >= 75,
      similarity: highestSim,
      status,
      tip
    });
  }

  const accuracyScore = targetWords.length > 0
    ? Math.round(totalWordScore / targetWords.length)
    : 0;

  // Fluency calculation: expected speech rate ~ 2 to 3.5 words per second
  const expectedSeconds = Math.max(1.0, targetWords.length * 0.45);
  const speedRatio = durationSeconds > 0 ? expectedSeconds / durationSeconds : 1.0;
  let fluencyScore = 100;
  if (speedRatio < 0.5) {
    fluencyScore = Math.max(40, Math.round(100 * speedRatio * 1.5));
  } else if (speedRatio > 2.0) {
    fluencyScore = Math.max(60, Math.round(100 / (speedRatio * 0.7)));
  }

  const overallScore = Math.round((accuracyScore * 0.75) + (fluencyScore * 0.25));

  let verdict: PronunciationAssessment['verdict'] = 'Qayta urinib ko‘ring 🔄';
  let feedbackUz = '';

  if (overallScore >= 88) {
    verdict = 'Mukammal! 🌟';
    feedbackUz = `Ajoyib talaffuz! Qahramon nutqiga deyarli 100% o‘xshash aytildi (${perfectWordsCount}/${targetWords.length} ta so‘z benuqson).`;
  } else if (overallScore >= 72) {
    verdict = 'Juda yaxshi! 👏';
    feedbackUz = `Talaffuzingiz yaxshi tushunarli. Ayrim so‘zlardagi urg‘u va intonatsiyani yanada sayqallang.`;
  } else if (overallScore >= 50) {
    verdict = 'Yaxshi, yana ozgina! 👍';
    feedbackUz = `Gap asosiy ma’noda aytildi, ammo ba’zi so‘zlar to‘liq talaffuz qilinmadi. Sekinroq qayta urinib ko‘ring.`;
  } else {
    verdict = 'Qayta urinib ko‘ring 🔄';
    feedbackUz = spokenText.trim()
      ? `Mikrofon: "${spokenText}". Asl jumla bilan taqqoslab, so‘zlarni birma-bir aniqroq ayting.`
      : `Ovoz eshitilmadi yoki juda past. Iltimos, mikrofonga yaqinroq kelib gapiring.`;
  }

  return {
    overallScore,
    accuracyScore,
    fluencyScore,
    verdict,
    feedbackUz,
    words: wordResults,
    transcript: spokenText,
    durationSeconds
  };
}
