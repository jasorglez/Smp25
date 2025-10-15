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
            subfamilia: 'Hexagonales',
            sabor: 'N/A',
            presentacion: 'Caja 100 pzas',
            descripcion: 'Tornillos hexagonales estándar para uso general'
          },
          {
            id: 1002,
            consecutivo: 2,
            subfamilia: 'Hexagonales',
            sabor: 'N/A',
            presentacion: 'Caja 50 pzas',
            descripcion: 'Tornillos hexagonales de acero inoxidable para ambientes húmedos'
          },
          {
            id: 1003,
            consecutivo: 3,
            subfamilia: 'Hexagonales',
            sabor: 'N/A',
            presentacion: 'Bolsa 200 pzas',
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
            subfamilia: 'Portland',
            sabor: 'N/A',
            presentacion: 'Saco 50kg',
            descripcion: 'Cemento Portland tipo I gris para construcción general'
          },
          {
            id: 2002,
            consecutivo: 2,
            subfamilia: 'Portland',
            sabor: 'N/A',
            presentacion: 'Saco 25kg',
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
            subfamilia: 'Conductores',
            sabor: 'N/A',
            presentacion: 'Rollo 100m',
            descripcion: 'Cable conductor de cobre calibre 12 para instalaciones eléctricas residenciales'
          },
          {
            id: 3002,
            consecutivo: 2,
            subfamilia: 'Conductores',
            sabor: 'N/A',
            presentacion: 'Rollo 50m',
            descripcion: 'Cable conductor de aluminio calibre 12 para instalaciones comerciales'
          },
          {
            id: 3003,
            consecutivo: 3,
            subfamilia: 'Conductores',
            sabor: 'N/A',
            presentacion: 'Rollo 25m',
            descripcion: 'Cable conductor flexible calibre 12 para equipos móviles'
          },
          {
            id: 3004,
            consecutivo: 4,
            subfamilia: 'Conductores',
            sabor: 'N/A',
            presentacion: 'Carrete 500m',
            descripcion: 'Cable conductor blindado calibre 12 para ambientes industriales'
          }
        ]
      },
      {
        id: 4,
        activo: true,
        numMat: 'MAT-004',
        articulo: 'Refresco Embotellado',
        categoria: 'Alimentos y Bebidas',
        familia: 'Bebidas',
        subfamilia: 'Refrescos',
        proveedor: 'Embotelladora del Valle',
        imagen: '📷',
        proveedoresData: [
          {
            id: 401,
            nombreProveedor: 'Embotelladora del Valle',
            precioUnitario: 12.50,
            descripcionEmpaque: 'Caja de cartón',
            piezasPorPaquete: 24,
            medidas: '600ml',
            pesoVolumen: '15 kg',
            caducidadGarantia: '6 meses',
            sucursal: 'Monterrey Centro'
          }
        ],
        familiaData: [
          {
            id: 4001,
            consecutivo: 1,
            subfamilia: 'Refrescos',
            sabor: 'Cola',
            presentacion: 'Botella 600ml',
            descripcion: 'Refresco de cola carbonatado sabor original'
          },
          {
            id: 4002,
            consecutivo: 2,
            subfamilia: 'Refrescos',
            sabor: 'Naranja',
            presentacion: 'Botella 600ml',
            descripcion: 'Refresco de naranja carbonatado con jugo natural'
          },
          {
            id: 4003,
            consecutivo: 3,
            subfamilia: 'Refrescos',
            sabor: 'Limón',
            presentacion: 'Botella 355ml',
            descripcion: 'Refresco de limón carbonatado light sin azúcar'
          },
          {
            id: 4004,
            consecutivo: 4,
            subfamilia: 'Refrescos',
            sabor: 'Fresa',
            presentacion: 'Lata 355ml',
            descripcion: 'Refresco de fresa carbonatado sabor artificial'
          }
        ]
      },
      {
        id: 5,
        activo: true,
        numMat: 'MAT-005',
        articulo: 'Galletas Dulces',
        categoria: 'Alimentos y Bebidas',
        familia: 'Botanas',
        subfamilia: 'Galletas',
        proveedor: 'Galletas y Más SA',
        imagen: '📷',
        proveedoresData: [
          {
            id: 501,
            nombreProveedor: 'Galletas y Más SA',
            precioUnitario: 18.00,
            descripcionEmpaque: 'Caja display',
            piezasPorPaquete: 20,
            medidas: '180g',
            pesoVolumen: '3.6 kg',
            caducidadGarantia: '8 meses',
            sucursal: 'Guadalajara Centro'
          }
        ],
        familiaData: [
          {
            id: 5001,
            consecutivo: 1,
            subfamilia: 'Galletas',
            sabor: 'Chocolate',
            presentacion: 'Paquete 180g',
            descripcion: 'Galletas con chispas de chocolate semiamargo'
          },
          {
            id: 5002,
            consecutivo: 2,
            subfamilia: 'Galletas',
            sabor: 'Vainilla',
            presentacion: 'Paquete 200g',
            descripcion: 'Galletas de vainilla con crema tipo sandwich'
          },
          {
            id: 5003,
            consecutivo: 3,
            subfamilia: 'Galletas',
            sabor: 'Avena y Miel',
            presentacion: 'Paquete 150g',
            descripcion: 'Galletas de avena integral endulzadas con miel'
          }
        ]
      },
      {
        id: 6,
        activo: true,
        numMat: 'MAT-006',
        articulo: 'Yogurt Natural',
        categoria: 'Alimentos y Bebidas',
        familia: 'Lácteos',
        subfamilia: 'Yogurt',
        proveedor: 'Lácteos del Norte',
        imagen: '📷',
        proveedoresData: [
          {
            id: 601,
            nombreProveedor: 'Lácteos del Norte',
            precioUnitario: 25.00,
            descripcionEmpaque: 'Charola de cartón',
            piezasPorPaquete: 12,
            medidas: '1 litro',
            pesoVolumen: '12.5 kg',
            caducidadGarantia: '30 días',
            sucursal: 'Querétaro Norte'
          }
        ],
        familiaData: [
          {
            id: 6001,
            consecutivo: 1,
            subfamilia: 'Yogurt',
            sabor: 'Natural',
            presentacion: 'Envase 1L',
            descripcion: 'Yogurt natural sin azúcar añadida'
          },
          {
            id: 6002,
            consecutivo: 2,
            subfamilia: 'Yogurt',
            sabor: 'Fresa',
            presentacion: 'Envase 1L',
            descripcion: 'Yogurt con sabor a fresa con trozos de fruta'
          },
          {
            id: 6003,
            consecutivo: 3,
            subfamilia: 'Yogurt',
            sabor: 'Durazno',
            presentacion: 'Envase 500ml',
            descripcion: 'Yogurt con sabor a durazno bajo en grasa'
          },
          {
            id: 6004,
            consecutivo: 4,
            subfamilia: 'Yogurt',
            sabor: 'Arándano',
            presentacion: 'Envase 250ml',
            descripcion: 'Yogurt griego con arándanos naturales'
          },
          {
            id: 6005,
            consecutivo: 5,
            subfamilia: 'Yogurt',
            sabor: 'Mango',
            presentacion: 'Envase 1L',
            descripcion: 'Yogurt con pulpa de mango tropical'
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
