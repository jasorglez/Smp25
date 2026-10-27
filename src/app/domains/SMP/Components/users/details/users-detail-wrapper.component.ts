import { Component, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { DetallePermisosXSucursalesComponent } from './detallepermisosxsucursales.component';
import { DetalleEmpresasUsuarioComponent } from './detalle-empresas-usuario.component';

@Component({
  selector: 'app-users-detail-wrapper',
  standalone: true,
  imports: [CommonModule, DetallePermisosXSucursalesComponent, DetalleEmpresasUsuarioComponent],
  template: `
    <div style="height:100%;display:flex;flex-direction:column;overflow:hidden;">
      <div class="d-flex justify-content-end align-items-center px-2 py-1 border-bottom bg-white">
        <button class="btn btn-sm btn-outline-secondary" (click)="closeDetail()" title="Volver a todos los usuarios" aria-label="Volver a todos los usuarios">
          <i class="bi bi-x-lg"></i> Cerrar detalle
        </button>
      </div>
      <div style="flex:1;min-height:0;overflow:auto;">
      <!-- Permisos/Sucursales (renderer existente) -->
      <app-detalle-permisos-x-sucursales
        *ngIf="detailType === 'permissions'"
        #permRef>
      </app-detalle-permisos-x-sucursales>

      <!-- Empresas CRUD -->
      <app-detalle-empresas-usuario
        *ngIf="detailType === 'empresas'"
        [userId]="userId"
        [userName]="userName"
        (countChanged)="onCountChanged($event)">
      </app-detalle-empresas-usuario>
      </div>
    </div>
  `
})
export class UsersDetailWrapperComponent implements ICellRendererAngularComp, AfterViewInit {
  @ViewChild('permRef') permRef?: DetallePermisosXSucursalesComponent;

  detailType: string = 'permissions';
  userId: number = 0;
  userName: string = '';

  private params: any;
  private componentParent: any;

  agInit(params: any): void {
    this.params          = params;
    this.detailType      = params.data?.detailType ?? 'permissions';
    this.userId          = params.data?.id ?? 0;
    this.userName        = params.data?.displayName ?? '';
    this.componentParent = params.context?.componentParent;
  }

  ngAfterViewInit(): void {
    // Pasar params al renderer de permisos (necesita agInit propio)
    if (this.detailType === 'permissions' && this.permRef) {
      this.permRef.agInit(this.params);
    }
  }

  refresh(params: any): boolean { return false; }

  onCountChanged(count: number): void {
    this.componentParent?.updateEmpresasCount(this.userId, count);
  }

  closeDetail(): void {
    const rendererNode = this.params?.node;
    const masterNode = rendererNode?.detail && rendererNode.parent
      ? rendererNode.parent
      : rendererNode;

    if (masterNode?.data) {
      masterNode.data.detailType = null;
      masterNode.setExpanded(false);
    }

    this.componentParent?.closeUserDetail?.(masterNode);
    this.params?.api?.setFilterModel(null);
    this.params?.api?.onFilterChanged();
  }
}
