import { ChangeDetectorRef, OnDestroy, Pipe, PipeTransform } from '@angular/core';
import { Subscription } from 'rxjs';
import { LanguageService } from '../services/language.service';

@Pipe({
  name: 'appCurrency',
  standalone: true,
  // We want this pipe to react to language changes without changing the input value.
  pure: false
})
export class AppCurrencyPipe implements PipeTransform, OnDestroy {
  private lang: 'en' | 'bg' = 'en';
  private sub: Subscription;

  constructor(
    private languageService: LanguageService,
    private cdr: ChangeDetectorRef
  ) {
    this.sub = this.languageService.currentLanguage$.subscribe((l) => {
      this.lang = l;
      this.cdr.markForCheck();
    });
  }

  transform(
    value: number | string | null | undefined,
    digitsInfo?: string
  ): string | null {
    const currencyCode = this.lang === 'bg' ? 'BGN' : 'USD';
    const n =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value)
          : NaN;
    if (!Number.isFinite(n)) return null;

    // digitsInfo example: "1.0-0" => min 0, max 0
    let minFrac = 0;
    let maxFrac = 0;
    if (digitsInfo) {
      const m = digitsInfo.match(/^\d+\.(\d+)-(\d+)$/);
      if (m) {
        minFrac = Number(m[1]);
        maxFrac = Number(m[2]);
      }
    }

    return new Intl.NumberFormat(this.lang === 'bg' ? 'bg-BG' : 'en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: minFrac,
      maximumFractionDigits: maxFrac
    }).format(n);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}


