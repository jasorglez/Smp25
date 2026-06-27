import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { alerts } from 'app/helpers/alerts';
import { BranchsService } from 'app/services/branchs.service';
import {
  ActivationCodeResponse,
  ActivationCodeRow,
  ControlDiarioIaService,
  LinkedTelegramUser
} from 'app/services/control-diario-ia.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-control-diario-ia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './control-diario-ia.component.html',
  styleUrl: './control-diario-ia.component.scss'
})
export class ControlDiarioIaComponent {
  private controlService = inject(ControlDiarioIaService);
  private branchesService = inject(BranchsService);
  private signalsService = inject(SignalsService);

  idCompany = 0;
  idBranch = 0;
  idUser = 0;
  branches: any[] = [];
  codes: ActivationCodeRow[] = [];
  linkedUsers: LinkedTelegramUser[] = [];
  generatedCode: ActivationCodeResponse = null;
  expiresInHours = 48;
  loading = false;
  generating = false;

  constructor() {
    effect(() => {
      const company = this.signalsService.getRootSelectedBySidebar()();
      const branch = this.signalsService.getBranchSelectedBySidebar()();
      this.idUser = this.signalsService.getIdUSer()();
      if (!company) return;
      const companyChanged = company !== this.idCompany;
      this.idCompany = company;
      if (companyChanged) this.loadBranches(branch);
      else if (branch && branch !== this.idBranch) {
        this.idBranch = branch;
        this.loadData();
      }
    });
  }

  loadBranches(preferredBranch: number) {
    this.branchesService.getBranches2fields(this.idCompany).subscribe({
      next: (data: any) => {
        this.branches = data || [];
        this.idBranch = preferredBranch || this.branches[0]?.id || 0;
        this.loadData();
      },
      error: () => alerts.basicAlert('Error', 'No fue posible cargar las sucursales.', 'error')
    });
  }

  onBranchChange() {
    this.generatedCode = null;
    this.loadData();
  }

  loadData() {
    if (!this.idCompany || !this.idBranch) return;
    this.loading = true;
    forkJoin({
      codes: this.controlService.getActivationCodes(this.idCompany, this.idBranch),
      users: this.controlService.getLinkedUsers(this.idCompany, this.idBranch)
    }).subscribe({
      next: ({ codes, users }) => {
        this.codes = codes || [];
        this.linkedUsers = users || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        alerts.basicAlert('Error', 'No fue posible cargar Control Diario IA.', 'error');
      }
    });
  }

  generateCode() {
    if (!this.idCompany || !this.idBranch || this.generating) return;
    this.generating = true;
    this.controlService.createActivationCode(this.idCompany, this.idBranch, this.idUser, this.expiresInHours).subscribe({
      next: (response) => {
        this.generatedCode = response;
        this.generating = false;
        this.loadData();
      },
      error: (error) => {
        this.generating = false;
        alerts.basicAlert('Error', error?.error || 'No fue posible generar el código.', 'error');
      }
    });
  }

  copyCode() {
    if (!this.generatedCode?.code) return;
    navigator.clipboard.writeText(this.generatedCode.code).then(() =>
      alerts.basicAlert('Código copiado', 'Ya puedes enviarlo al cliente.', 'success'));
  }

  unlink(user: LinkedTelegramUser) {
    alerts.confirmAlert('Desvincular Telegram', 'El usuario necesitará un código nuevo para volver a entrar.', 'warning', 'Desvincular')
      .then(result => {
        if (!result.isConfirmed) return;
        this.controlService.unlink(user.Id).subscribe({
          next: () => {
            alerts.basicAlert('Desvinculado', 'El acceso de Telegram fue desactivado.', 'success');
            this.loadData();
          },
          error: () => alerts.basicAlert('Error', 'No fue posible desvincular el usuario.', 'error')
        });
      });
  }

  isExpired(value: string) {
    return new Date(value).getTime() < Date.now();
  }
}
