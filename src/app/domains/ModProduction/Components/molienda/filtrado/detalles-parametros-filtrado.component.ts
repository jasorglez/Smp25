import { Component, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VistaBotesFiltradoComponent } from './vista-botes-filtrado.component';

@Component({
  selector: 'app-detalles-parametros-filtrado',
  standalone: true,
  imports: [CommonModule, VistaBotesFiltradoComponent],
  template: `
    <div style="padding: 6px; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; background: #ede7f6;">

      <!-- Header con sucursal -->
      <div style="flex-shrink: 0; margin-bottom: 4px;">
        <strong style="font-size: 0.85rem; color: #6a1b9a;">
          <i class="bi bi-sliders me-1"></i>Parámetros
          <span *ngIf="sucursalName" style="font-weight: 400; color: #7b1fa2;"> — {{ sucursalName }}</span>
        </strong>
      </div>

      <!-- Pestañas: una pestaña por materia prima de la misma sucursal -->
      <ul class="nav nav-tabs" style="flex-shrink: 0; border-bottom: 2px solid #9c27b0; flex-wrap: nowrap; overflow-x: auto; gap: 2px; padding-bottom: 0;">
        <li class="nav-item" *ngFor="let row of matPrimaRows">
          <button class="nav-link py-1 px-3"
                  [class.active]="activeRow?.id === row.id"
                  (click)="selectRow(row)"
                  style="font-size: 0.8rem; white-space: nowrap; border-radius: 4px 4px 0 0; border: 1px solid transparent;"
                  [style.color]="activeRow?.id === row.id ? '#6a1b9a' : '#666'"
                  [style.font-weight]="activeRow?.id === row.id ? '600' : 'normal'"
                  [style.background-color]="activeRow?.id === row.id ? '#e1bee7' : 'rgba(255,255,255,0.4)'"
                  [style.border-color]="activeRow?.id === row.id ? '#9c27b0 #9c27b0 #e1bee7' : 'transparent'">
            {{ getMatPrimaName(row.matPrima) }}
          </button>
        </li>
        <li *ngIf="!matPrimaRows.length"
            style="padding: 6px 10px; font-size: 0.8rem; color: #9e9e9e; align-self: center;">
          Sin materias primas en esta sucursal
        </li>
      </ul>

      <!-- Vista de botes para la pestaña activa -->
      <div style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">

        <!-- VistaBotes: siempre en DOM, oculto cuando no hay selección -->
        <app-vista-botes-filtrado #botesVista
          [style.display]="activeRow ? 'block' : 'none'"
          style="height: 100%; width: 100%;">
        </app-vista-botes-filtrado>

        <!-- Placeholder cuando no hay pestaña activa -->
        <div *ngIf="!activeRow"
             style="display: flex; align-items: center; justify-content: center; height: 100%; color: #9e9e9e; font-size: 0.85rem; text-align: center; padding: 16px;">
          <div>
            <i class="bi bi-bucket" style="font-size: 2rem; display: block; margin-bottom: 8px; opacity: 0.4;"></i>
            Seleccione una materia prima
          </div>
        </div>

      </div>
    </div>
  `,
})
export class DetallesParametrosFiltradoComponent implements AfterViewInit {
  @ViewChild('botesVista') botesVistaRef?: VistaBotesFiltradoComponent;

  matPrimaRows: any[] = [];
  activeRow: any = null;
  sucursalName = '';
  matPrimaOptions: { id: number; name: string }[] = [];

  private currentContext: any = null;
  private pendingInit: any = null;

  agInit(params: any) {
    const allRows: any[] = params.context?.allMoliendaRows ?? [];
    this.matPrimaOptions = params.context?.matPrimaOptions ?? [];
    this.currentContext  = params.context;
    const userBranches: { id: number; name: string }[] = params.context?.userBranches ?? [];
    const sucursal = params.data?.sucursal;

    this.sucursalName = userBranches.find(b => b.id === sucursal)?.name ?? String(sucursal ?? '');
    this.matPrimaRows = allRows.filter(r => r.sucursal === sucursal && r.id != null && !r.__isNew);

    const defaultRow = this.matPrimaRows.find(r => r.id === params.data?.id) ?? this.matPrimaRows[0] ?? null;
    this.activeRow = defaultRow;

    if (defaultRow) {
      if (this.botesVistaRef) {
        this.initVista(defaultRow);
      } else {
        // Fallback: ngAfterViewInit aún no ha corrido
        this.pendingInit = defaultRow;
      }
    }
  }

  ngAfterViewInit() {
    if (this.pendingInit && this.botesVistaRef) {
      this.initVista(this.pendingInit);
      this.pendingInit = null;
    }
  }

  selectRow(row: any) {
    if (this.activeRow?.id === row.id) return;
    this.activeRow = row;
    this.initVista(row);
  }

  private initVista(row: any) {
    this.botesVistaRef?.agInit({
      data: row,
      context: {
        articuloOptions: this.matPrimaOptions,
        allArticuloOptions: this.matPrimaOptions,
        ...this.currentContext,
      },
    });
  }

  getMatPrimaName(id: number): string {
    return this.matPrimaOptions.find(m => m.id === id)?.name ?? String(id ?? '');
  }

  refresh(): boolean { return false; }
}
