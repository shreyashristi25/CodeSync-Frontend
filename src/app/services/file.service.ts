import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from './api-config';

export interface FileNode {
  id: number;
  name: string;
  path: string;
  parentId: number | null;
  projectId: number;
  content: string;
  isDirectory: boolean;
  language: string | null;
  createdBy: number;
  lastModifiedBy: number;
  createdAt: string;
  updatedAt: string;
  children: FileNode[];
}

export interface CodeFile {
  id: number;
  projectId: number;
  name: string;
  path: string;
  content: string;
  isDirectory: boolean;
  parentId: number | null;
  isDeleted: boolean;
  language: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: number;
  lastModifiedBy: number;
}

export interface CreateFileRequest {
  projectId: number;
  name: string;
  path: string;
  isDirectory: boolean;
  parentId: number | null;
  content: string;
  language: string | null;
  createdBy: number;
  branchId?: number;
}

export interface UpdateFileRequest {
  name: string;
  path: string;
  content: string;
  language: string | null;
  lastModifiedBy: number;
}

@Injectable({
  providedIn: 'root'
})
export class FileApiService {
  private readonly API_URL = apiUrl('/api/files');

  constructor(private http: HttpClient) {}

  getTree(projectId: number, branchId?: number): Observable<FileNode[]> {
    const url = branchId ? `${this.API_URL}/tree?projectId=${projectId}&branchId=${branchId}` : `${this.API_URL}/tree?projectId=${projectId}`;
    return this.http.get<FileNode[]>(url);
  }

  list(projectId: number, branchId?: number): Observable<CodeFile[]> {
    const url = branchId ? `${this.API_URL}?projectId=${projectId}&branchId=${branchId}` : `${this.API_URL}?projectId=${projectId}`;
    return this.http.get<CodeFile[]>(url);
  }

  getById(id: number): Observable<CodeFile> {
    return this.http.get<CodeFile>(`${this.API_URL}/${id}`);
  }

  create(payload: CreateFileRequest): Observable<CodeFile> {
    return this.http.post<CodeFile>(this.API_URL, payload);
  }

  update(id: number, payload: UpdateFileRequest): Observable<CodeFile> {
    return this.http.put<CodeFile>(`${this.API_URL}/${id}`, payload);
  }

  softDelete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }
}
