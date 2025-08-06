import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { EstimatesService } from 'app/services/estimates.service';
import { GeneratorsService } from 'app/services/generators.service';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-reportes-generadores',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './reportes-generadores.component.html',
  styleUrl: './reportes-generadores.component.scss'
})
export class ReportesGeneradoresComponent {

  private estimatesService = inject(EstimatesService);
  private generatorsService = inject(GeneratorsService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);

  // Variables del componente
  estimacionSeleccionada: string = '';
  fechaInicio: string = '';
  fechaFin: string = '';
  activeTab: string = 'generadores';
  showGraficos: boolean = false;
  
  estimaciones: any[] = [];
  generadoresData: any[] = [];
  itemsData: any[] = [];
  resumenData: any = {
    totalGeneradores: 0,
    totalItems: 0,
    promedioItems: 0,
    rangoFechas: '',
    porArea: []
  };
  
  private generadoresGridApi: GridApi;
  private itemsGridApi: GridApi;
  private contract = this.signalsService.getContractSelectedBySidebar()();

  // Configuración del grid
  defaultColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1
  };

  generadoresColumnDefs: ColDef[] = [
    {
      field: 'numero',
      headerName: 'Número Generador',
      width: 150,
      pinned: 'left'
    },
    {
      field: 'dateStart',
      headerName: 'Fecha Inicio',
      width: 120,
      valueFormatter: (params) => {
        if (params.value) {
          return new Date(params.value).toLocaleDateString('es-ES');
        }
        return '';
      }
    },
    {
      field: 'dateEnd',
      headerName: 'Fecha Fin',
      width: 120,
      valueFormatter: (params) => {
        if (params.value) {
          return new Date(params.value).toLocaleDateString('es-ES');
        }
        return '';
      }
    },
    {
      field: 'fase',
      headerName: 'Área/Fase',
      width: 150
    },
    {
      field: 'creadoPor',
      headerName: 'Creado Por',
      width: 150
    },
    {
      field: 'revisadoPor',
      headerName: 'Revisado Por',
      width: 150
    },
    {
      field: 'autorizadoPor',
      headerName: 'Autorizado Por',
      width: 150
    },
    {
      field: 'aplicaIsometrico',
      headerName: 'Aplica Isométrico',
      width: 140,
      cellRenderer: (params) => params.value ? 'Sí' : 'No'
    },
    {
      field: 'totalItems',
      headerName: 'Total Items',
      width: 100,
      type: 'numericColumn'
    },
    {
      field: 'comment',
      headerName: 'Comentarios',
      width: 200
    }
  ];

  itemsColumnDefs: ColDef[] = [
    {
      field: 'generadorNumero',
      headerName: 'Generador',
      width: 150,
      cellRenderer: 'agGroupCellRenderer'
    },
    {
      field: 'recursoNombre',
      headerName: 'Recurso',
      width: 200
    },
    {
      field: 'quantity',
      headerName: 'Cantidad',
      width: 100,
      type: 'numericColumn'
    },
    {
      field: 'accumulate',
      headerName: 'Acumulado',
      width: 120,
      type: 'numericColumn',
      valueFormatter: (params) => {
        return params.value ? params.value.toLocaleString('es-MX', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }) : '0.00';
      }
    },
    {
      field: 'comment',
      headerName: 'Comentarios',
      width: 200
    }
  ];

  constructor() {
    // Log de acceso al componente
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Acceso a Reportes de Generadores',
      'Modulo Proyectos - Estimaciones - Reportes Generadores',
      this.trackingService.getEmail()
    );

    // Effect para cargar estimaciones cuando cambie el contrato
    effect(() => {
      const contractId = this.signalsService.getContractSelectedBySidebar()();
      if (contractId) {
        this.contract = contractId;
        this.cargarEstimaciones();
      }
    });

    // Inicializar fechas por defecto
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    
    this.fechaInicio = inicioMes.toISOString().split('T')[0];
    this.fechaFin = hoy.toISOString().split('T')[0];
  }

  cargarEstimaciones() {
    if (!this.contract) return;

    this.estimatesService.getEstimates(this.contract).subscribe({
      next: (data: any[]) => {
        this.estimaciones = data || [];
      },
      error: (error) => {
        console.error('Error al cargar estimaciones:', error);
        this.estimaciones = [];
      }
    });
  }

  onEstimacionChange() {
    if (this.estimacionSeleccionada) {
      this.generarReporte();
    }
  }

  onGeneradoresGridReady(params: GridReadyEvent) {
    this.generadoresGridApi = params.api;
  }

  onItemsGridReady(params: GridReadyEvent) {
    this.itemsGridApi = params.api;
  }

  getDataPath = (data: any) => {
    return data.orgHierarchy;
  };

  generarReporte() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Generar Reporte de Generadores',
      'Modulo Proyectos - Estimaciones - Reportes Generadores',
      this.trackingService.getEmail()
    );

    if (!this.estimacionSeleccionada) {
      alerts.basicAlert('Error', 'Debe seleccionar una estimación', 'error');
      return;
    }

    // Cargar generadores
    this.generatorsService.getGenerators(parseInt(this.estimacionSeleccionada)).subscribe({
      next: (generadores: any[]) => {
        this.procesarGeneradores(generadores);
        this.cargarItemsGeneradores(generadores);
      },
      error: (error) => {
        console.error('Error al cargar generadores:', error);
        alerts.basicAlert('Error', 'Error al cargar los generadores', 'error');
      }
    });
  }

  private procesarGeneradores(generadores: any[]) {
    // Aplicar filtros por fecha
    let generadoresFiltrados = [...generadores];

    if (this.fechaInicio) {
      generadoresFiltrados = generadoresFiltrados.filter(gen => 
        new Date(gen.dateStart) >= new Date(this.fechaInicio)
      );
    }

    if (this.fechaFin) {
      generadoresFiltrados = generadoresFiltrados.filter(gen => 
        new Date(gen.dateEnd) <= new Date(this.fechaFin)
      );
    }

    this.generadoresData = generadoresFiltrados.map(gen => ({
      ...gen,
      totalItems: 0 // Se actualizará cuando carguemos los items
    }));

    this.calcularResumen();
  }

  private async cargarItemsGeneradores(generadores: any[]) {
    const allItems = [];

    for (const generador of generadores) {
      try {
        const items = await this.generatorsService.getItemsGeneradores(generador.id).toPromise();
        
        // Agregar items al array con información del generador padre
        for (const item of items || []) {
          allItems.push({
            ...item,
            generadorId: generador.id,
            generadorNumero: generador.numero,
            orgHierarchy: [generador.numero, `Item_${item.id}`],
            nodeType: 'item'
          });
        }

        // Actualizar el conteo de items en el generador
        const genIndex = this.generadoresData.findIndex(g => g.id === generador.id);
        if (genIndex >= 0) {
          this.generadoresData[genIndex].totalItems = items?.length || 0;
        }

      } catch (error) {
        console.error(`Error cargando items para generador ${generador.id}:`, error);
      }
    }

    this.itemsData = allItems;
    this.calcularResumen();

    alerts.basicAlert('Reporte Generado', 
      `Se encontraron ${this.generadoresData.length} generadores con ${this.itemsData.length} items`, 
      'success');
  }

  private calcularResumen() {
    const totalGeneradores = this.generadoresData.length;
    const totalItems = this.itemsData.length;
    
    // Calcular rango de fechas
    let fechaMinima = null;
    let fechaMaxima = null;
    
    this.generadoresData.forEach(gen => {
      const fechaInicio = new Date(gen.dateStart);
      const fechaFin = new Date(gen.dateEnd);
      
      if (!fechaMinima || fechaInicio < fechaMinima) fechaMinima = fechaInicio;
      if (!fechaMaxima || fechaFin > fechaMaxima) fechaMaxima = fechaFin;
    });

    // Agrupar por área/fase
    const areaCount = {};
    this.generadoresData.forEach(gen => {
      const area = gen.fase || 'Sin Área';
      areaCount[area] = (areaCount[area] || 0) + 1;
    });

    const porArea = Object.keys(areaCount).map(key => ({
      fase: key,
      cantidad: areaCount[key]
    }));

    this.resumenData = {
      totalGeneradores,
      totalItems,
      promedioItems: totalGeneradores > 0 ? totalItems / totalGeneradores : 0,
      rangoFechas: fechaMinima && fechaMaxima ? 
        `${fechaMinima.toLocaleDateString('es-ES')} - ${fechaMaxima.toLocaleDateString('es-ES')}` : 
        'No disponible',
      porArea
    };
  }

  exportarExcel() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Exportar Reporte Generadores a Excel',
      'Modulo Proyectos - Estimaciones - Reportes Generadores',
      this.trackingService.getEmail()
    );

    const gridApi = this.activeTab === 'generadores' ? this.generadoresGridApi : this.itemsGridApi;
    
    if (gridApi) {
      gridApi.exportDataAsExcel({
        fileName: `Reporte_Generadores_${this.activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`
      });
    }
  }

  exportarPDF() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Exportar Reporte Generadores a PDF',
      'Modulo Proyectos - Estimaciones - Reportes Generadores',
      this.trackingService.getEmail()
    );

    alerts.basicAlert('Funcionalidad', 'Exportar PDF próximamente disponible', 'info');
  }

  verGraficos() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Ver Gráficos de Generadores',
      'Modulo Proyectos - Estimaciones - Reportes Generadores',
      this.trackingService.getEmail()
    );

    this.showGraficos = true;
  }

  cerrarGraficos() {
    this.showGraficos = false;
  }
}