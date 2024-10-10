import { CommonModule } from '@angular/common';
import { Component, computed, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { ProvidersService } from 'app/services/providers.service';
import { SignalsService } from 'app/services/signals.service';
import { IssuesService } from 'app/services/issues.service';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';

@Component({
  selector: 'app-identification',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './identification.component.html',
  styleUrl: './identification.component.scss'
})
export class IdentificationComponent {

  private issuesService = inject(IssuesService);
  private signalsService = inject(SignalsService);
  idProject: number = 669;

  ngOnInit() {
    this.obtenerDatos();
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  notSavedChanges: boolean = false;
  rowData: any;
  companys: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  id: string;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  private permissionType: string = 'comp-prov';

  obtenerDatos() {
    this.issuesService
      .getIdentifications(this.idProject)
      .subscribe((data: any) => {
        this.rowData = data;
      });
  }

  /*   obtenerCompanys() {
      this.providersService.getProviders().subscribe((data: any[]) => {
        this.companys = data.reduce((acc, dep) => {
          acc[dep.id] = dep.name; // Cambia la estructura para que solo almacene el nombre
          return acc;
        }, {});
      });
    } */

  get columnDefs(): ColDef[] {
    return [
      {
        field: 'event',
        headerName: 'Evento',
        editable: true,
        flex: 1
      },
      {
        field: 'clasification',
        headerName: 'Clasificación',
        editable: true,
        flex: 2,
      },
      {
        field: 'dateRegistry',
        headerName: 'Fecha de registro',
        editable: true,
        flex: 2,
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        }
      },
      {
        field: 'description',
        headerName: 'Descripción',
        editable: true,
        flex: 3,
      },
      {
        field: 'cause',
        headerName: 'Causa',
        editable: true,
        flex: 3,
      },
      {
        field: 'administrator',
        headerName: 'Administrador',
        editable: true,
        flex: 2,
      },
    ];
  }

  onSelectedRow(event: any) {
    this.id = event.data.id;
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
      this.enviarCompanyId();
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    this.enviarCompanyId();
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idProject: this.idProject,
      event: "",
      classification: "",
      dateRegistry: "",
      cause: "",
      administrator: "",
      active: 1
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
  }

  async saveChanges() {
    /*     const isValid = this.rowData.every((item) => item.idPermission);
    
        if (!isValid) {
          alerts.basicAlert(
            'Añadir entrada',
            'Debe seleccionar una compañía antes de guardar.',
            'error'
          );
          return;
        } */

    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.issuesService.addIdentification(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.issuesService.updateIdentification(row.id, cleanedData);
    });

    // Using concat to combine observables and lastValueFrom for async/await
    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );
      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      this.obtenerDatos(); // Refrescar los datos
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  async deleteEntry() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Por favor, seleccione una entrada para eliminar.',
        'error'
      );
      return;
    }
    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;
    selectedData.active = 0;
    this.issuesService.deleteIdentification(id).pipe(
      catchError((error) => {
        alerts.basicAlert(
          'Eliminar entrada',
          'Error al eliminar la entrada.',
          'error'
        );
        console.error(error);
        return EMPTY;
      })
    )
      .subscribe(
        () => {
          alerts.basicAlert(
            'Eliminar entrada',
            'Entrada eliminada satisfactoriamente.',
            'success'
          );
          this.signalsService.idCompany.set(null);
          this.signalsService.nameCompany.set(null);
          this.obtenerDatos();

          alerts.basicAlert(
            'Eliminar entrada',
            'Entrada eliminada satisfactoriamente.',
            'success'
          );
          this.notSavedChanges = false;
          this.selectedRowData = null;
        }
      );
  }

  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  enviarCompanyId() {
    const companyName = this.getCompanyName(this.selectedRowData.idPermission);
    this.signalsService.companySignal(this.selectedRowData.idPermission, companyName);
  }

  getCompanyName(id: number): string {
    return this.companys[id] || 'Departamento no encontrado';
  }

}
