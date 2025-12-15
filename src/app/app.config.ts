import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideClientHydration(),
    provideHttpClient(
      withFetch(),
      withInterceptors([
        (req, next) => {
          // Simple functional interceptor for attaching JWT from localStorage
          if (typeof window === 'undefined') {
            return next(req);
          }

          const token = window.localStorage.getItem('auth_token');
          if (!token) {
            return next(req);
          }

          const authReq = req.clone({
            setHeaders: {
              Authorization: `Bearer ${token}`
            }
          });

          return next(authReq);
        }
      ])
    ),
    provideAnimations()
  ]
};
