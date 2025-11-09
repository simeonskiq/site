import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, HostListener } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { TranslationService } from '../services/translation.service';
import { LanguageService } from '../services/language.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-about',
  standalone: true,
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.css'],
  imports: [CommonModule]
})
export class AboutComponent implements OnInit, OnDestroy {
  translations: any = {};
  private langSubscription: Subscription = new Subscription();
  currentLanguage: string = 'en';
  showScrollToTop: boolean = false;
  private isBrowser: boolean;

  // Bulgarian translations for the about component
  private translationKeys = {
    en: {
      title: 'About Us',
      subtitle: 'Learn more about our company and mission',
      ourStory: 'Our Story',
      storyContent: 'Founded in 2010, we have been providing exceptional services to our clients for over a decade...',
      ourMission: 'Our Mission',
      missionContent: 'We are committed to delivering high-quality services that exceed our clients\' expectations...',
      ourTeam: 'Our Team',
      teamContent: 'Our team consists of highly skilled professionals dedicated to providing the best service...',
      // Add all other English texts from your component here
    },
    bg: {
      title: 'За нас',
      subtitle: 'Научете повече за нашата компания и мисия',
      ourStory: 'Нашата история',
      storyContent: 'Основана през 2010 г., ние предоставяме изключителни услуги на нашите клиенти вече повече от десетилетие...',
      ourMission: 'Нашата мисия',
      missionContent: 'Ние сме ангажирани да предоставяме висококачествени услуги, които надминават очакванията на нашите клиенти...',
      ourTeam: 'Нашият екип',
      teamContent: 'Нашият екип се състои от висококвалифицирани професионалисти, посветени на предоставянето на най-добрата услуга...',
      // Add all Bulgarian translations here
    }
  };

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private translationService: TranslationService,
    private languageService: LanguageService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    if (this.isBrowser) {
      const scrollPosition = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      this.showScrollToTop = scrollPosition > 300;
    }
  }

  scrollToTop(): void {
    if (this.isBrowser) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }

  ngOnInit(): void {
    // Register translations with the translation service
    this.translationService.addTranslations('about', this.translationKeys);
    
    // Subscribe to language changes
    this.langSubscription = this.languageService.currentLanguage.subscribe((lang: 'en' | 'bg') => {
      this.currentLanguage = lang;
      this.translations = this.translationService.getTranslations('about', lang);
    });
    
    // Initialize translations with current language
    this.translations = this.translationService.getTranslations('about', this.languageService.getCurrentLanguage());

    // Only execute window-related code in browser environment
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo(0, 0); // Scroll to top when component loads
    }
  }

  ngOnDestroy(): void {
    if (this.langSubscription) {
      this.langSubscription.unsubscribe();
    }
  }
} 