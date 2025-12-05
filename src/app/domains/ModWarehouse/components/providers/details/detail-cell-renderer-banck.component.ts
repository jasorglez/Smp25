import { Component ,inject} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { AuthService } from 'app/services/auth.service';
import { AdministrationService } from 'app/services/administration.service';
import { SelectWithTooltipEditorV2Component } from 'app/domains/Almacenes/components/materiales-maestro/editors/select-with-tooltip-editor-v2.component';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';

@Component({
  selector: 'app-detail-cell-renderer-banck',
  standalone: true,
  imports: [AgGridModule, CommonModule, SelectWithTooltipEditorV2Component],
  template: `
    <div 
      style="padding: 10px; background-color: #f8f9fa; height: 100%; display: flex; flex-direction: column;">
      <!-- Grid de Banckos -->
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Bancos de: {{ providerName }}</strong>
          <div>
            <button 
              class="btn btn-sm btn-success me-2" 
              (click)="addBank()"
              [disabled]="!bankGridApi"
              >
              <i class="bi bi-plus-circle"></i> Agregar
            </button>
            <button
              class="btn btn-sm btn-primary me-2 position-relative"
              (click)="saveBanks()"
              [disabled]="!hasBankChanges"
              >
              <i class="bi bi-floppy"></i> Guardar
              <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
                    *ngIf="hasBankChanges">
                <span class="visually-hidden">Hay cambios sin guardar</span>
              </span>
            </button>
            <button 
              class="btn btn-sm btn-warning me-2" 
              (click)="refresBanks()"
              >
              <i class="bi bi-arrow-clockwise"></i> Deshacer
            </button>
            <button 
              class="btn btn-sm btn-danger" 
              (click)="deleteSelectedBank()"
              [disabled]="!selectedBank"
              >
              <i class="bi bi-trash"></i> Borrar
            </button>
          </div>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="bankColumnDefs"
          [rowData]="bankRowData"
          [gridOptions]="bankGridOptions"
          (gridReady)="onBankGridReady($event)"
          (cellValueChanged)="onBankCellValueChanged($event)"
          [components]="components">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererComponentBanck implements ICellRendererAngularComp {
  private administrationService = inject(AdministrationService);
  params: any;
  providerId: number;
  providerName: string;
  authService = inject(AuthService);

  bankRowData: any[] = [];
  hasBankChanges: boolean = false;
  bankGridApi: any;
  selectedBank: any = null;
  banks: any[] = [];

  // ✅ NUEVO: Rastrear la última fila editada/modificada
  private lastEditedRowId: string | null = null;
  private lastEditedRowName: string | null = null;
  private lastEditedRowNumber: string | null = null;
  
  bankGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single',
    getRowStyle: (params: any) => {
      // Si la fila es el banco principal, aplicar fondo rojo claro
      if (params.data.principal === true) {
        return { background: '#ffcccc' };
      }
      return undefined;
    },
    onFirstDataRendered: (params) => {
      console.log('onFirstDataRendered - autosizing columns...');

      // Obtener todas las columnas
      const allColumnIds: string[] = [];
      params.api.getColumns()?.forEach((column: any) => {
        allColumnIds.push(column.getId());
      });

      console.log('Columns to autosize:', allColumnIds);

      // Autoajustar todas las columnas al contenido (skipHeader=false incluye header en el cálculo)
      params.api.autoSizeColumns(allColumnIds, false);

      console.log('Autosize completed');

      // ✅ Verificar si hay un ID pendiente de selección en el context
      const pendingId = this.params?.context?.pendingBankSelection?.[this.providerId];
      console.log('🔍 Verificando pendingBankSelection en context:', pendingId);
      console.log('   Provider ID:', this.providerId);

      if (pendingId !== null && pendingId !== undefined) {
        console.log('🎯 Ejecutando selección pendiente para ID:', pendingId);

        setTimeout(() => {
          let foundAndSelected = false;

          params.api.forEachNode((node: any, index: number) => {
            if (Number(node.data.id) === Number(pendingId)) {
              console.log('✅ Encontrado nodo con ID', pendingId, 'en índice:', index);
              node.setSelected(true);
              params.api.ensureIndexVisible(index, 'middle');
              foundAndSelected = true;
              console.log('✅ Fila seleccionada y centrada en viewport');
            }
          });

          if (!foundAndSelected) {
            console.error('❌ No se encontró el nodo en el grid');
            console.error('   Buscando ID:', pendingId);
            console.error('   IDs disponibles:', this.bankRowData.map(r => r.id));
          }

          // Limpiar el ID pendiente del context
          if (this.params?.context?.pendingBankSelection) {
            delete this.params.context.pendingBankSelection[this.providerId];
            console.log('🧹 ID pendiente limpiado del context');
          }
        }, 100);
      }
    }
  };

  components = {
    autocompleteEditor: AutocompleteEditorComponent,
    selectWithTooltipEditor: SelectWithTooltipEditorV2Component
  };

  bankColumnDefs = [
    {
      field: 'vigente',
      headerName: 'Activo',
      cellRenderer: 'agCheckboxCellRenderer',
      cellEditor: 'agCheckboxCellEditor',
      editable: true,
      width: 66,
      onCellValueChanged: async (params: any) => {
        // ✅ Rastrear la última fila editada (checkbox vigente)
        this.lastEditedRowId = params.data.id;
        this.lastEditedRowName = params.data.campo2;
        this.lastEditedRowNumber = params.data.campo4;

        // Si se desmarca como vigente, también desmarcar como principal
        if (params.newValue === false && params.data.principal === true) {
          params.data.principal = false;
          params.data.campo7 = false; // Sincronizar con backend
          // Buscar y marcar otro como principal si es necesario
          const activeRows = this.bankRowData.filter(row => row.vigente && row.id !== params.data.id);
          if (activeRows.length > 0) {
            activeRows[0].principal = true;
            activeRows[0].campo7 = true;
            activeRows[0].__modified = true;
          }

          // ✅ NO ordenar durante la edición - solo refrescar celdas
          this.bankGridApi?.refreshCells({
            force: true
          });
        }

        // Si se marca como vigente, refrescar las celdas para que 'principal' sea editable
        if (params.newValue === true) {
          // Refrescar las celdas de esta fila para actualizar el estado editable
          this.bankGridApi?.refreshCells({
            rowNodes: [params.node],
            columns: ['principal'],
            force: true
          });
        }

        // Marcar como modificado
        params.data.__modified = true;
        this.hasBankChanges = true;
      }
    },
    {
      field: 'campo2',
      headerName: 'Nombre Titular',
      editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true
        },
      width: 190,
      valueSetter: (params: any) => {
        // Solo permitir letras, espacios y caracteres especiales (NO números)
        const sanitizedValue = params.newValue ? params.newValue.replace(/[0-9]/g, '') : '';
        params.data.campo2 = sanitizedValue.toUpperCase();
        return true;
      }
    },
   // ...existing code...
{
  field: 'campo3',
  headerName: 'Banco',
  width: 200,
  cellDataType: false, // Desactivar auto-detección de tipo
  editable: (params: any) => true,
  cellEditor: 'selectWithTooltipEditor',
  cellEditorParams: (params: any) => {
    return {
      options: (this.banks || [])
        .filter(b => b.active)
        .map(b => ({ id: b.id, description: b.name }))
    };
  },

  valueFormatter: (params: any) => {
    // Preferir el nombre guardado en la fila si existe
    if (params?.data?.nombreBanco) return params.data.nombreBanco;
    const bank = this.banks?.find(b => String(b.id) === String(params.value) || b.name === params.value);
    return bank ? bank.name : (params.value ?? '');
  },

  valueSetter: (params: any) => {
    let newValue = params.newValue;

    // Si el editor devuelve un objeto con distintas formas, extraer id/valor y descripción
    if (newValue && typeof newValue === 'object') {
      // cubrir casos comunes: { id, description }, { value, description }, { value }
      const possibleId = newValue.id ?? newValue.value ?? newValue.code ?? null;
      const possibleDesc = newValue.description ?? newValue.label ?? newValue.text ?? null;
      newValue = possibleId ?? possibleDesc ?? newValue;
      // si ahora newValue es object sin id/desc, dejamos como está y se tratará abajo
      if (possibleId || possibleDesc) {
        // reemplazar newValue por id si existe, si no por la descripción
        newValue = possibleId ?? possibleDesc;
      }
    }

    // Buscar banco por id o por nombre
    const selectedBank = this.banks?.find(b => String(b.id) === String(newValue) || b.name === newValue);

    // Guardar siempre campo3 como STRING (el servidor C# espera string)
    // y nombre legible en nombreBanco
    params.data.campo3 = selectedBank ? String(selectedBank.id) : String(newValue);
    params.data.nombreBanco = selectedBank ? selectedBank.name : (typeof newValue === 'string' ? newValue : '');

    return true;
  },

  cellStyle: (params: any) => {
    if (!params.value && !params?.data?.nombreBanco) {
      return { backgroundColor: '#f9f9f9', color: '#777' };
    }
    return null;
  },
  suppressMovable: true,
  filter: true,
  filterParams: {
    defaultToNothingSelected: true
  }
},
// ...existing code...
    {
      field: 'campo4',
      headerName: 'Numero Cuenta',
      editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true
        },
      width: 190,
      valueSetter: (params: any) => {
        // Solo permitir números
        const sanitizedValue = params.newValue ? params.newValue.replace(/[^0-9]/g, '') : '';
        params.data.campo4 = sanitizedValue;
        return true;
      }
    },
    
    {
      field: 'campo5',
      headerName: 'Clabe',
      editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true
        },
      width: 190,
      valueSetter: (params: any) => {
        // Solo permitir números para CLABE
        const sanitizedValue = params.newValue ? params.newValue.replace(/[^0-9]/g, '') : '';
        params.data.campo5 = sanitizedValue;
        return true;
      }
    },
    
    {
      field: 'campo6',
      headerName: 'Comentario',
      editable: true,
      width: 250,
      valueSetter: (params: any) => {
        params.data.campo6 = params.newValue ? params.newValue.toUpperCase() : '';
        return true;
      }
    },

    {
      field: 'principal',
      headerName: 'Principal',
      cellRenderer: 'agCheckboxCellRenderer',
      cellEditor: 'agCheckboxCellEditor',
      editable: (params: any) => {
        // Solo editable si la fila está activa (vigente)
        return params.data.vigente === true;
      },
      width: 66,
      onCellValueChanged: async (params: any) => {
        console.log('🔔 Principal checkbox changed:', {
          id: params.data.id,
          campo2: params.data.campo2,
          oldValue: params.oldValue,
          newValue: params.newValue,
          vigente: params.data.vigente
        });

        // ✅ Rastrear la última fila editada (checkbox principal)
        this.lastEditedRowId = params.data.id;
        this.lastEditedRowName = params.data.campo2;
        this.lastEditedRowNumber = params.data.campo4;

        // Si se intenta marcar como principal pero no está vigente, revertir
        if (params.newValue === true && params.data.vigente === false) {
          console.log('❌ Revirtiendo: No se puede marcar como principal si no está vigente');
          params.data.principal = false;

          // ✅ NO ordenar durante la edición - solo refrescar
          this.bankGridApi?.refreshCells({
            force: true
          });

          return;
        }

        // Si se intenta desmarcar como principal
        if (params.newValue === false) {
          // Contar cuántos activos hay
          const activeRows = this.bankRowData.filter(row => row.vigente === true);
          const principalRows = activeRows.filter(row => row.principal === true && row.id !== params.data.id);

          console.log('📊 Al desmarcar:', { activeRows: activeRows.length, otherPrincipals: principalRows.length });

          // Si no hay ningún otro principal activo, forzar a mantener este como principal
          if (principalRows.length === 0 && activeRows.length > 0) {
            console.log('⚠️ Forzando a mantener como principal (es el único)');
            params.data.principal = true;

            // ✅ NO ordenar durante la edición - solo refrescar
            this.bankGridApi?.refreshCells({
              force: true
            });

            return;
          }
        }

        // Si se marca como principal, desmarcar todos los demás PRIMERO
        if (params.newValue === true) {
          console.log('✅ Marcando como principal, desmarcando los demás...');
          console.log('📋 Estado ANTES de cambios:');
          this.bankRowData.forEach(r => {
            console.log(`  ID ${r.id} (${r.campo2}): principal=${r.principal}, campo7=${r.campo7}, __modified=${r.__modified}`);
          });

          // Buscar en el array original y desmarcar todos
          this.bankRowData.forEach(row => {
            if (row.id !== params.data.id) {
              if (row.principal === true || row.campo7 === true) {
                console.log(`  ❌ Desmarcando ID ${row.id} (${row.campo2})`);
                row.principal = false;
                row.campo7 = false; // Sincronizar campo7 (backend)
                if (!row.__isNew) {
                  row.__modified = true; // Marcar como modificado para que se guarde
                }
              }
            }
          });

          // Asegurar que este está marcado como principal
          const currentRow = this.bankRowData.find(r => r.id === params.data.id);
          if (currentRow) {
            currentRow.principal = true;
            currentRow.campo7 = true; // Sincronizar campo7 (backend)
            if (!currentRow.__isNew) {
              currentRow.__modified = true;
            }
            console.log(`  ✅ Marcado ID ${currentRow.id} (${currentRow.campo2})`);
          }

          console.log('📋 Estado DESPUÉS de cambios:');
          this.bankRowData.forEach(r => {
            console.log(`  ID ${r.id} (${r.campo2}): principal=${r.principal}, campo7=${r.campo7}, __modified=${r.__modified}`);
          });

          // ✅ NO ordenar durante la edición - solo refrescar todas las celdas
          this.bankGridApi?.refreshCells({
            force: true
          });

          // ✅ Forzar redibujado de todas las filas para actualizar getRowStyle (color de fondo)
          this.bankGridApi?.redrawRows();
        }

        // Marcar como modificado
        params.data.__modified = true;
        this.hasBankChanges = true;
      }
    },
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.providerId = params.data.id;
    this.providerName = params.data.company || params.data.nameContact;

    // Cargar primero el catálogo de bancos, LUEGO cargar los datos
    this.getBanks(() => {
      this.loadBankData();
    });
  }

  refresh(): boolean {
    return false;
  }

  onBankGridReady(params: any) {
    this.bankGridApi = params.api;
    
    params.api.addEventListener('selectionChanged', () => {
      const selectedNodes = params.api.getSelectedNodes();
      this.selectedBank = selectedNodes.length > 0 ? selectedNodes[0].data : null;
    });
  }

  onBankCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasBankChanges = true;

    // ✅ NUEVO: Rastrear la última fila editada para restaurar focus después de guardar
    this.lastEditedRowId = event.data.id;
    this.lastEditedRowName = event.data.campo2;
    this.lastEditedRowNumber = event.data.campo4;

    console.log('📝 Última fila editada:', {
      id: this.lastEditedRowId,
      nombre: this.lastEditedRowName,
      numero: this.lastEditedRowNumber
    });
  }

  loadBankData(onComplete?: () => void) {
    if (this.params && this.params.context.BANK && this.params.context.BANK.load) {
      this.params.context.BANK.load(this.providerId, 'BANK', (data: any) => {
        this.bankRowData = data;
        console.log('📥 Datos de bancos recibidos:', data);

        // ✅ Mapear nombreBanco para cada registro basado en el catálogo de bancos
        this.bankRowData.forEach(row => {
          if (row.campo3) {
            const bank = this.banks?.find(b => String(b.id) === String(row.campo3));
            if (bank) {
              row.nombreBanco = bank.name;
              console.log(`  Banco mapeado: ID ${row.campo3} → ${bank.name}`);
            } else {
              console.warn(`  ⚠️ No se encontró banco con ID ${row.campo3}`);
            }
          }
        });

        // ✅ Ordenar solo por vigente (solo al cargar desde servidor)
        this.bankRowData.sort((a, b) => {
          if (a.vigente !== b.vigente) return b.vigente ? 1 : -1;
          return (a.id || 0) - (b.id || 0);
        });

        // Refrescar el grid si ya existe
        if (this.bankGridApi) {
          this.bankGridApi.setGridOption('rowData', this.bankRowData);
        }

        // Ejecutar callback si existe
        if (onComplete) {
          setTimeout(() => onComplete(), 100);
        }
      });
    }
  }

  refresBanks(){
    this.loadBankData();
  }

  getBanks(callback?: () => void) {
    this.administrationService.get2fieldsBanks().subscribe(
      (data: any) => {
        // Normalizar la estructura recibida para evitar mismatch de propiedades
        const normalized = (data || []).map((b: any) => ({
          id: b.id ?? b.idBank ?? b.ID ?? b.value ?? '',
          name: b.name ?? b.nombre ?? b.descripcion ?? b.text ?? String(b.id ?? b.idBank ?? ''),
          active: (b.active ?? b.vigente ?? true) // trata distintos nombres posibles
        }));
        this.banks = [{ id: '', name: 'EFECTIVO', active: true }, ...normalized];
        console.log('🏦 Bancos cargados:', this.banks.length);

        // Llamar al callback si existe
        if (callback) {
          callback();
        }
      },
      (error) => {
        if (error.status == 404) this.banks = [{ id: '', name: 'EFECTIVO', active: true }];
        console.error('Error fetching data:', error);

        // Llamar al callback incluso si hay error (para que el grid se muestre)
        if (callback) {
          callback();
        }
      }
    );
  }

  addBank() {
    // Verificar si es el primer banco (tabla vacía)
    const isFirstBank = this.bankRowData.length === 0;

    const newBank = {
      id: `temp_bank_${Date.now()}`,
      idTabla: this.providerId,
      type: 'BANK',
      vigente: true,
      principal: isFirstBank, // Si es el primero, marcar como principal
      campo7: isFirstBank, // Sincronizar con principal (para backend)
      __isNew: true
    };
    this.bankRowData = [newBank, ...this.bankRowData];
    this.hasBankChanges = true;

    if (isFirstBank) {
      console.log('✅ Primer banco marcado automáticamente como principal');
    }

    setTimeout(() => {
      this.bankGridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'campo2'
      });
    }, 100);
  }

  async saveBanks() {
    if (this.params && this.params.context.BANK && this.params.context.BANK.save) {
      console.log('💾 ANTES DE GUARDAR - Estado de todos los bancos:');
      this.bankRowData.forEach(r => {
        console.log(`  ID ${r.id} (${r.campo2}): principal=${r.principal}, campo7=${r.campo7}, __modified=${r.__modified}, __isNew=${r.__isNew}`);
      });

      try {
        // ✅ USAR la última fila editada en lugar de la seleccionada
        const targetBankId = this.lastEditedRowId || this.selectedBank?.id;
        const targetBankName = this.lastEditedRowName || this.selectedBank?.campo2;
        const targetBankNumber = this.lastEditedRowNumber || this.selectedBank?.campo4;

        console.log('💾 Guardando con foco en:', {
          id: targetBankId,
          nombre: targetBankName,
          numero: targetBankNumber,
          source: this.lastEditedRowId ? 'última editada' : 'seleccionada'
        });

        // Guardar los bancos (ESPERA a que el usuario cierre el alert)
        await this.params.context.BANK.save(this.providerId, this.bankRowData, 'BANK');

        console.log('✅ Guardado completado (incluyendo alert cerrado por usuario)');

        this.hasBankChanges = false;

        // ⏰ Esperar un poco para asegurar que la BD se actualice
        await new Promise(resolve => setTimeout(resolve, 300));

        // ✅ RECARGAR datos desde el servidor para obtener los IDs reales
        await new Promise<void>((resolve) => {
          this.loadBankData(() => {
            console.log('✅ Datos recargados desde servidor');
            resolve();
          });
        });

        // ⏰ Esperar para asegurar que el grid se renderice
        await new Promise(resolve => setTimeout(resolve, 300));

        console.log('🔍 Determinando ID final a seleccionar...');
        console.log('   targetBankId original:', targetBankId);
        console.log('   Total filas en bankRowData:', this.bankRowData.length);

        // ✅ DETERMINAR el ID final a seleccionar
        let finalIdToSelect: number;

        if (String(targetBankId).startsWith('temp_')) {
          // Si era un ID temporal (registro nuevo), buscar el ID MAYOR (más reciente)
          finalIdToSelect = Math.max(...this.bankRowData.map(r => Number(r.id)));
          console.log('🆕 Era registro nuevo (ID temporal), seleccionando ID mayor:', finalIdToSelect);
        } else {
          // Si era un ID real (registro editado), usar ese ID
          finalIdToSelect = Number(targetBankId);
          console.log('✏️ Era registro editado, seleccionando ID:', finalIdToSelect);
        }

        // ✅ GUARDAR el ID pendiente en el CONTEXT del grid padre
        // IMPORTANTE: Guardamos en context porque updateBankCountInParent() puede destruir este componente
        // al hacer refreshCells(), y todas las variables de instancia se pierden
        if (!this.params.context.pendingBankSelection) {
          this.params.context.pendingBankSelection = {};
          console.log('🆕 Creando objeto pendingBankSelection en context');
        }
        this.params.context.pendingBankSelection[this.providerId] = finalIdToSelect;
        console.log('📌 ID guardado en context para selección pendiente:', finalIdToSelect);
        console.log('   Provider ID:', this.providerId);
        console.log('   Context completo:', this.params.context.pendingBankSelection);

        // AHORA actualizar contador en grid padre
        // Este método puede destruir y recrear este componente, pero el ID está a salvo en context
        await this.updateBankCountInParent();

        console.log('🔍 Después de updateBankCountInParent - verificando context...');
        console.log('   pendingBankSelection:', this.params.context.pendingBankSelection);

        // ✅ SELECCIONAR la fila manualmente si el grid todavía existe
        if (this.bankGridApi) {
          console.log('🎯 Seleccionando fila manualmente con ID:', finalIdToSelect);

          setTimeout(() => {
            let foundAndSelected = false;

            this.bankGridApi.forEachNode((node: any, index: number) => {
              if (Number(node.data.id) === Number(finalIdToSelect)) {
                console.log('✅ Encontrado nodo con ID', finalIdToSelect, 'en índice:', index);
                node.setSelected(true);
                this.bankGridApi.ensureIndexVisible(index, 'middle');
                foundAndSelected = true;
                console.log('✅ Fila seleccionada y centrada en viewport');
              }
            });

            if (!foundAndSelected) {
              console.error('❌ No se encontró el nodo en el grid');
              console.error('   Buscando ID:', finalIdToSelect);
              console.error('   IDs disponibles:', this.bankRowData.map(r => r.id));
            }
          }, 200);
        } else {
          console.log('⚠️ bankGridApi no disponible - usando pendingBankSelection para onFirstDataRendered');
        }

        // ✅ Limpiar el rastreador de última fila editada
        this.lastEditedRowId = null;
        this.lastEditedRowName = null;
        this.lastEditedRowNumber = null;

      } catch (error) {
        console.error('❌ Error al guardar bancos:', error);
      }
    }
  }

  deleteSelectedBank() {
    if (!this.selectedBank) {
      return;
    }

    if (this.params && this.params.context.BANK && this.params.context.BANK.delete) {
      this.params.context.BANK.delete(
        { data: this.selectedBank, api: this.bankGridApi },
        async () => {
          this.loadBankData();
          this.selectedBank = null;
          // Actualizar contador después de eliminar
          await this.updateBankCountInParent();
        }
      );
    }
  }

  // Actualizar el contador de bancos en la fila del grid padre
  // NOTA: Esta función actualiza temporalmente el contador en memoria.
  // El valor persistente viene del backend (vista SQL proveedoresxtype).
  private async updateBankCountInParent(): Promise<void> {
    try {
      console.log('🔢 Actualizando contador de bancos en grid padre...');

      // Esperar un poco para que los datos se actualicen
      await new Promise(resolve => setTimeout(resolve, 300));

      // Contar solo los bancos activos (vigente = true)
      const activeBanks = this.bankRowData.filter(bank => bank.vigente === true);
      const activeBankCount = activeBanks.length;

      // Encontrar el banco principal entre los activos
      const principalBank = activeBanks.find(bank => bank.principal === true);

      // Buscar el nombre del banco en el catálogo de bancos
      let principalBankName = '';
      if (principalBank) {
        const bankId = principalBank.campo3; // El ID del banco está en campo3
        const bank = this.banks?.find(b => String(b.id) === String(bankId));
        principalBankName = bank?.name || principalBank.nombreBanco || '';
      }

      console.log('📊 Total de bancos activos:', activeBankCount);
      console.log('🏦 Banco principal:', principalBankName);

      // ✅ Si NO hay bancos activos, limpiar el nombre del banco principal
      if (activeBankCount === 0) {
        console.log('⚠️ No hay bancos activos - limpiando principalBankName');
        principalBankName = '';
      }

      // Actualizar el contador en la fila del grid padre (temporal, en memoria)
      this.params.data.fieldBank = activeBankCount;
      this.params.data.principalBankName = principalBankName;

      // ✅ ACTUALIZAR visualmente el grid padre usando refreshCells
      await this.updatePrincipalBankInParent(principalBankName);

      console.log('✅ Contador de bancos actualizado en grid padre:', this.params.data.fieldBank);
      console.log('✅ Banco principal guardado:', this.params.data.principalBankName);

    } catch (error) {
      console.error('❌ Error al actualizar contador de bancos:', error);
    }
  }

  // ✅ NUEVO: Actualizar el banco principal en la columna fieldBank del grid padre
  private async updatePrincipalBankInParent(principalBankName?: string): Promise<void> {
    try {
      console.log('🏦 Actualizando banco principal en ProvidersComponent...');

      // Si no se proporciona el nombre, buscarlo
      if (principalBankName === undefined) {
        const principalBank = this.bankRowData.find(row => row.principal === true);
        if (principalBank) {
          const bank = this.banks?.find(b => String(b.id) === String(principalBank.campo3));
          principalBankName = bank?.name || principalBank.nombreBanco || '';
        } else {
          principalBankName = '';
        }
      }

      console.log('📝 Actualizando con banco principal:', principalBankName || '(vacío)');

      // Actualizar los datos locales del nodo padre (incluso si es vacío)
      this.params.data.principalBankName = principalBankName || '';

      // ✅ Refrescar el grid padre para mostrar los cambios (sin destruir el detalle)
      if (this.params.api) {
        this.params.api.refreshCells({
          rowNodes: [this.params.node],
          columns: ['fieldBank'],
          force: true
        });
        console.log('✅ Celda fieldBank refrescada en grid padre');
      }

    } catch (error) {
      console.error('❌ Error al actualizar banco principal en grid padre:', error);
    }
  }

}