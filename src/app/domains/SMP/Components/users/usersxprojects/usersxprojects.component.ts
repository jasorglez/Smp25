import { Component, computed } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { UsersService } from 'app/services/users.service';
import { CustomSelectComponent } from '../../custom-select/custom-select.component';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { UsersxprojectsService } from 'app/services/usersxprojects.service';
import { ProjectsService } from 'app/services/projects.service';
import { OilfieldService } from 'app/services/oilfield.service';

@Component({
  selector: 'app-usersxprojects',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './usersxprojects.component.html',
  styleUrl: './usersxprojects.component.scss'
})
export class UsersxprojectsComponent {

  constructor(private usersService: UsersService, private projectsService: ProjectsService,
    private usersxprojectsService: UsersxprojectsService, private oilfieldService: OilfieldService) { }

  ngOnInit() {
    this.obtenerDatos();
    this.obtenerProjects();
    this.obtenerOilfield();
  }

  signalValue = computed(() => this.usersService.emailUser());
  correo: string = this.signalValue() == '' ? 'Seleccione una fila' : this.signalValue();
  notSavedChanges: boolean = false;
  rowData: any;
  projects: { [key: string]: string } = {};
  oilfields: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  id: string;
  private gridApi: GridApi;

  components = {
    customSelectEditor: CustomSelectComponent,
  };

  obtenerDatos() {
    this.usersxprojectsService.getDataUsersxProjects(this.correo).subscribe((data: any) => {
      this.rowData = Object.keys(data).map((key) => {
        return { id: key, ...data[key] };
      });
      console.log(this.rowData);
    });
  }

  obtenerProjects() {
    this.projectsService.getProjects().subscribe((data: any) => {
      this.projects = Object.entries(data).reduce((acc, [key, value]: [string, any]) => {
        acc[key] = value.contract;
        return acc;
      }, {} as { [key: string]: string });
    });
  }

  obtenerOilfield() {
    this.oilfieldService.getOilfields().subscribe((data: any) => {
      this.oilfields = Object.entries(data).reduce((acc, [key, value]: [string, any]) => {
        acc[key] = value.name;
        return acc;
      }, {} as { [key: string]: string });
      console.log(this.oilfields);
    });
  }

  get columnDefs(): ColDef[] {
    return [{
      field: 'mail',
      headerName: 'Correo',
      flex: 1
    },
    {
      field: 'id_projects',
      headerName: 'Proyecto',
      cellEditor: 'customSelectEditor',
      cellEditorParams: {
        options: Object.fromEntries(
          Object.entries(this.projects).map(([id, contract]) => [contract, id])
        )
      },
      cellRenderer: this.customSelectRenderer(
        Object.fromEntries(
          Object.entries(this.projects).map(([id, contract]) => [contract, id])
        )
      ),
      editable: true,
      flex: 2
    }
    ]
  }

  onSelectedRow(event: any) {
    this.id = event.data.id;
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    console.log('Dato cambiado:', event.data);

    // Verificar si el campo modificado es 'id_projects'
    if (event.colDef.field === 'id_projects') {
      const selectedProject = this.projects[event.data.id_projects];
      if (selectedProject) {
        event.data.projects = selectedProject;
      }

      // Forzar actualización de la celda de 'project'
      this.gridApi.refreshCells({ rowNodes: [event.node], columns: ['projects'], force: true });
    }

    this.notSavedChanges = true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }


  customSelectRenderer(options: { [key: string]: string }) {
    return (params: any) => {
      const value = params.value;
      const optionsArray = Object.entries(options);
      const matchingOption = optionsArray.find(([, optionValue]) => optionValue === value);
      return matchingOption ? matchingOption[0] : value; // Valor por defecto si no se encuentra coincidencia
    };
  }
}
