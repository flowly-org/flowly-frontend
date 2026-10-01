import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { TranslatePipe } from '../../core/i18n.pipes';
import { I18nService } from '../../core/i18n.service';
import { Invitation, Membership, Role } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { WorkspaceStore } from '../../core/workspace.store';

@Component({
  selector: 'app-members-page',
  imports: [FormsModule, RouterLink, TranslatePipe],
  templateUrl: './members-page.html',
})
export class MembersPage implements OnInit {
  protected store = inject(WorkspaceStore);
  protected auth = inject(AuthService);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private i18n = inject(I18nService);

  protected invitations = signal<Invitation[]>([]);
  protected inviteEmail = '';
  protected inviteRole: Role = 'member';
  protected confirming = signal<string | null>(null);

  private get wsId() {
    return this.store.currentId()!;
  }

  async ngOnInit() {
    await this.loadInvitations();
  }

  private async loadInvitations() {
    try {
      this.invitations.set(await this.api.invitations(this.wsId));
    } catch {
      this.invitations.set([]);
    }
  }

  async invite() {
    const email = this.inviteEmail.trim();
    if (!email) return;
    try {
      const res = await this.api.addMember(this.wsId, email, this.inviteRole);
      this.inviteEmail = '';
      if (res.status === 202) {
        const link = (res.body as Invitation).link;
        if (link) this.copyLink(link, this.i18n.t('{email} has no account yet. Join link copied: send it to them', { email }));
        else this.toast.show(this.i18n.t('{email} has no account yet. They\'ll join automatically when they sign up with that email.', { email }));
        await this.loadInvitations();
      } else {
        this.toast.show(this.i18n.t('{email} added.', { email }));
        await this.store.refreshMembers();
      }
      await this.store.loadWorkspaces();
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async setRole(m: Membership, role: Role) {
    try {
      await this.api.updateMember(this.wsId, m.id, role);
      await this.store.refreshMembers();
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async remove(m: Membership) {
    this.confirming.set(null);
    const leaving = m.user.id === this.auth.user()?.id;
    try {
      await this.api.removeMember(this.wsId, m.id);
      if (leaving) {
        await this.store.loadWorkspaces();
        this.router.navigateByUrl('/');
      } else {
        await this.store.refreshMembers();
      }
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  /** English label of a role (translated in the template). */
  protected roleLabel(role: Role): string {
    return { owner: 'Owner', admin: 'Admin', member: 'Member' }[role] ?? role;
  }

  protected copyLink(link: string, message?: string) {
    const done = () => this.toast.show(message ?? this.i18n.t('Join link copied.'));
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(link).then(done, () => this.toast.show(link));
      return;
    }
    const area = document.createElement('textarea');
    area.value = link;
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
      done();
    } catch {
      this.toast.show(link);
    }
    area.remove();
  }

  async revoke(inv: Invitation) {
    try {
      await this.api.revokeInvitation(this.wsId, inv.id);
      await this.loadInvitations();
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

}
