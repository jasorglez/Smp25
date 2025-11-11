import { Component, effect, HostListener, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  SelectionChangedEvent,
} from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { AuthService } from 'app/services/auth.service';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { AgGridModule } from 'ag-grid-angular';
import { SignalsService } from 'app/services/signals.service';
import { TimeService } from 'app/services/time.service';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ClockService } from 'app/services/clock.service';
import { TimeEditorComponent } from 'app/shared/time-editor/time-editor.component';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-special-extra-hours',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule],
  templateUrl: './special-extra-hours.component.html',
  styleUrl: './special-extra-hours.component.scss',
})
export class SpecialExtraHoursComponent {
  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.masterNotSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  // Inject of new way for Angular 18
  private clockService = inject(ClockService);
  private signalsService = inject(SignalsService);
  private timeService = inject(TimeService);
  private trackingService = inject(TrackingService);
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  authService = inject(AuthService);

  defaultColDef = {
    flex: 1,
    resizable: true,
    sortable: true,
    filter: true,
    editable: (params) => {
      // Permitir edición solo si la fila es nueva
      return params.data?.__isNew === true;
    },
  };

  ngOnInit() {
    this.idEmployee = this.signalsService.getDetailClockForEmployee().idEmployee();
    this.startDate = this.signalsService.getDetailClockForEmployee().startDate();
    this.endDate = this.signalsService.getDetailClockForEmployee().endDate();
    this.userRoot = this.signalsService.getUserRoot()();
    this.loadData();
  }

  constructor() {
    
    effect(() => {
          this.idEmployee = this.signalsService.getDetailClockForEmployee().idEmployee();
    this.startDate = this.signalsService.getDetailClockForEmployee().startDate();
    this.endDate = this.signalsService.getDetailClockForEmployee().endDate();
    this.userRoot = this.signalsService.getUserRoot()();
      this.loadData();
      if(this.userRoot == 1){
        return this.authorizedPass = true;
      }
      return this.authorizedPass = false;
    }); 
  }

  authorizedPass: boolean = false;
  maestroRowData: any[] = [];
  gridApi: any;
  idEmployee: number = 452;
  startDate: string = '2025-05-10';
  endDate: string = '2025-10-16';
  type: string = null;
  userRoot: number = 0;
  id: number;
  masterNotSavedChanges: boolean = false;
  private tempIdCounter: number = 0;
  masterNewlyAddedRows: string[] = [];
  private selectedCreditIdBeforeRefresh: number;


  public maestroGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    getRowClass: (params) => {
      // Verificar si la fila está seleccionada
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onMaestroRowClicked: (event) => {
      // Seleccionar la fila al hacer clic en cualquier celda
      event.node.setSelected(true);
    },
    onMaestroRowSelected: (event) => {
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

  private maestroGridApi: GridApi;

  components = {
    'timeEditorComponent': TimeEditorComponent
};

maestroColumnDefs: ColDef[] = [
  {
    field: 'startDateStamp',
    headerName: 'Fecha Inicio',
    editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermissionDetail('hr', 'clock','MaeChe_HorEsp', 'update');
        },
    cellEditor: 'agDateCellEditor',
    flex: 1,
    valueGetter: (params) => this.formatDate(params.data?.startDate),
    valueSetter: (params) => {
      // Manejar diferentes tipos de entrada para newValue
      if (!params.newValue) return false;
      
      let newDate;
      
      // Si newValue es un objeto Date
      if (params.newValue instanceof Date) {
        newDate = new Date(params.newValue);
      } 
      // Si newValue es una cadena en formato DD-MM-YYYY
      else if (typeof params.newValue === 'string' && params.newValue.includes('-')) {
        try {
          const parts = params.newValue.split('-');
          if (parts.length !== 3) return false;
          
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1; // Los meses en JS van de 0-11
          const year = parseInt(parts[2]);
          
          newDate = new Date(year, month, day);
          if (isNaN(newDate.getTime())) return false;
        } catch (error) {
          console.error('Error parsing date:', error);
          return false;
        }
      } 
      // Si es otro formato, intentar crear directamente un objeto Date
      else {
        try {
          newDate = new Date(params.newValue);
          if (isNaN(newDate.getTime())) return false;
        } catch (error) {
          console.error('Error creating date from value:', error);
          return false;
        }
      }
      
      // Si ya existe una startDate, mantener la hora actual
      let currentTime = '00:00:00';
      if (params.data.startDate) {
        const currentDate = new Date(params.data.startDate);
        currentTime = `${String(currentDate.getHours()).padStart(2, '0')}:${String(currentDate.getMinutes()).padStart(2, '0')}:${String(currentDate.getSeconds()).padStart(2, '0')}`;
      }
      
      // Aplicar la hora existente a la nueva fecha
      const [hours, minutes, seconds] = currentTime.split(':').map(part => parseInt(part));
      newDate.setHours(hours, minutes, seconds);
      
      // Crear la fecha en formato ISO sin conversión UTC
      const year = newDate.getFullYear();
      const month = String(newDate.getMonth() + 1).padStart(2, '0');
      const day = String(newDate.getDate()).padStart(2, '0');
      const hour = String(newDate.getHours()).padStart(2, '0');
      const minute = String(newDate.getMinutes()).padStart(2, '0');
      const second = String(newDate.getSeconds()).padStart(2, '0');
      
      // Actualizar el objeto data con la fecha en formato local
      params.data.startDate = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
      this.masterNotSavedChanges = true;
      params.data.__modified = true;
      
      return true;
    }
  },
  {
    field: 'startHourStamp',
    headerName: 'Hora Inicio',
    cellEditor: 'timeEditorComponent',
    editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermissionDetail('hr', 'clock','MaeChe_HorEsp', 'update');
        },
    flex: 1,
    valueGetter: (params) => this.formatTime(params.data?.startDate),
    valueSetter: (params) => {
      if (!params.newValue || !params.data.startDate) return false;
      
      let hours, minutes, seconds;
      
      // Manejar diferentes tipos de entrada para tiempo
      if (typeof params.newValue === 'string') {
        try {
          // Puede venir en formato "HH:MM:SS" o "HH:MM"
          const timeParts = params.newValue.split(':');
          hours = parseInt(timeParts[0] || '0');
          minutes = parseInt(timeParts[1] || '0');
          seconds = parseInt(timeParts[2] || '0');
        } catch (error) {
          console.error('Error parsing time:', error);
          return false;
        }
      } else {
        // Si no es una cadena, intentar extraer la hora
        try {
          const timeDate = new Date(params.newValue);
          if (isNaN(timeDate.getTime())) return false;
          
          hours = timeDate.getHours();
          minutes = timeDate.getMinutes();
          seconds = timeDate.getSeconds();
        } catch (error) {
          console.error('Error extracting time:', error);
          return false;
        }
      }
      
      // Mantener la fecha actual y actualizar solo la hora
      const currentDate = new Date(params.data.startDate);
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      
      // Actualizar el objeto data con la fecha en formato local
      params.data.startDate = `${year}-${month}-${day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      this.masterNotSavedChanges = true;
      params.data.__modified = true;
      
      return true;
    }
  },
  {
    field: 'endDateStamp',
    headerName: 'Fecha Fin',
    cellEditor: 'agDateCellEditor',
    editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermissionDetail('hr', 'clock','MaeChe_HorEsp', 'update');
        },
    flex: 1,
    valueGetter: (params) => this.formatDate(params.data?.endDate),
    valueSetter: (params) => {
      // Manejar diferentes tipos de entrada para newValue
      if (!params.newValue) return false;
      
      let newDate;
      
      // Si newValue es un objeto Date
      if (params.newValue instanceof Date) {
        newDate = new Date(params.newValue);
      } 
      // Si newValue es una cadena en formato DD-MM-YYYY
      else if (typeof params.newValue === 'string' && params.newValue.includes('-')) {
        try {
          const parts = params.newValue.split('-');
          if (parts.length !== 3) return false;
          
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1; // Los meses en JS van de 0-11
          const year = parseInt(parts[2]);
          
          newDate = new Date(year, month, day);
          if (isNaN(newDate.getTime())) return false;
        } catch (error) {
          console.error('Error parsing date:', error);
          return false;
        }
      } 
      // Si es otro formato, intentar crear directamente un objeto Date
      else {
        try {
          newDate = new Date(params.newValue);
          if (isNaN(newDate.getTime())) return false;
        } catch (error) {
          console.error('Error creating date from value:', error);
          return false;
        }
      }
      
      // Si ya existe una endDate, mantener la hora actual
      let currentTime = '00:00:00';
      if (params.data.endDate) {
        const currentDate = new Date(params.data.endDate);
        currentTime = `${String(currentDate.getHours()).padStart(2, '0')}:${String(currentDate.getMinutes()).padStart(2, '0')}:${String(currentDate.getSeconds()).padStart(2, '0')}`;
      }
      
      // Aplicar la hora existente a la nueva fecha
      const [hours, minutes, seconds] = currentTime.split(':').map(part => parseInt(part));
      newDate.setHours(hours, minutes, seconds);
      
      // Crear la fecha en formato ISO sin conversión UTC
      const year = newDate.getFullYear();
      const month = String(newDate.getMonth() + 1).padStart(2, '0');
      const day = String(newDate.getDate()).padStart(2, '0');
      const hour = String(newDate.getHours()).padStart(2, '0');
      const minute = String(newDate.getMinutes()).padStart(2, '0');
      const second = String(newDate.getSeconds()).padStart(2, '0');
      
      // Actualizar el objeto data con la fecha en formato local
      params.data.endDate = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
      this.masterNotSavedChanges = true;
      params.data.__modified = true;
      
      return true;
    }
  },
  {
    field: 'endHourStamp',
    headerName: 'Hora Fin',
    cellEditor: 'timeEditorComponent',
    editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermissionDetail('hr', 'clock','MaeChe_HorEsp', 'update');
        },
    flex: 1,
    valueGetter: (params) => this.formatTime(params.data?.endDate),
    valueSetter: (params) => {
      if (!params.newValue || !params.data.endDate) return false;
      
      let hours, minutes, seconds;
      
      // Manejar diferentes tipos de entrada para tiempo
      if (typeof params.newValue === 'string') {
        try {
          // Puede venir en formato "HH:MM:SS" o "HH:MM"
          const timeParts = params.newValue.split(':');
          hours = parseInt(timeParts[0] || '0');
          minutes = parseInt(timeParts[1] || '0');
          seconds = parseInt(timeParts[2] || '0');
        } catch (error) {
          console.error('Error parsing time:', error);
          return false;
        }
      } else {
        // Si no es una cadena, intentar extraer la hora
        try {
          const timeDate = new Date(params.newValue);
          if (isNaN(timeDate.getTime())) return false;
          
          hours = timeDate.getHours();
          minutes = timeDate.getMinutes();
          seconds = timeDate.getSeconds();
        } catch (error) {
          console.error('Error extracting time:', error);
          return false;
        }
      }
      
      // Mantener la fecha actual y actualizar solo la hora
      const currentDate = new Date(params.data.endDate);
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      
      // Actualizar el objeto data con la fecha en formato local
      params.data.endDate = `${year}-${month}-${day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      this.masterNotSavedChanges = true;
      params.data.__modified = true;
      
      return true;
    }
  },
  {
    field: 'calculatedSpecialExtraHours',
    headerName: 'Horas',
    editable: false,
    flex: 1
  }
];

  private async getTime(): Promise<{ dateObj: Date; formatted: string }> {
    const time = await lastValueFrom(this.timeService.getTime());
    const date = new Date(time.localTime);
    return {
      dateObj: date,
      formatted: `${('0' + date.getDate()).slice(-2)}-${(
        '0' +
        (date.getMonth() + 1)
      ).slice(-2)}-${date.getFullYear()}`,
    };
  }

  loadData(preserveSelection: boolean = false) {
    if (this.idEmployee === null || this.idEmployee === undefined) {
      return;
    }

    this.clockService.getSpecialHoursByEmployee(this.idEmployee, this.startDate, this.endDate).subscribe(
      (maestroRowData: any[]) => {
        if (!maestroRowData || maestroRowData.length === 0) {
          this.maestroRowData = [];
        } else {
          this.maestroRowData = maestroRowData;
          console.log(this.maestroRowData);
          this.trackingService.addLog(this.trackingService.getnameComp(),'Get Registro en Horas Extras Especiales', 'Menu Horas Extras Especiales en Checador',  this.trackingService.getEmail());
          setTimeout(() => {
            if (this.maestroGridApi && this.maestroRowData.length > 0) {
              // Buscar la fila que coincide con el ID guardado
              const rowToSelect =
                preserveSelection && this.selectedCreditIdBeforeRefresh
                  ? this.maestroRowData.findIndex(
                    (row) => row.id === this.selectedCreditIdBeforeRefresh
                  )
                  : 0;

              this.maestroGridApi
                .getDisplayedRowAtIndex(rowToSelect)
                ?.setSelected(true);

              // Restablecer el ID guardado
              this.selectedCreditIdBeforeRefresh = null;
            }
          });
        }
      },
      (error) => {
        console.error('Error loading special extra hours data:', error);
      }
    );
  }

  async addRow(type: string) {
    const tempId = `temp_${this.tempIdCounter++}`;
    const timeData = await this.getTime();

    if (type === 'Master') {
      const newRow = {
        id: tempId,
        idEmployee: this.idEmployee,
        startDateStamp: '', // Estos se calcularán automáticamente
        startHourStamp: '', // con los valueGetters
        endDateStamp: '',
        endHourStamp: '',
        active: true,
        __isNew: true,
      };
      this.maestroRowData = [newRow, ...this.maestroRowData];
      this.trackingService.addLog(this.trackingService.getnameComp(),'Add Registro en Horas Extras Especiales', 'Menu Horas Extras Especiales en Checador',  this.trackingService.getEmail());
      this.masterNotSavedChanges = true;

      setTimeout(() => {
        if (this.maestroGridApi) {
          const rowNode = this.maestroGridApi.getDisplayedRowAtIndex(0);
          rowNode?.setSelected(true);

          this.maestroGridApi.startEditingCell({
            rowIndex: 0,
            colKey: 'account',
          });
        }
      });
    }
  }

  onMaestroGridReady(params: GridReadyEvent) {
    this.maestroGridApi = params.api;
  }

  onMaestroSelectionChanged(event: SelectionChangedEvent) {
    const selectedRows = this.maestroGridApi.getSelectedRows();
    if (selectedRows.length > 0) {
      const selectedMaestro = selectedRows[0];
    }
  }

  async saveMasterChanges() {
    const isValid = this.maestroRowData.every((item) => 
      item.startDate && item.endDate && 
      this.isValidDate(item.startDate) && 
      this.isValidDate(item.endDate)
    );
    
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe ingresar fechas válidas.',
        'error'
      );
      return;
    }

    const newRows = this.maestroRowData.filter((row) => row.__isNew);
    const modifiedRows = this.maestroRowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.clockService.addSpecialHours(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.clockService.updateSpecialHours(row.id, cleanedData);
    });

    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.signalsService.setRefreshClock(true);
      this.masterNotSavedChanges = false;
      await this.loadData(); // Refrescar los datos
      this.signalsService.triggerRefreshEmployees();
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  revertMasterData() {
    this.loadData();
    this.masterNotSavedChanges = false;
    this.trackingService.addLog(this.trackingService.getnameComp(),'Revertir Registro en Horas Extras Especiales', 'Menu Horas Extras Especiales en Checador',  this.trackingService.getEmail());
  }

  onMasterCellValueChanged(event: any): void {
    console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.masterNotSavedChanges = true;
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

  async deleteMasterEntry() {
    const selectedNodes = this.maestroGridApi.getSelectedNodes();
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

    this.clockService
      .deleteSpecialHours(id)
      .pipe(
        catchError((error) => {
          // Verificar si el error es un 400 y mostrar un mensaje específico
          if (error.status === 400) {
            alerts.basicAlert(
              'Eliminar entrada',
              error.error.message || 'Error al eliminar la entrada.',
              'error'
            );
          } else {
            alerts.basicAlert(
              'Eliminar entrada',
              'Error al eliminar la entrada.',
              'error'
            );
          }
          console.error(error);
          return EMPTY;
        })
      )
      .subscribe(() => {
        alerts.basicAlert(
          'Eliminar entrada',
          'Entrada eliminada satisfactoriamente.',
          'success'
        );
        this.loadData();
        this.masterNotSavedChanges = false;
        this.signalsService.triggerRefreshEmployees();
        this.trackingService.addLog(this.trackingService.getnameComp(),'Delete Registro en Horas Extras Especiales', 'Menu Horas Extras Especiales en Checador',  this.trackingService.getEmail());
      });
  }

  private formatDate(dateString: string): string {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return `${('0' + date.getDate()).slice(-2)}-${('0' + (date.getMonth() + 1)).slice(-2)}-${date.getFullYear()}`;
  }
  
  private formatTime(dateString: string): string {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return `${('0' + date.getHours()).slice(-2)}:${('0' + date.getMinutes()).slice(-2)}:${('0' + date.getSeconds()).slice(-2)}`;
  }

  private isValidDate(dateString: string): boolean {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }
}
