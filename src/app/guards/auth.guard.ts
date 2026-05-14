import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../auth';

@Injectable({
  providedIn: 'root'
})
export class DeveloperGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean {
    const user = this.authService.getCurrentUser();
    if (user && user.role === 'DEVELOPER') {
      return true;
    }

    this.router.navigate(['/']);
    return false;
  }
}

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean {
    const user = this.authService.getCurrentUser();
    if (user && user.role === 'ADMIN') {
      return true;
    }

    this.router.navigate(['/admin/login']);
    return false;
  }
}

@Injectable({
  providedIn: 'root'
})
export class GuestModeGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.authService.loginAsGuest();
      return true;
    }

    if (user.role === 'GUEST') {
      return true;
    }

    if (user.role === 'ADMIN') {
      this.router.navigate(['/admin']);
      return false;
    }

    this.router.navigate(['/dashboard']);
    return false;
  }
}
