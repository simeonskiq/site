import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService, AdminDashboardSummary } from '../services/admin.service';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit {
  summary: AdminDashboardSummary | null = null;
  pendingReservations: any[] = [];
  allReservations: any[] = [];
  rooms: any[] = [];
  loading = false;
  error: string | null = null;
  isAuthorized = false;

  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    private router: Router
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
      next: (data) => (this.allReservations = data),
      error: (err) => {
        console.error(err);
        this.error = 'Failed to load reservation history';
      }
    });
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
        this.loadPendingReservations();
        this.loadAllReservations();
        this.loadDashboard();
        this.loadRooms();
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
        this.loadPendingReservations();
        this.loadAllReservations();
        this.loadDashboard();
        this.loadRooms();
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
        this.loadPendingReservations();
        this.loadAllReservations();
        this.loadDashboard();
        this.loadRooms();
      },
      error: (err) => {
        console.error(err);
        this.error = 'Failed to update reservation status';
      }
    });
  }
}


