import { Component, effect, HostListener, inject } from '@angular/core';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { alerts } from '../../../../../helpers/alerts';
import { catchError, lastValueFrom, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { AgGridModule } from 'ag-grid-angular';
import { ModalService } from 'app/services/modal.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { SignalsService } from 'app/services/signals.service';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { InegiService } from 'app/services/inegi.service';
import { BranchsService } from 'app/services/branchs.service';
import { AuthService } from 'app/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { PayrollService } from 'app/services/payroll.service';

@Component({
  selector: 'app-master-clock',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule],
  templateUrl: './master-clock.component.html',
  styleUrl: './master-clock.component.scss'
})
export class MasterClockComponent {
   //  private administrationService = inject(AdministrationService);
   private payrollService = inject(PayrollService);
   private signalsService = inject(SignalsService);
   private route = inject(ActivatedRoute);
   private inegiService = inject(InegiService);
   private http = inject(HttpClient);
 
   ngOnInit() {
     
     this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
     this.obtenerDatos();
   }
 
   constructor() { 
     effect(() => {
       this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
       this.obtenerDatos();
     })
   }
 
   @HostListener('window:beforeunload', ['$event'])
   unloadNotification($event: any): void {
     if (this.notSavedChanges) {
       $event.returnValue = 'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
     }
   }
 
   type: string = ''; // Para almacenar el tipo (CUSTOMERS o PROVIDERS)
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
   infoCp: any;
 
 
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
         field: 'id', headerName: 'Id', editable: false, width: 110, hide: true,
       },
       {
         field: 'nameBranch',
         headerName: 'Nombre sucursal',
         editable: false,
         width: 200,
         hide: true,
         rowGroup: true
       },
       {
        field: 'periodStart',
        headerName: 'Fecha inicio',
        editable: false,
        width: 150,
        valueGetter: (params) => {
          if (!params.data?.periodStart) return '';
          const date = new Date(params.data.periodStart);
          return date.toISOString().split('T')[0];
        }
      },
      {
        field: 'periodEnd',
        headerName: 'Fecha fin',
        editable: false,
        width: 150,
        valueGetter: (params) => {
          if (!params.data?.periodEnd) return '';
          const date = new Date(params.data.periodEnd);
          return date.toISOString().split('T')[0];
        }
      },
       {
        field: 'nameEmployee',
        headerName: 'Nombre Empleado',
        editable: false,
        width: 200
      },
      {
        field: 'hours',
        headerName: 'Horas laboradas',
        editable: false,
        width: 180,
        cellStyle: (params) => {
          if (params.value == 0) {
            return { backgroundColor: '#ffcccc' };
          }
          return null;
        }
      },
      {
        field: 'baseHours',
        headerName: 'Horas base',
        editable: false,
        width: 180
      },
      {
        field: 'extraHours',
        headerName: 'Horas extra',
        editable: false,
        width: 180
      },
      {
        field: 'pendingOuts',
        headerName: 'Salidas pendientes',
        editable: false,
        width: 200,
        cellStyle: (params) => {
          if (params.value > 0) {
            return { backgroundColor: '#ffcccc' };
          }
          return null;
        }
      },
      {
        field: 'absences',
        headerName: 'Ausencias',
        editable: false,
        width: 200,
        cellStyle: (params) => {
          if (params.value > 0) {
            return { backgroundColor: '#ffcccc' };
          }
          return null;
        }
      },
      {
        field: 'delays',
        headerName: 'Retrasos',
        editable: false,
        width: 200,
        cellStyle: (params) => {
          if (params.value > 0) {
            return { backgroundColor: '#ffcccc' };
          }
          return null;
        }
      },
      {
        field: 'discountHours',
        headerName: 'Horas descontadas',
        editable: false,
        width: 200,
        cellStyle: (params) => {
          if (params.value > 0) {
            return { backgroundColor: '#ffcccc' };
          }
          return null;
        }
      },
      ]

   }
 
   obtenerDatos() {
     this.payrollService.getMasterClock(this.idBranch, null, null).subscribe((data: any) => {
       this.rowData = data;
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
     this.notSavedChanges = true;
      this.lastEditedRowId = event.data.id; // Guardar el ID de la última fila editada
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
 

}
