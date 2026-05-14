import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

export interface Participant {
  userId: string;
  displayName: string;
}

export interface CollabSessionResponse {
  sessionId: number;
  sessionUuid: string;
  fileId: number;
  hostUserId: string;
  participants: Participant[];
}

export type CollabMessageType = 'JOIN' | 'LEAVE' | 'EDIT' | 'CURSOR' | 'KICK' | 'SESSION_END' | 'CHAT';

export interface CollabEnvelope {
  fileId: number;
  type: CollabMessageType;
  userId: string;
  payload: Record<string, unknown>;
}

export interface ChatMessage {
  userId: string;
  displayName: string;
  message: string;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class CollabService {
  private readonly API_URL = '/api/collab';
  private readonly WS_URL = '/ws/collab';

  private client: Client | null = null;
  private currentFileId: number | null = null;
  private currentSubscription: StompSubscription | null = null;

  private connectedSubject = new BehaviorSubject<boolean>(false);
  readonly connected$ = this.connectedSubject.asObservable();

  private envelopeSubject = new Subject<CollabEnvelope>();
  readonly events$ = this.envelopeSubject.asObservable();

  constructor(private http: HttpClient) {}

  connect(fileId: number): Promise<void> {
    if (this.client?.active && this.currentFileId === fileId) {
      return Promise.resolve();
    }

    this.disconnect();
    this.currentFileId = fileId;

    return new Promise((resolve, reject) => {
      const client = new Client({
        webSocketFactory: () => new SockJS(this.WS_URL),
        reconnectDelay: 1500,
        debug: (str) => console.log('STOMP:', str)
      });

      client.onConnect = () => {
        this.connectedSubject.next(true);
        
        if (this.currentSubscription) {
          this.currentSubscription.unsubscribe();
        }
        
        const subscription = client.subscribe(`/topic/collab/${fileId}`, (message: IMessage) => {
          try {
            const envelope = JSON.parse(message.body) as CollabEnvelope;
            this.envelopeSubject.next(envelope);
          } catch (e) {
            console.error('Failed to parse collab message:', e);
          }
        });
        
        this.currentSubscription = subscription;
        resolve();
      };

      client.onStompError = (frame) => {
        console.error('STOMP error:', frame);
        reject(new Error('STOMP error'));
      };

      client.onWebSocketError = (event) => {
        console.error('WebSocket error:', event);
        reject(new Error('WebSocket error'));
      };

      client.onDisconnect = () => {
        this.connectedSubject.next(false);
        this.currentSubscription = null;
      };

      this.client = client;
      client.activate();
    });
  }

  disconnect(): void {
    this.connectedSubject.next(false);
    if (this.currentSubscription) {
      this.currentSubscription.unsubscribe();
      this.currentSubscription = null;
    }
    if (this.client) {
      this.client.deactivate();
      this.client = null;
    }
    this.currentFileId = null;
  }

  startSession(fileId: number, userId: string, displayName: string): Observable<CollabSessionResponse> {
    return this.http.post<CollabSessionResponse>(`${this.API_URL}/files/${fileId}/start`, { userId, displayName });
  }

  joinSession(fileId: number, userId: string, displayName: string): Observable<CollabSessionResponse> {
    return this.http.post<CollabSessionResponse>(`${this.API_URL}/files/${fileId}/join`, { userId, displayName });
  }

  leaveSession(fileId: number, userId: string): Observable<void> {
    return this.http.post<void>(`${this.API_URL}/files/${fileId}/leave`, { userId });
  }

  sendEdit(fileId: number, userId: string, text: string, operationType: string = 'REPLACE', position: number = 0, length: number = 0): void {
    if (!this.client?.active) {
      return;
    }
    this.client.publish({
      destination: `/app/collab/${fileId}/edit`,
      body: JSON.stringify({ text, userId, operationType, position, length })
    });
  }

  sendCursor(fileId: number, userId: string, lineNumber: number, column: number): void {
    if (!this.client?.active) {
      return;
    }
    this.client.publish({
      destination: `/app/collab/${fileId}/cursor`,
      body: JSON.stringify({ lineNumber, column, userId })
    });
  }

  sendChat(fileId: number, userId: string, displayName: string, message: string): void {
    if (!this.client?.active) {
      return;
    }
    this.client.publish({
      destination: `/app/collab/${fileId}/chat`,
      body: JSON.stringify({ userId, displayName, message })
    });
  }

  broadcastEdit(fileId: number, userId: string, text: string): void {
    this.sendEdit(fileId, userId, text);
  }

  broadcastCursor(fileId: number, userId: string, lineNumber: number, column: number): void {
    this.sendCursor(fileId, userId, lineNumber, column);
  }

  kickParticipant(fileId: number, userIdToKick: string, requesterUserId: string): Observable<void> {
    return this.http.post<void>(`${this.API_URL}/files/${fileId}/kick`, { userIdToKick, requesterUserId });
  }

  endSession(fileId: number, requesterUserId: string, projectId?: number): Observable<void> {
    return this.http.post<void>(`${this.API_URL}/files/${fileId}/end`, { requesterUserId, projectId });
  }

  getSession(fileId: number): Observable<CollabSessionResponse> {
    return this.http.get<CollabSessionResponse>(`${this.API_URL}/files/${fileId}/session`);
  }

  getFileHistory(fileId: number): Observable<unknown> {
    return this.http.get(`${this.API_URL}/files/${fileId}/history`);
  }

  getProjectHistory(projectId: number): Observable<unknown> {
    return this.http.get(`${this.API_URL}/projects/${projectId}/history`);
  }

  getUserHistory(userId: string): Observable<unknown> {
    return this.http.get(`${this.API_URL}/users/${userId}/history`);
  }

  private readonly SESSION_STORAGE_KEY = 'collab_session';

  saveSession(fileId: number, userId: string, displayName: string, projectId?: number): void {
    const sessionData = { fileId, userId, displayName, projectId, savedAt: Date.now() };
    localStorage.setItem(this.SESSION_STORAGE_KEY, JSON.stringify(sessionData));
  }

  getSavedSession(): { fileId: number; userId: string; displayName: string; projectId?: number } | null {
    const saved = localStorage.getItem(this.SESSION_STORAGE_KEY);
    if (!saved) return null;
    try {
      const data = JSON.parse(saved);
      if (data.fileId && data.userId) {
        return data;
      }
      return null;
    } catch {
      return null;
    }
  }

  clearSavedSession(): void {
    localStorage.removeItem(this.SESSION_STORAGE_KEY);
  }
}
