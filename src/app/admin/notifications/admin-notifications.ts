import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminUser, AuthService } from '../../auth';
import { AdminPlatformService } from '../../services/admin-platform.service';

@Component({
  selector: 'app-admin-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-notifications.html',
  styleUrl: './admin-notifications.css'
})
export class AdminNotificationsComponent implements OnInit {
  users: AdminUser[] = [];
  selectedUserIds = new Set<number>();
  mode: 'ALL' | 'TARGETED' = 'ALL';
  type = 'PLATFORM_ALERT';
  message = '';
  loading = false;
  error = '';
  success = '';

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
    this.loadUsers();
  }

  loadUsers(): void {
    const adminEmail = this.authService.getCurrentUser()?.email;
    if (!adminEmail) return;
    this.authService.listAdminUsers(adminEmail).subscribe({
      next: (users) => {
        this.users = users.filter((u) => u.status === 'ACTIVE');
      },
      error: () => {
        this.error = 'Failed to load users.';
      }
    });
  }

  toggleUser(userId: number): void {
    if (this.selectedUserIds.has(userId)) {
      this.selectedUserIds.delete(userId);
    } else {
      this.selectedUserIds.add(userId);
    }
  }

  sendNotification(): void {
    this.error = '';
    this.success = '';
    const trimmed = this.message.trim();
    if (!trimmed) {
      this.error = 'Message is required.';
      return;
    }
    let userIds: number[] = [];
    if (this.mode === 'ALL') {
      userIds = this.users.map((u) => u.id);
    } else {
      userIds = Array.from(this.selectedUserIds);
    }
    if (userIds.length === 0) {
      this.error = 'Select at least one user.';
      return;
    }
    this.loading = true;
    this.adminPlatform.broadcastNotification(userIds, this.type.trim(), trimmed).subscribe({
      next: () => {
        this.loading = false;
        this.success = 'Notification sent.';
        this.message = '';
        this.selectedUserIds.clear();
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || err.error?.error || 'Failed to send notification.';
      }
    });
  }
}
