import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of, throwError, tap, catchError } from 'rxjs';
import { AppRole, AppStateService, AppUser } from './services/app-state.service';
import { apiUrl } from './services/api-config';

export interface User {
  userId: number;
  email: string;
  fullName: string;
  role: string;
  token: string;
}

export interface AuthResponse {
  token: string;
  userId: number;
  email: string;
  fullName: string;
  role: string;
}

export type AdminRequestStatus = 'PENDING' | 'APPROVED' | 'DENIED';

export type AdminUserRole = 'ADMIN' | 'DEVELOPER' | 'GUEST';
export type AdminUserStatus = 'ACTIVE' | 'SUSPENDED';

export interface AdminUser {
  id: number;
  email: string;
  fullName: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  createdAt: string;
}

export interface AdminAccessRequest {
  id: number;
  userId: number;
  email: string;
  fullName: string;
  status: AdminRequestStatus;
  createdAt: string;
  reviewedAt?: string | null;
  reviewedByEmail?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = apiUrl('/api/auth');
  private readonly STORAGE_KEY = 'auth_token';
  private readonly USER_KEY = 'auth_user';

  private currentUserSubject = new BehaviorSubject<User | null>(this.getUserFromStorage());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private appState: AppStateService) {
    const initial = this.currentUserSubject.value;
    if (initial) {
      this.appState.setCurrentUser(this.toAppUser(initial));
    }
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/login`, { email, password }).pipe(
      tap((res) => this.setUser(res)),
      catchError((err) => {
        return throwError(() => ({ error: err.error?.message || 'Invalid credentials' }));
      })
    );
  }

  register(email: string, fullName: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/register`, { email, fullName, password }).pipe(
      tap((res) => this.setUser(res)),
      catchError((err) => {
        return throwError(() => ({ error: err.error?.message || 'Registration failed' }));
      })
    );
  }

  createDevAdmin(email: string, fullName: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/dev/create-admin`, { email, fullName, password }).pipe(
      tap((res) => this.setUser(res)),
      catchError((err) => {
        return throwError(() => ({ error: err.error?.message || 'Admin creation failed' }));
      })
    );
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.API_URL}/forgot-password`, { email }).pipe(
      catchError((err) => {
        return of({ message: 'If the email exists, a reset link will be sent' });
      })
    );
  }

  resetPassword(email: string, token: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.API_URL}/reset-password`, { email, token, newPassword }).pipe(
      catchError((err) => {
        return throwError(() => ({ error: err.error?.message || 'Password reset failed' }));
      })
    );
  }

  requestAdminAccess(email: string, password: string): Observable<AdminAccessRequest> {
    return this.http.post<AdminAccessRequest>(`${this.API_URL}/admin-requests`, { email, password });
  }

  listAdminAccessRequests(status: AdminRequestStatus, adminEmail: string): Observable<AdminAccessRequest[]> {
    return this.http.get<AdminAccessRequest[]>(
      `${this.API_URL}/admin-requests?status=${status}`,
      { headers: { 'X-Admin-Email': adminEmail } }
    );
  }

  approveAdminAccessRequest(id: number, adminEmail: string): Observable<AdminAccessRequest> {
    return this.http.post<AdminAccessRequest>(
      `${this.API_URL}/admin-requests/${id}/approve`,
      {},
      { headers: { 'X-Admin-Email': adminEmail } }
    );
  }

  denyAdminAccessRequest(id: number, adminEmail: string): Observable<AdminAccessRequest> {
    return this.http.post<AdminAccessRequest>(
      `${this.API_URL}/admin-requests/${id}/deny`,
      {},
      { headers: { 'X-Admin-Email': adminEmail } }
    );
  }

  listAdminUsers(adminEmail: string): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${this.API_URL}/admin/users`, {
      headers: { 'X-Admin-Email': adminEmail }
    });
  }

  updateAdminUserRole(id: number, role: AdminUserRole, adminEmail: string): Observable<AdminUser> {
    return this.http.patch<AdminUser>(
      `${this.API_URL}/admin/users/${id}/role`,
      { role },
      { headers: { 'X-Admin-Email': adminEmail } }
    );
  }

  updateAdminUserStatus(id: number, status: AdminUserStatus, adminEmail: string): Observable<AdminUser> {
    return this.http.patch<AdminUser>(
      `${this.API_URL}/admin/users/${id}/status`,
      { status },
      { headers: { 'X-Admin-Email': adminEmail } }
    );
  }

  deleteAdminUser(id: number, adminEmail: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/admin/users/${id}`, {
      headers: { 'X-Admin-Email': adminEmail }
    });
  }

  loginAsGuest(): void {
    const guestUser: User = {
      userId: 0,
      email: 'guest@codesync.local',
      fullName: 'Guest User',
      role: 'GUEST',
      token: 'guest-token'
    };
    this.setUser(guestUser as any);
  }

  setUser(response: AuthResponse | User): void {
    const user: User = {
      userId: response.userId,
      email: response.email,
      fullName: response.fullName,
      role: response.role,
      token: response.token
    };
    localStorage.setItem(this.STORAGE_KEY, user.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.currentUserSubject.next(user);
    this.appState.setCurrentUser(this.toAppUser(user));
  }

  handleOAuthToken(token: string): void {
    if (token.startsWith('local-')) {
      return;
    }
    const parts = token.split('.');
    if (parts.length < 2) {
      return;
    }
    try {
      const payload = JSON.parse(atob(parts[1]));
      const user: User = {
        userId: payload.userId,
        email: payload.sub || payload.email,
        fullName: payload.name,
        role: payload.role || 'DEVELOPER',
        token: token
      };
      localStorage.setItem(this.STORAGE_KEY, token);
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      this.currentUserSubject.next(user);
      this.appState.setCurrentUser(this.toAppUser(user));
    } catch {
    }
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  private getUserFromStorage(): User | null {
    const userJson = localStorage.getItem(this.USER_KEY);
    if (!userJson) {
      return null;
    }

    try {
      const parsed = JSON.parse(userJson) as User;
      if (!parsed || typeof parsed !== 'object' || !('role' in parsed)) {
        this.logout();
        return null;
      }
      return parsed;
    } catch {
      this.logout();
      return null;
    }
  }

  getToken(): string | null {
    return localStorage.getItem(this.STORAGE_KEY);
  }

  isAuthenticated(): boolean {
    const user = this.getCurrentUser();
    return user !== null && user.role !== 'GUEST';
  }

  isGuest(): boolean {
    const user = this.getCurrentUser();
    return user !== null && user.role === 'GUEST';
  }

  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUserSubject.next(null);
    this.appState.setCurrentUser(null);
  }

  validateToken(token: string): Observable<any> {
    return this.http.post(`${this.API_URL}/validate-token`, {}, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
  }

  getUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/users`);
  }

  private toRoleLabel(role: AppRole): string {
    if (role === 'admin') return 'ADMIN';
    if (role === 'guest') return 'GUEST';
    return 'DEVELOPER';
  }

  private toAppUser(user: User): AppUser {
    return {
      id: user.userId,
      name: user.fullName,
      email: user.email,
      role: user.role.toLowerCase() as AppRole,
      password: '',
      status: 'active',
      joined: new Date().toISOString().slice(0, 10),
      avatar: user.fullName?.charAt(0)?.toUpperCase() || 'U',
      bio: ''
    };
  }
}
