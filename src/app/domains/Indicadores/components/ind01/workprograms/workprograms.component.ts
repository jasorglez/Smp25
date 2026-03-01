import { Component, effect, HostListener, inject, NgZone } from '@angular/core';
import { alerts } from 'app/helpers/alerts';
import { WorkprogramsService } from 'app/services/workprograms.service';
import { gantt } from 'dhtmlx-gantt';
import { Observable, catchError, finalize, forkJoin, lastValueFrom, map, of } from 'rxjs';
import { AuxiliarsComponent } from './auxiliars/auxiliars.component';
import { MaterialsComponent } from './materials/materials.component';
import { PersonalComponent } from './personal/personal.component';
import { EquipmentComponent } from './equipment/equipment.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CatalogsService } from 'app/services/catalogs.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-workprograms',
  standalone: true,
  imports: [CommonModule, FormsModule, AuxiliarsComponent, EquipmentComponent, MaterialsComponent, PersonalComponent],
  templateUrl: './workprograms.component.html',
  styleUrl: './workprograms.component.scss'
})
export class WorkprogramsComponent {
  phases: { key: any; label: any; }[];

  // Para mostrar el indicador de cambios no guardados
  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  private workprogramsService = inject(WorkprogramsService);
  private catalogsService = inject(CatalogsService);
  private signalsService = inject(SignalsService);
  private ngZone = inject(NgZone);

  readonly projectName = this.signalsService.getProjectNameBySidebar();

  datosGantt: { data: any; links: any; };
  deletedTasks: Set<number> = new Set();

  idProject: number = null;
  idContract: number = null;
  idConvention: number = null;
  conventionName: string = '';
  typeWorkProgram: string = 'Project';
  measures: any;
  notSavedChanges: boolean = false;
  isSaving: boolean = false;
  idcompany: number = null;

  taskCount: number = 0;

  showNewFaseModal: boolean = false;
  newFaseDescription: string = '';

  showNewMedidaModal: boolean = false;
  newMedidaDescription: string = '';

  constructor() {
    // Exponer funciones globales para los botones "+" dentro del lightbox del gantt (fuera de la zona Angular)
    (window as any).__openNewFaseModal = () => {
      this.ngZone.run(() => { this.showNewFaseModal = true; });
    };
    (window as any).__openNewMedidaModal = () => {
      this.ngZone.run(() => { this.showNewMedidaModal = true; });
    };

    effect(() => {
      this.idContract = this.signalsService.getContractSelectedBySidebar()();
      this.idProject  = this.signalsService.getProjectSelectedBySidebar()();
      this.idcompany  = this.signalsService.getRootSelectedBySidebar()();
      this.typeWorkProgram = this.idProject == null ? 'Contract' : 'Project';
      this.loadVigenteAndInit();
    });
  }

  private async loadVigenteAndInit(): Promise<void> {
    this.taskCount = 0;
    const vigente = this.signalsService.getConventionVigente()();
    this.idConvention   = vigente?.id   ?? null;
    this.conventionName = vigente?.name ?? '';
    await this.initializeWorkprograms();
  }

  private async initializeWorkprograms(): Promise<void> {
    try {
      await this.getMeasures();
      await this.getPhases();
      this.configGantt();
      gantt.init('gantt_here');
      this.configureTaskEvents();
      await this.loadDataFromAPI();
    } catch (error) {
      console.error('Error initializing workprograms component:', error);
      // Handle the error appropriately, e.g., show an error message to the user
    }
  }

  configGantt() {
    gantt.config.date_format = "%Y-%m-%d %H:%i";
    gantt.config.work_time = false;
    gantt.config.order_branch = true;
    gantt.config.order_branch_free = true;
    gantt.config.open_tree_initially = true;
    gantt.config.multiselect = true;
    gantt.i18n.setLocale("es");

    // Configurar vista mensual
    gantt.config.scales = [
      { unit: "year", step: 1, format: "%Y" },
      { unit: "month", step: 1, format: "%M" }
    ];

    // Aquí monitoreamos que hubo cambios en el Gantt
    gantt.attachEvent("onAfterTaskAdd", () => this.notSavedChanges = true);
    gantt.attachEvent("onAfterTaskUpdate", () => this.notSavedChanges = true);
    gantt.attachEvent("onAfterTaskDelete", () => this.notSavedChanges = true);
    gantt.attachEvent("onAfterLinkAdd", () => this.notSavedChanges = true);
    gantt.attachEvent("onAfterLinkUpdate", () => this.notSavedChanges = true);
    gantt.attachEvent("onAfterLinkDelete", () => this.notSavedChanges = true);

    gantt.attachEvent("onAfterTaskUpdate", (id, task) => {
      this.updateParentTaskDates(task.parent);
    });

    gantt.attachEvent("onAfterTaskAdd", (id, task) => {
      this.updateParentTaskDates(task.parent);
    });

    gantt['form_blocks']['color_picker'] = {
      render: function (sns) {
        return '<div class="gantt_cal_ltext" style="height:30px;">' +
          '<input type="color" id="task_color" style="width:100%;">' +
          '</div>';
      },
      set_value: function (node, value, task, section) {
        const input = node.querySelector('#task_color') as HTMLInputElement;
        if (input) input.value = value || '#ffffff';
      },
      get_value: function (node, task, section) {
        const input = node.querySelector('#task_color') as HTMLInputElement;
        return input ? input.value : '#ffffff';
      },
      focus: function (node) {
        const input = node.querySelector('#task_color') as HTMLInputElement;
        if (input) input.focus();
      }
    };

    gantt['form_blocks']['currency_input'] = {
      render: function (sns) {
        return '<div class="gantt_cal_ltext" style="height:30px;">' +
          '<input type="number" id="currency_input" style="width:100%;" step="0.01" min="0">' +
          '</div>';
      },
      set_value: function (node, value, task, section) {
        const input = node.querySelector('#currency_input') as HTMLInputElement;
        if (input) input.value = value || 0;
      },
      get_value: function (node, task, section) {
        const input = node.querySelector('#currency_input') as HTMLInputElement;
        return input ? parseFloat(input.value) || 0 : 0;
      },
      focus: function (node) {
        const input = node.querySelector('#currency_input') as HTMLInputElement;
        if (input) input.focus();
      }
    };

    gantt['form_blocks']['number_input'] = {
      render: function (sns) {
        return '<div class="gantt_cal_ltext" style="height:30px;">' +
          '<input type="number" id="number_input" style="width:100%;">' +
          '</div>';
      },
      set_value: function (node, value, task, section) {
        const input = node.querySelector('#number_input') as HTMLInputElement;
        if (input) input.value = value || 1;
      },
      get_value: function (node, task, section) {
        const input = node.querySelector('#number_input') as HTMLInputElement;
        return input ? parseFloat(input.value) || 0 : 0;
      },
      focus: function (node) {
        const input = node.querySelector('#number_input') as HTMLInputElement;
        if (input) input.focus();
      }
    };

    gantt['form_blocks']['total_readonly'] = {
      render: function (sns) {
        return `<div style="height:28px;">
          <input type="text" id="total_display" readonly
            style="width:100%; height:26px; border:1px solid #ced4da; border-radius:3px; padding:0 6px;
                   font-size:13px; font-weight:600; color:#0e4491; background:#f1f7ff; cursor:default;">
        </div>`;
      },
      set_value: function (node, value, task, section) {
        const el = node.querySelector('#total_display') as HTMLInputElement;
        if (!el) return;
        const total = task['total'] ?? ((task['quantity'] ?? 0) * (task['costMX'] ?? 0));
        el.value = total != null ? `$ ${Number(total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '$ 0.00';
      },
      get_value: function (node, task, section) { return null; },
      focus: function (node) {}
    };

    gantt['form_blocks']['activity_color_row'] = {
      render: function (sns) {
        return `<div style="display:flex; gap:10px; align-items:flex-end; height:42px;">
          <div style="flex:2;">
            <div style="font-size:11px; color:#888; margin-bottom:2px;">Actividad</div>
            <input type="text" id="activity_input" style="width:100%; height:24px; border:1px solid #ced4da; border-radius:3px; padding:0 4px; font-size:12px;" maxlength="20">
          </div>
          <div style="flex:1;">
            <div style="font-size:11px; color:#888; margin-bottom:2px;">Color</div>
            <input type="color" id="activity_color_input" style="width:100%; height:24px; border:1px solid #ced4da; border-radius:3px; cursor:pointer;">
          </div>
        </div>`;
      },
      set_value: function (node, value, task, section) {
        const act   = node.querySelector('#activity_input')       as HTMLInputElement;
        const color = node.querySelector('#activity_color_input') as HTMLInputElement;
        if (act)   act.value   = task['activity'] || '';
        if (color) color.value = task['color']    || '#ffffff';
      },
      get_value: function (node, task, section) {
        const act   = node.querySelector('#activity_input')       as HTMLInputElement;
        const color = node.querySelector('#activity_color_input') as HTMLInputElement;
        task['color'] = color ? color.value : '#ffffff';
        return act ? act.value : '';
      },
      focus: function (node) {
        const act = node.querySelector('#activity_input') as HTMLInputElement;
        if (act) act.focus();
      }
    };

    gantt['form_blocks']['measure_phase_row'] = {
      render: function (sns: any) {
        const measureOpts = (sns.measureOptions || []).map((o: any) => `<option value="${o.key}">${o.label}</option>`).join('');
        const phaseOpts   = (sns.phaseOptions   || []).map((o: any) => `<option value="${o.key}">${o.label}</option>`).join('');
        return `<div style="display:flex; gap:10px; align-items:flex-end; height:42px;">
          <div style="flex:1;">
            <div style="font-size:11px; color:#888; margin-bottom:2px;">Unidad de medida</div>
            <div style="display:flex; gap:4px;">
              <select id="measure_picker_select" style="flex:1; height:24px; border:1px solid #ced4da; border-radius:3px; padding:0 4px; font-size:12px;">${measureOpts}</select>
              <button type="button" onclick="event.stopPropagation(); window.__openNewMedidaModal();"
                style="height:24px; width:24px; background:#17a2b8; color:#fff; border:none; border-radius:3px; cursor:pointer; font-size:14px; line-height:1; flex-shrink:0;" title="Nueva Medida">+</button>
            </div>
          </div>
          <div style="flex:1;">
            <div style="font-size:11px; color:#888; margin-bottom:2px;">Fase</div>
            <div style="display:flex; gap:4px;">
              <select id="phase_picker_select" style="flex:1; height:24px; border:1px solid #ced4da; border-radius:3px; padding:0 4px; font-size:12px;">${phaseOpts}</select>
              <button type="button" onclick="event.stopPropagation(); window.__openNewFaseModal();"
                style="height:24px; width:24px; background:#17a2b8; color:#fff; border:none; border-radius:3px; cursor:pointer; font-size:14px; line-height:1; flex-shrink:0;" title="Nueva Fase">+</button>
            </div>
          </div>
        </div>`;
      },
      set_value: function (node: any, value: any, task: any, section: any) {
        const ms = node.querySelector('#measure_picker_select') as HTMLSelectElement;
        const ps = node.querySelector('#phase_picker_select')   as HTMLSelectElement;
        if (ms && task['measure']) ms.value = task['measure'];
        if (ps && task['phase'])   ps.value = task['phase'];
      },
      get_value: function (node: any, task: any, section: any) {
        const ms = node.querySelector('#measure_picker_select') as HTMLSelectElement;
        const ps = node.querySelector('#phase_picker_select')   as HTMLSelectElement;
        task['phase'] = ps ? ps.value : '';
        return ms ? ms.value : '';
      },
      focus: function (node: any) {
        const ms = node.querySelector('#measure_picker_select') as HTMLSelectElement;
        if (ms) ms.focus();
      }
    };

    gantt['form_blocks']['route_type_row'] = {
      render: function (sns) {
        return `<div style="display:flex; gap:10px; align-items:flex-end; height:42px;">
          <div style="flex:1;">
            <div style="font-size:11px; color:#888; margin-bottom:2px;">Ruta Crítica</div>
            <select id="critic_route_select" style="width:100%; height:24px; border:1px solid #ced4da; border-radius:3px; padding:0 4px; font-size:12px;">
              <option value="Si">Sí</option>
              <option value="No">No</option>
            </select>
          </div>
          <div style="flex:1;">
            <div style="font-size:11px; color:#888; margin-bottom:2px;">Tipo</div>
            <select id="type_select" style="width:100%; height:24px; border:1px solid #ced4da; border-radius:3px; padding:0 4px; font-size:12px;">
              <option value="Project">Project</option>
              <option value="Contract">Contract</option>
            </select>
          </div>
        </div>`;
      },
      set_value: function (node, value, task, section) {
        const rc   = node.querySelector('#critic_route_select') as HTMLSelectElement;
        const type = node.querySelector('#type_select')         as HTMLSelectElement;
        if (rc)   rc.value   = task['criticRoute'] || 'No';
        if (type) type.value = task['type']        || 'Project';
      },
      get_value: function (node, task, section) {
        const rc   = node.querySelector('#critic_route_select') as HTMLSelectElement;
        const type = node.querySelector('#type_select')         as HTMLSelectElement;
        task['type'] = type ? type.value : 'Project';
        return rc ? rc.value : 'No';
      },
      focus: function (node) {
        const rc = node.querySelector('#critic_route_select') as HTMLSelectElement;
        if (rc) rc.focus();
      }
    };

    gantt['form_blocks']['costs_row'] = {
      render: function (sns) {
        return `<div style="display:flex; gap:8px; align-items:flex-end; height:42px;">
          <div style="flex:1;">
            <div style="font-size:11px; color:#888; margin-bottom:2px;">MXN $</div>
            <input type="number" id="cost_mx" style="width:100%; height:24px; border:1px solid #ced4da; border-radius:3px; padding:0 4px;" step="0.01" min="0">
          </div>
          <div style="flex:1;">
            <div style="font-size:11px; color:#888; margin-bottom:2px;">Total</div>
            <input type="text" id="cost_total" readonly style="width:100%; height:24px; border:1px solid #ced4da; border-radius:3px; padding:0 4px; font-weight:600; color:#0e4491; background:#f1f7ff; cursor:default;">
          </div>
          <div style="flex:1;">
            <div style="font-size:11px; color:#888; margin-bottom:2px;">USD $</div>
            <input type="number" id="cost_dll" style="width:100%; height:24px; border:1px solid #ced4da; border-radius:3px; padding:0 4px;" step="0.01" min="0">
          </div>
        </div>`;
      },
      set_value: function (node, value, task, section) {
        const mx    = node.querySelector('#cost_mx')    as HTMLInputElement;
        const total = node.querySelector('#cost_total') as HTMLInputElement;
        const dll   = node.querySelector('#cost_dll')   as HTMLInputElement;
        if (mx)    mx.value    = task['costMX']  ?? 0;
        if (dll)   dll.value   = task['costDLL'] ?? 0;
        if (total) {
          const t = task['total'] ?? ((task['quantity'] ?? 0) * (task['costMX'] ?? 0));
          total.value = `$ ${Number(t).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
        }
      },
      get_value: function (node, task, section) {
        const mx  = node.querySelector('#cost_mx')  as HTMLInputElement;
        const dll = node.querySelector('#cost_dll') as HTMLInputElement;
        task['costDLL'] = dll ? parseFloat(dll.value) || 0 : 0;
        return mx ? parseFloat(mx.value) || 0 : 0;
      },
      focus: function (node) {
        const mx = node.querySelector('#cost_mx') as HTMLInputElement;
        if (mx) mx.focus();
      }
    };

    gantt['form_blocks']['qty_ponderado_row'] = {
      render: function (sns) {
        return `<div style="display:flex; gap:10px; align-items:flex-end; height:42px;">
          <div style="flex:1;">
            <div style="font-size:11px; color:#888; margin-bottom:2px;">Cantidad</div>
            <input type="number" id="qty_input" style="width:100%; height:24px; border:1px solid #ced4da; border-radius:3px; padding:0 4px;" min="0">
          </div>
          <div style="flex:1;">
            <div style="font-size:11px; color:#888; margin-bottom:2px;">Ponderado (0-1)</div>
            <input type="number" id="ponderado_input" style="width:100%; height:24px; border:1px solid #ced4da; border-radius:3px; padding:0 4px;" step="0.001" min="0" max="1" placeholder="0.000">
          </div>
        </div>`;
      },
      set_value: function (node, value, task, section) {
        const qty  = node.querySelector('#qty_input')       as HTMLInputElement;
        const pond = node.querySelector('#ponderado_input') as HTMLInputElement;
        if (qty)  qty.value  = task['quantity']  ?? 0;
        if (pond) pond.value = task['ponderado'] != null ? task['ponderado'] : '';
      },
      get_value: function (node, task, section) {
        const qty  = node.querySelector('#qty_input')       as HTMLInputElement;
        const pond = node.querySelector('#ponderado_input') as HTMLInputElement;
        const p = parseFloat(pond?.value);
        task['ponderado'] = isNaN(p) ? null : p;
        return qty ? parseFloat(qty.value) || 0 : 0;
      },
      focus: function (node) {
        const qty = node.querySelector('#qty_input') as HTMLInputElement;
        if (qty) qty.focus();
      }
    };

    // Block personalizado: select de Medida + botón "+" para crear nueva medida
    gantt['form_blocks']['measure_picker'] = {
      render: function (sns: any) {
        const optionsHtml = (sns.options || [])
          .map((o: any) => `<option value="${o.key}">${o.label}</option>`)
          .join('');
        return `<div style="height:32px; display:flex; align-items:center; gap:4px;">
          <select id="measure_picker_select" style="flex:1; font-size:12px; height:28px; border:1px solid #ced4da; border-radius:4px; padding:0 4px;">${optionsHtml}</select>
          <button type="button" onclick="event.stopPropagation(); window.__openNewMedidaModal();"
            style="height:28px; width:28px; background:#17a2b8; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:16px; line-height:1; flex-shrink:0;"
            title="Nueva Medida">+</button>
        </div>`;
      },
      set_value: function (node: any, value: any, task: any, section: any) {
        const select = node.querySelector('#measure_picker_select') as HTMLSelectElement;
        if (select && value) select.value = value;
      },
      get_value: function (node: any, task: any, section: any) {
        const select = node.querySelector('#measure_picker_select') as HTMLSelectElement;
        return select ? select.value : '';
      },
      focus: function (node: any) {
        const select = node.querySelector('#measure_picker_select') as HTMLSelectElement;
        if (select) select.focus();
      }
    };

    // Block personalizado: select de Fase + botón "+" para crear nueva fase
    gantt['form_blocks']['phase_picker'] = {
      render: function (sns: any) {
        const optionsHtml = (sns.options || [])
          .map((o: any) => `<option value="${o.key}">${o.label}</option>`)
          .join('');
        return `<div style="height:32px; display:flex; align-items:center; gap:4px;">
          <select id="phase_picker_select" style="flex:1; font-size:12px; height:28px; border:1px solid #ced4da; border-radius:4px; padding:0 4px;">${optionsHtml}</select>
          <button type="button" onclick="event.stopPropagation(); window.__openNewFaseModal();"
            style="height:28px; width:28px; background:#17a2b8; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:16px; line-height:1; flex-shrink:0;"
            title="Nueva Fase">+</button>
        </div>`;
      },
      set_value: function (node: any, value: any, task: any, section: any) {
        const select = node.querySelector('#phase_picker_select') as HTMLSelectElement;
        if (select && value) select.value = value;
      },
      get_value: function (node: any, task: any, section: any) {
        const select = node.querySelector('#phase_picker_select') as HTMLSelectElement;
        return select ? select.value : '';
      },
      focus: function (node: any) {
        const select = node.querySelector('#phase_picker_select') as HTMLSelectElement;
        if (select) select.focus();
      }
    };

    gantt.config.columns = [
      { name: "add", label: "", width: 44 },
      { name: "activity", label: "Actividad", width: 60, template: (task) => `<span style="font-size: 12px;">${task['activity'] || ''}</span>` },
      { name: "text", label: "Nombre de la tarea", tree: true, width: 400, template: (task) => `<span style="font-size: 12px;">${task.text}</span>` },
      {
        name: "costMX", label: "<b style='font-size: 13px;'>Costo Mxn</b>", align: "right", width: 100, template: (task) => {
          const cost = task['costMX'] ? `$${task['costMX'].toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '$0.00';
          return `<span style="font-size: 12px;">${cost}</span>`;
        }
      },
      {
        name: "quantity", label: "<b style='font-size: 13px;'>Cantidad</b>", align: "right", width: 75, template: (task) => {
          return `<span style="font-size: 12px;">${task['quantity'] ?? 1}</span>`;
        }
      },
      { name: "start_date", label: "<b style='font-size: 12px;'>Fecha de inicio</b>", align: "center", width: 100, template: (task) => `<span style="font-size: 12px;">${task.start_date ? task.start_date.toLocaleDateString('es-ES') : ''}</span>` },
      { name: "end_date", label: "<b style='font-size: 12px;'>Fecha de fin</b>", align: "center", width: 100, template: (task) => `<span style="font-size: 12px;">${task.end_date ? task.end_date.toLocaleDateString('es-ES') : ''}</span>` },
      {
        name: "progress", label: "<b style='font-size: 12px;'>Progreso</b>", align: "center", width: 80, template: (task) => {
          return `<span style="font-size: 12px;">${Math.round(task.progress * 100)}%</span>`;
        }
      }
    ];

    // Definir los campos personalizados
    // Configuración de las etiquetas para el lightbox
    gantt.locale.labels['section_progress'] = "Progreso";
    gantt.locale.labels['section_time'] = "Fechas";
    gantt.locale.labels['section_responsable'] = "Responsable";
    gantt.locale.labels['section_priority'] = "Prioridad";
    gantt.locale.labels['section_color'] = "Color";
    gantt.locale.labels['section_qty_ponderado'] = "Cantidad / Ponderado";
    gantt.locale.labels['section_route_type'] = "Ruta Crítica / Tipo";
    gantt.locale.labels['section_measure_phase']  = 'Unidad / Fase';
    gantt.locale.labels['section_activity_color'] = 'Actividad / Color';
    gantt.locale.labels['section_costs'] = 'MXN $ / Total / USD $';
    gantt.locale.labels['section_type'] = 'Tipo';
    gantt.locale.labels['section_ponderado'] = 'Ponderado (0-1)';

    gantt.plugins({
      export_api: true,
      multiselect: true
    } as any);

    // Definir escalas de zoom disponibles
    const zoomConfig = {
      levels: [
        {
          name: "day",
          scale_height: 60,
          min_column_width: 30,
          scales: [
            { unit: "day", step: 1, format: "%d %M" },
            { unit: "hour", step: 1, format: "%H" }
          ]
        },
        {
          name: "week", 
          scale_height: 60,
          min_column_width: 50,
          scales: [
            { unit: "week", step: 1, format: function (date) {
              var dateToStr = gantt.date.date_to_str("%d %M");
              var endDate = gantt.date.add(gantt.date.add(date, 1, "week"), -1, "day");
              return dateToStr(date) + " - " + dateToStr(endDate);
            }},
            { unit: "day", step: 1, format: "%j" }
          ]
        },
        {
          name: "month",
          scale_height: 60,
          min_column_width: 120,
          scales: [
            { unit: "year", step: 1, format: "%Y" },
            { unit: "month", step: 1, format: "%M" }
          ]
        },
        {
          name: "quarter",
          height: 60,
          min_column_width: 90,
          scales: [
            { unit: "year", step: 1, format: "%Y" },
            {
              unit: "quarter", step: 1, format: function (date) {
                var dateToStr = gantt.date.date_to_str("%M");
                var endDate = gantt.date.add(gantt.date.add(date, 3, "month"), -1, "day");
                return dateToStr(date) + " - " + dateToStr(endDate);
              }
            }
          ]
        },
        {
          name: "year",
          scale_height: 50,
          min_column_width: 30,
          scales: [
            { unit: "year", step: 1, format: "%Y" }
          ]
        }
      ]
    };

    gantt.ext.zoom.init(zoomConfig as any);
    gantt.ext.zoom.setLevel("month"); // Establecer vista mensual por defecto

    gantt.config.lightbox.sections = [
      { name: "description", height: 150, map_to: "text", type: "textarea", focus: true },
      { name: "activity_color", height: 47, map_to: "activity", type: "activity_color_row" },
      { name: "costs", height: 47, map_to: "costMX", type: "costs_row" },
      { name: "time", type: "time", map_to: "auto" },
      { name: "measure_phase", height: 47, map_to: "measure", type: "measure_phase_row", measureOptions: this.measures, phaseOptions: this.phases } as any,
      { name: "qty_ponderado", height: 47, map_to: "quantity", type: "qty_ponderado_row" },
      { name: "route_type", height: 47, map_to: "criticRoute", type: "route_type_row" }
    ];
  }

  // Funcion para mostrar los datos del gantt
  mostrarDatos() {
    const data = gantt.serialize().data;
    const links = gantt.serialize().links;

    this.datosGantt = {
      data: data,
      links: links
    };
  }

  // Funcion para transformar los datos del gantt a los que entiende la API
  // Límites según modelo C#: criticRoute varchar(2), activity varchar(20),
  // especification varchar(20), measure varchar(10), phase varchar(30), color varchar(10)

  // Para campos nullable en el backend (string?)
  private trunc(val: any, max: number): string | null {
    if (val == null || val === '') return null;
    return String(val).substring(0, max);
  }

  // Para campos NOT NULL en el backend (string sin ?)
  private truncReq(val: any, max: number, def = ''): string {
    if (val == null || val === '') return def;
    return String(val).substring(0, max);
  }

  transformTaskForSave(task: any): any {
    return {
      id: task.idEntry,
      idTask: task.id,
      text: task.text || '',                                   // NOT NULL en C#
      idContract: this.idContract ?? 0,                        // int NOT NULL
      idProject: this.idProject ?? 0,                          // int NOT NULL
      idConvention: this.idConvention,  // convenio vigente del proyecto/contrato actual
      startDate: task.start_date.toISOString(),
      endDate: task.end_date.toISOString(),
      progress: task.progress ?? 0,
      parent: task.parent ?? 0,
      color: this.trunc(task.color, 10),                       // nullable
      measure: this.trunc(task.measure, 10),                   // nullable
      criticRoute: this.truncReq(task.criticRoute, 2, 'No'),   // NOT NULL en C#
      activity: this.truncReq(task.activity, 20, ''),          // NOT NULL en C#
      type: this.trunc(task.type, 10),                         // nullable — Project | Contract
      typeActivity: 'Activity',
      especification: this.trunc(task.especification, 20),     // nullable
      distribution: task.distribution ?? 0,
      costMX: task.costMX ?? 0,
      costDLL: task.costDLL ?? 0,
      quantity: task.quantity ?? 0,
      ponderado: task.ponderado ?? null,                       // nullable decimal(5,3)
      predecesor: task.predecesor ?? 0,
      phase: this.trunc(task.phase, 30),                       // nullable
      active: 1
    };
  }

  // Funcion para cargar los datos de la API
  loadDataFromAPI() {
    const id = this.typeWorkProgram === 'Project' ? this.idProject : this.idContract;
    const source$ = this.idConvention
      ? this.workprogramsService.getByConvention(this.idConvention, this.idProject ?? undefined)
      : this.workprogramsService.getWorkPrograms(id, this.typeWorkProgram);
    source$.pipe(
      map(response => {
        if (response && response.length > 0) {
          this.taskCount = response.length;
          const transformedData = this.transformData(response);
          gantt.clearAll(); // Limpiar todos los datos existentes
          gantt.parse(transformedData);
          return transformedData;
        } else {
          this.taskCount = 0;
          gantt.clearAll(); // Limpiar todos los datos si no hay respuesta
          return { data: [] };
        }
      }),
      catchError(error => {
        console.error('Error al cargar los datos:', error);
        gantt.clearAll(); // Limpiar todos los datos en caso de error
        return of({ data: [] });
      })
    ).subscribe();
  }

  // Funcion para transformar los datos de la API a los que entiende el gantt
  transformData(apiData: any[]): { data: any[] } {
    const transformedData = apiData.map(item => ({
      // Campos primordiales
      id: item.idTask,
      idEntry: item.id,
      text: item.text,
      start_date: new Date(item.startDate),
      end_date: new Date(item.endDate),
      progress: item.progress,
      parent: item.parent,
      color: item.color,
      // Campos personalizados
      criticRoute: item.criticRoute,
      activity: item.activity,
      typeActivity: item.typeActivity,
      especification: item.especification,
      distribution: item.distribution,
      costMX: item.costMX,
      costDLL: item.costDLL,
      quantity: item.quantity,
      predecesor: item.predecesor,
      measure: item.measure,
      phase: item.phase,
      // Campos nuevos
      idConvention: item.idConvention,
      type: item.type,
      ponderado: item.ponderado,
      total: item.total,
      active: item.active
    }));

    return { data: transformedData };
  }

  // Funcion para guardar los cambios en la API
  save() {
    if (!this.idProject && !this.idContract) {
      alerts.basicAlert('Aviso', 'Debes seleccionar un Proyecto o Contrato desde el sidebar antes de guardar.', 'warning');
      return;
    }

    if (this.isSaving) {
      return;
    }

    const tasks = gantt.getTaskByTime();
    const requests: Observable<any>[] = [];
    const createTasks: any[] = [];
    const updateRequestsCountRef = { count: 0 };

    tasks.forEach(task => {
      if (!this.deletedTasks.has(task['idEntry'])) {
        const transformedTask = this.transformTaskForSave(task);

        if (task['idEntry'] === undefined) {
          // Nueva tarea
          createTasks.push(task);
          requests.push(this.workprogramsService.addWorkProgram(transformedTask));

        } else {
          // Tarea existente
          updateRequestsCountRef.count++;
          requests.push(this.workprogramsService.updateWorkProgram(task['idEntry'], transformedTask));
        }
      }
    });

    // Agregar solicitudes DELETE para tareas eliminadas
    this.deletedTasks.forEach(idEntry => {
      requests.push(this.workprogramsService.deleteWorkProgram(idEntry));
    });

    if (requests.length === 0) {
      this.notSavedChanges = false;
      return;
    }

    this.isSaving = true;

    forkJoin(requests).pipe(
      finalize(() => this.isSaving = false)
    ).subscribe({
      next: (results) => {
        alerts.basicAlert('Editar', 'Todas las operaciones completadas con éxito', 'success');
        // Actualizar idEntry para nuevas tareas usando offset correcto
        const createStartIndex = updateRequestsCountRef.count;
        createTasks.forEach((task, index) => {
          const createResult = results[createStartIndex + index];
          const createdId = typeof createResult === 'number'
            ? createResult
            : createResult?.id ?? createResult?.Id ?? createResult?.data?.id;

          if (createdId !== undefined && createdId !== null) {
            task['idEntry'] = createdId;
          }
        });

        // Limpiar la lista de tareas eliminadas
        this.deletedTasks.clear();
        this.loadDataFromAPI();
        // Refrescar el gantt
        gantt.render();
        this.notSavedChanges = false;
      },
      error: (error) => {
        const detail = error?.error?.message || error?.message || JSON.stringify(error?.error) || 'Sin detalle';
        console.error('Error al guardar los cambios:', error);
        console.error('Detalle HTTP:', error?.status, detail);
        alerts.basicAlert('Error', `Error al guardar (${error?.status ?? '?'}): ${detail}`, 'error');
      }
    }
    );
  }

  // Funcion para configurar los eventos de las tareas
  configureTaskEvents() {
    gantt.attachEvent("onBeforeTaskDelete", (id, task) => {
      this.markTaskAndChildrenForDeletion(task);
      return true; // Permitir la eliminación
    });

    gantt.attachEvent("onAfterTaskDelete", (id, task) => {
      this.updateParentTaskDates(task.parent);
    });

    // Fechas por defecto para tareas nuevas: inicio hoy, fin hoy +1 día
    gantt.attachEvent("onBeforeLightbox", (id) => {
      const task = gantt.getTask(id);
      if (!task['idEntry']) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextYear = new Date(today);
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        task.start_date = today;
        task.end_date = nextYear;
        task.duration = gantt.calculateDuration(today, nextYear);
        gantt.updateTask(id);
      }
      requestAnimationFrame(() => {
        const box = document.querySelector('.gantt_cal_light') as HTMLElement;
        if (box) {
          box.style.setProperty('width', '700px', 'important');
          box.style.setProperty('min-width', '700px', 'important');
        }
      });
      return true;
    });
  }

  // Funcion para marcar las tareas y sus hijos para eliminacion
  markTaskAndChildrenForDeletion(task: any) {
    if (task.idEntry) {
      this.deletedTasks.add(task.idEntry);
    }

    // Obtener todas las tareas hijas
    const children = gantt.getChildren(task.id);

    // Recursivamente marcar para eliminación todas las tareas hijas
    children.forEach(childId => {
      const childTask = gantt.getTask(childId);
      this.markTaskAndChildrenForDeletion(childTask);
    });
  }

  // Funcion para exportar a PDF
  exportToPDF() {
    gantt.exportToPDF({
      name: "workprogram.pdf",
      locale: "es"
    });
  }

  // Funcion para exportar a Excel
  exportToXLS() {
    gantt.exportToExcel({
      name: "workprogram.xlsx",
      locale: "es"
    });
  }

  updateParentTaskDates(parentId: string | number) {
    if (parentId != gantt.config.root_id) {
      const children = gantt.getChildren(parentId);
      if (children.length > 0) {
        let minStartDate = new Date(8640000000000000); // Max date
        let maxEndDate = new Date(-8640000000000000); // Min date

        children.forEach(childId => {
          const childTask = gantt.getTask(childId);
          if (childTask.start_date < minStartDate) {
            minStartDate = new Date(childTask.start_date);
          }
          if (childTask.end_date > maxEndDate) {
            maxEndDate = new Date(childTask.end_date);
          }
        });

        const parentTask = gantt.getTask(parentId);
        parentTask.start_date = minStartDate;
        parentTask.end_date = maxEndDate;
        gantt.updateTask(parentId);

        // Recursively update higher-level parents
        this.updateParentTaskDates(parentTask.parent);
      }
    }
  }

  async getMeasures() {
    try {
      const measures = await this.catalogsService.getUnits(this.idcompany).toPromise();
      this.measures = measures.map(measure => ({
        key: measure.description.toString(),
        label: measure.description.toString()
      }));
    } catch (error) {
      // silencioso
    }
  }

  async getPhases() {
    try {
      const phases = await this.catalogsService.getPhases(this.idcompany).toPromise();
      this.phases = phases.map(phase => ({
        key: phase.description.toString(),
        label: phase.description.toString()
      }));
    } catch (error) {
      // silencioso
    }
  }

  // New method to indent selected tasks
  indentSelectedTasks() {
    const selectedIds = gantt.getSelectedTasks();
    if (selectedIds.length === 0) {
      alerts.basicAlert('Aviso', 'No hay tareas seleccionadas para aplicar sangría', 'info');
      return;
    }

    selectedIds.forEach(id => {
      const task = gantt.getTask(id);
      const prevSibling = gantt.getPrevSibling(id);
      if (prevSibling) {
        gantt.moveTask(id, gantt.getChildren(prevSibling).length, prevSibling);
        this.updateParentTaskDates(prevSibling);
      }
    });

    gantt.render();
  }

  // New method to outdent selected tasks
  outdentSelectedTasks() {
    const selectedIds = gantt.getSelectedTasks();
    if (selectedIds.length === 0) {
      alerts.basicAlert('Aviso', 'No hay tareas seleccionadas para quitar sangría', 'info');
      return;
    }

    selectedIds.forEach(id => {
      const task = gantt.getTask(id);
      if (task.parent !== gantt.config.root_id) {
        const parentTask = gantt.getTask(task.parent);
        const parentOfParent = parentTask.parent;
        const index = gantt.getTaskIndex(parentTask.id) + 1;
        gantt.moveTask(id, index, parentOfParent);
        this.updateParentTaskDates(parentOfParent);
      }
    });

    gantt.render();
  }

  deleteSelectedTasks() {
    const selectedIds = gantt.getSelectedTasks();
    if (selectedIds.length === 0) {
      alerts.basicAlert('Aviso', 'No hay tareas seleccionadas para eliminar', 'info');
      return;
    }

    alerts.confirmAlert('¿Estás seguro?', 'Las tareas seleccionadas serán eliminadas', 'warning', 'Eliminar').then((result) => {
      if (result.isConfirmed) {
        selectedIds.forEach(id => {
          const task = gantt.getTask(id);
          this.markTaskAndChildrenForDeletion(task);
          gantt.deleteTask(id);
        });
        gantt.render();
        alerts.basicAlert('Eliminado', 'Las tareas seleccionadas han sido eliminadas', 'success');
      }
    });
  }

  // Métodos para controlar el zoom
  zoomToYear() {
    gantt.ext.zoom.setLevel("year");
  }

  zoomToQuarter() {
    gantt.ext.zoom.setLevel("quarter");
  }

  zoomToMonth() {
    gantt.ext.zoom.setLevel("month");
  }

  zoomToWeek() {
    gantt.ext.zoom.setLevel("week");
  }

  zoomToDay() {
    gantt.ext.zoom.setLevel("day");
  }

  // ── Modal Nueva Medida ──────────────────────────────────────────────────────

  closeNewMedidaModal() {
    this.showNewMedidaModal = false;
    this.newMedidaDescription = '';
  }

  async saveNewMedida() {
    if (!this.newMedidaDescription.trim()) return;

    try {
      await lastValueFrom(this.catalogsService.addCatalog({
        idCompany: this.idcompany,
        description: this.newMedidaDescription.trim(),
        valueAddition: 'NA',
        valueAdditionBit2: false,
        valueAdditionBit3: false,
        vigente: true,
        type: 'MEASURE',
        active: 1
      }));

      await this.getMeasures();

      const select = document.querySelector('#measure_picker_select') as HTMLSelectElement;
      if (select) {
        select.innerHTML = this.measures
          .map((m: any) => `<option value="${m.key}">${m.label}</option>`)
          .join('');
        select.value = this.newMedidaDescription.trim();
      }

      const measureSection = (gantt.config.lightbox.sections as any[])?.find(s => s.name === 'measure_phase');
      if (measureSection) measureSection.measureOptions = this.measures;

      this.closeNewMedidaModal();
    } catch (error) {
      console.error('Error al crear medida:', error);
      alerts.basicAlert('Error', 'No se pudo crear la medida', 'error');
    }
  }

  // ── Modal Nueva Fase ────────────────────────────────────────────────────────

  closeNewFaseModal() {
    this.showNewFaseModal = false;
    this.newFaseDescription = '';
  }

  async saveNewFase() {
    if (!this.newFaseDescription.trim()) return;

    try {
      await lastValueFrom(this.catalogsService.addCatalog({
        idCompany: this.idcompany,
        description: this.newFaseDescription.trim(),
        valueAddition: 'NA',
        valueAdditionBit2: false,
        valueAdditionBit3: false,
        vigente: true,
        type: 'Fase',
        active: 1
      }));

      // Recargar fases
      await this.getPhases();

      // Actualizar el select dentro del lightbox si está abierto
      const select = document.querySelector('#phase_picker_select') as HTMLSelectElement;
      if (select) {
        select.innerHTML = this.phases
          .map((p: any) => `<option value="${p.key}">${p.label}</option>`)
          .join('');
        select.value = this.newFaseDescription.trim();
      }

      // Actualizar las opciones en la config del gantt para la próxima vez
      const phaseSection = (gantt.config.lightbox.sections as any[])?.find(s => s.name === 'measure_phase');
      if (phaseSection) phaseSection.phaseOptions = this.phases;

      this.closeNewFaseModal();
    } catch (error) {
      console.error('Error al crear fase:', error);
      alerts.basicAlert('Error', 'No se pudo crear la fase', 'error');
    }
  }
}
