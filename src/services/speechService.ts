import { DialogueSentence } from '../types';

export type SpeechCallback = (event: 'start' | 'end' | 'boundary' | 'error', wordIndex?: number) => void;

class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private isPlaying: boolean = false;
  private speedRate: number = 1.0;
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices(): void {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
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

  private selectVoiceForCharacter(character: string, accent: string = 'American'): SpeechSynthesisVoice | null {
    if (!this.voices || this.voices.length === 0) {
      this.loadVoices();
    }

    const englishVoices = this.voices.filter(v => v.lang.startsWith('en'));
    if (englishVoices.length === 0) return null;

    if (accent === 'British') {
      const gbVoices = englishVoices.filter(v => v.lang.includes('GB') || v.lang.includes('UK'));
      if (gbVoices.length > 0) return gbVoices[0];
    }

    // Attempt matching gender or unique voice
    const charLower = character.toLowerCase();
    if (charLower.includes('elsa') || charLower.includes('judy') || charLower.includes('female')) {
      const femaleVoice = englishVoices.find(v => v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('samantha') || v.name.toLowerCase().includes('google us english'));
      if (femaleVoice) return femaleVoice;
    }

    return englishVoices[0] || null;
  }

  public speakDialogue(sentence: DialogueSentence, accent: string = 'American', callback?: SpeechCallback): void {
    if (!this.synth) {
      if (callback) callback('error');
      return;
    }

    this.stop();

    const utterance = new SpeechSynthesisUtterance(sentence.text);
    utterance.rate = this.speedRate;
    utterance.lang = accent === 'British' ? 'en-GB' : 'en-US';

    // Character voice personality pitch adjustment
    const charName = sentence.character.toLowerCase();
    if (charName.includes('shrek') || charName.includes('mufasa') || charName.includes('batman')) {
      utterance.pitch = 0.75; // Deep & powerful
    } else if (charName.includes('donkey') || charName.includes('olaf')) {
      utterance.pitch = 1.35; // Energetic & high pitched
    } else if (charName.includes('oogway')) {
      utterance.pitch = 0.85; // Wise and calm
      utterance.rate = Math.max(0.6, this.speedRate * 0.85);
    } else {
      utterance.pitch = 1.0;
    }

    const voice = this.selectVoiceForCharacter(sentence.character, accent);
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => {
      this.isPlaying = true;
      if (callback) callback('start');
    };

    utterance.onboundary = (event) => {
      if (event.name === 'word' && callback) {
        callback('boundary', event.charIndex);
      }
    };

    utterance.onend = () => {
      this.isPlaying = false;
      if (callback) callback('end');
    };

    utterance.onerror = () => {
      this.isPlaying = false;
      if (callback) callback('error');
    };

    this.synth.speak(utterance);
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
