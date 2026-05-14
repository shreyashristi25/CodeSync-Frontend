import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../auth';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-login.html',
  styleUrl: './admin-login.css'
})
export class AdminLoginComponent {
  loading = false;
  errorMessage = '';
  email = '';
  password = '';
  requestEmail = '';
  requestPassword = '';
  requestMessage = '';
  requestError = '';
  requestLoading = false;
  
  devEmail = '';
  devName = '';
  devPassword = '';
  devMessage = '';
  devError = '';
  devLoading = false;

  constructor(private authService: AuthService, private router: Router) {}

  submit(): void {
    this.errorMessage = '';
    this.loading = true;

    this.authService.login(this.email, this.password).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.role !== 'ADMIN') {
          this.authService.logout();
          this.errorMessage = 'Admin account required for this portal.';
          return;
        }
        this.router.navigate(['/admin']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.message || 'Admin login failed.';
      }
    });
  }

  submitAdminRequest(): void {
    this.requestMessage = '';
    this.requestError = '';
    this.requestLoading = true;

    this.authService.requestAdminAccess(this.requestEmail.trim().toLowerCase(), this.requestPassword)
      .subscribe({
        next: () => {
          this.requestLoading = false;
          this.requestMessage = 'Admin access request submitted. You will be notified after review.';
          this.requestEmail = '';
          this.requestPassword = '';
        },
        error: (err) => {
          this.requestLoading = false;
          this.requestError = err.error?.message || err.error?.error || 'Request failed.';
        }
      });
  }

  createDevAdmin(): void {
    if (!this.devEmail || !this.devName || !this.devPassword) {
      this.devError = 'All fields are required';
      return;
    }
    this.devLoading = true;
    this.devError = '';
    this.devMessage = '';
    
    this.authService.createDevAdmin(this.devEmail.trim().toLowerCase(), this.devName, this.devPassword)
      .subscribe({
        next: (response) => {
          this.devLoading = false;
          this.devMessage = 'Admin created! You can now login.';
          this.devEmail = '';
          this.devName = '';
          this.devPassword = '';
        },
        error: (err) => {
          this.devLoading = false;
          this.devError = err.error?.message || err.error?.error || 'Failed to create admin';
        }
      });
  }
}
