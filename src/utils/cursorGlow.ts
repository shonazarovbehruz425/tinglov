/**
 * Interactive Cursor-Position Driven Glow Effect
 * Dynamically tracks cursor coordinates (--x, --y) across interactive CTA buttons
 * giving fluid radial spotlight and neon aura effects as the cursor moves over them.
 */
export function initCursorGlow(): void {
  let rafId: number | null = null;
  let lastEvent: MouseEvent | null = null;

  // Throttle with rAF — a raw mousemove handler calls getBoundingClientRect()
  // (a layout read) on every single mouse event, causing layout thrashing.
  const apply = () => {
    rafId = null;
    const e = lastEvent;
    lastEvent = null;
    if (!e) return;
    const btn = (e.target as HTMLElement).closest(
      '.glow-cta-btn, .hero-primary-btn, .stepper-next-btn, .stepper-mock-cta-btn, .cinema-card-btn, .card-continue-btn'
    ) as HTMLElement | null;

    if (btn) {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      btn.style.setProperty('--x', `${x}px`);
      btn.style.setProperty('--y', `${y}px`);
    }
  };

  document.addEventListener('mousemove', (e: MouseEvent) => {
    lastEvent = e;
    if (rafId === null) {
      rafId = requestAnimationFrame(apply);
    }
  }, { passive: true });
}
