import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export interface ActivationCodeResponse {
  code: string;
  idCompany: number;
  idBranch: number;
  branchName: string;
  expiresAt: string;
}

export interface ActivationCodeRow {
  Id: number;
  codeHint: string;
  expiresAt: string;
  usedAt?: string;
  isUsed: boolean;
  createdAt: string;
}

export interface LinkedTelegramUser {
  Id: number;
  telegramUserId: number;
  telegramChatId: number;
  displayName: string;
  activatedAt: string;
  lastAccessAt: string;
  isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class ControlDiarioIaService {
  private http = inject(HttpClient);
  private tracking = inject(TrackingService);
  private base = `${environment.urlAdministration}/ControlDiarioIA`;

  createActivationCode(idCompany: number, idBranch: number, createdByUserId: number, expiresInHours = 48) {
    return this.http.post<ActivationCodeResponse>(`${this.base}/activation-code`,
      { idCompany, idBranch, createdByUserId, expiresInHours },
      { headers: this.tracking.getHeaders() });
  }

  getActivationCodes(idCompany: number, idBranch: number) {
    return this.http.get<ActivationCodeRow[]>(`${this.base}/activation-codes/${idCompany}/${idBranch}`,
      { headers: this.tracking.getHeaders() });
  }

  getLinkedUsers(idCompany: number, idBranch: number) {
    return this.http.get<LinkedTelegramUser[]>(`${this.base}/linked-users/${idCompany}/${idBranch}`,
      { headers: this.tracking.getHeaders() });
  }

  unlink(id: number) {
    return this.http.delete<void>(`${this.base}/linked-users/${id}`, { headers: this.tracking.getHeaders() });
  }
}
