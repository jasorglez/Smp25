import { CommonModule } from '@angular/common';
import { Component, effect, ElementRef, HostListener, inject, TemplateRef, ViewChild } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AgGridModule } from 'ag-grid-angular';
import { GridApi, ColDef, GridReadyEvent, CellDoubleClickedEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { ConventionsService } from 'app/services/conventions.service';
import { lastValueFrom, concat, toArray, catchError, EMPTY, throwError, of } from 'rxjs';
import { SignalsService } from 'app/services/signals.service';
import { HttpErrorResponse } from '@angular/common/http';
import { NgbModal, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { AttachHandlerService } from 'app/services/attach-handler.service';
import { MultiLineEditorComponent } from "../../../../../shared/multi-line/multi-line-editor.component";
import { ModalService } from 'app/services/modal.service';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { conventionDetailsComponent } from "./convention-details/convention-details.component";
import { DetalleButtonRendererComponent } from "./detalle-button-renderer.component";

@Component({
  selector: 'app-conventions',
  standalone: true,
  imports: [DomainsModule, CommonModule, FormsModule, AgGridModule, MultiLineEditorComponent, conventionDetailsComponent, DetalleButtonRendererComponent],
  templateUrl: './conventions.component.html',
  styleUrl: './conventions.component.scss'
})
export class ConventionsComponent {
  @ViewChild('content') content!: TemplateRef<any>;

  private conventionsService = inject(ConventionsService);
  private signalsService = inject(SignalsService);
  private modalService = inject(NgbModal);
  public attachHandlerService = inject(AttachHandlerService);
  private modalServiceTable = inject(ModalService);

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  addConvention: FormGroup;
  isEditing = false;
  notSavedChanges: boolean = false;
  rowData: any;
  selectedRowData: any = null;
  id: number = null;
  idConvention: number = null;
  idc: number = null;
  type: string = null;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  selectedContract: number = null;
  gridHeight: string = '80vh';
  newlyAddedRows: string[] = [];
  private isOpen: boolean = false;
  showDetailsTab: boolean = false;

  constructor() {
    effect(() => {
      this.idc = this.signalsService.getContractSelectedBySidebar()();
      this.type = "Contract";
      if (this.idc) {
        this.obtenerDatos();
      } else {
        alerts.basicAlert(
          'Contrato no seleccionado',
          'Por favor, seleccione un contrato en el panel lateral para ver los convenios.',
          'warning'
        );
      }
    });
    this.initForm();
  }

  initForm() {
    this.addConvention = new FormGroup({
      id: new FormControl(),
      name: new FormControl('', Validators.required),
      description: new FormControl('', Validators.required),
      start: new FormControl('', Validators.required),
      end: new FormControl('', Validators.required),
      amountMX: new FormControl('', Validators.required),
      amountDLL: new FormControl('', Validators.required),
      comment: new FormControl(''),
      id_type: new FormControl(1),
      idContract: new FormControl(),
      idProject: new FormControl(0),
      type: new FormControl(),
      active: new FormControl(1)
    });
  }

  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    rowBuffer: 20,
    getRowStyle: (params) => {
      if (params.data?.vigente === true) {
        return { background: '#ffe4e6' };
      }
      return '';
    },
    onRowClicked: async (event) => {
      event.node.setSelected(true);
      
      if (!event.data) {
        console.warn('No hay datos en la fila seleccionada');
        return;
      }
    
      this.notSavedChanges = true;
      this.selectedRowData = event.data;
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
    onCellKeyDown: (params) => {
      if (params.event.key === 'Enter') {
        const allColumns = this.columnDefs;
        const currentColIndex = allColumns.findIndex(
          (col) => col.field === params.column.getColDef().field
        );
  
        if (currentColIndex < allColumns.length - 1) {
          setTimeout(() => {
            const rowNode = params.api.getRowNode(params.node.rowIndex);
            if (rowNode) {
              rowNode.setSelected(true);
            }
            params.api.ensureIndexVisible(params.node.rowIndex);
            params.api.startEditingCell({
              rowIndex: params.node.rowIndex,
              colKey: allColumns[currentColIndex + 1].field,
            });
          }, 150);
        }
        params.event.preventDefault();
      }
    }
  };

  get columnDefs(): ColDef[] {
    return [
      {
        field: 'name',
        headerName: 'Nombre',
        editable: true,
        flex: 1,
        cellEditor: 'agTextCellEditor',
        cellEditorParams: {
          maxLength: 10
        },
        valueSetter: (params) => {
          const newValue = params.newValue;
          if (newValue && newValue.length > 10) {
            alerts.basicAlert('Límite excedido', 'El nombre no puede exceder 10 caracteres.', 'warning');
            return false;
          }
          params.data.name = newValue;
          return true;
        }
      },
      {
        field: 'detalle',
        headerName: 'Detalle',
        width: 90,
        editable: false,
        sortable: false,
        filter: false,
        cellStyle: { backgroundColor: '#cfe2ff', cursor: 'pointer', textAlign: 'center' },
        cellRenderer: DetalleButtonRendererComponent,
        cellRendererParams: {
          onDetalleClick: (data: any) => {
            console.log('Detalle clicked:', data);
            this.selectedRowData = data;
            this.idConvention = data.id;
            this.signalsService.setIdConvention(data.id);
            this.adjustGridSize();
            this.showDetailsTab = true;
            console.log('idConvention:', this.idConvention, 'showDetailsTab:', this.showDetailsTab);
          }
        }
      },
      {
        field: 'description',
        headerName: 'Descripción',
        editable: false,
        flex: 2,
        cellEditor: 'agPopupTextCellEditor',
        cellEditorParams: {
          maxLength: 100,
          cols: 50,
          rows: 3,
          onKeyDown: (event: KeyboardEvent) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.stopPropagation();
            }
          },
        },
        onCellDoubleClicked: (event: CellDoubleClickedEvent) => {
          if (!event.node.group) {
            this.modalServiceTable.showModal({
              params: event,
              value: event.value,
            });
          }
        }
      },
      {
        field: 'vigente',
        headerName: 'Vigente',
        editable: true,
        cellRenderer: 'agCheckboxCellRenderer',
        cellEditor: 'agCheckboxCellEditor',
        width: 120,
        onCellValueChanged: (params: any) => {
          if (params.newValue === true) {
            this.rowData.forEach((row: any) => {
              if (row !== params.data && row.vigente === true) {
                row.vigente = false;
              }
            });
            const rowNodes: any[] = [];
            this.gridApi.forEachNode((node: any) => {
              if (node) rowNodes.push(node);
            });
            this.gridApi.refreshCells({
              rowNodes: rowNodes,
              columns: ['vigente'],
              force: true
            });
          }
        }
      },
      {
        field: 'start',
        headerName: 'Fecha inicio',
        editable: true,
        cellDataType: 'dateString',
        flex: 1,
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        }
      },
      {
        field: 'end',
        headerName: 'Fecha fin',
        editable: true,
        cellDataType: 'dateString',
        flex: 1,
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        }
      },
      {
        field: 'amountMX',
        headerName: 'Monto MXN',
        editable: true,
        cellDataType: 'number',
        valueFormatter: params => {
          return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
          }).format(params.value);
        },
        flex: 1
      },
      {
        field: 'amountDLL',
        headerName: 'Monto USD',
        editable: true,
        cellDataType: 'number',
        valueFormatter: params => {
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
          }).format(params.value);
        },
        flex: 1
      },
      {
        field: 'comment',
        headerName: 'Comentario',
        editable: false,
        flex: 2,
        cellEditor: 'agPopupTextCellEditor',
        cellEditorParams: {
          maxLength: 100,
          cols: 50,
          rows: 3,
          onKeyDown: (event: KeyboardEvent) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.stopPropagation();
            }
          },
        },
        onCellDoubleClicked: (event: CellDoubleClickedEvent) => {
          if (!event.node.group) {
            this.modalServiceTable.showModal({
              params: event,
              value: event.value,
            });
          }
        }
      }
    ];
  }

  obtenerDatos() {
    if (!this.idc) {
      alerts.basicAlert(
        'Contrato no seleccionado',
        'Por favor, seleccione un contrato en el panel lateral.',
        'warning'
      );
      return;
    }

    this.conventionsService
      .getConventionsByContractOrProject(this.type, this.idc)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 404) {
            console.log('No se encontraron datos para el contrato seleccionado');
            this.rowData = [];
            return of([]);
          }
          throw error;
        })
      )
      .subscribe((data: any) => {
        if (data && Array.isArray(data)) {
          this.rowData = data.map((row: any) => ({
            ...row,
            vigente: row.vigente === 1 || row.vigente === true || row.vigente === '1' || row.vigente === 'true'
          }));
        } else {
          this.rowData = data;
        }
      });
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
      this.id = this.selectedRowData.id;
    } else {
      this.selectedRowData = null;
      this.id = null;
    }
  }

  onCellValueChanged(event: any) {
    console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    
    const newItem = {
      id: tempId,
      id_type: 1,
      idContract: this.idc,
      idProject: 0,
      type: this.type,
      name: 'CONV-001',
      description: 'CONVENIO NUMERO',
      start: startOfYear.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0],
      amountMX: 0,
      amountDLL: 0,
      comment: '',
      active: true,
      __isNew: true
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;

    const newRowIndex = this.rowData.findIndex((row) => row.id === tempId);
    const firstEditableCol = this.columnDefs.find(col => col.editable);
    const firstEditableColKey = firstEditableCol ? firstEditableCol.field : null;

    setTimeout(() => {
      if (firstEditableColKey) {
        const rowNode = this.gridApi.getRowNode(newRowIndex);
        if (rowNode) {
          rowNode.setSelected(true);
        }
        this.gridApi.ensureIndexVisible(newRowIndex);
        this.gridApi.startEditingCell({
          rowIndex: newRowIndex,
          colKey: firstEditableColKey,
        });
      }
    }, 100);
  }

  editRow() {
    if (!this.selectedRowData) {
      alerts.basicAlert(
        'Editar convenio',
        'Por favor, seleccione un convenio para editar.',
        'warning'
      );
      return;
    }

    this.isEditing = true;
    this.populateForm(this.selectedRowData);
    this.openModal();
  }

  populateForm(data: any) {
    this.addConvention.patchValue({
      id: data.id,
      name: data.name,
      description: data.description,
      start: this.formatDateForInput(data.start),
      end: this.formatDateForInput(data.end),
      amountMX: data.amountMX,
      amountDLL: data.amountDLL,
      comment: data.comment,
      id_type: data.id_type,
      idContract: data.idContract,
      idProject: data.idProject,
      type: data.type,
      active: data.active
    });
  }

  formatDateForInput(dateString: string | null): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  }

  openModal() {
    const modalOptions: NgbModalOptions = {
      size: 'xl',
      centered: true
    };
    this.modalService.open(this.content, modalOptions);
  }

  onSubmit() {
    if (this.addConvention.valid) {
      const formData = this.prepareFormData();

      if (this.isEditing && this.selectedRowData) {
        this.conventionsService.updateConvention(this.selectedRowData.id, formData).pipe(
          catchError((error) => {
            alerts.basicAlert(
              'Actualizar convenio',
              'Hubo un error al intentar actualizar la información.',
              'error'
            );
            console.error('Error updating convention:', error);
            return EMPTY;
          })
        ).subscribe(() => {
          alerts.basicAlert(
            'Actualizar convenio',
            'Convenio actualizado exitosamente.',
            'success'
          );
          this.obtenerDatos();
          this.modalService.dismissAll();
          this.resetForm();
        });
      } else {
        this.conventionsService.addConvention(formData).pipe(
          catchError((error) => {
            alerts.basicAlert(
              'Añadir convenio',
              'Hubo un error al intentar guardar la información.',
              'error'
            );
            console.error('Error adding convention:', error);
            return EMPTY;
          })
        ).subscribe(() => {
          alerts.basicAlert(
            'Añadir convenio',
            'Convenio añadido exitosamente.',
            'success'
          );
          this.obtenerDatos();
          this.modalService.dismissAll();
          this.resetForm();
        });
      }
    } else {
      alerts.basicAlert(
        this.isEditing ? 'Actualizar convenio' : 'Añadir convenio',
        'Debe completar todos los campos correctamente.',
        'error'
      );
    }
  }

  prepareFormData(): any {
    const formValue = this.addConvention.value;
    return {
      ...formValue,
      start: this.formatDateForBackend(formValue.start),
      end: this.formatDateForBackend(formValue.end)
    };
  }

  formatDateForBackend(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  }

  deleteEntry() {
    if (!this.selectedRowData) {
      alerts.basicAlert(
        'Eliminar convenio',
        'Por favor, seleccione un convenio para eliminar.',
        'warning'
      );
      return;
    }

    this.conventionsService.deleteConvention(this.selectedRowData.id).pipe(
      catchError((error) => {
        alerts.basicAlert(
          'Eliminar convenio',
          'Error al eliminar el convenio.',
          'error'
        );
        console.error(error);
        return EMPTY;
      })
    ).subscribe(() => {
      alerts.basicAlert(
        'Eliminar convenio',
        'Convenio eliminado satisfactoriamente.',
        'success'
      );
      this.obtenerDatos();
      this.selectedRowData = null;
    });
  }

  resetForm() {
    this.initForm();
    this.isEditing = false;
    this.selectedRowData = null;
  }

  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
  }

  async saveChanges() {
    const isValid = this.rowData.every((item) =>
      item.name && item.description && item.start && item.end);
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar todos los campos antes de guardar.',
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
      console.log('Sending data to server:', cleanedData);
      return this.conventionsService.addConvention(cleanedData).pipe(
        catchError((error) => {
          console.error('Error adding agreement:', error);
          if (error.error?.errors) {
            console.error('Validation errors:', JSON.stringify(error.error.errors));
          }
          return throwError(() => new Error(`Error al añadir acuerdo: ${error.message}`));
        })
      );
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.conventionsService.updateConvention(row.id, cleanedData).pipe(
        catchError((error) => {
          console.error('Error updating agreement:', error);
          return throwError(() => new Error(`Error al actualizar acuerdo: ${error.message}`));
        })
      );
    });

    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(
          toArray(),
          catchError((error) => {
            console.error('Error in observable chain:', error);
            return throwError(() => new Error(`Error en la operación: ${error.message}`));
          })
        )
      );

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      this.obtenerDatos();
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        `Ocurrió un error al actualizar los datos: ${error.message}. Por favor, intente nuevamente.`,
        'error'
      );
    }
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

  async adjustGridSize() {
    this.gridHeight = '20vh';
  }

  resetGridSize() {
    this.gridHeight = '80vh';
    this.idConvention = null;
    this.showDetailsTab = false;
    if (this.gridApi) {
      this.gridApi.setFilterModel(null);
      this.gridApi.onFilterChanged();
    }
  }
}
