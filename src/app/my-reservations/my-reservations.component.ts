import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';
import { WebSocketService } from '../services/websocket.service';
import { TranslationService } from '../services/translation.service';
import { LanguageService } from '../services/language.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-my-reservations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './my-reservations.component.html',
  styleUrls: ['./my-reservations.component.css']
})
export class MyReservationsComponent implements OnInit, OnDestroy {
  reservations: any[] = [];
  activeReservations: any[] = [];
  historyReservations: any[] = [];
  loading = false;
  error: string | null = null;
  activeTab = 'active'; // 'active' or 'history'
  searchDate: string = '';
  searchTags: string = '';
  translations: any = {};
  currentLanguage: string = 'en';
  private subscriptions = new Subscription();
  private currentUserId: number | null = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router,
    private websocketService: WebSocketService,
    private translationService: TranslationService,
    private languageService: LanguageService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }
    this.currentUserId = user.id;
    this.loadReservations();
    
    // Subscribe to real-time reservation status updates
    this.subscriptions.add(
      this.websocketService.reservationStatusUpdated$.subscribe((update) => {
        this.handleReservationUpdate(update);
      })
    );

    // Subscribe to language changes
    this.subscriptions.add(
      this.languageService.currentLanguage$.subscribe(lang => {
        this.currentLanguage = lang;
        this.loadTranslations();
      })
    );
    
    this.loadTranslations();
  }

  loadTranslations(): void {
    this.translations = {
      title: this.translationService.translate('reservations.title'),
      active: this.translationService.translate('reservations.active'),
      history: this.translationService.translate('reservations.history'),
      loading: this.translationService.translate('reservations.loading'),
      noActive: this.translationService.translate('reservations.noActive'),
      noHistory: this.translationService.translate('reservations.noHistory'),
      status: this.translationService.translate('reservations.status'),
      checkin: this.translationService.translate('reservations.checkin'),
      checkout: this.translationService.translate('reservations.checkout'),
      totalPrice: this.translationService.translate('reservations.totalPrice'),
      created: this.translationService.translate('reservations.created'),
      completed: this.translationService.translate('reservations.completed'),
      cancel: this.translationService.translate('reservations.cancel'),
      cannotCancel: this.translationService.translate('reservations.cannotCancel'),
      canceledBy: this.translationService.translate('reservations.canceledBy'),
      canceledByAdmin: this.translationService.translate('reservations.canceledByAdmin'),
      canceled: this.translationService.translate('reservations.canceled'),
      searchDate: this.translationService.translate('reservations.searchDate'),
      searchTags: this.translationService.translate('reservations.searchTags'),
      clearSearch: this.translationService.translate('reservations.clearSearch'),
      loadingHistory: this.translationService.translate('reservations.loadingHistory'),
      noResults: this.translationService.translate('reservations.noResults')
    };
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private handleReservationUpdate(update: { reservationId: number; status: string; reservation: any }): void {
    // Only update if this reservation belongs to the current user
    // Check if the reservation has UserId matching current user, or if it's in our list
    const reservationIndex = this.reservations.findIndex(r => r.Id === update.reservationId);
    
    if (reservationIndex !== -1) {
      // Update existing reservation
      this.reservations[reservationIndex] = {
        ...this.reservations[reservationIndex],
        Status: update.status,
        ...update.reservation
      };
      this.filterReservations();
    } else if (update.reservation.UserId === this.currentUserId) {
      // New reservation for this user, reload to get full details
      this.loadReservations();
    }
  }

  loadReservations(): void {
    this.loading = true;
    this.http.get<any[]>(`${environment.apiUrl}/api/user/reservations`).subscribe({
      next: (data) => {
        this.reservations = data;
        this.filterReservations();
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.error = 'Failed to load your reservations';
        this.loading = false;
      }
    });
  }

  filterReservations(): void {
    // Active reservations: Pending, Approved (not cancelled, not completed)
    this.activeReservations = this.reservations.filter(r => 
      r.Status !== 'Cancelled' && 
      r.Status !== 'Completed' && 
      r.Status !== 'Rejected'
    );

    // History: Cancelled, Completed, Rejected
    this.historyReservations = this.reservations.filter(r => 
      r.Status === 'Cancelled' || 
      r.Status === 'Completed' || 
      r.Status === 'Rejected'
    );
  }

  getFilteredHistory(): any[] {
    let filtered = [...this.historyReservations];

    // Filter by date
    if (this.searchDate) {
      const searchDateObj = new Date(this.searchDate);
      filtered = filtered.filter(r => {
        const startDate = new Date(r.StartDate);
        const endDate = new Date(r.EndDate);
        return startDate <= searchDateObj && endDate >= searchDateObj;
      });
    }

    // Filter by tags (status, room name, etc.)
    if (this.searchTags) {
      const searchLower = this.searchTags.toLowerCase();
      filtered = filtered.filter(r => 
        r.Status?.toLowerCase().includes(searchLower) ||
        r.RoomName?.toLowerCase().includes(searchLower) ||
        r.RoomType?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }

  switchTab(tab: string): void {
    this.activeTab = tab;
  }

  clearSearch(): void {
    this.searchDate = '';
    this.searchTags = '';
  }

  cancelReservation(reservationId: number): void {
    if (!confirm('Are you sure you want to cancel this reservation?')) {
      return;
    }

    this.loading = true;
    this.error = null;
    this.http.put<any>(`${environment.apiUrl}/api/user/reservations/${reservationId}/cancel`, {}).subscribe({
      next: () => {
        // Real-time update will be handled by WebSocket
        if (!this.websocketService.isConnected()) {
          this.loadReservations();
        }
      },
      error: (err) => {
        console.error(err);
        this.error = err.error?.error || 'Failed to cancel reservation';
        this.loading = false;
      }
    });
  }

  canCancel(reservation: any): boolean {
    // Users can only cancel Pending reservations, not Approved ones
    return reservation.Status === 'Pending';
  }

  getCancelMessage(reservation: any): string {
    if (reservation.Status === 'Cancelled') {
      if (!reservation.CanceledBy) {
        return this.translations.canceled || 'Canceled';
      }
      return reservation.CanceledBy === 'User'
        ? (this.translations.canceledBy || 'Canceled by you')
        : (this.translations.canceledByAdmin || 'Canceled by admin');
    }
    return '';
  }
}


