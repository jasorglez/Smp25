import { Component, OnInit } from '@angular/core';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DetailCellRendererProveedoresComponent } from './details/detail-cell-renderer-proveedores.component';
import { DetailCellRendererFamiliaComponent } from './details/detail-cell-renderer-familia.component';

@Component({
  selector: 'app-materiales-maestro',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridModule,
    DetailCellRendererProveedoresComponent,
    DetailCellRendererFamiliaComponent
  ],
  templateUrl: './materiales-maestro.component.html',
  styleUrl: './materiales-maestro.component.scss'
})
export class MaterialesMaestroComponent implements OnInit {

  private gridApi!: GridApi;

  rowData: any[] = [];
  gridHeight: string = '80vh';

  public rowSelection: 'single' | 'multiple' = 'single';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
    this.cargarDatosFalsos();
  }

  cargarDatosFalsos() {
    // Data falsa con 3 registros principales
    this.rowData = [
      {
        id: 1,
        activo: true,
        numMat: 'MAT-001',
        articulo: 'Tornillo Hexagonal 1/2"',
        categoria: 'Ferretería',
        familia: 'Tornillería',
        subfamilia: 'Hexagonales',
        proveedor: 'Tornillos SA de CV',
        imagen: '📷',
        fieldProveedores: 2,
        fieldFamilia: 3,
        proveedoresData: [
          {
            id: 101,
            nombreProveedor: 'Tornillos SA de CV',
            contacto: 'Juan Pérez',
            telefono: '555-1234',
            email: 'ventas@tornillos.com',
            precioUnitario: 2.50,
            tiempoEntrega: '5 días'
          },
          {
            id: 102,
            nombreProveedor: 'Ferretería del Norte',
            contacto: 'María García',
            telefono: '555-5678',
            email: 'info@ferrenorte.com',
            precioUnitario: 2.30,
            tiempoEntrega: '3 días'
          }
        ],
        familiaData: [
          {
            id: 1001,
            subfamilia: 'Hexagonales',
            codigo: 'HEX-001',
            descripcion: 'Tornillos hexagonales estándar',
            unidadMedida: 'Pieza',
            stockMinimo: 100,
            stockMaximo: 1000
          },
          {
            id: 1002,
            subfamilia: 'Hexagonales Inoxidables',
            codigo: 'HEX-002',
            descripcion: 'Tornillos hexagonales acero inoxidable',
            unidadMedida: 'Pieza',
            stockMinimo: 50,
            stockMaximo: 500
          },
          {
            id: 1003,
            subfamilia: 'Hexagonales Galvanizados',
            codigo: 'HEX-003',
            descripcion: 'Tornillos hexagonales galvanizados',
            unidadMedida: 'Pieza',
            stockMinimo: 75,
            stockMaximo: 750
          }
        ]
      },
      {
        id: 2,
        activo: true,
        numMat: 'MAT-002',
        articulo: 'Cemento Portland Gris 50kg',
        categoria: 'Construcción',
        familia: 'Cemento',
        subfamilia: 'Portland',
        proveedor: 'Cementos Mexicanos',
        imagen: '📷',
        fieldProveedores: 1,
        fieldFamilia: 2,
        proveedoresData: [
          {
            id: 201,
            nombreProveedor: 'Cementos Mexicanos',
            contacto: 'Carlos Rodríguez',
            telefono: '555-9876',
            email: 'ventas@cemex.com',
            precioUnitario: 180.00,
            tiempoEntrega: '1 día'
          }
        ],
        familiaData: [
          {
            id: 2001,
            subfamilia: 'Portland Gris',
            codigo: 'CEM-001',
            descripcion: 'Cemento Portland tipo I gris',
            unidadMedida: 'Bulto 50kg',
            stockMinimo: 200,
            stockMaximo: 2000
          },
          {
            id: 2002,
            subfamilia: 'Portland Blanco',
            codigo: 'CEM-002',
            descripcion: 'Cemento Portland tipo I blanco',
            unidadMedida: 'Bulto 50kg',
            stockMinimo: 100,
            stockMaximo: 1000
          }
        ]
      },
      {
        id: 3,
        activo: false,
        numMat: 'MAT-003',
        articulo: 'Cable Eléctrico Cal 12 AWG',
        categoria: 'Eléctrico',
        familia: 'Cables',
        subfamilia: 'Conductores',
        proveedor: 'Distribuidora Eléctrica',
        imagen: '📷',
        fieldProveedores: 2,
        fieldFamilia: 4,
        proveedoresData: [
          {
            id: 301,
            nombreProveedor: 'Distribuidora Eléctrica',
            contacto: 'Luis Martínez',
            telefono: '555-4321',
            email: 'contacto@diselec.com',
            precioUnitario: 15.50,
            tiempoEntrega: '2 días'
          },
          {
            id: 302,
            nombreProveedor: 'Cables y Más',
            contacto: 'Ana López',
            telefono: '555-8765',
            email: 'ventas@cablesymas.com',
            precioUnitario: 14.80,
            tiempoEntrega: '4 días'
          }
        ],
        familiaData: [
          {
            id: 3001,
            subfamilia: 'Conductores Cobre',
            codigo: 'CAB-001',
            descripcion: 'Cable conductor de cobre calibre 12',
            unidadMedida: 'Metro',
            stockMinimo: 500,
            stockMaximo: 5000
          },
          {
            id: 3002,
            subfamilia: 'Conductores Aluminio',
            codigo: 'CAB-002',
            descripcion: 'Cable conductor de aluminio calibre 12',
            unidadMedida: 'Metro',
            stockMinimo: 300,
            stockMaximo: 3000
          },
          {
            id: 3003,
            subfamilia: 'Conductores Flexibles',
            codigo: 'CAB-003',
            descripcion: 'Cable conductor flexible calibre 12',
            unidadMedida: 'Metro',
            stockMinimo: 400,
            stockMaximo: 4000
          },
          {
            id: 3004,
            subfamilia: 'Conductores Blindados',
            codigo: 'CAB-004',
            descripcion: 'Cable conductor blindado calibre 12',
            unidadMedida: 'Metro',
            stockMinimo: 200,
            stockMaximo: 2000
          }
        ]
      }
    ];
  }

  components = {
    detailCellRendererProveedores: DetailCellRendererProveedoresComponent,
    detailCellRendererFamilia: DetailCellRendererFamiliaComponent
  };

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    suppressClickEdit: true,
    singleClickEdit: false,
    stopEditingWhenCellsLoseFocus: true,
    masterDetail: true,
    isRowMaster: (dataItem) => {
      return true; // Todas las filas son maestras
    },
    detailCellRendererSelector: (params) => {
      if (params.data.detailType === 'proveedores') {
        return { component: 'detailCellRendererProveedores' };
      } else if (params.data.detailType === 'familia') {
        return { component: 'detailCellRendererFamilia' };
      }
      return undefined;
    },
    getRowClass: (params: any) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onRowSelected: (event) => {
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    }
  };

  get colMaster(): ColDef[] {
    return [
      {
        field: 'activo',
        headerName: 'Activo',
        width: 100,
        cellRenderer: (params: any) => {
          const checked = params.data.activo ? 'checked' : '';
          return `<input type="checkbox" ${checked} disabled style="cursor: pointer;">`;
        }
      },
      {
        field: 'numMat',
        headerName: 'Num Mat',
        width: 130,
        filter: true
      },
      {
        field: 'articulo',
        headerName: 'Artículo',
        width: 250,
        filter: true
      },
      {
        field: 'categoria',
        headerName: 'Categoría',
        width: 150,
        filter: true
      },
      {
        field: 'familia',
        headerName: 'Familia',
        width: 150,
        filter: true,
        cellRenderer: this.createDetailToggleCellRenderer('familia'),
        cellStyle: { backgroundColor: '#fff3e0', cursor: 'pointer', textDecoration: 'underline' }
      },
      {
        field: 'subfamilia',
        headerName: 'Subfamilia',
        width: 150,
        filter: true
      },
      {
        field: 'proveedor',
        headerName: 'Proveedor',
        width: 200,
        filter: true
      },
      {
        field: 'imagen',
        headerName: 'Imagen',
        width: 100,
        cellRenderer: (params: any) => {
          return params.value ? '📷 Ver' : '📷 Subir';
        }
      },
      {
        field: 'fieldProveedores',
        headerName: 'Ver Proveedores',
        width: 150,
        cellRenderer: this.createDetailToggleCellRenderer('proveedores'),
        cellStyle: { backgroundColor: '#e3f2fd', cursor: 'pointer', textDecoration: 'underline' },
        editable: false
      }
    ];
  }

  // Función auxiliar para obtener el tipo de detalle desde el ID de la columna
  getDetailTypeFromColId(colId: string): string | null {
    if (colId === 'fieldProveedores') return 'proveedores';
    if (colId === 'familia') return 'familia';
    return null;
  }

  createDetailToggleCellRenderer(detailType: string): (params: any) => HTMLElement {
    return (params: any): HTMLElement => {
      const div = document.createElement('div');

      switch (detailType) {
        case 'proveedores':
          div.innerText = `Ver (${params.data.fieldProveedores})`;
          break;
        case 'familia':
          div.innerText = params.value || '';
          break;
      }

      div.style.cursor = 'pointer';
      div.style.textDecoration = 'underline';

      return div;
    };
  }

  onCellClicked(event: any): void {
    event.node.setSelected(true);

    const colId = event.column.getColId();
    const isDetailColumn = colId === 'fieldProveedores' || colId === 'familia';

    if (isDetailColumn) {
      const node = event.node;
      const api = event.api;
      const detailType = this.getDetailTypeFromColId(colId);

      // Determinar si la fila actual ya está expandida CON ESTE MISMO tipo de detalle
      const isCurrentlyExpanded = node.expanded && event.data.detailType === detailType;

      // Colapsar cualquier otra fila que esté expandida
      api.forEachNode((otherNode: any) => {
        if (otherNode.expanded && otherNode.id !== node.id) {
          otherNode.setExpanded(false);
        }
      });

      if (isCurrentlyExpanded) {
        // Si se hace clic en la misma celda que ya está abierta, se cierra y se limpia el filtro
        node.setExpanded(false);
        api.setFilterModel(null);
        api.onFilterChanged();
      } else {
        // Si se hace clic en una celda diferente (o la fila está cerrada)

        // Limpiar filtro antes de aplicar uno nuevo
        api.setFilterModel(null);

        // Aplicar filtro por ID para enfocar la fila actual
        const filterModel = {
          id: { filterType: 'number', type: 'equals', filter: event.data.id },
        };
        api.setFilterModel(filterModel);

        // Expandir la fila con el detalle correcto
        event.data.detailType = detailType;
        node.setExpanded(true);
      }
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }
}
