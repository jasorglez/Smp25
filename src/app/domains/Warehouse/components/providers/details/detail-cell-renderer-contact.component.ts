import { Component ,inject} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { AuthService } from 'app/services/auth.service';
import { CustomersService } from 'app/services/customers.service';
import { CommonModule } from '@angular/common';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-detail-cell-renderer-contact',
  standalone: true,
  imports: [AgGridModule, CommonModule],
  template: `<!-- MEJORA: Añadir listeners para evitar que el panel se cierre al pasar el mouse sobre él -->
    <div 
      style="padding: 10px; background-color: #e9ecef; height: 100%; display: flex; flex-direction: column;"
      (mouseenter)="params.onMouseEnter && params.onMouseEnter()"
      (mouseleave)="params.onMouseLeave && params.onMouseLeave()">
      <!-- Grid de Contactos -->
     <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Contactos de: {{ providerName }}</strong>
          <div>
            <button 
              class="btn btn-sm btn-success me-2" 
              (click)="addContact()"
              [disabled]="!contactGridApi"
             >
              <i class="bi bi-person-plus"></i> Agregar
            </button>
            <button 
              class="btn btn-sm btn-primary me-2" 
              (click)="saveContacts()"
              [disabled]="!hasContactChanges"
              >
              <i class="bi bi-floppy"></i> Guardar
            </button>
            <button 
              class="btn btn-sm btn-warning me-2" 
              (click)="refresContacts()"
              >
              <i class="bi bi-arrow-clockwise"></i>  Deshacer
            </button>
            <button 
              class="btn btn-sm btn-danger" 
              (click)="deleteSelectedContact()"
              [disabled]="!selectedContact" 
              >
              <i class="bi bi-trash"></i> Borrar
            </button>
          </div>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="contactColumnDefs"
          [rowData]="contactRowData"
          [gridOptions]="contactGridOptions"
          (gridReady)="onContactGridReady($event)"
          (cellValueChanged)="onContactCellValueChanged($event)"
          [components]="components">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererComponentContact implements ICellRendererAngularComp {
   private customersService = inject(CustomersService);
   authService = inject(AuthService);

  params: any;
  providerId: number;
  providerName: string;
  
  // Contact grid properties
  contactRowData: any[] = [];
  hasContactChanges: boolean = false;
  name: string = '';
  contactGridApi: any;
  selectedContact: any = null;
  
  contactGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single',
    getRowStyle: (params: any) => {
      // Si la fila es principal (principal=true), aplicar fondo rojo claro
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

  contactColumnDefs = [
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

        // Si se desmarca como vigente, también desmarcar como principal
        if (params.newValue === false && params.data.principal === true) {
          params.data.principal = false;
          // Buscar y marcar otro como principal si es necesario
          const activeRows = this.contactRowData.filter(row => row.vigente && row.id !== params.data.id);
          if (activeRows.length > 0) {
            activeRows[0].principal = true;
          }

          // Ordenar localmente por vigente y principal
          this.contactRowData.sort((a, b) => {
            if (a.vigente !== b.vigente) return b.vigente ? 1 : -1;
            if (a.principal !== b.principal) return b.principal ? 1 : -1;
            return (a.id || 0) - (b.id || 0);
          });

          // Refrescar grid con datos ordenados
          this.contactGridApi?.setGridOption('rowData', this.contactRowData);

          // Restaurar focus a la fila modificada
          await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
          if (this.contactGridApi) {
            let rowToSelect = this.contactRowData.find(r => r.id === modifiedRowId);
            if (!rowToSelect) {
              rowToSelect = this.contactRowData.find(r => r.campo2 === modifiedRowName);
            }
            if (rowToSelect) {
              const rowIndex = this.contactRowData.indexOf(rowToSelect);
              const rowNode = this.contactGridApi.getDisplayedRowAtIndex(rowIndex);
              if (rowNode) {
                rowNode.setSelected(true);
                this.contactGridApi.ensureIndexVisible(rowIndex, 'middle');
              }
            }
          }
        }

        // Si se marca como vigente, refrescar las celdas para que 'principal' sea editable
        if (params.newValue === true) {
          // Refrescar las celdas de esta fila para actualizar el estado editable
          this.contactGridApi?.refreshCells({
            rowNodes: [params.node],
            columns: ['principal'],
            force: true
          });
        }

        // Marcar como modificado
        params.data.__modified = true;
        this.hasContactChanges = true;
      }
    },
    {
      field: 'campo2',
      headerName: 'Nombre Contacto',
      editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true
        },
      width: 150,
      flex: 1,
      valueSetter: (params: any) => {
        params.data.campo2 = params.newValue ? params.newValue.toUpperCase() : '';
        params.data.__modified = true;
        this.hasContactChanges = true;
        return true;
      }
    },
    {
      field: 'campo3',
      headerName: 'Puesto/Area',
      editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true
        },
      width: 120,
      flex: 1,
      valueSetter: (params: any) => {
        params.data.campo3 = params.newValue ? params.newValue.toUpperCase() : '';
        params.data.__modified = true;
        this.hasContactChanges = true;
        return true;
      }
    },
    {
      field: 'campo4',
      headerName: 'Teléfono',
      editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true
        },
      width: 100,
      valueSetter: (params) => {
        const rawValue = params.newValue;
        if (!rawValue || typeof rawValue !== 'string') {
          alerts.basicAlert('Campo requerido', 'El teléfono es obligatorio', 'error');
          return false;
        }

        const normalizedValue = rawValue.trim();

        // Validar formato internacional mexicano: +52 XXX XXX XXXX
        const phoneRegex = /^\+52\s\d{3}\s\d{3}\s\d{4}$/;
        if (!phoneRegex.test(normalizedValue)) {
          alerts.basicAlert(
            'Formato inválido',
            'El teléfono debe tener el formato internacional: +52 XXX XXX XXXX (ejemplo: +52 229 206 3214)',
            'error'
          );
          return false;
        }

        params.data[params.colDef.field] = normalizedValue;
        return true;
      },
    },
    {
      field: 'campo5',
      headerName: 'Email',
      editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true
        },
      width: 140,
      flex: 1,
      valueSetter: (params: any) => {
        const newValue = params.newValue ? params.newValue.trim() : '';

        // Si el campo está vacío, permitirlo
        if (newValue === '') {
          params.data.campo5 = '';
          params.data.__modified = true;
          this.hasContactChanges = true;
          return true;
        }

        // Validar formato de email
        const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

        if (emailRegex.test(newValue)) {
          params.data.campo5 = newValue.toLowerCase();
          params.data.__modified = true;
          this.hasContactChanges = true;
          return true;
        } else {
          // Si el email no es válido, mostrar alerta y no guardar el cambio
          alerts.basicAlert(
            'Email Inválido',
            'Por favor ingrese un correo electrónico válido (ejemplo: usuario@dominio.com)',
            'warning'
          );
          // Mantener el valor anterior
          return false;
        }
      }
    },
    {
      field: 'campo6',
      headerName: 'Comentarios',
      editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true
        },
      width: 140,
      valueSetter: (params: any) => {
        params.data.campo6 = params.newValue ? params.newValue.toUpperCase() : '';
        params.data.__modified = true;
        this.hasContactChanges = true;
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

        // Si se intenta marcar como principal pero no está vigente, revertir
        if (params.newValue === true && params.data.vigente === false) {
          console.log('❌ Revirtiendo: No se puede marcar como principal si no está vigente');
          params.data.principal = false;

          // Ordenar y restaurar focus
          this.contactRowData.sort((a, b) => {
            if (a.vigente !== b.vigente) return b.vigente ? 1 : -1;
            if (a.principal !== b.principal) return b.principal ? 1 : -1;
            return (a.id || 0) - (b.id || 0);
          });
          this.contactGridApi?.setGridOption('rowData', this.contactRowData);

          await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
          if (this.contactGridApi) {
            let rowToSelect = this.contactRowData.find(r => r.id === modifiedRowId);
            if (!rowToSelect) {
              rowToSelect = this.contactRowData.find(r => r.campo2 === modifiedRowName);
            }
            if (rowToSelect) {
              const rowIndex = this.contactRowData.indexOf(rowToSelect);
              const rowNode = this.contactGridApi.getDisplayedRowAtIndex(rowIndex);
              if (rowNode) {
                rowNode.setSelected(true);
                this.contactGridApi.ensureIndexVisible(rowIndex, 'middle');
              }
            }
          }
          return;
        }

        // Si se intenta desmarcar como principal
        if (params.newValue === false) {
          // Contar cuántos activos hay
          const activeRows = this.contactRowData.filter(row => row.vigente === true);
          const principalRows = activeRows.filter(row => row.principal === true && row.id !== params.data.id);

          console.log('📊 Al desmarcar:', { activeRows: activeRows.length, otherPrincipals: principalRows.length });

          // Si no hay ningún otro principal activo, forzar a mantener este como principal
          if (principalRows.length === 0 && activeRows.length > 0) {
            console.log('⚠️ Forzando a mantener como principal (es el único)');
            params.data.principal = true;

            // Ordenar y restaurar focus
            this.contactRowData.sort((a, b) => {
              if (a.vigente !== b.vigente) return b.vigente ? 1 : -1;
              if (a.principal !== b.principal) return b.principal ? 1 : -1;
              return (a.id || 0) - (b.id || 0);
            });
            this.contactGridApi?.setGridOption('rowData', this.contactRowData);

            await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
            if (this.contactGridApi) {
              let rowToSelect = this.contactRowData.find(r => r.id === modifiedRowId);
              if (!rowToSelect) {
                rowToSelect = this.contactRowData.find(r => r.campo2 === modifiedRowName);
              }
              if (rowToSelect) {
                const rowIndex = this.contactRowData.indexOf(rowToSelect);
                const rowNode = this.contactGridApi.getDisplayedRowAtIndex(rowIndex);
                if (rowNode) {
                  rowNode.setSelected(true);
                  this.contactGridApi.ensureIndexVisible(rowIndex, 'middle');
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
          this.contactRowData.forEach(r => {
            console.log(`  ID ${r.id} (${r.campo2}): principal=${r.principal}, campo7=${r.campo7}, __modified=${r.__modified}`);
          });

          // Buscar en el array original y desmarcar todos
          this.contactRowData.forEach(row => {
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
          const currentRow = this.contactRowData.find(r => r.id === params.data.id);
          if (currentRow) {
            currentRow.principal = true;
            currentRow.campo7 = true; // Sincronizar campo7 (backend)
            if (!currentRow.__isNew) {
              currentRow.__modified = true;
            }
            console.log(`  ✅ Marcado ID ${currentRow.id} (${currentRow.campo2})`);
          }

          console.log('📋 Estado DESPUÉS de cambios:');
          this.contactRowData.forEach(r => {
            console.log(`  ID ${r.id} (${r.campo2}): principal=${r.principal}, campo7=${r.campo7}, __modified=${r.__modified}`);
          });

          // Ordenar localmente por vigente y principal
          this.contactRowData.sort((a, b) => {
            if (a.vigente !== b.vigente) return b.vigente ? 1 : -1;
            if (a.principal !== b.principal) return b.principal ? 1 : -1;
            return (a.id || 0) - (b.id || 0);
          });

          // Refrescar grid para mostrar los cambios
          this.contactGridApi?.setGridOption('rowData', this.contactRowData);

          // Restaurar focus a la fila modificada
          await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
          if (this.contactGridApi) {
            let rowToSelect = this.contactRowData.find(r => r.id === modifiedRowId);
            if (!rowToSelect) {
              rowToSelect = this.contactRowData.find(r => r.campo2 === modifiedRowName);
            }
            if (rowToSelect) {
              const rowIndex = this.contactRowData.indexOf(rowToSelect);
              const rowNode = this.contactGridApi.getDisplayedRowAtIndex(rowIndex);
              if (rowNode) {
                rowNode.setSelected(true);
                this.contactGridApi.ensureIndexVisible(rowIndex, 'middle');
              }
            }
          }
        }

        // Marcar como modificado
        params.data.__modified = true;
        this.hasContactChanges = true;
      }
    },
  ];

  components = {};

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.providerId = params.data.id;
    this.providerName = params.data.company || params.data.nameContact;
    this.name = params.data.nameContact;

    
    // Cargar datos del grid de contactos
    this.loadContactData();
  }

  refresh(): boolean {
    return false;
  }

  // ========== CONTACT GRID METHODS ==========
  onContactGridReady(params: any) {
    this.contactGridApi = params.api;
    params.api.sizeColumnsToFit();
    
    params.api.addEventListener('selectionChanged', () => {
      const selectedNodes = params.api.getSelectedNodes();
      this.selectedContact = selectedNodes.length > 0 ? selectedNodes[0].data : null;
    });
  }

  onContactCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasContactChanges = true;
  }

  loadContactData(onComplete?: () => void) {
    if (this.params && this.params.context && this.params.context.CONTACT && this.params.context.CONTACT.load) {
      this.params.context.CONTACT.load(this.providerId, 'CONTACT', (data: any) => {
        console.log('📥 DATOS RECIBIDOS DEL SERVIDOR:');
        data.forEach((r: any) => {
          console.log(`  ID ${r.id} (${r.campo2}): campo7=${r.campo7}, principal=${r.principal}`);
        });

        this.contactRowData = data;

        // Asegurar que siempre haya un único registro principal
        console.log('🔧 Ejecutando ensureSinglePrincipal...');
        this.ensureSinglePrincipal();

        console.log('✅ DESPUÉS de ensureSinglePrincipal:');
        this.contactRowData.forEach(r => {
          console.log(`  ID ${r.id} (${r.campo2}): principal=${r.principal}, campo7=${r.campo7}`);
        });

        // Refrescar el grid si ya existe
        if (this.contactGridApi) {
          this.contactGridApi.setGridOption('rowData', this.contactRowData);
        }

        // Ejecutar callback si existe
        if (onComplete) {
          setTimeout(() => onComplete(), 100);
        }
      });
    }
  }

  // Asegurar que siempre haya un único registro principal (solo entre activos)
  private ensureSinglePrincipal(): void {
    if (this.contactRowData.length === 0) {
      return;
    }

    // Filtrar solo registros activos (vigente = true)
    const activeRows = this.contactRowData.filter(row => row.vigente === true);

    if (activeRows.length === 0) {
      // Si no hay registros activos, no hacer nada
      return;
    }

    // Si solo hay un registro activo, marcarlo como principal
    if (activeRows.length === 1) {
      activeRows[0].principal = true;
      activeRows[0].campo7 = true; // Sincronizar con backend
      // Asegurar que los inactivos no sean principales
      this.contactRowData.forEach(row => {
        if (row.vigente === false) {
          row.principal = false;
          row.campo7 = false; // Sincronizar con backend
        }
      });
      return;
    }

    // Si hay múltiples registros activos, verificar que solo haya uno marcado como principal
    const principalRows = activeRows.filter(row => row.principal === true);

    // Si no hay ninguno marcado como principal, marcar el primer activo
    if (principalRows.length === 0) {
      activeRows[0].principal = true;
      activeRows[0].campo7 = true; // Sincronizar con backend
    }
    // Si hay más de uno marcado, dejar solo el primero marcado
    else if (principalRows.length > 1) {
      let firstFound = false;
      activeRows.forEach(row => {
        if (row.principal === true) {
          if (!firstFound) {
            firstFound = true;
            row.campo7 = true; // Sincronizar con backend
          } else {
            row.principal = false;
            row.campo7 = false; // Sincronizar con backend
          }
        }
      });
    }

    // Asegurar que ningún registro inactivo esté marcado como principal
    this.contactRowData.forEach(row => {
      if (row.vigente === false && row.principal === true) {
        row.principal = false;
        row.campo7 = false; // Sincronizar con backend
      }
    });
  }

  refresContacts(){
    this.loadContactData();
  }
  

  addContact() {
    if (!this.contactGridApi) {
      console.error('Contact grid API not ready');
      return;
    }

    const tempId = `temp_contact_${Date.now()}`;
    const newContact = {
      id: tempId,
      idTabla: this.providerId,
      campo1: 0,
      campo2: '',
      campo3: '',
      campo4: '',
      campo5: '',
      campo6: 'NA',
      campo7: true,
      type: 'CONTACT',
      active: true,
      vigente: true,
      principal: false,
      __isNew: true
    };

    this.contactRowData = [newContact, ...this.contactRowData];
    this.hasContactChanges = true;

    // Si es el único registro, marcarlo como principal
    this.ensureSinglePrincipal();

    // Refrescar el grid
    if (this.contactGridApi) {
      this.contactGridApi.setGridOption('rowData', this.contactRowData);
    }

    setTimeout(() => {
      this.contactGridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'campo2'
      });
    }, 100);
  }

  async saveContacts() {
    if (this.params && this.params.context && this.params.context.CONTACT && this.params.context.CONTACT.save) {
      console.log('💾 ANTES DE GUARDAR - Estado de todos los contactos:');
      this.contactRowData.forEach(r => {
        console.log(`  ID ${r.id} (${r.campo2}): principal=${r.principal}, campo7=${r.campo7}, __modified=${r.__modified}, __isNew=${r.__isNew}`);
      });

      try {
        // Guardar la fila seleccionada actual para restaurarla después
        const selectedRow = this.selectedContact;
        const selectedContactId = selectedRow?.id;
        const selectedContactName = selectedRow?.campo2; // Nombre contacto como respaldo
        const selectedContactPhone = selectedRow?.campo4; // Teléfono como respaldo

        // Guardar (ESPERA a que el usuario cierre el alert)
        await this.params.context.CONTACT.save(this.providerId, this.contactRowData, 'CONTACT');

        console.log('✅ Guardado completado (incluyendo alert cerrado por usuario)');

        this.hasContactChanges = false;

        // Limpiar los flags de las filas guardadas SIN recargar desde el servidor
        this.contactRowData.forEach(row => {
          delete row.__isNew;
          delete row.__modified;
        });

        // PRIMERO restaurar el focus ANTES de actualizar el grid padre
        // Esperar solo un ciclo de renderizado para asegurar que los cambios se reflejen
        await new Promise(resolve => requestAnimationFrame(() => resolve(null)));

        if (this.contactGridApi && selectedRow) {
          let rowToSelect = null;

          console.log('🔍 Buscando contacto para restaurar (sin reload)...', {
            selectedContactId,
            selectedContactName,
            selectedContactPhone,
            totalRows: this.contactRowData.length
          });

          // Intentar encontrar por ID original (si no era temporal)
          if (selectedContactId && !String(selectedContactId).startsWith('temp_')) {
            rowToSelect = this.contactRowData.find(r => r.id === selectedContactId);
            console.log('Búsqueda por ID:', rowToSelect ? '✅ Encontrado' : '❌ No encontrado');
          }

          // Si no se encontró, buscar por nombre y teléfono
          if (!rowToSelect && selectedContactName) {
            rowToSelect = this.contactRowData.find(r =>
              r.campo2 === selectedContactName &&
              r.campo4 === selectedContactPhone
            );
            console.log('Búsqueda por nombre/teléfono:', rowToSelect ? '✅ Encontrado' : '❌ No encontrado');
          }

          // Si se encontró la fila, seleccionarla y hacer scroll
          if (rowToSelect) {
            const rowIndex = this.contactRowData.indexOf(rowToSelect);
            console.log('📍 Índice de la fila:', rowIndex);

            const rowNode = this.contactGridApi.getDisplayedRowAtIndex(rowIndex);
            if (rowNode) {
              rowNode.setSelected(true);
              this.contactGridApi.ensureIndexVisible(rowIndex, 'middle');
              console.log('✅ Fila restaurada después de guardar (sin reload):', rowToSelect);
            } else {
              console.error('❌ No se pudo obtener el rowNode en el índice:', rowIndex);
            }
          } else {
            console.error('❌ No se encontró la fila para restaurar');
          }
        }

        // AHORA actualizar campos del contacto principal y contador en el grid padre
        await this.updatePrincipalContactInParent();
        await this.updateContactCountInParent();

      } catch (error) {
        console.error('❌ Error al guardar contactos:', error);
      }

      // NO llamar a triggerRefreshEmployees() porque cierra el panel de detalles
      // this.signalsService.triggerRefreshEmployees();
    }
  }

  deleteSelectedContact() {
    if (!this.selectedContact || !this.params.context.CONTACT.delete) {
      return;
    }

    if (this.params && this.params.context && this.params.context.CONTACT && this.params.context.CONTACT.delete) {
      this.params.context.CONTACT.delete(
        { data: this.selectedContact, api: this.contactGridApi },
        async () => {
          this.loadContactData();
          this.selectedContact = null;

          // Actualizar contador sin recargar toda la tabla
          await this.updateContactCountInParent();

          // NO llamar a triggerRefreshEmployees() - cierra el panel
          // this.signalsService.triggerRefreshEmployees();
        }
      );
    }
  }

  // Actualizar los campos del contacto principal en la tabla padre (Customer)
  private async updatePrincipalContactInParent(): Promise<void> {
    // Buscar el contacto marcado como principal
    const principalContact = this.contactRowData.find(row => row.principal === true);

    if (!principalContact) {
      console.log('⚠️ No hay contacto principal, no se actualiza la tabla padre');
      return;
    }

    console.log('📝 Actualizando contacto principal en tabla padre:', {
      nameContact: principalContact.campo2,
      position: principalContact.campo3,
      phone: principalContact.campo4,
      email: principalContact.campo5
    });

    try {
      // 1. Consultar los datos completos y actualizados del provider desde getCustomerById
      const providerData: any = await new Promise((resolve, reject) => {
        this.customersService.getCustomerById(this.providerId).subscribe({
          next: resolve,
          error: reject
        });
      });

      console.log('✅ Datos del provider obtenidos desde DB');

      // 2. Actualizar los campos del contacto principal
      providerData.nameContact = principalContact.campo2 || '';
      providerData.position = principalContact.campo3 || '';
      providerData.phone = principalContact.campo4 || '';
      providerData.email = principalContact.campo5 || '';

      // 3. Guardar con updateCustomer
      await new Promise((resolve, reject) => {
        this.customersService.updateCustomer(this.providerId, providerData).subscribe({
          next: resolve,
          error: reject
        });
      });

      console.log('✅ Contacto principal actualizado exitosamente en DB Administration.Customer');

      // 4. Actualizar los datos locales en el objeto del grid padre
      this.params.data.nameContact = principalContact.campo2 || '';
      this.params.data.position = principalContact.campo3 || '';
      this.params.data.phone = principalContact.campo4 || '';
      this.params.data.email = principalContact.campo5 || '';

      // 5. Refrescar el grid padre para mostrar los cambios
      if (this.params.api) {
        this.params.api.applyTransaction({ update: [this.params.data] });
      }

    } catch (error) {
      console.error('❌ Error al actualizar contacto principal en tabla padre:', error);
      alerts.basicAlert(
        'Advertencia',
        'Los contactos se guardaron correctamente, pero hubo un error al actualizar los datos del contacto principal en la tabla de proveedores.',
        'warning'
      );
    }
  }

  // Actualizar el contador de contactos en la fila del grid padre
  // NOTA: Esta función actualiza temporalmente el contador en memoria.
  // El valor persistente viene del backend (vista SQL proveedoresxtype).
  private async updateContactCountInParent(): Promise<void> {
    try {
      console.log('🔢 Actualizando contador de contactos en grid padre...');

      // Esperar un poco para que los datos se actualicen
      await new Promise(resolve => setTimeout(resolve, 300));

      // Contar SOLO contactos activos (vigente = true)
      const activeContacts = this.contactRowData.filter(contact => contact.vigente === true);
      const activeContactCount = activeContacts.length;

      console.log('📊 Total de contactos activos:', activeContactCount);
      console.log('📊 Total de contactos en memoria (incluyendo inactivos):', this.contactRowData.length);

      // Actualizar el contador en la fila del grid padre (temporal, en memoria)
      this.params.data.fieldContact = activeContactCount;

      // NO usar refreshCells porque destruye el detail grid
      // En su lugar, solo actualizar los datos - el grid padre se actualizará automáticamente
      console.log('✅ Contador de contactos actualizado en grid padre:', this.params.data.fieldContact);

    } catch (error) {
      console.error('❌ Error al actualizar contador de contactos:', error);
    }
  }

}