import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface RoleOption {
  key: 'guest' | 'developer' | 'admin';
  title: string;
  description: string;
}

@Component({
  selector: 'app-role-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './role-sidebar.html',
  styleUrl: './role-sidebar.css'
})
export class RoleSidebarComponent {
  @Input() themeMode: 'dark' | 'light' = 'dark';
  @Input() selectedRole: 'guest' | 'developer' | 'admin' | null = null;
  @Input() options: RoleOption[] = [];

  @Output() roleSelected = new EventEmitter<'guest' | 'developer' | 'admin'>();

  onRoleSelect(role: 'guest' | 'developer' | 'admin'): void {
    this.roleSelected.emit(role);
  }
}
