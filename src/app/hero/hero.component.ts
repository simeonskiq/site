import { Component, OnInit, AfterViewInit, HostListener, PLATFORM_ID, Inject, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { TranslationService } from '../services/translation.service';
import { LanguageService } from '../services/language.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-hero',
  imports: [],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.css'
})
export class HeroComponent implements OnInit, AfterViewInit, OnDestroy {
  private isBrowser: boolean;
  translations: any = {};
  private langSubscription: Subscription = new Subscription();
  currentLanguage: string = 'en';

  // Bulgarian translations for the hero component
  private translationKeys = {
    en: {
      title: 'Welcome to Our Website',
      subtitle: 'Discover the best services for your needs',
      bookNow: 'Book Now',
      learnMore: 'Learn More',
      // Add all other English texts from your component here
    },
    bg: {
      title: 'Добре дошли в нашия уебсайт',
      subtitle: 'Открийте най-добрите услуги за вашите нужди',
      bookNow: 'Резервирайте сега',
      learnMore: 'Научете повече',
      // Add all Bulgarian translations here
    }
  };

  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
    private translationService: TranslationService,
    private languageService: LanguageService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  // Typewriter effect phrases
  private phrases: string[] = [
    'Luxury Accommodations',
    'Fine Dining Experience',
    'Relaxing Spa Treatments',
    'Stunning City Views',
    'Exceptional Service'
  ];
  private currentPhraseIndex: number = 0;
  private currentCharIndex: number = 0;
  private isDeleting: boolean = false;
  private typingSpeed: number = 100;
  private scrollIndicatorVisible: boolean = true;

  @HostListener('window:scroll', [])
  onWindowScroll() {
    // Hide scroll indicator when scrolling down, show when at top
    const scrollPosition = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const scrollIndicator = document.querySelector('.scroll-indicator') as HTMLElement;
    
    if (scrollPosition > 100 && this.scrollIndicatorVisible) {
      this.scrollIndicatorVisible = false;
      if (scrollIndicator) {
        scrollIndicator.classList.add('hidden');
      }
    } else if (scrollPosition <= 100 && !this.scrollIndicatorVisible) {
      this.scrollIndicatorVisible = true;
      if (scrollIndicator) {
        scrollIndicator.classList.remove('hidden');
      }
    }
  }

  ngOnInit(): void {
    // Register translations with the translation service
    this.translationService.addTranslations('hero', this.translationKeys);
    
    // Subscribe to language changes
    this.langSubscription = this.languageService.currentLanguage.subscribe((lang: 'en' | 'bg') => {
      this.currentLanguage = lang;
      this.translations = this.translationService.getTranslations('hero', lang);
    });
    
    // Initialize translations with current language
    this.translations = this.translationService.getTranslations('hero', this.languageService.getCurrentLanguage());
    
    // Initialize scroll indicator state
    this.scrollIndicatorVisible = true;
  }

  ngAfterViewInit(): void {
    // Only run typewriter effect in browser environment
    if (this.isBrowser) {
      this.typeWriterEffect();
    }
  }

  private typeWriterEffect(): void {
    // Only access document in browser environment
    if (!this.isBrowser) return;

    const textElement = document.getElementById('typewriter-text');
    if (!textElement) return;

    const currentPhrase = this.phrases[this.currentPhraseIndex];
    
    // Typing or deleting logic
    if (this.isDeleting) {
      // Deleting text
      this.currentCharIndex--;
      this.typingSpeed = 50; // Faster when deleting
    } else {
      // Typing text
      this.currentCharIndex++;
      this.typingSpeed = 150; // Slower when typing
    }

    // Set the text
    textElement.textContent = currentPhrase.substring(0, this.currentCharIndex);

    // Determine if we should change direction
    if (!this.isDeleting && this.currentCharIndex === currentPhrase.length) {
      // Start deleting after a pause
      this.isDeleting = true;
      this.typingSpeed = 1000; // Pause at the end of the phrase
    } else if (this.isDeleting && this.currentCharIndex === 0) {
      // Move to next phrase
      this.isDeleting = false;
      this.currentPhraseIndex = (this.currentPhraseIndex + 1) % this.phrases.length;
      this.typingSpeed = 500; // Pause before starting new phrase
    }

    // Continue the effect
    setTimeout(() => this.typeWriterEffect(), this.typingSpeed);
  }

  navigateToBooking() {
    this.router.navigate(['/booking']);
  }

  navigateToContact() {
    this.router.navigate(['/contact']);
  }

  ngOnDestroy(): void {
    if (this.langSubscription) {
      this.langSubscription.unsubscribe();
    }
  }
}
