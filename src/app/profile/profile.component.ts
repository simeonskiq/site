import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService, User } from '../services/auth.service';
import { TranslatePipe } from '../pipes/translate.pipe';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  user: User | null = null;
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  emailError: string | null = null;
  emailSuccess: string | null = null;

  profileForm = {
    firstName: '',
    lastName: '',
    phone: ''
  };

  emailForm = {
    email: ''
  };

  passwordForm = {
    currentPassword: '',
    newPassword: ''
  };

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const current = this.authService.getCurrentUser();
    if (!current) {
      this.router.navigate(['/login']);
      return;
    }

    this.loadProfile();
  }

  loadProfile(): void {
    this.loading = true;
    this.http.get<User>(`${environment.apiUrl}/api/user/profile`).subscribe({
      next: (user) => {
        this.user = user;
        this.profileForm.firstName = user.firstName || '';
        this.profileForm.lastName = user.lastName || '';
        this.profileForm.phone = user.phone || '';
        this.emailForm.email = user.email;
        this.authService.updateStoredUser(user);
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.error = 'profile.failedToLoad';
        this.loading = false;
      }
    });
  }

  saveProfile(): void {
    this.error = null;
    this.successMessage = null;
    this.http.put<User>(`${environment.apiUrl}/api/user/profile`, this.profileForm).subscribe({
      next: (user) => {
        this.user = user;
        this.authService.updateStoredUser(user);
        this.successMessage = 'profile.updatedSuccessfully';
      },
      error: (err) => {
        console.error(err);
        this.error = 'profile.failedToUpdate';
      }
    });
  }

  saveEmail(): void {
    this.emailError = null;
    this.emailSuccess = null;
    this.http.put<User>(`${environment.apiUrl}/api/user/email`, this.emailForm).subscribe({
      next: (user) => {
        this.user = user;
        this.authService.updateStoredUser(user);
        this.emailSuccess = 'profile.emailChangedSuccessfully';
      },
      error: (err) => {
        console.error(err);
        if (err.status === 409) {
          this.emailError = 'profile.emailExists';
        } else {
          this.emailError = err.error?.error || 'profile.failedToUpdateEmail';
        }
      }
    });
  }

  savePassword(): void {
    this.error = null;
    this.successMessage = null;
    this.http
      .put<{ message: string }>(
        `${environment.apiUrl}/api/user/password`,
        this.passwordForm
      )
      .subscribe({
        next: (res) => {
          this.successMessage = res.message || 'profile.passwordUpdatedSuccessfully';
          this.passwordForm.currentPassword = '';
          this.passwordForm.newPassword = '';
        },
        error: (err) => {
          console.error(err);
          this.error = err.error?.error || 'profile.failedToUpdatePassword';
        }
      });
  }
}


