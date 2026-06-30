import { Component, HostListener, inject, OnInit } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { CommonModule } from '@angular/common';
import { FamilySubFamily } from 'app/services/familySubFamily.service';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';
import { CatalogsService } from 'app/services/catalogs.service';
import { catchError, concat, EMPTY, lastValueFrom, toArray, map } from 'rxjs';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-Detail-family-sub-family',
  standalone: true,
  imports: [AgGridModule, CommonModule ],
  templateUrl: './DetailFamilySubFamily.component.html',
})
export class DetailFamilySubFamilyComponent implements OnInit { 
  private trackingService = inject(TrackingService);

  private familySubFamily = inject(FamilySubFamily);
  private signalsService = inject(SignalsService);
  private catalogsService = inject(CatalogsService);

  // Guardamos la referencia a la signal para que no se "pierda" al usarla
  //masterCatalogSignal = this.signalsService.getMasterCatalog();

  idRoot: number;
  lastEditedRowId: number | string | null = null;
  rowData: any[];
  notSavedChanges: boolean = false;
  families:any[];
  masterCatalog: number;

  private gridApi: GridApi;
  // params recibidos desde ag-Grid (detailCellRenderer params)
  params: any;

  gridOptions: any = {
  };
  autoGroupColumnDef = {
  cellRendererParams: {
    suppressCount: true
  }
};


  constructor() {}

  ngOnInit() {
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    // Usar la referencia guardada a la signal en lugar de volver a pedirla
    this.loadCatalogData();
  }
  
 

  private cleanTempFlags() {
    if (!this.rowData) return;
    this.rowData.forEach((row) => {
      if (row.__isNew) delete row.__isNew;
      if (row.__modified) delete row.__modified;
    });
  }

  // ag-Grid framework method: recibe los params al instanciar el componente
  agInit(params: any) {
    console.log('DEBUG agInit - params:', params);
    this.params = params;
    this.masterCatalog = params.data.id;
  }

  onGridReady(event: GridReadyEvent) {
    this.gridApi = event.api;
  }

  onCellValueChanged(event: any) {
    try {
      console.log('DEBUG onCellValueChanged - event:', event);
      const field = event.colDef?.field;
      // Si se editó el campo 'vigente' (Activo) marcamos cambios sin guardar
      if (field === 'vigente') {
        this.notSavedChanges = true;
      }

      // Marcar fila como modificada si no es nueva
      if (event.data && !event.data.__isNew) {
        event.data.__modified = true;
        console.log('DEBUG onCellValueChanged - marked __modified for:', event.data);
      }
    } catch (e) {
      console.warn('Error en onCellValueChanged', e);
    }
  }

  // Capturar eventos del host (el contenedor del componente) y delegar a los callbacks
  @HostListener('mouseenter')
  onHostMouseEnter() {
    try {
      this.params?.onMouseEnter?.();
    } catch (e) {
      console.warn('Error calling params.onMouseEnter', e);
    }
  }

  @HostListener('mouseleave')
  onHostMouseLeave() {
    try {
      this.params?.onMouseLeave?.();
    } catch (e) {
      console.warn('Error calling params.onMouseLeave', e);
    }
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


  loadCatalogData(){
    this.familySubFamily.getDetailMaster(this.idRoot, this.masterCatalog ).subscribe(
      (data: any) => {
        this.rowData = data;
        console.log(data)
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

  familias(){
    this.catalogsService.getCatalogsVigente(this.idRoot, 'FAM-CAT').subscribe(
      (data: any) => {
        this.families = data;
        console.log(data)
      },
      (error) => console.error('Error fetching data:', error)
    );
  }


  revert(){
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Deshizo cambios en DetailFamilySubFamily', 'Almacenes', this.trackingService.getEmail());
    this.notSavedChanges = false
    this.loadCatalogData();
  }
  get columnDefs(): ColDef[] {
      return [
        {
          field: 'familia',
          headerName: 'Familia',
          editable: true,
          rowGroup: true,
          hide: true
        },
        {
          field: 'subfamilia',
          headerName: 'Subfamilia',
        },
        {
          field: 'vigente',
          headerName: 'Activo',
          editable: true,
        }
      ]
    }

    add(){
      this.trackingService.addLog(this.trackingService.getnameComp(), 'Agregó nuevo DetailFamilySubFamily', 'Almacenes', this.trackingService.getEmail());
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
      this.trackingService.addLog(this.trackingService.getnameComp(), 'Guardó cambios en DetailFamilySubFamily', 'Almacenes', this.trackingService.getEmail());
          const newRows = this.rowData.filter((row) => row.__isNew);
          const modifiedRows = this.rowData.filter(
            (row) => row.__modified && !row.__isNew
          );
    
          const rowsToSave = [...modifiedRows, ...newRows];

          const saveObservables = rowsToSave.map((row) => {
            const cleanedData = this.cleanDataForServer(row);
            return this.familySubFamily.updateDetailMasterFamily(cleanedData).pipe(
              map((resp: any) => ({ resp, originalRow: row, wasNew: !!row.__isNew }))
            );
          });

          if (saveObservables.length === 0) {
            //console.log('DEBUG save - no rows to save, exiting save()');
            alerts.basicAlert('Sin cambios', 'No hay cambios para guardar.', 'info');
            return;
          }

          //console.log('DEBUG save - starting save flow');
          try {
            // Ejecutar todas las peticiones y recibir el array de respuestas
            const results: Array<any> = await lastValueFrom(
              concat(...saveObservables).pipe(toArray())
            );

            // Actualizar las filas locales con la información devuelta por el servidor
            results.forEach(({ resp, originalRow, wasNew }) => {
              // Si el servidor devolvió un id, lo asignamos
              if (resp) {
                // Preferir propiedades comunes devueltas por el backend
                const newId = resp.idSubfamily ?? resp.id ?? resp.idCatalog ?? null;
                if (newId !== null && newId !== undefined) {
                  originalRow.id = newId;
                }
                // Actualizar campos que el backend pueda haber modificado
                // (solo sobrescribimos campos existentes para evitar perder info)
                Object.keys(resp).forEach((k) => {
                  if (k !== 'id' && k !== 'idSubfamily' && k !== 'idCatalog') {
                    originalRow[k] = resp[k];
                  }
                });
              }

              // Limpiar flags temporales
              //delete originalRow.__isNew;
              //delete originalRow.__modified;
            });

            // Selección posterior: tratar de decidir qué id seleccionar
            if (modifiedRows.length > 0) {
              this.lastEditedRowId = modifiedRows[modifiedRows.length - 1].id;
            } else if (newRows.length > 0) {
              // Buscar en los resultados la última respuesta que era new
              const lastNew = results.slice().reverse().find(r => r.wasNew && (r.resp?.idSubfamily || r.resp?.id));
              if (lastNew) {
                this.lastEditedRowId = lastNew.resp.idSubfamily ?? lastNew.resp.id;
              } else {
                this.lastEditedRowId = 'SELECT_MAX_ID';
              }
            }

            alerts.basicAlert(
              'Datos actualizados',
              'Se han actualizado los datos correctamente.',
              'success'
            );

            // Marcar que no hay cambios pendientes
            this.notSavedChanges = false;
            this.loadCatalogData();

            // Seleccionar la fila recién guardada (si determinamos un id)
            try {
              if (this.lastEditedRowId) {
                if (this.lastEditedRowId === 'SELECT_MAX_ID') {
                  // Buscar el id numérico máximo en rowData
                  let maxId: number | null = null;
                  this.rowData.forEach((r) => {
                    const idVal = typeof r.id === 'string' ? parseInt(r.id) : r.id;
                    if (typeof idVal === 'number' && !Number.isNaN(idVal)) {
                      if (maxId === null || idVal > maxId) maxId = idVal;
                    }
                  });
                  if (maxId !== null) this.selectRowById(maxId);
                } else {
                  this.selectRowById(this.lastEditedRowId);
                }
              }
            } catch (e) {
              console.warn('DEBUG save - selectRowById failed', e);
            }

          

          } catch (error) {
            console.error(error);
            alerts.basicAlert(
              'Error',
              'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
              'error'
            );
          } finally {
            // Asegurarnos de cerrar cualquier loading global (SweetAlert) aunque ocurra un error
            try {
              //alerts.closeLoading();
            } catch (e) {
              console.warn('DEBUG save - alerts.closeLoading() failed', e);
            }

            // Ocultar overlay del grid por si quedó activo
            try {
              //this.gridApi?.hideOverlay();
            } catch (e) {
              console.warn('DEBUG save - gridApi.hideOverlay() failed', e);
            }

            console.log('DEBUG save - finished save flow');
          }
    }

    private selectRowById(id: number | string) {
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

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    delete cleanedData.subfamilia;
    delete cleanedData.active;
    delete cleanedData.familia
    delete cleanedData.id
    delete cleanedData.idCompanyMaster
    delete cleanedData.idFamily
    delete cleanedData.idSubfamily

    cleanedData.idCatalog = data.idSubfamily;    

    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

}
