import { Component ,inject} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { AuthService } from 'app/services/auth.service';
import { CustomersService } from 'app/services/customers.service';
import { SignalsService } from 'app/services/signals.service';
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
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;" *ngIf="!invited">
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
              class="btn btn-sm btn-primary me-2 position-relative"
              (click)="saveContacts()"
              [disabled]="!hasContactChanges"
              >
              <i class="bi bi-floppy"></i> Guardar
              <span
                class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
                *ngIf="hasContactChanges">
                <span class="visually-hidden">Hay cambios sin guardar</span>
              </span>
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
   private signalsService = inject(SignalsService);


  params: any;
  providerId: number;
  providerName: string;

  // Contact grid properties
  contactRowData: any[] = [];
  hasContactChanges: boolean = false;
  name: string = '';
  contactGridApi: any;
  selectedContact: any = null;
  invited: boolean = false;

  // ✅ NUEVO: Rastrear la última fila editada/modificada
  private lastEditedRowId: string | null = null;
  private lastEditedRowName: string | null = null;
  private lastEditedRowPhone: string | null = null;

  // ✅ NUEVO: ID pendiente de selección después de guardar
  private pendingSelectionId: number | null = null;
  
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

      // ✅ Verificar si hay un ID pendiente de selección en el context
      const pendingId = this.params?.context?.pendingContactSelection?.[this.providerId];
      console.log('🔍 Verificando pendingSelectionId en context:', pendingId);
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
            console.error('   IDs disponibles:', this.contactRowData.map(r => r.id));
          }

          // Limpiar el ID pendiente del context
          if (this.params?.context?.pendingContactSelection) {
            delete this.params.context.pendingContactSelection[this.providerId];
            console.log('🧹 ID pendiente limpiado del context');
          }
        }, 100);
      }
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
        // ✅ Rastrear la última fila editada (checkbox vigente)
        this.lastEditedRowId = params.data.id;
        this.lastEditedRowName = params.data.campo2;
        this.lastEditedRowPhone = params.data.campo4;

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

          // ✅ NO ordenar durante la edición - solo refrescar celdas
          this.contactGridApi?.refreshCells({
            force: true
          });
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
        const rawValue = params.newValue;
        if (!rawValue || typeof rawValue !== 'string') {
          alerts.basicAlert('Campo requerido', 'El nombre del contacto es obligatorio', 'error');
          return false;
        }

        const normalizedValue = rawValue.trim();

        // Validar que solo contenga letras (incluyendo espacios, acentos y ñ)
        const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;
        if (!nameRegex.test(normalizedValue)) {
          alerts.basicAlert(
            'Formato inválido',
            'El nombre del contacto solo puede contener letras',
            'error'
          );
          return false;
        }

        params.data.campo2 = normalizedValue.toUpperCase();
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

        // Validar que solo contenga caracteres alfanuméricos, espacios, guiones, paréntesis y +
        // Máximo 20 caracteres
        const phoneRegex = /^[a-zA-Z0-9\s\-\(\)\+]{1,20}$/;
        if (!phoneRegex.test(normalizedValue)) {
          alerts.basicAlert(
            'Formato inválido',
            'El teléfono puede contener hasta 20 caracteres alfanuméricos, espacios, guiones, paréntesis y el signo +',
            'error'
          );
          return false;
        }

        params.data.campo4 = normalizedValue;
        params.data.__modified = true;
        this.hasContactChanges = true;
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

        // ✅ Rastrear la última fila editada (checkbox principal)
        this.lastEditedRowId = params.data.id;
        this.lastEditedRowName = params.data.campo2;
        this.lastEditedRowPhone = params.data.campo4;

        // Guardar ID de la fila modificada para restaurar focus
        const modifiedRowId = params.data.id;
        const modifiedRowName = params.data.campo2;

        // Si se intenta marcar como principal pero no está vigente, revertir
        if (params.newValue === true && params.data.vigente === false) {
          console.log('❌ Revirtiendo: No se puede marcar como principal si no está vigente');
          params.data.principal = false;

          // ✅ NO ordenar durante la edición - solo refrescar
          this.contactGridApi?.refreshCells({
            force: true
          });

          await alerts.basicAlert(
            'No permitido',
            'No se puede marcar como principal un contacto inactivo.',
            'warning'
          );
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

            // ✅ NO ordenar durante la edición - solo refrescar
            this.contactGridApi?.refreshCells({
              force: true
            });

            await alerts.basicAlert(
              'No permitido',
              'Debe haber al menos un contacto principal. Marque otro como principal antes de desmarcar este.',
              'warning'
            );
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

          // ✅ NO ordenar durante la edición - solo refrescar todas las celdas
          this.contactGridApi?.refreshCells({
            force: true
          });

          // ✅ Forzar redibujado de todas las filas para actualizar getRowStyle (color de fondo)
          this.contactGridApi?.redrawRows();
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
    this.invited = this.signalsService.getInvited()();
    
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

    // ✅ NUEVO: Rastrear la última fila editada para restaurar focus después de guardar
    this.lastEditedRowId = event.data.id;
    this.lastEditedRowName = event.data.campo2;
    this.lastEditedRowPhone = event.data.campo4;

    console.log('📝 Última fila editada:', {
      id: this.lastEditedRowId,
      nombre: this.lastEditedRowName,
      telefono: this.lastEditedRowPhone
    });
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
    this.hasContactChanges = false;
    this.lastEditedRowId = null;
    this.lastEditedRowName = null;
    this.lastEditedRowPhone = null;
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

    // ✅ Rastrear esta nueva fila para focus después de guardar
    this.lastEditedRowId = tempId;
    this.lastEditedRowName = '';
    this.lastEditedRowPhone = '';

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
        // ✅ GUARDAR el contacto principal ANTES de guardar cambios
        // Esto es importante porque después de recargar, necesitamos saber cuál era el principal
        const principalContactBeforeSave = this.contactRowData.find(row => row.principal === true);

        console.log('📌 Contacto principal ANTES de guardar:', {
          id: principalContactBeforeSave?.id,
          nombre: principalContactBeforeSave?.campo2,
          telefono: principalContactBeforeSave?.campo4,
          email: principalContactBeforeSave?.campo5,
          principal: principalContactBeforeSave?.principal,
          campo7: principalContactBeforeSave?.campo7
        });

        // ✅ USAR la última fila editada en lugar de la seleccionada
        const targetContactId = this.lastEditedRowId || this.selectedContact?.id;
        const targetContactName = this.lastEditedRowName || this.selectedContact?.campo2;
        const targetContactPhone = this.lastEditedRowPhone || this.selectedContact?.campo4;

        console.log('💾 Guardando con foco en:', {
          id: targetContactId,
          nombre: targetContactName,
          telefono: targetContactPhone,
          source: this.lastEditedRowId ? 'última editada' : 'seleccionada'
        });

        // ✅ Guardar y esperar (esto guarda en BD y muestra el alert al final)
        await this.params.context.CONTACT.save(this.providerId, this.contactRowData, 'CONTACT');

        console.log('✅ Guardado completado (incluyendo alert cerrado por usuario)');

        this.hasContactChanges = false;

        // ✅ RECARGAR datos desde el servidor para obtener los IDs reales
        // Esto ocurre DESPUÉS de guardar y DESPUÉS de cerrar el alert
        await new Promise<void>((resolve) => {
          this.loadContactData(() => {
            console.log('✅ Datos recargados desde servidor');
            resolve();
          });
        });

        // ⏰ Esperar para asegurar que el grid se renderice
        await new Promise(resolve => setTimeout(resolve, 200));

        console.log('🔍 Determinando ID final a seleccionar...');
        console.log('   targetContactId original:', targetContactId);
        console.log('   Total filas en contactRowData:', this.contactRowData.length);

        // ✅ DETERMINAR el ID final a seleccionar
        let finalIdToSelect: number;

        if (String(targetContactId).startsWith('temp_')) {
          // Si era un ID temporal (registro nuevo), buscar el ID MAYOR (más reciente)
          finalIdToSelect = Math.max(...this.contactRowData.map(r => Number(r.id)));
          console.log('🆕 Era registro nuevo (ID temporal), seleccionando ID mayor:', finalIdToSelect);
        } else {
          // Si era un ID real (registro editado), usar ese ID
          finalIdToSelect = Number(targetContactId);
          console.log('✏️ Era registro editado, seleccionando ID:', finalIdToSelect);
        }

        // ✅ GUARDAR el ID pendiente en el CONTEXT del grid padre
        // IMPORTANTE: Guardamos en context porque updatePrincipalContactInParent() destruye este componente
        // al hacer applyTransaction(), y todas las variables de instancia se pierden
        if (!this.params.context.pendingContactSelection) {
          this.params.context.pendingContactSelection = {};
        }
        this.params.context.pendingContactSelection[this.providerId] = finalIdToSelect;
        console.log('📌 ID guardado en context para selección pendiente:', finalIdToSelect);
        console.log('   Provider ID:', this.providerId);

        // AHORA actualizar campos del contacto principal y contador en el grid padre
        // Estos métodos destruyen y recrean este componente, pero el ID está a salvo en context
        // ✅ Pasar el contacto principal correcto a updatePrincipalContactInParent
        await this.updatePrincipalContactInParent(principalContactBeforeSave);
        await this.updateContactCountInParent();

        // ✅ Limpiar el rastreador de última fila editada
        this.lastEditedRowId = null;
        this.lastEditedRowName = null;
        this.lastEditedRowPhone = null;

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
  // ✅ SOLUCIÓN: Recibir el contacto principal como parámetro en lugar de buscarlo en contactRowData
  // Esto evita usar datos obsoletos del servidor que pueden no reflejar el último cambio de principal
  private async updatePrincipalContactInParent(principalContact?: any): Promise<void> {
    // Si no se pasa un contacto principal, buscarlo en los datos actuales
    if (!principalContact) {
      principalContact = this.contactRowData.find(row => row.principal === true);
    }

    // ✅ Si NO hay contacto principal, limpiar los campos en la tabla padre
    const hasNoPrincipal = !principalContact;

    if (hasNoPrincipal) {
      console.log('⚠️ No hay contacto principal - limpiando campos en ProvidersComponent');
    } else {
      console.log('📝 Actualizando contacto principal en tabla padre:', {
        id: principalContact.id,
        nameContact: principalContact.campo2,
        position: principalContact.campo3,
        phone: principalContact.campo4,
        email: principalContact.campo5,
        principal: principalContact.principal,
        campo7: principalContact.campo7
      });
    }

    try {
      // 1. Consultar los datos completos y actualizados del provider desde getCustomerById
      const providerData: any = await new Promise((resolve, reject) => {
        this.customersService.getCustomerById(this.providerId).subscribe({
          next: resolve,
          error: reject
        });
      });

      console.log('✅ Datos del provider obtenidos desde DB');

      // 2. Actualizar los campos del contacto principal (o limpiarlos si no hay contacto)
      if (hasNoPrincipal) {
        providerData.nameContact = '';
        providerData.position = '';
        providerData.phone = '';
        providerData.email = '';
      } else {
        providerData.nameContact = principalContact.campo2 || '';
        providerData.position = principalContact.campo3 || '';
        providerData.phone = principalContact.campo4 || '';
        providerData.email = principalContact.campo5 || '';
      }

      // 3. Guardar con updateCustomer
      await new Promise((resolve, reject) => {
        this.customersService.updateCustomer(this.providerId, providerData).subscribe({
          next: resolve,
          error: reject
        });
      });

      console.log('✅ Contacto principal actualizado exitosamente en DB Administration.Customer');

      // 4. Actualizar los datos locales en el objeto del grid padre
      if (hasNoPrincipal) {
        this.params.data.nameContact = '';
        this.params.data.position = '';
        this.params.data.phone = '';
        this.params.data.email = '';
      } else {
        this.params.data.nameContact = principalContact.campo2 || '';
        this.params.data.position = principalContact.campo3 || '';
        this.params.data.phone = principalContact.campo4 || '';
        this.params.data.email = principalContact.campo5 || '';
      }

      // 5. ✅ Refrescar el grid padre para mostrar los cambios (sin destruir el detalle)
      if (this.params.api) {
        // Usar refreshCells en lugar de applyTransaction para evitar destruir el detail grid
        this.params.api.refreshCells({
          rowNodes: [this.params.node],
          columns: ['nameContact', 'position', 'phone', 'email'],
          force: true
        });
        console.log('✅ Grid padre refrescado - columnas de contacto actualizadas visualmente');
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
