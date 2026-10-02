import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ApiService, errorMessage } from '../../core/api.service';
import { I18nService } from '../../core/i18n.service';
import { LocalDatePipe, TranslatePipe } from '../../core/i18n.pipes';
import { Invoice } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { WorkspaceStore } from '../../core/workspace.store';

@Component({
  selector: 'app-invoice-page',
  imports: [FormsModule, RouterLink, TranslatePipe, LocalDatePipe],
  templateUrl: './invoice-page.html',
  styleUrl: './invoice-page.scss',
})
export class InvoicePage implements OnInit {
  readonly invoiceId = input.required<string>();

  protected store = inject(WorkspaceStore);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private i18n = inject(I18nService);

  protected readonly statusLabels: Record<string, string> = { draft: 'Draft', sent: 'Sent', paid: 'Paid', void: 'Void' };

  protected invoice = signal<Invoice | null>(null);
  protected confirmDelete = signal(false);
  protected edit: Partial<Invoice> = {};
  protected missing = signal<string[]>([]);
  protected xmlBusy = signal(false);

  private get wsId() {
    return this.store.currentId()!;
  }

  async ngOnInit() {
    try {
      const inv = await this.api.invoice(this.wsId, +this.invoiceId());
      this.invoice.set(inv);
      this.edit = { client_name: inv.client_name, client_details: inv.client_details, notes: inv.notes, due_date: inv.due_date };
    } catch (err) {
      this.toast.error(errorMessage(err, this.i18n.t('Invoice not found.')));
    }
  }

  async save(data: Partial<Invoice>) {
    const inv = this.invoice();
    if (!inv) return;
    try {
      this.invoice.set(await this.api.updateInvoice(this.wsId, inv.id, data));
      this.toast.show(this.i18n.t('Invoice updated.'));
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async remove() {
    const inv = this.invoice();
    if (!inv) return;
    try {
      await this.api.deleteInvoice(this.wsId, inv.id);
      this.router.navigate(['/w', this.wsId, 'billing']);
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async downloadCsv() {
    const inv = this.invoice();
    if (!inv) return;
    const text = await this.api.invoiceCsv(this.wsId, inv.id);
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${inv.number}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async downloadXml() {
    const inv = this.invoice();
    if (!inv) return;
    this.xmlBusy.set(true);
    try {
      const check = await this.api.einvoiceCheck(this.wsId, inv.id);
      this.missing.set(check.missing);
      if (!check.ok) return;
      const blob = await this.api.einvoiceXml(this.wsId, inv.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = check.filename ?? `${inv.number}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      this.toast.error(errorMessage(err, this.i18n.t('Could not create the e-invoice.')));
    } finally {
      this.xmlBusy.set(false);
    }
  }

  protected print() {
    window.print();
  }
}
