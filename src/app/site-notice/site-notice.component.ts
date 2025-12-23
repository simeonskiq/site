import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

type PrefChoice = 'accept' | 'decline';

@Component({
  selector: 'app-site-notice',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './site-notice.component.html',
  styleUrls: ['./site-notice.component.css']
})
export class SiteNoticeComponent {
  private readonly key = 'site_pref_v1';
  isBrowser = false;
  isVisible = false;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (!this.isBrowser) return;

    const existing = window.localStorage.getItem(this.key);
    this.isVisible = !existing;
  }

  choose(choice: PrefChoice): void {
    if (!this.isBrowser) return;
    window.localStorage.setItem(this.key, choice);
    this.isVisible = false;
  }
}


