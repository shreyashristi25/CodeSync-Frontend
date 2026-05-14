import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../auth';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export interface PaymentOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface SubscriptionStatus {
  tier: 'FREE' | 'PRO';
  status: 'INACTIVE' | 'ACTIVE' | 'CANCELLED' | 'PAST_DUE';
  expiry: string | null;
  testMode: boolean;
  projectsUsed?: number;
  projectsLimit?: number;
  executionsUsed?: number;
  executionsLimit?: number;
  collaboratorsLimit?: number;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private readonly API_URL = '/api/payment';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getUserId(): number {
    const user = this.authService.getCurrentUser();
    return user?.userId || 0;
  }

  getRazorpayConfig(): Observable<{ keyId: string }> {
    return this.http.get<{ keyId: string }>(`${this.API_URL}/config`);
  }

  getSubscriptionStatus(): Observable<SubscriptionStatus> {
    return this.http.get<SubscriptionStatus>(`${this.API_URL}/status`, {
      headers: { 'X-User-Id': this.getUserId().toString() }
    });
  }

  createOrder(): Observable<PaymentOrder> {
    return this.http.post<PaymentOrder>(`${this.API_URL}/create-order`, {}, {
      headers: { 'X-User-Id': this.getUserId().toString() }
    });
  }

  verifyPayment(orderId: string, paymentId: string, signature: string): Observable<any> {
    return this.http.post(`${this.API_URL}/verify`, { orderId, paymentId, signature }, {
      headers: { 'X-User-Id': this.getUserId().toString() }
    });
  }

  openCheckout(order: PaymentOrder, onSuccess: () => void, onClose: () => void): void {
    const options = {
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: 'CodeSync Pro',
      description: 'Upgrade to Pro - Unlimited projects, executions & collaborators',
      order_id: order.orderId,
      handler: (response: any) => {
        this.verifyPayment(order.orderId, response.razorpay_payment_id, response.razorpay_signature)
          .subscribe({
            next: () => onSuccess(),
            error: () => alert('Payment verification failed')
          });
      },
      theme: {
        color: '#00ff88'
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.close', () => {
      onClose();
    });
    rzp.open();
  }

  activateTestSubscription(): Observable<any> {
    return this.http.post(`${this.API_URL}/test/activate`, {}, {
      headers: { 'X-User-Id': this.getUserId().toString() }
    });
  }
}