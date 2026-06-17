import { inject, Component, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';

/**
 * Detail renderer (master-detail) para clasificar un artículo nuevo (NUPNPN).
 * Sub-tabla de 1 fila con 3 dropdowns en cascada: Catálogo → Familia → Subfamilia.
 * La selección se escribe en la fila maestra (params.data) y se persiste con el
 * botón Guardar del componente padre.
 */
@Component({
  selector: 'app-clasificacion-cascada',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  template: `
    <div style="padding: 10px 14px; background: #f1f8e9; border-top: 2px solid #558b2f; height: 100%; box-sizing: border-box;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <strong style="font-size: 0.8rem; color: #33691e;">
          Clasificar artículo nuevo — selecciona Catálogo, Familia y Subfamilia
        </strong>
        <button type="button" class="btn btn-sm btn-warning" (click)="deshacer()">
          <i class="bi bi-arrow-clockwise"></i> Deshacer
        </button>
        <button type="button" class="btn btn-sm btn-success" (click)="guardar()" [disabled]="!canSave">
          <i class="bi bi-floppy"></i> Guardar
        </button>
      </div>
      <table style="width: 100%; max-width: 760px; border-collapse: collapse; margin-top: 6px;">
        <thead>
          <tr style="background: #e3f2fd;">
            <th style="padding: 5px; border: 1px solid #cfd8dc; font-size: 0.76rem;">Catálogo</th>
            <th style="padding: 5px; border: 1px solid #cfd8dc; font-size: 0.76rem;">Familia</th>
            <th style="padding: 5px; border: 1px solid #cfd8dc; font-size: 0.76rem;">Subfamilia</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 5px; border: 1px solid #cfd8dc;">
              <ng-select [items]="catCategorias" bindValue="id" bindLabel="description"
                [(ngModel)]="categoria" (ngModelChange)="onCategoriaChange()"
                placeholder="Catálogo" [clearable]="false" appendTo="body"></ng-select>
            </td>
            <td style="padding: 5px; border: 1px solid #cfd8dc;">
              <ng-select [items]="familiasFiltradas" bindValue="id" bindLabel="description"
                [(ngModel)]="familia" (ngModelChange)="onFamiliaChange()"
                placeholder="Familia" [clearable]="false" [disabled]="!categoria" appendTo="body"></ng-select>
            </td>
            <td style="padding: 5px; border: 1px solid #cfd8dc;">
              <ng-select [items]="subfamiliasFiltradas" bindValue="id" bindLabel="description"
                [(ngModel)]="subfamilia" (ngModelChange)="onSubfamiliaChange()"
                placeholder="Subfamilia" [clearable]="false" [disabled]="!familia" appendTo="body"></ng-select>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `
})
export class ClasificacionCascadaComponent implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);
  private parent: any;
  private row: any;
  catCategorias: any[] = [];
  private catFamilias: any[] = [];
  private catSubfamilias: any[] = [];
  // Listas estables para [items] de ng-select — solo se recalculan al cambiar el padre.
  familiasFiltradas: any[] = [];
  subfamiliasFiltradas: any[] = [];
  categoria: number | null = null;
  familia: number | null = null;
  subfamilia: number | null = null;
  canSave = false;

  agInit(params: ICellRendererParams): void {
    this.parent = params.context?.componentParent;
    this.row = params.data;
    // Excluir la categoría "NUEVO": es el placeholder del que el artículo está saliendo.
    this.catCategorias = (this.parent?.catCategorias || [])
      .filter((c: any) => String(c?.description || '').trim().toUpperCase() !== 'NUEVO');
    this.catFamilias = this.parent?.catFamilias || [];
    this.catSubfamilias = this.parent?.catSubfamilias || [];
    this.categoria = this.row?.clasifCategoria || null;
    this.familia = this.row?.clasifFamilia || null;
    this.subfamilia = this.row?.clasifSubfamilia || null;
    this.recalcularFamilias();
    this.recalcularSubfamilias();
  
    this.cdr.detectChanges();}

  refresh(): boolean {
    return false;
  }

  private recalcularFamilias(): void {
    this.familiasFiltradas = this.catFamilias.filter(f => f.parentId === this.categoria);
  }

  private recalcularSubfamilias(): void {
    this.subfamiliasFiltradas = this.catSubfamilias.filter(s => s.subParentId === this.familia);
  }

  onCategoriaChange(): void {
    this.familia = null;
    this.subfamilia = null;
    this.recalcularFamilias();
    this.recalcularSubfamilias();
    this.aplicar();
  }

  onFamiliaChange(): void {
    this.subfamilia = null;
    this.recalcularSubfamilias();
    this.aplicar();
  }

  onSubfamiliaChange(): void {
    this.aplicar();
  }

  // Limpia las 3 selecciones y descarta la clasificación pendiente de la fila.
  deshacer(): void {
    this.categoria = null;
    this.familia = null;
    this.subfamilia = null;
    this.recalcularFamilias();
    this.recalcularSubfamilias();
    if (this.row) {
      this.row.clasifCategoria = null;
      this.row.clasifFamilia = null;
      this.row.clasifSubfamilia = null;
      this.row.__clasifPendiente = false;
    }
  }

  guardar(): void {
    this.parent?.guardarClasificaciones?.();
  }

  private aplicar(): void {
    if (!this.row) return;
    this.row.clasifCategoria = this.categoria;
    this.row.clasifFamilia = this.familia;
    this.row.clasifSubfamilia = this.subfamilia;
    // Pendiente de guardar solo cuando los 3 están seleccionados
    this.row.__clasifPendiente = !!(this.categoria && this.familia && this.subfamilia);
    this.canSave = !!this.row.__clasifPendiente;
    this.parent?.marcarClasifModificado?.();
  }
}
