import { apiService } from '../services/apiService';
import { escapeHtml } from '../utils/sanitize';

type AdminTab = 'overview' | 'users' | 'scenes' | 'security';

export class AdminView {
  private container: HTMLElement;
  private isAuthenticated: boolean = false;
  private activeTab: AdminTab = 'overview';
  private adminUsername: string = 'Admin';
  private adminPath: string = '/admin';
  private stats: any = null;
  private users: any[] = [];
  private scenes: any[] = [];
  private searchQuery: string = '';
  private errorMsg: string | null = null;
  private successMsg: string | null = null;
  private onNavigateHomeCallback?: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.adminPath = apiService.getAdminRoutePath();
  }

  public setCallbacks(callbacks: { onNavigateHome: () => void }): void {
    this.onNavigateHomeCallback = callbacks.onNavigateHome;
  }

  public async render(): Promise<void> {
    this.adminPath = apiService.getAdminRoutePath();
    this.renderLoading();

    try {
      this.isAuthenticated = await apiService.adminCheckAuth();
      if (this.isAuthenticated) {
        await this.loadAllData();
      }
    } catch {
      this.isAuthenticated = false;
    }

    if (!this.isAuthenticated) {
      this.renderLoginScreen();
    } else {
      this.renderDashboard();
    }
  }

  private renderLoading(): void {
    this.container.innerHTML = `
      <div class="admin-loading-wrapper">
        <div class="admin-spinner"></div>
        <p>Boshqaruv tizimi yuklanmoqda...</p>
      </div>
    `;
  }

  private renderLoginScreen(): void {
    this.container.innerHTML = `
      <div class="admin-login-layout">
        <div class="admin-login-card">
          <div class="admin-login-badge">
            <i class="ph-bold ph-shield-check"></i> XAVFSIZ TIZIM
          </div>

          <h1 class="admin-login-title">
            <span class="text-gradient">Tinglov</span> Boshqaruv Markazi
          </h1>
          <p class="admin-login-desc">
            Ushbu panelga faqat tizim ma'muri kirishi mumkin. Faol marshrut: <code>${escapeHtml(this.adminPath)}</code>
          </p>

          ${this.errorMsg ? `<div class="admin-alert admin-alert-error"><i class="ph-bold ph-warning-circle"></i> ${escapeHtml(this.errorMsg)}</div>` : ''}

          <form id="adminLoginForm" class="admin-login-form">
            <div class="admin-form-group">
              <label for="adminUsernameInput">Ma'mur Logini</label>
              <div class="admin-input-icon-wrap">
                <i class="ph-bold ph-user"></i>
                <input
                  type="text"
                  id="adminUsernameInput"
                  class="admin-input"
                  placeholder="admin"
                  required
                  autocomplete="username"
                />
              </div>
            </div>

            <div class="admin-form-group">
              <label for="adminPasswordInput">Ma'mur Maxfiy Paroli</label>
              <div class="admin-input-icon-wrap">
                <i class="ph-bold ph-lock-key"></i>
                <input
                  type="password"
                  id="adminPasswordInput"
                  class="admin-input"
                  placeholder="••••••••••••"
                  required
                  autocomplete="current-password"
                />
              </div>
            </div>

            <button type="submit" id="adminLoginBtn" class="admin-btn admin-btn-primary">
              <i class="ph-bold ph-sign-in"></i> Boshqaruv Paneliga Kirish
            </button>
          </form>

          <div class="admin-login-footer">
            <p>
              <i class="ph-bold ph-info"></i>
              Ushbu sahifa URL manzilini Render.com <code>ADMIN_PATH</code> orqali istalgan manzilga o'zgartirishingiz mumkin.
            </p>
            <button id="adminBackHomeBtn" class="admin-link-btn">
              <i class="ph-bold ph-arrow-left"></i> Tinglov Bosh Sahifasiga Qaytish
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindLoginEvents();
  }

  private bindLoginEvents(): void {
    const form = this.container.querySelector('#adminLoginForm') as HTMLFormElement;
    const loginBtn = this.container.querySelector('#adminLoginBtn') as HTMLButtonElement;
    const backBtn = this.container.querySelector('#adminBackHomeBtn') as HTMLButtonElement;

    if (backBtn && this.onNavigateHomeCallback) {
      backBtn.addEventListener('click', () => this.onNavigateHomeCallback!());
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const usernameInput = this.container.querySelector('#adminUsernameInput') as HTMLInputElement;
        const passwordInput = this.container.querySelector('#adminPasswordInput') as HTMLInputElement;

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) return;

        loginBtn.disabled = true;
        loginBtn.innerHTML = `<div class="admin-spinner-sm"></div> Tekshirilmoqda...`;
        this.errorMsg = null;

        const result = await apiService.adminLogin(username, password);
        if (result.success) {
          this.isAuthenticated = true;
          this.adminUsername = result.admin?.username || username;
          await this.loadAllData();
          this.renderDashboard();
        } else {
          this.errorMsg = result.error || 'Login yoki parol noto‘g‘ri';
          this.renderLoginScreen();
        }
      });
    }
  }

  private async loadAllData(): Promise<void> {
    try {
      const [statsRes, usersRes, scenesRes] = await Promise.all([
        apiService.adminGetStats().catch(() => null),
        apiService.adminGetUsers(this.searchQuery).catch(() => []),
        apiService.adminGetScenes().catch(() => [])
      ]);
      this.stats = statsRes;
      this.users = usersRes;
      this.scenes = scenesRes;
    } catch {
      // Ignored
    }
  }

  private renderDashboard(): void {
    this.container.innerHTML = `
      <div class="admin-dashboard-layout">
        <!-- Top Navigation Bar -->
        <header class="admin-top-nav">
          <div class="admin-brand-section">
            <div class="admin-logo">
              <span class="admin-logo-icon">🎬</span>
              <span class="admin-logo-text">Tinglov</span>
            </div>
            <span class="admin-badge admin-badge-neon">ADMIN CONSOLE</span>
            <div class="admin-route-indicator" title="Ushbu marshrut Render.com env orqali o'zgartirilishi mumkin">
              <i class="ph-bold ph-link"></i>
              <span>Marshrut: <strong>${escapeHtml(this.adminPath)}</strong></span>
            </div>
          </div>

          <div class="admin-user-nav">
            <button id="adminTopHomeBtn" class="admin-nav-action-btn" title="Saytga o'tish">
              <i class="ph-bold ph-globe"></i> Saytga Qaytish
            </button>
            <div class="admin-user-pill">
              <div class="admin-avatar">${this.adminUsername.slice(0, 1).toUpperCase()}</div>
              <span>${escapeHtml(this.adminUsername)}</span>
            </div>
            <button id="adminLogoutBtn" class="admin-nav-action-btn admin-btn-danger" title="Tizimdan chiqish">
              <i class="ph-bold ph-sign-out"></i> Chiqish
            </button>
          </div>
        </header>

        <!-- Main Workspace -->
        <div class="admin-workspace">
          <!-- Sidebar Tabs -->
          <aside class="admin-sidebar">
            <nav class="admin-nav-tabs">
              <button class="admin-tab-btn ${this.activeTab === 'overview' ? 'active' : ''}" data-tab="overview">
                <i class="ph-bold ph-chart-polar"></i> Umumiy Statistika
              </button>
              <button class="admin-tab-btn ${this.activeTab === 'users' ? 'active' : ''}" data-tab="users">
                <i class="ph-bold ph-users"></i> Foydalanuvchilar (${this.users.length})
              </button>
              <button class="admin-tab-btn ${this.activeTab === 'scenes' ? 'active' : ''}" data-tab="scenes">
                <i class="ph-bold ph-film-strip"></i> Darslar & Filmlar (${this.scenes.length})
              </button>
              <button class="admin-tab-btn ${this.activeTab === 'security' ? 'active' : ''}" data-tab="security">
                <i class="ph-bold ph-shield-check"></i> Xavfsizlik & Render.com
              </button>
            </nav>
          </aside>

          <!-- Content Panel -->
          <main class="admin-main-panel">
            ${this.successMsg ? `<div class="admin-alert admin-alert-success"><i class="ph-bold ph-check-circle"></i> ${escapeHtml(this.successMsg)}</div>` : ''}
            ${this.errorMsg ? `<div class="admin-alert admin-alert-error"><i class="ph-bold ph-warning-circle"></i> ${escapeHtml(this.errorMsg)}</div>` : ''}

            ${this.renderActiveTabContent()}
          </main>
        </div>
      </div>
    `;

    this.bindDashboardEvents();
  }

  private renderActiveTabContent(): string {
    switch (this.activeTab) {
      case 'overview':
        return this.renderOverviewTab();
      case 'users':
        return this.renderUsersTab();
      case 'scenes':
        return this.renderScenesTab();
      case 'security':
        return this.renderSecurityTab();
      default:
        return this.renderOverviewTab();
    }
  }

  private renderOverviewTab(): string {
    const s = this.stats?.stats || {
      totalUsers: 0,
      usersToday: 0,
      totalSavedWords: 0,
      totalCompletedScenes: 0,
      totalCustomScenes: 0
    };
    const sys = this.stats?.system || {};

    const uptimeHrs = sys.uptimeSeconds ? Math.floor(sys.uptimeSeconds / 3600) : 0;
    const uptimeMins = sys.uptimeSeconds ? Math.floor((sys.uptimeSeconds % 3600) / 60) : 0;

    return `
      <div class="admin-tab-pane">
        <div class="admin-pane-header">
          <div>
            <h2 class="admin-pane-title">Tizim Ko‘rsatkichlari</h2>
            <p class="admin-pane-desc">Tinglov platformasining real vaqt rejimidagi faollik statistikasi</p>
          </div>
          <button id="adminRefreshStatsBtn" class="admin-btn admin-btn-secondary">
            <i class="ph-bold ph-arrows-clockwise"></i> Yangilash
          </button>
        </div>

        <!-- 4 Stat Cards -->
        <div class="admin-stats-grid">
          <div class="admin-stat-card card-purple">
            <div class="admin-stat-icon"><i class="ph-bold ph-users-three"></i></div>
            <div class="admin-stat-content">
              <span class="admin-stat-label">Jami Foydalanuvchilar</span>
              <strong class="admin-stat-val">${s.totalUsers}</strong>
              <span class="admin-stat-sub"><i class="ph-bold ph-arrow-up-right"></i> Faol o'quvchilar</span>
            </div>
          </div>

          <div class="admin-stat-card card-green">
            <div class="admin-stat-icon"><i class="ph-bold ph-user-plus"></i></div>
            <div class="admin-stat-content">
              <span class="admin-stat-label">Bugun Qo‘shilganlar</span>
              <strong class="admin-stat-val">${s.usersToday}</strong>
              <span class="admin-stat-sub"><i class="ph-bold ph-sparkle"></i> Yangi ro'yxatdan o'tganlar</span>
            </div>
          </div>

          <div class="admin-stat-card card-blue">
            <div class="admin-stat-icon"><i class="ph-bold ph-translate"></i></div>
            <div class="admin-stat-content">
              <span class="admin-stat-label">O‘rganilgan Lug‘atlar</span>
              <strong class="admin-stat-val">${s.totalSavedWords}</strong>
              <span class="admin-stat-sub"><i class="ph-bold ph-bookmark-simple"></i> Saqlangan so'zlar</span>
            </div>
          </div>

          <div class="admin-stat-card card-orange">
            <div class="admin-stat-icon"><i class="ph-bold ph-check-circle"></i></div>
            <div class="admin-stat-content">
              <span class="admin-stat-label">Bajarilgan Mashg‘ulotlar</span>
              <strong class="admin-stat-val">${s.totalCompletedScenes}</strong>
              <span class="admin-stat-sub"><i class="ph-bold ph-video"></i> Video darslar yakunlangan</span>
            </div>
          </div>
        </div>

        <!-- System Details Table -->
        <div class="admin-card-section">
          <h3 class="admin-section-subtitle"><i class="ph-bold ph-cpu"></i> Server va Infratuzilma Holati</h3>
          <div class="admin-info-table-wrap">
            <table class="admin-info-table">
              <tbody>
                <tr>
                  <td><strong>Admin Marshrut (ADMIN_PATH):</strong></td>
                  <td><code>${escapeHtml(this.adminPath)}</code> <span class="admin-badge admin-badge-green">Faol</span></td>
                </tr>
                <tr>
                  <td><strong>Server Ish Vaqti (Uptime):</strong></td>
                  <td>${uptimeHrs} soat, ${uptimeMins} daqiqa</td>
                </tr>
                <tr>
                  <td><strong>Node.js Versiyasi:</strong></td>
                  <td>${sys.nodeVersion || 'v22.x'}</td>
                </tr>
                <tr>
                  <td><strong>Operativ Xotira (RAM Sarfi):</strong></td>
                  <td>RSS: ${sys.memoryRssMb || 0} MB | Heap: ${sys.memoryHeapUsedMb || 0} MB</td>
                </tr>
                <tr>
                  <td><strong>Redis Kesh / Rate Limiting:</strong></td>
                  <td>${sys.redisConfigured ? '<span class="admin-badge admin-badge-green">Redis Ulanishi Faol</span>' : '<span class="admin-badge admin-badge-blue">Ichki Xotirada Faol (Bounded LRU)</span>'}</td>
                </tr>
                <tr>
                  <td><strong>Xavfsizlik Himoyalari:</strong></td>
                  <td>
                    <span class="admin-badge admin-badge-green">CSRF Token: Faol</span>
                    <span class="admin-badge admin-badge-green">HSTS 31536000: Faol</span>
                    <span class="admin-badge admin-badge-green">HttpOnly Cookies: Faol</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  private renderUsersTab(): string {
    const userRows = this.users.map((u) => {
      const initials = (u.full_name || u.username || 'U').slice(0, 1).toUpperCase();
      const regDate = u.created_at ? new Date(u.created_at).toLocaleDateString('uz-UZ') : '—';
      return `
        <tr data-user-id="${u.id}">
          <td>
            <div class="admin-user-cell">
              <div class="admin-table-avatar" style="background-color: ${escapeHtml(u.avatar_color || '#A3E635')}">${escapeHtml(initials)}</div>
              <div>
                <strong class="admin-user-name">${escapeHtml(u.full_name || 'Noma‘lum')}</strong>
                <span class="admin-user-handle">@${escapeHtml(u.username)}</span>
              </div>
            </div>
          </td>
          <td>${escapeHtml(u.email || '—')}</td>
          <td>
            <span class="admin-badge admin-badge-xp">${u.xp || 0} XP</span>
            <small class="admin-level-sub">Daraja: ${u.level || 1}</small>
          </td>
          <td>
            <span class="admin-streak-badge">🔥 ${u.streak || 0} kun</span>
          </td>
          <td>${regDate}</td>
          <td class="admin-actions-cell">
            <button class="admin-action-btn admin-btn-edit-user" data-user-id="${u.id}" data-user-xp="${u.xp}" data-user-level="${u.level}" data-user-streak="${u.streak}" title="XP / Darajani tahrirlash">
              <i class="ph-bold ph-pencil-simple"></i>
            </button>
            <button class="admin-action-btn admin-btn-del-user admin-btn-danger" data-user-id="${u.id}" data-user-name="${escapeHtml(u.username)}" title="Foydalanuvchini o‘chirish">
              <i class="ph-bold ph-trash"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="admin-tab-pane">
        <div class="admin-pane-header">
          <div>
            <h2 class="admin-pane-title">Foydalanuvchilar Boshqaruvi</h2>
            <p class="admin-pane-desc">Platformada ro‘yxatdan o‘tgan barcha o‘quvchilar ro‘yxati (${this.users.length} ta)</p>
          </div>
          <div class="admin-search-wrap">
            <i class="ph-bold ph-magnifying-glass"></i>
            <input
              type="text"
              id="adminUserSearchInput"
              class="admin-search-input"
              placeholder="Ism, login yoki email..."
              value="${escapeHtml(this.searchQuery)}"
            />
          </div>
        </div>

        <div class="admin-table-container">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Foydalanuvchi</th>
                <th>Email</th>
                <th>Tajriba (XP)</th>
                <th>Streak</th>
                <th>Ro‘yxatdan O‘tgan</th>
                <th>Amallar</th>
              </tr>
            </thead>
            <tbody>
              ${userRows.length > 0 ? userRows : `<tr><td colspan="6" class="admin-table-empty">Hech qanday foydalanuvchi topilmadi</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  private renderScenesTab(): string {
    const sceneCards = this.scenes.map((scene) => {
      let dialoguesCount = 0;
      try {
        const parsed = JSON.parse(scene.dialogues_json || '[]');
        dialoguesCount = Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        // Ignored
      }

      return `
        <div class="admin-scene-card" data-scene-id="${escapeHtml(scene.id)}">
          <div class="admin-scene-card-header">
            <div>
              <span class="admin-badge admin-badge-blue">${escapeHtml(scene.category || 'Movie')}</span>
              <span class="admin-badge admin-badge-xp">${escapeHtml(scene.difficulty || 'Intermediate')}</span>
            </div>
            <button class="admin-btn-del-scene admin-btn-danger" data-scene-id="${escapeHtml(scene.id)}" title="Darsni o‘chirish">
              <i class="ph-bold ph-trash"></i>
            </button>
          </div>
          <h4 class="admin-scene-title">${escapeHtml(scene.title)}</h4>
          <div class="admin-scene-meta">
            <span><i class="ph-bold ph-chat-centered-text"></i> ${dialoguesCount} ta dialog qatori</span>
            <span><i class="ph-bold ph-video-camera"></i> ${escapeHtml(scene.video_url.slice(0, 30))}...</span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="admin-tab-pane">
        <div class="admin-pane-header">
          <div>
            <h2 class="admin-pane-title">Filmlar & Video Darslar</h2>
            <p class="admin-pane-desc">Platformadagi barcha foydalanuvchilar uchun yangi darslar qo‘shish va boshqarish</p>
          </div>
          <button id="adminOpenNewSceneModalBtn" class="admin-btn admin-btn-primary">
            <i class="ph-bold ph-plus-circle"></i> Yangi Dars Qo‘shish
          </button>
        </div>

        <div class="admin-scenes-grid">
          ${sceneCards.length > 0 ? sceneCards : `
            <div class="admin-empty-box">
              <i class="ph-bold ph-film-slate"></i>
              <h3>Hozircha maxsus admin darslari mavjud emas</h3>
              <p>Yangi dars qo'shish tugmasini bosing va o'quvchilar uchun yangi film yoki video yuklang.</p>
            </div>
          `}
        </div>

        <!-- Add Scene Modal Dialog -->
        <div id="adminSceneModal" class="admin-modal" style="display: none;">
          <div class="admin-modal-backdrop"></div>
          <div class="admin-modal-content">
            <div class="admin-modal-header">
              <h3><i class="ph-bold ph-video"></i> Yangi Video Dars Yaratish</h3>
              <button id="adminCloseSceneModalBtn" class="admin-modal-close-btn">&times;</button>
            </div>
            <form id="adminNewSceneForm" class="admin-modal-form">
              <div class="admin-form-group">
                <label>Dars Sarlavhasi *</label>
                <input type="text" id="newSceneTitle" class="admin-input" placeholder="Masalan: Interstellar - So‘nggi Imkoniyat" required />
              </div>

              <div class="admin-form-row">
                <div class="admin-form-group">
                  <label>Kategoriya *</label>
                  <select id="newSceneCategory" class="admin-input">
                    <option value="Movie">Movie (Film)</option>
                    <option value="TV Series">TV Series (Serial)</option>
                    <option value="Animation">Animation (Multfilm)</option>
                    <option value="TED Talk">TED Talk</option>
                    <option value="Anime">Anime</option>
                  </select>
                </div>
                <div class="admin-form-group">
                  <label>Qiyinchilik Darajasi *</label>
                  <select id="newSceneDifficulty" class="admin-input">
                    <option value="Beginner">Beginner (Boshlang‘ich)</option>
                    <option value="Intermediate" selected>Intermediate (O‘rta)</option>
                    <option value="Advanced">Advanced (Murakkab)</option>
                  </select>
                </div>
              </div>

              <div class="admin-form-group">
                <label>Video URL yoki YouTube / Cloudflare R2 Havolasi *</label>
                <input type="text" id="newSceneVideoUrl" class="admin-input" placeholder="https://pub-xxx.r2.dev/video.mp4 yoki r2:fayl.mp4 yoki YouTube URL" required />
                <small class="admin-field-hint" style="display:block; margin-top: 4px; font-size: 0.8rem; color: #94A3B8;">
                  <i class="ph-bold ph-cloud"></i> Cloudflare R2 dan streaming uchun to‘liq R2 URL (<code>https://pub-xxx.r2.dev/video.mp4</code>) yoki <code>r2:video.mp4</code> kiriting.
                </small>
              </div>

              <div class="admin-form-group">
                <label>Poster Rasm Havolasi (Ixtiyoriy)</label>
                <input type="text" id="newScenePosterUrl" class="admin-input" placeholder="https://... rasm havolasi" />
              </div>

              <div class="admin-form-group">
                <label>Dialoglar va Subtitrlar (Har bir qator: Boshlanish(s) | Tugash(s) | Inglizcha matn | O‘zbekcha tarjima)</label>
                <textarea id="newSceneDialogues" class="admin-textarea" rows="5" placeholder="0 | 3.5 | Hello, how are you? | Salom, ahvolingiz qanday?&#10;3.6 | 7.0 | I am doing great, thank you. | Rahmat, juda yaxshiman."></textarea>
              </div>

              <div class="admin-modal-footer">
                <button type="button" id="adminCancelSceneBtn" class="admin-btn admin-btn-secondary">Bekor Qilish</button>
                <button type="submit" id="adminSaveSceneBtn" class="admin-btn admin-btn-primary">
                  <i class="ph-bold ph-check"></i> Darsni Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  private renderSecurityTab(): string {
    return `
      <div class="admin-tab-pane">
        <div class="admin-pane-header">
          <div>
            <h2 class="admin-pane-title">Xavfsizlik & Render.com Sozlamalari</h2>
            <p class="admin-pane-desc">Admin panel marshrutini va xavfsizlik parametrlarini sozlash qo‘llanmasi</p>
          </div>
        </div>

        <div class="admin-guide-grid">
          <!-- Guide 1: How to change route on Render.com -->
          <div class="admin-card-section">
            <h3 class="admin-section-subtitle"><i class="ph-bold ph-gear-six"></i> Render.com da Admin Marshrutini O‘zgartirish</h3>
            <p class="admin-text-muted">
              Ushbu panel manzilini (URL) Render.com boshqaruv panelida istalgan vaqt o'zgartirishingiz mumkin. Buning uchun:
            </p>
            <ol class="admin-guide-steps">
              <li><strong>Render.com Dashboard</strong> ga kiring va Tinglov xizmatingizni (Web Service) oching.</li>
              <li>Chap menyudan <strong>Environment</strong> bo‘limiga o‘ting.</li>
              <li>Yangi o'zgaruvchi qo'shing yoki mavjudini tahrirlang:
                <div class="admin-code-snippet">
                  <strong>ADMIN_PATH</strong> = <code>/boshqaruv</code> yoki <code>/maxfiy-tinglov-77</code>
                </div>
              </li>
              <li>O'zgarishni saqlang (<strong>Save Changes</strong>).</li>
              <li><strong>Eslatma:</strong> Saytni qayta build qilish shart emas! Server avtomatik tarzda yangi marshrutni qabul qiladi.</li>
            </ol>
          </div>

          <!-- Guide 2: Admin Password -->
          <div class="admin-card-section">
            <h3 class="admin-section-subtitle"><i class="ph-bold ph-key"></i> Admin Login va Parolini O‘zgartirish</h3>
            <p class="admin-text-muted">
              Xuddi shu <strong>Environment</strong> bo‘limida login va parolingizni belgilashingiz mumkin:
            </p>
            <div class="admin-code-snippet">
              <strong>ADMIN_USERNAME</strong> = <code>admin</code><br/>
              <strong>ADMIN_PASSWORD</strong> = <code>sizning_kuchli_parolingiz_2026</code>
            </div>
            <p class="admin-text-muted">
              Ushbu parametrlar kiritilgach, faqat siz belgilagan yangi parol bilan panelga kirish mumkin bo'ladi.
            </p>
          </div>

          <!-- Guide 3: Active Protections -->
          <div class="admin-card-section">
            <h3 class="admin-section-subtitle"><i class="ph-bold ph-shield-check"></i> Faol Xavfsizlik Qatlamlari</h3>
            <div class="admin-security-checks">
              <div class="admin-security-item">
                <i class="ph-bold ph-check-circle text-green"></i>
                <div>
                  <strong>Strict-Transport-Security (HSTS)</strong>
                  <p>max-age=31536000; includeSubDomains; preload orqali barcha so'rovlar faqat HTTPS orqali qabul qilinadi.</p>
                </div>
              </div>
              <div class="admin-security-item">
                <i class="ph-bold ph-check-circle text-green"></i>
                <div>
                  <strong>CSRF & Double Submit Cookie Himoyasi</strong>
                  <p>Har bir POST va DELETE so'rovi maxfiy X-CSRF-Token orqali tasdiqlanadi.</p>
                </div>
              </div>
              <div class="admin-security-item">
                <i class="ph-bold ph-check-circle text-green"></i>
                <div>
                  <strong>Rate Limiting & Anti-Bruteforce</strong>
                  <p>So'rovlar soni cheklangan va xavfsiz HMAC Captcha qo'llab-quvvatlanadi.</p>
                </div>
              </div>
              <div class="admin-security-item">
                <i class="ph-bold ph-check-circle text-green"></i>
                <div>
                  <strong>HttpOnly Secure Cookies</strong>
                  <p>Admin seans tokeni faqat server orqali o'qiladi, brauzer JavaScript (XSS) orqali o'g'irlab bo'lmaydi.</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Guide 4: Cloudflare R2 Video Streaming Setup -->
          <div class="admin-card-section">
            <h3 class="admin-section-subtitle"><i class="ph-bold ph-cloud-arrow-up" style="color: #F48120;"></i> Cloudflare R2 Video Streaming & CORS Sozlamalari</h3>
            <p class="admin-text-muted">
              Videolarni Cloudflare R2 orqali xarajatlarsiz (Zero Egress fees) tezkor va sifatli stream qilish uchun quyidagi 4 ta qadamni bajaring:
            </p>
            <ol class="admin-guide-steps">
              <li><strong>1. Cloudflare R2 da Bucket yarating</strong> (masalan, <code>tinglov-videos</code>) va videolarni (.mp4 formatda) yuklang.</li>
              <li><strong>2. R2 Settings &gt; Public Access</strong> bo‘limiga kiring:
                <p style="margin: 4px 0;"><strong>Custom Domain</strong> (masalan, <code>media.tinglov.me</code>) yoki <strong>R2.dev subdomain</strong> (masalan, <code>https://pub-xxxx.r2.dev</code>) ni yoqing (Allow Access).</p>
              </li>
              <li><strong>3. CORS Policy qo‘shing</strong> (R2 Settings &gt; CORS Policy &gt; Add CORS policy):
                <pre class="admin-code-snippet" style="font-size: 0.75rem; overflow-x: auto; white-space: pre-wrap;">[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range", "Content-Type", "Origin", "Accept"],
    "ExposeHeaders": ["Content-Range", "Content-Length", "Accept-Ranges", "ETag"],
    "MaxAgeSeconds": 3600
  }
]</pre>
              </li>
              <li><strong>4. Render.com Environment ga qo‘shing</strong>:
                <div class="admin-code-snippet">
                  <strong>CLOUDFLARE_R2_URL</strong> = <code>https://pub-xxxxxxxx.r2.dev</code> yoki <code>https://media.tinglov.me</code>
                </div>
              </li>
            </ol>
            <p class="admin-text-muted" style="margin-top: 8px;">
              <i class="ph-bold ph-info"></i> Sozlangandan so'ng, dars yaratishda to‘liq URL yoki shunchaki <code>r2:kino_nomi.mp4</code> kiritishingiz kifoya! Player avtomatik Cloudflare R2 Edge Streaming bilan ulanadi.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  private bindDashboardEvents(): void {
    // Navigation home
    const topHomeBtn = this.container.querySelector('#adminTopHomeBtn');
    if (topHomeBtn && this.onNavigateHomeCallback) {
      topHomeBtn.addEventListener('click', () => this.onNavigateHomeCallback!());
    }

    // Logout
    const logoutBtn = this.container.querySelector('#adminLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await apiService.adminLogout();
        this.isAuthenticated = false;
        this.renderLoginScreen();
      });
    }

    // Tabs switching
    const tabBtns = this.container.querySelectorAll('.admin-tab-btn');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tab = (e.currentTarget as HTMLElement).getAttribute('data-tab') as AdminTab;
        if (tab && tab !== this.activeTab) {
          this.activeTab = tab;
          this.errorMsg = null;
          this.successMsg = null;
          this.renderDashboard();
        }
      });
    });

    // Overview: Refresh stats
    const refreshStatsBtn = this.container.querySelector('#adminRefreshStatsBtn');
    if (refreshStatsBtn) {
      refreshStatsBtn.addEventListener('click', async () => {
        await this.loadAllData();
        this.renderDashboard();
      });
    }

    // Users: Search
    const searchInput = this.container.querySelector('#adminUserSearchInput') as HTMLInputElement;
    if (searchInput) {
      let debounceTimer: any;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        this.searchQuery = (e.target as HTMLInputElement).value;
        debounceTimer = setTimeout(async () => {
          this.users = await apiService.adminGetUsers(this.searchQuery).catch(() => []);
          const tbody = this.container.querySelector('.admin-table tbody');
          if (tbody) {
            this.renderDashboard();
          }
        }, 300);
      });
    }

    // Users: Delete User
    const delUserBtns = this.container.querySelectorAll('.admin-btn-del-user');
    delUserBtns.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const userId = Number((e.currentTarget as HTMLElement).getAttribute('data-user-id'));
        const userName = (e.currentTarget as HTMLElement).getAttribute('data-user-name');
        if (!userId) return;

        if (confirm(`Haqiqatan ham "${userName}" foydalanuvchisini butunlay o‘chirmoqchimisiz?`)) {
          const success = await apiService.adminDeleteUser(userId);
          if (success) {
            this.successMsg = `Foydalanuvchi "${userName}" muvaffaqiyatli o‘chirildi.`;
            await this.loadAllData();
            this.renderDashboard();
          } else {
            this.errorMsg = 'Foydalanuvchini o‘chirishda xatolik yuz berdi.';
            this.renderDashboard();
          }
        }
      });
    });

    // Users: Edit XP/Level
    const editUserBtns = this.container.querySelectorAll('.admin-btn-edit-user');
    editUserBtns.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget as HTMLElement;
        const userId = Number(target.getAttribute('data-user-id'));
        const curXp = target.getAttribute('data-user-xp') || '0';

        const newXpStr = prompt('Yangi XP miqdorini kiriting:', curXp);
        if (newXpStr === null) return;
        const newXp = parseInt(newXpStr, 10);
        if (isNaN(newXp) || newXp < 0) {
          alert('Noto‘g‘ri XP miqdori');
          return;
        }

        const newLevel = Math.max(1, Math.floor(newXp / 100) + 1);
        const ok = await apiService.adminUpdateUser(userId, { xp: newXp, level: newLevel });
        if (ok) {
          this.successMsg = `Foydalanuvchi tajribasi muvaffaqiyatli yangilandi: ${newXp} XP (Level ${newLevel})`;
          await this.loadAllData();
          this.renderDashboard();
        }
      });
    });

    // Scenes: Open Modal
    const openSceneModalBtn = this.container.querySelector('#adminOpenNewSceneModalBtn');
    const sceneModal = this.container.querySelector('#adminSceneModal') as HTMLElement;
    const closeSceneModalBtn = this.container.querySelector('#adminCloseSceneModalBtn');
    const cancelSceneBtn = this.container.querySelector('#adminCancelSceneBtn');

    if (openSceneModalBtn && sceneModal) {
      openSceneModalBtn.addEventListener('click', () => {
        sceneModal.style.display = 'flex';
      });
    }

    const closeModal = () => {
      if (sceneModal) sceneModal.style.display = 'none';
    };

    if (closeSceneModalBtn) closeSceneModalBtn.addEventListener('click', closeModal);
    if (cancelSceneBtn) cancelSceneBtn.addEventListener('click', closeModal);

    // Scenes: Save Scene
    const sceneForm = this.container.querySelector('#adminNewSceneForm') as HTMLFormElement;
    if (sceneForm) {
      sceneForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const titleInput = this.container.querySelector('#newSceneTitle') as HTMLInputElement;
        const catInput = this.container.querySelector('#newSceneCategory') as HTMLSelectElement;
        const diffInput = this.container.querySelector('#newSceneDifficulty') as HTMLSelectElement;
        const videoInput = this.container.querySelector('#newSceneVideoUrl') as HTMLInputElement;
        const posterInput = this.container.querySelector('#newScenePosterUrl') as HTMLInputElement;
        const dialInput = this.container.querySelector('#newSceneDialogues') as HTMLTextAreaElement;

        const title = titleInput.value.trim();
        const category = catInput.value;
        const difficulty = diffInput.value;
        const videoUrl = videoInput.value.trim();
        const posterUrl = posterInput.value.trim();
        const dialoguesRaw = dialInput.value.trim();

        if (!title || !videoUrl) return;

        // Parse lines into dialogues
        const dialogues: Array<{
          id: string;
          startTime: number;
          endTime: number;
          text: string;
          translation: string;
        }> = [];

        if (dialoguesRaw) {
          const lines = dialoguesRaw.split('\n');
          lines.forEach((line, idx) => {
            const parts = line.split('|').map((p) => p.trim());
            if (parts.length >= 3) {
              const start = parseFloat(parts[0]) || 0;
              const end = parseFloat(parts[1]) || start + 3;
              const text = parts[2] || '';
              const trans = parts[3] || '';
              if (text) {
                dialogues.push({
                  id: `line_${idx + 1}`,
                  startTime: start,
                  endTime: end,
                  text,
                  translation: trans,
                });
              }
            }
          });
        }

        const newScenePayload = {
          id: `admin_scene_${Date.now()}`,
          title,
          category,
          difficulty,
          video_url: videoUrl,
          poster_url: posterUrl,
          dialogues,
        };

        const ok = await apiService.adminCreateScene(newScenePayload);
        if (ok) {
          closeModal();
          this.successMsg = `"${title}" darsi muvaffaqiyatli saqlandi va barcha o'quvchilar uchun chop etildi!`;
          await this.loadAllData();
          this.renderDashboard();
        } else {
          alert('Darsni saqlashda xatolik yuz berdi');
        }
      });
    }

    // Scenes: Delete Scene
    const delSceneBtns = this.container.querySelectorAll('.admin-btn-del-scene');
    delSceneBtns.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const sceneId = (e.currentTarget as HTMLElement).getAttribute('data-scene-id');
        if (!sceneId) return;

        if (confirm('Ushbu darsni o‘chirmoqchimisiz?')) {
          const ok = await apiService.adminDeleteScene(sceneId);
          if (ok) {
            this.successMsg = 'Dars muvaffaqiyatli o‘chirildi.';
            await this.loadAllData();
            this.renderDashboard();
          } else {
            this.errorMsg = 'Darsni o‘chirishda xatolik yuz berdi.';
            this.renderDashboard();
          }
        }
      });
    });
  }
}
