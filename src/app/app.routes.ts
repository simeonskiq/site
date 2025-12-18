import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./hero/hero.component').then((m) => m.HeroComponent),
    data: { animation: 'HomePage' }
  },
  {
    path: 'booking',
    loadComponent: () =>
      import('./booking/booking.component').then((m) => m.BookingComponent),
    data: { animation: 'BookingPage' }
  },
  {
    path: 'contact',
    loadComponent: () =>
      import('./contact/contact.component').then((m) => m.ContactComponent),
    data: { animation: 'ContactPage' }
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./about/about.component').then((m) => m.AboutComponent),
    data: { animation: 'AboutPage' }
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./register/register.component').then((m) => m.RegisterComponent)
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./admin/admin.component').then((m) => m.AdminComponent)
  },
  {
    path: 'my-reservations',
    loadComponent: () =>
      import('./my-reservations/my-reservations.component').then(
        (m) => m.MyReservationsComponent
      )
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./profile/profile.component').then((m) => m.ProfileComponent)
  }
];
