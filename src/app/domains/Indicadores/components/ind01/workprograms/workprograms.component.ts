import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { WorkprogramsService } from 'app/services/workprograms.service';
import { gantt } from 'dhtmlx-gantt';

@Component({
  selector: 'app-workprograms',
  standalone: true,
  imports: [],
  templateUrl: './workprograms.component.html',
  styleUrl: './workprograms.component.scss'
})
export class WorkprogramsComponent implements OnInit {
  private workprogramsService = inject(WorkprogramsService);

  datosGantt: { data: any; links: any; };

  ngOnInit() {
    gantt.config.date_format = "%Y-%m-%d %H:%i";
    gantt.config.work_time = false;
    gantt.config.order_branch = true;
    gantt.config.order_branch_free = true;

    gantt['form_blocks']['color_picker'] = {
      render: function(sns) {
        return '<div class="gantt_cal_ltext" style="height:30px;">' +
               '<input type="color" id="task_color" style="width:100%;">' +
               '</div>';
      },
      set_value: function(node, value, task, section) {
        node.querySelector('#task_color').value = value || '#FFFFFF';
      },
      get_value: function(node, task, section) {
        return node.querySelector('#task_color').value;
      }
    };

    gantt.config.columns = [
      { name: "add", label: "", width: 44 },
      { name: "text", label: "Nombre de la tarea", tree: true, width: 200 },
      { name: "start_date", label: "Fecha de inicio", align: "center", width: 80 },
      { name: "end_date", label: "Fecha de fin", align: "center", width: 80 },
      {
        name: "progress", label: "Progreso", align: "center", width: 80, template: (task) => {
          return Math.round(task.progress * 100) + "%";
        }
      },
      {
        name: "responsable", label: "Responsable", align: "center", width: 80, template: (task) => {
          const responsables = { 1: "Juan", 2: "María", 3: "Carlos" };
          return responsables[task['responsable']] || "";
        }
      },
      {
        name: "priority", hide: true, label: "Prioridad", align: "center", width: 80, template: (task) => {
          const prioridades = { 1: "Baja", 2: "Media", 3: "Alta" };
          return prioridades[task['priority']] || "";
        }
      },
    ];

    // Definir los campos personalizados
    // Configuración de las etiquetas para el lightbox
    gantt.locale.labels['section_progress'] = "Progreso";
    gantt.locale.labels['section_time'] = "Fechas";
    gantt.locale.labels['section_responsable'] = "Responsable";
    gantt.locale.labels['section_priority'] = "Prioridad";
    gantt.locale.labels['section_color'] = "Color";

    gantt.config.lightbox.sections = [
      { name: "description", height: 70, map_to: "text", type: "textarea", focus: true },
      { name: "time", type: "time", map_to: "auto" },
      {
        name: "responsable", height: 22, map_to: "responsable", type: "select", options: [
          { key: 1, label: "Juan" },
          { key: 2, label: "María" },
          { key: 3, label: "Carlos" }
        ]
      },
      {
        name: "priority", height: 22, map_to: "priority", type: "select", options: [
          { key: 1, label: "Baja" },
          { key: 2, label: "Media" },
          { key: 3, label: "Alta" }
        ]
      },
      { name: "color", height: 30, map_to: "color", type: "color_picker" }
    ];

    gantt.init('gantt_here');

    this.loadDataFromAPI(); 
  }

  mostrarDatos() {
    const tareas = gantt.serialize().data;
    const enlaces = gantt.serialize().links;

    this.datosGantt = {
      data: tareas,
      links: enlaces
    }
    console.log(this.datosGantt);
  }

  loadDataFromAPI() {
    this.workprogramsService.getWorkprograms(1, 'Project').subscribe(
      (response: any) => {
        const transformedData = this.transformData(response);
        gantt.parse(transformedData);
        console.log(transformedData);
      },
      error => {
        console.error('Error al cargar los datos:', error);
      }
    );
  }

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
      // Campos secundarios
      criticRoute: item.criticRoute,
      activity: item.activity,
      typeActivity: item.typeActivity,
      especification: item.especification,
      distribution: item.distribution,
      costMX: item.costMX,
      costDLL: item.costDLL,
      quantity: item.quantity,
      predecesor: item.predecesor,
      active: item.active
    }));

    return { data: transformedData };
  }

}
