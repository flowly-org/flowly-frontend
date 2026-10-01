import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Invitation, Membership, Role } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { WorkspaceStore } from '../../core/workspace.store';

@Component({
  selector: 'app-members-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './members-page.html',
})
export class MembersPage implements OnInit {
  protected store = inject(WorkspaceStore);
  protected auth = inject(AuthService);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected invitations = signal<Invitation[]>([]);
  protected inviteEmail = '';
  protected inviteRole: Role = 'member';
  protected wsName = this.store.current()?.name ?? '';
  protected wsColor = this.store.current()?.color ?? '#4f46e5';
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
        if (link) this.copyLink(link, `${email} has no account yet. Join link copied: send it to them`);
        else this.toast.show(`${email} has no account yet. They'll join automatically when they sign up with that email.`);
        await this.loadInvitations();
      } else {
        this.toast.show(`${email} added.`);
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

  protected copyLink(link: string, message = 'Join link copied.') {
    const done = () => this.toast.show(message);
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

  async rename() {
    const name = this.wsName.trim();
    if (!name) return;
    try {
      await this.api.updateWorkspace(this.wsId, { name, color: this.wsColor });
      await this.store.loadWorkspaces();
      this.toast.show('Workspace updated.');
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async deleteWorkspace() {
    try {
      await this.api.deleteWorkspace(this.wsId);
      await this.store.loadWorkspaces();
      try {
        localStorage.removeItem('flowly.lastWorkspace');
      } catch {}
      this.router.navigateByUrl('/');
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

}
