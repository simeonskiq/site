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
      en: 'Booking ID',
      bg: 'Номер резервация'
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
    'bookingModal.confirmReservationTitle': {
      en: 'Confirm Reservation',
      bg: 'Потвърди резервация'
    },
    'bookingModal.confirmReservationMessage': {
      en: 'Are you sure you want to confirm your reservation?',
      bg: 'Сигурни ли сте, че искате да потвърдите резервацията си?'
    },
    'bookingModal.confirmButton': {
      en: 'Confirm',
      bg: 'Потвърди'
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
    'hero.kingSizeBed': {
      en: 'King-size bed',
      bg: 'Голямо двойно легло'
    },
    'hero.queenSizeBed': {
      en: 'Queen-size bed',
      bg: 'Двойно легло'
    },
    'hero.sofaBed': {
      en: 'sofa bed',
      bg: 'разтегателен диван'
    },
    'hero.luxuryBathroom': {
      en: 'Luxury bathroom',
      bg: 'Луксозна баня'
    },
    'hero.fullyEquippedKitchen': {
      en: 'Fully equipped kitchen',
      bg: 'Напълно оборудвана кухня'
    },
    'hero.nespressoMachine': {
      en: 'Nespresso machine',
      bg: 'Машина Nespresso'
    },
    'hero.roomService': {
      en: '24/7 room service',
      bg: 'Обслужване в стаята 24/7'
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
    'booking.guests': {
      en: 'guests',
      bg: 'гости'
    },
    'booking.bathroom': {
      en: 'bathroom',
      bg: 'баня'
    },
    'booking.bathrooms': {
      en: 'bathrooms',
      bg: 'бани'
    },
    'booking.reserveNow': {
      en: 'Reserve Now',
      bg: 'Резервирай сега'
    },
    'booking.viewDetails': {
      en: 'View Details',
      bg: 'Виж детайли'
    },
    'booking.noRoomsTitle': {
      en: 'No rooms available',
      bg: 'Няма налични стаи'
    },
    'booking.noRoomsMessage': {
      en: 'We\'re sorry, but there are no available rooms for the selected dates. Please try selecting different dates.',
      bg: 'Съжаляваме, но няма налични стаи за избраните дати. Моля, опитайте да изберете различни дати.'
    },
    'booking.close': {
      en: 'Close',
      bg: 'Затвори'
    },
    'booking.roomDescription.apart1': {
      en: 'Enjoy comfort and privacy in our One-Bedroom Apartment. The main bedroom features a comfortable double bed, and the living area is equipped with a pull-out sofa, suitable for additional guests. The apartment offers a fully equipped kitchenette where you can prepare your favorite meals, as well as a spacious terrace, ideal for morning coffee or evening relaxation. In addition, it has a private bathroom, air conditioning, TV and free Wi-Fi.',
      bg: 'Насладете се на комфорт и уединение в нашия Апартамент с една спалня. Основната спалня разполага с удобно двойно легло, а дневната зона е оборудвана с разтегателен диван, подходящ за допълнителни гости. Апартаментът предлага напълно оборудван кухненски бокс, където можете да приготвяте любимите си ястия, както и просторна тераса, идеална за сутрешно кафе или вечерен релакс. Освен това, разполага със самостоятелна баня, климатик, телевизор и безплатен Wi-Fi.'
    },
    'booking.roomDescription.apart1.features': {
      en: '✔ Bedroom with double bed<br>✔ Living area with pull-out sofa<br>✔ Spacious terrace with relaxation area<br>✔ Air conditioning and TV<br>✔ Kitchenette with oven, refrigerator and dining table<br>✔ Private bathroom with shower<br>✔ Free Wi-Fi',
      bg: '✔ Спалня с двойно легло<br>✔ Дневна зона с разтегателен диван<br>✔ Просторна тераса с кът за отдих<br>✔ Климатик и телевизор<br>✔ Кухненски бокс с фурна, хладилник и трапезна маса<br>✔ Самостоятелна тоалетна и баня с душ<br>✔ Безплатен Wi-Fi'
    },
    'booking.roomDescription.apart2': {
      en: 'If you\'re looking for space and comfort, this apartment is for you! It features a separate bedroom with a double bed and a living area with a pull-out sofa, where two more guests can stay overnight. Light enters through the large windows, and the terrace offers a wonderful place to relax with a view. The kitchenette is fully equipped with everything you might need, and the private bathroom is modernly furnished with a bathtub. The air conditioning, TV and free Wi-Fi will make your stay even more pleasant.',
      bg: 'Ако търсите простор и удобство, този апартамент е за вас! Разполага с отделна спалня с двойно легло и дневна зона с разтегателен диван, където може да нощуват още двама гости. Светлината навлиза през големите прозорци, а терасата предлага чудесно място за отдих с изглед. Кухненският бокс е напълно оборудван с всичко от което бийте имали нужда, а самостоятелната баня е модерно обзавена с вана. Климатикът, телевизорът и безплатният Wi-Fi ще направят престоя ви още по-приятен.'
    },
    'booking.roomDescription.apart2.features': {
      en: '✔ Bedroom with double bed<br>✔ Living area with pull-out sofa<br>✔ Spacious terrace with relaxation area<br>✔ Air conditioning and TV<br>✔ Kitchenette with oven, refrigerator and dining table<br>✔ Private bathroom with bathtub and shower<br>✔ Free Wi-Fi',
      bg: '✔ Спалня с двойно легло<br>✔ Дневна зона с разтегателен диван<br>✔ Просторна тераса с кът за отдих<br>✔ Климатик и телевизор<br>✔ Кухненски бокс с фурна, хладилник и трапезна маса<br>✔ Самостоятелна тоалетна и баня с вана и душ<br>✔ Безплатен Wi-Fi'
    },
    'booking.roomDescription.apart3': {
      en: 'Perfect for those seeking coziness and tranquility, this one-bedroom apartment combines comfort and functionality. The bedroom features a large double bed, and the living area offers a pull-out sofa, suitable for additional guests. In the apartment you will also find a kitchenette with all amenities, a private bathroom with bathtub and shower, and a wide terrace with a relaxation area. The air conditioning, TV and free Wi-Fi guarantee comfort and a pleasant atmosphere.',
      bg: 'Перфектен за тези, които търсят уют и спокойствие, този апартамент с една спалня съчетава комфорт и функционалност. Спалнята разполага с голямо двойно легло, а дневната зона предлага разтегателен диван, подходящ за допълнителни гости. В апартамента ще откриете още кухненски бокс с всички удобства, самостоятелна баня с вана и душ, и широка тераса с кът за отдих. Климатиците, телевизорът и безплатният Wi-Fi гарантират удобство и приятна атмосфера.'
    },
    'booking.roomDescription.apart3.features': {
      en: '✔ Bedroom with double bed<br>✔ Living area with pull-out sofa<br>✔ Spacious terrace with relaxation area<br>✔ Air conditioning and TV<br>✔ Kitchenette with oven, refrigerator and dining table<br>✔ Private bathroom with bathtub and shower<br>✔ Free Wi-Fi',
      bg: '✔ Спалня с двойно легло<br>✔ Дневна зона с разтегателен диван<br>✔ Просторна тераса с кът за отдих<br>✔ Климатик и телевизор<br>✔ Кухненски бокс с фурна, хладилник и трапезна маса<br>✔ Самостоятелна тоалетна и баня с вана и душ<br>✔ Безплатен Wi-Fi'
    },
    'booking.roomDescription.studio': {
      en: 'Our Studio offers coziness and comfort with modern interior and a terrace where you can enjoy your morning coffee or evening breeze. The main space includes a pull-out sofa, a fully equipped kitchenette with microwave, refrigerator and dining table. In the studio you will also find air conditioning, TV and free Wi-Fi for your convenience.',
      bg: 'Нашето Студио предлага уют и удобство с модерен интериор и тераса, където можете да се насладите на сутрешното си кафе или вечерния бриз. Основното пространство включва разтегателен диван, напълно оборудван кухненски бокс с микроволнова, хладилник и трапезна маса. В студиото ще откриете още климатик, телевизор и безплатен Wi-Fi за вашето удобство.'
    },
    'booking.roomDescription.studio.features': {
      en: '✔ Pull-out sofa for two<br>✔ Spacious terrace with relaxation area<br>✔ Private bathroom with shower<br>✔ Air conditioning and TV<br>✔ Kitchenette with microwave, refrigerator and dining table<br>✔ Free Wi-Fi',
      bg: '✔ Разтегателен диван за двама<br>✔ Просторна тераса с кът за отдих<br>✔ Самостоятелна тоалетна и баня с душ<br>✔ Климатик и телевизор<br>✔ Кухненски бокс с микроволнова, хладилник и трапезна маса<br>✔ Безплатен Wi-Fi'
    },
    'booking.noDescription': {
      en: 'No detailed description available for this room.',
      bg: 'Няма налично подробно описание за тази стая.'
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
    'contact.submitting': {
      en: 'Sending...',
      bg: 'Изпращане...'
    },
    'contact.subject': {
      en: 'Subject',
      bg: 'Тема'
    },
    'contact.subjectPlaceholder': {
      en: 'Select a subject',
      bg: 'Изберете тема'
    },
    'contact.generalInquiry': {
      en: 'General Inquiry',
      bg: 'Обща заявка'
    },
    'contact.reservationQuestion': {
      en: 'Reservation Question',
      bg: 'Въпрос относно резервация'
    },
    'contact.complaint': {
      en: 'Complaint',
      bg: 'Жалба'
    },
    'contact.feedback': {
      en: 'Feedback',
      bg: 'Обратна връзка'
    },
    'contact.other': {
      en: 'Other',
      bg: 'Друго'
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
    'about.storyContent2': {
      en: 'What started as a boutique beachfront property has evolved into a world-class destination, consistently recognized for our commitment to sustainability, luxury accommodations, and personalized experiences that create lasting memories.',
      bg: 'Това, което започна като бутиков имот на брега, се превърна в световна дестинация, последователно призната за нашата ангажираност към устойчивост, луксозни настанявания и персонализирани преживявания, които създават незабравими спомени.'
    },
    'about.storyContent3': {
      en: 'Our dedicated team of hospitality professionals works tirelessly to ensure every aspect of your stay exceeds expectations, from the moment you arrive until your reluctant departure.',
      bg: 'Нашият предан екип от професионалисти в сферата на хотелиерството работи неуморно, за да гарантира, че всеки аспект от престоя ви надхвърля очакванията, от момента на пристигането ви до неохотното ви напускане.'
    },
    'about.deluxeSuitesDesc': {
      en: 'Spacious rooms with premium amenities and breathtaking views',
      bg: 'Просторни стаи с премиум удобства и зашеметяващи гледки'
    },
    'about.oceanViewRoomsDesc': {
      en: 'Wake up to stunning panoramic views of the crystal-clear waters',
      bg: 'Събудете се с зашеметяващи панорамни гледки към кристално чистите води'
    },
    'about.privateVillasDesc': {
      en: 'Ultimate privacy with dedicated concierge service and exclusive amenities',
      bg: 'Пълна поверителност с персонализирано обслужване от консиерж и ексклузивни удобства'
    },
    'about.infinityPool': {
      en: 'Infinity Pool',
      bg: 'Безкраен басейн'
    },
    'about.infinityPoolDesc': {
      en: 'Our signature infinity pool overlooks the ocean, creating a seamless blend with the horizon.',
      bg: 'Нашият фирмен безкраен басейн се открива към океана, създавайки безпроблемно сливане с хоризонта.'
    },
    'about.spaWellness': {
      en: 'Spa & Wellness',
      bg: 'Спа и Здраве'
    },
    'about.spaWellnessDesc': {
      en: 'Rejuvenate your body and mind with our comprehensive spa treatments and wellness programs.',
      bg: 'Обновете тялото и ума си с нашите всеобхватни спа процедури и здравни програми.'
    },
    'about.fineDining': {
      en: 'Fine Dining',
      bg: 'Изискана кухня'
    },
    'about.fineDiningDesc': {
      en: 'Experience culinary excellence at our three award-winning restaurants featuring local and international cuisine.',
      bg: 'Изживейте кулинарно майсторство в нашите три наградени ресторанта, предлагащи местна и международна кухня.'
    },
    'about.waterActivities': {
      en: 'Water Activities',
      bg: 'Водни дейности'
    },
    'about.waterActivitiesDesc': {
      en: 'From snorkeling to sailing, our water sports center offers activities for all skill levels.',
      bg: 'От гмуркане с шнорхел до плаване, нашият център за водни спортове предлага дейности за всички нива на умения.'
    },
    'about.sustainabilityCommitment': {
      en: 'Our Commitment to Sustainability',
      bg: 'Нашата ангажираност към устойчивост'
    },
    'about.sustainabilityContent1': {
      en: 'At Serenity Shores, we believe in responsible luxury. Our resort operates on 80% renewable energy, implements comprehensive recycling programs, and sources over 60% of our ingredients from local farmers and fishermen.',
      bg: 'В Serenity Shores вярваме в отговорен луксоз. Нашият курорт работи с 80% възобновяема енергия, прилага всеобхватни програми за рециклиране и доставя над 60% от нашите продукти от местни фермери и рибари.'
    },
    'about.sustainabilityContent2': {
      en: 'We actively participate in coral reef restoration projects and beach clean-up initiatives, ensuring that the natural beauty surrounding our resort remains pristine for generations to come.',
      bg: 'Активно участваме в проекти за възстановяване на коралови рифове и инициативи за почистване на плажовете, гарантирайки, че естествената красота около нашия курорт остава девствена за бъдещите поколения.'
    },
    'about.sustainabilityContent3': {
      en: 'By choosing Serenity Shores, you\'re not just experiencing luxury—you\'re supporting sustainable tourism practices that protect and preserve our precious environment.',
      bg: 'Като изберете Serenity Shores, вие не просто изживявате луксоз—вие подкрепяте устойчиви туристически практики, които защитават и запазват нашата ценна околна среда.'
    },
    'about.meetLeadershipTeam': {
      en: 'Meet Our Leadership Team',
      bg: 'Запознайте се с нашия ръководен екип'
    },
    'about.ceo': {
      en: 'Chief Executive Officer',
      bg: 'Главен изпълнителен директор'
    },
    'about.ceoDesc': {
      en: 'With over 20 years in luxury hospitality, Alexandra brings vision and innovation to Serenity Shores.',
      bg: 'С над 20 години опит в луксозното хотелиерство, Александра внася визия и иновации в Serenity Shores.'
    },
    'about.directorOperations': {
      en: 'Director of Operations',
      bg: 'Директор по операциите'
    },
    'about.directorOperationsDesc': {
      en: 'Marcus ensures flawless execution of every aspect of our resort experience.',
      bg: 'Маркъс гарантира безупречното изпълнение на всеки аспект от преживяването в нашия курорт.'
    },
    'about.executiveChef': {
      en: 'Executive Chef',
      bg: 'Главен готвач'
    },
    'about.executiveChefDesc': {
      en: 'Award-winning culinary artist creating unforgettable dining experiences.',
      bg: 'Награден кулинарен артист, създаващ незабравими гастрономически преживявания.'
    },
    'about.resortExteriorView': {
      en: 'Resort exterior view',
      bg: 'Външен изглед на курорта'
    },
    'about.deluxeSuite': {
      en: 'Deluxe suite',
      bg: 'Делукс апартамент'
    },
    'about.oceanViewRoom': {
      en: 'Ocean view room',
      bg: 'Стая с изглед към океана'
    },
    'about.privateVilla': {
      en: 'Private villa',
      bg: 'Частна вила'
    },
    'about.resortPool': {
      en: 'Resort pool',
      bg: 'Басейн на курорта'
    },
    'about.beachConservation': {
      en: 'Beach conservation',
      bg: 'Запазване на плажа'
    },
    'about.ceoPortrait': {
      en: 'CEO portrait',
      bg: 'Портрет на главен директор'
    },
    'about.operationsDirectorPortrait': {
      en: 'Operations Director portrait',
      bg: 'Портрет на директор по операциите'
    },
    'about.chefPortrait': {
      en: 'Chef portrait',
      bg: 'Портрет на готвач'
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