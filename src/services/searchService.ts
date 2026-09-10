import { DialogueSentence, Scene } from '../types';
import { storageService } from './storageService';
import { escapeHtml } from '../utils/sanitize';

export interface DialogueMatch {
  scene: Scene;
  dialogueIndex: number;
  dialogue: DialogueSentence;
  highlightedText: string;
  highlightedTranslation: string;
  matchScore: number;
}

export interface SearchResults {
  query: string;
  totalMatches: number;
  dialogueMatches: DialogueMatch[];
  sceneMatches: Scene[];
}

export function highlightMatch(text: string, query: string): string {
  if (!text) return '';
  const safeText = escapeHtml(text);
  if (!query) return safeText;
  const safeQuery = escapeHtml(query.trim());
  if (!safeQuery) return safeText;
  const escaped = safeQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return safeText.replace(regex, '<mark class="search-highlight">$1</mark>');
}

export function searchByWord(rawQuery: string): SearchResults {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return { query: '', totalMatches: 0, dialogueMatches: [], sceneMatches: [] };
  }

  const allScenes = storageService.getAllScenes();
  const dialogueMatches: DialogueMatch[] = [];
  const sceneMatches: Scene[] = [];

  for (const scene of allScenes) {
    let sceneHasMatch = false;

    // Search through all dialogues
    scene.dialogues.forEach((dialogue, index) => {
      const textLower = dialogue.text.toLowerCase();
      const uzbekLower = (dialogue.uzbekTranslation || '').toLowerCase();
      const russianLower = (dialogue.russianTranslation || '').toLowerCase();
      const charLower = dialogue.character.toLowerCase();
      const dictWords = Object.keys(dialogue.wordDictionary || {}).map(w => w.toLowerCase());

      const textMatch = textLower.includes(query);
      const uzbekMatch = uzbekLower.includes(query);
      const russianMatch = russianLower.includes(query);
      const dictMatch = dictWords.some(w => w.includes(query));
      const charMatch = charLower.includes(query);

      if (textMatch || uzbekMatch || russianMatch || dictMatch || charMatch) {
        sceneHasMatch = true;

        // Scoring: exact word match gets priority
        let score = 10;
        const words = textLower.split(/\s+/).map(w => w.replace(/[.,/#!$%^&*;:{}=\-_`~()?"'’]/g, ''));
        if (words.includes(query)) {
          score += 60; // Exact word match in dialogue
        } else if (textLower.startsWith(query)) {
          score += 30;
        } else if (textMatch) {
          score += 20;
        } else if (uzbekMatch) {
          score += 15;
        }

        dialogueMatches.push({
          scene,
          dialogueIndex: index,
          dialogue,
          highlightedText: highlightMatch(dialogue.text, rawQuery.trim()),
          highlightedTranslation: highlightMatch(dialogue.uzbekTranslation || '', rawQuery.trim()),
          matchScore: score
        });
      }
    });

    // Check scene title or movie name
    if (
      scene.title.toLowerCase().includes(query) ||
      scene.movieName.toLowerCase().includes(query) ||
      sceneHasMatch
    ) {
      sceneMatches.push(scene);
    }
  }

  // Sort dialogue matches by score descending
  dialogueMatches.sort((a, b) => b.matchScore - a.matchScore);

  return {
    query,
    totalMatches: dialogueMatches.length,
    dialogueMatches,
    sceneMatches
  };
}
