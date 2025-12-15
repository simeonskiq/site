import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AdminDashboardSummary {
  totalPendingReservations: number;
  occupancyRate: number;
  blockedRoomsCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getDashboardSummary(): Observable<AdminDashboardSummary> {
    return this.http.get<AdminDashboardSummary>(`${this.apiUrl}/api/admin/dashboard`);
  }

  getReservations(filters?: {
    status?: string;
    userId?: number;
    roomId?: number;
  }): Observable<any[]> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.userId) params = params.set('userId', filters.userId);
    if (filters?.roomId) params = params.set('roomId', filters.roomId);

    return this.http.get<any[]>(`${this.apiUrl}/api/admin/reservations`, { params });
  }

  updateReservationStatus(id: number, status: string): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/api/admin/reservations/${id}/status`,
      { status }
    );
  }

  addReservationNote(id: number, note: string): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/api/admin/reservations/${id}/notes`,
      { note }
    );
  }

  modifyReservation(
    id: number,
    payload: { startDate?: string; endDate?: string; roomId?: number }
  ): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/api/admin/reservations/${id}`, payload);
  }

  getRooms(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/admin/rooms`);
  }

  updateRoomStatus(id: number, status: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/api/admin/rooms/${id}/status`, { status });
  }

  blockRoom(
    id: number,
    payload: { startDate?: string; endDate?: string; isPermanent?: boolean; reason?: string }
  ): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/api/admin/rooms/${id}/block`, payload);
  }

  getCalendarData(): Observable<{ reservations: any[]; blocks: any[] }> {
    return this.http.get<{ reservations: any[]; blocks: any[] }>(
      `${this.apiUrl}/api/admin/calendar`
    );
  }
}


