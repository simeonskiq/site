import { Injectable, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { AuthService, User } from './auth.service';
import { WebSocketService } from './websocket.service';

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  createdAt: string; // ISO
  read: boolean;
  level: NotificationLevel;
  link?: string;
}

export interface ToastNotification {
  id: string;
  title: string;
  message: string;
  level: NotificationLevel;
  durationMs: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
  private readonly isBrowser: boolean;
  private readonly subs = new Subscription();

  private readonly notificationsSubject = new BehaviorSubject<AppNotification[]>([]);
  readonly notifications$ = this.notificationsSubject.asObservable();

  private readonly toastSubject = new Subject<ToastNotification>();
  readonly toasts$ = this.toastSubject.asObservable();

  private currentUser: User | null = null;
  private storageKey: string | null = null;

  // Track known reservation statuses to avoid "first poll" spam
  private readonly lastReservationStatusById = new Map<number, string>();

  constructor(
    private authService: AuthService,
    private webSocketService: WebSocketService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    this.subs.add(
      this.authService.currentUser$.subscribe((user) => {
        this.currentUser = user;
        this.lastReservationStatusById.clear();
        this.configureStorageForUser(user);
      })
    );

    // Realtime-ish notifications from polling diff stream
    this.subs.add(
      this.webSocketService.reservationStatusUpdated$.subscribe((u) => {
        this.onReservationUpdate(u);
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  info(title: string, message: string, opts?: Partial<{ persist: boolean; link: string; durationMs: number }>) {
    this.push('info', title, message, opts);
  }
  success(title: string, message: string, opts?: Partial<{ persist: boolean; link: string; durationMs: number }>) {
    this.push('success', title, message, opts);
  }
  warning(title: string, message: string, opts?: Partial<{ persist: boolean; link: string; durationMs: number }>) {
    this.push('warning', title, message, opts);
  }
  error(title: string, message: string, opts?: Partial<{ persist: boolean; link: string; durationMs: number }>) {
    this.push('error', title, message, opts);
  }

  markAllRead(): void {
    const next = this.notificationsSubject.value.map((n) => ({ ...n, read: true }));
    this.notificationsSubject.next(next);
    this.persist();
  }

  markRead(id: string): void {
    const next = this.notificationsSubject.value.map((n) => (n.id === id ? { ...n, read: true } : n));
    this.notificationsSubject.next(next);
    this.persist();
  }

  clearAll(): void {
    this.notificationsSubject.next([]);
    this.persist();
  }

  remove(id: string): void {
    const next = this.notificationsSubject.value.filter((n) => n.id !== id);
    this.notificationsSubject.next(next);
    this.persist();
  }

  private push(
    level: NotificationLevel,
    title: string,
    message: string,
    opts?: Partial<{ persist: boolean; link: string; durationMs: number }>
  ) {
    const id = this.makeId();
    const createdAt = new Date().toISOString();
    const persist = opts?.persist !== false; // default true
    const durationMs = opts?.durationMs ?? 4500;

    const notif: AppNotification = {
      id,
      title,
      message,
      createdAt,
      read: false,
      level,
      link: opts?.link
    };

    // Always show a toast
    this.toastSubject.next({ id, title, message, level, durationMs });

    if (persist) {
      const next = [notif, ...this.notificationsSubject.value].slice(0, 50);
      this.notificationsSubject.next(next);
      this.persist();
    }
  }

  private onReservationUpdate(update: { reservationId: number; status: string; reservation: any }) {
    // Only notify when a reservation changes status (avoid initial poll spam)
    const reservationId = Number(update.reservationId);
    const nextStatus = String(update.status || '').trim();
    if (!Number.isFinite(reservationId) || !nextStatus) return;

    const prevStatus = this.lastReservationStatusById.get(reservationId);
    this.lastReservationStatusById.set(reservationId, nextStatus);

    const bookingCodeRaw =
      update?.reservation?.BookingCode ??
      update?.reservation?.booking_code ??
      (update?.reservation?.Id != null ? String(update.reservation.Id).padStart(4, '0') : null);
    const bookingId = bookingCodeRaw != null && String(bookingCodeRaw).trim() !== '' ? String(bookingCodeRaw) : String(reservationId);

    // Admin: show notification for brand-new pending reservations created very recently
    const role = this.currentUser?.role ?? 'User';
    const isAdmin = role !== 'User';
    if (isAdmin && !prevStatus && nextStatus === 'Pending') {
      const createdAtIso = update?.reservation?.CreatedAt ?? update?.reservation?.created_at ?? null;
      const createdAtMs = createdAtIso ? new Date(createdAtIso).getTime() : NaN;
      const isRecent = Number.isFinite(createdAtMs) ? Date.now() - createdAtMs < 2 * 60 * 1000 : false;
      if (isRecent) {
        this.info('New reservation request', `Booking ID ${bookingId} is pending review.`, {
          link: '/admin',
          persist: true
        });
      }
      return;
    }

    // Normal flow: only notify on actual changes
    if (!prevStatus || prevStatus === nextStatus) return;

    // User + Admin: show a status update message
    const level: NotificationLevel =
      nextStatus === 'Approved' ? 'success' : nextStatus === 'Rejected' ? 'error' : nextStatus === 'Cancelled' ? 'warning' : 'info';

    this.push(level, 'Reservation status updated', `Booking ID ${bookingId} is now ${nextStatus}.`, {
      link: isAdmin ? '/admin' : '/my-reservations',
      persist: true
    });
  }

  private configureStorageForUser(user: User | null) {
    if (!this.isBrowser) return;

    if (!user) {
      this.storageKey = null;
      this.notificationsSubject.next([]);
      return;
    }

    const key = `aurora.notifications.${user.id}`;
    this.storageKey = key;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        this.notificationsSubject.next([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        this.notificationsSubject.next([]);
        return;
      }
      // Basic shape check
      const sanitized: AppNotification[] = parsed
        .filter((n) => n && typeof n === 'object')
        .map((n) => ({
          id: String(n.id || this.makeId()),
          title: String(n.title || 'Notification'),
          message: String(n.message || ''),
          createdAt: String(n.createdAt || new Date().toISOString()),
          read: Boolean(n.read),
          level: (['info', 'success', 'warning', 'error'] as const).includes(n.level) ? n.level : 'info',
          link: n.link ? String(n.link) : undefined
        }))
        .slice(0, 50);
      this.notificationsSubject.next(sanitized);
    } catch {
      this.notificationsSubject.next([]);
    }
  }

  private persist(): void {
    if (!this.isBrowser) return;
    if (!this.storageKey) return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.notificationsSubject.value));
    } catch {
      // ignore quota / privacy errors
    }
  }

  private makeId(): string {
    // short, readable id
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}


