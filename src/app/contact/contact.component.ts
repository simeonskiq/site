import { Component, OnInit, AfterViewInit, PLATFORM_ID, Inject, OnDestroy, HostListener } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { TranslationService } from '../services/translation.service';
import { LanguageService } from '../services/language.service';
import { Subscription } from 'rxjs';

// Declare L variable to avoid direct import
declare let L: any;

@Component({
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.css'],
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, ReactiveFormsModule, HttpClientModule]
})
export class ContactComponent implements OnInit, AfterViewInit, OnDestroy {
  private map: any = null;
  private marker: any = null;
  private isBrowser: boolean;
  
  center = {
    lat: 42.6977,
    lng: 23.3219
  };
  
  contactInfo = {
    address: '123 Hotel Street, City, Country',
    phone: '+1 234 567 890',
    email: 'info@yourhotel.com'
  };

  selectedPosition = this.center;

  contactForm!: FormGroup;
  submitted = false;
  submitSuccess = false;
  submitError = false;
  isSubmitting = false;
  
  // Add missing properties referenced in the template
  successMessage = false;
  errorMessage = false;
  showScrollToTop: boolean = false;


  translations: any = {};
  private langSubscription: Subscription = new Subscription();
  currentLanguage: string = 'en';

  constructor(
    private formBuilder: FormBuilder,
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object,
    private translationService: TranslationService,
    private languageService: LanguageService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.loadFontAwesome();
    }
    
    this.initForm();
    
    if (this.isBrowser) {
      this.loadLeaflet();
      
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
          this.center = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          this.selectedPosition = this.center;
          if (this.map) {
            this.map.setView([this.center.lat, this.center.lng], 15);
            this.updateMarker();
          }
        });
      }
    }

    // Subscribe to language changes
    this.langSubscription = this.languageService.currentLanguage$.subscribe((lang: 'en' | 'bg') => {
      this.currentLanguage = lang;
      this.loadTranslations();
    });
    
    // Initialize translations with current language
    this.loadTranslations();

    // Scroll to top when component loads
    if (this.isBrowser) {
      window.scrollTo(0, 0);
    }
  }

  private loadTranslations(): void {
    this.translations = {
      title: this.translationService.translate('contact.title'),
      subtitle: this.translationService.translate('contact.subtitle'),
      name: this.translationService.translate('contact.name'),
      email: this.translationService.translate('contact.email'),
      phone: this.translationService.translate('contact.phone'),
      message: this.translationService.translate('contact.message'),
      submit: this.translationService.translate('contact.submit'),
      submitting: this.translationService.translate('contact.submitting'),
      address: this.translationService.translate('contact.address'),
      phoneLabel: this.translationService.translate('contact.phoneLabel'),
      emailLabel: this.translationService.translate('contact.emailLabel'),
      successMessage: this.translationService.translate('contact.successMessage'),
      errorMessage: this.translationService.translate('contact.errorMessage')
    };
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    if (this.isBrowser) {
      const scrollPosition = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      this.showScrollToTop = scrollPosition > 300;
    }
  }

  scrollToTop(): void {
    if (this.isBrowser) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }

  ngAfterViewInit() {
    // Only initialize map in browser environment
    if (this.isBrowser) {
      // Delay map initialization to ensure DOM is ready
      setTimeout(() => {
        this.initMap();
      }, 300);
    }
  }

  // Load Leaflet dynamically
  private loadLeaflet() {
    if (!this.isBrowser) return;
    
    // Check if Leaflet is already loaded
    if (typeof L !== 'undefined') return;
    
    // Load Leaflet script
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';
    document.head.appendChild(script);
    
    // Load Leaflet CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';
    document.head.appendChild(link);
  }


  private initMap() {
    if (!this.isBrowser || !document.getElementById('map')) return;
    
    // Make sure Leaflet is loaded
    if (typeof L === 'undefined') {
      console.warn('Leaflet is not loaded yet');
      setTimeout(() => this.initMap(), 500);
      return;
    }
    
    try {
      this.map = L.map('map').setView([this.center.lat, this.center.lng], 15);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.map);

      this.marker = L.marker([this.center.lat, this.center.lng], {
        draggable: true
      }).addTo(this.map);

      this.marker.on('dragend', (event: any) => {
        const marker = event.target;
        const position = marker.getLatLng();
        this.selectedPosition = {
          lat: position.lat,
          lng: position.lng
        };
      });
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }

  private updateMarker() {
    if (this.marker && this.map) {
      this.marker.setLatLng([this.center.lat, this.center.lng]);
      this.map.setView([this.center.lat, this.center.lng], 15);
    }
  }

  initForm(): void {
    this.contactForm = this.formBuilder.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]],
      message: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  // Getter for easy access to form fields
  get f() { 
    return this.contactForm.controls; 
  }

  onSubmit(): void {
    this.submitted = true;
    this.submitError = false;
    
    // Stop here if form is invalid
    if (this.contactForm.invalid) {
      return;
    }

    this.isSubmitting = true;

    // Send contact form via API
    this.sendContactForm();
  }

  // Send contact form via API
  private sendContactForm(): void {
    const formData = {
      name: this.contactForm.value.name,
      email: this.contactForm.value.email,
      phone: this.contactForm.value.phone,
      message: this.contactForm.value.message
    };

    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    this.http.post('/api/public/contact', formData, { headers })
      .subscribe({
        next: (response: any) => {
          console.log('Contact form submitted successfully', response);
          this.handleSubmitSuccess();
        },
        error: (error: any) => {
          console.error('Error submitting contact form', error);
          const errorMessage = error.error?.error || error.error?.message || 'Failed to send message';
          this.handleSubmitError(errorMessage);
        }
      });
  }

  private handleSubmitSuccess(): void {
    this.isSubmitting = false;
    this.submitSuccess = true;
    this.successMessage = true;
    
    // Reset the form after submission
    setTimeout(() => {
      this.contactForm.reset();
      this.submitted = false;
      this.submitSuccess = false;
      this.successMessage = false;
    }, 3000);
  }

  private handleSubmitError(errorMsg?: string): void {
    this.isSubmitting = false;
    this.submitError = true;
    this.errorMessage = true;
    
    // Reset error message after a delay
    setTimeout(() => {
      this.errorMessage = false;
    }, 5000);
  }

  // Helper method to check if a field is invalid and touched
  isFieldInvalid(fieldName: string): boolean {
    const field = this.contactForm.get(fieldName);
    return field ? field.invalid && (field.dirty || field.touched) : false;
  }

  // Helper method to get error message for a field
  getErrorMessage(fieldName: string): string {
    const field = this.contactForm.get(fieldName);
    
    if (!field) return '';
    
    if (field.errors?.['required']) {
      return `${this.capitalizeFirstLetter(fieldName)} is required`;
    }
    
    if (field.errors?.['email']) {
      return 'Please enter a valid email address';
    }
    
    if (field.errors?.['minlength']) {
      return `${this.capitalizeFirstLetter(fieldName)} must be at least ${field.errors?.['minlength'].requiredLength} characters`;
    }
    
    return '';
  }

  private capitalizeFirstLetter(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  private loadFontAwesome() {
    const script = document.createElement('script');
    script.src = 'https://kit.fontawesome.com/your-kit-code.js';  
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
  }

  ngOnDestroy(): void {
    if (this.langSubscription) {
      this.langSubscription.unsubscribe();
    }
  }
}
