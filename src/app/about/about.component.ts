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
    // Subscribe to language changes
    this.langSubscription = this.languageService.currentLanguage$.subscribe((lang: 'en' | 'bg') => {
      this.currentLanguage = lang;
      this.loadTranslations();
    });
    
    // Initialize translations with current language
    this.loadTranslations();

    // Only execute window-related code in browser environment
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo(0, 0); // Scroll to top when component loads
    }
  }

  private loadTranslations(): void {
    this.translations = {
      ourStory: this.translationService.translate('about.ourStory'),
      storyContent: this.translationService.translate('about.storyContent'),
      storyContent2: this.translationService.translate('about.storyContent2'),
      storyContent3: this.translationService.translate('about.storyContent3'),
      luxuriousAccommodations: this.translationService.translate('about.luxuriousAccommodations'),
      deluxeSuites: this.translationService.translate('about.deluxeSuites'),
      deluxeSuitesDesc: this.translationService.translate('about.deluxeSuitesDesc'),
      oceanViewRooms: this.translationService.translate('about.oceanViewRooms'),
      oceanViewRoomsDesc: this.translationService.translate('about.oceanViewRoomsDesc'),
      privateVillas: this.translationService.translate('about.privateVillas'),
      privateVillasDesc: this.translationService.translate('about.privateVillasDesc'),
      resortAmenities: this.translationService.translate('about.resortAmenities'),
      infinityPool: this.translationService.translate('about.infinityPool'),
      infinityPoolDesc: this.translationService.translate('about.infinityPoolDesc'),
      spaWellness: this.translationService.translate('about.spaWellness'),
      spaWellnessDesc: this.translationService.translate('about.spaWellnessDesc'),
      fineDining: this.translationService.translate('about.fineDining'),
      fineDiningDesc: this.translationService.translate('about.fineDiningDesc'),
      waterActivities: this.translationService.translate('about.waterActivities'),
      waterActivitiesDesc: this.translationService.translate('about.waterActivitiesDesc'),
      sustainabilityCommitment: this.translationService.translate('about.sustainabilityCommitment'),
      sustainabilityContent1: this.translationService.translate('about.sustainabilityContent1'),
      sustainabilityContent2: this.translationService.translate('about.sustainabilityContent2'),
      sustainabilityContent3: this.translationService.translate('about.sustainabilityContent3'),
      meetLeadershipTeam: this.translationService.translate('about.meetLeadershipTeam'),
      ceo: this.translationService.translate('about.ceo'),
      ceoDesc: this.translationService.translate('about.ceoDesc'),
      directorOperations: this.translationService.translate('about.directorOperations'),
      directorOperationsDesc: this.translationService.translate('about.directorOperationsDesc'),
      executiveChef: this.translationService.translate('about.executiveChef'),
      executiveChefDesc: this.translationService.translate('about.executiveChefDesc'),
      resortExteriorView: this.translationService.translate('about.resortExteriorView'),
      deluxeSuite: this.translationService.translate('about.deluxeSuite'),
      oceanViewRoom: this.translationService.translate('about.oceanViewRoom'),
      privateVilla: this.translationService.translate('about.privateVilla'),
      resortPool: this.translationService.translate('about.resortPool'),
      beachConservation: this.translationService.translate('about.beachConservation'),
      ceoPortrait: this.translationService.translate('about.ceoPortrait'),
      operationsDirectorPortrait: this.translationService.translate('about.operationsDirectorPortrait'),
      chefPortrait: this.translationService.translate('about.chefPortrait')
    };
  }

  ngOnDestroy(): void {
    if (this.langSubscription) {
      this.langSubscription.unsubscribe();
    }
  }
} 