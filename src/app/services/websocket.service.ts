import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { isPlatformBrowser } from '@angular/common';
import { Inject, PLATFORM_ID } from '@angular/core';

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
  private socket: Socket | null = null;
  private reservationUpdateSubject = new Subject<ReservationStatusUpdate>();
  private roomUpdateSubject = new Subject<RoomStatusUpdate>();
  private isBrowser: boolean;

  public reservationStatusUpdated$ = this.reservationUpdateSubject.asObservable();
  public roomStatusUpdated$ = this.roomUpdateSubject.asObservable();

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    
    if (this.isBrowser) {
      this.connect();
    }
  }

  private connect(): void {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(environment.apiUrl, {
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    this.socket.on('reservation-status-updated', (data: ReservationStatusUpdate) => {
      this.reservationUpdateSubject.next(data);
    });

    this.socket.on('room-status-updated', (data: RoomStatusUpdate) => {
      this.roomUpdateSubject.next(data);
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}
