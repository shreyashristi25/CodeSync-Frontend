import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from "@angular/forms";
import { AuthService } from "../auth";
import { AppProject, AppStateService, AppUser } from '../services/app-state.service';
import { ToastService } from '../services/toast.service';
import { LucideAngularModule, Activity, FolderGit2, Terminal, User, LogOut, Search, Plus, TerminalSquare, FileCode2, Users, Component as ComponentIcon, Loader2, SearchX, ArrowRight, MoreHorizontal, Edit, Share2, Trash2, AlertTriangle, PlusCircle, Bell } from 'lucide-angular';

import { D3TelemetryComponent } from '../components/d3-telemetry/d3-telemetry';
import { ProjectService, Project } from '../services/project.service';
import { NotificationBellComponent } from '../components/notification-bell/notification-bell';
import { ExecutionService } from '../services/execution.service';

@Component({
  selector: 'app-my-projects',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, LucideAngularModule, D3TelemetryComponent, NotificationBellComponent],
  templateUrl: './my-projects.html',
  styleUrl: './my-projects.css'
})
export class MyProjectsComponent implements OnInit, OnDestroy {
  readonly icons = { Activity, FolderGit2, Terminal, User, LogOut, Search, Plus, TerminalSquare, FileCode2, Users, Component: ComponentIcon, Loader2, SearchX, ArrowRight, MoreHorizontal, Edit, Share2, Trash2, AlertTriangle, PlusCircle, Bell };

  projects: AppProject[] = [];
  filteredProjects: AppProject[] = [];
  loading = true;
  showCreateModal = false;
  showShareModal = false;
  showDeleteModal = false;
  selectedProject: AppProject | null = null;
  editingProjectId: number | null = null;
  stats = { projects: 0, files: 0, executionsThisMonth: 0, collaborators: 0 };
  private executionsThisMonth = 0;
  projectSearch = '';
  telemetryHistory: number[] = Array.from({length: 20}, () => Math.floor(Math.random() * 50) + 10);
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  deleteMessage = '';
  private deleteConfirmAction: (() => void) | null = null;
  newProject = {
    name: '',
    description: '',
    language: 'TypeScript' as 'JavaScript' | 'TypeScript' | 'Python' | 'Go' | 'Rust' | 'Java' | 'C++',
    visibility: 'PRIVATE' as 'PUBLIC' | 'PRIVATE'
  };
  shareEmail = '';
  shareRole: 'Viewer' | 'Editor' = 'Viewer';
  shareSuggestions: AppUser[] = [];
  shareLink = '';
  shareVisibility: 'PUBLIC' | 'PRIVATE' = 'PRIVATE';
  collaboratorRows: Array<{ user: AppUser; role: 'Viewer' | 'Editor' }> = [];
  error: string | null = null;
  activeDockItem = 'explorer';
  latencyMs = 11;
  loadPercent = 22;
  reqPerSec = 846;
  comingSoonMsg = '';
  private telemetryTimer: ReturnType<typeof setInterval> | null = null;
  private comingSoonTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private router: Router,
    public authService: AuthService,
    private appState: AppStateService,
    private toastService: ToastService,
    private projectService: ProjectService,
    private executionService: ExecutionService
  ) {}

  ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (!user || user.role === 'GUEST') {
      this.router.navigate(['/']);
      return;
    }
    this.loadUserProjects();
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
    if (this.comingSoonTimer) {
      clearTimeout(this.comingSoonTimer);
    }
  }

  loadUserProjects() {
    this.loading = true;
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.loading = false;
      return;
    }
    
    this.projectService.getUserProjects(user.userId).subscribe({
      next: (projects) => {
        const seedProjects = this.appState.projects$.value.filter(p => p.id >= 9001 && p.id <= 9003);
        this.projects = [...seedProjects, ...projects.map(p => ({
          ...p,
          language: ((p.language as string) || 'TypeScript') as AppProject['language'],
          visibility: p.isPublic ? 'PUBLIC' as const : 'PRIVATE' as const,
          updatedAt: p.createdAt,
          collaborators: []
        }))].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
        this.applySearch();
        this.recalculateStats();
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load projects from backend:', err);
        this.projects = [...this.appState.projects$.value].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
        this.applySearch();
        this.recalculateStats();
        this.loading = false;
      }
    });
  }

  createProject() {
    if (!this.newProject.name.trim() || this.newProject.name.trim().length < 2) {
      this.toastService.error('Project name must be at least 2 characters.');
      return;
    }
    if (!this.newProject.description.trim() || this.newProject.description.trim().length < 2) {
      this.toastService.error('Project description must be at least 2 characters.');
      return;
    }

    const user = this.authService.getCurrentUser();
    if (!user) return;

    const name = this.newProject.name.trim();
    const description = this.newProject.description.trim();

    if (this.editingProjectId && this.editingProjectId < 9000) {
      this.projectService.updateProject(this.editingProjectId, {
        name,
        description,
        isPublic: this.newProject.visibility === 'PUBLIC'
      }).subscribe({
        next: () => {
          this.toastService.success('Project updated successfully.');
          this.appState.updateProject(this.editingProjectId!, {
            name,
            description,
            language: this.newProject.language,
            visibility: this.newProject.visibility
          });
          this.resetCreateModal();
          this.showCreateModal = false;
          this.loadUserProjects();
        },
        error: () => {
          this.toastService.error('Failed to update project.');
        }
      });
    } else {
      this.projectService.createProject({
        name,
        description,
        ownerId: user.userId,
        isPublic: this.newProject.visibility === 'PUBLIC',
        language: this.newProject.language
      }).subscribe({
        next: (project) => {
          const language = (project.language || this.newProject.language) as AppProject['language'];
          const created: AppProject = {
            id: project.id,
            name: project.name,
            description: project.description,
            ownerId: project.ownerId,
            language,
            visibility: this.newProject.visibility,
            createdAt: project.createdAt,
            updatedAt: project.createdAt,
            collaborators: [],
            files: {}
          };
          this.createStarterFilesForProject(created);
          this.toastService.success('Project created successfully.');
          this.resetCreateModal();
          this.showCreateModal = false;
          this.loadUserProjects();
        },
        error: () => {
          this.toastService.error('Failed to create project.');
        }
      });
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  openCreateModal(project?: AppProject) {
    if (project) {
      this.editingProjectId = project.id;
      this.newProject = {
        name: project.name,
        description: project.description,
        language: project.language,
        visibility: project.visibility
      };
    }
    this.showCreateModal = true;
  }

  openWorkspace(projectId: number) {
    this.router.navigate(['/workspace', projectId]);
  }

  openCollab(projectId: number) {
    this.router.navigate(['/workspace', projectId], { queryParams: { mode: 'collab' } });
  }

  onDockCommand(command: string): void {
    this.activeDockItem = command;
    switch (command) {
      case 'explorer':
        this.showCreateModal = false;
        break;
      case 'projects':
        this.openCreateModal();
        break;
      case 'run':
        this.router.navigate(['/execution-history']);
        break;
      case 'terminal':
        this.router.navigate(['/dashboard']);
        break;
      case 'git':
        this.showComingSoon('Commit history is in workspace');
        break;
      case 'collab':
        this.showComingSoon('Collaboration tools are available in workspace');
        break;
      case 'comments':
        this.showComingSoon('Comments are available in workspace');
        break;
    }
  }

  private startTelemetry(): void {
    this.telemetryTimer = setInterval(() => {
      this.latencyMs = this.roll(this.latencyMs, 8, 18, 2);
      this.loadPercent = this.roll(this.loadPercent, 14, 58, 5);
      this.reqPerSec = this.roll(this.reqPerSec, 820, 980, 12);

      this.telemetryHistory.shift();
      this.telemetryHistory.push(this.reqPerSec / 10);
      this.telemetryHistory = [...this.telemetryHistory];
    }, 1500);
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

  showComingSoon(feature: string): void {
    if (this.comingSoonTimer) {
      clearTimeout(this.comingSoonTimer);
    }
    this.comingSoonMsg = feature + ' coming soon';
    this.comingSoonTimer = setTimeout(() => {
      this.comingSoonMsg = '';
    }, 2500);
  }

  getFileCount(projectId: number): number {
    return this.appState.getFilesByProject(projectId).filter((f) => !f.isDirectory).length;
  }

  openProjectMenu(project: AppProject): void {
    this.selectedProject = this.selectedProject?.id === project.id ? null : project;
  }

  closeAllModals(): void {
    this.showCreateModal = false;
    this.showShareModal = false;
    this.showDeleteModal = false;
    this.resetCreateModal();
    this.shareSuggestions = [];
    this.deleteConfirmAction = null;
  }

  openEdit(project: AppProject): void {
    this.selectedProject = project;
    this.openCreateModal(project);
  }

  openShare(project: AppProject): void {
    this.selectedProject = project;
    this.shareEmail = '';
    this.shareRole = 'Viewer';
    this.shareVisibility = project.visibility;
    this.shareLink = `codesync://share/${project.id}`;
    this.collaboratorRows = this.toCollaboratorRows(project);
    this.shareSuggestions = [];
    this.showShareModal = true;
  }

  onShareEmailInput(): void {
    const query = this.shareEmail.trim().toLowerCase();
    if (!query) {
      this.shareSuggestions = [];
      return;
    }
    const selectedIds = new Set(this.collaboratorRows.map((row) => row.user.id));
    if (this.selectedProject) {
      selectedIds.add(this.selectedProject.ownerId);
    }
    this.shareSuggestions = this.appState.getUsers()
      .filter((u) => !selectedIds.has(u.id))
      .filter((u) => u.email.toLowerCase().includes(query) || u.name.toLowerCase().includes(query))
      .slice(0, 6);
  }

  selectShareSuggestion(user: AppUser): void {
    this.shareEmail = user.email;
    this.shareSuggestions = [];
  }

  shareProject(): void {
    if (!this.selectedProject) return;
    const email = this.shareEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.toastService.error('Enter a valid collaborator email.');
      return;
    }
    const user = this.appState.findUserByEmail(email);
    if (!user) {
      this.toastService.error('Collaborator account not found.');
      return;
    }
    if (user.id === this.selectedProject.ownerId) {
      this.toastService.error('Owner is already part of the project.');
      return;
    }
    const existingRow = this.collaboratorRows.find((row) => row.user.id === user.id);
    if (existingRow) {
      existingRow.role = this.shareRole;
    } else {
      this.collaboratorRows = [...this.collaboratorRows, { user, role: this.shareRole }];
    }

    this.persistShareChanges();
    this.shareEmail = '';
    this.shareRole = 'Viewer';
    this.onShareEmailInput();
    this.toastService.success('Collaborator added.');
  }

  updateCollaboratorRole(userId: number, role: 'Viewer' | 'Editor'): void {
    this.collaboratorRows = this.collaboratorRows.map((row) => (row.user.id === userId ? { ...row, role } : row));
    this.persistShareChanges();
  }

  removeCollaborator(userId: number): void {
    this.collaboratorRows = this.collaboratorRows.filter((row) => row.user.id !== userId);
    this.persistShareChanges();
    this.toastService.info('Collaborator removed.');
  }

  toggleShareVisibility(): void {
    this.shareVisibility = this.shareVisibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC';
    this.persistShareChanges();
  }

  copyShareLink(): void {
    if (!this.shareLink) return;
    navigator.clipboard?.writeText(this.shareLink).then(() => {
      this.toastService.success('Share link copied.');
    }).catch(() => {
      this.toastService.warning('Unable to copy share link.');
    });
  }

  openDelete(project: AppProject): void {
    this.showDeleteConfirm(`Delete ${project.name} and all related files/history?`, () => {
      if (project.id >= 9000) {
        this.appState.deleteProject(project.id);
        this.toastService.warning('Project deleted.');
      } else {
        this.projectService.deleteProject(project.id).subscribe({
          next: () => {
            this.toastService.warning('Project deleted.');
          },
          error: () => {
            this.toastService.error('Failed to delete project.');
          }
        });
      }
      this.closeAllModals();
      this.loadUserProjects();
    });
  }

  showDeleteConfirm(message: string, onConfirm: () => void): void {
    this.deleteMessage = message;
    this.deleteConfirmAction = onConfirm;
    this.showDeleteModal = true;
  }

  confirmDelete(): void {
    if (this.deleteConfirmAction) {
      this.deleteConfirmAction();
    }
  }

  onSearchInput(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.applySearch();
    }, 200);
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

  private getCurrentAppUser(): AppUser | null {
    const auth = this.authService.getCurrentUser();
    if (!auth) return null;
    return this.appState.getUsers().find((u) => u.id === auth.userId) || null;
  }

  private applySearch(): void {
    const query = this.projectSearch.trim().toLowerCase();
    this.filteredProjects = !query
      ? [...this.projects]
      : this.projects.filter((project) => project.name.toLowerCase().includes(query));
  }

  private recalculateStats(): void {
    const allProjects = this.appState.projects$.value;

    const files = allProjects.reduce((sum, project) => sum + this.getFileCount(project.id), 0);
    const collaborators = new Set<number>();
    allProjects.forEach((project) => project.collaborators.forEach((collab) => collaborators.add(collab.userId)));

    this.stats = {
      projects: this.projects.length,
      files,
      executionsThisMonth: this.executionsThisMonth,
      collaborators: collaborators.size
    };
  }

  private persistShareChanges(): void {
    if (!this.selectedProject) return;
    const collaborators = this.collaboratorRows.map((row) => ({ userId: row.user.id, role: row.role }));
    this.appState.updateProject(this.selectedProject.id, {
      visibility: this.shareVisibility,
      collaborators
    });
    this.loadUserProjects();
    this.selectedProject = this.projects.find((project) => project.id === this.selectedProject!.id) || null;
  }

  private toCollaboratorRows(project: AppProject): Array<{ user: AppUser; role: 'Viewer' | 'Editor' }> {
    return project.collaborators
      .map((collab) => {
        const user = this.appState.getUsers().find((entry) => entry.id === collab.userId);
        if (!user) return null;
        return { user, role: collab.role };
      })
      .filter((row): row is { user: AppUser; role: 'Viewer' | 'Editor' } => row !== null);
  }

  private resetCreateModal(): void {
    this.editingProjectId = null;
    this.newProject = {
      name: '',
      description: '',
      language: 'TypeScript',
      visibility: 'PRIVATE'
    };
  }

  private createStarterFilesForProject(project: AppProject): void {
    const language = project.language || 'TypeScript';
    if (language === 'JavaScript') {
      this.appState.createFile(project.id, '', 'index.html', false);
      this.appState.updateFileContent(project.id, 'index.html', `<main>\n  <h1>${project.name}</h1>\n</main>\n`);
      this.appState.createFile(project.id, '', 'app.js', false);
      this.appState.updateFileContent(project.id, 'app.js', `const app = document.querySelector('main');\nconsole.log('workspace ready');\n`);
      return;
    }
    if (language === 'TypeScript') {
      this.appState.createFile(project.id, '', 'app.ts', false);
      this.appState.updateFileContent(project.id, 'app.ts', `export function boot() {\n  return 'ready';\n}\n`);
      return;
    }
    if (language === 'Python') {
      this.appState.createFile(project.id, '', 'main.py', false);
      this.appState.updateFileContent(project.id, 'main.py', `def main():\n    print('workspace ready')\n\nif __name__ == '__main__':\n    main()\n`);
      return;
    }
    if (language === 'Java') {
      this.appState.createFile(project.id, '', 'Main.java', false);
      this.appState.updateFileContent(project.id, 'Main.java', `public class Main {\n    public static void main(String[] args) {\n        System.out.println("workspace ready");\n    }\n}\n`);
      return;
    }
    if (language === 'Go') {
      this.appState.createFile(project.id, '', 'main.go', false);
      this.appState.updateFileContent(project.id, 'main.go', `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("workspace ready")\n}\n`);
      return;
    }
    if (language === 'Rust') {
      this.appState.createFile(project.id, '', 'main.rs', false);
      this.appState.updateFileContent(project.id, 'main.rs', `fn main() {\n    println!("workspace ready");\n}\n`);
      return;
    }
    if (language === 'C++') {
      this.appState.createFile(project.id, '', 'main.cpp', false);
      this.appState.updateFileContent(project.id, 'main.cpp', `#include <iostream>\n\nint main() {\n    std::cout << "workspace ready" << std::endl;\n    return 0;\n}\n`);
      return;
    }
    // Default to TypeScript
    this.appState.createFile(project.id, '', 'app.ts', false);
    this.appState.updateFileContent(project.id, 'app.ts', `export function boot() {\n  return 'ready';\n}\n`);
  }
}
