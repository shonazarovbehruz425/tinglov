import { Scene } from '../types';
import { logger } from '../utils/logger';

export interface VideoStreamStatus {
  activeSource: string;
  sourceType: 'cdn' | 'streaming' | 'local' | 'synthesized';
  isOnline: boolean;
  buffering: boolean;
  resolutionStatus: 'optimal' | 'fallback' | 'offline_cached';
  isR2?: boolean;
}

/**
 * Global Edge CDN and Streaming Video Provider
 * Resolves optimal streaming sources with Cloudflare R2 support and automatic fallback mechanisms.
 */
class VideoStreamService {
  private cacheName: string = 'movielisten-video-cache-v1';
  private cloudflareR2Url: string = '';

  constructor() {
    // Detect Cloudflare R2 URL from window injection or Vite env
    const injectedR2 = typeof window !== 'undefined' ? (window as any).__CLOUDFLARE_R2_URL__ : '';
    const envR2 = (import.meta as any).env?.VITE_CLOUDFLARE_R2_URL || '';
    const initialUrl = (injectedR2 || envR2 || '').trim().replace(/\/+$/, '');
    if (initialUrl) {
      this.cloudflareR2Url = initialUrl;
    }
  }

  /**
   * Get active Cloudflare R2 base URL
   */
  public getCloudflareR2BaseUrl(): string {
    return this.cloudflareR2Url;
  }

  /**
   * Set or update Cloudflare R2 base URL dynamically
   */
  public setCloudflareR2BaseUrl(url: string): void {
    this.cloudflareR2Url = (url || '').trim().replace(/\/+$/, '');
  }

  /**
   * Checks whether a given URL is served from Cloudflare R2
   */
  public isCloudflareR2Url(url: string): boolean {
    if (!url) return false;
    if (url.includes('.r2.dev') || url.includes('.r2.cloudflarestorage.com')) {
      return true;
    }
    if (this.cloudflareR2Url && url.startsWith(this.cloudflareR2Url)) {
      return true;
    }
    return false;
  }

  /**
   * Formats a video URL or Cloudflare R2 object key into a full streaming URL
   * Supports `r2:filename.mp4`, `r2:/path/video.mp4`, or direct filenames when R2 base URL is configured.
   */
  public formatR2UrlIfNeeded(urlOrKey: string): string {
    if (!urlOrKey) return '';
    const trimmed = urlOrKey.trim();

    // 1. Explicit r2: prefix (e.g. "r2:interstellar.mp4" or "r2:/movies/scene1.mp4")
    if (trimmed.startsWith('r2:')) {
      const cleanKey = trimmed.replace(/^r2:[\/\\]*/, '');
      if (this.cloudflareR2Url) {
        return `${this.cloudflareR2Url}/${cleanKey}`;
      }
      return `https://${cleanKey}`;
    }

    // 2. Direct full URL (HTTP or HTTPS)
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }

    // 3. Relative root path (e.g. "/videos/sample.mp4")
    if (trimmed.startsWith('/')) {
      return trimmed;
    }

    // 4. Standalone video filename (e.g. "for_bigger_blazes.mp4") when Cloudflare R2 URL is configured
    if (this.cloudflareR2Url && /\.(mp4|webm|m4v|mkv|mov|ts)$/i.test(trimmed)) {
      return `${this.cloudflareR2Url}/${trimmed}`;
    }

    return trimmed;
  }

  /**
   * Resolves the prioritized list of streaming and CDN URLs for a scene
   */
  public resolveVideoSources(scene: Scene): string[] {
    const rawSources: string[] = [];

    // 1. High-Performance Cloudflare R2 or Adaptive Streaming URL if configured
    if (scene.streamingUrl) {
      rawSources.push(this.formatR2UrlIfNeeded(scene.streamingUrl));
    }

    // 2. Scene-defined CDN mirror
    if (scene.cdnVideoUrl) {
      rawSources.push(this.formatR2UrlIfNeeded(scene.cdnVideoUrl));
    }

    // 3. Primary scene video URL (can be R2 key, full URL, or local path)
    if (scene.videoUrl) {
      rawSources.push(this.formatR2UrlIfNeeded(scene.videoUrl));
    }


    const uniqueSources = Array.from(new Set(rawSources.filter(Boolean)));

    // Sort: Cloudflare R2 and high-speed CDN URLs first, local fallbacks last
    return uniqueSources.sort((a, b) => {
      const aIsR2 = this.isCloudflareR2Url(a);
      const bIsR2 = this.isCloudflareR2Url(b);
      if (aIsR2 && !bIsR2) return -1;
      if (!aIsR2 && bIsR2) return 1;
      return 0;
    });
  }

  /**
   * Checks if an online CDN URL is reachable with HEAD request
   */
  public async verifySourceReachable(url: string, timeoutMs: number = 2500): Promise<boolean> {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // Local relative assets are considered available
      return true;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'no-cors' // Safe for CDN cross-origin availability check
      });
      clearTimeout(timeoutId);
      return res.type === 'opaque' || res.ok;
    } catch {
      clearTimeout(timeoutId);
      return false;
    }
  }

  /**
   * Automatically sets up video element with intelligent failover fallback and Cloudflare R2 streaming
   */
  public attachSmartVideoStream(
    videoEl: HTMLVideoElement,
    scene: Scene,
    onSourceResolved?: (status: VideoStreamStatus) => void
  ): void {
    const candidateSources = this.resolveVideoSources(scene);
    if (candidateSources.length === 0) return;

    // Configure video element. NOTE: do NOT set crossOrigin='anonymous' —
    // plain playback does not need it, and on CDNs that don't send CORS
    // headers it makes the whole video fail to load.
    videoEl.preload = 'auto';

    let currentSourceIdx = 0;

    const tryApplySource = (index: number) => {
      if (index >= candidateSources.length) {
        onSourceResolved?.({
          activeSource: '',
          sourceType: 'synthesized',
          isOnline: navigator.onLine,
          buffering: false,
          resolutionStatus: 'fallback',
          isR2: false
        });
        return;
      }

      const activeUrl = candidateSources[index];
      const isR2 = this.isCloudflareR2Url(activeUrl);
      const isCdn = activeUrl.startsWith('http') || activeUrl.includes('cdn') || isR2;

      videoEl.src = activeUrl;
      videoEl.load();

      onSourceResolved?.({
        activeSource: activeUrl,
        sourceType: isR2 ? 'streaming' : (isCdn ? 'cdn' : 'local'),
        isOnline: navigator.onLine,
        buffering: true,
        resolutionStatus: index === 0 ? 'optimal' : 'fallback',
        isR2
      });
    };

    // Error listener for auto failover to next mirror
    videoEl.onerror = () => {
      logger.warn(`[VideoStreamService] Source failed: ${candidateSources[currentSourceIdx] || 'unknown'}`);
      currentSourceIdx++;
      tryApplySource(currentSourceIdx);
    };

    // Listen for successful metadata loaded
    videoEl.onloadedmetadata = () => {
      const activeUrl = candidateSources[currentSourceIdx] || '';
      const isR2 = this.isCloudflareR2Url(activeUrl);
      onSourceResolved?.({
        activeSource: activeUrl,
        sourceType: isR2 ? 'streaming' : (activeUrl.startsWith('http') ? 'cdn' : 'local'),
        isOnline: navigator.onLine,
        buffering: false,
        resolutionStatus: currentSourceIdx === 0 ? 'optimal' : 'fallback',
        isR2
      });
    };

    tryApplySource(0);
  }

  /**
   * Pre-fetches subsequent dialogue chunks into browser cache
   */
  public prefetchSceneVideo(scene: Scene): void {
    if (!('caches' in window)) return;

    const sources = this.resolveVideoSources(scene);
    const primaryHttp = sources.find(s => s.startsWith('https://'));

    if (primaryHttp) {
      window.caches.open(this.cacheName).then(cache => {
        cache.match(primaryHttp).then(cached => {
          if (!cached) {
            // CORS mode is required: opaque ('no-cors') responses always report
            // status 0, so cache.put() previously never ran and prefetch was dead.
            fetch(primaryHttp, { mode: 'cors' }).then(response => {
              if (response.ok) {
                cache.put(primaryHttp, response).catch(() => {});
              }
            }).catch(() => {
              // Cross-origin source without CORS headers — warming not possible
            });
          }
        }).catch(() => {});
      }).catch(() => {
        // Ignore cache failure
      });
    }
  }
}

export const videoStreamService = new VideoStreamService();
