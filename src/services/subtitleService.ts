/**
 * Subtitle Parsing and Dialogue Synchronization Service
 * Supports SubRip (.srt) and WebVTT (.vtt) format parsing with millisecond accuracy.
 * Automatically filters non-speech noise cues ([Music], [Applause], ♪, etc.)
 */

export interface ParsedSubtitleEntry {
  index: number;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  duration: number;  // in seconds
  character?: string;
  text: string;
  uzbekTranslation?: string;
}

export class SubtitleService {
  /**
   * Converts a timestamp string (e.g. "00:01:23,456", "00:01:23.456", "01:23.456", "23.456")
   * into total decimal seconds.
   */
  public parseTimestampToSeconds(timestampStr: string): number {
    if (!timestampStr) return 0;
    const cleanStr = timestampStr.trim().replace(',', '.');
    const parts = cleanStr.split(':');

    if (parts.length === 3) {
      // HH:MM:SS.mmm
      const hours = parseFloat(parts[0]) || 0;
      const minutes = parseFloat(parts[1]) || 0;
      const seconds = parseFloat(parts[2]) || 0;
      return hours * 3600 + minutes * 60 + seconds;
    } else if (parts.length === 2) {
      // MM:SS.mmm
      const minutes = parseFloat(parts[0]) || 0;
      const seconds = parseFloat(parts[1]) || 0;
      return minutes * 60 + seconds;
    } else if (parts.length === 1) {
      // SS.mmm
      return parseFloat(parts[0]) || 0;
    }

    return 0;
  }

  /**
   * Formats decimal seconds to a clean display string (e.g. "01:23.4").
   */
  public formatSecondsToDisplay(seconds: number): string {
    let mins = Math.floor(seconds / 60);
    let secs = Math.round((seconds % 60) * 10) / 10;
    if (secs >= 60) {
      mins += 1;
      secs = 0;
    }
    const secsStr = secs.toFixed(1);
    const paddedSecs = parseFloat(secsStr) < 10 ? `0${secsStr}` : secsStr;
    return `${mins < 10 ? '0' : ''}${mins}:${paddedSecs}`;
  }

  /**
   * Cleans HTML markup, WebVTT tags, and non-speech sound effects.
   */
  public cleanSubtitleText(rawText: string): { text: string; character?: string } {
    if (!rawText) return { text: '' };

    // 1. Remove WebVTT formatting tags (e.g., <c.yellow>, <i>, </i>, <b>, </b>, <v Character>)
    let cleaned = rawText
      .replace(/<v\s+([^>]+)>/gi, '$1: ') // Extract voice name if present
      .replace(/<\/?[^>]+(>|$)/g, '')
      .trim();

    // 2. Extract character name if present in "CHARACTER: text" format
    let character: string | undefined;
    const speakerMatch = cleaned.match(/^([A-Z0-9\s._'-]{2,25}):\s*(.+)$/i);
    if (speakerMatch && speakerMatch[1] && speakerMatch[2]) {
      const candidateName = speakerMatch[1].trim();
      // Ensure it's not a timestamp or cue word
      if (!candidateName.toLowerCase().startsWith('http') && !candidateName.includes('-->')) {
        character = candidateName;
        cleaned = speakerMatch[2].trim();
      }
    }

    // 3. Remove sound effect / music tags like [Music], (Laughter), ♪, [Sound FX], etc.
    cleaned = cleaned
      .replace(/\[[^\]]*\]/g, '') // remove [Music], [Applause], [Engine roaring]
      .replace(/\([^\)]*\)/g, '') // remove (Laughter), (Whispering)
      .replace(/[♪♫#*]/g, '')     // remove musical symbols
      .replace(/\s+/g, ' ')       // normalize spaces
      .trim();

    return { text: cleaned, character };
  }

  /**
   * Parses raw SRT or WebVTT content into structured dialogue entries.
   */
  public parseSubtitles(content: string): ParsedSubtitleEntry[] {
    if (!content || typeof content !== 'string') return [];

    // Normalize newlines
    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Split into blocks separated by blank lines
    const rawBlocks = normalized.split(/\n\s*\n/);
    const results: ParsedSubtitleEntry[] = [];
    let entryIndex = 1;

    for (const block of rawBlocks) {
      const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) continue;

      // Skip WebVTT header blocks (WEBVTT, NOTE, STYLE, REGION)
      if (lines[0].toUpperCase().startsWith('WEBVTT') || lines[0].toUpperCase().startsWith('NOTE')) {
        continue;
      }

      let timeLineIndex = -1;

      // Find the timestamp line containing "-->"
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('-->')) {
          timeLineIndex = i;
          break;
        }
      }

      if (timeLineIndex === -1) continue;

      const timeLine = lines[timeLineIndex];
      const timeParts = timeLine.split('-->');
      if (timeParts.length < 2) continue;

      // Extract raw start and end timestamps (ignoring WebVTT cue settings like line:50% align:start)
      const rawStart = timeParts[0].trim().split(/\s+/)[0];
      const rawEnd = timeParts[1].trim().split(/\s+/)[0];

      const startTime = this.parseTimestampToSeconds(rawStart);
      const endTime = this.parseTimestampToSeconds(rawEnd);

      if (endTime <= startTime) continue;

      // Text lines after timestamp line
      const textLines = lines.slice(timeLineIndex + 1);
      const rawCombinedText = textLines.join(' ');

      const { text, character } = this.cleanSubtitleText(rawCombinedText);

      // Skip entries that became empty after stripping sound effects (e.g. pure "[Music]")
      if (!text || text.length === 0) continue;

      const duration = Math.round((endTime - startTime) * 100) / 100;

      results.push({
        index: entryIndex++,
        startTime: Math.round(startTime * 100) / 100,
        endTime: Math.round(endTime * 100) / 100,
        duration,
        character: character || `Speaker`,
        text
      });
    }

    return results;
  }

  /**
   * Merges very short rapid fragments (< 1.2 seconds or 2-3 words) with adjacent entries
   * to create comfortable natural sentences for listening practice.
   */
  public optimizeForLearning(entries: ParsedSubtitleEntry[], maxDuration: number = 8.0): ParsedSubtitleEntry[] {
    if (entries.length <= 1) return entries;

    const optimized: ParsedSubtitleEntry[] = [];
    let current: ParsedSubtitleEntry | null = null;

    for (const entry of entries) {
      if (!current) {
        current = { ...entry };
        continue;
      }

      const timeGap = entry.startTime - current.endTime;
      const combinedDuration = entry.endTime - current.startTime;
      const currentWordCount = current.text.split(/\s+/).length;

      // Merge if time gap is tiny (< 0.6s), same character, and combined duration <= maxDuration
      const isSameSpeaker = current.character === entry.character;
      const isCurrentTooShort = currentWordCount <= 3 || current.duration < 1.4;

      if (timeGap <= 0.6 && combinedDuration <= maxDuration && (isSameSpeaker || isCurrentTooShort)) {
        current.endTime = entry.endTime;
        current.duration = Math.round((current.endTime - current.startTime) * 100) / 100;
        current.text = `${current.text} ${entry.text}`.trim();
      } else {
        optimized.push(current);
        current = { ...entry };
      }
    }

    if (current) {
      optimized.push(current);
    }

    // Re-index
    return optimized.map((e, idx) => ({ ...e, index: idx + 1 }));
  }
}

export const subtitleService = new SubtitleService();
