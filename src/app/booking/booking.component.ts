import { Component, PLATFORM_ID, Inject, OnInit, OnDestroy, HostListener } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { FormsModule, ReactiveFormsModule, FormGroup, FormBuilder, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { TranslationService } from '../services/translation.service';
import { LanguageService } from '../services/language.service';
import { Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService, User } from '../services/auth.service';
import { AppCurrencyPipe } from '../pipes/app-currency.pipe';
import { TranslatePipe } from '../pipes/translate.pipe';
import { NotificationService } from '../services/notification.service';

interface Room {
  id: number;
  name: string;
  description: string;
  image: string;
  capacity: number;
  beds: string;
  bathrooms: number;
  price: number;
  title?: string;
  images?: string[];
}

interface Service {
  id: number;
  name: string;
}

@Component({
  selector: 'app-booking',
  templateUrl: './booking.component.html',
  styleUrls: ['./booking.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDatepickerModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatNativeDateModule,
    AppCurrencyPipe,
    TranslatePipe
  ]
})
export class BookingComponent implements OnInit, OnDestroy {
  translations: any = {};
  private langSubscription: Subscription = new Subscription();
  currentLanguage: string = 'en';
  checkinDate: Date | null = null;
  checkoutDate: Date | null = null;
  rooms: Room[] = [];
  searched: boolean = false;
  minCheckoutDate: Date | null = null;
  today: Date = new Date();
  showReservationForm = false;
  selectedRoom: Room | null = null;
  reservationData = {
    name1: '',
    name2: '',
    phone: '',
    email: '',
    customerNote: '',
    checkinDate: null as Date | null,
    checkoutDate: null as Date | null
  };
  startDate: Date | null = null;
  endDate: Date | null = null;
  showModal: boolean = false;
  showDetailsModal: boolean = false;
  currentUser: User | null = null;

  // Add missing properties for the form
  bookingForm: FormGroup;
  isSubmitting = false;
  successMessage = false;
  errorMessage = false;
  formErrors: any = {
    service: false,
    date: false,
    time: false,
    name: false,
    email: false,
    phone: false
  };
  services: Service[] = [
    { id: 1, name: 'Room Booking' },
    { id: 2, name: 'Spa Service' },
    { id: 3, name: 'Restaurant Reservation' }
  ];
  availableTimeSlots: string[] = [
    '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', 
    '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'
  ];

  imagesApart1: string[] = [
    '../../images/apart1/IMG_3708.JPEG',
    '../../images/apart1/IMG_3711.JPEG',
    '../../images/apart1/IMG_3713.JPEG',
    '../../images/apart1/IMG_3715.JPEG',
    '../../images/apart1/IMG_3718.JPEG',
    '../../images/apart1/IMG_3719.JPEG',
    '../../images/apart1/IMG_3720.JPEG',
    '../../images/apart1/IMG_3721.JPEG',
    '../../images/apart1/IMG_3723.JPEG'
  ];

  imagesApart2: string[] = [
    '../../images/apart2/IMG_3734.JPEG',
    '../../images/apart2/IMG_3735.JPEG',
    '../../images/apart2/IMG_3736.JPEG',
    '../../images/apart2/IMG_3737.JPEG',
    '../../images/apart2/IMG_3738.JPEG',
    '../../images/apart2/IMG_3740.JPEG',
    '../../images/apart2/IMG_3741.JPEG',
    '../../images/apart2/IMG_3742.JPEG',
    '../../images/apart2/IMG_3743.JPEG',
    '../../images/apart2/IMG_3744.JPEG',
    '../../images/apart2/IMG_3745.JPEG'
  ];

  imagesApart3: string[] = [
    '../../images/apart3/IMG_3763.JPEG',
    '../../images/apart3/IMG_3765.JPEG',
    '../../images/apart3/IMG_3769.JPEG',
    '../../images/apart3/IMG_3770.JPEG',
    '../../images/apart3/IMG_3771.JPEG',
    '../../images/apart3/IMG_3772.JPEG',
    '../../images/apart3/IMG_3774.JPEG',
    '../../images/apart3/IMG_3776.JPEG',
    '../../images/apart3/IMG_3778.JPEG',
    '../../images/apart3/IMG_3779.JPEG'
  ];

  imagesStudio: string[] = [
    '../../images/studio/IMG_3724.JPEG',
    '../../images/studio/IMG_3725.JPEG',
    '../../images/studio/IMG_3726.JPEG',
    '../../images/studio/IMG_3727.JPEG',
    '../../images/studio/IMG_3728.JPEG',
    '../../images/studio/IMG_3729.JPEG',
    '../../images/studio/IMG_3730.JPEG',
    '../../images/studio/IMG_3731.JPEG',
    '../../images/studio/IMG_3732.JPEG'
  ];

  currentImageIndex = 0;
  currentImage = this.imagesApart1[0];
  showScrollToTop: boolean = false;

  private isBrowser: boolean;

  constructor(
    private dialog: MatDialog,
    private router: Router,
    private http: HttpClient,
    private formBuilder: FormBuilder,
    @Inject(PLATFORM_ID) platformId: Object,
    private translationService: TranslationService,
    private languageService: LanguageService,
    private authService: AuthService,
    private notificationService: NotificationService
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.today.setHours(0, 0, 0, 0);
    
    // Initialize the form
    this.bookingForm = this.formBuilder.group({
      service: ['', Validators.required],
      date: ['', Validators.required],
      time: ['', Validators.required],
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      notes: ['']
    });
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

  ngOnInit(): void {
    // Register translations with the translation service
    this.translationService.addTranslations('booking', this.translationKeys);
    
    // Subscribe to language changes
    this.langSubscription = this.languageService.currentLanguage.subscribe((lang: 'en' | 'bg') => {
      this.currentLanguage = lang;
      this.translations = this.translationService.getTranslations('booking', lang);
    });
    
    // Initialize translations with current language
    this.translations = this.translationService.getTranslations('booking', this.languageService.getCurrentLanguage());

    // Load current user (for autofill)
    this.currentUser = this.authService.getCurrentUser();

    // Scroll to top when component loads
    if (this.isBrowser) {
      window.scrollTo(0, 0);
    }
  }

  ngOnDestroy(): void {
    if (this.langSubscription) {
      this.langSubscription.unsubscribe();
    }
  }

  // Add missing method for form submission
  onSubmit(): void {
    if (this.bookingForm.invalid) {
      // Mark all fields as touched to trigger validation messages
      Object.keys(this.bookingForm.controls).forEach(key => {
        const control = this.bookingForm.get(key);
        if (control) {
          control.markAsTouched();
          if (control.invalid) {
            this.formErrors[key] = true;
          }
        }
      });
      return;
    }

    this.isSubmitting = true;

    // Simulate API call
    setTimeout(() => {
      this.isSubmitting = false;
      this.successMessage = true;
      
      // Reset form after successful submission
      setTimeout(() => {
        this.bookingForm.reset();
        this.successMessage = false;
      }, 3000);
    }, 1500);
  }

  private initializeMap() {
    if (this.isBrowser) {
      // Leaflet-related code here
    }
  }

  onCheckinDateChange(event: any) {
    if (event) {
      // Create a new date object for the minimum checkout date
      // Set it to the day after check-in
      const nextDay = new Date(event);
      nextDay.setDate(nextDay.getDate() + 1);
      this.minCheckoutDate = nextDay;

      // If current checkout date is before the new minimum, reset it
      if (this.checkoutDate && this.checkoutDate <= this.checkinDate!) {
        this.checkoutDate = null;
      }
    }
  }

  searchRooms() {
    if (!this.checkinDate || !this.checkoutDate) {
      this.notificationService.warning('Missing dates', 'Please select both check-in and check-out dates.', { persist: false });
      return;
    }

    // Add additional validation to ensure checkout is after checkin
    if (this.checkoutDate <= this.checkinDate) {
      this.notificationService.warning(
        'Invalid dates',
        'Check-out date must be at least one day after check-in date.',
        { persist: false }
      );
      this.checkoutDate = null;
      return;
    }

    // Load available rooms from backend so already-approved bookings are excluded
    const startDateStr = this.checkinDate.toISOString().split('T')[0];
    const endDateStr = this.checkoutDate.toISOString().split('T')[0];

    this.http
      .get<any[]>(`${environment.apiUrl}/api/public/available-rooms`, {
        params: {
          startDate: startDateStr,
          endDate: endDateStr
        }
      })
      .subscribe({
        next: (roomsFromApi) => {
          // Map API rooms to UI model and attach image arrays
          this.rooms = roomsFromApi.map((r) => {
            let images: string[] = [];
            let image: string = '';
            if (r.Name === 'Апартамент 1') {
              images = this.imagesApart1;
              image = this.imagesApart1[0];
            } else if (r.Name === 'Апартамент 2') {
              images = this.imagesApart2;
              image = this.imagesApart2[0];
            } else if (r.Name === 'Апартамент 3') {
              images = this.imagesApart3;
              image = this.imagesApart3[0];
            } else if (r.Name === 'Студио') {
              images = this.imagesStudio;
              image = this.imagesStudio[0];
            }

            return {
              id: r.Id,
              name: r.Name,
              description: r.Type || '',
              image,
              capacity: 2,
              beds: '',
              bathrooms: 1,
              price: r.BasePrice || 0,
              images
            } as Room;
          });

          this.searched = true;
        },
        error: (err) => {
          console.error('Failed to load available rooms', err);
          this.notificationService.error('Error', 'There was an error loading available rooms. Please try again.', { persist: false });
        }
      });
  }

  selectRoom(room: Room) {
    this.selectedRoom = room;
    // If the room doesn't have a title property, use the name property
    if (room && !room.title) {
      room.title = room.name;
    }
    // Autofill from user account if available
    if (this.currentUser) {
      this.reservationData.email = this.currentUser.email || '';
      this.reservationData.phone = this.currentUser.phone || '';
      this.reservationData.name1 = this.currentUser.firstName || '';
      this.reservationData.name2 = this.currentUser.lastName || '';
    }
    // For the reservation form
    this.showReservationForm = true;
  }

  contactAboutRoom(room: Room) {
    this.selectedRoom = room;
    if (this.currentUser) {
      this.reservationData.email = this.currentUser.email || '';
      this.reservationData.phone = this.currentUser.phone || '';
      this.reservationData.name1 = this.currentUser.firstName || '';
      this.reservationData.name2 = this.currentUser.lastName || '';
    }
    this.showReservationForm = true;
  }

  nextImage(room: Room | null): void {
    if (room?.images && room.images.length > 0) {
      this.currentImageIndex = (this.currentImageIndex + 1) % room.images.length;
    }
  }

  previousImage(room: Room | null): void {
    if (room?.images && room.images.length > 0) {
      this.currentImageIndex = (this.currentImageIndex - 1 + room.images.length) % room.images.length;
    }
  }

  hasImages(room: Room | null): boolean {
    return !!room?.images && room.images.length > 0;
  }

  getCurrentImage(room: Room | null): string {
    if (room?.images && room.images.length > 0) {
      return room.images[this.currentImageIndex];
    }
    return room?.image || '';
  }

  getImagesLength(room: Room | null): number {
    return room?.images?.length || 0;
  }

  confirmReservation() {
    // Email is required, phone is optional; names remain required
    if (!this.reservationData.name1 || !this.reservationData.name2 || !this.reservationData.email) {
      this.notificationService.warning('Missing details', 'Please fill in first name, last name, and email.', { persist: false });
      return;
    }

    if (!this.selectedRoom) {
      this.notificationService.warning('No room selected', 'Please select a room first.', { persist: false });
      return;
    }

    // Build payload and let backend handle emails + persistence
    const payload = {
      firstName: this.reservationData.name1,
      lastName: this.reservationData.name2,
      email: this.reservationData.email,
      phone: this.reservationData.phone,
      roomId: this.selectedRoom?.id,
      roomName: this.selectedRoom?.name,
      roomImage: this.selectedRoom?.image,
      startDate: this.checkinDate?.toISOString().split('T')[0],
      endDate: this.checkoutDate?.toISOString().split('T')[0],
      pricePerNight: this.selectedRoom?.price,
      customerNote: this.reservationData.customerNote,
      userId: this.currentUser?.id
    };

    this.http.post<any>(`${environment.apiUrl}/api/public/reservations`, payload).subscribe({
      next: (resp) => {
        const codeRaw = resp?.reservation?.booking_code ?? resp?.reservation?.bookingCode ?? null;
        const fallbackId = resp?.reservation?.id != null ? String(resp.reservation.id).padStart(4, '0') : null;
        const bookingId = (codeRaw != null && String(codeRaw).trim() !== '') ? String(codeRaw) : fallbackId;

        this.notificationService.success(
          'Reservation confirmed',
          bookingId
            ? `Your Booking ID is ${bookingId}. Please check your email for confirmation details.`
            : 'Please check your email for confirmation details.',
          { persist: true, link: '/my-reservations' }
        );
        this.showReservationForm = false;
        this.resetReservationForm();
        // After successful reservation, navigate to "My Reservations" if logged in
        if (this.currentUser) {
          this.router.navigate(['/my-reservations']);
        }
      },
      error: (err) => {
        console.error('Failed to create reservation:', err);
        this.notificationService.error('Reservation failed', 'There was an error processing your reservation. Please try again.', { persist: false });
      }
    });
  }

  private resetReservationForm() {
    this.reservationData = {
      name1: '',
      name2: '',
      phone: '',
      email: '',
      customerNote: '',
      checkinDate: null,
      checkoutDate: null
    };
    this.selectedRoom = null;
    this.showReservationForm = false;
  }

  openDetailsDialog(room: Room): void {
    this.selectedRoom = room;
    // If the room doesn't have a title property, use the name property
    if (room && !room.title) {
      room.title = room.name;
    }
    this.currentImageIndex = 0;
    this.showDetailsModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeDetailsDialog(): void {
    this.showDetailsModal = false;
    document.body.style.overflow = 'auto';
  }

  getRoomDetailedDescription(room: Room): string {
    const roomKeyMap: { [key: string]: { desc: string, features: string } } = {
      'Апартамент 1': { desc: 'booking.roomDescription.apart1', features: 'booking.roomDescription.apart1.features' },
      'Апартамент 2': { desc: 'booking.roomDescription.apart2', features: 'booking.roomDescription.apart2.features' },
      'Апартамент 3': { desc: 'booking.roomDescription.apart3', features: 'booking.roomDescription.apart3.features' },
      'Студио': { desc: 'booking.roomDescription.studio', features: 'booking.roomDescription.studio.features' }
    };

    const mapping = roomKeyMap[room.name];
    if (mapping) {
      const lang = this.currentLanguage as 'en' | 'bg';
      const description = this.translationService.translate(mapping.desc);
      const features = this.translationService.translate(mapping.features);
      return `${description}<br><br>${features}`;
    }

    return this.translationService.translate('booking.noDescription') || 'No detailed description available for this room.';
  }

  // Bulgarian translations for the booking component
  private translationKeys = {
    en: {
      title: 'Book an Appointment',
      subtitle: 'Select your preferred date and time',
      service: 'Service',
      selectService: 'Select a service',
      date: 'Date',
      time: 'Time',
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      notes: 'Additional Notes',
      submit: 'Book Now',
      serviceRequired: 'Please select a service',
      dateRequired: 'Please select a date',
      timeRequired: 'Please select a time',
      nameRequired: 'Please enter your name',
      emailRequired: 'Please enter a valid email',
      phoneRequired: 'Please enter your phone number',
      successMessage: 'Your booking has been confirmed!',
      errorMessage: 'There was an error processing your booking. Please try again.',
      // Add all other English texts from your component here
    },
    bg: {
      title: 'Запазете час',
      subtitle: 'Изберете предпочитаната от вас дата и час',
      service: 'Услуга',
      selectService: 'Изберете услуга',
      date: 'Дата',
      time: 'Час',
      name: 'Име',
      email: 'Имейл',
      phone: 'Телефон',
      notes: 'Допълнителни бележки',
      submit: 'Резервирайте сега',
      serviceRequired: 'Моля, изберете услуга',
      dateRequired: 'Моля, изберете дата',
      timeRequired: 'Моля, изберете час',
      nameRequired: 'Моля, въведете вашето име',
      emailRequired: 'Моля, въведете валиден имейл',
      phoneRequired: 'Моля, въведете вашия телефонен номер',
      successMessage: 'Вашата резервация е потвърдена!',
      errorMessage: 'Възникна грешка при обработката на вашата резервация. Моля, опитайте отново.',
      // Add all Bulgarian translations here
    }
  };
}
