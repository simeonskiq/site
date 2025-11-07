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
    
    // Add more translations as needed
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