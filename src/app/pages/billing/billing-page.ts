import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ApiService, errorMessage } from '../../core/api.service';
import { addDays, today } from '../../core/dates';
import { BillingSettings, Invoice, ProjectBillingRow } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { WorkspaceStore } from '../../core/workspace.store';

@Component({
  selector: 'app-billing-page',
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './billing-page.html',
  styleUrl: './billing-page.scss',
})
export class BillingPage implements OnInit {
  protected store = inject(WorkspaceStore);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected settings = signal<BillingSettings | null>(null);
  protected form: Partial<BillingSettings> = {};
  protected projects = signal<ProjectBillingRow[]>([]);
  protected invoices = signal<Invoice[]>([]);
  protected newInvoice = { project: null as number | null, period_start: addDays(today(), -30), period_end: today(), group_by: 'task' };
  protected creating = signal(false);

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
      this.toast.show('Billing settings saved.');
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

  async createInvoice() {
    this.creating.set(true);
    try {
      const inv = await this.api.createInvoice(this.wsId, this.newInvoice);
      this.router.navigate(['/w', this.wsId, 'billing', 'invoices', inv.id]);
    } catch (err) {
      this.toast.error(errorMessage(err, 'Could not create the invoice.'));
    } finally {
      this.creating.set(false);
    }
  }
}
