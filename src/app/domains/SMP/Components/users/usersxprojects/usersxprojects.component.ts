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
import { BranchsService } from 'app/services/branchs.service';
import { UsersProfileComponent } from "../users-profile/users-profile.component";

@Component({
  selector: 'app-usersxprojects',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, UsersProfileComponent],
  templateUrl: './usersxprojects.component.html',
  styleUrl: './usersxprojects.component.scss'
})
export class UsersxprojectsComponent {

  constructor(private usersService: UsersService, private projectsService: ProjectsService,
    private usersxprojectsService: UsersxprojectsService, private oilfieldService: OilfieldService,
    private branchsService: BranchsService) { }

  ngOnInit() {
    this.obtenerDatos();
    this.obtenerProjects();
    this.obtenerBranchs();
  }

  //Signals con correo
  profile = computed(()=> this.usersService.profile);
  correo: any = this.profile().emailUser();

  // signalValue = computed(() => this.usersService.emailUser());
  // correo: string = this.signalValue() == '' ? 'Seleccione una fila' : this.signalValue();
  notSavedChanges: boolean = false;
  rowData: any;
  projects: { [key: string]: string } = {};
  branchs: { [key: string]: string } = {};
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

  obtenerBranchs() {
    this.branchsService.branchs().subscribe((data: any) => {
      this.branchs = Object.entries(data).reduce((acc, [key, value]: [string, any]) => {
        acc[key] = value.name;
        return acc;
      }, {} as { [key: string]: string });
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
    },
    {
      field: 'id_branchs',
      headerName: 'Branch',
      cellEditor: 'customSelectEditor',
      cellEditorParams: {
        options: Object.fromEntries(
          Object.entries(this.branchs).map(([id, name]) => [name, id])
        )
      },
      cellRenderer: this.customSelectRenderer(
        Object.fromEntries(
          Object.entries(this.branchs).map(([id, name]) => [name, id])
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
    // Verificar si el campo modificado es 'id_projects'
    if (event.colDef.field === 'id_projects') {
      const selectedProject = this.projects[event.data.id_projects];
      if (selectedProject) {
        event.data.projects = selectedProject;
      }

      // Forzar actualización de la celda de 'project'
      this.gridApi.refreshCells({ rowNodes: [event.node], columns: ['projects'], force: true });
    }

    // Verificar si el campo modificado es 'id_branchs'
    if (event.colDef.field === 'id_branchs') {
      const selectedBranch = this.branchs[event.data.id_branchs];
      if (selectedBranch) {
        event.data.branchs = selectedBranch;
      }

      // Forzar actualización de la celda de 'project'
      this.gridApi.refreshCells({ rowNodes: [event.node], columns: ['branchs'], force: true });
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

  addRow() {
    const newId = this.generateUniqueId();
    const newItem = {
      id: newId,
      id_branchs: '',
      id_projects: '',
      mail: this.correo,
      projects: ''
    };

    this.rowData = [newItem, ...this.rowData];
    // Añadir el ID de la nueva fila a nuestro registro
    this.newlyAddedRows.push(newId);
  }

  generateUniqueId() {
    return 'new-' + Math.random().toString(36).substr(2, 9);
  }

  saveChanges() {
    const isValid = this.rowData.every(
      (item) => item.id_branchs && item.id_projects
    );
  
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe seleccionar un proyecto y un branch antes de guardar.',
        'error'
      );
      return;
    }
  
    // Filtrar las filas nuevas usando nuestro registro de nuevas filas
    const newItems = this.rowData.filter((item) =>
      this.newlyAddedRows.includes(item.id)
    );
  
    let successfullyAdded = [];
  
    // Procesar nuevos usuarios primero
    if (newItems.length > 0) {
      for (const item of newItems) {
        // Enviamos los datos a la base de datos
        try {
          successfullyAdded.push(item);
        } catch (error) {
          // Para otros errores, detener el proceso
          alerts.basicAlert(
            'Error de registro',
            'Ocurrió un error al registrar nuevos datos. Por favor, intente nuevamente.',
            'error'
          );
          return;
        }
      }
    }
  
    // Filtrar solo las filas que han sido modificadas o son nuevas
    const updatedRows = this.rowData.filter(row => 
      this.newlyAddedRows.includes(row.id) || row.__modified
    );

    // Eliminar la propiedad __modified antes de enviar los datos
    updatedRows.forEach(row => {
      delete row.__modified;
    });

    this.usersxprojectsService.bulkUpdateUsersxProjects(updatedRows).subscribe(
      (response) => {
        alerts.basicAlert(
          'Datos actualizados',
          'Se han actualizado los datos correctamente.',
          'success'
        );
        this.notSavedChanges = false;
        this.newlyAddedRows = [];
        this.obtenerDatos(); // Refrescar los datos
      },
      (error) => {
        alerts.basicAlert(
          'Error',
          'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
          'error'
        );
      }
    );
  }

  async deleteEntry() {
    try {
      const selectedNodes = this.gridApi.getSelectedNodes();
      if (selectedNodes.length === 0) {
        alerts.basicAlert(
          'Eliminar entrada',
          'Por favor, seleccione una entrada para eliminar.',
          'warning'
        );
        return;
      }

      const selectedData = selectedNodes[0].data;
      const id = selectedData.id;

      // Elimina al usuario de la DB de Firebase
      await this.usersxprojectsService.deleteUserxProject(id).toPromise();

      // Refrescar los datos después de eliminar
      this.obtenerDatos();

      alerts.basicAlert(
        'Eliminar entrada',
        'Entrada eliminada satisfactoriamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.selectedRowData = null;
    } catch (error) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Error al eliminar la entrada.',
        'error'
      );
    }
  }
}
