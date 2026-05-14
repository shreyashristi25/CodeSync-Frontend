import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminUser, AdminUserRole, AdminUserStatus, AuthService } from '../../auth';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-manage-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './manage-users.html',
  styleUrl: './manage-users.css'
})
export class ManageUsersComponent implements OnInit {
  users: AdminUser[] = [];
  filtered: AdminUser[] = [];
  pageUsers: AdminUser[] = [];

  search = '';
  roleFilter: 'all' | AdminUserRole = 'all';
  statusFilter: 'all' | AdminUserStatus = 'all';
  page = 1;
  readonly pageSize = 10;

  showInviteModal = false;
  showDeleteModal = false;
  deleteTarget: AdminUser | null = null;
  inviteEmail = '';
  inviteRole: AdminUserRole = 'DEVELOPER';
  loading = false;
  error = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      this.router.navigate(['/admin/login']);
      return;
    }
    this.reload();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filtered.length / this.pageSize));
  }

  reload(): void {
    const adminEmail = this.authService.getCurrentUser()?.email;
    if (!adminEmail) return;
    this.loading = true;
    this.error = '';
    this.authService.listAdminUsers(adminEmail).subscribe({
      next: (users) => {
        this.users = users;
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || err.error?.error || 'Failed to load users.';
      }
    });
  }

  applyFilters(): void {
    const q = this.search.trim().toLowerCase();
    this.filtered = this.users.filter((u) => {
      const roleOk = this.roleFilter === 'all' || u.role === this.roleFilter;
      const statusOk = this.statusFilter === 'all' || u.status === this.statusFilter;
      const textOk = !q || u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      return roleOk && statusOk && textOk;
    });

    if (this.page > this.totalPages) this.page = this.totalPages;
    const start = (this.page - 1) * this.pageSize;
    this.pageUsers = this.filtered.slice(start, start + this.pageSize);
  }

  nextPage(): void {
    if (this.page < this.totalPages) {
      this.page += 1;
      this.applyFilters();
    }
  }

  prevPage(): void {
    if (this.page > 1) {
      this.page -= 1;
      this.applyFilters();
    }
  }

  toggleStatus(user: AdminUser): void {
    const adminEmail = this.authService.getCurrentUser()?.email;
    if (!adminEmail) return;
    const next: AdminUserStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    this.authService.updateAdminUserStatus(user.id, next, adminEmail).subscribe({
      next: () => {
        this.toastService.info(`${user.fullName} is now ${next.toLowerCase()}.`);
        this.reload();
      },
      error: (err) => {
        this.toastService.error(err.error?.message || err.error?.error || 'Failed to update status.');
      }
    });
  }

  setRole(user: AdminUser, role: AdminUserRole): void {
    const adminEmail = this.authService.getCurrentUser()?.email;
    if (!adminEmail) return;
    this.authService.updateAdminUserRole(user.id, role, adminEmail).subscribe({
      next: () => {
        this.toastService.success(`${user.fullName} role changed to ${role.toLowerCase()}.`);
        this.reload();
      },
      error: (err) => {
        this.toastService.error(err.error?.message || err.error?.error || 'Failed to update role.');
      }
    });
  }

  openDelete(user: AdminUser): void {
    this.deleteTarget = user;
    this.showDeleteModal = true;
  }

  closeDelete(): void {
    this.showDeleteModal = false;
    this.deleteTarget = null;
  }

  confirmDelete(): void {
    if (!this.deleteTarget) return;
    const current = this.authService.getCurrentUser();
    if (current?.userId === this.deleteTarget.id) {
      this.toastService.error('You cannot delete the active admin session.');
      return;
    }
    const targetId = this.deleteTarget.id;
    const adminEmail = this.authService.getCurrentUser()?.email;
    if (!adminEmail) return;
    this.authService.deleteAdminUser(targetId, adminEmail).subscribe({
      next: () => {
        this.closeDelete();
        this.reload();
        this.toastService.warning('User deleted.');
      },
      error: (err) => {
        this.toastService.error(err.error?.message || err.error?.error || 'Failed to delete user.');
      }
    });
  }

  openInvite(): void {
    this.showInviteModal = true;
    this.inviteEmail = '';
    this.inviteRole = 'DEVELOPER';
  }

  closeInvite(): void {
    this.showInviteModal = false;
  }

  invite(): void {
    const email = this.inviteEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.toastService.error('Enter a valid email for invite.');
      return;
    }
    this.toastService.info('Invite flow is not wired to the backend yet.');
  }

  getAvatarLabel(user: AdminUser): string {
    return user.fullName.slice(0, 1).toUpperCase();
  }

  getProjectCount(): number {
    return 0;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.showInviteModal = false;
    this.closeDelete();
  }
}
