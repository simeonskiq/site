import { Component, OnInit, HostListener, PLATFORM_ID, Inject, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { TranslationService } from '../services/translation.service';
import { LanguageService } from '../services/language.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-hero',
  imports: [CommonModule],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.css'
})
export class HeroComponent implements OnInit, OnDestroy {
  private isBrowser: boolean;
  translations: any = {};
  private langSubscription: Subscription = new Subscription();
  currentLanguage: string = 'en';
  private scrollIndicatorVisible: boolean = true;
  showScrollToTop: boolean = false;

  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
    private translationService: TranslationService,
    private languageService: LanguageService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    if (!this.isBrowser) return;
    
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

    this.showScrollToTop = scrollPosition > 300;
  }

  ngOnInit(): void {
    // Subscribe to language changes
    this.langSubscription = this.languageService.currentLanguage$.subscribe((lang: 'en' | 'bg') => {
      this.currentLanguage = lang;
      this.loadTranslations();
    });
    
    // Initialize translations with current language
    this.loadTranslations();
    this.scrollIndicatorVisible = true;
  }

  private loadTranslations(): void {
    this.translations = {
      title: this.translationService.translate('hero.title'),
      subtitle: this.translationService.translate('hero.subtitle'),
      bookNow: this.translationService.translate('hero.bookNow'),
      learnMore: this.translationService.translate('hero.learnMore'),
      scrollToExplore: this.translationService.translate('hero.scrollToExplore'),
      gourmetDining: this.translationService.translate('hero.gourmetDining'),
      gourmetDiningDesc: this.translationService.translate('hero.gourmetDiningDesc'),
      luxurySpa: this.translationService.translate('hero.luxurySpa'),
      luxurySpaDesc: this.translationService.translate('hero.luxurySpaDesc'),
      concierge: this.translationService.translate('hero.concierge'),
      conciergeDesc: this.translationService.translate('hero.conciergeDesc'),
      luxuriousAccommodations: this.translationService.translate('hero.luxuriousAccommodations'),
      deluxeApartment: this.translationService.translate('hero.deluxeApartment'),
      deluxeApartmentDesc: this.translationService.translate('hero.deluxeApartmentDesc'),
      executiveSuite: this.translationService.translate('hero.executiveSuite'),
      executiveSuiteDesc: this.translationService.translate('hero.executiveSuiteDesc'),
      upToGuests: this.translationService.translate('hero.upToGuests'),
      guests: this.translationService.translate('hero.guests'),
      night: this.translationService.translate('hero.night'),
      experienceLuxury: this.translationService.translate('hero.experienceLuxury'),
      kingSizeBed: this.translationService.translate('hero.kingSizeBed'),
      queenSizeBed: this.translationService.translate('hero.queenSizeBed'),
      sofaBed: this.translationService.translate('hero.sofaBed'),
      luxuryBathroom: this.translationService.translate('hero.luxuryBathroom'),
      fullyEquippedKitchen: this.translationService.translate('hero.fullyEquippedKitchen'),
      nespressoMachine: this.translationService.translate('hero.nespressoMachine'),
      roomService: this.translationService.translate('hero.roomService')
    };
  }

  navigateToBooking() {
    this.router.navigate(['/booking']);
  }

  navigateToAbout() {
    this.router.navigate(['/about']);
  }

  scrollToTop(): void {
    if (this.isBrowser) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }

  ngOnDestroy(): void {
    if (this.langSubscription) {
      this.langSubscription.unsubscribe();
    }
  }
}
