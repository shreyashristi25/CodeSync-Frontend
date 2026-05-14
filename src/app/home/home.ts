import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ProjectService, Project, UserSearchResult } from '../services/project.service';
import { AuthService } from '../auth';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class HomeComponent implements OnInit {
  projects: Project[] = [];
  showingDemoProjects = false;
  loading = true;
  error: string | null = null;
  searchQuery = '';
  comingSoonMsg = '';
  activeDockItem = 'explorer';
  latencyMs = 12;
  loadPercent = 18;
  reqPerSec = 820;
  private telemetryTimer: ReturnType<typeof setInterval> | null = null;
  private allProjects: Project[] = [];
  
  userSearchQuery = '';
  userSearchResults: UserSearchResult[] = [];
  userSearchLoading = false;
  selectedUser: UserSearchResult | null = null;
  userProjects: Project[] = [];
  loadingUserProjects = false;



  constructor(
    private projectService: ProjectService,
    public authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadPublicProjects();
    this.startTelemetry();
  }

  ngOnDestroy(): void {
    if (this.telemetryTimer) {
      clearInterval(this.telemetryTimer);
    }
  }

  loadPublicProjects() {
    this.loading = true;
    this.showingDemoProjects = false;
    this.error = null;
    
    this.projectService.getPublicProjects().subscribe({
      next: (projects) => {
        this.allProjects = projects;
        this.projects = this.allProjects;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load projects.';
        this.loading = false;
        console.error(err);
      }
    });
  }

  onSearch(): void {
    if (!this.searchQuery.trim()) {
      this.projects = this.allProjects;
      return;
    }
    const query = this.searchQuery.toLowerCase();
    this.projects = this.allProjects.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.description.toLowerCase().includes(query)
    );
  }

  searchUsers(): void {
    if (!this.userSearchQuery.trim() || this.userSearchQuery.trim().length < 2) {
      this.userSearchResults = [];
      return;
    }
    if (this.userSearchTimer) {
      clearTimeout(this.userSearchTimer);
    }
    this.userSearchTimer = setTimeout(() => {
      this.doSearchUsers();
    }, 300);
  }

  private doSearchUsers(): void {
    this.userSearchLoading = true;
    this.projectService.searchUsers(this.userSearchQuery.trim()).subscribe({
      next: (users) => {
        this.userSearchResults = users;
        this.userSearchLoading = false;
      },
      error: () => {
        this.userSearchResults = [];
        this.userSearchLoading = false;
      }
    });
  }

  private userSearchTimer: ReturnType<typeof setTimeout> | null = null;

  selectUser(user: UserSearchResult): void {
    this.selectedUser = user;
    this.loadingUserProjects = true;
    this.userProjects = [];
    this.projectService.getUserProjects(user.id).subscribe({
      next: (projects) => {
        this.userProjects = projects;
        this.loadingUserProjects = false;
      },
      error: () => {
        this.userProjects = [];
        this.loadingUserProjects = false;
      }
    });
  }

  clearUserSearch(): void {
    this.selectedUser = null;
    this.userProjects = [];
    this.userSearchQuery = '';
    this.userSearchResults = [];
  }

  openProject(project: Project): void {
    this.router.navigate(['/workspace', project.id]);
  }

  onDockCommand(command: string): void {
    this.activeDockItem = command;
    switch (command) {
      case 'explorer':
        this.scrollToProjects();
        break;
      case 'search':
        this.focusSearch();
        break;
      case 'git':
        this.showComingSoon('Git');
        break;
      case 'run':
        this.showComingSoon('Code Execution');
        break;
      case 'terminal':
        this.showComingSoon('Terminal');
        break;
      case 'collab':
        this.showComingSoon('Collaboration');
        break;
      case 'comments':
        this.showComingSoon('Comments');
        break;
    }
  }

  scrollToProjects(): void {
    const el = document.querySelector('.projects-grid');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

  focusSearch(): void {
    const el = document.querySelector('.search-input') as HTMLInputElement;
    if (el) el.focus();
  }

  showComingSoon(feature: string): void {
    this.comingSoonMsg = feature + ' coming soon';
    setTimeout(() => this.comingSoonMsg = '', 2500);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  navigateToRole() {
    this.router.navigate(['/']);
  }

  navigateToDashboard() {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/']);
    }
  }

  private startTelemetry(): void {
    this.telemetryTimer = setInterval(() => {
      this.latencyMs = this.roll(this.latencyMs, 9, 19, 2);
      this.loadPercent = this.roll(this.loadPercent, 10, 42, 4);
      this.reqPerSec = this.roll(this.reqPerSec, 790, 910, 11);
    }, 1800);
  }

  private roll(current: number, min: number, max: number, delta: number): number {
    const next = current + Math.floor(Math.random() * (delta * 2 + 1)) - delta;
    return Math.max(min, Math.min(max, next));
  }

  toggleTheme(): void {
    const root = document.documentElement;
    const isDark = root.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('cs-theme', next);
  }

  getThemeLabel(): string {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'DARK' : 'LIGHT';
  }

  getPrimaryTech(project: Project): string {
    const maybe = project as Project & { language?: string };
    return maybe.language ? maybe.language.toUpperCase() : 'PUBLIC';
  }

  getProjectLatency(project: Project): number {
    return 10 + (project.id % 13);
  }

  getProjectFileCount(project: Project): number {
    return 6 + (project.id % 19);
  }
}