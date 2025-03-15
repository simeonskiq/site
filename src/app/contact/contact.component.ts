import { Component, OnInit, AfterViewInit, PLATFORM_ID, Inject, OnDestroy } from '@angular/core';
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

  // EmailJS configuration
  private emailJsServiceId = 'YOUR_SERVICE_ID'; // Replace with your EmailJS service ID
  private emailJsTemplateId = 'YOUR_TEMPLATE_ID'; // Replace with your EmailJS template ID
  private emailJsUserId = 'YOUR_USER_ID'; // Replace with your EmailJS user ID (public key)

  translations: any = {};
  private langSubscription: Subscription = new Subscription();
  currentLanguage: string = 'en';

  // Bulgarian translations for the contact component
  private translationKeys = {
    en: {
      title: 'Contact Us',
      subtitle: 'Get in touch with our team',
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      message: 'Message',
      submit: 'Submit',
      address: 'Address',
      addressContent: '123 Main Street, City, Country',
      phoneLabel: 'Phone',
      phoneContent: '+1 234 567 890',
      emailLabel: 'Email',
      emailContent: 'info@example.com',
      successMessage: 'Your message has been sent successfully!',
      errorMessage: 'There was an error sending your message. Please try again.',
      // Add all other English texts from your component here
    },
    bg: {
      title: 'Свържете се с нас',
      subtitle: 'Свържете се с нашия екип',
      name: 'Име',
      email: 'Имейл',
      phone: 'Телефон',
      message: 'Съобщение',
      submit: 'Изпрати',
      address: 'Адрес',
      addressContent: 'ул. Главна 123, Град, Държава',
      phoneLabel: 'Телефон',
      phoneContent: '+1 234 567 890',
      emailLabel: 'Имейл',
      emailContent: 'info@example.com',
      successMessage: 'Вашето съобщение беше изпратено успешно!',
      errorMessage: 'Възникна грешка при изпращането на вашето съобщение. Моля, опитайте отново.',
      // Add all Bulgarian translations here
    }
  };

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
    this.initForm();
    
    if (this.isBrowser) {
      this.loadEmailJsScript();
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

    // Register translations with the translation service
    this.translationService.addTranslations('contact', this.translationKeys);
    
    // Subscribe to language changes
    this.langSubscription = this.languageService.currentLanguage.subscribe((lang: 'en' | 'bg') => {
      this.currentLanguage = lang;
      this.translations = this.translationService.getTranslations('contact', lang);
    });
    
    // Initialize translations with current language
    this.translations = this.translationService.getTranslations('contact', this.languageService.getCurrentLanguage());
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

  // Load EmailJS SDK
  private loadEmailJsScript() {
    if (!this.isBrowser) return;
    
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
    script.async = true;
    script.onload = () => {
      // Initialize EmailJS with your user ID
      (window as any).emailjs.init(this.emailJsUserId);
    };
    document.head.appendChild(script);
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
      subject: ['', [Validators.required, Validators.minLength(5)]],
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

    // Send email using EmailJS
    if (this.isBrowser) {
      this.sendViaEmailJS();
    } else {
      this.handleSubmitError();
    }
  }

  // Send via EmailJS (https://www.emailjs.com)
  private sendViaEmailJS(): void {
    if (!this.isBrowser || !(window as any).emailjs) {
      console.error('EmailJS not loaded');
      this.handleSubmitError();
      return;
    }

    const templateParams = {
      name: this.contactForm.value.name,
      email: this.contactForm.value.email,
      subject: this.contactForm.value.subject,
      message: this.contactForm.value.message,
      to_email: this.contactInfo.email // The email address where you want to receive messages
    };

    (window as any).emailjs.send(
      this.emailJsServiceId,
      this.emailJsTemplateId,
      templateParams
    )
    .then((response: any) => {
      console.log('Email sent successfully', response);
      this.handleSubmitSuccess();
    })
    .catch((error: any) => {
      console.error('Error sending email', error);
      this.handleSubmitError();
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

  private handleSubmitError(): void {
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

  ngOnDestroy(): void {
    if (this.langSubscription) {
      this.langSubscription.unsubscribe();
    }
  }
}
