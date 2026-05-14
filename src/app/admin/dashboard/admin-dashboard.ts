import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminAccessRequest, AuthService } from '../../auth';
import { AdminPlatformService } from '../../services/admin-platform.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  activeUsers = 0;
  latencyMs = 0;
  pendingRequests: AdminAccessRequest[] = [];
  requestsLoading = false;
  requestsError = '';
  showRequests = false;
  private loadTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    public authService: AuthService, 
    private router: Router,
    private adminPlatform: AdminPlatformService
  ) {}

  ngOnInit(): void {
    this.loadRealStats();
    this.loadTimer = setInterval(() => this.loadRealStats(), 5000);
  }

  ngOnDestroy(): void {
    if (this.loadTimer) {
      clearInterval(this.loadTimer);
    }
  }

  toggleRequests(): void {
    this.showRequests = !this.showRequests;
    if (this.showRequests) {
      this.loadAdminRequests();
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  private loadRealStats(): void {
    this.adminPlatform.getActiveUserCount().subscribe({
      next: (count) => { this.activeUsers = count; }
    });
    this.adminPlatform.getSystemLatency().subscribe({
      next: (latency) => { this.latencyMs = latency; }
    });
  }

  loadAdminRequests(): void {
    const adminEmail = this.authService.getCurrentUser()?.email;
    if (!adminEmail) return;
    this.requestsLoading = true;
    this.requestsError = '';
    this.authService.listAdminAccessRequests('PENDING', adminEmail).subscribe({
      next: (requests) => {
        this.pendingRequests = requests;
        this.requestsLoading = false;
      },
      error: (err) => {
        this.requestsLoading = false;
        this.requestsError = err.error?.message || err.error?.error || 'Failed to load admin requests.';
      }
    });
  }

  approveRequest(request: AdminAccessRequest): void {
    const adminEmail = this.authService.getCurrentUser()?.email;
    if (!adminEmail) return;
    this.authService.approveAdminAccessRequest(request.id, adminEmail).subscribe({
      next: () => {
        this.pendingRequests = this.pendingRequests.filter((item) => item.id !== request.id);
      },
      error: (err) => {
        this.requestsError = err.error?.message || err.error?.error || 'Failed to approve request.';
      }
    });
  }

  denyRequest(request: AdminAccessRequest): void {
    const adminEmail = this.authService.getCurrentUser()?.email;
    if (!adminEmail) return;
    this.authService.denyAdminAccessRequest(request.id, adminEmail).subscribe({
      next: () => {
        this.pendingRequests = this.pendingRequests.filter((item) => item.id !== request.id);
      },
      error: (err) => {
        this.requestsError = err.error?.message || err.error?.error || 'Failed to deny request.';
      }
    });
  }
}
