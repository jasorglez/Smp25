import { Component, effect, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import {AuthService} from "./services/auth.service";
import { SignalsService } from './services/signals.service';
import { ChatbotComponent } from './shared/chatbot/chatbot.component';
import { TrackingService } from './services/tracking.service';
import { environment } from '@env/environment';
import { catchError, concat, EMPTY, exhaustMap, Subscription, switchMap, tap, timer } from 'rxjs';
import { PdfPreviewHostComponent } from './shared/pdf-preview-host/pdf-preview-host.component';
import { PdfTrialWatermarkService } from './services/pdf-trial-watermark.service';
import { WorkspaceTabsService } from './services/workspace-tabs.service';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ChatbotComponent, PdfPreviewHostComponent],
  template: '<router-outlet></router-outlet><app-pdf-preview-host></app-pdf-preview-host><app-chatbot></app-chatbot>',
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'bi-aug-24';
  private permissionLoadRequest = 0;
  private permissionContextKey = '';
  private permissionSyncSubscription: Subscription | null = null;
  private activePermissionUserId: number | null = null;
  private activePermissionCompanyId = 0;

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
      const contextKey = `${String(email || '').toLowerCase()}|${companyId}`;
      if (contextKey === this.permissionContextKey) return;
      this.permissionContextKey = contextKey;
      this.permissionSyncSubscription?.unsubscribe();
      this.permissionSyncSubscription = null;
      this.activePermissionUserId = null;
      this.activePermissionCompanyId = companyId;

      // Los módulos dependen de empresa y usuario; la sucursal no interviene.
      if (email) {
        const request = ++this.permissionLoadRequest;
        this.startPermissionSync(email, companyId, request);
      } else {
        this.permissionLoadRequest++;
        this.authService.setUserPermissions({});
      }
    });
  }

  ngOnInit() {
    // ngOnInit puede permanecer vacío o usarse para otra lógica inicial que no dependa de estos signals.
  }

  ngOnDestroy(): void {
    this.permissionSyncSubscription?.unsubscribe();
  }

  @HostListener('window:focus')
  onWindowFocus(): void {
    this.refreshPermissionsNow();
  }

  private startPermissionSync(email: string, companyId: number, request: number): void {
    this.authService.setUserPermissions({});
    if (this.authService.isTokenExpired()) { this.authService.logout(); return; }
    this.permissionSyncSubscription = this.authService.getUserId(email).pipe(
      switchMap(userId => {
        if (request !== this.permissionLoadRequest) return EMPTY;
        this.activePermissionUserId = userId;
        this.activePermissionCompanyId = companyId;
        const initialLoad = this.authService.fetchUserPermissions(userId, companyId).pipe(
          tap((data: any) => this.applyPermissions(data, companyId, request)),
          catchError(error => {
            console.warn('No se pudieron cargar los permisos inicialmente; se volverá a intentar automáticamente.', error);
            return EMPTY;
          })
        );
        const refreshes = timer(10000, 10000).pipe(
          exhaustMap(() => this.fetchPermissionsKeepingLast(userId, companyId, request))
        );
        return concat(initialLoad, refreshes);
      })
    ).subscribe({
      error: error => {
        if (request !== this.permissionLoadRequest) return;
        this.authService.setUserPermissions({});
        console.error('No se pudieron cargar los permisos de la empresa seleccionada:', error);
      }
    });
  }

  private refreshPermissionsNow(): void {
    if (this.activePermissionUserId === null || this.authService.isTokenExpired()) return;
    this.fetchPermissionsKeepingLast(
      this.activePermissionUserId,
      this.activePermissionCompanyId,
      this.permissionLoadRequest
    ).subscribe();
  }

  private fetchPermissionsKeepingLast(userId: number, companyId: number, request: number) {
    return this.authService.fetchUserPermissions(userId, companyId).pipe(
      tap((data: any) => this.applyPermissions(data, companyId, request)),
      catchError(error => {
        if (request === this.permissionLoadRequest) {
          if (error?.status === 401 || error?.status === 403) this.authService.setUserPermissions({});
          console.warn('No se pudieron actualizar los permisos; se conservan los últimos permisos válidos.', error);
        }
        return EMPTY;
      })
    );
  }

  private applyPermissions(data: any, companyId: number, request: number): void {
    if (request !== this.permissionLoadRequest) return;
    if (companyId !== Number(this.signalsService.getRootSelectedBySidebar()() || 0)) return;
    const permissions = data?.permissions || {};
    this.authService.setUserPermissions(permissions);
    if (companyId > 0 && permissions.dashboard?.active !== true) {
      const currentPath = this.router.url.split('?')[0];
      const fallbackUrl = this.workspaceTabs.tabs().find(tab => tab.url !== '/dashboard')?.url || '/publicidad';
      this.workspaceTabs.remove('/dashboard');
      if (currentPath === '/dashboard') void this.router.navigateByUrl(fallbackUrl);
    }
  }
}
