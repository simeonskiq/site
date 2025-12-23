import { Component, HostListener, OnInit, PLATFORM_ID, Inject, OnDestroy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { isPlatformBrowser } from '@angular/common';
import { LanguageService } from '../services/language.service';
import { TranslationService } from '../services/translation.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { AuthService, User } from '../services/auth.service';
import { Subscription } from 'rxjs';
import { NotificationService, AppNotification } from '../services/notification.service';
import { Router } from '@angular/router';

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
  showNotificationsMenu = false;
  unreadCount = 0;
  notifications: AppNotification[] = [];

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private languageService: LanguageService,
    private translationService: TranslationService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private router: Router
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
        this.showNotificationsMenu = false;
      }
    });

    this.authSubscription?.add(
      this.notificationService.notifications$.subscribe((list) => {
        this.notifications = list.slice(0, 12);
        this.unreadCount = list.filter((n) => !n.read).length;
      })
    );

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
    if (this.showUserMenu) this.showNotificationsMenu = false;
  }

  closeUserMenu(): void {
    this.showUserMenu = false;
  }

  toggleNotificationsMenu(): void {
    this.showNotificationsMenu = !this.showNotificationsMenu;
    if (this.showNotificationsMenu) this.showUserMenu = false;
  }

  closeNotificationsMenu(): void {
    this.showNotificationsMenu = false;
  }

  markAllNotificationsRead(): void {
    this.notificationService.markAllRead();
  }

  clearAllNotifications(): void {
    this.notificationService.clearAll();
  }

  removeNotification(n: AppNotification, event: Event): void {
    event.stopPropagation(); // Prevent triggering openNotification
    this.notificationService.remove(n.id);
  }

  openNotification(n: AppNotification): void {
    this.notificationService.markRead(n.id);
    this.closeNotificationsMenu();
    if (n.link) {
      this.router.navigateByUrl(n.link);
    }
  }

  toggleMobileMenu(): void {
    this.showMobileMenu = !this.showMobileMenu;
  }

  closeMobileMenu(): void {
    this.showMobileMenu = false;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    // Close dropdowns when clicking outside
    this.closeUserMenu();
    this.closeNotificationsMenu();
  }
}
