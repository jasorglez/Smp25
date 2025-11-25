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
              class="btn btn-sm btn-primary me-2" 
              (click)="saveBanks()"
              [disabled]="!hasBankChanges"
              >
              <i class="bi bi-floppy"></i> Guardar
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
        // Guardar ID de la fila modificada para restaurar focus
        const modifiedRowId = params.data.id;
        const modifiedRowName = params.data.campo2;
        const modifiedRowNumber = params.data.campo4;

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

          // Ordenar localmente por vigente y principal
          this.bankRowData.sort((a, b) => {
            if (a.vigente !== b.vigente) return b.vigente ? 1 : -1;
            if (a.principal !== b.principal) return b.principal ? 1 : -1;
            return (a.id || 0) - (b.id || 0);
          });

          // Refrescar grid con datos ordenados
          this.bankGridApi?.setGridOption('rowData', this.bankRowData);

          // Restaurar focus a la fila modificada
          await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
          if (this.bankGridApi) {
            let rowToSelect = this.bankRowData.find(r => r.id === modifiedRowId);
            if (!rowToSelect) {
              rowToSelect = this.bankRowData.find(r => r.campo2 === modifiedRowName && r.campo4 === modifiedRowNumber);
            }
            if (rowToSelect) {
              const rowIndex = this.bankRowData.indexOf(rowToSelect);
              const rowNode = this.bankGridApi.getDisplayedRowAtIndex(rowIndex);
              if (rowNode) {
                rowNode.setSelected(true);
                this.bankGridApi.ensureIndexVisible(rowIndex, 'middle');
              }
            }
          }
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

        // Guardar ID de la fila modificada para restaurar focus
        const modifiedRowId = params.data.id;
        const modifiedRowName = params.data.campo2;
        const modifiedRowNumber = params.data.campo4;

        // Si se intenta marcar como principal pero no está vigente, revertir
        if (params.newValue === true && params.data.vigente === false) {
          console.log('❌ Revirtiendo: No se puede marcar como principal si no está vigente');
          params.data.principal = false;

          // Ordenar y restaurar focus
          this.bankRowData.sort((a, b) => {
            if (a.vigente !== b.vigente) return b.vigente ? 1 : -1;
            if (a.principal !== b.principal) return b.principal ? 1 : -1;
            return (a.id || 0) - (b.id || 0);
          });
          this.bankGridApi?.setGridOption('rowData', this.bankRowData);

          await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
          if (this.bankGridApi) {
            let rowToSelect = this.bankRowData.find(r => r.id === modifiedRowId);
            if (!rowToSelect) {
              rowToSelect = this.bankRowData.find(r => r.campo2 === modifiedRowName && r.campo4 === modifiedRowNumber);
            }
            if (rowToSelect) {
              const rowIndex = this.bankRowData.indexOf(rowToSelect);
              const rowNode = this.bankGridApi.getDisplayedRowAtIndex(rowIndex);
              if (rowNode) {
                rowNode.setSelected(true);
                this.bankGridApi.ensureIndexVisible(rowIndex, 'middle');
              }
            }
          }
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

            // Ordenar y restaurar focus
            this.bankRowData.sort((a, b) => {
              if (a.vigente !== b.vigente) return b.vigente ? 1 : -1;
              if (a.principal !== b.principal) return b.principal ? 1 : -1;
              return (a.id || 0) - (b.id || 0);
            });
            this.bankGridApi?.setGridOption('rowData', this.bankRowData);

            await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
            if (this.bankGridApi) {
              let rowToSelect = this.bankRowData.find(r => r.id === modifiedRowId);
              if (!rowToSelect) {
                rowToSelect = this.bankRowData.find(r => r.campo2 === modifiedRowName && r.campo4 === modifiedRowNumber);
              }
              if (rowToSelect) {
                const rowIndex = this.bankRowData.indexOf(rowToSelect);
                const rowNode = this.bankGridApi.getDisplayedRowAtIndex(rowIndex);
                if (rowNode) {
                  rowNode.setSelected(true);
                  this.bankGridApi.ensureIndexVisible(rowIndex, 'middle');
                }
              }
            }
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

          // Ordenar localmente por vigente y principal
          this.bankRowData.sort((a, b) => {
            if (a.vigente !== b.vigente) return b.vigente ? 1 : -1;
            if (a.principal !== b.principal) return b.principal ? 1 : -1;
            return (a.id || 0) - (b.id || 0);
          });

          // Refrescar grid para mostrar los cambios
          this.bankGridApi?.setGridOption('rowData', this.bankRowData);

          // Restaurar focus a la fila modificada
          await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
          if (this.bankGridApi) {
            let rowToSelect = this.bankRowData.find(r => r.id === modifiedRowId);
            if (!rowToSelect) {
              rowToSelect = this.bankRowData.find(r => r.campo2 === modifiedRowName && r.campo4 === modifiedRowNumber);
            }
            if (rowToSelect) {
              const rowIndex = this.bankRowData.indexOf(rowToSelect);
              const rowNode = this.bankGridApi.getDisplayedRowAtIndex(rowIndex);
              if (rowNode) {
                rowNode.setSelected(true);
                this.bankGridApi.ensureIndexVisible(rowIndex, 'middle');
              }
            }
          }
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
  }

  loadBankData(onComplete?: () => void) {
    if (this.params && this.params.context.BANK && this.params.context.BANK.load) {
      this.params.context.BANK.load(this.providerId, 'BANK', (data: any) => {
        this.bankRowData = data;
        console.log(data);

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
      try {
        // Guardar la fila seleccionada actual para restaurarla después
        const selectedRow = this.selectedBank;
        const selectedBankId = selectedRow?.id;
        const selectedBankName = selectedRow?.campo2; // Nombre titular como respaldo
        const selectedBankNumber = selectedRow?.campo4; // Numero cuenta como respaldo

        // Guardar los bancos (ESPERA a que el usuario cierre el alert)
        await this.params.context.BANK.save(this.providerId, this.bankRowData, 'BANK');

        this.hasBankChanges = false;

        // Limpiar los flags de las filas guardadas SIN recargar desde el servidor
        this.bankRowData.forEach(row => {
          delete row.__isNew;
          delete row.__modified;
        });

        // Ordenar localmente por vigente (activos primero) y principal (principal primero)
        this.bankRowData.sort((a, b) => {
          // Primero por vigente (activos primero)
          if (a.vigente !== b.vigente) {
            return b.vigente ? 1 : -1; // true antes que false
          }
          // Luego por principal (principal primero)
          if (a.principal !== b.principal) {
            return b.principal ? 1 : -1; // true antes que false
          }
          // Finalmente por ID para mantener consistencia
          return (a.id || 0) - (b.id || 0);
        });

        // Actualizar el grid con los datos ordenados
        this.bankGridApi?.setGridOption('rowData', this.bankRowData);

        // PRIMERO restaurar el focus ANTES de actualizar el grid padre
        // Esperar solo un ciclo de renderizado para asegurar que los cambios se reflejen
        await new Promise(resolve => requestAnimationFrame(() => resolve(null)));

        if (this.bankGridApi && selectedRow) {
          let rowToSelect = null;

          console.log('🔍 Buscando fila para restaurar (sin reload)...', {
            selectedBankId,
            selectedBankName,
            selectedBankNumber,
            totalRows: this.bankRowData.length
          });

          // Intentar encontrar por ID original (si no era temporal)
          if (selectedBankId && !String(selectedBankId).startsWith('temp_')) {
            rowToSelect = this.bankRowData.find(r => r.id === selectedBankId);
            console.log('Búsqueda por ID:', rowToSelect ? '✅ Encontrado' : '❌ No encontrado');
          }

          // Si no se encontró, buscar por nombre titular y número de cuenta
          if (!rowToSelect && selectedBankName) {
            rowToSelect = this.bankRowData.find(r =>
              r.campo2 === selectedBankName &&
              r.campo4 === selectedBankNumber
            );
            console.log('Búsqueda por nombre/número:', rowToSelect ? '✅ Encontrado' : '❌ No encontrado');
          }

          // Si se encontró la fila, seleccionarla y hacer scroll
          if (rowToSelect) {
            const rowIndex = this.bankRowData.indexOf(rowToSelect);
            console.log('📍 Índice de la fila:', rowIndex);

            const rowNode = this.bankGridApi.getDisplayedRowAtIndex(rowIndex);
            if (rowNode) {
              rowNode.setSelected(true);
              this.bankGridApi.ensureIndexVisible(rowIndex, 'middle');
              console.log('✅ Fila restaurada después de guardar (sin reload):', rowToSelect);
            } else {
              console.error('❌ No se pudo obtener el rowNode en el índice:', rowIndex);
            }
          } else {
            console.error('❌ No se encontró la fila para restaurar');
          }
        }

        // AHORA actualizar contador en grid padre (esto puede destruir el detail grid, pero ya restauramos el focus)
        await this.updateBankCountInParent();

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

      // Actualizar el contador en la fila del grid padre (temporal, en memoria)
      this.params.data.fieldBank = activeBankCount;
      this.params.data.principalBankName = principalBankName;

      // NO usar refreshCells porque destruye el detail grid
      // En su lugar, solo actualizar los datos - el grid padre se actualizará automáticamente
      console.log('✅ Contador de bancos actualizado en grid padre:', this.params.data.fieldBank);
      console.log('✅ Banco principal guardado:', this.params.data.principalBankName);

    } catch (error) {
      console.error('❌ Error al actualizar contador de bancos:', error);
    }
  }

}