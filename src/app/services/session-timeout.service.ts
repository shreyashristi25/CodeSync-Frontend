import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SessionTimeoutService implements OnDestroy {
  readonly warningOpen$ = new BehaviorSubject<boolean>(false);
  readonly countdownSeconds$ = new BehaviorSubject<number>(60);

  private readonly idleMs = 30 * 60 * 1000;
  private readonly warningMs = 60 * 1000;
  private lastActivityAt = Date.now();
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private timeoutCallback: (() => void) | null = null;

  start(onTimeout: () => void): void {
    this.timeoutCallback = onTimeout;
    this.lastActivityAt = Date.now();
    this.stopInternalTimers();

    this.checkTimer = setInterval(() => {
      const idleFor = Date.now() - this.lastActivityAt;
      if (idleFor >= this.idleMs && !this.warningOpen$.value) {
        this.openWarning();
      }
    }, 1000);
  }

  stop(): void {
    this.warningOpen$.next(false);
    this.stopInternalTimers();
  }

  registerActivity(): void {
    this.lastActivityAt = Date.now();
    if (this.warningOpen$.value) {
      this.stayLoggedIn();
    }
  }

  stayLoggedIn(): void {
    this.warningOpen$.next(false);
    this.countdownSeconds$.next(60);
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.lastActivityAt = Date.now();
  }

  forceTimeout(): void {
    this.warningOpen$.next(false);
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.timeoutCallback) {
      this.timeoutCallback();
    }
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private openWarning(): void {
    this.warningOpen$.next(true);
    this.countdownSeconds$.next(60);

    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }

    this.countdownTimer = setInterval(() => {
      const next = this.countdownSeconds$.value - 1;
      this.countdownSeconds$.next(next);
      if (next <= 0) {
        this.forceTimeout();
      }
    }, 1000);

    setTimeout(() => {
      if (this.warningOpen$.value) {
        this.forceTimeout();
      }
    }, this.warningMs);
  }

  private stopInternalTimers(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }
}
