import { Component, inject, input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridOptions, GridReadyEvent } from 'ag-grid-enterprise';
import { EmployeesService } from 'app/services/employees.service';
import { InegiService } from 'app/services/inegi.service';
import { DetailEmployeeDocumentsComponent } from '../detail-employee-documents/detail-employee-documents.component';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-employee-personal-data',
  standalone: true,
  imports: [CommonModule, AgGridModule, DetailEmployeeDocumentsComponent],
  templateUrl: './personal-data.component.html',
  styleUrl: './personal-data.component.scss',
})
export class EmployeePersonalDataComponent implements OnInit {
  private employeeService = inject(EmployeesService);
  private inegiService = inject(InegiService);

  employeeData = input<any>(null);

  gridApi: GridApi;
  rowData: any[] = [];
  saving = false;
  hasUnsavedChanges = false;
  private infoCp: any[] = [];
  private docsExpanded = false;

  components = {
    detailEmployeeDocuments: DetailEmployeeDocumentsComponent,
  };

  gridOptions: GridOptions = {
    masterDetail: true,
    isRowMaster: () => true,
    detailCellRenderer: 'detailEmployeeDocuments',
    detailRowHeight: 700,
  };

  defaultColDef: ColDef = {
    flex: 1,
    resizable: true,
    sortable: false,
    filter: false,
  };

  columnDefs: ColDef[] = [
    {
      field: 'phone',
      headerName: 'Teléfono',
      editable: true,
      width: 140,
      valueSetter: (params) => {
        const val = params.newValue;
        if (val && !/^\d{10}$/.test(val)) {
          alerts.basicAlert('Teléfono inválido', 'El teléfono debe contener exactamente 10 dígitos numéricos.', 'error');
          return false;
        }
        params.data[params.colDef.field] = val;
        return true;
      },
    },
    {
      field: 'cp',
      headerName: 'CP',
      editable: true,
      width: 90,
      onCellValueChanged: async (params) => {
        const cp = params.newValue?.toString();
        if (cp?.length === 5) {
          try {
            const result: any = await lastValueFrom(this.inegiService.getZipCodeData(cp));
            this.infoCp = Array.isArray(result) ? result : [];
            if (this.infoCp.length > 0) {
              const cpData = this.infoCp[0];
              const colonias = (cpData.asentamientos ?? []).sort((a: string, b: string) => a.localeCompare(b));
              if (cpData.estado) params.node.setDataValue('state', cpData.estado);
              if (cpData.ciudad) params.node.setDataValue('city', cpData.ciudad);
              params.node.setDataValue('neighborhood', colonias[0] ?? '');
            }
            params.api.refreshCells({ rowNodes: [params.node], force: true });
          } catch {
            this.infoCp = [];
          }
        }
      },
    },
    {
      field: 'address',
      headerName: 'Dirección',
      editable: true,
      width: 280,
      valueSetter: (params) => {
        params.data[params.colDef.field] = params.newValue?.toUpperCase() ?? '';
        return true;
      },
    },
    {
      field: 'state',
      headerName: 'Estado',
      editable: true,
      width: 140,
    },
    {
      field: 'city',
      headerName: 'Ciudad',
      editable: true,
      width: 140,
    },
    {
      field: 'neighborhood',
      headerName: 'Colonia',
      editable: true,
      width: 240,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: () => {
        if (this.infoCp.length > 0) {
          return { values: (this.infoCp[0].asentamientos ?? []).sort((a: string, b: string) => a.localeCompare(b)) };
        }
        return { values: [] };
      },
    },
    {
      field: 'rfc',
      headerName: 'RFC',
      editable: true,
      width: 130,
      valueSetter: (params) => {
        const val = (params.newValue ?? '').toString().toUpperCase().trim();
        if (val.length !== 13) return false;
        params.data[params.colDef.field] = val;
        return true;
      },
      cellStyle: (params) => {
        const val = (params.value ?? '').toString();
        return val.length > 0 && val.length !== 13
          ? { borderColor: '#dc3545', borderWidth: '2px', borderStyle: 'solid' }
          : null;
      },
    },
    {
      field: 'documents',
      headerName: 'Docs',
      editable: false,
      suppressMovable: true,
      width: 70,
      flex: 0,
      cellRenderer: () => `<i class="bi bi-file-earmark-text" style="cursor:pointer;" title="Ver documentos del empleado"></i>`,
      cellStyle: { backgroundColor: '#cce5ff', textAlign: 'center' },
      onCellClicked: (params) => {
        const node = params.node;
        if (node.expanded && this.docsExpanded) {
          node.setExpanded(false);
          this.docsExpanded = false;
        } else {
          node.setExpanded(true);
          this.docsExpanded = true;
        }
      },
    },
  ];

  ngOnInit() {
    const data = this.employeeData();
    if (data) {
      this.rowData = [{
        phone: data.phone ?? '',
        cp: data.cp ?? '',
        address: data.address ?? '',
        state: data.state ?? '',
        city: data.city ?? '',
        neighborhood: data.neighborhood ?? '',
        rfc: data.rfc ?? '',
        id: data.id,
        _id: data.id,
      }];
    }
  }

  onGridReady(event: GridReadyEvent) {
    this.gridApi = event.api;
    setTimeout(() => this.gridApi.autoSizeAllColumns(false), 0);
  }

  onCellValueChanged() {
    this.hasUnsavedChanges = true;
  }

  async save() {
    const data = this.employeeData();
    if (!data?.id) return;
    this.saving = true;
    try {
      const row = this.rowData[0];
      const payload = { ...data, ...row };
      delete payload.__isNew;
      delete payload.__modified;
      delete payload._id;
      await lastValueFrom(this.employeeService.updateEmployee(data.id, payload));
      this.hasUnsavedChanges = false;
      alerts.userSaveSuccessToast('Datos Personales', 'Guardado correctamente.');
    } catch {
      alerts.userSaveErrorToast('Error', 'No se pudieron guardar los datos personales.');
    } finally {
      this.saving = false;
    }
  }

  revert() {
    const data = this.employeeData();
    if (!data) return;
    this.rowData = [{
      phone: data.phone ?? '',
      cp: data.cp ?? '',
      address: data.address ?? '',
      state: data.state ?? '',
      city: data.city ?? '',
      neighborhood: data.neighborhood ?? '',
      rfc: data.rfc ?? '',
      _id: data.id,
    }];
    this.infoCp = [];
    this.hasUnsavedChanges = false;
    this.gridApi?.setGridOption('rowData', this.rowData);
  }
}
