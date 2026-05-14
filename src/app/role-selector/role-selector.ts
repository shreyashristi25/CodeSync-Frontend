import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth';
import { RoleOption } from './role-sidebar/role-sidebar';
import { LucideAngularModule, Eye, Terminal, Shield, Moon, Sun } from 'lucide-angular';

@Component({
  selector: 'app-role-selector',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './role-selector.html',
  styleUrl: './role-selector.css'
})
export class RoleSelectorComponent implements OnInit, OnDestroy {
  readonly EyeIcon = Eye;
  readonly TerminalIcon = Terminal;
  readonly ShieldIcon = Shield;
  readonly MoonIcon = Moon;
  readonly SunIcon = Sun;

  readonly words = ['Faster', 'Smarter', 'Better', 'Together'];
  readonly roleOptions: RoleOption[] = [
    {
      key: 'guest',
      title: 'Guest',
      description: 'Explore public projects'
    },
    {
      key: 'developer',
      title: 'Developer',
      description: 'Create and collaborate'
    },
    {
      key: 'admin',
      title: 'Admin',
      description: 'Manage platform'
    }
  ];

  displayedWord = '';
  selectedRole: 'guest' | 'developer' | 'admin' | null = null;
  themeMode: 'dark' | 'light' = 'dark';

  private wordIndex = 0;
  private charIndex = 0;
  private deleting = false;
  private timerHandle: ReturnType<typeof setTimeout> | null = null;

  constructor(private router: Router, private authService: AuthService) { }

  ngOnInit(): void {
    const savedTheme = localStorage.getItem('cs-theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      this.themeMode = savedTheme;
    }
    this.runTypingLoop();
  }

  ngOnDestroy(): void {
    if (this.timerHandle) {
      clearTimeout(this.timerHandle);
    }
  }

  selectMode(mode: string) {
    this.selectedRole = mode as 'guest' | 'developer' | 'admin';
    if (mode === 'guest') {
      this.authService.loginAsGuest();
      this.router.navigate(['/guest-dashboard']);
    } else if (mode === 'developer') {
      this.authService.logout();
      this.router.navigate(['/auth/login'], { queryParams: { mode: 'developer' } });
    } else if (mode === 'admin') {
      this.authService.logout();
      this.router.navigate(['/admin/login']);
    }
  }

  toggleTheme(): void {
    const root = document.documentElement;
    const isDark = root.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('cs-theme', next);
    this.themeMode = next;
  }

  getThemeLabel(): string {
    return this.themeMode === 'dark' ? 'DARK' : 'LIGHT';
  }

  private runTypingLoop(): void {
    const currentWord = this.words[this.wordIndex];

    if (!this.deleting) {
      this.charIndex += 1;
      this.displayedWord = currentWord.slice(0, this.charIndex);

      if (this.charIndex >= currentWord.length) {
        this.deleting = true;
        this.scheduleNextTick(1000);
        return;
      }

      this.scheduleNextTick(95);
      return;
    }

    this.charIndex -= 1;
    this.displayedWord = currentWord.slice(0, Math.max(this.charIndex, 0));

    if (this.charIndex <= 0) {
      this.deleting = false;
      this.wordIndex = (this.wordIndex + 1) % this.words.length;
      this.scheduleNextTick(240);
      return;
    }

    this.scheduleNextTick(60);
  }

  private scheduleNextTick(delayMs: number): void {
    this.timerHandle = setTimeout(() => this.runTypingLoop(), delayMs);
  }
}