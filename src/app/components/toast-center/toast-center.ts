import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast-center',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-wrap">
      <article class="toast-item" *ngFor="let toast of toastService.toasts$ | async" [class]="'toast-item ' + toast.type">
        <header class="toast-head mono">{{ toast.title || toast.type.toUpperCase() }}</header>
        <p class="toast-body">{{ toast.message }}</p>
        <button class="toast-close mono" (click)="toastService.dismiss(toast.id)">X</button>
      </article>
    </div>
  `,
  styles: [
    `.toast-wrap{position:fixed;top:48px;right:16px;z-index:10020;display:grid;gap:8px;width:320px;}`,
    `.toast-item{position:relative;border:1px solid var(--cs-border);background:var(--cs-surface);padding:10px 34px 10px 10px;color:var(--cs-text-primary);}`,
    `.toast-item.success{border-color:var(--cs-success);} .toast-item.error{border-color:var(--cs-error);} .toast-item.warning{border-color:var(--cs-warning);} .toast-item.info{border-color:var(--cs-live);} `,
    `.toast-head{font-size:10px;letter-spacing:.08em;margin-bottom:5px;} .toast-body{margin:0;font-size:13px;color:var(--cs-text-secondary);} .toast-close{position:absolute;top:6px;right:8px;border:1px solid var(--cs-border);background:var(--cs-surface-2);color:var(--cs-text-muted);font-size:10px;cursor:pointer;padding:2px 5px;}`
  ]
})
export class ToastCenterComponent {
  constructor(public toastService: ToastService) {}
}
