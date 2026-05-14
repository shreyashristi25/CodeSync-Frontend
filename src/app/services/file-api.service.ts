import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CodeFile {
  id: number;
  projectId: number;
  path: string;
  name: string;
  content: string;
  isDirectory: boolean;
  parentId: number | null;
  createdAt: string;
  updatedAt: string;
  language?: string | null;
  createdBy?: number;
  lastModifiedBy?: number;
}

export interface CreateFileRequest {
  projectId: number;
  path: string;
  name: string;
  content?: string;
  isDirectory: boolean;
  parentId?: number;
  language?: string | null;
  createdBy: number;
  branchId?: number;
}

export interface UpdateFileRequest {
  name?: string;
  path?: string;
  content?: string;
  language?: string;
  lastModifiedBy: number;
}

export interface FileTreeNode {
  id: number;
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileTreeNode[];
}

@Injectable({
  providedIn: 'root'
})
export class FileService {
  private readonly API_URL = '/api/files';

  constructor(private http: HttpClient) {}

  getFiles(projectId: number, branchId?: number): Observable<CodeFile[]> {
    const url = branchId ? `${this.API_URL}?projectId=${projectId}&branchId=${branchId}` : `${this.API_URL}?projectId=${projectId}`;
    return this.http.get<CodeFile[]>(url);
  }

  getFileTree(projectId: number, branchId?: number): Observable<FileTreeNode[]> {
    const url = branchId ? `${this.API_URL}/tree?projectId=${projectId}&branchId=${branchId}` : `${this.API_URL}/tree?projectId=${projectId}`;
    return this.http.get<FileTreeNode[]>(url);
  }

  getFile(id: number): Observable<CodeFile> {
    return this.http.get<CodeFile>(`${this.API_URL}/${id}`);
  }

  createFile(request: CreateFileRequest): Observable<CodeFile> {
    return this.http.post<CodeFile>(this.API_URL, request);
  }

  updateFile(id: number, request: UpdateFileRequest): Observable<CodeFile> {
    return this.http.put<CodeFile>(`${this.API_URL}/${id}`, request);
  }

  deleteFile(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }
}