import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, MatIconModule, MatButtonModule]
})
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup;
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
    this.registerForm = this.formBuilder.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  get f() {
    return this.registerForm.controls;
  }

  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';

    if (this.registerForm.invalid) {
      return;
    }

    this.isLoading = true;

    const { firstName, lastName, email, phone, password } = this.registerForm.value;

    this.authService.register(email, password, firstName, lastName, phone).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.router.navigate(['/']);
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.error?.error || 'Registration failed. Please try again.';
      }
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.registerForm.get(fieldName);
    return field ? field.invalid && (field.dirty || field.touched || this.submitted) : false;
  }

  getErrorMessage(fieldName: string): string {
    const field = this.registerForm.get(fieldName);
    
    if (!field) return '';
    
    if (field.errors?.['required']) {
      return `${this.capitalizeFirstLetter(fieldName)} is required`;
    }
    
    if (field.errors?.['email']) {
      return 'Please enter a valid email address';
    }
    
    if (field.errors?.['minlength']) {
      const requiredLength = field.errors?.['minlength'].requiredLength;
      if (fieldName === 'password') {
        return `Password must be at least ${requiredLength} characters`;
      }
      return `${this.capitalizeFirstLetter(fieldName)} must be at least ${requiredLength} characters`;
    }
    
    if (field.errors?.['passwordMismatch']) {
      return 'Passwords do not match';
    }
    
    return '';
  }

  private capitalizeFirstLetter(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
}

