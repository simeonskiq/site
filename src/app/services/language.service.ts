import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private currentLanguageSubject = new BehaviorSubject<'bg' | 'en'>('en');
  currentLanguage$ = this.currentLanguageSubject.asObservable();
  // Add alias for backward compatibility
  currentLanguage = this.currentLanguage$;
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    
    // Initialize from localStorage if in browser
    if (this.isBrowser) {
      const savedLang = localStorage.getItem('preferredLanguage') as 'bg' | 'en' | null;
      if (savedLang && (savedLang === 'bg' || savedLang === 'en')) {
        this.currentLanguageSubject.next(savedLang);
      }
    }
  }

  setLanguage(language: 'bg' | 'en') {
    this.currentLanguageSubject.next(language);
    
    // Save to localStorage if in browser
    if (this.isBrowser) {
      localStorage.setItem('preferredLanguage', language);
    }
  }

  getCurrentLanguage(): 'bg' | 'en' {
    return this.currentLanguageSubject.value;
  }
}