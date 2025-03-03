import { Component, HostListener, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AgGridModule } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { AdministrationService } from 'app/services/administration.service';

interface Bank {
  id: number;
  name: string;
}

@Component({
  selector: 'app-personal',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule, MultiLineEditorComponent],
  templateUrl: './personal.component.html',
  styleUrl: './personal.component.scss'
})
export class PersonalComponent {

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  private lastSelectedId: string | null = null;
  notSavedChanges: boolean = false;
  rowMaster: any;
  rowDetails: any;
  accounts: { [key: string]: string } = {};
  errorMessage: string = '';
  isLoading: boolean = false

  newlyAddedRows: string[] = [];
  selectedRowData: any = null;

  banks: any;
  id: string;
  private tempIdCounter: number = 0;

  private gridApi!: GridApi;

  currentIndex = 0;

  private detailsGridApi!: GridApi<any>;

  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  frameworkComponents = {
    multiLineEditor: MultiLineEditorComponent
  };

  // Inject of new way for Angular 18
  private administrationService = inject(AdministrationService);

// Column Definitions: Defines the columns to be displayed.
public gridOptions: any = {
  headerHeight: 30,
  rowHeight: 30,
  rowClass: (params) => {
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
        field: 'idBanco', headerName: 'Banco', editable: true, width: 150, cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.banks ? this.banks.map(item => item.id) : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.banks ? this.banks.find(item => item.id === params.value) : null;
          return foundItem ? `${foundItem.name}` : params.value;
        }
      },
      { field: 'numberAccount', headerName: 'Numero Cuenta', editable: true, filter: true, width: 200 },

      { field: 'nameAccount', headerName: 'Nombre Cuenta', editable: true, width: 200, filter: true },

      { field: 'signAccount', headerName: 'Firma', editable: true, width: 200 },

      { field: 'interbancaria', headerName: 'Interbancaria', editable: true, width: 160 },

      {
        field: 'folioCheque', headerName: 'Inicio Cheque', editable: true, width: 129, cellEditorParams: {
          maxLength: 5
        }
      },

      { field: 'folioSinCheque', headerName: 'Termino Cheque', editable: true, width: 140 },

      { field: 'eAplicaFiscal', headerName: 'Aplica Fiscal', editable: true, width: 95 },

    ]
  };

  private loadBalanceData(id: string) {
    if (!id || id === this.lastSelectedId) return;

    this.lastSelectedId = id;
    this.rowDetails = [];
    this.isLoading = true;

    this.administrationService.getBalance(parseInt(id))
      .subscribe({
        next: (response: any) => {
          if (response.success && response.hasData) {
            this.rowDetails = response.data;
          } else {
            this.rowDetails = [];
            alerts.basicAlert('Aviso', 'No hay datos disponibles', 'info');
          }
        },
        error: () => {
          this.rowDetails = [];
          alerts.basicAlert('Error', 'Error al cargar los datos', 'error');
        },
        complete: () => {
          this.isLoading = false;
        }
      });
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      const selectedData = selectedNodes[0].data;
      this.selectedRowData = selectedData;
      this.loadBalanceData(selectedData.id);
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    //  console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  onMasterGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  onDetailGridReady(params: GridReadyEvent) {
    this.detailsGridApi = params.api;
  }

}
