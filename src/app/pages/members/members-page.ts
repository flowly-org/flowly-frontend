import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Invitation, Membership, Role } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { WorkspaceStore } from '../../core/workspace.store';

@Component({
  selector: 'app-members-page',
  imports: [FormsModule],
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
  protected profileName = this.auth.user()?.full_name ?? '';
  protected githubLogin = this.auth.user()?.github_login ?? '';
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
        this.toast.show(`${email} has no account yet. They'll join automatically when they sign up with that email.`);
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

  async saveProfile() {
    try {
      await this.auth.updateProfile({ full_name: this.profileName.trim(), github_login: this.githubLogin.trim() });
      await this.store.refreshMembers();
      this.toast.show('Profile updated.');
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }
}
