import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { apiUrl, notificationWsUrl } from './api-config';

export interface Notification {
  id: number;
  userId: number;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface UnreadCount {
  userId: number;
  unreadCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private apiUrl = apiUrl('/api/notifications');
  private wsUrl = notificationWsUrl();
  private stompClient: Client | null = null;
  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();
  private notificationSubject = new BehaviorSubject<Notification | null>(null);
  public notification$ = this.notificationSubject.asObservable();

  constructor(private http: HttpClient) {}

  connectWebSocket(userId: number): void {
    if (this.stompClient?.active) {
      return;
    }

    this.stompClient = new Client({
      webSocketFactory: () => new SockJS(this.wsUrl),
      onConnect: () => {
        this.subscribeToNotifications(userId);
        this.getUnreadCount(userId).subscribe(data => {
          this.unreadCountSubject.next(data.unreadCount);
        });
      },
      onDisconnect: () => {
        console.log('Disconnected from notification WebSocket');
      },
      onStompError: (error) => {
        console.error('STOMP error:', error);
      }
    });

    this.stompClient.activate();
  }

  private subscribeToNotifications(userId: number): void {
    if (!this.stompClient?.active) return;

    this.stompClient.subscribe(`/user/${userId}/notifications`, (message) => {
      try {
        const data = JSON.parse(message.body);
        this.unreadCountSubject.next(data.unreadCount);
      } catch (error) {
        console.error('Error parsing notification:', error);
      }
    });
  }

  getNotifications(userId: number): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${this.apiUrl}/user/${userId}`);
  }

  getUnreadNotifications(userId: number): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${this.apiUrl}/user/${userId}/unread`);
  }

  getUnreadCount(userId: number): Observable<UnreadCount> {
    return this.http.get<UnreadCount>(`${this.apiUrl}/user/${userId}/unread-count`);
  }

  markAsRead(id: number): Observable<Notification> {
    return this.http.patch<Notification>(`${this.apiUrl}/${id}/read`, {});
  }

  deleteNotification(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  disconnectWebSocket(): void {
    if (this.stompClient?.active) {
      this.stompClient.deactivate();
    }
  }
}
