import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth';
import { AppStateService, ExecutionHistoryEntry, ExecutionStatus } from '../services/app-state.service';
import { ExecutionService } from '../services/execution.service';
import { ToastService } from '../services/toast.service';
import { NotificationBellComponent } from '../components/notification-bell/notification-bell';

@Component({
  selector: 'app-execution-history',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NotificationBellComponent],
  templateUrl: './execution-history.html',
  styleUrl: './execution-history.css'
})
export class ExecutionHistoryComponent implements OnInit {
  entries: ExecutionHistoryEntry[] = [];
  filtered: ExecutionHistoryEntry[] = [];
  pageEntries: ExecutionHistoryEntry[] = [];

  search = '';
  statusFilter: 'ALL' | ExecutionStatus = 'ALL';
  projectFilter: 'ALL' | number = 'ALL';
  languageFilter = 'ALL';
  currentPage = 1;
  readonly pageSize = 10;

  selectedOutput: ExecutionHistoryEntry | null = null;

  constructor(
    private authService: AuthService,
    private appState: AppStateService,
    private executionService: ExecutionService,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (!user || user.role !== 'DEVELOPER') {
      this.router.navigate(['/']);
      return;
    }
    this.executionService.getHistory().subscribe({
      next: (jobs) => {
        this.entries = jobs.map((job, index) => ({
          id: index + 1,
          date: job.submittedAt || new Date().toISOString(),
          projectId: job.projectId || 0,
          projectName: 'Unknown Project',
          file: job.fileName || 'Unknown',
          language: this.languageToDisplay(job.language),
          durationMs: job.executionTimeMs || 0,
          memoryMb: Math.round((job.memoryUsedKb || 0) / 1024),
          status: this.statusToDisplay(job.status),
          output: job.output || job.error || ''
        }));
        this.applyFilters();
      },
      error: () => {
        this.entries = this.appState.getExecutionHistory();
        this.applyFilters();
      }
    });
  }

  private languageToDisplay(lang: string): string {
    const map: Record<string, string> = {
      'PYTHON': 'Python',
      'NODE': 'JavaScript',
      'JAVA': 'Java'
    };
    return map[lang] || lang;
  }

  private statusToDisplay(status: string): ExecutionStatus {
    const map: Record<string, ExecutionStatus> = {
      'COMPLETED': 'Success',
      'FAILED': 'Failed',
      'TIMED_OUT': 'Failed',
      'CANCELLED': 'Terminated',
      'RUNNING': 'Success'
    };
    return map[status] || 'Failed';
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filtered.length / this.pageSize));
  }

  get languages(): string[] {
    return Array.from(new Set(this.entries.map((e) => e.language))).sort();
  }

  get projects(): Array<{ id: number; name: string }> {
    return Array.from(
      new Map(this.entries.map((entry) => [entry.projectId, entry.projectName || 'Unknown Project'])).entries()
    ).map(([id, name]) => ({ id: Number(id), name }));
  }

  applyFilters(): void {
    const q = this.search.trim().toLowerCase();
    this.filtered = this.entries.filter((e) => {
      const statusOk = this.statusFilter === 'ALL' || e.status === this.statusFilter;
      const projectOk = this.projectFilter === 'ALL' || e.projectId === Number(this.projectFilter);
      const langOk = this.languageFilter === 'ALL' || e.language === this.languageFilter;
      const searchOk =
        !q ||
        e.file.toLowerCase().includes(q) ||
        e.projectName.toLowerCase().includes(q);
      return statusOk && projectOk && langOk && searchOk;
    });

    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
    const start = (this.currentPage - 1) * this.pageSize;
    this.pageEntries = this.filtered.slice(start, start + this.pageSize);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage += 1;
      this.applyFilters();
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage -= 1;
      this.applyFilters();
    }
  }

  viewOutput(entry: ExecutionHistoryEntry): void {
    this.selectedOutput = entry;
  }

  closeOutput(): void {
    this.selectedOutput = null;
  }

  rerun(entry: ExecutionHistoryEntry): void {
    this.toastService.info(`Opening project to re-run ${entry.file}.`);
    this.router.navigate(['/workspace', entry.projectId], {
      queryParams: { runFile: entry.file, autoRun: '1' }
    });
  }
}
