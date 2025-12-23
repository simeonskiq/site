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
  // SSR can't read localStorage, so auth UI must be rendered only in the browser
  isBrowser = false;
  private langSubscription: Subscription | null = null;
  private authSubscription: Subscription | null = null;
  isAuthenticated = false;
  currentUser: User | null = null;
  isAdmin = false;
  showUserMenu = false;
  showMobileMenu = false;

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
      this.isAdmin = !!user && (user.role ?? 'User') !== 'User';
      if (!this.isAuthenticated) {
        this.showUserMenu = false;
      }
    });

    // Initialize authentication state
    this.isAuthenticated = this.authService.isAuthenticated();
    this.currentUser = this.authService.getCurrentUser();
    const role = this.currentUser?.role ?? 'User';
    this.isAdmin = role !== 'User';
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

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  closeUserMenu(): void {
    this.showUserMenu = false;
  }

  toggleMobileMenu(): void {
    this.showMobileMenu = !this.showMobileMenu;
  }

  closeMobileMenu(): void {
    this.showMobileMenu = false;
  }
}
