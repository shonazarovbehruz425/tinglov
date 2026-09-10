import { DialogueSentence } from '../types';

export type SpeechCallback = (event: 'start' | 'end' | 'boundary' | 'error', wordIndex?: number) => void;

class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private isPlaying: boolean = false;
  private speedRate: number = 1.0;
  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  public setSpeed(rate: number): void {
    this.speedRate = rate;
  }

  public getSpeed(): number {
    return this.speedRate;
  }

  public stop(): void {
    if (this.synth) {
      this.synth.cancel();
      this.isPlaying = false;
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public speakDialogue(_sentence?: DialogueSentence, _accent: string = 'American', callback?: SpeechCallback): void {
    // Disabled: Video audio is used directly. No synthetic TTS voice speaks over dialogues.
    this.stop();
    if (callback) {
      callback('end');
    }
  }

  public speakWord(word: string, rate: number = 0.9): void {
    if (!this.synth) return;
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(word);
    utterance.rate = rate;
    utterance.lang = 'en-US';
    this.synth.speak(utterance);
  }
}

export const speechService = new SpeechService();
