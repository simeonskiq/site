import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export interface User {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private isBrowser: boolean;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    
    // Only access localStorage in browser
    if (this.isBrowser) {
      const user = this.getUserFromStorage();
      this.currentUserSubject.next(user);
      
      // Check if user is already logged in
      const token = this.getToken();
      if (token) {
        // Optionally verify token with backend
        this.loadUserFromToken();
      }
    }
  }

  register(email: string, password: string, firstName?: string, lastName?: string, phone?: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/api/auth/register`, {
      email,
      password,
      firstName,
      lastName,
      phone
    }).pipe(
      tap(response => {
        this.setToken(response.token);
        this.setUser(response.user);
      })
    );
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/api/auth/login`, {
      email,
      password
    }).pipe(
      tap(response => {
        this.setToken(response.token);
        this.setUser(response.user);
      })
    );
  }

  logout(): void {
    if (this.isBrowser) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('current_user');
    }
    this.currentUserSubject.next(null);
    this.router.navigate(['/']);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getToken(): string | null {
    if (!this.isBrowser) {
      return null;
    }
    return localStorage.getItem('auth_token');
  }

  updateStoredUser(user: User): void {
    this.setUser(user);
  }

  private setToken(token: string): void {
    if (this.isBrowser) {
      localStorage.setItem('auth_token', token);
    }
  }

  private setUser(user: User): void {
    if (this.isBrowser) {
      localStorage.setItem('current_user', JSON.stringify(user));
    }
    this.currentUserSubject.next(user);
  }

  private getUserFromStorage(): User | null {
    if (!this.isBrowser) {
      return null;
    }
    const userStr = localStorage.getItem('current_user');
    return userStr ? JSON.parse(userStr) : null;
  }

  private loadUserFromToken(): void {
    const user = this.getUserFromStorage();
    if (user) {
      this.currentUserSubject.next(user);
    }
  }
}

