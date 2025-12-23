import { Injectable } from '@angular/core';
import { LanguageService } from './language.service';
import { BehaviorSubject, map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private translations: { [key: string]: { en: string, bg: string } } = {
    // Navigation
    'nav.home': {
      en: 'Home',
      bg: 'Начало'
    },
    'nav.about': {
      en: 'About',
      bg: 'За нас'
    },
    'nav.booking': {
      en: 'Booking',
      bg: 'Резервации'
    },
    'nav.contact': {
      en: 'Contact',
      bg: 'Контакти'
    },
    
    // Admin Panel
    'admin.panel': {
      en: 'Administration Panel',
      bg: 'Административен панел'
    },
    'admin.pendingReservations': {
      en: 'Pending Reservations',
      bg: 'Чакащи резервации'
    },
    'admin.occupancyRate': {
      en: 'Occupancy Rate',
      bg: 'Процент на заетост'
    },
    'admin.blockedRooms': {
      en: 'Blocked Rooms',
      bg: 'Блокирани стаи'
    },
    'admin.roomsAvailability': {
      en: 'Rooms & Availability',
      bg: 'Стаи и наличност'
    },
    'admin.reservationHistory': {
      en: 'Reservation History',
      bg: 'История на резервациите'
    },
    'admin.id': {
      en: 'ID',
      bg: 'ID'
    },
    'admin.user': {
      en: 'User',
      bg: 'Потребител'
    },
    'admin.userGuest': {
      en: 'User / Guest',
      bg: 'Потребител / Гост'
    },
    'admin.room': {
      en: 'Room',
      bg: 'Стая'
    },
    'admin.dates': {
      en: 'Dates',
      bg: 'Дати'
    },
    'admin.status': {
      en: 'Status',
      bg: 'Статус'
    },
    'admin.actions': {
      en: 'Actions',
      bg: 'Действия'
    },
    'admin.approve': {
      en: 'Approve',
      bg: 'Одобри'
    },
    'admin.reject': {
      en: 'Reject',
      bg: 'Отхвърли'
    },
    'admin.cancel': {
      en: 'Cancel',
      bg: 'Отмени'
    },
    'admin.complete': {
      en: 'Complete',
      bg: 'Завърши'
    },
    'admin.loading': {
      en: 'Loading reservations...',
      bg: 'Зареждане на резервации...'
    },
    'admin.noPending': {
      en: 'No pending reservations.',
      bg: 'Няма чакащи резервации.'
    },
    'admin.noRooms': {
      en: 'No rooms defined yet.',
      bg: 'Все още няма дефинирани стаи.'
    },
    'admin.noReservations': {
      en: 'No reservations yet.',
      bg: 'Все още няма резервации.'
    },
    'admin.searchEmail': {
      en: 'Search by Email:',
      bg: 'Търсене по имейл:'
    },
    'admin.searchDate': {
      en: 'Search by Date:',
      bg: 'Търсене по дата:'
    },
    'admin.searchTag': {
      en: 'Search by Status/Tag:',
      bg: 'Търсене по статус/етикет:'
    },
    'admin.searchRoom': {
      en: 'Search by Room:',
      bg: 'Търсене по стая:'
    },
    'admin.clearSearch': {
      en: 'Clear Search',
      bg: 'Изчисти търсенето'
    },
    'admin.noResults': {
      en: 'No reservations found matching your search criteria.',
      bg: 'Не са намерени резервации, отговарящи на критериите за търсене.'
    },
    'admin.previous': {
      en: 'Previous',
      bg: 'Предишна'
    },
    'admin.next': {
      en: 'Next',
      bg: 'Следваща'
    },
    'admin.page': {
      en: 'Page',
      bg: 'Страница'
    },
    'admin.of': {
      en: 'of',
      bg: 'от'
    },
    'admin.total': {
      en: 'total',
      bg: 'общо'
    },
    'admin.name': {
      en: 'Name',
      bg: 'Име'
    },
    'admin.type': {
      en: 'Type',
      bg: 'Тип'
    },
    'admin.visible': {
      en: 'Visible',
      bg: 'Видима'
    },
    'admin.currentlyBlocked': {
      en: 'Currently Blocked',
      bg: 'В момента блокирана'
    },
    'admin.yes': {
      en: 'Yes',
      bg: 'Да'
    },
    'admin.no': {
      en: 'No',
      bg: 'Не'
    },
    
    // My Reservations
    'reservations.title': {
      en: 'My Reservations',
      bg: 'Моите резервации'
    },
    'reservations.active': {
      en: 'Active Reservations',
      bg: 'Активни резервации'
    },
    'reservations.history': {
      en: 'Reservation History',
      bg: 'История на резервациите'
    },
    'reservations.loading': {
      en: 'Loading your reservations...',
      bg: 'Зареждане на вашите резервации...'
    },
    'reservations.noActive': {
      en: 'You don\'t have any active reservations.',
      bg: 'Нямате активни резервации.'
    },
    'reservations.noHistory': {
      en: 'You don\'t have any reservation history.',
      bg: 'Нямате история на резервации.'
    },
    'reservations.status': {
      en: 'Status:',
      bg: 'Статус:'
    },
    'reservations.checkin': {
      en: 'Check-in:',
      bg: 'Настаняване:'
    },
    'reservations.checkout': {
      en: 'Check-out:',
      bg: 'Освобождаване:'
    },
    'reservations.totalPrice': {
      en: 'Total price:',
      bg: 'Обща цена:'
    },
    'reservations.created': {
      en: 'Created:',
      bg: 'Създадена:'
    },
    'reservations.completedAt': {
      en: 'Completed At:',
      bg: 'Завършена на:'
    },

    // Booking (reservation modal) - keep separate from booking page keys
    'bookingModal.reserve': {
      en: 'Reserve',
      bg: 'Резервирай'
    },
    'bookingModal.firstName': {
      en: 'First Name:',
      bg: 'Име:'
    },
    'bookingModal.firstNamePlaceholder': {
      en: 'Enter first name',
      bg: 'Въведете име'
    },
    'bookingModal.lastName': {
      en: 'Last Name:',
      bg: 'Фамилия:'
    },
    'bookingModal.lastNamePlaceholder': {
      en: 'Enter last name',
      bg: 'Въведете фамилия'
    },
    'bookingModal.phone': {
      en: 'Phone Number:',
      bg: 'Телефон:'
    },
    'bookingModal.phonePlaceholder': {
      en: 'Enter phone number',
      bg: 'Въведете телефон'
    },
    'bookingModal.email': {
      en: 'Email Address:',
      bg: 'Имейл:'
    },
    'bookingModal.emailPlaceholder': {
      en: 'Enter email address',
      bg: 'Въведете имейл'
    },
    'bookingModal.emailReadonlyHint': {
      en: 'Email comes from your profile and cannot be changed here. To update it, change your email in your account settings.',
      bg: 'Имейлът идва от профила ви и не може да се променя тук. За да го обновите, сменете имейла в настройките на акаунта.'
    },
    'bookingModal.noteLabel': {
      en: 'Note / Special requests (optional):',
      bg: 'Бележка / Специални изисквания (по желание):'
    },
    'bookingModal.notePlaceholder': {
      en: 'Anything we should know? (e.g. late check-in)',
      bg: 'Имате ли изисквания? (напр. късно настаняване)'
    },
    'bookingModal.checkInLabel': {
      en: 'Check-in:',
      bg: 'Настаняване:'
    },
    'bookingModal.checkOutLabel': {
      en: 'Check-out:',
      bg: 'Освобождаване:'
    },
    'bookingModal.confirmReservation': {
      en: 'Confirm Reservation',
      bg: 'Потвърди резервация'
    },
    'bookingModal.cancel': {
      en: 'Cancel',
      bg: 'Отказ'
    },
    'reservations.cancel': {
      en: 'Cancel Reservation',
      bg: 'Отмени резервация'
    },
    'reservations.cannotCancel': {
      en: 'This reservation has been approved and cannot be canceled. Please contact support if needed.',
      bg: 'Тази резервация е одобрена и не може да бъде отменена. Моля, свържете се с поддръжката, ако е необходимо.'
    },
    'reservations.canceledBy': {
      en: 'Canceled by you',
      bg: 'Отменена от вас'
    },
    'reservations.canceledByAdmin': {
      en: 'Canceled by admin',
      bg: 'Отменена от администратор'
    },
    'reservations.canceled': {
      en: 'Canceled:',
      bg: 'Отменена:'
    },
    'reservations.searchDate': {
      en: 'Search by Date:',
      bg: 'Търсене по дата:'
    },
    'reservations.searchTags': {
      en: 'Search by Status/Room:',
      bg: 'Търсене по статус/стая:'
    },
    'reservations.clearSearch': {
      en: 'Clear Search',
      bg: 'Изчисти търсенето'
    },
    'reservations.loadingHistory': {
      en: 'Loading reservation history...',
      bg: 'Зареждане на история на резервациите...'
    },
    'reservations.noResults': {
      en: 'No reservations found matching your search criteria.',
      bg: 'Не са намерени резервации, отговарящи на критериите за търсене.'
    },
    
    // Hero Component
    'hero.title': {
      en: 'Welcome to Aurora',
      bg: 'Добре дошли в Аврора'
    },
    'hero.subtitle': {
      en: 'Experience luxury and comfort in the heart of the city',
      bg: 'Изживейте луксоз и комфорт в сърцето на града'
    },
    'hero.bookNow': {
      en: 'Book Now',
      bg: 'Резервирайте сега'
    },
    'hero.learnMore': {
      en: 'Learn More',
      bg: 'Научете повече'
    },
    'hero.scrollToExplore': {
      en: 'Scroll to explore',
      bg: 'Превъртете, за да разгледате'
    },
    'hero.experience': {
      en: 'Experience',
      bg: 'Изживейте'
    },
    'hero.our': {
      en: 'Our',
      bg: 'Нашето'
    },
    'hero.discover': {
      en: 'Discover',
      bg: 'Открийте'
    },
    'hero.luxuryMeetsService': {
      en: 'Where luxury meets exceptional service',
      bg: 'Където луксозът среща изключително обслужване'
    },
    'hero.gourmetDining': {
      en: 'Gourmet Dining',
      bg: 'Гурме кухня'
    },
    'hero.gourmetDiningDesc': {
      en: 'Indulge in exquisite cuisine prepared by our award-winning chefs using the finest local ingredients.',
      bg: 'Насладете се на изискана кухня, приготвена от нашите наградени готвачи, използвайки най-добрите местни продукти.'
    },
    'hero.luxurySpa': {
      en: 'Luxury Spa',
      bg: 'Луксозен спа'
    },
    'hero.luxurySpaDesc': {
      en: 'Rejuvenate your body and mind with our premium spa treatments and wellness facilities.',
      bg: 'Обновете тялото и ума си с нашите премиум спа процедури и здравни съоръжения.'
    },
    'hero.concierge': {
      en: '24/7 Concierge',
      bg: 'Консиерж 24/7'
    },
    'hero.conciergeDesc': {
      en: 'Our dedicated staff is always available to ensure your stay exceeds all expectations.',
      bg: 'Нашият предан персонал винаги е на разположение, за да гарантира, че престоя ви надхвърля всички очаквания.'
    },
    'hero.luxuriousAccommodations': {
      en: 'Luxurious Accommodations',
      bg: 'Луксозни настанявания'
    },
    'hero.deluxeApartment': {
      en: 'Deluxe Apartment',
      bg: 'Делукс апартамент'
    },
    'hero.deluxeApartmentDesc': {
      en: 'Spacious comfort with stunning views and modern amenities',
      bg: 'Просторен комфорт с зашеметяващи гледки и модерни удобства'
    },
    'hero.executiveSuite': {
      en: 'Executive Suite',
      bg: 'Екзекютивен апартамент'
    },
    'hero.executiveSuiteDesc': {
      en: 'Premium accommodation with exclusive amenities',
      bg: 'Премиум настаняване с ексклузивни удобства'
    },
    'hero.upToGuests': {
      en: 'Up to',
      bg: 'До'
    },
    'hero.guests': {
      en: 'guests',
      bg: 'гости'
    },
    'hero.night': {
      en: '/ night',
      bg: '/ нощ'
    },
    'hero.experienceLuxury': {
      en: 'Experience Luxury at Aurora',
      bg: 'Изживейте луксоз в Аврора'
    },
    
    // Booking Component
    'booking.title': {
      en: 'MAKE YOUR RESERVATION',
      bg: 'НАПРАВЕТЕ РЕЗЕРВАЦИЯ'
    },
    'booking.subtitle': {
      en: 'Plan your perfect stay with us. Select your preferred dates and discover our available accommodations. Each room is thoughtfully designed to provide comfort and relaxation during your visit.',
      bg: 'Планирайте перфектния си престой с нас. Изберете предпочитаните дати и открийте наличните ни настанявания. Всяка стая е внимателно проектирана, за да осигури комфорт и релакс по време на вашето посещение.'
    },
    'booking.selectDates': {
      en: 'Select Your Dates',
      bg: 'Изберете вашите дати'
    },
    'booking.checkIn': {
      en: 'Check In',
      bg: 'Настаняване'
    },
    'booking.checkOut': {
      en: 'Check Out',
      bg: 'Освобождаване'
    },
    'booking.checkAvailability': {
      en: 'Check Availability',
      bg: 'Проверете наличността'
    },
    'booking.availableAccommodations': {
      en: 'Available Accommodations',
      bg: 'Налични настанявания'
    },
    'booking.noRooms': {
      en: 'No rooms available for the selected dates.',
      bg: 'Няма налични стаи за избраните дати.'
    },
    'booking.selectRoom': {
      en: 'Select Room',
      bg: 'Изберете стая'
    },
    'booking.reserve': {
      en: 'Reserve',
      bg: 'Резервирай'
    },
    'booking.details': {
      en: 'Details',
      bg: 'Детайли'
    },
    'booking.perNight': {
      en: 'per night',
      bg: 'на нощ'
    },
    
    // Contact Component
    'contact.title': {
      en: 'Contact Us',
      bg: 'Свържете се с нас'
    },
    'contact.subtitle': {
      en: 'Get in touch with our team',
      bg: 'Свържете се с нашия екип'
    },
    'contact.name': {
      en: 'Name',
      bg: 'Име'
    },
    'contact.email': {
      en: 'Email',
      bg: 'Имейл'
    },
    'contact.phone': {
      en: 'Phone',
      bg: 'Телефон'
    },
    'contact.message': {
      en: 'Message',
      bg: 'Съобщение'
    },
    'contact.submit': {
      en: 'Submit',
      bg: 'Изпрати'
    },
    'contact.address': {
      en: 'Address',
      bg: 'Адрес'
    },
    'contact.phoneLabel': {
      en: 'Phone',
      bg: 'Телефон'
    },
    'contact.emailLabel': {
      en: 'Email',
      bg: 'Имейл'
    },
    'contact.successMessage': {
      en: 'Your message has been sent successfully!',
      bg: 'Вашето съобщение беше изпратено успешно!'
    },
    'contact.errorMessage': {
      en: 'There was an error sending your message. Please try again.',
      bg: 'Възникна грешка при изпращането на вашето съобщение. Моля, опитайте отново.'
    },
    
    // About Component
    'about.ourStory': {
      en: 'Our Story',
      bg: 'Нашата история'
    },
    'about.storyContent': {
      en: 'Founded in 2010, we have been providing exceptional services to our clients for over a decade...',
      bg: 'Основана през 2010 г., ние предоставяме изключителни услуги на нашите клиенти вече повече от десетилетие...'
    },
    'about.ourMission': {
      en: 'Our Mission',
      bg: 'Нашата мисия'
    },
    'about.missionContent': {
      en: 'We are committed to delivering high-quality services that exceed our clients\' expectations...',
      bg: 'Ние сме ангажирани да предоставяме висококачествени услуги, които надминават очакванията на нашите клиенти...'
    },
    'about.ourTeam': {
      en: 'Our Team',
      bg: 'Нашият екип'
    },
    'about.teamContent': {
      en: 'Our team consists of highly skilled professionals dedicated to providing the best service...',
      bg: 'Нашият екип се състои от висококвалифицирани професионалисти, посветени на предоставянето на най-добрата услуга...'
    },
    'about.luxuriousAccommodations': {
      en: 'Luxurious Accommodations',
      bg: 'Луксозни настанявания'
    },
    'about.deluxeSuites': {
      en: 'Deluxe Suites',
      bg: 'Делукс апартаменти'
    },
    'about.oceanViewRooms': {
      en: 'Ocean View Rooms',
      bg: 'Стаи с изглед към океана'
    },
    'about.privateVillas': {
      en: 'Private Villas',
      bg: 'Частни вили'
    },
    'about.resortAmenities': {
      en: 'Resort Amenities',
      bg: 'Удобства на курорта'
    },
    
    // Login Component
    'login.welcomeBack': {
      en: 'Welcome Back',
      bg: 'Добре дошли отново'
    },
    'login.signIn': {
      en: 'Sign in to your account',
      bg: 'Влезте в профила си'
    },
    'login.email': {
      en: 'Email',
      bg: 'Имейл'
    },
    'login.password': {
      en: 'Password',
      bg: 'Парола'
    },
    'login.enterEmail': {
      en: 'Enter your email',
      bg: 'Въведете вашия имейл'
    },
    'login.enterPassword': {
      en: 'Enter your password',
      bg: 'Въведете вашата парола'
    },
    'login.signingIn': {
      en: 'Signing In...',
      bg: 'Влизане...'
    },
    'login.noAccount': {
      en: 'Don\'t have an account?',
      bg: 'Нямате акаунт?'
    },
    'login.signUp': {
      en: 'Sign Up',
      bg: 'Регистрирай се'
    },
    'login.invalidCredentials': {
      en: 'Invalid email or password. Please try again.',
      bg: 'Невалиден имейл или парола. Моля, опитайте отново.'
    },
    'login.emailRequired': {
      en: 'Email is required',
      bg: 'Имейлът е задължителен'
    },
    'login.passwordRequired': {
      en: 'Password is required',
      bg: 'Паролата е задължителна'
    },
    'login.validEmail': {
      en: 'Please enter a valid email address',
      bg: 'Моля, въведете валиден имейл адрес'
    },
    
    // Register Component
    'register.createAccount': {
      en: 'Create Account',
      bg: 'Създай акаунт'
    },
    'register.signUp': {
      en: 'Sign up to start your journey with us',
      bg: 'Регистрирайте се, за да започнете пътуването си с нас'
    },
    'register.firstName': {
      en: 'First Name',
      bg: 'Собствено име'
    },
    'register.lastName': {
      en: 'Last Name',
      bg: 'Фамилия'
    },
    'register.email': {
      en: 'Email',
      bg: 'Имейл'
    },
    'register.phone': {
      en: 'Phone (Optional)',
      bg: 'Телефон (По избор)'
    },
    'register.password': {
      en: 'Password',
      bg: 'Парола'
    },
    'register.confirmPassword': {
      en: 'Confirm Password',
      bg: 'Потвърди парола'
    },
    'register.creatingAccount': {
      en: 'Creating Account...',
      bg: 'Създаване на акаунт...'
    },
    'register.createAccountButton': {
      en: 'Create Account',
      bg: 'Създай акаунт'
    },
    'register.haveAccount': {
      en: 'Already have an account?',
      bg: 'Вече имате акаунт?'
    },
    'register.signIn': {
      en: 'Sign In',
      bg: 'Влез'
    },
    'register.registrationFailed': {
      en: 'Registration failed. Please try again.',
      bg: 'Регистрацията не беше успешна. Моля, опитайте отново.'
    },
    
    // Profile Component
    'profile.title': {
      en: 'My Profile',
      bg: 'Моят профил'
    },
    'profile.loading': {
      en: 'Loading profile...',
      bg: 'Зареждане на профил...'
    },
    'profile.personalInformation': {
      en: 'Personal Information',
      bg: 'Лична информация'
    },
    'profile.firstName': {
      en: 'First Name',
      bg: 'Собствено име'
    },
    'profile.lastName': {
      en: 'Last Name',
      bg: 'Фамилия'
    },
    'profile.phone': {
      en: 'Phone',
      bg: 'Телефон'
    },
    'profile.save': {
      en: 'Save',
      bg: 'Запази'
    },
    'profile.email': {
      en: 'Email',
      bg: 'Имейл'
    },
    'profile.emailHint': {
      en: 'This email will be used for reservations and login.',
      bg: 'Този имейл ще се използва за резервации и влизане.'
    },
    'profile.changeEmail': {
      en: 'Change Email',
      bg: 'Промени имейл'
    },
    'profile.password': {
      en: 'Password',
      bg: 'Парола'
    },
    'profile.currentPassword': {
      en: 'Current Password',
      bg: 'Текуща парола'
    },
    'profile.newPassword': {
      en: 'New Password',
      bg: 'Нова парола'
    },
    'profile.changePassword': {
      en: 'Change Password',
      bg: 'Промени парола'
    },
    'profile.updatedSuccessfully': {
      en: 'Profile updated successfully',
      bg: 'Профилът е актуализиран успешно'
    },
    'profile.emailChangedSuccessfully': {
      en: 'Email changed successfully.',
      bg: 'Имейлът е променен успешно.'
    },
    'profile.passwordUpdatedSuccessfully': {
      en: 'Password updated successfully',
      bg: 'Паролата е актуализирана успешно'
    },
    'profile.failedToLoad': {
      en: 'Failed to load profile',
      bg: 'Неуспешно зареждане на профил'
    },
    'profile.failedToUpdate': {
      en: 'Failed to update profile',
      bg: 'Неуспешна актуализация на профил'
    },
    'profile.failedToUpdateEmail': {
      en: 'Failed to update email',
      bg: 'Неуспешна промяна на имейл'
    },
    'profile.failedToUpdatePassword': {
      en: 'Failed to update password',
      bg: 'Неуспешна промяна на парола'
    },
    'profile.emailExists': {
      en: 'An account with this email already exists. Please use a different email address.',
      bg: 'Вече съществува акаунт с този имейл. Моля, използвайте друг имейл адрес.'
    },
    
    // Nav Bar
    'nav.signIn': {
      en: 'Sign In',
      bg: 'Вход'
    },
    'nav.register': {
      en: 'Register',
      bg: 'Регистрация'
    },
    'login.signInButton': {
      en: 'Sign In',
      bg: 'Вход'
    },
    'nav.adminPanel': {
      en: 'Admin Panel',
      bg: 'Административен панел'
    },
    'nav.myProfile': {
      en: 'My Profile',
      bg: 'Моят профил'
    },
    'nav.myReservations': {
      en: 'My Reservations',
      bg: 'Моите резервации'
    },
    'nav.logout': {
      en: 'Logout',
      bg: 'Излез'
    },
    
    // Hotel name
    'hotel.name': {
      en: 'Aurora',
      bg: 'Аврора'
    }
  };

  // Component-specific translations
  private componentTranslations: { [component: string]: { [lang: string]: { [key: string]: string } } } = {};

  private translationsSubject = new BehaviorSubject<{ [key: string]: string }>({});
  translations$ = this.translationsSubject.asObservable();

  constructor(private languageService: LanguageService) {
    // Update translations when language changes
    this.languageService.currentLanguage$.subscribe(lang => {
      this.updateTranslations(lang);
    });
    
    // Initialize with current language
    this.updateTranslations(this.languageService.getCurrentLanguage());
  }

  private updateTranslations(language: 'en' | 'bg'): void {
    const currentTranslations: { [key: string]: string } = {};
    
    for (const key in this.translations) {
      currentTranslations[key] = this.translations[key][language];
    }
    
    this.translationsSubject.next(currentTranslations);
  }

  translate(key: string): string {
    const currentTranslations = this.translationsSubject.value;
    return currentTranslations[key] || key;
  }

  getTranslation(key: string) {
    return this.translations$.pipe(
      map(translations => translations[key] || key)
    );
  }

  // Add new translations programmatically
  addTranslation(key: string, enValue: string, bgValue: string): void {
    this.translations[key] = { en: enValue, bg: bgValue };
    this.updateTranslations(this.languageService.getCurrentLanguage());
  }

  // Add component-specific translations
  addTranslations(component: string, translations: { [lang: string]: { [key: string]: string } }): void {
    this.componentTranslations[component] = translations;
  }

  // Get component-specific translations
  getTranslations(component: string, language: string): { [key: string]: string } {
    if (this.componentTranslations[component] && this.componentTranslations[component][language]) {
      return this.componentTranslations[component][language];
    }
    return {};
  }
}