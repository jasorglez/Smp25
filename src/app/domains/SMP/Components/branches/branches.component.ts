import { CommonModule } from '@angular/common';
import { Component, effect, HostListener, inject, ViewChild } from '@angular/core';
import { SignalsService } from 'app/services/signals.service';
import { AgGridModule } from 'ag-grid-angular';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import {
  ColDef,
  GridApi,
  GridReadyEvent
} from 'ag-grid-enterprise';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { BranchsService } from 'app/services/branchs.service';
import { alerts } from 'app/helpers/alerts';
import { ModalService } from 'app/services/modal.service';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { InegiService } from 'app/services/inegi.service';
import { States } from 'app/interface/states';
import { environment } from '@env/environment';
import { Ibranch } from 'app/interface/ibranch';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';
import { HRService } from 'app/services/hr.service';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { RootService } from 'app/services/root.service';

@Component({
  selector: 'app-branches',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AgGridModule, MultiLineEditorComponent],
  templateUrl: './branches.component.html',
  styleUrl: './branches.component.scss',
})
export class BranchesComponent implements CanComponentDeactivate {
  @ViewChild('content') content: any;

  public signalsService = inject(SignalsService);
  public environment = environment;
  private branchesService = inject(BranchsService);
  private modalService = inject(NgbModal);
  private inegiService = inject(InegiService);
  private hrService = inject(HRService);
  private rootService = inject(RootService);

  //Variables master
  masterRowData: any[] = [];
  masterSelectedRowData: any = null;
  newlyAddedMasterRows: string[] = [];
  masterNotSavedChanges: boolean = false;
  idRoot: number = null;
  idUser: number = null;
  gridHeight: string = '85vh';
  addBranch: FormGroup;
  estados: any;
  isEditing: boolean = false;
  companies: any[] = []; // Nueva propiedad para almacenar las compañías

  //idRoot = this.signalsService.getRootSelectedBySidebar(); // Asignar directamente la Signal

  id: number = null;
  private masterGridApi: GridApi;
  private tempIdCounter: number = 0;

  // Configuración Grid
  public rowSelection: 'single' | 'multiple' = 'single';

  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';

  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];

  constructor() {
    this.initForm();
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.idUser = this.signalsService.getIdUSer()();
      if (this.idRoot == null) {
        this.masterRowData = [];
        alerts.basicAlert(
          'Sucursales',
          'Debe elegir una empresa primero para poder ver sus sucursales.',
          'error'
        );
      } else {
        this.obtenerDatos();
      }
    });
  }

  ngOnInit() {
    this.idUser = this.signalsService.getIdUSer()();
    this.obtenerDatos();
    this.obtenerEstados();
    if (this.signalsService.getemailChoose() === environment.root) {
      this.obtenerCompanias();
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.masterNotSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  // ==================== MASTER METHODS ====================

  obtenerDatos() {
    if (this.signalsService.getemailChoose() === environment.root) {
      this.branchesService.getAllBranches().subscribe(
        (data: Ibranch[]) => {
          this.masterRowData = data;
          this.masterNotSavedChanges = false;
        },
        (error) => {
          console.error('Error fetching all branches:', error);
        }
      );
    } else {
      this.branchesService.getBranches(this.idRoot).subscribe(
        (data: Ibranch[]) => {
          this.masterRowData = data.sort((a, b) =>
            a.name.localeCompare(b.name)
          );
          this.masterNotSavedChanges = false;
        },
        (error) => {
          console.error('Error fetching branches:', error);
        }
      );
    }
  }

  obtenerEstados() {
    this.inegiService.getEstados().subscribe({
      next: (data: { datos: States[] }) => {
        this.estados = data.datos.map((estado, index) => ({
          ...estado,
          id: index + 1,
        }));
      },
      error: (error) => {
        console.error('Error fetching states', error);
      },
    });
  }

  obtenerCompanias() {
    this.rootService.getRoot().subscribe({
      next: (data: any) => {
        this.companies = data;
      },
      error: (error) => {
        console.error('Error al obtener las compañías:', error);
        alerts.basicAlert(
          'Error',
          'No se pudieron obtener las compañías',
          'error'
        );
      }
    });
  }

  // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    groupDefaultExpanded: -1,
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
        this.masterGridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
    onCellDoubleClicked: (event) => {
      this.signalsService.getemailChoose() === environment.root ? this.editRow(event.data) : '  ';
    }
  };


  editRow(data: any) {
    this.isEditing = true;
    this.initForm();
    this.addBranch.patchValue({
      id: data.id,
      idCompany: data.idCompany,
      idEstado: data.idEstado,
      name: data.name,
      description: data.description,
      address: data.address,
      orden: data.orden,
      active: data.active
    });
    this.modalService.open(this.content, { size: 'lg' });
  }

  get colMaster(): ColDef[] {
    const columns: ColDef[] = [];

    // Agregar columna condicional
    if (this.signalsService.getemailChoose() === environment.root) {
      columns.push({
        field: 'rootName',
        hide: true,
        headerName: 'Empresa',
        editable: this.signalsService.getemailChoose() === environment.root ? false : true,
        filter: true,
        width: 200,
        enableRowGroup: true,  // Permite agrupar por esta columna
        enablePivot: true,    // Permite usar esta columna como pivote
        rowGroup: true,      // Inicialmente no agrupado (puedes cambiarlo a true si quieres que se agrupe por defecto)
        pivot: true,
        headerCheckboxSelection: false,
        checkboxSelection: false       // Inicialmente no como pivote
      })
    }

    // Agregar el resto de las columnas
    columns.push(
      {
        field: 'name',
        headerName: 'Nombre *',
        editable: this.signalsService.getemailChoose() === environment.root ? false : true,
        filter: true,
        width: 250,
        valueSetter: (params) => {
          const rawValue = params.newValue;
          if (!rawValue || typeof rawValue !== 'string') {
            alerts.basicAlert('Campo requerido', 'El nombre es obligatorio', 'error');
            return false;
          }

          const normalizedValue = rawValue.trim().toUpperCase();

          if (!normalizedValue) {
            alerts.basicAlert('Campo requerido', 'El nombre es obligatorio', 'error');
            return false;
          }

          const duplicateExists = this.masterRowData.some(
            (row, index) =>
              index !== params.node.rowIndex &&
              row.name?.toUpperCase() === normalizedValue
          );

          if (duplicateExists) {
            alerts.basicAlert(
              'Nombre duplicado',
              'Ya existe una sucursal con ese nombre.',
              'error'
            );
            return false;
          }

          params.data[params.colDef.field] = normalizedValue;
          return true;
        },

      },
      {
        field: 'description',
        headerName: 'Descripción *',
        editable: this.signalsService.getemailChoose() === environment.root ? false : true,
        filter: true,
        width: 400,
        valueSetter: (params) => {
          params.data[params.colDef.field] = params.newValue?.toUpperCase();
          return true;
        },
      },
      {
        field: 'idEstado',
        headerName: 'Estado',
        editable: this.signalsService.getemailChoose() !== environment.root,
        filter: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.estados.map(e => e.nom_agee), // valores visibles en el editor
        },
        valueFormatter: (params) => {
          const found = this.estados.find(e => e.id === params.value);
          return found ? found.nom_agee : '';
        },
        valueGetter: (params) => {
          // Devuelve el ID real, para mantener consistencia interna
          return params.data?.idEstado ?? null;
        },
        valueSetter: (params) => {
          const selectedName = (params.newValue || '').trim();
          const estado = this.estados.find(e => e.nom_agee === selectedName);
          if (estado) {
            params.data.idEstado = estado.id;
            return true;
          }
          return false;
        }
      },
      {
        field: 'address',
        headerName: 'Dirección *',
        editable: this.signalsService.getemailChoose() === environment.root ? false : true,
        filter: true,
        width: 400,
        /*cellEditor: 'agPopupTextCellEditor',
      cellEditorParams: {
           maxLength: 100,
           cols: 50,
           rows: 3,
       },
       onCellDoubleClicked: (event: CellDoubleClickedEvent) => {
           if (!event.node.group) {
               this.modalServiceTable.showModal({
                   params: event,
                   value: event.value,
               });
           }
       },
       cellRenderer: (params: ICellRendererParams) => {
           return params.node.group ? params.value : params.value;
       },*/
        valueSetter: (params) => {
          params.data[params.colDef.field] = params.newValue?.toUpperCase();
          return true;
        },
      },
      {
        field: 'vigente',
        headerName: 'Activo',
        editable: this.signalsService.getemailChoose() === environment.root ? false : true,
        suppressMovable: true,
        filter: true,
        width: 150,
        cellRenderer: (params) => {
          return `<input type="checkbox" ${params.value ? 'checked' : ''
            } disabled />`;
        },
      }
    );

    return columns;
  }

  onMasterCellValueChanged(event: any) {
    const updatedData = { ...event.data };

    // Preservar el estado temporal y la selección
    if (this.newlyAddedMasterRows.includes(updatedData.id)) {
      updatedData.__isNew = true;
    }

    updatedData.__modified = true;
    this.masterNotSavedChanges = true;

    // Actualizar el array de datos
    this.masterRowData = this.masterRowData.map((row) =>
      row.id === updatedData.id ? updatedData : row
    );

    // Actualizar la fila en la cuadrícula
    const rowNode = this.masterGridApi.getRowNode(updatedData.id);
    if (rowNode) {
      rowNode.setData(updatedData);
      // Mantener la selección si es necesario
      if (
        this.masterSelectedRowData &&
        this.masterSelectedRowData.id === updatedData.id
      ) {
        rowNode.setSelected(true);
      }
    }
  }

  onMasterSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      // Crear una copia profunda del dato seleccionado
      this.masterSelectedRowData = { ...selectedNodes[0].data };
    } else {
      this.masterSelectedRowData = null;
    }
  }

  onMasterGridReady(params: GridReadyEvent) {
    this.masterGridApi = params.api;
  }

  addMasterRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idCompany: this.idRoot,
      idEstado: null,
      name: '',
      description: '',
      address: '',
      orden: 0,
      active: true,
      __isNew: true,
    };

    if (this.signalsService.getemailChoose() === environment.root) {
      this.initForm();
      this.modalService.open(this.content, { size: 'lg' });
    }
    else {
      setTimeout(() => {
      const firstRowIndex = 0;

      this.masterGridApi.ensureIndexVisible(firstRowIndex);

      this.masterGridApi.startEditingCell({
        rowIndex: firstRowIndex,
        colKey: 'name'
      });
    }, 0);
      this.masterRowData = [newItem, ...this.masterRowData];
    }
    this.isEditing = false;

  }

  async onSubmit() {
    if (this.addBranch.valid) {
      const formData = this.addBranch.value;
      const newItem = {
        id: formData.id || `temp_${this.tempIdCounter++}`,
        idCompany: this.signalsService.getemailChoose() === environment.root ? formData.idCompany : this.idRoot,
        idEstado: formData.idEstado,
        name: formData.name.toUpperCase(),
        description: formData.description.toUpperCase(),
        address: formData.address.toUpperCase(),
        orden: formData.orden || 0,
        vigente: formData.vigente || 1,
        __isNew: !formData.id,
        __modified: !!formData.id
      };

      try {
        if (formData.id) {
          // Actualizar sucursal existente
          const cleanedData = this.cleanDataForServer(newItem);
          await lastValueFrom(this.branchesService.updateBranch(formData.id, cleanedData));

          alerts.basicAlert(
            'Éxito',
            'La sucursal ha sido actualizada correctamente',
            'success'
          );
        } else {
          // Agregar nueva sucursal
          const cleanedData = this.cleanDataForServer(newItem);
          const response = await lastValueFrom(this.branchesService.addBranch(cleanedData));

          // Actualizar el ID temporal con el real
          newItem.id = response.id;

          // Asignar permisos para el nuevo Branch creado
          await lastValueFrom(
            this.branchesService.assignPermissionAfterCreation(
              this.idUser,
              response.id,
              'branch'
            )
          );

          // Añadir valores por default a HRManagement
          const hrManagementData = {
            idBranch: response.id,
            vigency: 120,
            startDay: 'Lunes',
            clockTolerance: 120,
            delay1: 5,
            delay2: 65,
            discount1: true,
            discount2: true,
            discount: 50,
            payrollPeriod: 15,
            overtimePay: 100,
            specialOvertimePay: 150,
            active: true
          };
          await lastValueFrom(this.hrService.addHRManagementData(hrManagementData));

          alerts.basicAlert(
            'Éxito',
            'La sucursal ha sido creada correctamente',
            'success'
          );
        }

        // Actualizar la lista de sucursales y cerrar el modal
        this.revertMasterData();
        this.modalService.dismissAll();

      } catch (error) {
        console.error('Error al procesar la sucursal:', error);
        alerts.basicAlert(
          'Error',
          'Ocurrió un error al procesar la sucursal',
          'error'
        );
      }
    } else {
      alerts.basicAlert(
        'Error',
        'Por favor complete todos los campos requeridos',
        'error'
      );
    }
  }

  async saveMasterChanges() {
    const isValid = this.masterRowData.every(
      (item) => item.name && item.description && item.address
    );
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar todos los campos antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.masterRowData.filter((row) => row.__isNew);
    const modifiedRows = this.masterRowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    // Tipamos explícitamente las promesas
    const addPromises: Promise<Ibranch>[] = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return lastValueFrom(this.branchesService.addBranch(cleanedData)).then(response => {
        return response;
      });
    });

    const updatePromises: Promise<Ibranch>[] = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return lastValueFrom(
        this.branchesService.updateBranch(row.id, cleanedData)
      );
    });

    try {
      const allResponses = await Promise.all([
        ...addPromises,
        ...updatePromises,
      ]);

      // Asignar permisos para los nuevos Branchs creados
      console.log(allResponses);
      for (const response of allResponses) {
        // Verificar si es una nueva creación comparando con los IDs temporales
        const correspondingNewRow = newRows.find(
          (row) => !row.id || row.id.toString().startsWith('temp_')
        );
        console.log(response.id);

        // Aquí construyo HRManagement.
        const newItem = {
          idBranch: response.id,
          vigency: 120,
          startDay: 'Lunes',
          clockTolerance: 120,
          delay1: 5,
          delay2: 65,
          discount1: true,
          discount2: true,
          discount: 50,
          payrollPeriod: 15,
          overtimePay: 100,
          specialOvertimePay: 150,
          active: true
        };
        if (response.id && correspondingNewRow) {
          try {
            // El creador de la sucursal tiene permisos sobre la sucursal
            await lastValueFrom(
              this.branchesService.assignPermissionAfterCreation(
                this.idUser,
                response.id,
                'branch'
              )
            );
            // Se añaden valores por default a HRManagement
            await lastValueFrom(
              this.hrService.addHRManagementData(newItem)
            );
          } catch (permError) {
            console.error('Error asignando permiso:', permError);
            // Opcional: Mostrar alerta pero no interrumpir el flujo principal
            alerts.basicAlert(
              'Advertencia',
              'Se creó la sucursal pero hubo un problema asignando los permisos.',
              'warning'
            );
          }
        }
      }

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.masterNotSavedChanges = false;
      this.newlyAddedMasterRows = [];

      if (allResponses.length > 0) {
        await this.obtenerDatos();
      }
      this.signalsService.triggerUpdateBranchList(); // Actualizamos la sidebar
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  async deleteBranch() {
    const selectedNodes = this.masterGridApi.getSelectedNodes();
    const selectedData = selectedNodes[0].data;
    if (selectedNodes.length === 0) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Por favor, seleccione una entrada para eliminar.',
        'error'
      );
      return;
    }

    alerts
      .confirmAlert(
        'Eliminar Sucursal',
        'Está seguro de que desea eliminar esta sucursal?',
        'warning',
        'Sí, Eliminar'
      )
      .then((result) => {
        if (result.isConfirmed) {
          selectedData.active = 0;
          this.branchesService
            .deleteBranch(selectedData.id)
            .pipe(
              catchError((error) => {
                alerts.basicAlert(
                  'Eliminar sucursal',
                  error.error.message,
                  'error'
                );
                console.error('este es el error:', error.error);
                return EMPTY;
              })
            )
            .subscribe(() => {
              alerts.basicAlert(
                'Eliminar sucursal',
                'La sucursal ha sido eliminada correctamente.',
                'success'
              );
              this.signalsService.triggerUpdateBranchList();
              this.obtenerDatos(); // Refrescar los datos después de eliminar
              this.masterNotSavedChanges = false;
              this.masterSelectedRowData = null;
            });
        }
      });
  }

  revertMasterData() {
    this.obtenerDatos();
    this.masterNotSavedChanges = false;
  }

  // ==================== UTILITY METHODS ====================

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  // ==================== GUARD ALERT UNSAVED CHANGES ====================

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.masterNotSavedChanges);
  }

  initForm() {
    this.addBranch = new FormGroup({
      id: new FormControl(),
      idCompany: new FormControl(this.idRoot, [Validators.required]),
      idEstado: new FormControl('', [Validators.required]),
      name: new FormControl('', [Validators.required]),
      description: new FormControl('', [Validators.required]),
      address: new FormControl('', [Validators.required]),
      orden: new FormControl(0),
      vigente: new FormControl(true)
    });
  }
}