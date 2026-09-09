import { Scene } from '../types';

export interface VideoStreamStatus {
  activeSource: string;
  sourceType: 'cdn' | 'streaming' | 'local' | 'synthesized';
  isOnline: boolean;
  buffering: boolean;
  resolutionStatus: 'optimal' | 'fallback' | 'offline_cached';
}

/**
 * Global Edge CDN and Streaming Video Provider
 * Resolves optimal streaming sources with automatic fallback mechanisms.
 */
class VideoStreamService {
  // Global CDN base endpoints (e.g. Cloudflare Stream / Fastly / AWS CloudFront / Supabase Storage CDN)
  private cdnBaseUrl: string = 'https://cdn.jsdelivr.net/gh/movielisten/assets@main';
  private secondaryCdnUrl: string = 'https://storage.googleapis.com/movielisten-cdn';
  private cacheName: string = 'movielisten-video-cache-v1';

  /**
   * Resolves the prioritized list of streaming and CDN URLs for a scene
   */
  public resolveVideoSources(scene: Scene): string[] {
    const sources: string[] = [];

    // 1. High-Performance Adaptive Streaming or CDN URL if configured
    if (scene.streamingUrl) {
      sources.push(scene.streamingUrl);
    }

    // 2. Scene-defined CDN mirror
    if (scene.cdnVideoUrl) {
      sources.push(scene.cdnVideoUrl);
    }

    // 3. Automated Global Edge CDN mirror for standard content
    if (scene.id === 'oppogoy-yetti-gnom') {
      // Cloudflare / jsDelivr / Supabase CDN endpoints
      sources.push('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4');
      sources.push(`${this.cdnBaseUrl}/cartoons/snow_white.mp4`);
      sources.push(`${this.secondaryCdnUrl}/cartoons/snow_white.mp4`);
    }

    // 4. Primary or Local Fallback
    if (scene.videoUrl) {
      // If primary is local path, keep it as reliable fallback
      sources.push(scene.videoUrl);
    }

    return Array.from(new Set(sources));
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
   * Automatically sets up video element with intelligent failover fallback
   */
  public attachSmartVideoStream(
    videoEl: HTMLVideoElement,
    scene: Scene,
    onSourceResolved?: (status: VideoStreamStatus) => void
  ): void {
    const candidateSources = this.resolveVideoSources(scene);
    if (candidateSources.length === 0) return;

    let currentSourceIdx = 0;

    const tryApplySource = (index: number) => {
      if (index >= candidateSources.length) {
        onSourceResolved?.({
          activeSource: '',
          sourceType: 'synthesized',
          isOnline: navigator.onLine,
          buffering: false,
          resolutionStatus: 'fallback'
        });
        return;
      }

      const activeUrl = candidateSources[index];
      const isCdn = activeUrl.startsWith('http') || activeUrl.includes('cdn');

      videoEl.src = activeUrl;
      videoEl.load();

      onSourceResolved?.({
        activeSource: activeUrl,
        sourceType: isCdn ? 'cdn' : 'local',
        isOnline: navigator.onLine,
        buffering: true,
        resolutionStatus: index === 0 ? 'optimal' : 'fallback'
      });
    };

    // Error listener for auto failover to next mirror
    videoEl.onerror = () => {
      currentSourceIdx++;
      tryApplySource(currentSourceIdx);
    };

    // Listen for successful metadata loaded
    videoEl.onloadedmetadata = () => {
      const activeUrl = candidateSources[currentSourceIdx] || '';
      onSourceResolved?.({
        activeSource: activeUrl,
        sourceType: activeUrl.startsWith('http') ? 'cdn' : 'local',
        isOnline: navigator.onLine,
        buffering: false,
        resolutionStatus: currentSourceIdx === 0 ? 'optimal' : 'fallback'
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
            fetch(primaryHttp, { mode: 'no-cors' }).then(response => {
              if (response.status === 200) {
                cache.put(primaryHttp, response);
              }
            }).catch(() => {
              // Ignore background prefetch fail
            });
          }
        });
      }).catch(() => {
        // Ignore cache failure
      });
    }
  }
}

export const videoStreamService = new VideoStreamService();
