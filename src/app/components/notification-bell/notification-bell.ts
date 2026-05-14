import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Notification, NotificationService } from '../../services/notification.service';
import { AuthService } from '../../auth';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="cs-notification-bell">
      <button class="cs-bell-button" type="button" (click)="togglePanel()" aria-label="Open notifications">
        <span class="cs-bell-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18h6"></path>
            <path d="M6.6 9.6a5.4 5.4 0 1 1 10.8 0v4.6l1.4 2.2H5.2l1.4-2.2z"></path>
          </svg>
        </span>
        <span class="cs-bell-badge" *ngIf="unreadCount > 0">{{ unreadCount }}</span>
      </button>
      <div class="cs-bell-panel" *ngIf="isPanelOpen">
        <div class="cs-bell-header">
          <div>
            <div class="cs-bell-title">Notifications</div>
            <div class="cs-bell-subtitle">{{ unreadCount }} unread</div>
          </div>
          <div class="cs-bell-actions">
            <a class="cs-bell-link" routerLink="/notifications" (click)="closePanel()">View all</a>
            <button class="cs-bell-close" type="button" (click)="togglePanel()">Close</button>
          </div>
        </div>
        <div class="cs-bell-list">
          <div *ngIf="unreadNotifications.length === 0" class="cs-bell-empty">
            No new notifications
          </div>
          <button
            *ngFor="let notification of unreadNotifications"
            class="cs-bell-item"
            type="button"
            (click)="markAsRead(notification.id)">
            <div class="cs-bell-item-meta">{{ notification.type }}</div>
            <div class="cs-bell-item-message">{{ notification.message }}</div>
            <div class="cs-bell-item-time">{{ formatTime(notification.createdAt) }}</div>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
    }

    .cs-notification-bell {
      position: relative;
      display: inline-flex;
      align-items: center;
    }

    .cs-bell-button {
      border: 1px solid var(--cs-border);
      background: var(--cs-surface-2);
      color: var(--cs-text-primary);
      padding: 6px 8px;
      border-radius: 10px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      position: relative;
      transition: border-color 0.15s ease, transform 0.15s ease;
    }

    .cs-bell-button:hover {
      border-color: var(--cs-accent);
      transform: translateY(-1px);
    }

    .cs-bell-icon {
      width: 18px;
      height: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .cs-bell-icon svg {
      width: 18px;
      height: 18px;
    }

    .cs-bell-badge {
      position: absolute;
      top: -6px;
      right: -6px;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      border-radius: 999px;
      background: var(--cs-error);
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 2px solid var(--cs-surface);
    }

    .cs-bell-panel {
      position: absolute;
      top: 44px;
      right: 0;
      width: 360px;
      max-height: 420px;
      background: var(--cs-surface);
      border: 1px solid var(--cs-border);
      border-radius: 14px;
      box-shadow: var(--cs-shadow);
      display: flex;
      flex-direction: column;
      z-index: 1200;
      overflow: hidden;
    }

    .cs-bell-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      border-bottom: 1px solid var(--cs-border);
      background: var(--cs-surface-2);
    }

    .cs-bell-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--cs-text-primary);
    }

    .cs-bell-subtitle {
      font-size: 11px;
      color: var(--cs-text-muted);
      margin-top: 2px;
    }

    .cs-bell-actions {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-size: 11px;
    }

    .cs-bell-link {
      color: var(--cs-accent);
      text-decoration: none;
      font-weight: 600;
    }

    .cs-bell-close {
      border: none;
      background: transparent;
      color: var(--cs-text-secondary);
      font-size: 11px;
      cursor: pointer;
      padding: 0;
    }

    .cs-bell-list {
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }

    .cs-bell-empty {
      padding: 24px 16px;
      text-align: center;
      color: var(--cs-text-muted);
      font-size: 12px;
    }

    .cs-bell-item {
      text-align: left;
      padding: 12px 14px;
      border-bottom: 1px solid var(--cs-border);
      background: transparent;
      cursor: pointer;
      color: inherit;
    }

    .cs-bell-item:hover {
      background: var(--cs-surface-2);
    }

    .cs-bell-item-meta {
      font-size: 10px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--cs-text-muted);
    }

    .cs-bell-item-message {
      font-size: 13px;
      color: var(--cs-text-primary);
      margin-top: 4px;
    }

    .cs-bell-item-time {
      font-size: 11px;
      color: var(--cs-text-muted);
      margin-top: 6px;
    }
  `]
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  unreadCount = 0;
  unreadNotifications: Notification[] = [];
  isPanelOpen = false;
  private destroy$ = new Subject<void>();
  private userId: number | null = null;

  constructor(
    private notificationService: NotificationService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.userId = user.userId;
      this.notificationService.connectWebSocket(user.userId);
      
      this.notificationService.unreadCount$
        .pipe(takeUntil(this.destroy$))
        .subscribe(count => {
          this.unreadCount = count;
        });

      this.loadUnread();
    }
  }

  togglePanel(): void {
    this.isPanelOpen = !this.isPanelOpen;
    if (this.isPanelOpen) {
      this.loadUnread();
    }
  }

  closePanel(): void {
    this.isPanelOpen = false;
  }

  private loadUnread(): void {
    if (!this.userId) return;
    this.notificationService.getUnreadNotifications(this.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(notifications => {
        this.unreadNotifications = notifications;
      });
  }

  markAsRead(id: number): void {
    this.notificationService.markAsRead(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.unreadNotifications = this.unreadNotifications.filter(n => n.id !== id);
        this.unreadCount = Math.max(0, this.unreadCount - 1);
      });
  }

  formatTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.notificationService.disconnectWebSocket();
  }
}
