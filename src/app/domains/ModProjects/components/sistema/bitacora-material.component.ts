import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-enterprise';
import { BitacoraBaseComponent, BITACORA_TEMPLATE, BITACORA_STYLES, DATE_COL } from './bitacora-base.component';
import { alerts } from 'app/helpers/alerts';
import { CatalogsService } from 'app/services/catalogs.service';
import { forkJoin } from 'rxjs';

// DB no tiene campos name/unit/idMaterial → se mapean a description/position/idResource
// Al leer: description→name, supervisor→description, position→unit, idResource→idMaterial

@Component({
  selector: 'app-bitacora-material',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: BITACORA_TEMPLATE,
  styles: BITACORA_STYLES,
})
export class BitacoraMaterialComponent extends BitacoraBaseComponent {
  private catalogsService = inject(CatalogsService);
  private medidasCatalog: any[] = [];

  readonly bitacoraType  = 'material';
  readonly typeNoteValue = 'MATERIAL';
  readonly editableCols  = ['name', 'quantity', 'description'];
  readonly requiredFields = [
    { field: 'name',     label: 'Material' },
    { field: 'quantity', label: 'Cantidad' },
  ];

  protected override onLoadCatalogs(idRoot: number): void {
    forkJoin({
      consumable: this.materialsService.getMaterials(idRoot, 'CONSUMABLE'),
      material:   this.materialsService.getMaterials(idRoot, 'MATERIAL'),
    }).subscribe({
      next: ({ consumable, material }) => {
        this.materialesCatalog = [...consumable, ...material].filter(m => m.active !== false);
      },
      error: () => {},
    });
    this.catalogsService.getCatalogs(idRoot, 'MEASURE').subscribe({
      next: (resp: any[]) => { this.medidasCatalog = resp; },
      error: () => {},
    });
  }

  private getMedidaDesc(idMedida: number | null | undefined): string {
    if (!idMedida) return '';
    const found = this.medidasCatalog.find(m => m.id === idMedida);
    return found?.description ?? '';
  }

  // DB description → nombre material, DB supervisor → nota usuario, DB position → unidad
  protected override remapFromDb(item: any): any {
    return {
      ...item,
      name:        item.description,
      description: item.supervisor,
      unit:        item.position,
      idMaterial:  item.idResource,
    };
  }

  get colDefs(): ColDef[] {
    return [
      { headerName: '#', width: 45, valueGetter: (p) => p.node!.rowIndex! + 1, pinned: 'left', editable: false },
      {
        field: 'name', headerName: 'Material', editable: true, flex: 1,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: this.materialesCatalog.map(m => m.description || m.insumo) }),
        valueSetter: (p) => {
          const mat = this.materialesCatalog.find(m => (m.description || m.insumo) === p.newValue);
          if (mat) {
            p.data.name = mat.description || mat.insumo;
            p.data.idMaterial = mat.id;
            p.data.unit = mat.measure || this.getMedidaDesc(mat.idMedida);
          } else {
            p.data.name = p.newValue;
          }
          return true;
        },
      },
      { field: 'quantity',    headerName: 'Cantidad',    editable: true,  width: 190,  type: 'numericColumn' },
      { field: 'unit',        headerName: 'Unidad',      editable: false, width: 190  },
    ];
  }

  override onCellValueChanged(event: any): void {
    if (event.colDef.field === 'name' && event.newValue) {
      const duplicateExists = this.rowData.some((row, index) =>
        index !== event.rowIndex &&
        row.name === event.newValue
      );

      if (duplicateExists) {
        alerts.basicAlert(
          'Material repetido',
          `El material "${event.newValue}" ya está agregado. No se permiten materiales repetidos.`,
          'warning'
        );
        event.node.setDataValue('name', event.oldValue);
        return;
      }
    }

    if (!event.data.__isNew) event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }

  buildPayload(item: any): any {
    return {
      ...this.basePayload(item),
      description: item.name?.trim()        || null,  // nombre material → description
      supervisor:  item.description?.trim() || null,  // nota usuario    → supervisor
      position:    item.unit != null ? String(item.unit) : null,  // unidad → position (siempre string)
      idResource:  item.idMaterial          ?? null,  // id material     → idResource
    };
  }
}
