import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from './api-config';

export interface Project {
  id: number;
  name: string;
  description: string;
  ownerId: number;
  isPublic: boolean;
  createdAt: string;
  language?: string;
}

export interface UserSearchResult {
  id: number;
  email: string;
  fullName: string;
  role: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private readonly API_URL = apiUrl('/api/projects');

  constructor(private http: HttpClient) {}

  getPublicProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.API_URL}/public`);
  }

  getUserProjects(ownerId: number): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.API_URL}?ownerId=${ownerId}`);
  }

  getAllProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(this.API_URL);
  }

  createProject(project: Omit<Project, 'id' | 'createdAt'>): Observable<Project> {
    return this.http.post<Project>(this.API_URL, project);
  }

  getProject(id: number): Observable<Project> {
    return this.http.get<Project>(`${this.API_URL}/${id}`);
  }

  updateProject(id: number, project: Partial<Project>): Observable<Project> {
    return this.http.patch<Project>(`${this.API_URL}/${id}`, project);
  }

  deleteProject(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }

  searchUsers(query: string): Observable<UserSearchResult[]> {
    return this.http.get<UserSearchResult[]>(apiUrl(`/api/auth/users/search?q=${encodeURIComponent(query)}`));
  }
}
