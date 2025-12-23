import { CurrencyPipe } from '@angular/common';
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
    private currencyPipe: CurrencyPipe,
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
    return this.currencyPipe.transform(value, currencyCode, 'symbol', digitsInfo);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}


