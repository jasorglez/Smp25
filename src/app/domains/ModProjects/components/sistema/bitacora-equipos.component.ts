import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, ValueSetterParams } from 'ag-grid-enterprise';
import { BitacoraBaseComponent, BITACORA_TEMPLATE, BITACORA_STYLES } from './bitacora-base.component';
import { alerts } from 'app/helpers/alerts';
import { EquipmentService } from 'app/services/equipment.service';
import { CatalogsService } from 'app/services/catalogs.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-bitacora-equipos',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: BITACORA_TEMPLATE,
  styles: BITACORA_STYLES,
})
export class BitacoraEquiposComponent extends BitacoraBaseComponent {
  private equipmentService = inject(EquipmentService);
  private catalogsService = inject(CatalogsService);
  
  readonly bitacoraType  = 'equipos';
  readonly typeNoteValue = 'EQUIPMENT';
  readonly editableCols  = ['name', 'quantity', 'hours', 'description'];
  readonly requiredFields = [
    { field: 'name',     label: 'Equipo'   },
    { field: 'quantity', label: 'Cantidad' },
  ];

  equiposCatalog: any[] = [];
  typeEquipmentCatalog: any[] = [];
  idCompany: number = 0;

  constructor() {
    super();
    this.idCompany = this.signalsService.getRootSelectedBySidebar()() || 0;
  }

  protected override onLoadCatalogs(idRoot: number): void {
    this.idCompany = idRoot;
    this.equipmentService.getEquipment(idRoot).subscribe({
      next: (resp: any[]) => { 
        this.equiposCatalog = resp.filter(e => e.active !== false);
        console.log('📦 Equipos cargados:', this.equiposCatalog.slice(0, 3));
      },
      error: () => {},
    });

    this.catalogsService.getTypeEquipment(idRoot, 'TYPEEQUIPMENT').subscribe({
      next: (resp: any[]) => {
        this.typeEquipmentCatalog = resp.filter(t => t.active !== false);
        console.log('🔧 Tipos de equipo cargados:', this.typeEquipmentCatalog.slice(0, 3));
      },
      error: () => {},
    });
  }

  private async createNewEquipment(name: string, idTypeEquipment: number | null): Promise<any> {
    const newEquipment = {
      description: name.trim(),
      idCompany: this.idCompany,
      idBranch: null,
      idTypeEquipment: idTypeEquipment,
      quantity: 1,
      measure: 'DIA',
      costMN: 0,
      priceMN: 0,
      print: false,
      active: true
    };

    try {
      const savedEquipment = await new Promise((resolve, reject) => {
        this.equipmentService.addEquipment(newEquipment).subscribe({
          next: (resp) => resolve(resp),
          error: (err) => reject(err)
        });
      });
      
      const equipment = savedEquipment as any;
      this.equiposCatalog = [...this.equiposCatalog, equipment];
      
      return equipment;
    } catch (error) {
      console.error('Error al crear equipo:', error);
      alerts.basicAlert('Error', 'No se pudo crear el equipo. Intente de nuevo.', 'error');
      return null;
    }
  }

  // DB description → nombre equipo, DB supervisor → nota usuario,
  // DB idResource  → id equipo,     DB position   → horas
  protected override remapFromDb(item: any): any {
    return {
      ...item,
      name:        item.description,
      description: item.supervisor,
      idEquipment: item.idResource,
      hours:       item.position,
    };
  }

  get colDefs(): ColDef[] {
    const createNewOption = '➕ Crear nuevo equipo...';
    const allValues = [
      ...this.equiposCatalog.map(e => e.description || e.name),
      createNewOption
    ];

    return [
      { headerName: '#', width: 45, valueGetter: (p) => p.node!.rowIndex! + 1, pinned: 'left', editable: false },
      {
        field: 'name', headerName: 'Equipo', editable: true, flex: 1,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ 
          values: allValues,
          allowTyping: true,
          filterList: true,
          highlighting: true,
          minLength: 0,
        }),
        valueSetter: (p: ValueSetterParams) => {
          if (p.newValue === createNewOption) {
            Swal.fire({
              title: 'Crear nuevo equipo',
              input: 'text',
              inputLabel: 'Nombre del equipo',
              inputPlaceholder: 'Ingrese el nombre del equipo',
              showCancelButton: true,
              confirmButtonText: 'Crear',
              cancelButtonText: 'Cancelar',
              confirmButtonColor: '#28a745',
              cancelButtonColor: '#d33',
              html: `
                <div style="text-align: left; margin-bottom: 10px;">
                  <label for="swal-equipo-name" style="display: block; margin-bottom: 5px;">Nombre del equipo:</label>
                  <input id="swal-equipo-name" class="swal2-input" placeholder="Ingrese el nombre del equipo" style="width: 100%;">
                </div>
                <div style="text-align: left;">
                  <label for="swal-tipo-equipo" style="display: block; margin-bottom: 5px;">Tipo de equipo:</label>
                  <select id="swal-tipo-equipo" class="swal2-select" style="width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px;">
                    <option value="">Seleccione un tipo...</option>
                    ${this.typeEquipmentCatalog.map(t => `<option value="${t.id}">${t.description}</option>`).join('')}
                  </select>
                </div>
              `,
              preConfirm: async () => {
                const nameInput = document.getElementById('swal-equipo-name') as HTMLInputElement;
                const tipoSelect = document.getElementById('swal-tipo-equipo') as HTMLSelectElement;
                
                const name = nameInput?.value?.trim();
                const idTypeEquipment = tipoSelect?.value ? parseInt(tipoSelect.value) : null;

                if (!name) {
                  Swal.showValidationMessage('Debe ingresar un nombre');
                  return false;
                }

                const newEq = await this.createNewEquipment(name, idTypeEquipment);
                if (newEq) {
                  return newEq;
                }
                return false;
              }
            }).then((result) => {
              if (result.isConfirmed && result.value) {
                p.data.name = result.value.description || result.value.name;
                p.data.idEquipment = result.value.id;
                p.api.refreshCells({ rowNodes: [p.node], columns: ['name'], force: true });
              } else {
                p.node.setDataValue('name', p.oldValue);
              }
            });
            return true;
          }

          const eq = this.equiposCatalog.find(e => (e.description || e.name) === p.newValue);
          if (eq) {
            p.data.name = eq.description || eq.name;
            p.data.idEquipment = eq.id;
          } else if (p.newValue && p.newValue.trim()) {
            Swal.fire({
              title: 'Crear nuevo equipo',
              html: `
                <div style="text-align: left; margin-bottom: 10px;">
                  <label for="swal-equipo-name2" style="display: block; margin-bottom: 5px;">Nombre del equipo: <strong>${p.newValue}</strong></label>
                </div>
                <div style="text-align: left;">
                  <label for="swal-tipo-equipo2" style="display: block; margin-bottom: 5px;">Tipo de equipo:</label>
                  <select id="swal-tipo-equipo2" class="swal2-select" style="width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px;">
                    <option value="">Seleccione un tipo...</option>
                    ${this.typeEquipmentCatalog.map(t => `<option value="${t.id}">${t.description}</option>`).join('')}
                  </select>
                </div>
              `,
              showCancelButton: true,
              confirmButtonText: 'Crear',
              cancelButtonText: 'Cancelar',
              confirmButtonColor: '#28a745',
              cancelButtonColor: '#d33',
              preConfirm: async () => {
                const tipoSelect = document.getElementById('swal-tipo-equipo2') as HTMLSelectElement;
                const idTypeEquipment = tipoSelect?.value ? parseInt(tipoSelect.value) : null;

                const newEq = await this.createNewEquipment(p.newValue, idTypeEquipment);
                if (newEq) {
                  return newEq;
                }
                return false;
              }
            }).then((result) => {
              if (result.isConfirmed && result.value) {
                p.data.name = result.value.description || result.value.name;
                p.data.idEquipment = result.value.id;
                p.api.refreshCells({ rowNodes: [p.node], columns: ['name'], force: true });
              }
            });
          } else {
            p.data.name = p.newValue;
          }
          return true;
        },
      },
      { field: 'quantity',    headerName: 'Cantidad',    editable: true, width: 90, type: 'numericColumn' },
      { field: 'hours',       headerName: 'Horas',       editable: true, width: 80              },
    ];
  }

  override addRow(): void {
    const newRow = {
      id: `temp_${this.tempIdCounter++}`,
      idReporte: this.reportData?.id,
      date: this.reportData?.date ? String(this.reportData.date).substring(0, 10) : new Date().toISOString().split('T')[0],
      name: '',
      quantity: 1,
      hours: null,
      description: null,
      active: true, __isNew: true, __modified: false,
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasUnsavedChanges = true;
    setTimeout(() => {
      this.gridApi?.setGridOption('rowData', this.rowData);
      this.gridApi?.startEditingCell({ rowIndex: 0, colKey: this.editableCols[0] });
    }, 50);
  }

  override onCellValueChanged(event: any): void {
    if (event.colDef.field === 'quantity') {
      event.data.quantity = 1;
      this.gridApi.refreshCells({ rowNodes: [event.node], columns: ['quantity'], force: true });
    }

    if (event.colDef.field === 'name' && event.newValue) {
      const duplicateExists = this.rowData.some((row, index) =>
        index !== event.rowIndex &&
        row.name === event.newValue
      );

      if (duplicateExists) {
        alerts.basicAlert(
          'Equipo repetido',
          `El equipo "${event.newValue}" ya está agregado. No se permiten equipos repetidos.`,
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
      description: item.name?.trim()        || null,  // nombre equipo → description
      supervisor:  item.description?.trim() || null,  // nota usuario  → supervisor
      position:    item.hours != null ? String(item.hours) : null, // horas → position
      idResource:  item.idEquipment         ?? null,  // id equipo     → idResource
    };
  }
}
