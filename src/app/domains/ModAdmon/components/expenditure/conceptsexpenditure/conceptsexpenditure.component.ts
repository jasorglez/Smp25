import { CommonModule } from '@angular/common';
import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, CellValueChangedEvent, RowSelectedEvent, SelectionChangedEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { AdministrationService } from 'app/services/administration.service';
import { CustomersService } from 'app/services/customers.service';
import { EmployeesService } from 'app/services/employees.service';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { SignalsService } from 'app/services/signals.service';
import { CuentasContablesService } from 'app/services/cuentas-contables.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { lastValueFrom, concat, toArray, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TrackingService } from 'app/services/tracking.service';

interface IGenericEntity { id: number; name: string; [key: string]: any; }

@Component({
  selector: 'app-conceptsexpenditure',
  standalone: true,
  imports: [AgGridModule, CommonModule, FormsModule],
  templateUrl: './conceptsexpenditure.component.html',
  styleUrl: './conceptsexpenditure.component.scss'
})
export class ConceptsexpenditureComponent {
  
    // ... (código constructor y de carga sin cambios)
    private services = {
      employees: inject(EmployeesService),
      providers: inject(CustomersService),
      incomesAndExpenses: inject(IncomesAndExpensesService),
      signals:         inject(SignalsService),
      administration:  inject(AdministrationService),
      trackingService: inject(TrackingService),
      cuentasContables: inject(CuentasContablesService),

      route: inject(ActivatedRoute),

    };
  
    public rowData: any[] = [];
    public notSavedChanges: boolean = false;
    public idIncExp: number | null = null;
    public components = { multiLineEditorComponent: MultiLineEditorComponent };
  
    private idRoot: number;
    private gridApi!: GridApi;
    private tempIdCounter = 0;
    private employees = signal<IGenericEntity[]>([]);
    private providers = signal<IGenericEntity[]>([]);
    private cuentasContables = signal<IGenericEntity[]>([]);
  
    public ivaPercent = signal(0);
    public subtotal = signal(0);
    public iva2 = signal(0);
    public total = signal(0);
    public selectedData: any = null;
  
   // 1. ✅ CORRECCIÓN: Mejorar la gestión de signals y datos
  constructor() {
    
    effect(() => {
      const newRootId = this.services.signals.getRootSelectedBySidebar()();
      if (newRootId && newRootId !== this.idRoot) {
        this.idRoot = newRootId;
        this.loadCatalogsAndThenGridData(this.idRoot);
      }
    });
  
    effect(() => {
      const newIdIncExp = this.services.signals.getIdIncomeAndExpense()();
      if (newIdIncExp !== this.idIncExp) {
        this.idIncExp = newIdIncExp;
        // ✅ CORRECCIÓN: Verificar que los catálogos estén cargados antes de cargar datos
        if (this.idRoot && (this.employees().length > 0 || this.providers().length > 0 || this.cuentasContables().length > 0)) {
          this.loadGridData(this.idIncExp);
        }
      }
    });
    
  }
  
    ngOnInit() {
      // La lógica principal ahora está en los effects.
    }
  
  // 2. ✅ CORRECCIÓN: Mejorar la carga de catálogos con mejor manejo de errores
  private loadCatalogsAndThenGridData(idRoot: number) {
    if (!idRoot) return;
  
    const sources = {
      employees: this.services.employees.getEmployees(-idRoot).pipe(
        catchError((error) => {
          console.error('Error cargando empleados:', error);
          return of([]);
        })
      ),
      providers: this.services.providers.getCustomersByCompany(idRoot, 'PROVIDERS').pipe(
        catchError((error) => {
          console.error('Error cargando proveedores:', error);
          return of([]);
        })
      ),
      cuentasContables: this.services.cuentasContables.getHojas(idRoot).pipe(
        catchError((error) => {
          console.error('Error cargando cuentas contables:', error);
          return of([]);
        })
      ),
      billingInfo: this.services.administration.getBillingManagementInfo(idRoot).pipe(
        catchError((error) => {
          console.error('Error cargando billing info:', error);
          return of([{ iIva: 16 }]);
        })
      )
    };
  
    forkJoin(sources).subscribe({
      next: ({ employees, providers, cuentasContables, billingInfo }) => {

        // ✅ CORRECCIÓN: Asegurar que los datos sean arrays válidos
        this.employees.set(Array.isArray(employees) ? employees : []);
        this.providers.set(Array.isArray(providers) ? providers : []);
        this.cuentasContables.set(Array.isArray(cuentasContables) ? cuentasContables : []);
        this.ivaPercent.set(billingInfo?.[0]?.iIva ?? 16);
        
        // ✅ CORRECCIÓN: Forzar actualización del grid después de cargar catálogos
        setTimeout(() => {
          if (this.gridApi) {
            this.gridApi.refreshCells({ force: true });
          }
          this.loadGridData(this.idIncExp);
        }, 100);
      },
      error: (error) => {
        console.error('Error en forkJoin:', error);
        // Asegurar que los signals tengan valores por defecto
        this.employees.set([]);
        this.providers.set([]);
        this.cuentasContables.set([]);
        this.ivaPercent.set(16);
      }
    });
  }
  
  
  // 6. ✅ CORRECCIÓN: Mejorar loadGridData para manejar el campo selectedEntity
  private loadGridData(idIncExp: number | null) {
    
    if (!idIncExp) {
      this.rowData = [];
      this.calculateTotals();
      return;
    }
  
    this.services.incomesAndExpenses.getConceptsFromIncomesAndExpenses(idIncExp).subscribe({
      next: (data: any[]) => {
        
        const transformedData = (data || []).map(item => {
          const type = item.typeExpense?.trim().toUpperCase();

          // ✅ CORRECCIÓN: Configurar selectedEntity para mostrar en el combo
          let selectedEntity = null;
          if (type === 'EMPLEADOS' && item.idExpense) {
            const employee = this.employees().find(e => e.id === item.idExpense);
            selectedEntity = employee?.name || null;
          } else if (type === 'PROVEEDORES' && item.idExpense) {
            const provider = this.providers().find(p => p.id === item.idExpense);
            selectedEntity = provider?.name || null;
          } else if (type === 'OTROS' && item.idExpense) {
            const cuenta = this.cuentasContables().find(c => c.id === item.idExpense);
            selectedEntity = cuenta ? `${cuenta['codigo']} - ${cuenta['nombre']}` : null;
          }

          return {
            ...item,
            typeExpense: type,
            idEmployee: type === 'EMPLEADOS' ? item.idExpense : null,
            idProvider: type === 'PROVEEDORES' ? item.idExpense : null,
            idCuentaContable: type === 'OTROS' ? item.idExpense : null,
            selectedEntity: selectedEntity
          };
        });
  
        this.rowData = transformedData;
        this.calculateTotals();
        this.notSavedChanges = false;
        this.selectedData = null;
        
      },
      error: (error) => {
        console.error('❌ Error cargando datos del grid:', error);
        this.rowData = [];
        this.calculateTotals();
      }
    });
  }
  
  
  // ✅ CORRECCIÓN ADICIONAL: Agregar al gridOptions para mejor manejo de tipos
  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    getRowId: (p: any) => p.data.id.toString(),
    stopEditingWhenCellsLoseFocus: true,
    // ✅ CORRECCIÓN: Configuración específica para tipos de datos
    columnTypes: {
      dateColumn: {
        cellDataType: 'date',
        cellEditor: 'agDateCellEditor',
        filterParams: {
          comparator: (filterLocalDateAtMidnight: Date, cellValue: string) => {
            const cellDate = new Date(cellValue);
            if (cellDate < filterLocalDateAtMidnight) return -1;
            if (cellDate > filterLocalDateAtMidnight) return 1;
            return 0;
          }
        }
      }
    },
    onCellValueChanged: (params: CellValueChangedEvent) => this.onGridCellValueChanged(params),
  };
  
    onGridReady(params: GridReadyEvent) {
      this.gridApi = params.api;
    }
  
    
  // 3. ✅ CORRECCIÓN: Simplificar columnas con UN SOLO COMBO dinámico
  get colMaster(): ColDef[] {
    return [
      {
        field: 'dateExpend',
        headerName: 'Fecha',
        editable: true,
        flex: 3,
        cellDataType: 'date',
        cellEditor: 'agDateCellEditor',
        cellEditorParams: {
          min: '2020-01-01',
          max: '2030-12-31',
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
          
          let date: Date;
          if (params.value instanceof Date) {
            date = params.value;
          } else if (typeof params.value === 'string') {
            date = new Date(params.value);
          } else {
            return '';
          }
          
          if (isNaN(date.getTime())) return '';
          
          return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
          });
        },
        valueSetter: (params) => {
          if (!params.newValue) {
            params.data.dateExpend = null;
            return true;
          }
          
          let date: Date;
          if (params.newValue instanceof Date) {
            date = params.newValue;
          } else {
            date = new Date(params.newValue);
          }
          
          if (isNaN(date.getTime())) {
            params.data.dateExpend = new Date();
          } else {
            params.data.dateExpend = date;
          }
          
          return true;
        }
      },
  
      {
        field: 'typeExpense', 
        headerName: 'Tipo Gasto', 
        editable: true, 
        flex: 4,
        cellEditor: 'agSelectCellEditor', 
        cellEditorParams: { values: ['EMPLEADOS', 'PROVEEDORES', 'OTROS'] },
        valueFormatter: (params) => {
          const value = params.value;
          if (value === 'EMPLEADOS') return 'Empleados';
          if (value === 'PROVEEDORES') return 'Proveedores';
          if (value === 'OTROS') return 'Otros';
          return value;
        }
      },
  
      // ✅ CORRECCIÓN: UN SOLO COMBO que cambia dinámicamente
      {
            headerName: 'Empleado/Proveedor/Cuenta3',
            field: 'selectedEntity',
            width: 250,
            editable: params => params.data.typeExpense,
            cellClass: params => params.data.typeExpense === 'OTROS' ? 'cell-disabled' : '',
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: (params) => {
              if (!params.data) return { values: [] };

              const type = params.data.typeExpense;
              if (type === 'EMPLEADOS') {
                return {
                  values: this.employees().map(e => e.name),
                  formatValue: (value) => value || ''
                };
              } else if (type === 'PROVEEDORES') {
                return {
                  values: this.providers().map(p => p.name),
                  formatValue: (value) => value || ''
                };
              } else if (type === 'OTROS') {
                return {
                  values: this.cuentasContables().map(c => `${c['codigo']} - ${c['nombre']}`),
                  formatValue: (value) => value || ''
                };
              }
              return { values: [] };
            },
            valueSetter: (params) => {
              if (!params.data) return false;

              const type = params.data.typeExpense;
              if (type === 'EMPLEADOS') {
                const employee = this.employees().find(e => e.name === params.newValue);
                if (employee) {
                  params.data.idEmployee = employee.id;
                  params.data.idProvider = null;
                  params.data.idCuentaContable = null;
                  params.data.selectedEntity = params.newValue;
                  return true;
                }
              } else if (type === 'PROVEEDORES') {
                const provider = this.providers().find(p => p.name === params.newValue);
                if (provider) {
                  params.data.idProvider = provider.id;
                  params.data.idEmployee = null;
                  params.data.idCuentaContable = null;
                  params.data.selectedEntity = params.newValue;
                  return true;
                }
              } else if (type === 'OTROS') {
                const cuenta = this.cuentasContables().find(c => `${c['codigo']} - ${c['nombre']}` === params.newValue);
                if (cuenta) {
                  params.data.idCuentaContable = cuenta.id;
                  params.data.idEmployee = null;
                  params.data.idProvider = null;
                  params.data.selectedEntity = params.newValue;
                  return true;
                }
              }
              return false;
            },
            valueFormatter: (params) => {
                  // ✅ Añadir protección contra null
                  if (!params || !params.data) return '';

                  const type = params.data.typeExpense;
                  if (!type) return '';

                  if (type === 'EMPLEADOS' && params.data.idEmployee) {
                    const employee = this.employees().find(e => e.id === params.data.idEmployee);
                    return employee ? employee.name : '';
                  } else if (type === 'PROVEEDORES' && params.data.idProvider) {
                    const provider = this.providers().find(p => p.id === params.data.idProvider);
                    return provider ? provider.name : '';
                  } else if (type === 'OTROS' && params.data.idCuentaContable) {
                    const cuenta = this.cuentasContables().find(c => c.id === params.data.idCuentaContable);
                    return cuenta ? `${cuenta['codigo']} - ${cuenta['nombre']}` : '';
                  }
                  return '';
            }
       },
  
      { field: 'description', headerName: 'Concepto Adicional', editable: true, flex: 4 },
      { 
        field: 'price', 
        headerName: 'Precio', 
        type: 'number', 
        editable: true, 
        flex: 3, 
        valueFormatter: p => p.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) 
      },
      { 
        field: 'total', 
        headerName: 'Subtotal', 
        editable: false, 
        flex: 3, 
        valueFormatter: p => p.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) 
      },
      { 
        field: 'iva', 
        headerName: '¿IVA?', 
        editable: true, 
        flex: 2, 
        cellRenderer: 'agCheckboxCellRenderer' 
      },
      { 
        field: 'comment', 
        headerName: 'Comentario', 
        editable: true, 
        flex: 4, 
        cellEditor: 'multiLineEditorComponent' 
      }
    ];
  }
  
     
  // 4. ✅ CORRECCIÓN: Mejorar el manejo de cambios de celda
  onGridCellValueChanged(params: CellValueChangedEvent) {
    const colId = params.colDef.field;
    const data = params.data;
  
    // Marcar como modificado
    data.__modified = true;
    this.notSavedChanges = true;
  
    if (colId === 'typeExpense') {
      // Lógica existente para cambio de tipo
      data.idEmployee = null;
      data.idProvider = null;
      data.idCuentaContable = null;
      data.selectedEntity = null;

      this.gridApi.refreshCells({
        rowNodes: [params.node],
        force: true,
        columns: ['selectedEntity']
      });
    }
    
    // ✅ Añadir esto para actualizar cálculos cuando cambia precio o IVA
    if (colId === 'price' || colId === 'iva' || colId === 'quantity') {
      this.updateRowTotals(data);
      this.calculateTotals();
    }
  }
  
  
  // ✅ Nuevo método para actualizar totales por fila
  private updateRowTotals(data: any) {
    if (!data) return;
  
    // Calcular subtotal (precio * cantidad, con cantidad default 1)
    const quantity = data.quantity || 1;
    const price = data.price || 0;
    data.total = quantity * price;
    
    // Calcular IVA si aplica
    data.iva2 = data.iva ? data.total * (this.ivaPercent() / 100) : 0;
    
    // Marcar que los totales cambiaron
    data.__totalsChanged = true;
    
    // Actualizar la fila en el grid
    if (this.gridApi) {
      this.gridApi.applyTransaction({ update: [data] });
    }
  }
  
    
    onSelectionChanged(event: SelectionChangedEvent) {
      this.selectedData = event.api.getSelectedNodes()[0]?.data ?? null;
    }
  
    onSelectedRow(event: RowSelectedEvent) {
      // Puede estar vacío.
    }
  
   calculateTotals() {
    let subtotal = 0;
    let iva = 0;
    
    if (this.gridApi) {
      this.gridApi.forEachNode(node => {
        subtotal += node.data.total || 0;
        iva += node.data.iva2 || 0;
      });
    }
  
    // Actualizar los signals
    this.subtotal.set(subtotal);
    this.iva2.set(iva);
    this.total.set(subtotal + iva);
  
    // ✅ Disparar actualización del maestro SI hay un ID asociado
    if (this.idIncExp) {
      const updateData = {
        id: this.idIncExp,
        subtotal: subtotal,
        tax: iva,
        total: subtotal + iva
      };
      
      // Usar setTimeout para asegurar la actualización
      setTimeout(() => {
        this.services.signals.triggerMasterUpdate(updateData);
      }, 100);
    }
  }
  
  
  // 5. ✅ CORRECCIÓN: Mejorar el método saveChanges con mejor debugging
  async saveChanges() {
      
    this.services.trackingService.addLog(
          this.services.trackingService.getnameComp(), 
          `Salvar Egresos`, 
          'Detalle Egresos ',
          this.services.trackingService.getEmail() );
              
    
    const newRows: any[] = [];
    const modifiedRowsMap = new Map<number, any>();
    let totalsNeedRecalculation = false;
  
    this.gridApi.forEachNode(node => {
      if (node.data.__isNew) {
        newRows.push(node.data);
        totalsNeedRecalculation = true;
      }
      else if (node.data.__modified) {
        modifiedRowsMap.set(node.data.id, node.data);
        
        if (node.data.__totalsChanged) {
          totalsNeedRecalculation = true;
        }
      }
    });
  
    const modifiedRows = Array.from(modifiedRowsMap.values());
  
    if (newRows.length === 0 && modifiedRows.length === 0) {
      alerts.basicAlert('Sin cambios', 'No hay cambios nuevos para guardar.', 'info');
      return;
    }
  
    try {
      const cleanAndAdapt = (row: any) => {
        const dataToSend = this.cleanDataForServer(row);
        dataToSend.idExpense = row.idEmployee || row.idProvider || row.idCuentaContable || null;
        delete dataToSend.idEmployee;
        delete dataToSend.idProvider;
        delete dataToSend.idCuentaContable;
        delete dataToSend.selectedEntity; // ✅ CORRECCIÓN: Eliminar campo auxiliar
        return dataToSend;
      };
  
      const addObs = newRows.map(r => this.services.incomesAndExpenses.addConceptFromIncomesAndExpenses(cleanAndAdapt(r)));
      const updateObs = modifiedRows.map(r => this.services.incomesAndExpenses.updateConceptFromIncomesAndExpenses(r.id, cleanAndAdapt(r)));
      
      await lastValueFrom(concat(...addObs, ...updateObs).pipe(toArray()));
  
      // ✅ CORRECCIÓN: Siempre actualizar totales si hay cambios
      if (totalsNeedRecalculation && this.idIncExp) {
        
        const totalsPayload = {
          subtotal: this.subtotal(),
          tax: this.iva2(),
          total: this.total(),
          modifiedBy: 'UsuarioLogueado'
        };
        
        
        await lastValueFrom(this.services.incomesAndExpenses.updateTotal(this.idIncExp, totalsPayload));
        
        // ✅ CORRECCIÓN: Mejorar el trigger del signal
        const updateData = {
          id: this.idIncExp,
          subtotal: this.subtotal(),
          tax: this.iva2(),
          total: this.total()
        };
        
        
        // ✅ CORRECCIÓN: Usar setTimeout para asegurar que el signal se procese
        setTimeout(() => {
          this.services.signals.triggerMasterUpdate(updateData);
        }, 100);
        
      } else {
      }
  
      alerts.basicAlert('Datos actualizados', 'Se han guardado los cambios correctamente.', 'success');
      
      // ✅ CORRECCIÓN: Recargar datos después de guardar
      setTimeout(() => {
        this.loadGridData(this.idIncExp!);
      }, 200);
  
    } catch (error) {
      console.error('❌ Error en saveChanges:', error);
      alerts.basicAlert('Error', 'Ocurrió un error al guardar los datos.', 'error');
    }
  }
  
  
  
  
    addRow() {
      
          this.services.trackingService.addLog(this.services.trackingService.getnameComp(), 
          `Agregar Egresos`, 
          'Detalles Egresos ',
          this.services.trackingService.getEmail() );
      
          if (!this.idIncExp) {
        alerts.basicAlert('Añadir concepto', 'Debe seleccionar un registro de gasto.', 'warning');
        return;
      }
      const newItem = {
        id: `temp_${this.tempIdCounter++}`,
        idIncorExp: this.idIncExp,
        dateExpend: new Date(),
        typeExpense: 'EMPLEADOS',
        idEmployee: null,
        idProvider: null,
        description: 'NINGUNO',
        price: 0,
        quantity: 1,
        unit: 'GASTOS',
        total: 0,
        iva: false,
        iva2: 0,
        comment: '',
        active: true,
        __isNew: true
      };
      this.gridApi.applyTransaction({ add: [newItem], addIndex: 0 });
      this.notSavedChanges = true;
   setTimeout(() => {
      const node = this.gridApi.getRowNode(newItem.id.toString());
      if (node) {
        this.gridApi.ensureNodeVisible(node);
        // Empezar editando el tipo de gasto primero
        this.gridApi.startEditingCell({ 
          rowIndex: node.rowIndex!, 
          colKey: 'typeExpense' 
        });
      }
    }, 100);
    }
  
    deleteEntry() {
      //... (sin cambios)
          if (!this.selectedData) {
        alerts.basicAlert('Eliminar entrada', 'Por favor, seleccione una entrada para eliminar.', 'error');
        return;
      }
      const { id, __isNew } = this.selectedData;
      alerts.confirmAlert('Confirmar eliminación', '¿Está seguro?', 'warning', 'Sí, eliminar').then(result => {
        if (result.isConfirmed) {
          if (__isNew) {
            this.gridApi.applyTransactionAsync({ remove: [this.selectedData] });
            this.calculateTotals();
          }
          else {
            this.services.incomesAndExpenses.deleteConceptFromIncomesAndExpenses(id).subscribe({
              next: () => {
                alerts.basicAlert('Eliminada', 'La entrada ha sido eliminada.', 'success');
                if (this.idIncExp) this.loadGridData(this.idIncExp);
              }, error: (err) => { alerts.basicAlert('Error', 'No se pudo eliminar la entrada.', 'error'); console.error(err); }
            });
          }
        }
      });
    }
  
    revert() {
      //... (sin cambios)
      if (this.idIncExp) this.loadGridData(this.idIncExp);
    }
  
    private cleanDataForServer(data: any): any {
      //... (sin cambios)
          const cleanedData = { ...data };
      delete cleanedData.__isNew;
      delete cleanedData.__modified;
      delete cleanedData.__totalsChanged;
      delete cleanedData.idExpense; 
      if (data.id?.toString().startsWith('temp_')) delete cleanedData.id;
      return cleanedData;
    }
  
    
  }



