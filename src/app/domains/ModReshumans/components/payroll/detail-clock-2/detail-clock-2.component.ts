import { Component, effect, HostListener, inject, OnInit } from '@angular/core';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { alerts } from '../../../../../helpers/alerts';
import { AgGridModule } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { SignalsService } from 'app/services/signals.service';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { PayrollService } from 'app/services/payroll.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ClockService } from 'app/services/clock.service';
import { TimeEditorComponent } from 'app/shared/time-editor/time-editor.component';
import { TimeEditorModule } from 'app/shared/time-editor/time-editor.module';

@Component({
  selector: 'app-detail-clock-2',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule, TimeEditorModule],
  templateUrl: './detail-clock-2.component.html',
  styleUrl: './detail-clock-2.component.scss'
})
export class DetailClock2Component implements OnInit {

   private clockService = inject(ClockService);
   private signalsService = inject(SignalsService);
   private route = inject(ActivatedRoute);
   private fb = inject(FormBuilder);
 
   ngOnInit() {
     
     //this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
     this.idEmployee = 443;
     
     this.fechaInicio = '2025-04-19';
     this.fechaFin = '2025-04-25';
     this.obtenerDatos(this.fechaInicio, this.fechaFin);
   }
 
   constructor() { 
     this.selectFechas = this.fb.group({
       fechaInicio: ['', Validators.required],
       fechaFin: ['', Validators.required]
     });

     effect(() => {
       this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
       this.obtenerDatos(this.fechaInicio, this.fechaFin);
     })
   }
 
   @HostListener('window:beforeunload', ['$event'])
   unloadNotification($event: any): void {
     if (this.notSavedChanges) {
       $event.returnValue = 'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
     }
   }
 
   selectFechas: FormGroup;
   type: string = '';
   gridHeight: string = '75vh';
   showCreditsTab: boolean = false;
   private gridApi: GridApi;
   notSavedChanges: boolean = false;
   selectedRowData: any = null;
   isOpen: boolean = false;
   branchs: any[] = [];
   Typecop: any[] = [];
 
   // Agregar esta nueva variable para almacenar el ID de la última fila editada
   private lastEditedRowId: number | string | null = null;
 
   rowData: any;
   contracts: { [key: string]: string } = {};
   newlyAddedRows: string[] = [];
 
   id: string;
   idBranch: number;
   selectedTab: string = 'customers-payments';
   idEmployee: number;
   fechaInicio: any;
   fechaFin: any;
 
 
   public defaultColDef: ColDef = {
     sortable: true,
     filter: false,
     resizable: true,
     lockPosition: false,
     enableRowGroup: true, // Enable row grouping for all columns
     flex: 1,
   };
 
   currentIndex = 0;
 
   public rowSelection: 'single' | 'multiple' = 'single';
   public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'never';
   public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'never';
 
   components = {
     multiLineEditor: MultiLineEditorComponent,
     autocompleteEditor: AutocompleteEditorComponent,
     timeEditor: TimeEditorComponent
   };
 
 
   public gridOptions: any = {
     headerHeight: 25,
     rowHeight: 20,
     groupDefaultExpanded: -1, // -1 significa expandir todos los grupos
     rowClass: (params) => {
       if (params.node.isSelected()) {
         return 'selected-row';
       }
       return '';
     },
     onRowClicked: (event) => {
       event.node.setSelected(true);
     },
     onRowSelected: (event) => {
       if (event.node.isSelected()) {
         this.gridApi.forEachNode((node) => {
           if (node.id !== event.node.id) {
             node.setSelected(false);
           }
         });
       }
     },
   };
 
 
 
   get colMaster(): ColDef[] {
     return [
       {
         field: 'id',
         headerName: 'ID',
         editable: true,
         width: 80,
         hide: true
       },
       {
         field: 'idEmployee',
         headerName: 'ID Empleado',
         editable: true,
         width: 110,
         hide: true
       },
       {
         field: 'idBranch',
         headerName: 'ID Sucursal',
         editable: true,
         width: 110,
         hide: true
       },
       {
         field: 'date',
         headerName: 'Fecha',
         editable: false,
         width: 120,
         valueFormatter: (params) => {
           if (!params.value) return '';
           const date = new Date(params.value);
           return date.toISOString().split('T')[0];
         },
         rowGroup: true
       },
       {
         field: 'checkTime',
         headerName: 'Hora de Registro',
         editable: false,
         cellEditor: 'timeEditor',
         width: 120,
         valueFormatter: (params) => {
           if (!params.value) return '';
           return params.value.split('.')[0];
         }
       },
       {
        field: 'modifiedCheckTime',
        headerName: 'Hora de Registro Modificada',
        editable: true,
        cellEditor: 'timeEditor',
        width: 120,
        valueFormatter: (params) => {
          if (!params.value) return '';
          return params.value.split('.')[0];
        }
      },
       {
         field: 'type',
         headerName: 'Tipo',
         editable: true,
         width: 100,
         cellEditor: 'agSelectCellEditor',
         cellEditorParams: {
           values: ['IN', 'OUT']
         },
         valueFormatter: (params) => {
           if (params.node.group) return '';
           return params.value === 'OUT' ? 'Salida' : 'Entrada';
         }
       },
       {
         field: 'valid',
         headerName: 'Válido',
         editable: true,
         width: 100,
         valueFormatter: (params) => {
           if (params.node.group) return '';
           return params.value ? 'Sí' : 'No';
         },
         cellStyle: (params) => {
           if (params.node.group) return null;
           if (!params.value) {
             return { backgroundColor: '#ffcccc' };
           }
           return null;
         }
       },
       {
         field: 'minuteDiscount',
         headerName: 'Minutos Descontados',
         editable: true,
         cellDataType: 'number',
         cellEditor: 'agTextCellEditor',
         width: 150 
       },
       {
         field: 'edited',
         headerName: 'Editado',
         editable: false,
         width: 100,
         valueFormatter: (params) => {
           return params.value ? 'Sí' : 'No';
         }
       },
       {
        field: 'comments',
        headerName: 'Comentarios',
        editable: true,
        width: 200
       }
     ];
   }
 
   obtenerDatos(fechaInicio: string = '2025-04-19', fechaFin: string = '2025-04-25') {
     this.clockService.checkInOutByEmployee(this.idEmployee, fechaInicio, fechaFin).subscribe((data: any) => {
       this.rowData = [];
       this.rowData = data;
       // Esperar a que el grid se actualice y luego ajustar las columnas
       setTimeout(() => {
         if (this.gridApi) {
           this.gridApi.sizeColumnsToFit();
         }
       }, 100);
     });
   }
 
   onSelectedRow(event: any) {
     this.id = event.data.id;
   }
 
   onSelectionChanged(event: any) {
     const selectedNodes = event.api.getSelectedNodes();
     if (selectedNodes.length > 0) {
       this.selectedRowData = selectedNodes[0].data;
       console.log('ID del empleado seleccionado:', this.selectedRowData.idEmployee);

     } else {
       this.selectedRowData = null;
     }
   }
 
   onCellValueChanged(event: any) {
     event.data.__modified = true;
     event.data.edited = true;
     this.notSavedChanges = true;
     this.lastEditedRowId = event.data.id;
   }
 
 
   onGridReady(params: GridReadyEvent) {
     this.gridApi = params.api;
   }
 
   private selectRowById(id: number | string) {
     // Dar tiempo al grid para que se actualice
     setTimeout(() => {
       this.gridApi.forEachNode((node) => {
         // Convertir ambos IDs a número para la comparación
         const nodeId = typeof node.data.id === 'string' ? parseInt(node.data.id) : node.data.id;
         const searchId = typeof id === 'string' ? parseInt(id) : id;
 
         if (nodeId === searchId) {
           node.setSelected(true);
           this.gridApi.ensureNodeVisible(node, 'middle');
         }
       });
     }, 100);
   }
 

   async onCellDoubleClicked(event: CellDoubleClickedEvent): Promise<void> {
     this.signalsService.setProviderOrCustomer(this.type);
     const colId = event.column.getColId();
     const selectedRowData = event.data; // Obtener los datos de la fila seleccionada
     const selectedId = selectedRowData.id; // Obtener el ID del registro
 
     // Filtrar el grid para mostrar solo el registro con el ID seleccionado solo si la columna es "total"
     if (colId === 'total') {
       const filterModel = {
         id: {
           type: 'equals',
           filter: selectedId,
         },
       };
 
       this.gridApi.setFilterModel(filterModel);
       this.gridApi.onFilterChanged();
       this.activateCreditsTab(); // Activar la pestaña de créditos si es necesario
     }
 
     console.log('Datos ShowCredits:', this.showCreditsTab);
     this.selectedRowData = selectedRowData; // Guardar los datos seleccionados
   }
 
 
   async activateCreditsTab() {
     if (!this.isOpen) {
       setTimeout(async () => await this.adjustGridSize(), 0);
       this.showCreditsTab = true;
       this.isOpen = true;
     }
     else {
       this.resetGridSize();
       this.isOpen = false;
     }
   }
 
   resetGridSize() {
     this.gridHeight = '80vh'; // Reset to default height
     this.showCreditsTab = false;
     this.gridApi.setFilterModel(null);
     this.gridApi.onFilterChanged();
   }
 
   adjustGridSize() {
     this.gridHeight = '20vh'; // Adjust as needed
   }
 
   Consultar() {
     if(this.selectFechas.valid) {
       const datos = this.selectFechas.value;
       this.fechaInicio = datos.fechaInicio;
       this.fechaFin = datos.fechaFin;
       console.log(this.fechaInicio, this.fechaFin)
       this.obtenerDatos(this.fechaInicio, this.fechaFin);
     } else {
       alerts.basicAlert('Error', 'Por favor selecciona ambas fechas', 'error');
     }
   }

}
