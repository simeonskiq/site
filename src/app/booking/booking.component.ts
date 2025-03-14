import { Component, PLATFORM_ID, Inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';

interface Room {
  id: number;
  title: string;
  type: string;
  description: string;
  imageUrl: string;
  isCarousel: boolean;
  images?: string[];
  currentImageIndex?: number;
}

@Component({
  selector: 'app-booking',
  templateUrl: './booking.component.html',
  styleUrls: ['./booking.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDatepickerModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatNativeDateModule
  ]
})
export class BookingComponent {
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

  images: string[] = [
    '../../assets/images/apart1/IMG_3734.JPEG',
    '../../assets/images/apart1/IMG_3735.JPEG',
    '../../assets/images/apart1/IMG_3736.JPEG',
    '../../assets/images/apart1/IMG_3737.JPEG',
    '../../assets/images/apart1/IMG_3738.JPEG',
    '../../assets/images/apart1/IMG_3740.JPEG',
    '../../assets/images/apart1/IMG_3741.JPEG',
    '../../assets/images/apart1/IMG_3742.JPEG',
    '../../assets/images/apart1/IMG_3743.JPEG',
    '../../assets/images/apart1/IMG_3744.JPEG',
    '../../assets/images/apart1/IMG_3745.JPEG'
  ];

  currentImageIndex = 0;
  currentImage = this.images[0];

  private isBrowser: boolean;

  constructor(
    private dialog: MatDialog,
    private router: Router,
    private http: HttpClient,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.today.setHours(0, 0, 0, 0);
  }

  private initializeMap() {
    if (this.isBrowser) {
      // Leaflet-related code here
    }
  }

  onCheckinDateChange(event: any) {
    if (event) {
      const nextDay = new Date(event);
      nextDay.setDate(nextDay.getDate() + 1);
      this.minCheckoutDate = nextDay;

      if (this.checkoutDate && this.checkoutDate < nextDay) {
        this.checkoutDate = null;
      }
    }
  }

  searchRooms() {
    if (!this.checkinDate || !this.checkoutDate) {
      alert('Please select both check-in and check-out dates');
      return;
    }

    if (this.checkoutDate <= this.checkinDate) {
      alert('Check-out date must be after check-in date');
      return;
    }

    this.rooms = [
      {
        id: 1,
        title: 'Luxury Apartment',
        type: 'Premium Suite',
        description: 'Beautifully designed apartment featuring modern amenities and comfortable living spaces. This spacious accommodation offers a perfect blend of style and comfort, making your stay memorable.',
        imageUrl: '../../assets/images/apart1/IMG_3734.JPEG',
        isCarousel: true,
        images: [...this.images],
        currentImageIndex: 0
      },
      {
        id: 2,
        title: 'Deluxe Room',
        type: 'Double Room',
        description: 'Comfortable room with modern amenities',
        imageUrl: '../../assets/images/deluxe-room.jpg',
        isCarousel: false
      },
      {
        id: 3,
        title: 'Family Room',
        type: 'Family Suite',
        description: 'Perfect for families, includes kitchen area',
        imageUrl: '../../assets/images/family-room.jpg',
        isCarousel: false
      }
    ];
    
    this.searched = true;
  }

  contactAboutRoom(room: Room) {
    this.selectedRoom = room;
    this.showReservationForm = true;
  }

  nextImage(room: Room) {
    if (room.images && room.currentImageIndex !== undefined) {
      room.currentImageIndex = (room.currentImageIndex + 1) % room.images.length;
      room.imageUrl = room.images[room.currentImageIndex];
    }
  }

  previousImage(room: Room) {
    if (room.images && room.currentImageIndex !== undefined) {
      room.currentImageIndex = (room.currentImageIndex - 1 + room.images.length) % room.images.length;
      room.imageUrl = room.images[room.currentImageIndex];
    }
  }

  confirmReservation() {
    if (!this.reservationData.name1 || !this.reservationData.name2 || !this.reservationData.phone) {
      alert('Please fill in all required fields');
      return;
    }

    if (!this.selectedRoom) {
      alert('Please select a room first');
      return;
    }

    // Prepare email data with complete booking information
    const emailData = {
      customerEmail: this.reservationData.email,
      adminEmail: 'admin@yourdomain.com', // Replace with actual admin email
      reservation: {
        ...this.reservationData,
        checkinDate: this.checkinDate,
        checkoutDate: this.checkoutDate,
        room: {
          title: this.selectedRoom.title,
          type: this.selectedRoom.type,
          description: this.selectedRoom.description
        }
      }
    };

    // Send emails through your backend API
    this.http.post('/api/send-reservation-emails', emailData).subscribe({
      next: (response) => {
        alert('Reservation confirmed! Check your email for details.');
        this.showReservationForm = false;
        this.resetReservationForm();
      },
      error: (error) => {
        console.error('Error sending reservation emails:', error);
        alert('There was an error processing your reservation. Please try again.');
      }
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
}
