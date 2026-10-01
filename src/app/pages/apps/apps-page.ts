import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Logo } from '../../components/logo/logo';
import { AuthService } from '../../core/auth.service';
import { LocalDatePipe, TranslatePipe } from '../../core/i18n.pipes';

const REPO = 'flowly-org/flowly-releases';
const DOWNLOAD = `https://github.com/${REPO}/releases/latest/download/`;

type Platform = 'mac' | 'windows' | 'linux' | 'android' | 'ios' | 'other';

interface Download {
  file: string;
  label: string;
  note?: string;
}

interface AppCard {
  platform: Platform;
  icon: string;
  name: string;
  what: string;
  downloads: Download[];
  firstRun: string;
}

const CARDS: AppCard[] = [
  {
    platform: 'mac', icon: '⌘', name: 'macOS', what: 'Tray time tracker for Apple silicon and Intel Macs.',
    downloads: [{ file: 'Flowly-macOS-universal.dmg', label: 'Download for Mac' }],
    firstRun: 'First time: right-click Flowly in Applications and choose Open (the app is not signed yet).',
  },
  {
    platform: 'windows', icon: '⊞', name: 'Windows', what: 'Tray time tracker for Windows 10 and 11.',
    downloads: [
      { file: 'Flowly-Windows-x64-setup.exe', label: 'Download installer' },
      { file: 'Flowly-Windows-x64.msi', label: '.msi', note: 'for managed PCs' },
    ],
    firstRun: 'If SmartScreen warns you: More info → Run anyway (the app is not signed yet).',
  },
  {
    platform: 'linux', icon: '🐧', name: 'Linux', what: 'Tray time tracker for x86-64 desktops.',
    downloads: [
      { file: 'Flowly-Linux-x86_64.AppImage', label: 'AppImage' },
      { file: 'Flowly-Linux-amd64.deb', label: '.deb', note: 'Debian, Ubuntu' },
      { file: 'Flowly-Linux-x86_64.rpm', label: '.rpm', note: 'Fedora, openSUSE' },
    ],
    firstRun: 'AppImage: make it executable (chmod +x) and run it. A tray icon appears.',
  },
  {
    platform: 'android', icon: '🤖', name: 'Android', what: 'Your day, tasks and timer on your phone.',
    downloads: [{ file: 'Flowly-Android.apk', label: 'Download APK' }],
    firstRun: 'Open the file and allow installing from your browser or file manager when asked.',
  },
];

function detect(): Platform {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/mac os x|macintosh/i.test(ua)) return 'mac';
  if (/windows/i.test(ua)) return 'windows';
  if (/linux|x11/i.test(ua)) return 'linux';
  return 'other';
}

/** Public page listing every way to use Flowly: desktop and mobile apps, the web app, chat and AI assistants. */
@Component({
  selector: 'app-apps-page',
  imports: [RouterLink, Logo, TranslatePipe, LocalDatePipe],
  templateUrl: './apps-page.html',
  styleUrl: './apps-page.scss',
})
export class AppsPage {
  protected auth = inject(AuthService);
  protected readonly platform = detect();
  protected readonly releaseUrl = `https://github.com/${REPO}/releases/latest`;
  protected readonly checksumsUrl = DOWNLOAD + 'SHA256SUMS.txt';
  protected readonly webUrl = window.location.origin.startsWith('http') ? window.location.origin : 'https://app.flowly.net';

  protected release = signal<{ version: string; date: string; sizes: Record<string, number> } | null>(null);

  /** The card for this device first. */
  protected readonly cards = computed(() => [...CARDS].sort((a, b) => Number(b.platform === this.platform) - Number(a.platform === this.platform)));

  constructor() {
    this.loadRelease();
  }

  private async loadRelease() {
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const sizes: Record<string, number> = {};
      for (const a of data.assets ?? []) sizes[a.name] = a.size;
      this.release.set({ version: String(data.tag_name ?? '').replace(/^v/, ''), date: data.published_at, sizes });
    } catch {
      // Rate-limited or offline: the stable download links still work, just without version and sizes.
    }
  }

  protected href(file: string) {
    return DOWNLOAD + file;
  }

  protected size(file: string): string {
    const bytes = this.release()?.sizes[file];
    if (!bytes) return '';
    return bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(bytes > 10_000_000 ? 0 : 1)} MB` : `${Math.round(bytes / 1000)} kB`;
  }
}
