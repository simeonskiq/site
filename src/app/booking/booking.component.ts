import { Component, PLATFORM_ID, Inject, OnInit, OnDestroy } from '@angular/core';
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
    MatNativeDateModule
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
    checkinDate: null as Date | null,
    checkoutDate: null as Date | null
  };
  startDate: Date | null = null;
  endDate: Date | null = null;
  showModal: boolean = false;
  showDetailsModal: boolean = false;

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

  private isBrowser: boolean;

  constructor(
    private dialog: MatDialog,
    private router: Router,
    private http: HttpClient,
    private formBuilder: FormBuilder,
    @Inject(PLATFORM_ID) platformId: Object,
    private translationService: TranslationService,
    private languageService: LanguageService
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
      alert('Please select both check-in and check-out dates');
      return;
    }

    // Add additional validation to ensure checkout is after checkin
    if (this.checkoutDate <= this.checkinDate) {
      alert('Check-out date must be at least one day after check-in date');
      this.checkoutDate = null;
      return;
    }

    this.rooms = [
      {
        id: 1,
        name: 'Апартамент 1',
        description: 'Насладете се на комфорт и уединение в нашия Апартамент с една спалня.',
        image: '../../images/apart1/IMG_3708.JPEG',
        capacity: 2,
        beds: '1 Двойно легло',
        bathrooms: 1,
        price: 99,
        images: this.imagesApart1
      },
      {
        id: 2,
        name: 'Апартамент 2',
        description: 'Ако търсите простор и удобство, този апартамент е за вас!',
        image: '../../images/apart2/IMG_3734.JPEG',
        capacity: 2,
        beds: '1 Двойно легло',
        bathrooms: 1,
        price: 149,
        images: this.imagesApart2
      },
      {
        id: 3,
        name: 'Апартамент 3',
        description: 'Перфектен за тези, които търсят уют и спокойствие, този апартамент с една спалня съчетава комфорт и функционалност.',
        image: '../../images/apart3/IMG_3763.JPEG',
        capacity: 4,
        beds: '1 Двойно легло + Разтегателен диван',
        bathrooms: 2,
        price: 199,
        images: this.imagesApart3
      },
      {
        id: 4,
        name: 'Студио',
        description: 'Нашето Студио предлага уют и удобство с модерен интериор и тераса.',
        image: '../../images/studio/IMG_3724.JPEG',
        capacity: 2,
        beds: 'Разтегателен диван',
        bathrooms: 1,
        price: 249,
        images: this.imagesStudio
      }
    ];
    
    this.searched = true;
  }

  selectRoom(room: Room) {
    this.selectedRoom = room;
    // If the room doesn't have a title property, use the name property
    if (room && !room.title) {
      room.title = room.name;
    }
    // For the reservation form
    this.showReservationForm = true;
  }

  contactAboutRoom(room: Room) {
    this.selectedRoom = room;
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
    if (!this.reservationData.name1 || !this.reservationData.name2 || !this.reservationData.phone || !this.reservationData.email) {
      alert('Please fill in all required fields');
      return;
    }

    if (!this.selectedRoom) {
      alert('Please select a room first');
      return;
    }

    // Format the room description for email - updated formatting logic
    const formattedDescription = this.getRoomDetailedDescription(this.selectedRoom)
      .split('<br><br>')
      .map(section => {
        if (section.includes('✔')) {
          // Handle the features list
          return section
            .split('<br>')
            .filter(line => line.trim())
            .map(line => line.replace('✔ ', ''))
            .join('<br>');
        }
        // Handle the main description
        return `<p>${section.trim()}</p>`;
      })
      .join('');

    // Common parameters for both emails
    const commonParams = {
      guest_name: `${this.reservationData.name1} ${this.reservationData.name2}`,
      guest_phone: this.reservationData.phone,
      guest_email: this.reservationData.email,
      check_in: this.checkinDate?.toLocaleDateString(),
      check_out: this.checkoutDate?.toLocaleDateString(),
      room_name: this.selectedRoom.name,
      room_price: this.selectedRoom.price,
      reservation_date: new Date().toLocaleString()
    };

    // Send email using EmailJS
    if (!(window as any).emailjs) {
      console.error('EmailJS not loaded');
      alert('There was an error processing your reservation. Please try again.');
      return;
    }

    // Send emails
    Promise.all([
      // Send confirmation to guest
      (window as any).emailjs.send(
        'service_2sirswb',
        'template_nj1goue',
        {
          ...commonParams,
          to_email: this.reservationData.email,
          room_description: formattedDescription
        },
        'PStyZFWlBKGj7ZBI8'
      ),
      // Send notification to hotel
      (window as any).emailjs.send(
        'service_2sirswb',
        'template_j9ekjdl',
        {
          ...commonParams,
          to_email: 'sunflowerhotelvarna@gmail.com' // Hotel's email
        },
        'PStyZFWlBKGj7ZBI8'
      )
    ])
    .then((responses) => {
      console.log('Emails sent successfully', responses);
      alert('Reservation confirmed! Please check your email for confirmation details.');
      this.showReservationForm = false;
      this.resetReservationForm();
    })
    .catch((error) => {
      console.error('Error sending emails:', error);
      alert('There was an error processing your reservation. Please try again.');
    });
  }

  private resetReservationForm() {
    this.reservationData = {
      name1: '',
      name2: '',
      phone: '',
      email: '',
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
    const descriptions: { [key: string]: string } = {
      'Апартамент 3': `Перфектен за тези, които търсят уют и спокойствие, този апартамент с една спалня съчетава комфорт и функционалност. Спалнята разполага с голямо двойно легло, а дневната зона предлага разтегателен диван, подходящ за допълнителни гости. В апартамента ще откриете още кухненски бокс с всички удобства, самостоятелна баня с вана и душ, и широка тераса с кът за отдих. Климатиците, телевизорът и безплатният Wi-Fi гарантират удобство и приятна атмосфера.<br><br>
      ✔ Спалня с двойно легло<br>
      ✔ Дневна зона с разтегателен диван<br>
      ✔ Просторна тераса с кът за отдих<br>
      ✔ Климатик и телевизор<br>
      ✔ Кухненски бокс с фурна, хладилник и трапезна маса<br>
      ✔ Самостоятелна тоалетна и баня с вана и душ<br>
      ✔ Безплатен Wi-Fi`,

      'Апартамент 2': `Ако търсите простор и удобство, този апартамент е за вас! Разполага с отделна спалня с двойно легло и дневна зона с разтегателен диван, където може да нощуват още двама гости. Светлината навлиза през големите прозорци, а терасата предлага чудесно място за отдих с изглед. Кухненският бокс е напълно оборудван с всичко от което бийте имали нужда, а самостоятелната баня е модерно обзавена с вана. Климатикът, телевизорът и безплатният Wi-Fi ще направят престоя ви още по-приятен.<br><br>
      ✔ Спалня с двойно легло<br>
      ✔ Дневна зона с разтегателен диван<br>
      ✔ Просторна тераса с кът за отдих<br>
      ✔ Климатик и телевизор<br>
      ✔ Кухненски бокс с фурна, хладилник и трапезна маса<br>
      ✔ Самостоятелна тоалетна и баня с вана и душ<br>
      ✔ Безплатен Wi-Fi`,

      'Апартамент 1': `Насладете се на комфорт и уединение в нашия Апартамент с една спалня. Основната спалня разполага с удобно двойно легло, а дневната зона е оборудвана с разтегателен диван, подходящ за допълнителни гости. Апартаментът предлага напълно оборудван кухненски бокс, където можете да приготвяте любимите си ястия, както и просторна тераса, идеална за сутрешно кафе или вечерен релакс. Освен това, разполага със самостоятелна баня, климатик, телевизор и безплатен Wi-Fi.<br><br>
      ✔ Спалня с двойно легло<br>
      ✔ Дневна зона с разтегателен диван<br>
      ✔ Просторна тераса с кът за отдих<br>
      ✔ Климатик и телевизор<br>
      ✔ Кухненски бокс с фурна, хладилник и трапезна маса<br>
      ✔ Самостоятелна тоалетна и баня с душ<br>
      ✔ Безплатен Wi-Fi`,

      'Студио': `Нашето Студио предлага уют и удобство с модерен интериор и тераса, където можете да се насладите на сутрешното си кафе или вечерния бриз. Основното пространство включва разтегателен диван, напълно оборудван кухненски бокс с микроволнова, хладилник и трапезна маса. В студиото ще откриете още климатик, телевизор и безплатен Wi-Fi за вашето удобство.<br><br>
      ✔ Разтегателен диван за двама<br>
      ✔ Просторна тераса с кът за отдих<br>
      ✔ Самостоятелна тоалетна и баня с душ<br>
      ✔ Климатик и телевизор<br>
      ✔ Кухненски бокс с микроволнова, хладилник и трапезна маса<br>
      ✔ Безплатен Wi-Fi`,
    };

    return descriptions[room.name] || 'No detailed description available for this room.';
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
