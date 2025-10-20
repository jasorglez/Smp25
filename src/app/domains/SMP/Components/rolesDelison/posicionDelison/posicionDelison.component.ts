import { AfterViewInit, Component, ElementRef, inject, ViewChild } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RolesService } from 'app/services/roles.service';
import { PosicionesService } from 'app/services/posiciones.service';
import { alerts } from 'app/helpers/alerts';
import { forkJoin, lastValueFrom } from 'rxjs';
import { SignalsService } from 'app/services/signals.service';
import { RolesDetailedDelisonComponent } from '../rolesDelison-detailed/rolesDelison-detailed.component';

@Component({
  selector: 'app-posicion-delison',
  standalone: true,
  providers: [CurrencyPipe],
  imports: [AgGridModule, CommonModule,RolesDetailedDelisonComponent ],
  template: `
    <!-- Contenedor principal con Flexbox -->
    <div #container tabindex="-1" style="padding: 10px; background-color: #f8f9fa; height: 100%; display: flex; flex-direction: column; outline: none;">
      <!-- Contenedor del Grid de Posiciones -->
      <div [style.flex]="permisos ? '0 1 25%' : '1 1 100%'" style="display: flex; flex-direction: column; transition: flex 0.3s ease-in-out;" *ngIf="roleId">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Posiciones para el Rol: {{ roleName }}</strong>
          <div>
            <button 
              class="btn btn-sm btn-success me-2" 
              (click)="addPosicion()"
              [disabled]="!posicionGridApi">
              <i class="bi bi-plus-circle"></i> Agregar
            </button>
            <button 
              class="btn btn-sm btn-primary me-2" 
              (click)="savePosiciones()"
              [disabled]="!hasPosicionChanges">
              <i class="bi bi-floppy"></i> Guardar
            </button>
            <button 
              class="btn btn-sm btn-danger" 
              (click)="deleteSelectedPosicion()"
              [disabled]="!selectedPosicion">
              <i class="bi bi-trash"></i> Borrar
            </button>
          </div>
        </div>
        <!-- El grid ahora ocupa todo el espacio de su contenedor padre -->
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; height: 100%;"
          [columnDefs]="posicionColumnDefs"
          [rowData]="posicionRowData"
          [gridOptions]="posicionGridOptions"
          (gridReady)="onPosicionGridReady($event)"
          (selectionChanged)="onPosicionSelectionChanged($event)"
          (cellValueChanged)="onPosicionCellValueChanged($event)"
          (cellClicked)="onCellClicked($event)">
        </ag-grid-angular>
      </div>
      <div *ngIf="permisos" style="flex: 1 1 75%; overflow-y: auto; margin-top: 10px;">
        <app-roles-detailed></app-roles-detailed>
      </div>
    </div>
    
    
  `
})
export class PosicionDelisonComponent implements ICellRendererAngularComp, AfterViewInit {

  @ViewChild('container') container: ElementRef;
  
  params: any;
  roleId: number;
  idRoot: number;
  roleName: string;
  posicionRowData: any[] = [];
  hasPosicionChanges: boolean = false;
  posicionGridApi: any;
  selectedPosicion: any = null;
  permisos: boolean = false;
  
  posicionGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    rowSelection: 'single',
    stopEditingWhenCellsLoseFocus: true,
    getRowClass: (params) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
  };

  private rolesService = inject(RolesService);
  private posicionesService = inject(PosicionesService);
  private signalsService = inject(SignalsService);

  constructor(private currencyPipe: CurrencyPipe) {}

  posicionColumnDefs = [
    {
      field: 'id',
      headerName: 'ID',
      filter: 'agNumberColumnFilter',
      hide: true,
    },
    { 
      field: 'description', 
      headerName: 'Descripción', 
      editable: true, 
      flex: 1 
    },
    { 
      field: 'permisos', 
      headerName: 'Permisos',
      cellStyle: { backgroundColor: '#d4edda' }, 
      flex: 1,
      cellRenderer: (params) => {
        // Hacemos que el texto parezca un enlace para indicar que es clickeable.
        return `<span style="cursor: pointer; text-decoration: underline; color: #0d6efd;">Ver Permisos</span>`;
      }
    },
  ];
  onCellClicked(event: any): void {
    const colId = event.column.getColId();
    // Reaccionar al clic en la columna 'permisos'
    if (colId === 'permisos') {
      const selectedData = event.data;
      const node = event.node;
      const api = event.api;
      const detailType = 'posiciones';
      console.log(selectedData);
      
      if (node.expanded) {
        node.setExpanded(false);
        api.setFilterModel(null);
        api.onFilterChanged();
        this.permisos = false;
        // Dar tiempo al DOM para actualizarse y luego ajustar el grid
        // No es necesario redimensionar columnas al colapsar
      } else {
        // Colapsar cualquier otra fila que esté expandida para evitar múltiples detalles abiertos.
        api.forEachNode(otherNode => {
          if (otherNode.expanded && otherNode.id !== node.id) {
            otherNode.setExpanded(false);
          }
        });

        // Si se hace clic en una celda diferente (o la fila está cerrada)...
        // ...se establece el nuevo tipo de detalle y se expande la fila.

        // Aplicar filtro por ID para enfocar la fila actual y ocultar las demás.
        api.setFilterModel({ id: { type: 'equals', filter: event.data.id } });
        api.onFilterChanged();

        // Asignar el tipo de detalle y expandir.
        event.data.detailType = detailType;
        node.setExpanded(true);
        this.signalsService.setIdRole(selectedData.idRoles);
        this.signalsService.setIdPosicion(selectedData.id);
        this.permisos = true;
        // No es necesario redimensionar columnas al expandir
      }
    }
  }
  agInit(params: ICellRendererParams): void {
    console.log('Params:', params);
    this.params = params;
    this.roleId = params.data.id;
    this.roleName = params.data.description;
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    this.loadPosicionData();
  }

  ngAfterViewInit(): void {
    // Se elimina la llamada a focus() para evitar el parpadeo/redimensionamiento del grid al abrir el detalle.
  }
  refresh(): boolean {
    return false;
  }

  // Cuando el componente se destruye (al cerrar el detalle), limpiamos el filtro.
  ngOnDestroy() {
    // La limpieza del filtro ahora se maneja en onCellClicked del componente padre.
  }

  onPosicionGridReady(params: any) {
    this.posicionGridApi = params.api;
    this.posicionGridApi.sizeColumnsToFit();
  }

  onPosicionSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    this.selectedPosicion = selectedNodes.length > 0 ? selectedNodes[0].data : null;
  }

  onPosicionCellValueChanged(event: any) {
    if (event.newValue !== event.oldValue) {
      event.data.__modified = true;
      this.hasPosicionChanges = true;
    }
  }

  loadPosicionData() {
    console.log(`Cargando posiciones para el rol ID: ${this.roleId}`);
    this.posicionesService.getPositionsByRole(this.idRoot, this.roleId).subscribe({
      next: (data: any) => {
        this.posicionRowData = Array.isArray(data) ? data : (data ? [data] : []);
        console.log('Posiciones:', this.posicionRowData);
      },
      error: (error) => {
        console.error('ERROR', error);
        this.posicionRowData = [];
      }
    });
  }

  addPosicion() {
    const newPosicion = {
      idCompany: this.idRoot,
      idRoles: this.roleId,
      description: '',
      active: true,
      __isNew: true
    };
    this.posicionRowData = [newPosicion, ...this.posicionRowData];
    this.hasPosicionChanges = true;
  }

  async savePosiciones() {
    const newRows = this.posicionRowData.filter(row => row.__isNew);
    const modifiedRows = this.posicionRowData.filter(row => row.__modified && !row.__isNew);

    const addObservables = newRows.map(row => this.posicionesService.addPosition(this.cleanData(row)));
    const updateObservables = modifiedRows.map(row => this.posicionesService.updatePosition(row.id, this.cleanData(row)));

    try {
      await lastValueFrom(forkJoin([...addObservables, ...updateObservables]));
      alerts.basicAlert('Éxito', 'Posiciones guardadas correctamente', 'success');
      this.hasPosicionChanges = false;
      this.loadPosicionData();
    } catch (error) {
      alerts.basicAlert('Error', 'No se pudieron guardar las posiciones', 'error');
      console.error(error);
    }
  }

  async deleteSelectedPosicion() {
    if (!this.selectedPosicion) return;

    const confirmed = await alerts.confirmAlert(
      'Confirmar borrado',
      `¿Está seguro de que desea eliminar la posición "${this.selectedPosicion.description}"?`,
      'warning',
      'Sí, borrar'
    );

    if (!confirmed.isConfirmed) return;

    // Si es una fila nueva que aún no está en la BD, solo la quitamos del grid.
    if (this.selectedPosicion.__isNew) {
      this.posicionRowData = this.posicionRowData.filter(row => row.id !== this.selectedPosicion.id);
      this.selectedPosicion = null;
      return;
    }

    try {
      await lastValueFrom(this.posicionesService.deletePosition(this.selectedPosicion.id));
      alerts.basicAlert('Éxito', 'Posición eliminada correctamente', 'success');
      this.loadPosicionData();
      this.selectedPosicion = null;
    } catch (error) {
      alerts.basicAlert('Error', 'No se pudo eliminar la posición', 'error');
      console.error(error);
    }
  }

  private cleanData(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    return cleanedData;
  }

}