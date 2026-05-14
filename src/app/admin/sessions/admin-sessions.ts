import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../auth';
import { AdminPlatformService, AdminSessionView } from '../../services/admin-platform.service';

@Component({
  selector: 'app-admin-sessions',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-sessions.html',
  styleUrl: './admin-sessions.css'
})
export class AdminSessionsComponent implements OnInit {
  sessions: AdminSessionView[] = [];
  loading = false;
  error = '';

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
    this.loadSessions();
  }

  loadSessions(): void {
    this.loading = true;
    this.error = '';
    this.adminPlatform.listSessions().subscribe({
      next: (sessions) => {
        this.sessions = sessions;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || err.error?.error || 'Failed to load sessions.';
      }
    });
  }

  endSession(session: AdminSessionView): void {
    this.adminPlatform.endSession(session.sessionId).subscribe({
      next: () => {
        this.sessions = this.sessions.filter((s) => s.sessionId !== session.sessionId);
      },
      error: (err) => {
        this.error = err.error?.message || err.error?.error || 'Failed to end session.';
      }
    });
  }
}
