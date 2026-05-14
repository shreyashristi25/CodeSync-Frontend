import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth';
import { AppStateService, AppUser, AppProject } from '../services/app-state.service';
import { ToastService } from '../services/toast.service';
import { NotificationBellComponent } from '../components/notification-bell/notification-bell';
import { ProjectService } from '../services/project.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NotificationBellComponent],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class ProfileComponent implements OnInit {
  user: AppUser | null = null;
  avatarPickerOpen = false;
  avatarOptions = [
    'https://api.dicebear.com/9.x/lorelei/svg?seed=Felix&backgroundColor=ffab40',
    'https://api.dicebear.com/9.x/lorelei/svg?seed=Luna&backgroundColor=ab47bc',
    'https://api.dicebear.com/9.x/lorelei/svg?seed=Chloe&backgroundColor=42a5f5',
    'https://api.dicebear.com/9.x/lorelei/svg?seed=Sophie&backgroundColor=66bb6a',
    'https://api.dicebear.com/9.x/lorelei/svg?seed=Emma&backgroundColor=ec407a',
    'https://api.dicebear.com/9.x/lorelei/svg?seed=Olivia&backgroundColor=26c6da',
    'https://api.dicebear.com/9.x/lorelei/svg?seed=Ava&backgroundColor=ffa726',
    'https://api.dicebear.com/9.x/lorelei/svg?seed=Isabella&backgroundColor=7e57c2',
    'https://api.dicebear.com/9.x/lorelei/svg?seed=Mia&backgroundColor=5c6bc0',
    'https://api.dicebear.com/9.x/lorelei/svg?seed=Charlotte&backgroundColor=ef5350',
    'https://api.dicebear.com/9.x/lorelei/svg?seed=Amelia&backgroundColor=29b6f6',
    'https://api.dicebear.com/9.x/lorelei/svg?seed=Harper&backgroundColor=9ccc65',
    'https://api.dicebear.com/9.x/lorelei/svg?seed=Evelyn&backgroundColor=ff7043',
    'https://api.dicebear.com/9.x/lorelei/svg?seed=Abigail&backgroundColor=8d6e63',
    'https://api.dicebear.com/9.x/lorelei/svg?seed=Emily&backgroundColor=78909c',
    'https://api.dicebear.com/9.x/lorelei/svg?seed=Elizabeth&backgroundColor=aed581'
  ];

  private readonly AVATAR_KEY = 'codesync_user_avatar';
  name = '';
  bio = '';

  currentPassword = '';
  nextPassword = '';
  confirmPassword = '';

  stats = { projects: 0, fileEdits: 0, executions: 0, joined: '' };

  constructor(
    private authService: AuthService,
    private appState: AppStateService,
    private router: Router,
    private toastService: ToastService,
    private projectService: ProjectService
  ) {}

  ngOnInit(): void {
    const session = this.authService.getCurrentUser();
    if (!session) {
      this.router.navigate(['/']);
      return;
    }

    this.user = this.appState.getCurrentUser();
    if (!this.user) {
      this.user = this.appState.getUsers().find((u) => u.id === session.userId) || null;
    }
    
    if (!this.user) {
      this.user = {
        id: session.userId,
        name: session.fullName,
        email: session.email,
        role: session.role as 'guest' | 'developer' | 'admin',
        password: '',
        status: 'active',
        joined: new Date().toISOString()
      };
    }

    const savedAvatar = localStorage.getItem(this.AVATAR_KEY);
    if (savedAvatar) {
      this.user.avatar = savedAvatar;
    } else if (!this.user.avatar) {
      this.user.avatar = this.avatarOptions[0];
    }

    this.name = this.user.name;
    this.bio = this.user.bio || '';

    const seedProjects = this.appState.projects$.value.filter((p) => p.ownerId === this.user!.id);
    
    this.projectService.getUserProjects(session.userId).subscribe({
      next: (backendProjects) => {
        const backendMapped = backendProjects.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          ownerId: p.ownerId,
          language: (p.language || 'TypeScript') as AppProject['language'],
          visibility: p.isPublic ? 'PUBLIC' as const : 'PRIVATE' as const,
          createdAt: p.createdAt,
          updatedAt: p.createdAt,
          collaborators: []
        }));
        
        const allProjects = [...seedProjects, ...backendMapped];
        const projectIds = new Set(allProjects.map((p) => p.id));
        const fileEdits = this.appState.getExecutionHistory().filter((e) => projectIds.has(e.projectId)).length;
        
        this.stats = {
          projects: allProjects.length,
          fileEdits,
          executions: fileEdits,
          joined: this.user!.joined
        };
      },
      error: () => {
        const projectIds = new Set(seedProjects.map((p) => p.id));
        const fileEdits = this.appState.getExecutionHistory().filter((e) => projectIds.has(e.projectId)).length;
        this.stats = {
          projects: seedProjects.length,
          fileEdits,
          executions: fileEdits,
          joined: this.user!.joined
        };
      }
    });
  }

  saveProfile(): void {
    if (!this.user) return;
    if (!this.name.trim()) {
      this.toastService.error('Display name is required.');
      return;
    }
    this.appState.updateUser(this.user.id, { name: this.name.trim(), bio: this.bio.trim() });
    this.user = this.appState.getUsers().find((u) => u.id === this.user!.id) || this.user;
    this.toastService.success('Profile updated.');
  }

  setAvatar(avatar: string): void {
    if (!this.user) return;
    this.user.avatar = avatar;
    localStorage.setItem(this.AVATAR_KEY, avatar);
    this.appState.updateUser(this.user.id, { avatar });
    this.user = this.appState.getUsers().find((u) => u.id === this.user!.id) || this.user;
    this.avatarPickerOpen = false;
  }

  toggleAvatarPicker(): void {
    this.avatarPickerOpen = !this.avatarPickerOpen;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.avatarPickerOpen = false;
  }

  changePassword(): void {
    if (!this.user) return;
    if (!this.currentPassword || !this.nextPassword || !this.confirmPassword) {
      this.toastService.error('Fill all password fields.');
      return;
    }
    if (this.currentPassword !== this.user.password) {
      this.toastService.error('Current password is incorrect.');
      return;
    }
    if (this.nextPassword.length < 8) {
      this.toastService.error('New password must be at least 8 characters.');
      return;
    }
    if (this.nextPassword !== this.confirmPassword) {
      this.toastService.error('New password confirmation does not match.');
      return;
    }

    this.appState.updateUser(this.user.id, { password: this.nextPassword });
    this.currentPassword = '';
    this.nextPassword = '';
    this.confirmPassword = '';
    this.toastService.success('Password changed successfully.');
  }
}
