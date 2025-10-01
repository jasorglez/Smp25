import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';
import { alerts } from 'app/helpers/alerts';
import { DatosXFechasService } from 'app/services/OtDatosXFechas.service';
import { OnInit } from '@angular/core';
import { ProjectsService } from 'app/services/projects.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { ImageHandlerService } from 'app/services/image-handler.service';


@Component({
  selector: 'app-reportes-generadores',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AgGridModule],
  templateUrl: './reportes-generadores.component.html',
  styleUrl: './reportes-generadores.component.scss'
})
export class ReportesGeneradoresComponent implements OnInit {

  private datosXFechasService = inject(DatosXFechasService);
  private signalsService = inject(SignalsService);
  private projectsService = inject(ProjectsService);
  private trackingService = inject(TrackingService);
  private catalogService = inject(CatalogsService);
  private imageHandlerService = inject(ImageHandlerService);
  private fb = inject(FormBuilder);

  // Variables del componente
  estimacionSeleccionada: string = '';
  fechaInicio: string = '';
  fechaFin: string = '';
  activeTab: string = 'OTs';
  showGraficos: boolean = false;
  selectFechas: FormGroup;
  
  estimaciones: any[] = [];
  projects: any[] = [];
  OTsData: any[] = [];
  DetallesData: any[] = [];
  idcompany: number = 0;
  catalogDepartamentos: any[] = [];
  resumenData: any = {
    totalGeneradores: 0,
    totalItems: 0,
    promedioItems: 0,
    rangoFechas: '',
    porArea: []
  };
  
  private otsGridApi: GridApi;
  private detallesGridApi: GridApi;
  private contract = this.signalsService.getContractSelectedBySidebar()();

  // Configuración del grid
  defaultColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1,
    rowHeight: 20
  };

  OTsColumnDefs: ColDef[] = [
    {
      filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'windows',
        },
      field: 'otNumber',
      headerName: 'Número OT',
      width: 150,
      pinned: 'left'
    },
    {
      filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'windows',
        },
      field: 'cdc',
      headerName: 'Número CDC',
      width: 150,
      pinned: 'left'
    },
    {
      filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'windows',
        },
      field: 'idProject',
      headerName: 'Proyecto',
      width: 150,
      valueFormatter: (params) => {
          // Handle potential null values and properly format the displayed value
          if (!params.value) return '';

          const foundProject = this.projects
            ? this.projects.find((item) => item.id === params.value)
            : null;

          return foundProject ? foundProject.name : params.value;
        },
        valueGetter: (params) => {
          if (!params.data || !params.data.idProject) return '';
          const project = this.projects?.find(b => b.id === params.data.idProject);
          return project ? project.name : '';
        },
    },
    {
      filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'windows',
        },
      field: 'registerDate',
      headerName: 'Fecha',
      width: 120,
      valueFormatter: (params) => {
        if (params.value) {
          return new Date(params.value).toLocaleDateString('es-ES');
        }
        return '';
      }
    },
    {
      filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'windows',
        },
      field: 'area',
      headerName: 'Área',
      width: 100
    },
    {
      filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'windows',
        },
      field: 'description',
      headerName: 'Descripción',
      width: 150
    },
    {
      field: 'results',
      headerName: 'Resultado',
      width: 180
    },
    {
      field: 'observations',
      headerName: 'Observaciones',
      width: 280
    },
    {
      field: 'cuentaHoja',
      headerName: 'Hoja',
      width: 15
    },
  ];

  DetallesColumnDefs: ColDef[] = [
    
    {
      filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'windows',
        },
      field: 'otNumber',
      headerName: 'Número OT',
      width: 100,
    },
    {
      filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'windows',
        },
      field: 'cdcNumber',
      headerName: 'Número CDC',
      width: 150,
    },
    {
      filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'windows',
        },
      field: 'date',
      headerName: 'Fecha',
      width: 120,
      valueFormatter: (params) => {
        if (params.value) {
          return new Date(params.value).toLocaleDateString('es-ES');
        }
        return '';
      }
    },
    {
      filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'windows',
        },
      field: 'nameCuadrilla',
      headerName: 'Cuadrilla',
      width: 150
    },
    {
      filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'windows',
        },
      field: 'typenote',
      headerName: 'Tipo de Nota',
      width: 150
    },
    {
      headerName: 'Nombre',
      width: 150,
      valueGetter: (params) => {
        if (!params.data) return '';

        const {
          nombreConcepto,
          nombreEmpleado,
          nombreMaterial,
          nombreEquipo
        } = params.data;
        if(params.data.typenote === 'Photo' || params.data.typenote === 'Video') {
          return params.data.description || '';
        }

        return (
          (nombreConcepto && nombreConcepto.trim()) ||
          (nombreEmpleado && nombreEmpleado.trim()) ||
          (nombreMaterial && nombreMaterial.trim()) ||
          (nombreEquipo && nombreEquipo.trim()) ||
          ''
        );
      }

    },
    {
      headerName: 'Description',
      width: 150,
      valueGetter: (params) => {
        // El valueGetter sigue siendo útil para filtrado y exportación
        const data = params.data;
        if (!data) return '';

        if (data.typenote === 'PERSONAL') {
          const posicion = this.catalogDepartamentos?.find(depto => depto.id === data.idPosicion);
          return posicion?.description || '';
        } else if (data.typenote === 'Photo') {
          return data.image || '';
        } else {
          return data.quantity || '';
        }
      },
      cellRenderer: (params: any) => {
        // El cellRenderer decide qué mostrar en la celda
        if (params.data && (params.data.typenote === 'Photo' || params.data.typenote === 'Video')) {
          // Si es una foto o video, usamos el renderer de imágenes
          return this.imageHandlerService.imageCellRenderer(params);
        }
        // Para cualquier otro caso, mostramos el valor de texto normalmente
        return params.value;
      },
      filterParams: {
        defaultToNothingSelected: true,
        // excelMode: 'windows',
      },
    },
    
    
  ];

  constructor() {
    // Log de acceso al componente
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Acceso a Reportes de Generadores',
      'Modulo Proyectos - Estimaciones - Reportes Generadores',
      this.trackingService.getEmail()
    );

    this.initializeDatesAndForm();

    
    // Ya no es necesario, la carga se hará al presionar el botón
    // Effect para cargar estimaciones cuando cambie el contrato
    effect(() => {
      const contractId = this.signalsService.getContractSelectedBySidebar()();
      if (contractId) {
        this.contract = contractId;
        //this.cargarEstimaciones();
      }
      this.obtenerProjects();
      this.initializeDatesAndForm();
      this.idcompany = this.signalsService.getRootSelectedBySidebar()();
      this.getDeptoandPosition();
    });
    
  }
  obtenerProjects() {
    this.projectsService.getProjects().subscribe({
      next: (projects) => {
        this.projects = projects;
      },
      error: (error) => {
        console.error('Error al cargar proyectos:', error);
      }
    });
  }

  ngOnInit(): void {
    this.generarReporte(); // Carga inicial de datos
    this.obtenerProjects();
  }

  private initializeDatesAndForm(): void {
    const today = new Date();
    const dayOfWeek = today.getDay(); // Domingo: 0, Lunes: 1, ..., Sábado: 6
    const thisThursday = new Date(today);
    thisThursday.setDate(today.getDate() - dayOfWeek + 4);
    const previousWednesday = new Date(thisThursday);
    previousWednesday.setDate(thisThursday.getDate() - 8);
    this.fechaInicio = previousWednesday.toISOString().split('T')[0];
    this.fechaFin = thisThursday.toISOString().split('T')[0];
  
      this.selectFechas = this.fb.group({
        fechaInicio: [this.fechaInicio, Validators.required],
        fechaFin: [this.fechaFin, Validators.required]
      });
  
      // Suscribirse a los cambios en el formulario para recargar datos automáticamente
      /*this.selectFechas.valueChanges.subscribe(values => {
        if (this.selectFechas.valid && values.fechaInicio && values.fechaFin) {
          this.generarReporte();
        }
      });*/
    }

  onOTsGridReady(params: GridReadyEvent) {
    this.otsGridApi = params.api;
  }

  onDetallesGridReady(params: GridReadyEvent) {
    this.detallesGridApi = params.api;
  }

  getDataPath = (data: any) => {
    return data.orgHierarchy;
  };
  getDeptoandPosition() {
    this.catalogService.getCatalogsVigente(this.idcompany, 'POSITION').subscribe(
      (data: any) => {
        this.catalogDepartamentos = data;
        console.log('Departamentos obtenidos:', this.catalogDepartamentos);
      },
      (error) => {
        if (error.status == 404) this.catalogDepartamentos = [];
        console.error('Error fetching data:', error);
      }
    );

  }

  generarReporte() {
    if (this.selectFechas.invalid) {
      alerts.basicAlert('Error', 'Por favor, seleccione fechas válidas.', 'error');
      return;
    }

    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Generar Reporte de Generadores',
      'Modulo Proyectos - Estimaciones - Reportes Generadores',
      this.trackingService.getEmail()
    );
    
    /*const idProject = this.signalsService.getProjectSelectedBySidebar()();
    if (!idProject) {
      alerts.basicAlert('Error', 'No hay un proyecto seleccionado.', 'error');
      return;
    }*/

    const { fechaInicio, fechaFin } = this.selectFechas.value;

    const startDate = new Date(fechaInicio);
    const endDate = new Date(fechaFin);

    this.datosXFechasService.getOTs(18, startDate, endDate).subscribe({
      next: (data: any[]) => {
        this.OTsData = data;
        console.log('OTsData loaded:', this.OTsData);
        //alerts.basicAlert('Reporte Generado', `Se encontraron ${data.length} OTs.`, 'success');
      },
      error: (error) => {
        console.error('Error al cargar OTs:', error);
        //alerts.basicAlert('Error', 'Error al cargar los datos de OTs.', 'error');
        this.OTsData = [];
      }
    });
    this.datosXFechasService.getDailyReports(18, startDate, endDate).subscribe({
      next: (data: any[]) => {
        this.DetallesData = data;
        console.log('DetallesData loaded:', this.DetallesData);
        //alerts.basicAlert('Reporte Generado', `Se encontraron ${data.length} Detalles.`, 'success');
      },
      error: (error) => {
        console.error('Error al cargar Detalles:', error);
        //alerts.basicAlert('Error', 'Error al cargar los datos de Detalles.', 'error');
        this.DetallesData = [];
      }
    });
  }
}