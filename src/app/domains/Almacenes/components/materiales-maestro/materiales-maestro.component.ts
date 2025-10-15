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
        proveedoresData: [
          {
            id: 101,
            nombreProveedor: 'Tornillos SA de CV',
            precioUnitario: 2.50,
            descripcionEmpaque: 'Caja de cartón',
            piezasPorPaquete: 100,
            medidas: '1/2" x 3"',
            pesoVolumen: '2.5 kg',
            caducidadGarantia: 'N/A',
            sucursal: 'Monterrey Centro'
          },
          {
            id: 102,
            nombreProveedor: 'Ferretería del Norte',
            precioUnitario: 2.30,
            descripcionEmpaque: 'Bolsa plástica',
            piezasPorPaquete: 50,
            medidas: '1/2" x 3"',
            pesoVolumen: '1.2 kg',
            caducidadGarantia: 'N/A',
            sucursal: 'Guadalajara Sur'
          }
        ],
        familiaData: [
          {
            id: 1001,
            consecutivo: 1,
            descripcion: 'Tornillos hexagonales estándar para uso general'
          },
          {
            id: 1002,
            consecutivo: 2,
            descripcion: 'Tornillos hexagonales de acero inoxidable para ambientes húmedos'
          },
          {
            id: 1003,
            consecutivo: 3,
            descripcion: 'Tornillos hexagonales galvanizados para exteriores'
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
        proveedoresData: [
          {
            id: 201,
            nombreProveedor: 'Cementos Mexicanos',
            precioUnitario: 180.00,
            descripcionEmpaque: 'Saco de papel kraft',
            piezasPorPaquete: 1,
            medidas: '50 x 30 x 15 cm',
            pesoVolumen: '50 kg',
            caducidadGarantia: '6 meses',
            sucursal: 'Ciudad de México Norte'
          },
          {
            id: 202,
            nombreProveedor: 'Cementos Mexicanos',
            precioUnitario: 175.00,
            descripcionEmpaque: 'Saco de papel kraft',
            piezasPorPaquete: 1,
            medidas: '50 x 30 x 15 cm',
            pesoVolumen: '50 kg',
            caducidadGarantia: '6 meses',
            sucursal: 'Querétaro Este'
          }
        ],
        familiaData: [
          {
            id: 2001,
            consecutivo: 1,
            descripcion: 'Cemento Portland tipo I gris para construcción general'
          },
          {
            id: 2002,
            consecutivo: 2,
            descripcion: 'Cemento Portland tipo I blanco para acabados finos'
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
        proveedoresData: [
          {
            id: 301,
            nombreProveedor: 'Distribuidora Eléctrica',
            precioUnitario: 15.50,
            descripcionEmpaque: 'Rollo',
            piezasPorPaquete: 100,
            medidas: 'Cal. 12 AWG',
            pesoVolumen: '8.5 kg/100m',
            caducidadGarantia: '10 años',
            sucursal: 'Puebla Centro'
          },
          {
            id: 302,
            nombreProveedor: 'Cables y Más',
            precioUnitario: 14.80,
            descripcionEmpaque: 'Rollo',
            piezasPorPaquete: 100,
            medidas: 'Cal. 12 AWG',
            pesoVolumen: '8.3 kg/100m',
            caducidadGarantia: '10 años',
            sucursal: 'León Norte'
          },
          {
            id: 303,
            nombreProveedor: 'Distribuidora Eléctrica',
            precioUnitario: 16.00,
            descripcionEmpaque: 'Carrete',
            piezasPorPaquete: 500,
            medidas: 'Cal. 12 AWG',
            pesoVolumen: '42 kg/500m',
            caducidadGarantia: '10 años',
            sucursal: 'Tijuana Oeste'
          }
        ],
        familiaData: [
          {
            id: 3001,
            consecutivo: 1,
            descripcion: 'Cable conductor de cobre calibre 12 para instalaciones eléctricas residenciales'
          },
          {
            id: 3002,
            consecutivo: 2,
            descripcion: 'Cable conductor de aluminio calibre 12 para instalaciones comerciales'
          },
          {
            id: 3003,
            consecutivo: 3,
            descripcion: 'Cable conductor flexible calibre 12 para equipos móviles'
          },
          {
            id: 3004,
            consecutivo: 4,
            descripcion: 'Cable conductor blindado calibre 12 para ambientes industriales'
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
        filter: true,
        cellRenderer: this.createDetailToggleCellRenderer('proveedores'),
        cellStyle: { backgroundColor: '#e3f2fd', cursor: 'pointer', textDecoration: 'underline' }
      },
      {
        field: 'imagen',
        headerName: 'Imagen',
        width: 100,
        cellRenderer: (params: any) => {
          return params.value ? '📷 Ver' : '📷 Subir';
        }
      }
    ];
  }

  // Función auxiliar para obtener el tipo de detalle desde el ID de la columna
  getDetailTypeFromColId(colId: string): string | null {
    if (colId === 'proveedor') return 'proveedores';
    if (colId === 'familia') return 'familia';
    return null;
  }

  createDetailToggleCellRenderer(detailType: string): (params: any) => HTMLElement {
    return (params: any): HTMLElement => {
      const div = document.createElement('div');

      switch (detailType) {
        case 'proveedores':
          div.innerText = params.value || '';
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
    const isDetailColumn = colId === 'proveedor' || colId === 'familia';

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
