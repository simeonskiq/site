import { Component, HostListener, OnInit, PLATFORM_ID, Inject, OnDestroy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { isPlatformBrowser } from '@angular/common';
import { LanguageService } from '../services/language.service';
import { TranslationService } from '../services/translation.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { AuthService, User } from '../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-nav-bar',
  templateUrl: './nav-bar.component.html',
  styleUrls: ['./nav-bar.component.css'],
  standalone: true,
  imports: [RouterModule, TranslatePipe, CommonModule]
})
export class NavBarComponent implements OnInit, OnDestroy {
  private lastScrollPosition = 0;
  isNavbarVisible = true;
  currentLang: 'bg' | 'en' = 'en'; // Default language is English
  private isBrowser: boolean;
  private langSubscription: Subscription | null = null;
  private authSubscription: Subscription | null = null;
  isAuthenticated = false;
  currentUser: User | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private languageService: LanguageService,
    private translationService: TranslationService,
    private authService: AuthService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    // Subscribe to language changes
    this.langSubscription = this.languageService.currentLanguage$.subscribe(lang => {
      this.currentLang = lang;
    });

    // Subscribe to authentication state
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      this.isAuthenticated = !!user;
      this.currentUser = user;
    });

    // Initialize authentication state
    this.isAuthenticated = this.authService.isAuthenticated();
    this.currentUser = this.authService.getCurrentUser();
  }

  logout(): void {
    this.authService.logout();
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    if (this.langSubscription) {
      this.langSubscription.unsubscribe();
    }
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    if (!this.isBrowser) return;
    
    const currentScrollPosition = window.pageYOffset;
    
    // Show navbar when scrolling up, hide when scrolling down
    this.isNavbarVisible = currentScrollPosition < this.lastScrollPosition || currentScrollPosition < 50;
    
    this.lastScrollPosition = currentScrollPosition;
  }

  changeLanguage(lang: 'bg' | 'en'): void {
    this.languageService.setLanguage(lang);
  }
}
