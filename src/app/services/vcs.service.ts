import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from './api-config';

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

export interface RestoreSnapshotRequest {
  fileId: number;
  snapshotHash: string;
  authorId?: number;
  commitMessage?: string;
}

export interface Branch {
  id: number;
  name: string;
  projectId: number;
  latestSnapshotHash?: string;
  isDefault: boolean;
  createdAt: string;
}

export interface CreateBranchRequest {
  projectId: number;
  name: string;
  sourceBranchId?: number;
}

export interface Repository {
  id: number;
  name: string;
  projectId: number;
  defaultBranchId?: number;
  isPublic: boolean;
  createdAt: string;
}

export interface CreateRepositoryRequest {
  projectId: number;
  name: string;
  isPublic?: boolean;
}

export interface PullRequest {
  id: number;
  repositoryId: number;
  title: string;
  description?: string;
  sourceBranchId: number;
  targetBranchId: number;
  status: 'OPEN' | 'MERGED' | 'CLOSED';
  authorId: number;
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
}

export interface CreatePullRequestRequest {
  repositoryId: number;
  title: string;
  description?: string;
  sourceBranchId: number;
  targetBranchId: number;
  authorId: number;
}

export interface MergePullRequestRequest {
  pullRequestId: number;
  authorId: number;
}

@Injectable({
  providedIn: 'root'
})
export class VcsService {
  private readonly API_URL = apiUrl('/api/version');

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

  restore(payload: RestoreSnapshotRequest): Observable<SnapshotDetail> {
    return this.http.post<SnapshotDetail>(`${this.API_URL}/restore`, payload);
  }

  createBranch(payload: CreateBranchRequest): Observable<Branch> {
    return this.http.post<Branch>(`${this.API_URL}/branches`, payload);
  }

  listBranches(projectId: number): Observable<Branch[]> {
    return this.http.get<Branch[]>(`${this.API_URL}/branches?projectId=${projectId}`);
  }

  checkout(branchId: number): Observable<void> {
    return this.http.post<void>(`${this.API_URL}/branches/${branchId}/checkout`, {});
  }

  getBranch(branchId: number): Observable<Branch> {
    return this.http.get<Branch>(`${this.API_URL}/branches/${branchId}`);
  }

  getDefaultBranch(projectId: number): Observable<Branch> {
    return this.http.get<Branch>(`${this.API_URL}/branches/default?projectId=${projectId}`);
  }

  createRepository(payload: CreateRepositoryRequest): Observable<Repository> {
    return this.http.post<Repository>(`${this.API_URL}/repositories`, payload);
  }

  listRepositories(projectId: number): Observable<Repository[]> {
    return this.http.get<Repository[]>(`${this.API_URL}/repositories?projectId=${projectId}`);
  }

  getRepository(id: number): Observable<Repository> {
    return this.http.get<Repository>(`${this.API_URL}/repositories/${id}`);
  }

  createPullRequest(payload: CreatePullRequestRequest): Observable<PullRequest> {
    return this.http.post<PullRequest>(`${this.API_URL}/pull-requests`, payload);
  }

  listPullRequests(repositoryId: number): Observable<PullRequest[]> {
    return this.http.get<PullRequest[]>(`${this.API_URL}/pull-requests?repositoryId=${repositoryId}`);
  }

  listOpenPullRequests(repositoryId: number): Observable<PullRequest[]> {
    return this.http.get<PullRequest[]>(`${this.API_URL}/pull-requests/open?repositoryId=${repositoryId}`);
  }

  getPullRequest(id: number): Observable<PullRequest> {
    return this.http.get<PullRequest>(`${this.API_URL}/pull-requests/${id}`);
  }

  mergePullRequest(payload: MergePullRequestRequest): Observable<PullRequest> {
    return this.http.post<PullRequest>(`${this.API_URL}/pull-requests/merge`, payload);
  }

  closePullRequest(id: number, authorId: number): Observable<PullRequest> {
    return this.http.post<PullRequest>(`${this.API_URL}/pull-requests/${id}/close?authorId=${authorId}`, {});
  }
}
