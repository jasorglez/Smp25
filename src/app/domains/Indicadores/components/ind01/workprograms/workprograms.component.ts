import { Component, effect, HostListener, inject, OnInit } from '@angular/core';
import { alerts } from 'app/helpers/alerts';
import { WorkprogramsService } from 'app/services/workprograms.service';
import { gantt } from 'dhtmlx-gantt';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { AuxiliarsComponent } from './auxiliars/auxiliars.component';
import { MaterialsComponent } from './materials/materials.component';
import { PersonalComponent } from './personal/personal.component';
import { EquipmentComponent } from './equipment/equipment.component';
import { CommonModule } from '@angular/common';
import { CatalogsService } from 'app/services/catalogs.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-workprograms',
  standalone: true,
  imports: [CommonModule, AuxiliarsComponent, EquipmentComponent, MaterialsComponent, PersonalComponent],
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

  datosGantt: { data: any; links: any; };
  deletedTasks: Set<number> = new Set();

  idProject: number = null;
  idContract: number = null;
  typeWorkProgram: string = 'Project';
  measures: any;
  notSavedChanges: boolean = false;

  constructor() {
    effect(() => {
      this.idContract = this.signalsService.getContractSelectedBySidebar()();
      this.idProject = this.signalsService.getProjectSelectedBySidebar()();
      
      // Si idProject es null, significa que solo se ha elegido Contract en general sin un Project específico
      // Pero si idProject tiene un valor, significa que se ha elegido un Project
      this.idProject == null ? this.typeWorkProgram = 'Contract' : this.typeWorkProgram = 'Project';
      console.log(`Contrato: ${this.idContract}, Proyecto: ${this.idProject}, Tipo Workprogram: ${this.typeWorkProgram}`);
      this.initializeWorkprograms();
    });
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
        node.querySelector('#task_color').value = value || '#ffffff';
      },
      get_value: function (node, task, section) {
        return node.querySelector('#task_color').value;
      }
    };

    gantt['form_blocks']['currency_input'] = {
      render: function (sns) {
        return '<div class="gantt_cal_ltext" style="height:30px;">' +
          '<input type="number" id="currency_input" style="width:100%;" step="0.01" min="0">' +
          '</div>';
      },
      set_value: function (node, value, task, section) {
        node.querySelector('#currency_input').value = value || 0;
      },
      get_value: function (node, task, section) {
        return parseFloat(node.querySelector('#currency_input').value) || 0;
      }
    };

    gantt['form_blocks']['number_input'] = {
      render: function (sns) {
        return '<div class="gantt_cal_ltext" style="height:30px;">' +
          '<input type="number" id="number_input" style="width:100%;">' +
          '</div>';
      },
      set_value: function (node, value, task, section) {
        node.querySelector('#number_input').value = value || 0;
      },
      get_value: function (node, task, section) {
        return parseFloat(node.querySelector('#number_input').value) || 0;
      }
    };

    gantt.config.columns = [
      { name: "add", label: "", width: 44 },
      { name: "activity", label: "Actividad", width: 60 },
      { name: "text", label: "Nombre de la tarea", tree: true, width: 160 },
      { name: "start_date", label: "Fecha de inicio", align: "center", width: 80 },
      { name: "end_date", label: "Fecha de fin", align: "center", width: 80 },
      {
        name: "progress", label: "Progreso", align: "center", width: 80, template: (task) => {
          return Math.round(task.progress * 100) + "%";
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
    gantt.locale.labels['section_costMX'] = "Costo MXN $";
    gantt.locale.labels['section_costDLL'] = "Costo DLL $";
    gantt.locale.labels['section_quantity'] = "Cantidad";
    gantt.locale.labels['section_criticRoute'] = "Ruta Crítica";
    gantt.locale.labels['section_measure'] = 'Unidad de medida';
    gantt.locale.labels['section_activity'] = 'Actividad';
    gantt.locale.labels['section_phase'] = 'Fase';

    gantt.plugins({
      export_api: true,
      multiselect: true
    });

    gantt.config.lightbox.sections = [
      { name: "description", height: 70, map_to: "text", type: "textarea", focus: true },
      { name: "activity", map_to: "activity", type: "textarea", height: 30 },
      { name: "time", type: "time", map_to: "auto" },
      { name: "color", map_to: "color", type: "color_picker" },
      { name: "costMX", map_to: "costMX", type: "currency_input" },
      { name: "costDLL", map_to: "costDLL", type: "currency_input" },
      { name: "measure", map_to: "measure", type: "select", options: this.measures },
      { name: "quantity", map_to: "quantity", type: "number_input" },
      {
        name: "criticRoute", map_to: "criticRoute", type: "select", options: [
          { key: "Si", label: "Sí" },
          { key: "No", label: "No" }
        ]
      },
      { name: "phase", height: 30, map_to: "phase", type: "select", options: this.phases }
    ];
  }

  // Funcion para mostrar los datos del gantt
  mostrarDatos() {
    const data = gantt.serialize().data;
    const links = gantt.serialize().links;

    this.datosGantt = {
      data: data,
      links: links
    }
    console.log(this.datosGantt);
  }

  // Funcion para transformar los datos del gantt a los que entiende la API
  transformTaskForSave(task: any): any {
    return {
      id: task.idEntry, // Será undefined para tareas nuevas
      idTask: task.id,
      text: task.text,
      idContract: this.idContract,
      idProject: this.idProject,
      startDate: task.start_date.toISOString(),
      endDate: task.end_date.toISOString(),
      progress: task.progress,
      parent: task.parent,
      color: task.color,
      measure: task.measure,
      // Ahora los campos personalizados
      criticRoute: task.criticRoute,
      activity: task.activity,
      typeActivity: "Activity",
      especification: task.especification,
      distribution: task.distribution,
      costMX: task.costMX,
      costDLL: task.costDLL,
      quantity: task.quantity,
      predecesor: task.predecesor,
      phase: task.phase,
      active: 1
    };
  }

  // Funcion para cargar los datos de la API
  loadDataFromAPI() {
    const id = this.typeWorkProgram === 'Project' ? this.idProject : this.idContract;
    this.workprogramsService.getWorkPrograms(id, this.typeWorkProgram).pipe(
      map(response => {
        if (response && response.length > 0) {
          const transformedData = this.transformData(response);
          gantt.clearAll(); // Limpiar todos los datos existentes
          gantt.parse(transformedData);
          return transformedData;
        } else {
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
      // Ahora los campos personalizados
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
      active: item.active
    }));

    return { data: transformedData };
  }

  // Funcion para guardar los cambios en la API
  save() {
    const tasks = gantt.getTaskByTime();
    const requests: Observable<any>[] = [];

    tasks.forEach(task => {
      if (!this.deletedTasks.has(task['idEntry'])) {
        const transformedTask = this.transformTaskForSave(task);

        if (task['idEntry'] === undefined) {
          // Nueva tarea
          requests.push(this.workprogramsService.addWorkProgram(transformedTask));

        } else {
          // Tarea existente
          requests.push(this.workprogramsService.updateWorkProgram(task['idEntry'], transformedTask));
        }
        console.log(transformedTask);
      }
    });

    // Agregar solicitudes DELETE para tareas eliminadas
    this.deletedTasks.forEach(idEntry => {
      requests.push(this.workprogramsService.deleteWorkProgram(idEntry));
    });

    forkJoin(requests).subscribe({
      next: (results) => {
        alerts.basicAlert('Editar', 'Todas las operaciones completadas con éxito', 'success');
        console.log('Todas las operaciones completadas con éxito', results);
        // Actualizar idEntry para nuevas tareas
        let newTaskIndex = 0;
        tasks.forEach(task => {
          if (task['idEntry'] === undefined && !this.deletedTasks.has(task['idEntry'])) {
            task['idEntry'] = results[newTaskIndex].id;
            newTaskIndex++;
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
        alerts.basicAlert('Error', 'Error al guardar los cambios.', 'error');
        console.error('Error al guardar los cambios:', error);
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
      const measures = await this.catalogsService.getMeasures().toPromise();
      this.measures = measures.map(measure => ({
        key: measure.description.toString(),
        label: measure.description.toString()
      }));
      console.log(this.measures);
    } catch (error) {
      console.error('Error al obtener las medidas:', error);
    }
  }

  async getPhases() {
    try {
      const phases = await this.catalogsService.getPhases().toPromise();
      this.phases = phases.map(phase => ({
        key: phase.description.toString(),
        label: phase.description.toString()
      }));
      console.log(this.measures);
    } catch (error) {
      console.error('Error al obtener las fases:', error);
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
}
