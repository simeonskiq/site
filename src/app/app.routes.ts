import { Routes } from '@angular/router';
import { BookingComponent } from './booking/booking.component';
import { AboutComponent } from './about/about.component';

export const routes: Routes = [
    { path: '', loadComponent: () => import('./hero/hero.component').then(m => m.HeroComponent) },
    { path: 'booking', loadComponent: () => import('./booking/booking.component').then(m => m.BookingComponent) },
    { path: 'contact', loadComponent: () => import('./contact/contact.component').then(m => m.ContactComponent) },
    { path: 'about', component: AboutComponent }
];
