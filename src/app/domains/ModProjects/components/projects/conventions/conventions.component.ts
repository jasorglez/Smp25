import { CommonModule } from '@angular/common';
import { Component, effect, ElementRef, HostListener, inject, TemplateRef, ViewChild } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AgGridModule } from 'ag-grid-angular';
import { GridApi, ColDef, GridReadyEvent, CellDoubleClickedEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { ConventionsService } from 'app/services/conventions.service';
import { WorkprogramsService } from 'app/services/workprograms.service';
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
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-conventions',
  standalone: true,
  imports: [DomainsModule, CommonModule, FormsModule, AgGridModule, MultiLineEditorComponent, conventionDetailsComponent, DetalleButtonRendererComponent],
  templateUrl: './conventions.component.html',
  styleUrl: './conventions.component.scss'
})
export class ConventionsComponent {
  private trackingService = inject(TrackingService);
  @ViewChild('content') content!: TemplateRef<any>;

  private conventionsService = inject(ConventionsService);
  private workprogramsService = inject(WorkprogramsService);
  public signalsService  = inject(SignalsService);
  readonly projectName   = this.signalsService.getProjectNameBySidebar();
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
  showWorkProgramTab: boolean = false;
  workprogramRows: any[] = [];
  targetConventionId: number | null = null;
  isCopying: boolean = false;
  isLoadingWP: boolean = false;


  constructor() {
    effect(() => {
      this.idc  = this.signalsService.getContractSelectedBySidebar()();
      this.type = 'Contract';
      this.resetGridSize();
      if (this.idc) {
        this.obtenerDatos();
      } else {
        this.rowData = [];
      }
    });

    // Cuando cambia el proyecto en el sidebar y el panel WP está abierto → recargar
    effect(() => {
      this.signalsService.getProjectSelectedBySidebar()(); // trackear
      if (this.showWorkProgramTab && this.idConvention) {
        this.loadWorkProgramForConvention();
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
        headerName: 'Det.',
        width: 55,
        editable: false,
        sortable: false,
        filter: false,
        cellStyle: { backgroundColor: '#cfe2ff', cursor: 'pointer', textAlign: 'center' },
        cellRenderer: DetalleButtonRendererComponent,
        cellRendererParams: {
          icon: 'bi bi-list-ul',
          color: '#0d6efd',
          label: 'Detalle',
          onDetalleClick: (data: any) => {
            this.selectedRowData = data;
            this.idConvention = data.id;
            this.signalsService.setIdConvention(data.id);
            this.adjustGridSize();
            this.showDetailsTab = true;
            this.showWorkProgramTab = false;
          }
        }
      },
      {
        field: 'workprogram',
        headerName: 'WP',
        width: 55,
        editable: false,
        sortable: false,
        filter: false,
        cellStyle: { backgroundColor: '#d1e7dd', cursor: 'pointer', textAlign: 'center' },
        cellRenderer: DetalleButtonRendererComponent,
        cellRendererParams: {
          icon: 'bi bi-diagram-3',
          color: '#198754',
          label: 'Work Program',
          onDetalleClick: (data: any) => {
            this.selectedRowData = data;
            this.idConvention = data.id;
            this.signalsService.setIdConvention(data.id);
            this.adjustGridSize();
            this.showDetailsTab = false;
            this.showWorkProgramTab = true;
            this.workprogramRows = [];
            this.loadWorkProgramForConvention();
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
          this.handleVigenteChange(params.data, params.newValue === true);
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
      this.rowData = [];
      return;
    }

    this.conventionsService
      .getConventionsByContractOrProject(this.type, this.idc)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 404) {
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
          this.enforceSingleVigente(false);
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
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Agregó nuevo conventions', 'Proyectos', this.trackingService.getEmail());
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
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Eliminó conventions', 'Proyectos', this.trackingService.getEmail());
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
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Deshizo cambios en conventions', 'Proyectos', this.trackingService.getEmail());
    this.obtenerDatos();
    this.notSavedChanges = false;
  }

  async saveChanges() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Guardó cambios en conventions', 'Proyectos', this.trackingService.getEmail());
    this.enforceSingleVigente(true);

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

  private handleVigenteChange(selectedRow: any, isChecked: boolean): void {
    if (!selectedRow) {
      return;
    }

    selectedRow.vigente = isChecked;

    if (!isChecked) {
      this.markRowAsModified(selectedRow);
      return;
    }

    this.rowData.forEach((row: any) => {
      if (row !== selectedRow && row.vigente === true) {
        row.vigente = false;
        this.markRowAsModified(row);
      }
    });

    this.markRowAsModified(selectedRow);
    this.refreshVigenteColumn();
  }

  private enforceSingleVigente(markDirty: boolean): void {
    if (!Array.isArray(this.rowData) || this.rowData.length === 0) {
      return;
    }

    let activeFound = false;
    this.rowData.forEach((row: any) => {
      if (row.vigente === true) {
        if (!activeFound) {
          activeFound = true;
          return;
        }

        row.vigente = false;
        if (markDirty) {
          this.markRowAsModified(row);
        }
      }
    });

    this.refreshVigenteColumn();
  }

  private markRowAsModified(row: any): void {
    row.__modified = true;
    this.notSavedChanges = true;
  }

  private refreshVigenteColumn(): void {
    if (!this.gridApi) {
      return;
    }

    const rowNodes: any[] = [];
    this.gridApi.forEachNode((node: any) => {
      if (node) {
        rowNodes.push(node);
      }
    });

    this.gridApi.refreshCells({
      rowNodes,
      columns: ['vigente'],
      force: true
    });
  }

  loadWorkProgramForConvention() {
    if (!this.idConvention) return;
    this.isLoadingWP = true;
    const idProject = this.signalsService.getProjectSelectedBySidebar()() ?? undefined;
    this.workprogramsService.getByConvention(this.idConvention, idProject).subscribe({
      next: (data) => {
        this.workprogramRows = this.buildTreePaths(data || []);
        this.isLoadingWP = false;
      },
      error: () => {
        this.workprogramRows = [];
        this.isLoadingWP = false;
        alerts.basicAlert('Error', 'No se pudo cargar el Work Program.', 'error');
      }
    });
  }

  copyWorkProgram() {
    if (!this.targetConventionId || !this.idConvention) return;
    if (this.targetConventionId === this.idConvention) {
      alerts.basicAlert('Copiar Work Program', 'El origen y destino no pueden ser el mismo convenio.', 'warning');
      return;
    }
    const idProject = this.signalsService.getProjectSelectedBySidebar()() ?? undefined;
    this.isCopying = true;
    this.workprogramsService.copyFromConvention(this.idConvention, this.targetConventionId, idProject).subscribe({
      next: (result) => {
        this.isCopying = false;
        this.targetConventionId = null;
        alerts.basicAlert('Work Program copiado', result.message || `${result.copied} tareas copiadas.`, 'success');
        this.loadWorkProgramForConvention();
      },
      error: () => {
        this.isCopying = false;
        alerts.basicAlert('Error', 'No se pudo copiar el Work Program.', 'error');
      }
    });
  }

  switchToWorkProgramTab() {
    this.showWorkProgramTab = true;
    this.showDetailsTab = false;
    if (this.workprogramRows.length === 0) {
      this.loadWorkProgramForConvention();
    }
  }

  private buildTreePaths(rows: any[]): any[] {
    const idMap = new Map<string, any>();
    rows.forEach(r => idMap.set(String(r.idTask), r));

    const getPath = (row: any): string[] => {
      const parentId = String(row.parent);
      if (!parentId || parentId === '0' || !idMap.has(parentId)) {
        return [String(row.idTask)];
      }
      return [...getPath(idMap.get(parentId)), String(row.idTask)];
    };

    return rows.map((r, i) => ({ ...r, _path: getPath(r), _seq: i + 1 }));
  }

  public wpGetDataPath = (data: any) => data._path as string[];

  public wpAutoGroupColDef: ColDef = {
    headerName: 'Act. — Descripción',
    minWidth: 320,
    flex: 3,
    cellRendererParams: { suppressCount: true },
    valueGetter: (params: any) => {
      const act = params.data?.activity ? `${params.data.activity}. ` : '';
      return act + (params.data?.text ?? '');
    },
    tooltipValueGetter: (params: any) => params.data?.text ?? '',
  };

  get wpColDefs(): ColDef[] {
    const fmt = (v: any) => v != null
      ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v)
      : '';
    const fmtDate = (v: any) => v ? String(v).substring(0, 10) : '';

    return [
      { field: '_seq', headerName: '#', width: 55, pinned: 'left', sortable: false, filter: false },
      { field: 'typeActivity', headerName: 'Tipo',   width: 80 },
      { field: 'startDate', headerName: 'Inicio',    width: 105, valueFormatter: p => fmtDate(p.value) },
      { field: 'endDate',   headerName: 'Fin',       width: 105, valueFormatter: p => fmtDate(p.value) },
      { field: 'quantity',  headerName: 'Cant.',     width: 80 },
      { field: 'measure',   headerName: 'Unidad',    width: 80 },
      { field: 'costMX',    headerName: 'Costo MXN', width: 130, valueFormatter: p => fmt(p.value) },
      { field: 'total',     headerName: 'Total',     width: 130, valueFormatter: p => fmt(p.value) },
      { field: 'ponderado', headerName: 'Pond.',     width: 80 },
      { field: 'progress',  headerName: 'Avance',    width: 80,  valueFormatter: p => p.value != null ? `${p.value}%` : '' },
      { field: 'criticRoute', headerName: 'Crítica', width: 80 },
    ];
  }

  public wpDefaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    filter: true,
  };

  public wpGridOptions: any = {
    treeData: true,
    groupDefaultExpanded: -1,
    headerHeight: 25,
    rowHeight: 20,
  };

  async adjustGridSize() {
    this.gridHeight = '20vh';
  }

  resetGridSize() {
    this.gridHeight = '80vh';
    this.idConvention = null;
    this.showDetailsTab = false;
    this.showWorkProgramTab = false;
    this.workprogramRows = [];
    this.targetConventionId = null;
    if (this.gridApi) {
      this.gridApi.setFilterModel(null);
      this.gridApi.onFilterChanged();
    }
  }

}
