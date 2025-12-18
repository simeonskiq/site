import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, AdminDashboardSummary } from '../services/admin.service';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { WebSocketService } from '../services/websocket.service';
import { TranslationService } from '../services/translation.service';
import { LanguageService } from '../services/language.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit, OnDestroy {
  summary: AdminDashboardSummary | null = null;
  pendingReservations: any[] = [];
  allReservations: any[] = [];
  filteredReservations: any[] = [];
  rooms: any[] = [];
  loading = false;
  error: string | null = null;
  isAuthorized = false;
  
  // Search and pagination
  searchEmail: string = '';
  searchDate: string = '';
  searchTag: string = '';
  searchRoom: string = '';
  currentPage: number = 1;
  itemsPerPage: number = 5;
  totalPages: number = 1;
  
  // Translations
  translations: any = {};
  currentLanguage: string = 'en';
  
  private subscriptions = new Subscription();

  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    private router: Router,
    private websocketService: WebSocketService,
    private translationService: TranslationService,
    private languageService: LanguageService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    const role = user?.role ?? 'User';

    // Only allow Support/Manager/SuperAdmin to use admin panel
    if (!user || role === 'User') {
      // Redirect non-admins to home or login
      this.router.navigate(['/']);
      return;
    }

    this.isAuthorized = true;
    this.loadDashboard();
    this.loadPendingReservations();
    this.loadAllReservations();
    this.loadRooms();
    
    // Subscribe to real-time updates
    this.subscriptions.add(
      this.websocketService.reservationStatusUpdated$.subscribe((update) => {
        this.handleReservationUpdate(update);
      })
    );

    this.subscriptions.add(
      this.websocketService.roomStatusUpdated$.subscribe((update) => {
        this.handleRoomUpdate(update);
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
    const lang = this.currentLanguage;
    this.translations = {
      panel: this.translationService.translate('admin.panel'),
      pendingReservations: this.translationService.translate('admin.pendingReservations'),
      occupancyRate: this.translationService.translate('admin.occupancyRate'),
      blockedRooms: this.translationService.translate('admin.blockedRooms'),
      roomsAvailability: this.translationService.translate('admin.roomsAvailability'),
      reservationHistory: this.translationService.translate('admin.reservationHistory'),
      id: this.translationService.translate('admin.id'),
      user: this.translationService.translate('admin.user'),
      userGuest: this.translationService.translate('admin.userGuest'),
      room: this.translationService.translate('admin.room'),
      dates: this.translationService.translate('admin.dates'),
      status: this.translationService.translate('admin.status'),
      actions: this.translationService.translate('admin.actions'),
      approve: this.translationService.translate('admin.approve'),
      reject: this.translationService.translate('admin.reject'),
      cancel: this.translationService.translate('admin.cancel'),
      complete: this.translationService.translate('admin.complete'),
      loading: this.translationService.translate('admin.loading'),
      noPending: this.translationService.translate('admin.noPending'),
      noRooms: this.translationService.translate('admin.noRooms'),
      noReservations: this.translationService.translate('admin.noReservations'),
      searchEmail: this.translationService.translate('admin.searchEmail'),
      searchDate: this.translationService.translate('admin.searchDate'),
      searchTag: this.translationService.translate('admin.searchTag'),
      searchRoom: this.translationService.translate('admin.searchRoom'),
      clearSearch: this.translationService.translate('admin.clearSearch'),
      noResults: this.translationService.translate('admin.noResults'),
      previous: this.translationService.translate('admin.previous'),
      next: this.translationService.translate('admin.next'),
      page: this.translationService.translate('admin.page'),
      of: this.translationService.translate('admin.of'),
      total: this.translationService.translate('admin.total'),
      name: this.translationService.translate('admin.name'),
      type: this.translationService.translate('admin.type'),
      visible: this.translationService.translate('admin.visible'),
      currentlyBlocked: this.translationService.translate('admin.currentlyBlocked'),
      yes: this.translationService.translate('admin.yes'),
      no: this.translationService.translate('admin.no')
    };
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private handleReservationUpdate(update: { reservationId: number; status: string; reservation: any }): void {
    // Update pending reservations
    const pendingIndex = this.pendingReservations.findIndex(r => r.Id === update.reservationId);
    if (pendingIndex !== -1) {
      if (update.status === 'Pending') {
        this.pendingReservations[pendingIndex] = { ...this.pendingReservations[pendingIndex], ...update.reservation };
      } else {
        // Remove from pending if status changed
        this.pendingReservations = this.pendingReservations.filter(r => r.Id !== update.reservationId);
      }
    }

    // Update all reservations
    const allIndex = this.allReservations.findIndex(r => r.Id === update.reservationId);
    if (allIndex !== -1) {
      this.allReservations[allIndex] = { ...this.allReservations[allIndex], ...update.reservation };
    } else {
      // Add new reservation if it doesn't exist
      this.allReservations.unshift(update.reservation);
    }

    // Reapply filters after update
    this.applyFilters();

    // Reload dashboard to get updated counts
    this.loadDashboard();
  }

  private handleRoomUpdate(update: { roomId: number; status: string; room: any }): void {
    const roomIndex = this.rooms.findIndex(r => r.Id === update.roomId);
    if (roomIndex !== -1) {
      this.rooms[roomIndex] = { ...this.rooms[roomIndex], ...update.room };
    } else {
      this.rooms.push(update.room);
    }
  }

  loadDashboard(): void {
    this.adminService.getDashboardSummary().subscribe({
      next: (data) => (this.summary = data),
      error: (err) => {
        console.error(err);
        this.error = 'Failed to load dashboard';
      }
    });
  }

  loadPendingReservations(): void {
    this.loading = true;
    this.adminService.getReservations({ status: 'Pending' }).subscribe({
      next: (data) => {
        this.pendingReservations = data;
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.error = 'Failed to load reservations';
        this.loading = false;
      }
    });
  }

  loadAllReservations(): void {
    this.adminService.getReservations().subscribe({
      next: (data) => {
        this.allReservations = data;
        this.filteredReservations = [...data];
        this.applyFilters();
      },
      error: (err) => {
        console.error(err);
        this.error = 'Failed to load reservation history';
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.allReservations];

    // Filter by email
    if (this.searchEmail) {
      const emailLower = this.searchEmail.toLowerCase();
      filtered = filtered.filter(r => 
        r.Email?.toLowerCase().includes(emailLower) ||
        r.GuestEmail?.toLowerCase().includes(emailLower)
      );
    }

    // Filter by date
    if (this.searchDate) {
      const searchDateObj = new Date(this.searchDate);
      filtered = filtered.filter(r => {
        const startDate = new Date(r.StartDate);
        const endDate = new Date(r.EndDate);
        return startDate <= searchDateObj && endDate >= searchDateObj;
      });
    }

    // Filter by tag/status
    if (this.searchTag) {
      const tagLower = this.searchTag.toLowerCase();
      filtered = filtered.filter(r => 
        r.Status?.toLowerCase().includes(tagLower) ||
        r.DisplayStatus?.toLowerCase().includes(tagLower)
      );
    }

    // Filter by room
    if (this.searchRoom) {
      const roomLower = this.searchRoom.toLowerCase();
      filtered = filtered.filter(r => 
        r.RoomName?.toLowerCase().includes(roomLower)
      );
    }

    this.filteredReservations = filtered;
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredReservations.length / this.itemsPerPage);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
  }

  getPaginatedReservations(): any[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredReservations.slice(start, end);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  clearSearch(): void {
    this.searchEmail = '';
    this.searchDate = '';
    this.searchTag = '';
    this.searchRoom = '';
    this.applyFilters();
  }

  loadRooms(): void {
    this.adminService.getRooms().subscribe({
      next: (rooms) => (this.rooms = rooms),
      error: (err) => {
        console.error(err);
        this.error = 'Failed to load rooms';
      }
    });
  }

  approveReservation(reservationId: number): void {
    this.adminService.updateReservationStatus(reservationId, 'Approved').subscribe({
      next: () => {
        // Real-time update will be handled by WebSocket
        // Only reload if WebSocket is not connected
        if (!this.websocketService.isConnected()) {
          this.loadPendingReservations();
          this.loadAllReservations();
          this.loadDashboard();
          this.loadRooms();
        }
      },
      error: (err) => {
        console.error(err);
        this.error = 'Failed to approve reservation';
      }
    });
  }

  rejectReservation(reservationId: number): void {
    this.adminService.updateReservationStatus(reservationId, 'Rejected').subscribe({
      next: () => {
        // Real-time update will be handled by WebSocket
        if (!this.websocketService.isConnected()) {
          this.loadPendingReservations();
          this.loadAllReservations();
          this.loadDashboard();
          this.loadRooms();
        }
      },
      error: (err) => {
        console.error(err);
        this.error = 'Failed to reject reservation';
      }
    });
  }

  changeStatus(reservationId: number, status: string): void {
    this.adminService.updateReservationStatus(reservationId, status).subscribe({
      next: () => {
        // Real-time update will be handled by WebSocket
        if (!this.websocketService.isConnected()) {
          this.loadPendingReservations();
          this.loadAllReservations();
          this.loadDashboard();
          this.loadRooms();
        }
      },
      error: (err) => {
        console.error(err);
        this.error = 'Failed to update reservation status';
      }
    });
  }
}


