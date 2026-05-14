import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Check, X, Loader2 } from 'lucide-angular';
import { AuthService } from '../auth';
import { PaymentService, SubscriptionStatus } from '../services/payment.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, LucideAngularModule],
  templateUrl: './pricing.html',
  styleUrl: './pricing.css'
})
export class PricingComponent implements OnInit {
  readonly icons = { Check, X, Loader2 };

  subscriptionStatus: SubscriptionStatus | null = null;
  loading = true;
  processingPayment = false;
  currentTier: 'FREE' | 'PRO' = 'FREE';

  constructor(
    private router: Router,
    private authService: AuthService,
    private paymentService: PaymentService,
    private toastService: ToastService
  ) {}

  ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (!user || user.role === 'GUEST') {
      this.router.navigate(['/']);
      return;
    }
    this.loadSubscriptionStatus();
  }

  loadSubscriptionStatus() {
    this.paymentService.getSubscriptionStatus().subscribe({
      next: (status) => {
        this.subscriptionStatus = status;
        this.currentTier = status.tier;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  upgradeToPro() {
    if (this.processingPayment) return;

    const user = this.authService.getCurrentUser();
    if (!user) {
      this.toastService.error('Please login first');
      return;
    }

    console.log('Creating order for user:', user.userId);
    this.processingPayment = true;

    this.paymentService.createOrder().subscribe({
      next: (order) => {
        console.log('Order created:', order);
        this.paymentService.openCheckout(
          order,
          () => {
            this.processingPayment = false;
            this.toastService.success('Payment successful! You are now a Pro user.');
            this.loadSubscriptionStatus();
          },
          () => {
            this.processingPayment = false;
            this.toastService.info('Payment cancelled.');
          }
        );
      },
      error: (err) => {
        this.processingPayment = false;
        console.error('Payment error:', err);
        
        let errorMessage = 'Failed to create payment order';
        
        if (err.status === 0) {
          errorMessage = 'Unable to connect to payment service. Please ensure the backend is running.';
        } else if (err.error?.error) {
          errorMessage = err.error.error;
        } else if (err.message) {
          errorMessage = err.message;
        }
        
        this.toastService.error(errorMessage);
      }
    });
  }

  activateTestMode() {
    this.processingPayment = true;
    this.paymentService.activateTestSubscription().subscribe({
      next: () => {
        this.processingPayment = false;
        this.toastService.success('Test mode activated! You are now a Pro user.');
        this.loadSubscriptionStatus();
      },
      error: () => {
        this.processingPayment = false;
        this.toastService.error('Failed to activate test mode');
      }
    });
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}