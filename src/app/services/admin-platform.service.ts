import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AdminSessionParticipant {
  userId: string;
  displayName: string;
  joinedAt: string;
}

export interface AdminSessionView {
  sessionId: number;
  fileId: number;
  createdAt: string;
  participants: AdminSessionParticipant[];
}

export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface ExecutionJobView {
  jobId: string;
  language: string;
  status: JobStatus;
  output?: string | null;
  stderr?: string | null;
  error?: string | null;
}

export interface SupportedLanguage {
  id: number;
  code: string;
  displayName: string;
  enabled: boolean;
}

export interface SystemStats {
  activeUsers: number;
  latencyMs: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminPlatformService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  getActiveUserCount(): Observable<number> {
    return this.http.get<number>(`${this.baseUrl}/api/auth/admin/users/count`);
  }

  getSystemLatency(): Observable<number> {
    return this.http.get<number>(`${this.baseUrl}/api/auth/admin/system/latency`);
  }

  listSessions(): Observable<AdminSessionView[]> {
    return this.http.get<AdminSessionView[]>(`${this.baseUrl}/api/collab/admin/sessions`);
  }

  endSession(sessionId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/collab/admin/sessions/${sessionId}`);
  }

  listExecutionJobs(status?: JobStatus): Observable<ExecutionJobView[]> {
    const query = status ? `?status=${status}` : '';
    return this.http.get<ExecutionJobView[]>(`${this.baseUrl}/api/execution/admin/jobs${query}`);
  }

  cancelExecutionJob(jobId: string): Observable<ExecutionJobView> {
    return this.http.delete<ExecutionJobView>(`${this.baseUrl}/api/execution/admin/jobs/${jobId}`);
  }

  listSupportedLanguages(): Observable<SupportedLanguage[]> {
    return this.http.get<SupportedLanguage[]>(`${this.baseUrl}/api/execution/admin/languages`);
  }

  updateSupportedLanguage(id: number, displayName: string, enabled: boolean): Observable<SupportedLanguage> {
    return this.http.put<SupportedLanguage>(`${this.baseUrl}/api/execution/admin/languages/${id}`, { displayName, enabled });
  }

  broadcastNotification(userIds: number[], type: string, message: string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/api/notifications/admin/broadcast`, { userIds, type, message }).pipe(
      catchError((error) => {
        console.error('Notification broadcast error:', error);
        throw error;
      })
    );
  }
}
