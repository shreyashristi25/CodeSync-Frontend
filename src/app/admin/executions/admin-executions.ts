import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../auth';
import { AdminPlatformService, ExecutionJobView, JobStatus } from '../../services/admin-platform.service';

@Component({
  selector: 'app-admin-executions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-executions.html',
  styleUrl: './admin-executions.css'
})
export class AdminExecutionsComponent implements OnInit {
  jobs: ExecutionJobView[] = [];
  loading = false;
  error = '';
  statusFilter: 'ALL' | JobStatus = 'ALL';

  constructor(
    private authService: AuthService,
    private adminPlatform: AdminPlatformService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      this.router.navigate(['/admin/login']);
      return;
    }
    this.loadJobs();
  }

  loadJobs(): void {
    this.loading = true;
    this.error = '';
    const status = this.statusFilter === 'ALL' ? undefined : this.statusFilter;
    this.adminPlatform.listExecutionJobs(status).subscribe({
      next: (jobs) => {
        this.jobs = jobs;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || err.error?.error || 'Failed to load execution jobs.';
      }
    });
  }

  cancelJob(job: ExecutionJobView): void {
    this.adminPlatform.cancelExecutionJob(job.jobId).subscribe({
      next: (updated) => {
        this.jobs = this.jobs.map((j) => (j.jobId === updated.jobId ? updated : j));
      },
      error: (err) => {
        this.error = err.error?.message || err.error?.error || 'Failed to cancel job.';
      }
    });
  }
}
