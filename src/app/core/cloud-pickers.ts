/**
 * Cloud document pickers. They run entirely in the browser and only hand back links + metadata;
 * Flowly never stores Google or Microsoft tokens.
 */
import { Attachment, PublicConfig } from './models';

type Picked = Pick<Attachment, 'kind' | 'name' | 'url' | 'meta'>;

const loaded = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  if (!loaded.has(src)) {
    loaded.set(
      src,
      new Promise((resolve, reject) => {
        const el = document.createElement('script');
        el.src = src;
        el.async = true;
        el.onload = () => resolve();
        el.onerror = () => {
          loaded.delete(src);
          reject(new Error(`Could not load ${src}`));
        };
        document.head.appendChild(el);
      }),
    );
  }
  return loaded.get(src)!;
}

declare const gapi: any;
declare const google: any;
declare const OneDrive: any;

/** Google Drive: GIS token (drive.file scope) + Google Picker. */
export async function pickFromGoogleDrive(cfg: NonNullable<PublicConfig['google']>): Promise<Picked[]> {
  await Promise.all([loadScript('https://apis.google.com/js/api.js'), loadScript('https://accounts.google.com/gsi/client')]);
  await new Promise<void>((resolve) => gapi.load('picker', () => resolve()));
  const token = await new Promise<string>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: cfg.client_id,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (res: any) => (res.error ? reject(new Error(res.error)) : resolve(res.access_token)),
      error_callback: (err: any) => reject(new Error(err?.message ?? 'Google sign-in was cancelled.')),
    });
    client.requestAccessToken({ prompt: '' });
  });
  return new Promise((resolve) => {
    const picker = new google.picker.PickerBuilder()
      .addView(new google.picker.DocsView().setIncludeFolders(true).setOwnedByMe(false))
      .addView(new google.picker.DocsView().setOwnedByMe(true))
      .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(token)
      .setDeveloperKey(cfg.api_key)
      .setAppId(cfg.app_id)
      .setOrigin(window.location.origin)
      .setCallback((data: any) => {
        if (data.action === google.picker.Action.PICKED) {
          resolve(
            data.docs.map((d: any) => ({
              kind: 'google_drive',
              name: d.name,
              url: d.url,
              meta: { id: d.id, mimeType: d.mimeType, iconUrl: d.iconUrl ?? '' },
            })),
          );
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve([]);
        }
      })
      .build();
    picker.setVisible(true);
  });
}

/**
 * OneDrive (personal) and OneDrive for Business / SharePoint, via Microsoft's OneDrive.js picker.
 * The Entra app needs this page's origin registered as a SPA redirect URI.
 */
export async function pickFromOneDrive(cfg: NonNullable<PublicConfig['microsoft']>): Promise<Picked[]> {
  await loadScript('https://js.live.net/v7.2/OneDrive.js');
  return new Promise((resolve, reject) => {
    OneDrive.open({
      clientId: cfg.client_id,
      action: 'share',
      multiSelect: true,
      viewType: 'all',
      advanced: { redirectUri: window.location.origin + '/', createLinkParameters: { type: 'view', scope: 'organization' } },
      success: (res: any) =>
        resolve(
          (res.value ?? []).map((f: any) => ({
            kind: 'onedrive',
            name: f.name,
            url: f.permissions?.[0]?.link?.webUrl ?? f.webUrl,
            meta: { id: f.id, mimeType: f.file?.mimeType ?? '', size: f.size ?? 0 },
          })),
        ),
      cancel: () => resolve([]),
      error: (e: any) => reject(new Error(e?.message ?? 'OneDrive picker failed.')),
    });
  });
}
