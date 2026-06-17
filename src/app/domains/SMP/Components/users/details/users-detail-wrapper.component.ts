import { Component, ViewChild, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { DetallePermisosXSucursalesComponent } from './detallepermisosxsucursales.component';
import { DetalleEmpresasUsuarioComponent } from './detalle-empresas-usuario.component';

@Component({
  selector: 'app-users-detail-wrapper',
  standalone: true,
  imports: [CommonModule, DetallePermisosXSucursalesComponent, DetalleEmpresasUsuarioComponent],
  styles: [
    `
      :host {
        display: flex;
        flex: 1;
        min-height: 0;
        flex-direction: column;
        height: 100%;
      }
    `,
  ],
  template: `
    <div style="height: 100%; min-height: 0; overflow: hidden; box-sizing: border-box; display: flex; flex-direction: column;">
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
  `
})
export class UsersDetailWrapperComponent implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);
  permRef?: DetallePermisosXSucursalesComponent;

  /**
   * *ngIf crea el hijo un tick después; un solo ngAfterViewInit a menudo deja permRef undefined
   * y el panel «Sucursales» nunca recibe agInit hasta recargar la app.
   */
  @ViewChild('permRef') set permRefSetter(c: DetallePermisosXSucursalesComponent | undefined) {
    this.permRef = c;
    this.bootstrapPermisosChild();
  }

  detailType: string = 'permissions';
  userId: number = 0;
  userName: string = '';

  private params: any;
  private componentParent: any;

  private bootstrapPermisosChild(): void {
    if (this.detailType === 'permissions' && this.permRef && this.params) {
      this.permRef.agInit(this.params);
    }
  }

  agInit(params: any): void {
    this.params = params;
    this.detailType = params.data?.detailType ?? 'permissions';
    this.userId = params.data?.id ?? 0;
    this.userName = params.data?.displayName ?? '';
    this.componentParent = params.context?.componentParent;
    queueMicrotask(() => this.bootstrapPermisosChild());
    // El hijo *ngIf a veces se crea después del microtask; segundo intento tras el siguiente tick.
    setTimeout(() => this.bootstrapPermisosChild(), 0);
    this.cdr.detectChanges();
  }

  refresh(params: any): boolean { return false; }

  onCountChanged(count: number): void {
    this.componentParent?.updateEmpresasCount(this.userId, count);
  }
}
