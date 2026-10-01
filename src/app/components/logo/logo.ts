import { Component, input } from '@angular/core';

/** SVG paths of the Flowly "F": a stem, three stacked arms and two flowing tails, in tints of one colour. */
export const LOGO_SHAPES = [
  // [x, y, width, opacity]; every shape is 13 units tall with fully rounded ends.
  [20, 4, 13, 1, 56], // stem (height 56)
  [20, 4, 40, 0.42],
  [20, 21, 32, 0.58],
  [20, 38, 24, 0.74],
  [4, 21, 24, 0.86],
  [4, 38, 24, 0.94],
] as const;

export function logoSvg(color: string, size = 64): string {
  const parts = LOGO_SHAPES.map(
    ([x, y, w, o, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h ?? 13}" rx="6.5" fill="${color}" fill-opacity="${o}"/>`,
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">${parts}</svg>`;
}

@Component({
  selector: 'app-logo',
  template: `
    <svg viewBox="0 0 64 64" [attr.width]="size()" [attr.height]="size()" role="img" aria-label="Flowly">
      @for (s of shapes; track $index) {
        <rect [attr.x]="s[0]" [attr.y]="s[1]" [attr.width]="s[2]" [attr.height]="s[4] ?? 13" rx="6.5"
          [attr.fill]="color()" [attr.fill-opacity]="s[3]" />
      }
    </svg>
  `,
  styles: `
    :host { display: inline-flex; }
    rect { transition: fill 0.4s ease; }
  `,
})
export class Logo {
  /** Any CSS colour; defaults to the app accent. */
  readonly color = input<string>('var(--accent)');
  readonly size = input(24);
  protected readonly shapes = LOGO_SHAPES;
}
