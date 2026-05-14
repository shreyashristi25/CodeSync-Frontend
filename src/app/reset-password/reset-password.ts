import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../auth';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <h2>Reset Password</h2>
        
        @if (invalidToken) {
          <div class="error-message">
            <p>Invalid or expired reset link.</p>
            <a routerLink="/forgot-password">Request new link</a>
          </div>
        } @else {
          <form (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label for="password">New Password</label>
              <input 
                type="password" 
                id="password" 
                [(ngModel)]="password" 
                name="password"
                required
                minlength="6"
                placeholder="Enter new password"
              >
            </div>
            
            <div class="form-group">
              <label for="confirmPassword">Confirm Password</label>
              <input 
                type="password" 
                id="confirmPassword" 
                [(ngModel)]="confirmPassword" 
                name="confirmPassword"
                required
                placeholder="Confirm new password"
              >
            </div>
            
            <button type="submit" class="btn-primary" [disabled]="loading">
              {{ loading ? 'Resetting...' : 'Reset Password' }}
            </button>
          </form>
        }
        
        <div class="links">
          <a routerLink="/login">Back to Login</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      padding: 20px;
    }
    .auth-card {
      background: white;
      border-radius: 12px;
      padding: 40px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    }
    h2 {
      margin: 0 0 24px;
      color: #1a1a2e;
      font-size: 28px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      color: #333;
      font-weight: 500;
    }
    input {
      width: 100%;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 14px;
      box-sizing: border-box;
    }
    input:focus {
      outline: none;
      border-color: #2563eb;
    }
    .btn-primary {
      width: 100%;
      padding: 14px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-primary:hover:not(:disabled) {
      background: #1d4ed8;
    }
    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .error-message {
      text-align: center;
      padding: 20px;
      color: #dc2626;
    }
    .error-message a {
      color: #2563eb;
    }
    .links {
      margin-top: 20px;
      text-align: center;
    }
    .links a {
      color: #2563eb;
      text-decoration: none;
    }
  `]
})
export class ResetPasswordComponent implements OnInit {
  email = '';
  token = '';
  password = '';
  confirmPassword = '';
  loading = false;
  invalidToken = false;

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private toast: ToastService,
    private router: Router
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.email = params['email'] || '';
      this.token = params['token'] || '';
      if (!this.email || !this.token) {
        this.invalidToken = true;
      }
    });
  }

  onSubmit() {
    if (this.password !== this.confirmPassword) {
      this.toast.error('Passwords do not match');
      return;
    }
    if (this.password.length < 6) {
      this.toast.error('Password must be at least 6 characters');
      return;
    }
    this.loading = true;
    this.authService.resetPassword(this.email, this.token, this.password).subscribe({
      next: () => {
        this.toast.success('Password reset successful');
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.loading = false;
        this.toast.error(err.error || 'Password reset failed');
      }
    });
  }
}