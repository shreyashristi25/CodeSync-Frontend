import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-session-warning',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="overlay" *ngIf="open">
      <section class="modal">
        <div class="mono tag">[SESSION_WARNING]</div>
        <h3>Session Timeout Pending</h3>
        <p>You will be signed out in <strong>{{ secondsLeft }}</strong> seconds due to inactivity.</p>
        <div class="actions">
          <button class="stay" (click)="stay.emit()">STAY_LOGGED_IN →</button>
          <button class="logout mono" (click)="logout.emit()">← LOGOUT_NOW</button>
        </div>
      </section>
    </div>
  `,
  styles: [
    `.overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:10030;display:grid;place-items:center;}`,
    `.modal{width:min(440px,92vw);border:1px solid var(--cs-border);background:var(--cs-surface);padding:16px;}`,
    `.tag{font-size:10px;color:var(--cs-warning);} h3{margin:8px 0 0;font-family:'JetBrains Mono',monospace;font-size:20px;} p{color:var(--cs-text-secondary);font-size:14px;} .actions{display:flex;gap:10px;margin-top:10px;} .stay{border:1px solid var(--cs-accent);background:var(--cs-accent);color:var(--cs-bg);padding:10px 12px;font-family:'JetBrains Mono',monospace;cursor:pointer;} .logout{border:1px solid var(--cs-border);background:var(--cs-surface-2);color:var(--cs-text-muted);padding:10px 12px;cursor:pointer;}`
  ]
})
export class SessionWarningComponent {
  @Input() open = false;
  @Input() secondsLeft = 60;
  @Output() stay = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();
}
