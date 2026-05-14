import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../auth';
import { AdminPlatformService, SupportedLanguage } from '../../services/admin-platform.service';

@Component({
  selector: 'app-admin-languages',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-languages.html',
  styleUrl: './admin-languages.css'
})
export class AdminLanguagesComponent implements OnInit {
  languages: SupportedLanguage[] = [];
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
    this.loadLanguages();
  }

  loadLanguages(): void {
    this.loading = true;
    this.error = '';
    this.adminPlatform.listSupportedLanguages().subscribe({
      next: (languages) => {
        this.languages = languages;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || err.error?.error || 'Failed to load languages.';
      }
    });
  }

  saveLanguage(language: SupportedLanguage): void {
    this.adminPlatform.updateSupportedLanguage(language.id, language.displayName, language.enabled).subscribe({
      next: (updated) => {
        this.languages = this.languages.map((item) => item.id === updated.id ? updated : item);
      },
      error: (err) => {
        this.error = err.error?.message || err.error?.error || 'Failed to update language.';
      }
    });
  }
}
