import { Routes } from '@angular/router';
import { BookingComponent } from './booking/booking.component';
import { AboutComponent } from './about/about.component';

export const routes: Routes = [
    { path: '', loadComponent: () => import('./hero/hero.component').then(m => m.HeroComponent), data: { animation: 'HomePage' } },
    { path: 'booking', loadComponent: () => import('./booking/booking.component').then(m => m.BookingComponent), data: { animation: 'BookingPage' } },
    { path: 'contact', loadComponent: () => import('./contact/contact.component').then(m => m.ContactComponent), data: { animation: 'ContactPage' } },
    { path: 'about', component: AboutComponent, data: { animation: 'AboutPage' } },
    { path: 'register', loadComponent: () => import('./register/register.component').then(m => m.RegisterComponent) },
    { path: 'login', loadComponent: () => import('./login/login.component').then(m => m.LoginComponent) }
];
