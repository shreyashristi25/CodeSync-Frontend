import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LucideAngularModule, Activity, FolderGit2, Terminal, User, Bell, LogOut } from 'lucide-angular';

import { AuthService } from '../auth';
import { Notification, NotificationService } from '../services/notification.service';
import { NotificationBellComponent } from '../components/notification-bell/notification-bell';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    LucideAngularModule,
    NotificationBellComponent
  ],
  templateUrl: './notifications.html',
  styleUrl: './notifications.css'
})
export class NotificationsComponent implements OnInit, OnDestroy {
  readonly icons = { Activity, FolderGit2, Terminal, User, Bell, LogOut };

  notifications: Notification[] = [];
  filtered: Notification[] = [];
  unreadCount = 0;
  filter: 'all' | 'unread' = 'all';
  search = '';
  loading = false;
  error: string | null = null;

  private userId: number | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (!user || user.role === 'GUEST') {
      this.router.navigate(['/']);
      return;
    }

    this.userId = user.userId;
    this.notificationService.connectWebSocket(user.userId);

    this.notificationService.unreadCount$
      .pipe(takeUntil(this.destroy$))
      .subscribe((count) => {
        this.unreadCount = count;
      });

    this.loadNotifications();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.notificationService.disconnectWebSocket();
  }

  refresh(): void {
    this.loadNotifications();
  }

  setFilter(filter: 'all' | 'unread'): void {
    this.filter = filter;
    this.applyFilters();
  }

  applyFilters(): void {
    const query = this.search.trim().toLowerCase();
    this.filtered = this.notifications.filter((notification) => {
      const statusOk = this.filter === 'all' || !notification.isRead;
      const queryOk =
        !query ||
        notification.type.toLowerCase().includes(query) ||
        notification.message.toLowerCase().includes(query);
      return statusOk && queryOk;
    });
  }

  markAsRead(notification: Notification): void {
    if (notification.isRead) return;
    this.notificationService.markAsRead(notification.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        notification.isRead = true;
        this.unreadCount = Math.max(0, this.unreadCount - 1);
        this.applyFilters();
      });
  }

  deleteNotification(notification: Notification): void {
    this.notificationService.deleteNotification(notification.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.notifications = this.notifications.filter((item) => item.id !== notification.id);
        this.applyFilters();
      });
  }

  private loadNotifications(): void {
    if (!this.userId) return;
    this.loading = true;
    this.error = null;
    this.notificationService.getNotifications(this.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (notifications) => {
          this.notifications = notifications;
          this.applyFilters();
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.error = 'Failed to load notifications.';
        }
      });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
