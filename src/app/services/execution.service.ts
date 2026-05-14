import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type ExecutionLanguage = 'PYTHON' | 'NODE' | 'JAVA';
export type ExecutionJobStatus = 'QUEUED' | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TIMED_OUT' | 'CANCELLED';

export interface SubmitExecutionRequest {
  code: string;
  language: ExecutionLanguage;
  stdin?: string;
  projectId?: number;
  fileName?: string;
}

export interface ExecutionJobResponse {
  jobId: string;
  language: ExecutionLanguage;
  status: ExecutionJobStatus;
  output: string | null;
  stderr: string | null;
  error: string | null;
  projectId?: number;
  fileName?: string;
  submittedAt?: string;
  executionTimeMs?: number;
  memoryUsedKb?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ExecutionService {
  private readonly API_URL = '/api/execution/jobs';

  constructor(private http: HttpClient) {}

  submitJob(payload: SubmitExecutionRequest): Observable<ExecutionJobResponse> {
    return this.http.post<ExecutionJobResponse>(this.API_URL, payload);
  }

  getJob(jobId: string): Observable<ExecutionJobResponse> {
    return this.http.get<ExecutionJobResponse>(`${this.API_URL}/${jobId}`);
  }

  /** Cancel a running or pending job. */
  cancelJob(jobId: string): Observable<ExecutionJobResponse> {
    return this.http.delete<ExecutionJobResponse>(`${this.API_URL}/${jobId}`);
  }

  getHistory(): Observable<ExecutionJobResponse[]> {
    return this.http.get<ExecutionJobResponse[]>('/api/execution/admin/history');
  }
}
