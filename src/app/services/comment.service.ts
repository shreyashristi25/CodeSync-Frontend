import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from './api-config';

export interface Comment {
  id: number;
  fileId: number;
  lineNumber: number;
  content: string;
  resolved: boolean;
  authorId: number;
  parentCommentId?: number;
  createdAt: string;
  updatedAt: string;
  replies?: Comment[];
}

export interface CreateCommentRequest {
  fileId: number;
  lineNumber: number;
  content: string;
  authorId: number;
  parentCommentId?: number;
}

export interface UpdateCommentRequest {
  content: string;
  authorId: number;
}

@Injectable({
  providedIn: 'root'
})
export class CommentService {
  private apiUrl = apiUrl('/api/comments');

  constructor(private http: HttpClient) {}

  createComment(request: CreateCommentRequest): Observable<Comment> {
    return this.http.post<Comment>(this.apiUrl, request);
  }

  updateComment(id: number, request: UpdateCommentRequest): Observable<Comment> {
    return this.http.put<Comment>(`${this.apiUrl}/${id}`, request);
  }

  getComment(id: number): Observable<Comment> {
    return this.http.get<Comment>(`${this.apiUrl}/${id}`);
  }

  getCommentsByFile(fileId: number): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.apiUrl}/file/${fileId}`);
  }

  getCommentsByFileAndLine(fileId: number, lineNumber: number): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.apiUrl}/file/${fileId}/line/${lineNumber}`);
  }

  resolveComment(id: number): Observable<Comment> {
    return this.http.patch<Comment>(`${this.apiUrl}/${id}/resolve`, {});
  }

  deleteComment(id: number, authorId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, {
      params: { authorId: authorId.toString() }
    });
  }
}
