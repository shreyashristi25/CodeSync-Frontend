import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from "@angular/forms";
import { AuthService } from "../auth";
import { AppProject, AppStateService, AppUser } from '../services/app-state.service';
import { ToastService } from '../services/toast.service';
import { LucideAngularModule, Activity, FolderGit2, Terminal, User, LogOut, Search, Globe, FileCode2, TerminalSquare, Component as ComponentIcon, Loader2, SearchX, Star, GitFork, ArrowRight, Bell, Send, X, Zap } from 'lucide-angular';

import { D3TelemetryComponent } from '../components/d3-telemetry/d3-telemetry';
import { NotificationBellComponent } from '../components/notification-bell/notification-bell';
import { HttpClient } from '@angular/common/http';
import { ProjectService, Project } from '../services/project.service';
import { ExecutionService } from '../services/execution.service';
import { apiUrl } from '../services/api-config';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, LucideAngularModule, D3TelemetryComponent, NotificationBellComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  readonly icons = { Activity, FolderGit2, Terminal, User, LogOut, Search, Globe, FileCode2, TerminalSquare, Component: ComponentIcon, Loader2, SearchX, Star, GitFork, ArrowRight, Bell, Send, X, Zap };

showNotificationModal = false;
  showPublicProjectsModal = false;
  publicProjectsList: AppProject[] = [];
  notificationMessage = '';
  notificationType = 'MESSAGE';
  selectedUsers: Set<number> = new Set();
  sendingNotification = false;
  availableUsers: { id: number; email: string; fullName: string; role: string; status: string }[] = [];
  loadingUsers = false;
  selectAll = false;

  projects: AppProject[] = [];
  filteredProjects: AppProject[] = [];
  loading = true;
  stats = { projects: 0, files: 0, executionsThisMonth: 0, collaborators: 0 };
  private executionsThisMonth = 0;
  
  projectSearch = '';
  languageFilter = 'All';
  sortMode: 'stars' | 'forks' = 'stars';
  telemetryHistory: number[] = Array.from({length: 20}, () => Math.floor(Math.random() * 50) + 10);
  
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private telemetryTimer: ReturnType<typeof setInterval> | null = null;
  
  latencyMs = 11;
  loadPercent = 22;
  reqPerSec = 846;

  constructor(
    private router: Router,
    public authService: AuthService,
    public appState: AppStateService,
    private toastService: ToastService,
    private http: HttpClient,
    private projectService: ProjectService,
    private executionService: ExecutionService
  ) {}

  ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (!user || user.role === 'GUEST') {
      this.router.navigate(['/']);
      return;
    }
    
    this.appState.projects$.subscribe(() => {
      this.loadTrendingProjects();
    });
    this.startTelemetry();
    this.loadExecutionStats();
  }

  private loadExecutionStats(): void {
    this.executionService.getHistory().subscribe({
      next: (jobs) => {
        const month = new Date().getMonth();
        const year = new Date().getFullYear();
        this.executionsThisMonth = jobs.filter(job => {
          if (!job.submittedAt) return false;
          const date = new Date(job.submittedAt);
          return date.getMonth() === month && date.getFullYear() === year;
        }).length;
        this.recalculateStats();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.telemetryTimer) {
      clearInterval(this.telemetryTimer);
    }
  }

  loadTrendingProjects() {
    this.loading = true;
    
    this.projectService.getPublicProjects().subscribe({
      next: (backendProjects) => {
        const seedProjects = this.appState.projects$.value.filter(p => p.id >= 9001 && p.id <= 9003 && p.visibility === 'PUBLIC');
        const mappedProjects = backendProjects.map(p => ({
          ...p,
          language: ((p.language as string) || 'TypeScript') as AppProject['language'],
          visibility: p.isPublic ? 'PUBLIC' as const : 'PRIVATE' as const,
          updatedAt: p.createdAt,
          createdAt: p.createdAt,
          collaborators: [],
          stars: 0,
          forks: 0,
          starredBy: []
        }));
        
        const publicProjects = [...seedProjects, ...mappedProjects];
        
        const trendingProjects = publicProjects
          .filter(p => (p.stars || 0) > 0)
          .sort((a, b) => {
            if (this.sortMode === 'stars') return (b.stars || 0) - (a.stars || 0);
            return (b.forks || 0) - (a.forks || 0);
          });

        this.projects = trendingProjects;
        this.applySearch();
        this.recalculateStats();
        this.loading = false;
      },
      error: () => {
        const publicProjects = this.appState.projects$.value.filter(p => p.visibility === 'PUBLIC');
        const trendingProjects = publicProjects
          .filter(p => (p.stars || 0) > 0)
          .sort((a, b) => {
            if (this.sortMode === 'stars') return (b.stars || 0) - (a.stars || 0);
            return (b.forks || 0) - (a.forks || 0);
          });
        this.projects = trendingProjects;
        this.applySearch();
        this.recalculateStats();
        this.loading = false;
      }
    });
  }

  onSearchInput(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.applySearch();
    }, 200);
  }

  onFilterChange(): void {
    this.loadTrendingProjects(); // Re-sort and filter
  }

  private applySearch(): void {
    const query = this.projectSearch.trim().toLowerCase();
    this.filteredProjects = this.projects.filter((project) => {
      const matchName = !query || project.name.toLowerCase().includes(query) || project.description.toLowerCase().includes(query);
      const matchLang = this.languageFilter === 'All' || project.language === this.languageFilter;
      return matchName && matchLang;
    });
  }

  starProject(projectId: number): void {
    const user = this.authService.getCurrentUser();
    if (!user) return;
    this.appState.starProject(projectId, user.userId);
    // Observable triggers reload automatically
  }

  forkProject(projectId: number): void {
    const user = this.authService.getCurrentUser();
    if (!user) return;
    
    if (this.appState.isProjectForkedByUser(projectId, user.userId)) {
      this.toastService.error(`Already forked in My Projects.`);
      return;
    }
    
    const forked = this.appState.forkProject(projectId, user.userId);
    if (forked) {
      this.toastService.success(`Project forked! Find it in My Projects.`);
    } else {
      this.toastService.error(`Failed to fork project.`);
    }
  }

  hasStarred(project: AppProject): boolean {
    const user = this.authService.getCurrentUser();
    if (!user) return false;
    return !!project.starredBy?.includes(user.userId);
  }

  isProjectForked(projectId: number): boolean {
    const user = this.authService.getCurrentUser();
    if (!user) return false;
    return this.appState.isProjectForkedByUser(projectId, user.userId);
  }

  openPublicProjectsModal(): void {
    const seedProjects = this.appState.projects$.value.filter(p => p.id >= 9001 && p.id <= 9003 && p.visibility === 'PUBLIC');
    this.projectService.getPublicProjects().subscribe({
      next: (backendProjects) => {
        const mappedProjects = backendProjects.map(p => ({
          ...p,
          language: ((p.language as string) || 'TypeScript') as AppProject['language'],
          visibility: p.isPublic ? 'PUBLIC' as const : 'PRIVATE' as const,
          updatedAt: p.createdAt,
          createdAt: p.createdAt,
          collaborators: [],
          stars: 0,
          forks: 0,
          starredBy: []
        }));
        this.publicProjectsList = [...seedProjects, ...mappedProjects];
        this.showPublicProjectsModal = true;
      },
      error: () => {
        this.publicProjectsList = this.appState.projects$.value.filter(p => p.visibility === 'PUBLIC');
        this.showPublicProjectsModal = true;
      }
    });
  }

  closePublicProjectsModal(): void {
    this.showPublicProjectsModal = false;
  }

  openWorkspace(projectId: number) {
    this.router.navigate(['/workspace', projectId]);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  getLanguageClass(language: string): string {
    const normalized = language.toLowerCase();
    if (normalized.includes('typescript')) return 'text-blue-400 border-blue-400/30 bg-blue-400/10';
    if (normalized.includes('python')) return 'text-green-400 border-green-400/30 bg-green-400/10';
    if (normalized.includes('go')) return 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10';
    if (normalized.includes('rust')) return 'text-orange-400 border-orange-400/30 bg-orange-400/10';
    if (normalized.includes('java') && !normalized.includes('javascript')) return 'text-red-400 border-red-400/30 bg-red-400/10';
    if (normalized.includes('c++')) return 'text-purple-400 border-purple-400/30 bg-purple-400/10';
    return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10';
  }

  getFileCount(projectId: number): number {
    return this.appState.getFilesByProject(projectId).filter((f) => !f.isDirectory).length;
  }

  private recalculateStats(): void {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    const allProjects = this.appState.projects$.value;

    const files = allProjects.reduce((sum, project) => sum + this.getFileCount(project.id), 0);
    const collaborators = new Set<number>();
    allProjects.forEach((project) => project.collaborators.forEach((collab) => collaborators.add(collab.userId)));

    const publicProjectsNotForked = this.projects.filter(
      (p) => p.visibility === 'PUBLIC' && !this.appState.isProjectForkedByUser(p.id, user.userId)
    ).length;

    this.stats = {
      projects: publicProjectsNotForked,
      files,
      executionsThisMonth: this.executionsThisMonth,
      collaborators: collaborators.size
    };
  }

  private startTelemetry(): void {
    this.telemetryTimer = setInterval(() => {
      this.latencyMs = this.roll(this.latencyMs, 8, 18, 2);
      this.loadPercent = this.roll(this.loadPercent, 14, 58, 5);
      this.reqPerSec = this.roll(this.reqPerSec, 820, 980, 12);
      
      this.telemetryHistory.shift();
      this.telemetryHistory.push(this.reqPerSec / 10); // scale for graph
      this.telemetryHistory = [...this.telemetryHistory]; // trigger change detection for D3 input
    }, 1500);
  }

  private roll(current: number, min: number, max: number, delta: number): number {
    const next = current + Math.floor(Math.random() * (delta * 2 + 1)) - delta;
    return Math.max(min, Math.min(max, next));
  }

  getAvailableUsers() {
    return this.availableUsers;
  }

  toggleUserSelection(userId: number): void {
    if (this.selectedUsers.has(userId)) {
      this.selectedUsers.delete(userId);
    } else {
      this.selectedUsers.add(userId);
    }
  }

  isUserSelected(userId: number): boolean {
    return this.selectedUsers.has(userId);
  }

  openNotificationModal(): void {
    this.showNotificationModal = true;
    this.notificationMessage = '';
    this.notificationType = 'MESSAGE';
    this.selectedUsers.clear();
    this.selectAll = false;
    this.loadUsers();
  }

  loadUsers(): void {
    this.loadingUsers = true;
    this.http.get<{ id: number; email: string; fullName: string; role: string; status: string }[]>(
      apiUrl('/api/auth/users?excludeCurrentUser=true')
    ).subscribe({
      next: (users) => {
        console.log('Users loaded:', users);
        this.availableUsers = users;
        this.loadingUsers = false;
      },
      error: (err) => {
        console.error('Load users error:', err);
        this.availableUsers = [];
        this.loadingUsers = false;
      }
    });
  }

  toggleSelectAll(): void {
    this.selectAll = !this.selectAll;
    if (this.selectAll) {
      this.availableUsers.forEach(user => this.selectedUsers.add(user.id));
    } else {
      this.selectedUsers.clear();
    }
  }

  closeNotificationModal(): void {
    this.showNotificationModal = false;
  }

  sendNotification(): void {
    const trimmed = this.notificationMessage.trim();
    if (!trimmed) {
      this.toastService.error('Message is required.');
      return;
    }

    if (this.selectedUsers.size === 0 && !this.selectAll) {
      this.toastService.error('Select at least one user.');
      return;
    }

    this.sendingNotification = true;
    const userIds = this.selectAll 
      ? this.availableUsers.map(u => u.id)
      : Array.from(this.selectedUsers);

    this.http.post(apiUrl('/api/notifications/admin/broadcast'), {
      userIds,
      type: this.notificationType,
      message: trimmed
    }, { responseType: 'text' }).subscribe({
      next: (response) => {
        this.sendingNotification = false;
        console.log('Notification response:', response);
        this.toastService.success('Notification sent successfully.');
        this.closeNotificationModal();
      },
      error: (err) => {
        this.sendingNotification = false;
        console.error('Notification error:', err);
        this.toastService.error(err.message || 'Failed to send notification.');
      }
    });
  }
}
