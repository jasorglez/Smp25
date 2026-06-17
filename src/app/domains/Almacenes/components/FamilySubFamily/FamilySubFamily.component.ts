import { Component, effect, HostListener, inject, ChangeDetectorRef} from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, CellDoubleClickedEvent,} from 'ag-grid-enterprise';
import { CommonModule } from '@angular/common';
import { FamilySubFamily } from 'app/services/familySubFamily.service';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';
import { CatalogsService } from 'app/services/catalogs.service';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { DetailFamilySubFamilyComponent } from './DetailFamilySubFamily/DetailFamilySubFamily.component';

@Component({
  selector: 'app-family-sub-family',
  standalone: true,
  imports: [AgGridModule, CommonModule , DetailFamilySubFamilyComponent,],
  templateUrl: './FamilySubFamily.component.html',
})
export class FamilySubFamilyComponent { 

  private familySubFamily = inject(FamilySubFamily);
  private readonly cdr = inject(ChangeDetectorRef);
  private signalsService = inject(SignalsService);
  private catalogsService = inject(CatalogsService);

  idRoot: number;
  lastEditedRowId: number | string | null = null;
  rowData: any[];
  notSavedChanges: boolean = false;
  private collapseTimer: any = null;
  masterSelec: number = null;
  families:any[];
  familiasVigente: any[];

  components = {
      detailFamilySubFamily: DetailFamilySubFamilyComponent,
    }
  private gridApi: GridApi;
  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    masterDetail: true,
    isRowMaster: (dataItem) => {
      return true; // Todas las filas pueden tener detalles de permisos
    },
     detailCellRendererSelector: (params) => {
    params.node.setRowHeight(800);

    return {
      component: 'detailFamilySubFamily',
      params: {
        onMouseEnter: () => clearTimeout(this.collapseTimer),
        onMouseLeave: () => {
          this.collapseTimer = setTimeout(() => {
            params.node.setExpanded(false);
          }, 300);
        }
      }
    };
  },

    detailRowHeight: 1000,
    getRowClass: (params: any) => {
      // Verificar si la fila está seleccionada
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onRowClicked: (event) => {
      // Seleccionar la fila al hacer clic en cualquier celda
      event.node.setSelected(true);
    },
    onRowSelected: (event) => {
      // Deseleccionar otras filas cuando se selecciona una nueva
      if (!this.gridApi) return; // <-- protección: gridApi puede no estar listo
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
    onGridReady: (params) => {
      // Guardar referencia al API del grid cuando esté listo
      this.gridApi = params.api;
    }
  };

  constructor() {
    // Ensure AG Grid knows about our framework components once the instance is constructed
    // (setting it here avoids potential timing issues with template validation)
    this.gridOptions.frameworkComponents = this.components;
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.familias();
      this.familiasVigentes();
      this.loadCatalogData();
    });
  }
  onRowGroupOpened = (event) => {
  const openedKey = event.node.key;
  const isExpanded = event.node.expanded;

  if (!isExpanded) return; // solo actuamos cuando se expande

  event.api.forEachNode((node) => {
    if (node.group && node.key !== openedKey) {
      node.setExpanded(false); // cerramos los otros
    }
  });
};

async onCellDoubleClicked(event: CellDoubleClickedEvent): Promise<void> {
    // Verificar que event.data esté disponible antes de acceder a sus propiedades
    if (!event.data) {
      console.warn('No hay datos en la fila seleccionada');
      return;
    }
    const colId = event.column.getColId();
    const selectedRowData = event.data; // Obtener los datos de la fila seleccionada
    const selectedId = selectedRowData.id; // Obtener el ID del registro 
  
    this.notSavedChanges = true;
  
    // Filtrar el grid para mostrar y expandir el detalle del registro con el ID seleccionado
    if (colId === 'Catalog' || colId === 'saving') {
      if (this.gridApi) {
        // Colapsar cualquier fila expandida previamente
        this.gridApi.forEachNode((node) => {
          if (node.expanded) {
            node.setExpanded(false);
          }
        });

        // Aplicar filtro por id (columna oculta 'id' debe existir)
        const filterModel = {
          id: {
            filterType: 'number',
            type: 'equals',
            filter: selectedId,
          },
        };

        this.gridApi.setFilterModel(filterModel);
        this.gridApi.onFilterChanged();
        

        // Expandir la fila doble clickeada (dar tiempo a que el filtro aplique)
        setTimeout(() => {
          const node = event.node;
          if (node) {
            node.setSelected(true);
            node.setExpanded(true);
          }
        }, 50);
      } else {
        alert('gridApi no disponible');
      }
    }
  
    // Activar la pestaña de préstamos si la columna es 'loan
  
    // Eliminar la asignación duplicada de selectedRowData
    // this.selectedRowData = selectedRowData; // Esta línea ya se encuentra al principio
  }

private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    delete cleanedData.idSubfamilia;
    delete cleanedData.subfamilia;
    delete cleanedData.active;
    delete cleanedData.id
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  loadCatalogData(){
    this.familySubFamily.getMasterFamily(this.idRoot).subscribe(
      (data: any) => {
        this.rowData = data;
        this.cdr.detectChanges();
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

  familias(){
    this.familySubFamily.getCatalogsFamily(this.idRoot).subscribe(
      (data: any) => {
        this.families = data;
        this.cdr.detectChanges();
      },
      (error) => console.error('Error fetching data:', error)
    );
  }
  familiasVigentes(){
    this.catalogsService.getCatalogsVigente(this.idRoot, 'FAM-CAT').subscribe(
      (data: any) => {
        this.familiasVigente = data;
        this.cdr.detectChanges();
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

   onCellValueChanged(event: any) {
    if (!event.node.isSelected()) {
      event.node.setSelected(true);
    }
    
    this.notSavedChanges = true;

    if (!event.data.__isNew) {
      event.data.__modified = true;
    }
  
    // Solo actuar si se cambió el nombre
    if (event.colDef.field === 'displayName') {
      
    }
  }
  


  revert(){
    this.notSavedChanges = false
    this.loadCatalogData();
    this.familias();
    this.familiasVigentes();
  }
  get columnDefs(): ColDef[] {
      return [
        // Hidden id column so filters using 'id' as colId work
        {
          field: 'id',
          hide: true,
          filter: 'agNumberColumnFilter',
          colId: 'id'
        },
        {
          field: 'masterFamily',
          headerName: 'Familia',
          editable: true,
          cellEditor: SelectWithTooltipEditorV2Component,
          cellEditorParams: (params: any) => {
            // Obtener familias filtradas por la categoría seleccionada
            return {
              options: (this.families || []).map(f => ({
                id: f.id,
                description: f.description,
                valueAddition: f.valueAddition,
                valueAddition2: f.valueAddition2,
              }))
            };
          },
          valueFormatter: (params: any) => {
            const fam = this.familiasVigente?.find?.(f => f.id === params.value);
            return fam ? fam.description : params.data?.familia || '';
          },
          onCellValueChanged: (params: any) => {
            // Cuando cambia la familia, resetear subfamilia
            params.data.idSubfamilia = null;
            params.data.subfamilia = '';
            //setTimeout(() => {
              params.api.refreshCells({ rowNodes: [params.node], force: true });
            //}, 0);
          },
          cellStyle: (params: any) => {
            if (!params.data.idCategory) {
              return { backgroundColor: '#f0f0f0', color: '#999' };
            }
            return null;
          },
          valueSetter: (params) => {
            // El editor puede devolver el id (number) o un objeto {id, description}.
            const editorValue = params.newValue;

            const newValue = (editorValue && typeof editorValue === 'object' && 'id' in editorValue)
              ? editorValue.id
              : editorValue;

            // Validar valor requerido
            if (newValue === null || newValue === undefined || newValue === '') {
              alerts.basicAlert('Campo requerido', 'La familia es obligatoria', 'error');
              return false;
            }

            // Evitar duplicados: comparar por el mismo campo (por ejemplo, masterFamily)
            const field = params.colDef.field;
            const duplicateExists = (this.rowData || []).some((row, index) =>
              index !== params.node.rowIndex && row[field] === newValue
            );

            if (duplicateExists) {
              alerts.basicAlert(
                'Valor duplicado',
                'Ya existe una fila con esa familia.',
                'error'
              );
              return false;
            }

            // Asignar el valor (normalmente un id) y, si existe, actualizar la descripción auxiliar
            params.data[field] = newValue;
            const fam = this.families?.find?.((f: any) => f.id === newValue);
            if (fam) {
              // mantener consistencia visual
              params.data.familia = fam.description;
            }

            return true;
          },
        },
        {
          headerName: 'Catalog',
          cellStyle: { backgroundColor: '#d4edda' },
          onCellClicked: this.togglePermissions.bind(this)
        },
        {
          headerName: 'Activo',
          field: 'vigente',
          editable: true,
        }
      ]
    }

    add(){
    const newItem = {
      idCompany: this.idRoot,
      vigente: true,
      active: true,
      __isNew: true,
    };
    this.rowData = [newItem, ...this.rowData];
    this.notSavedChanges = true
    }

   async save(){
      const isValid = this.rowData.every(
            (item) =>
              item.masterFamily
          );
          if (!isValid) {
            alerts.basicAlert(
              'Añadir entrada',
              'Debe llenar los campos obligatorios antes de guardar.',
              'error'
            );
            return;
          }
      
          const newRows = this.rowData.filter((row) => row.__isNew);
          const modifiedRows = this.rowData.filter(
            (row) => row.__modified && !row.__isNew
          );
      
          const addObservables = newRows.map((row) => {
            const cleanedData = this.cleanDataForServer(row);
            return this.familySubFamily.addMasterFamily(cleanedData);
          });
      
          const updateObservables = modifiedRows.map((row) => {
            const cleanedData = this.cleanDataForServer(row);
            return this.familySubFamily.updateMasterFamily(row.id, cleanedData);
          });
      
          try {
            await lastValueFrom(
              concat(...addObservables, ...updateObservables).pipe(toArray())
            );
      
            // Determinar qué ID vamos a seleccionar después de recargar
            if (modifiedRows.length > 0) {
              // Si hay filas modificadas, guardamos el ID de la última modificada
              this.lastEditedRowId = modifiedRows[modifiedRows.length - 1].id;
            } else if (newRows.length > 0) {
              // Si hay filas nuevas, marcaremos que necesitamos seleccionar el ID máximo
              this.lastEditedRowId = 'SELECT_MAX_ID';
            }
      
            alerts.basicAlert(
              'Datos actualizados',
              'Se han actualizado los datos correctamente.',
              'success'
            );
            this.notSavedChanges = false;
      
            await this.loadCatalogData(); // Esperar a que se actualicen los datos
            await this.familias();
            await this.familiasVigentes();
      
            // Seleccionar la fila apropiada después de recargar
            if (this.lastEditedRowId) {
              if (this.lastEditedRowId === 'SELECT_MAX_ID') {
                // Encontrar el ID máximo en los datos actuales
                const maxId = Math.max(...this.rowData.map((row) => Number(row.id)));
                this.selectRowById(maxId);
              } else {
                this.selectRowById(this.lastEditedRowId);
              }
              this.lastEditedRowId = null; // Resetear el ID
            }
          } catch (error) {
            console.error(error);
            alerts.basicAlert(
              'Error',
              'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
              'error'
            );
          }
    
      this.cdr.detectChanges();}

    onSelectionChanged(event: any): void {
      const selectedRows = event.api.getSelectedRows();
      this.masterSelec = selectedRows.length > 0 ? selectedRows[0].id : null;
      this.signalsService.setMasterCatalog(this.masterSelec);
    }


    async removed(){

      if (!this.masterSelec) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un material para eliminar', 'warning');
      return;
    }

    const result = await alerts.confirmAlert(
      '¿Eliminar material?',
      `¿Está seguro de eliminar?`,
      'warning',
      'Sí, eliminar'
    );
  

    if (result.isConfirmed) {
      try {

        await lastValueFrom(this.familySubFamily.deleteMasterFamily(this.masterSelec));
        alerts.basicAlert('Eliminado', 'El material ha sido eliminado correctamente', 'success');
        this.masterSelec = null;
        this.loadCatalogData()
        this.familias();
        this.familiasVigentes();
      } catch (error: any) {
        console.error('Error al eliminar material:', error);
        const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
        alerts.basicAlert('Error', `No se pudo eliminar el material: ${errorMsg}`, 'error');
      }
    }
      
    
      this.cdr.detectChanges();}
        togglePermissions() {
        if (!this.gridApi) {
          console.warn('Grid API not ready yet in togglePermissions()');
          return;
        }

        const selectedNodes = this.gridApi.getSelectedNodes?.() || [];

        if (selectedNodes.length === 0) {
          alerts.basicAlert(
            'Permisos',
            'Por favor, seleccione un usuario para ver sus permisos.',
            'warning'
          );
          return;
        }

        const selectedNode = selectedNodes[0];
        const selectedData = selectedNode.data;
        const isCurrentlyExpanded = selectedNode.expanded;

        if (isCurrentlyExpanded) {
          // Si está expandido, colapsar y limpiar el filtro
          selectedNode.setExpanded(false);
          this.gridApi.setFilterModel(null);
          this.gridApi.onFilterChanged();
        } else {
          // Si no está expandido, colapsar otros, aplicar filtro y expandir
          this.gridApi.forEachNode((node) => {
            if (node.expanded) {
              node.setExpanded(false);
            }
          });

          this.gridApi.setFilterModel(null);

          const filterModel = {
            id: {
              filterType: 'number',
              type: 'equals',
              filter: selectedData.id
            }
          };

          this.gridApi.setFilterModel(filterModel);
          this.gridApi.onFilterChanged();

          setTimeout(() => {
            selectedNode.setExpanded(true);
          }, 50);
        }
      }

    private selectRowById(id: number | string, attempt = 0) {
    // reintentar si gridApi no está disponible aún (evita errores al recargar)
    if (!this.gridApi) {
      if (attempt > 10) {
        console.warn('selectRowById: gridApi unavailable after retries');
        return;
      }
      setTimeout(() => this.selectRowById(id, attempt + 1), 100);
      return;
    }

    // Dar tiempo al grid para que se actualice
    setTimeout(() => {
      this.gridApi.forEachNode((node) => {
        // Convertir ambos IDs a número para la comparación
        const nodeId =
          typeof node.data.id === 'string'
            ? parseInt(node.data.id)
            : node.data.id;
        const searchId = typeof id === 'string' ? parseInt(id) : id;

        if (nodeId === searchId) {
          node.setSelected(true);
          this.gridApi.ensureNodeVisible(node, 'middle');
        }
      });
    }, 100);
  }
}
