import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth';

@Component({
  selector: 'app-oauth-success',
  standalone: true,
  template: `
    <div class="oauth-processing">
      <div class="spinner"></div>
      <p class="mono">Completing authentication...</p>
    </div>
  `,
  styles: [`
    .oauth-processing {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      gap: 20px;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--cs-border);
      border-top-color: var(--cs-accent);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    p { color: var(--cs-text-secondary); font-size: 13px; }
  `]
})
export class OAuthSuccessComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    const token = this.route.snapshot.queryParams['token'];
    if (token) {
      this.authService.handleOAuthToken(token);
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/login']);
    }
  }
}