import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { addDays, today } from '../../core/dates';
import { I18nService } from '../../core/i18n.service';
import { LocalDatePipe, TranslatePipe } from '../../core/i18n.pipes';
import { BillingSettings, Invoice, ProjectBillingRow } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { WorkspaceStore } from '../../core/workspace.store';

@Component({
  selector: 'app-billing-page',
  imports: [FormsModule, RouterLink, TranslatePipe, LocalDatePipe],
  templateUrl: './billing-page.html',
  styleUrl: './billing-page.scss',
})
export class BillingPage implements OnInit {
  protected store = inject(WorkspaceStore);
  protected auth = inject(AuthService);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private i18n = inject(I18nService);

  protected readonly statusLabels: Record<string, string> = { draft: 'Draft', sent: 'Sent', paid: 'Paid', void: 'Void' };

  protected settings = signal<BillingSettings | null>(null);
  protected form: Partial<BillingSettings> = {};
  protected projects = signal<ProjectBillingRow[]>([]);
  protected invoices = signal<Invoice[]>([]);
  protected newInvoice = { project: null as number | null, period_start: addDays(today(), -30), period_end: today(), group_by: 'task' };
  protected creating = signal(false);
  protected clientOpen = signal<number | null>(null);
  protected client: Partial<ProjectBillingRow> = {};

  private get wsId() {
    return this.store.currentId()!;
  }

  async ngOnInit() {
    await Promise.all([this.load(), this.loadInvoices()]);
  }

  private async load() {
    try {
      const res = await this.api.billing(this.wsId);
      this.settings.set(res.settings);
      this.form = { ...res.settings };
      this.projects.set(res.projects);
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  private async loadInvoices() {
    try {
      this.invoices.set(await this.api.invoices(this.wsId));
    } catch {}
  }

  async saveSettings() {
    try {
      const res = await this.api.updateBilling(this.wsId, this.form);
      this.settings.set(res.settings);
      this.form = { ...res.settings };
      this.projects.set(res.projects);
      this.toast.show(this.i18n.t('Billing settings saved.'));
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async toggleEnabled(enabled: boolean) {
    this.form.enabled = enabled;
    await this.saveSettings();
  }

  async updateProject(row: ProjectBillingRow, data: Partial<ProjectBillingRow>) {
    try {
      await this.api.updateProjectBilling(this.wsId, row.project, data);
      await this.load();
    } catch (err) {
      this.toast.error(errorMessage(err));
      await this.load();
    }
  }

  protected toggleClient(row: ProjectBillingRow) {
    if (this.clientOpen() === row.project) {
      this.clientOpen.set(null);
      return;
    }
    const { client_details, client_vat, client_vat_country, client_tax_code, client_address, client_zip, client_city,
      client_province, client_country, client_sdi_code, client_pec, client_email, client_reference } = row;
    this.client = { client_details, client_vat, client_vat_country, client_tax_code, client_address, client_zip, client_city,
      client_province, client_country, client_sdi_code, client_pec, client_email, client_reference };
    this.clientOpen.set(row.project);
  }

  async saveClient(row: ProjectBillingRow) {
    const data = { ...this.client };
    if (data.client_sdi_code) data.client_sdi_code = data.client_sdi_code.toUpperCase();
    if (data.client_province) data.client_province = data.client_province.toUpperCase();
    if (data.client_country) data.client_country = data.client_country.toUpperCase();
    await this.updateProject(row, data);
    this.clientOpen.set(null);
    this.toast.show(this.i18n.t('Client saved.'));
  }

  async createInvoice() {
    this.creating.set(true);
    try {
      const inv = await this.api.createInvoice(this.wsId, this.newInvoice);
      this.router.navigate(['/w', this.wsId, 'billing', 'invoices', inv.id]);
    } catch (err) {
      this.toast.error(errorMessage(err, this.i18n.t('Could not create the invoice.')));
    } finally {
      this.creating.set(false);
    }
  }
}
