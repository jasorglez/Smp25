import { Component, effect, HostListener, inject, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import {AuthService} from "./services/auth.service";
import { SignalsService } from './services/signals.service';
import { ChatbotComponent } from './shared/chatbot/chatbot.component';
import { TrackingService } from './services/tracking.service';
import { environment } from '@env/environment';
import { switchMap } from 'rxjs';
import { PdfPreviewHostComponent } from './shared/pdf-preview-host/pdf-preview-host.component';
import { PdfTrialWatermarkService } from './services/pdf-trial-watermark.service';
import { WorkspaceTabsService } from './services/workspace-tabs.service';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ChatbotComponent, PdfPreviewHostComponent],
  template: '<router-outlet></router-outlet><app-pdf-preview-host></app-pdf-preview-host><app-chatbot></app-chatbot>',
})
export class AppComponent implements OnInit {
  title = 'bi-aug-24';
  private permissionLoadRequest = 0;

  private authService    = inject(AuthService);
  private router         = inject(Router);
  private workspaceTabs  = inject(WorkspaceTabsService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  private pdfTrialWatermark = inject(PdfTrialWatermarkService);

  @HostListener('window:beforeunload')
  onBeforeUnload(): void {
    const payload = this.trackingService.getSessionEndPayload();
    if (payload) {
      // sendBeacon garantiza el envío aunque el browser se cierre
      navigator.sendBeacon(
        `${environment.urlChatBot}/LoginNotification/session-end`,
        new Blob([JSON.stringify(payload)], { type: 'application/json' })
      );
    }
    this.trackingService.clearSession();
  }

  constructor() {
    effect(() => {
      const email = this.signalsService.getemailChoose() || localStorage.getItem('mail');
      const companyId = Number(this.signalsService.getRootSelectedBySidebar()() || 0);

      // Los módulos dependen de empresa y usuario; la sucursal no interviene.
      if (email) {
        this.loadPermissions(email, companyId);
      } else {
        this.permissionLoadRequest++;
        this.authService.setUserPermissions({});
      }
    });
  }

  ngOnInit() {
    // ngOnInit puede permanecer vacío o usarse para otra lógica inicial que no dependa de estos signals.
  }

  private loadPermissions(email: string, companyId: number) {
    const request = ++this.permissionLoadRequest;
    this.authService.setUserPermissions({});
    if (this.authService.isTokenExpired()) { this.authService.logout(); return; }
    this.authService.getUserId(email).pipe(
      switchMap(userId => this.authService.fetchUserPermissions(userId, companyId))
    ).subscribe({
      next: (data: any) => {
        if (request !== this.permissionLoadRequest) return;
        const permissions = data.permissions || {};
        this.authService.setUserPermissions(permissions);
        if (companyId > 0 && permissions.dashboard?.active !== true) {
          const currentPath = this.router.url.split('?')[0];
          const fallbackUrl = this.workspaceTabs.tabs().find(tab => tab.url !== '/dashboard')?.url || '/publicidad';
          this.workspaceTabs.remove('/dashboard');
          if (currentPath === '/dashboard') void this.router.navigateByUrl(fallbackUrl);
        }
      },
      error: error => {
        if (request !== this.permissionLoadRequest) return;
        this.authService.setUserPermissions({});
        console.error('No se pudieron cargar los permisos de la empresa seleccionada:', error);
      }
    });
  }
}
