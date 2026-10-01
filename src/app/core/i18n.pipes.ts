import { formatDate } from '@angular/common';
import { Pipe, PipeTransform, inject } from '@angular/core';

import { I18nService } from './i18n.service';

/** `{{ 'My day' | t }}` · `{{ 'Added {n} tasks' | t: { n: 3 } }}` (impure: follows language changes). */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private i18n = inject(I18nService);

  transform(text: string, params?: Record<string, string | number | null | undefined>): string {
    return this.i18n.t(text, params);
  }
}

/** Like the date pipe, in the chosen language: `{{ value | ldate: 'MMM d' }}`. */
@Pipe({ name: 'ldate', pure: false })
export class LocalDatePipe implements PipeTransform {
  private i18n = inject(I18nService);

  transform(value: string | number | Date | null | undefined, format = 'mediumDate'): string {
    if (value === null || value === undefined || value === '') return '';
    return formatDate(value, format, this.i18n.lang());
  }
}
