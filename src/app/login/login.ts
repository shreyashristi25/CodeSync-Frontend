import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent implements OnInit {
  errorMessage = '';
  loading = false;
  selectedMode: string | null = null;

  authData = {
    fullName: '',
    email: '',
    password: ''
  };

  constructor(
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.selectedMode = params['mode'] || 'developer';
      if (this.selectedMode === 'admin') {
        this.router.navigate(['/admin/login']);
        return;
      }
    });
  }

  validate(): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const email = this.authData.email.trim();
    const password = this.authData.password;

    if (!emailRegex.test(email)) {
      this.errorMessage = 'Invalid email format.';
      return false;
    }
    if (!password || password.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters.';
      return false;
    }
    return true;
  }

  handleAuth() {
    this.errorMessage = '';

    if (!this.validate()) return;

    this.loading = true;
    this.errorMessage = '';

    const request = this.authService.login(this.authData.email.trim().toLowerCase(), this.authData.password);

    request.subscribe({
      next: (res) => {
        this.loading = false;
        if (res.role !== 'DEVELOPER') {
          this.authService.logout();
          this.errorMessage = 'Developer account required for this login.';
          return;
        }
        this.errorMessage = '';
        this.toastService.success('Developer session authenticated.');
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        const msg = err?.error?.message || err?.message || 'Connection failed. Please try again.';
        this.errorMessage = msg;
      }
    });
  }

  oauthLogin(provider: 'google' | 'github') {
    this.loading = true;
    window.location.href = `http://localhost:8081/oauth2/authorization/${provider}`;
  }
}