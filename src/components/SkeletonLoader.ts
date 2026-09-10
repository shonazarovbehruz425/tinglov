export class SkeletonLoader {
  /**
   * Generates a modern shimmer skeleton layout for the Dashboard / Library catalog.
   */
  public static getDashboardSkeletonHtml(): string {
    return `
      <div class="skeleton-dashboard-wrapper">
        <!-- Hero Banner Skeleton -->
        <div class="skeleton-hero-card skeleton-pulse">
          <div class="skeleton-hero-content">
            <div class="skeleton-line skeleton-badge skeleton-shimmer"></div>
            <div class="skeleton-line skeleton-title skeleton-shimmer"></div>
            <div class="skeleton-line skeleton-subtitle skeleton-shimmer"></div>
            <div class="skeleton-line skeleton-desc skeleton-shimmer"></div>
            <div class="skeleton-meta-row">
              <div class="skeleton-line skeleton-pill skeleton-shimmer"></div>
              <div class="skeleton-line skeleton-pill skeleton-shimmer"></div>
              <div class="skeleton-line skeleton-pill skeleton-shimmer"></div>
            </div>
          </div>
        </div>

        <!-- Filter Categories Skeleton -->
        <div class="skeleton-filters-row">
          <div class="skeleton-line skeleton-category-pill skeleton-shimmer"></div>
          <div class="skeleton-line skeleton-category-pill skeleton-shimmer"></div>
          <div class="skeleton-line skeleton-category-pill skeleton-shimmer"></div>
          <div class="skeleton-line skeleton-category-pill skeleton-shimmer"></div>
        </div>

        <!-- Movie Cards Grid Skeleton -->
        <div class="skeleton-movie-grid">
          ${Array.from({ length: 6 }).map(() => `
            <div class="skeleton-card skeleton-pulse">
              <div class="skeleton-card-thumb skeleton-shimmer"></div>
              <div class="skeleton-card-body">
                <div class="skeleton-line skeleton-card-badge skeleton-shimmer"></div>
                <div class="skeleton-line skeleton-card-title skeleton-shimmer"></div>
                <div class="skeleton-line skeleton-card-sub skeleton-shimmer"></div>
                <div class="skeleton-card-footer">
                  <div class="skeleton-line skeleton-card-meta skeleton-shimmer"></div>
                  <div class="skeleton-line skeleton-card-btn skeleton-shimmer"></div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Generates shimmer skeleton for the Practice/Cinema View.
   */
  public static getPracticeSkeletonHtml(): string {
    return `
      <div class="skeleton-practice-wrapper">
        <div class="practice-main-grid">
          <!-- Left: Video Player Skeleton -->
          <div class="skeleton-video-stage skeleton-pulse">
            <div class="skeleton-video-viewport skeleton-shimmer"></div>
            <div class="skeleton-stage-controls">
              <div class="skeleton-line skeleton-control-pill skeleton-shimmer"></div>
              <div class="skeleton-line skeleton-control-pill skeleton-shimmer"></div>
              <div class="skeleton-line skeleton-control-pill skeleton-shimmer"></div>
            </div>
          </div>

          <!-- Right: Dictation Box Skeleton -->
          <div class="skeleton-dictation-card skeleton-pulse">
            <div class="skeleton-line skeleton-dictation-title skeleton-shimmer"></div>
            <div class="skeleton-dictation-chips">
              <div class="skeleton-line skeleton-chip skeleton-shimmer"></div>
              <div class="skeleton-line skeleton-chip skeleton-shimmer"></div>
              <div class="skeleton-line skeleton-chip skeleton-shimmer"></div>
              <div class="skeleton-line skeleton-chip skeleton-shimmer"></div>
            </div>
            <div class="skeleton-dictation-input-box skeleton-shimmer"></div>
            <div class="skeleton-dictation-actions">
              <div class="skeleton-line skeleton-action-btn skeleton-shimmer"></div>
              <div class="skeleton-line skeleton-action-btn skeleton-shimmer"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
