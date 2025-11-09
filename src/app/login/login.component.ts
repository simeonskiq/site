import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, MatIconModule, MatButtonModule]
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  submitted = false;
  errorMessage = '';
  isLoading = false;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Redirect if already logged in
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/']);
      return;
    }

    this.initForm();
  }

  initForm(): void {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  get f() {
    return this.loginForm.controls;
  }

  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';

    if (this.loginForm.invalid) {
      return;
    }

    this.isLoading = true;

    const { email, password } = this.loginForm.value;

    this.authService.login(email, password).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.router.navigate(['/']);
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.error?.error || 'Invalid email or password. Please try again.';
      }
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.loginForm.get(fieldName);
    return field ? field.invalid && (field.dirty || field.touched || this.submitted) : false;
  }

  getErrorMessage(fieldName: string): string {
    const field = this.loginForm.get(fieldName);
    
    if (!field) return '';
    
    if (field.errors?.['required']) {
      return `${this.capitalizeFirstLetter(fieldName)} is required`;
    }
    
    if (field.errors?.['email']) {
      return 'Please enter a valid email address';
    }
    
    return '';
  }

  private capitalizeFirstLetter(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
}

