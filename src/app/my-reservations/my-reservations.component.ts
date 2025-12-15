import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-my-reservations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-reservations.component.html',
  styleUrls: ['./my-reservations.component.css']
})
export class MyReservationsComponent implements OnInit {
  reservations: any[] = [];
  loading = false;
  error: string | null = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadReservations();
  }

  loadReservations(): void {
    this.loading = true;
    this.http.get<any[]>(`${environment.apiUrl}/api/user/reservations`).subscribe({
      next: (data) => {
        this.reservations = data;
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.error = 'Failed to load your reservations';
        this.loading = false;
      }
    });
  }

  cancelReservation(reservationId: number): void {
    if (!confirm('Are you sure you want to cancel this reservation?')) {
      return;
    }

    this.loading = true;
    this.error = null;
    this.http.put<any>(`${environment.apiUrl}/api/user/reservations/${reservationId}/cancel`, {}).subscribe({
      next: () => {
        this.loadReservations(); // Reload to show updated status
      },
      error: (err) => {
        console.error(err);
        this.error = err.error?.error || 'Failed to cancel reservation';
        this.loading = false;
      }
    });
  }

  canCancel(reservation: any): boolean {
    return reservation.Status !== 'Cancelled' && 
           reservation.Status !== 'Completed' && 
           reservation.Status !== 'Rejected';
  }
}


