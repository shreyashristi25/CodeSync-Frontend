import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SnapshotSummary {
  commitHash: string;
  fileId: number;
  parentHash: string | null;
  timestamp: string;
  commitMessage?: string;
  authorId?: number;
  branchId?: number;
}

export interface SnapshotDetail extends SnapshotSummary {
  fullContent: string;
}

export interface DiffResponse {
  fromHash: string;
  toHash: string;
  unifiedDiff: string;
}

export interface CreateSnapshotRequest {
  fileId: number;
  fullContent: string;
  parentHash?: string | null;
  commitMessage?: string;
  authorId?: number;
  branchId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class VersionService {
  private readonly API_URL = 'http://localhost:8086/api/version';

  constructor(private http: HttpClient) {}

  createSnapshot(payload: CreateSnapshotRequest): Observable<SnapshotDetail> {
    return this.http.post<SnapshotDetail>(`${this.API_URL}/snapshots`, payload);
  }

  listHistory(fileId: number, branchId?: number): Observable<SnapshotSummary[]> {
    const url = branchId
      ? `${this.API_URL}/snapshots?fileId=${fileId}&branchId=${branchId}`
      : `${this.API_URL}/snapshots?fileId=${fileId}`;
    return this.http.get<SnapshotSummary[]>(url);
  }

  getSnapshot(commitHash: string): Observable<SnapshotDetail> {
    return this.http.get<SnapshotDetail>(`${this.API_URL}/snapshots/${commitHash}`);
  }

  diff(fromHash: string, toHash: string): Observable<DiffResponse> {
    return this.http.get<DiffResponse>(`${this.API_URL}/diffs?fromHash=${fromHash}&toHash=${toHash}`);
  }
}
