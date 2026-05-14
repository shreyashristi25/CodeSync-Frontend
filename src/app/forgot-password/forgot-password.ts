import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../auth';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <h2>Forgot Password</h2>
        <p class="subtitle">Enter your email to receive a reset link</p>
        
        @if (!emailSent) {
          <form (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label for="email">Email</label>
              <input 
                type="email" 
                id="email" 
                [(ngModel)]="email" 
                name="email"
                required
                placeholder="Enter your email"
              >
            </div>
            
            <button type="submit" class="btn-primary" [disabled]="loading">
              {{ loading ? 'Sending...' : 'Send Reset Link' }}
            </button>
          </form>
        } @else {
          <div class="success-message">
            <p>If an account exists with this email, a reset link has been sent.</p>
            <button class="btn-secondary" (click)="emailSent = false">Send Again</button>
          </div>
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
      margin: 0 0 8px;
      color: #1a1a2e;
      font-size: 28px;
    }
    .subtitle {
      color: #666;
      margin-bottom: 24px;
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
    .btn-secondary {
      padding: 12px 24px;
      background: #f3f4f6;
      color: #333;
      border: 1px solid #ddd;
      border-radius: 8px;
      cursor: pointer;
    }
    .success-message {
      text-align: center;
      padding: 20px;
    }
    .success-message p {
      color: #059669;
      margin-bottom: 16px;
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
export class ForgotPasswordComponent {
  email = '';
  loading = false;
  emailSent = false;

  constructor(
    private authService: AuthService,
    private toast: ToastService,
    private router: Router
  ) {}

  onSubmit() {
    if (!this.email) {
      this.toast.error('Please enter your email');
      return;
    }
    this.loading = true;
    this.authService.forgotPassword(this.email).subscribe({
      next: () => {
        this.emailSent = true;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }
}