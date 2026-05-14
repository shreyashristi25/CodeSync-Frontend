import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class RegisterComponent {
  loading = false;

  form = {
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  };

  errors: Record<string, string> = {
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  };

  constructor(private authService: AuthService, private router: Router, private toastService: ToastService) {}

  get passwordStrength(): 'Weak' | 'Medium' | 'Strong' {
    const p = this.form.password;
    let score = 0;
    if (p.length >= 8) score += 1;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score += 1;
    if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) score += 1;
    if (score <= 1) return 'Weak';
    if (score === 2) return 'Medium';
    return 'Strong';
  }

  get strengthValue(): number {
    return this.passwordStrength === 'Weak' ? 33 : this.passwordStrength === 'Medium' ? 66 : 100;
  }

  submit(): void {
    if (!this.validate()) {
      return;
    }

    this.loading = true;
    this.authService.register(this.form.email.trim().toLowerCase(), this.form.fullName.trim(), this.form.password).subscribe({
      next: () => {
        this.loading = false;
        this.toastService.success('Account created. Please sign in with your new credentials.');
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.loading = false;
        this.toastService.error(err?.error?.message || 'Registration failed.');
      }
    });
  }

  private validate(): boolean {
    this.errors = { fullName: '', email: '', password: '', confirmPassword: '' };
    let ok = true;

    if (!this.form.fullName.trim() || this.form.fullName.trim().length < 2) {
      this.errors['fullName'] = 'Full name must be at least 2 characters.';
      ok = false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email)) {
      this.errors['email'] = 'Enter a valid email address.';
      ok = false;
    }

    if (this.form.password.length < 6) {
      this.errors['password'] = 'Password must be at least 6 characters.';
      ok = false;
    }

    if (this.form.confirmPassword !== this.form.password) {
      this.errors['confirmPassword'] = 'Passwords do not match.';
      ok = false;
    }

    return ok;
  }

  oauthSignup(provider: 'google' | 'github') {
    this.loading = true;
    window.location.href = `http://localhost:8081/oauth2/authorization/${provider}`;
  }
}
