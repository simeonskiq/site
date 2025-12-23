import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subject, Subscription, interval, startWith, switchMap, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService, User } from './auth.service';

export interface ReservationStatusUpdate {
  reservationId: number;
  status: string;
  reservation: any;
}

export interface RoomStatusUpdate {
  roomId: number;
  status: string;
  room: any;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  // NOTE: This service used to use Socket.IO, but Vercel Serverless can't host WebSocket servers.
  // We implement "near realtime" updates via polling the existing API.
  private reservationUpdateSubject = new Subject<ReservationStatusUpdate>();
  private roomUpdateSubject = new Subject<RoomStatusUpdate>();
  private isBrowser: boolean;
  private pollSub = new Subscription();
  private authSub = new Subscription();

  private lastReservationsById = new Map<number, any>();
  private lastRoomsById = new Map<number, any>();

  public reservationStatusUpdated$ = this.reservationUpdateSubject.asObservable();
  public roomStatusUpdated$ = this.roomUpdateSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    
    if (this.isBrowser) {
      if (environment.enableWebsocket !== false) {
        // Start/stop polling based on auth state to avoid hitting admin endpoints as a normal user.
        this.authSub.add(
          this.authService.currentUser$.subscribe((user) => {
            this.configurePolling(user);
          })
        );
      }
    }
  }

  private configurePolling(user: User | null): void {
    // Reset all polling on auth changes (login/logout/role change)
    this.pollSub.unsubscribe();
    this.pollSub = new Subscription();

    this.lastReservationsById.clear();
    this.lastRoomsById.clear();

    // If not logged in, don't poll anything (prevents 401 spam on refresh)
    if (!user || !this.authService.isAuthenticated()) return;

    const role = user.role ?? 'User';
    const isAdmin = role !== 'User';

    // Poll fairly frequently, but keep it light to avoid hammering Vercel/Supabase.
    const pollMs = 8000;

    // User reservations
    this.pollSub.add(
      interval(pollMs)
        .pipe(
          startWith(0),
          switchMap(() =>
            this.http.get<any[]>(`${environment.apiUrl}/api/user/reservations`).pipe(
              catchError(() => of(null))
            )
          )
        )
        .subscribe((rows) => {
          if (!Array.isArray(rows)) return;
          this.emitReservationDiffs(rows);
        })
    );

    if (!isAdmin) return;

    // Admin reservations
    this.pollSub.add(
      interval(pollMs)
        .pipe(
          startWith(0),
          switchMap(() =>
            this.http.get<any[]>(`${environment.apiUrl}/api/admin/reservations`).pipe(
              catchError(() => of(null))
            )
          )
        )
        .subscribe((rows) => {
          if (!Array.isArray(rows)) return;
          this.emitReservationDiffs(rows);
        })
    );

    // Rooms (admin)
    this.pollSub.add(
      interval(pollMs)
        .pipe(
          startWith(0),
          switchMap(() =>
            this.http.get<any[]>(`${environment.apiUrl}/api/admin/rooms`).pipe(
              catchError(() => of(null))
            )
          )
        )
        .subscribe((rows) => {
          if (!Array.isArray(rows)) return;
          this.emitRoomDiffs(rows);
        })
    );
  }

  private emitReservationDiffs(rows: any[]): void {
    for (const r of rows) {
      const id = Number(r?.Id ?? r?.id);
      if (!Number.isFinite(id)) continue;
      const prev = this.lastReservationsById.get(id);
      const status = r?.Status ?? r?.status;

      if (!prev) {
        this.lastReservationsById.set(id, r);
        // Treat first-seen as an update so components can insert it.
        if (status) {
          this.reservationUpdateSubject.next({ reservationId: id, status, reservation: r });
        }
        continue;
      }

      const prevStatus = prev?.Status ?? prev?.status;
      if (status && status !== prevStatus) {
        this.lastReservationsById.set(id, r);
        this.reservationUpdateSubject.next({ reservationId: id, status, reservation: r });
      } else {
        // Keep latest snapshot anyway (e.g., timestamps)
        this.lastReservationsById.set(id, r);
      }
    }
  }

  private emitRoomDiffs(rows: any[]): void {
    for (const room of rows) {
      const id = Number(room?.Id ?? room?.id);
      if (!Number.isFinite(id)) continue;
      const prev = this.lastRoomsById.get(id);
      const status = room?.Status ?? room?.status;

      if (!prev) {
        this.lastRoomsById.set(id, room);
        if (status) {
          this.roomUpdateSubject.next({ roomId: id, status, room });
        }
        continue;
      }

      const prevStatus = prev?.Status ?? prev?.status;
      if (status && status !== prevStatus) {
        this.lastRoomsById.set(id, room);
        this.roomUpdateSubject.next({ roomId: id, status, room });
      } else {
        this.lastRoomsById.set(id, room);
      }
    }
  }

  disconnect(): void {
    this.pollSub.unsubscribe();
    this.authSub.unsubscribe();
  }

  isConnected(): boolean {
    // Polling doesn't have a "connected" state; return true when enabled in browser.
    return this.isBrowser && environment.enableWebsocket !== false;
  }
}
