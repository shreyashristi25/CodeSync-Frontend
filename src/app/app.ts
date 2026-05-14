import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import { Subscription } from 'rxjs';
import { ToastCenterComponent } from './components/toast-center/toast-center';
import { SessionWarningComponent } from './components/session-warning/session-warning';
import { AuthService } from './auth';
import { SessionTimeoutService } from './services/session-timeout.service';
import { ToastService } from './services/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastCenterComponent, SessionWarningComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  animations: [
    trigger('routeAnimations', [
      transition('* <=> *', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('400ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'CodeSync';
  warningOpen = false;
  countdown = 60;

  getRouteAnimationData(outlet: RouterOutlet) {
    return outlet && outlet.activatedRouteData && outlet.isActivated ? outlet.activatedRoute : '';
  }

  private sub = new Subscription();

  constructor(
    private authService: AuthService,
    private sessionTimeoutService: SessionTimeoutService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.sub.add(this.sessionTimeoutService.warningOpen$.subscribe((open) => (this.warningOpen = open)));
    this.sub.add(this.sessionTimeoutService.countdownSeconds$.subscribe((seconds) => (this.countdown = seconds)));

    this.sub.add(
      this.authService.currentUser$.subscribe((user) => {
        if (user && user.role !== 'GUEST') {
          this.sessionTimeoutService.start(() => {
            this.authService.logout();
            this.toastService.warning('Session timed out. Please sign in again.');
          });
        } else {
          this.sessionTimeoutService.stop();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.sessionTimeoutService.stop();
  }

  @HostListener('document:mousemove')
  @HostListener('document:keydown')
  @HostListener('document:click')
  @HostListener('document:scroll')
  onActivity(): void {
    this.sessionTimeoutService.registerActivity();
  }

  stayLoggedIn(): void {
    this.sessionTimeoutService.stayLoggedIn();
  }

  logoutNow(): void {
    this.sessionTimeoutService.forceTimeout();
  }
}