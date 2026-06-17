import { Component, effect, inject, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { AuthService } from './services/auth.service';
import { SignalsService } from './services/signals.service';
import { ItemChatOverlayComponent } from './shared/item-comments-cell-renderer/item-chat-overlay.component';
import { ComparacionPreciosComponent } from './domains/ModShoppingDelison/pages/quote-delison/comparacion-precios.component';
import { ComparacionOverlayService, ComparacionOverlayData } from './services/comparacion-overlay.service';
import { DetalleItemsProveedorComponent } from './domains/ModShoppingDelison/pages/quote-delison/detalle-items-proveedor.component';
import { ProveedorItemsOverlayService, ProveedorItemsOverlayData } from './services/proveedor-items-overlay.service';
import { UnsavedChangesTrackerService } from './services/unsaved-changes-tracker.service';
import { EntradaDocumentsOverlayService, EntradaDocumentsOverlayData } from './services/entrada-documents-overlay.service';
import { DetailEntradaDocumentsComponent } from './domains/ModProduction/Components/molienda/almmolienda/detail-entrada-documents/detail-entrada-documents.component';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ItemChatOverlayComponent, CommonModule, ComparacionPreciosComponent, DetalleItemsProveedorComponent, DetailEntradaDocumentsComponent],
  template: `
    <router-outlet></router-outlet>
    <app-item-chat-overlay></app-item-chat-overlay>

    <!-- Modal Comparación de Precios — nivel raíz para evitar el transform de AG Grid -->
    <div *ngIf="comparacionData"
         style="position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:10000; display:flex; align-items:center; justify-content:center; padding:16px;"
         (click)="closeComparacion()">
      <div style="background:#fff; border-radius:10px; width:82vw; max-width:100%; height:95vh; display:flex; flex-direction:column; box-shadow:0 8px 40px rgba(0,0,0,0.3); overflow:hidden;"
           (click)="$event.stopPropagation()">
        <app-comparacion-precios
          [cotizacionId]="comparacionData.cotizacionId"
          [cotizacionFolio]="comparacionData.cotizacionFolio"
          [requisitionId]="comparacionData.requisitionId"
          [requisitionFolio]="comparacionData.requisitionFolio"
          [selectedProviderIds]="comparacionData.selectedProviderIds"
          [idBranchFromReq]="comparacionData.idBranchFromReq"
          [idDepartamentFromReq]="comparacionData.idDepartamentFromReq"
          [departmentName]="comparacionData.departmentName"
          [deptPrefijoFromReq]="comparacionData.deptPrefijoFromReq || ''"
          (closed)="closeComparacion()"
          style="display:flex; flex-direction:column; height:100%;">
        </app-comparacion-precios>
      </div>
    </div>

    <!-- Modal Documentos de Entrada — nivel raíz para evitar el transform de AG Grid -->
    <div *ngIf="entradaDocumentsData"
         style="position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:10000; display:flex; align-items:center; justify-content:center; padding:16px;"
         (click)="closeEntradaDocuments()">
      <div style="background:#fff; border-radius:10px; width:90vw; max-width:100%; height:92vh; display:flex; flex-direction:column; box-shadow:0 8px 40px rgba(0,0,0,0.3); overflow:hidden;"
           (click)="$event.stopPropagation()">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 16px; background:#1e3a5f; flex-shrink:0; border-radius:10px 10px 0 0;">
          <span style="font-weight:600; color:#fff; font-size:0.95rem;">
            <i class="bi bi-file-earmark-text" style="margin-right:8px;"></i>
            Documentos — Entrada #{{ entradaDocumentsData.idEntrada }}
          </span>
          <button type="button" class="btn-close btn-close-white" (click)="closeEntradaDocuments()"></button>
        </div>
        <app-detail-entrada-documents
          [docType]="entradaDocumentsData.docType || 'entrega'"
          [idEntradaInput]="entradaDocumentsData.idEntrada"
          [readOnly]="entradaDocumentsData.readOnly ?? false"
          style="display:flex; flex-direction:column; flex:1 1 auto; min-height:0;">
        </app-detail-entrada-documents>
      </div>
    </div>

    <!-- Modal Items por Proveedor — nivel raíz para evitar el transform de AG Grid -->
    <div *ngIf="proveedorData"
         style="position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:10000; display:flex; align-items:center; justify-content:center; padding:16px;"
         (click)="closeProveedor()">
      <div style="background:#fff; border-radius:10px; width:88vw; max-width:100%; height:88vh; display:flex; flex-direction:column; box-shadow:0 8px 40px rgba(0,0,0,0.3); overflow:hidden;"
           (click)="$event.stopPropagation()">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 14px; background:#e3f2fd; border-bottom:1px solid #90caf9; flex-shrink:0;">
          <span style="font-weight:600; color:#0d47a1;">{{ proveedorData.headerTitle || proveedorData.providerLabel }}</span>
          <button type="button" class="btn-close" aria-label="Cerrar" (click)="closeProveedor()"></button>
        </div>
        <app-detalle-items-proveedor
          [modalInit]="proveedorData"
          style="display:flex; flex-direction:column; flex:1 1 auto; min-height:0;">
        </app-detalle-items-proveedor>
      </div>
    </div>
  `,
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Delison';
  private lastLoadedBranchId: number | null = null;
  private permissionsLoadSub: Subscription | null = null;
  private comparacionSub?: Subscription;
  private proveedorSub?: Subscription;
  private entradaDocumentsSub?: Subscription;

  comparacionData: ComparacionOverlayData | null = null;
  proveedorData: ProveedorItemsOverlayData | null = null;
  entradaDocumentsData: EntradaDocumentsOverlayData | null = null;

  private authService = inject(AuthService);
  private signalsService = inject(SignalsService);
  private router = inject(Router);
  private comparacionOverlayService = inject(ComparacionOverlayService);
  private proveedorItemsOverlayService = inject(ProveedorItemsOverlayService);
  private entradaDocumentsOverlayService = inject(EntradaDocumentsOverlayService);
  private unsavedTracker = inject(UnsavedChangesTrackerService);

  constructor() {
    effect(() => {
      const email = localStorage.getItem('mail');
      const isAdvanced = this.signalsService.getIsAdvanced();
      const idBranch = this.signalsService.getBranchSelectedBySidebar()();

      // Cargar permisos básicos en cuanto haya email; actualizarlos cuando cambie la sucursal.
      if (email) {
        this.loadPermissions(email, isAdvanced, idBranch);
      }
    });
  }

  ngOnInit() {
    const token = localStorage.getItem('token');
    const path = this.router.url.split('?')[0] || '';
    if (token && path !== '/login') {
      this.authService.startSessionTimers();
    }
    this.comparacionSub = this.comparacionOverlayService.open$.subscribe(data => {
      this.comparacionData = data;
    });
    this.proveedorSub = this.proveedorItemsOverlayService.open$.subscribe(data => {
      // ✅ Forzar recreación del componente: null → cambio detección → nuevo data
      this.proveedorData = null;
      setTimeout(() => { this.proveedorData = data; }, 0);
    });
    this.entradaDocumentsSub = this.entradaDocumentsOverlayService.open$.subscribe(data => {
      this.entradaDocumentsData = null;
      setTimeout(() => { this.entradaDocumentsData = data; }, 0);
    });
  }

  closeComparacion() {
    this.comparacionData = null;
  }

  closeEntradaDocuments() {
    this.entradaDocumentsData = null;
  }

  async closeProveedor() {
    // ✅ Si hay cambios sin guardar en el modal de proveedor, pedir confirmación
    // (misma lógica que el detail row usaba vía ensureNoUnsavedChangesBeforeNav)
    if (this.unsavedTracker.hasAnyDirty()) {
      const allowed = await this.unsavedTracker.confirmExitIfAny();
      if (!allowed) return;
      this.unsavedTracker.clearAll();
    }
    this.proveedorData = null;
  }

  ngOnDestroy(): void {
    this.permissionsLoadSub?.unsubscribe();
    this.permissionsLoadSub = null;
    this.comparacionSub?.unsubscribe();
    this.proveedorSub?.unsubscribe();
    this.entradaDocumentsSub?.unsubscribe();
  }

  private loadPermissions(email: string, isAdvanced: boolean, idBranch: number | null) {
    // Si los permisos ya existen y no han cambiado las condiciones, no recargar.
    if (this.authService.getUserPermissions() && Object.keys(this.authService.getUserPermissions()).length > 0) {
      if (idBranch === this.lastLoadedBranchId) {
        return;
      }
    }

    this.permissionsLoadSub?.unsubscribe();
    const branchSnapshot = idBranch;

    this.permissionsLoadSub = this.authService
      .getUserId(email)
      .pipe(
        switchMap((userId) =>
          this.authService.fetchEffectivePermissionsTree(userId, idBranch).pipe(
            catchError(() => of({} as any))
          )
        )
      )
      .subscribe({
        next: (tree) => {
          if (this.signalsService.getBranchSelectedBySidebar()() !== branchSnapshot) {
            return;
          }
          this.authService.applyEffectivePermissionsTree(tree);
          this.lastLoadedBranchId = branchSnapshot;
          // Defer to next macrotask so the signal update doesn't fire mid-CD cycle (NG0100)
          setTimeout(() => this.signalsService.bumpGuardRefreshTick());
        },
        error: (error) => console.error('Error fetching permissions:', error),
      });
  }
}
