import { Component, Inject, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { ReceivedataService } from 'app/services/receivedata.service';
import { catchError, delay, finalize, of, tap } from 'rxjs';
import { AgGridModule } from 'ag-grid-angular';
import 'ag-grid-enterprise';
import { CommonModule } from '@angular/common';
import { ColDef, GridApi, GridReadyEvent, SelectionChangedEvent } from 'ag-grid-community';
import { HttpClient } from '@angular/common/http';
import { alerts } from 'app/helpers/alerts';
import { MultiLineEditorComponent } from './multi-line-editor.component';
import { ModalService } from 'app/services/modal.service';

@Component({
  selector: 'app-report-table',
  standalone: true,
  imports: [AgGridModule, CommonModule],
  templateUrl: './report-table.component.html',
  styleUrl: './report-table.component.scss'
})
export class ReportTableComponent implements OnChanges {

  @Input() inputData!: { id: number, date: string };

  defaultColDef = {
    sortable: true,
    filter: true
  };

  entrada: any[] | undefined;
  numItems: number = 0;

  gestionarDatos: any[] = [];
  private gridApi!: GridApi;

  urlAzure = 'https://bi24.azurewebsites.net/api/Logbook';
  lb: string = '';
  id: number = 0;
  isLoading: boolean = true;

  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  public groupDefaultExpanded = 0;

  public autoGroupColumnDef: ColDef = {
    headerName: 'Tipo Notas',
    field: 'topic',
    width: 275,
    cellRenderer: 'agGroupCellRenderer',
    cellRendererParams: {}
  };

  columnDefs: ColDef[] = [
    { field: 'topic', headerName: 'Tipo Nota', width: 385, rowGroup: true, hide: true },
    { field: 'id', headerName: 'ID Nota', hide: true },
    {
      field: 'description',
      headerName: 'Comentario',
      width: 545,
      editable: true,
      cellStyle: { 'white-space': 'normal', 'line-height': '20px' },
      cellEditor: 'agPopupTextCellEditor',
      cellEditorParams: {
        maxLength: 200,
        cols: 50,
        rows: 6,
        onKeyDown: (event: KeyboardEvent) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.stopPropagation();
          }
        }
      },
      onCellClicked: (params: any) => {
        this.modalService.showModal({
          params: params,
          value: params.value
        });
        return false; // Prevent default editing
      }
    },
    { field: 'supervisor', headerName: 'Supervisor', width: 195, filter: true }
  ];

  frameworkComponents = {
    multiLineEditor: MultiLineEditorComponent
  };

  constructor(private datos: ReceivedataService, private httpClient: HttpClient, private modalService: ModalService) { }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['inputData'] && changes['inputData'].currentValue) {
      this.id = this.inputData.id;
      this.lb = this.inputData.date;
      this.conseguirDatos();
    }
  }

  conseguirDatos() {
    this.isLoading = true;
    this.datos.recibirDatos(this.urlAzure, this.lb, this.id).pipe(
      tap((data: any[]) => {
        this.entrada = data;
        this.numItems = this.entrada.length;
      }),
      catchError(error => {
        console.error('Error occurred:', error);
        return of(null);
      }),
      finalize(() => {
        this.bucleDatos();
        this.isLoading = false;
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.gestionarDatos);
        }
      })
    ).subscribe();
  }

  bucleDatos() {
    this.gestionarDatos = [];
    let j = 1;

    if (!this.entrada) {
      return;
    }

    for (let i = 0; i < this.numItems; i++) {
      let temporal = {
        id: this.entrada[i]?.id,
        order: this.entrada[i]?.orden,
        topic: this.entrada[i]?.typeNote,
        description: this.entrada[i]?.description,
        supervisor: this.entrada[i]?.supervisor,
        timexnote: this.entrada[i]?.timexnote
      };
      j++;
      this.gestionarDatos.push(temporal);
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    if (this.gestionarDatos.length > 0) {
      this.gridApi.setGridOption('rowData', this.gestionarDatos);
    }
  }

  onSelectionChanged(event: SelectionChangedEvent) {
    const selectedRows = this.gridApi.getSelectedRows();
    if (selectedRows.length > 0) {
      console.log('Selected row:', selectedRows[0]);
    }
  }

  onCellValueChanged(event: any) {
    const updatedData = {
      id: event.data.id,
      idProject: this.id,
      idReporte: 0,
      date: this.lb,
      typeNote: event.data.topic,
      timexnote: event.data.timexnote,
      supervisor: event.data.supervisor,
      imageUrl: 'Sin Imagen APi',
      description: event.data.description,
      imageAzure: 'Sin imagen en Azure',
      orden: event.data.order
    };
    // Descomentar la siguiente línea para habilitar la actualizacion de
    // la base de datos
    this.updateDatabase(event.data.id, updatedData);
  }

  updateDatabase(id: number, data: any) {
    this.httpClient.put(this.urlAzure + '/' + id, data).subscribe(response => {
      alerts.basicAlert("Confirmación", "El campo fue editado exitosamente.", "success");
    },
      error => {
        alerts.basicAlert("Error", "Hubo un error al editar el campo, intente nuevamente.", "error");
      });
  }
}