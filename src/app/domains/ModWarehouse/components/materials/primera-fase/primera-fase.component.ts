import { Component } from '@angular/core';
import { MaterialsBaseComponent } from '../base/materials-base.component';
import { ColDef } from 'ag-grid-enterprise';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { PriceProductsPresentationsComponent } from '../components/price-products-presentations/price-products-presentations.component';
import { ProvedoorByBranchComponent } from '../components/ProvedoorByBranch/ProvedoorByBranch.component';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';

@Component({
  selector: 'app-primera-fase',
  standalone: true,
  imports: [
    AutocompleteEditorComponent,
    CommonModule,
    FormsModule,
    AgGridModule,
    MultiLineEditorComponent,
    PriceProductsPresentationsComponent,
    ProvedoorByBranchComponent
  ],
  templateUrl: './primera-fase.component.html',
  styleUrl: './primera-fase.component.scss',
})
export class PrimeraFaseComponent extends MaterialsBaseComponent {

  private _columnDefs: ColDef[] | null = null;
  private _gridOptions: any = null;

  getType(): string {
    return 'PRIMERA_FASE';
  }

  getColumnDefs(): ColDef[] {
    if (this._columnDefs) {
      return this._columnDefs;
    }

    this._columnDefs = [
      {
        field: 'articulo',
        headerName: 'Artículo',
        editable: true,
        width: 250,
        flex: 1
      },
      {
        field: 'fase',
        headerName: 'Fase',
        editable: true,
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Primera', 'Segunda']
        }
      },
      {
        field: 'materiales',
        headerName: 'Materiales',
        editable: false,
        width: 150,
        cellStyle: { backgroundColor: '#e1f5fe', cursor: 'pointer', textDecoration: 'underline' },
        cellRenderer: (params: any) => {
          const count = params.data.materialesData ? params.data.materialesData.length : 0;
          const div = document.createElement('div');
          div.innerText = `${count} materiales`;
          div.style.cursor = 'pointer';
          div.style.textDecoration = 'underline';
          return div;
        }
      },
      {
        field: 'costoFinal',
        headerName: 'Costo Final',
        editable: true,
        width: 130,
        valueFormatter: (params) => {
          return params.value ? `$${params.value.toFixed(2)}` : '$0.00';
        }
      },
      {
        field: 'fechaCambio',
        headerName: 'Fecha Cambio',
        editable: true,
        width: 130,
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        }
      },
      {
        field: 'numArticulo',
        headerName: 'Num Artículo',
        editable: true,
        width: 130
      },
      {
        field: 'parametros',
        headerName: 'Parámetros',
        editable: false,
        width: 150,
        cellStyle: { backgroundColor: '#fff9c4', cursor: 'pointer', textDecoration: 'underline' },
        cellRenderer: (params: any) => {
          const div = document.createElement('div');
          div.innerText = 'Parámetros';
          div.style.cursor = 'pointer';
          div.style.textDecoration = 'underline';
          return div;
        }
      }
    ];

    return this._columnDefs;
  }

  getGridOptions(): any {
    if (this._gridOptions) {
      return this._gridOptions;
    }

    this._gridOptions = {
      headerHeight: 25,
      rowHeight: 20,
      masterDetail: true,
      isRowMaster: (dataItem: any) => {
        return dataItem.historicoData && dataItem.historicoData.length > 0;
      },
      detailCellRendererSelector: (params: any) => {
        if (params.data.detailType === 'historico') {
          return { component: 'detailCellRendererHistorico' };
        }
        if (params.data.detailType === 'materiales') {
          return { component: 'detailCellRendererMateriales' };
        }
        if (params.data.detailType === 'parametros') {
          return { component: 'detailCellRendererParametros' };
        }
        return undefined;
      },
      getRowClass: (params) => {
        if (params.node.isSelected()) {
          return 'selected-row';
        }
        return '';
      },
      onRowClicked: (event) => {
        event.node.setSelected(true);
      },
      onRowSelected: (event) => {
        if (event.node.isSelected()) {
          this.gridApi.forEachNode((node) => {
            if (node.id !== event.node.id) {
              node.setSelected(false);
            }
          });
        }
      },
      onCellClicked: this.onCellClicked.bind(this),
    };

    return this._gridOptions;
  }

  override onCellClicked(event: any): void {
    const colId = event.column.getColId();

    // Solo para columnas clickeables
    if (colId === 'historico' || colId === 'materiales' || colId === 'parametros') {
      const node = event.node;
      const api = event.api;

      // Determinar el tipo de detalle según la columna
      let detailType = '';
      if (colId === 'historico') detailType = 'historico';
      if (colId === 'materiales') detailType = 'materiales';
      if (colId === 'parametros') detailType = 'parametros';

      // Verificar si ya está expandido con este mismo tipo de detalle
      const isCurrentlyExpanded = node.expanded && event.data.detailType === detailType;

      if (isCurrentlyExpanded) {
        // Si ya está expandido, colapsarlo y mostrar todas las filas
        node.setExpanded(false);

        // Mostrar todas las filas de nuevo
        api.forEachNode((otherNode: any) => {
          otherNode.setRowHeight(undefined);
        });
        api.onRowHeightChanged();
      } else {
        // Colapsar cualquier otra fila expandida
        api.forEachNode((otherNode: any) => {
          if (otherNode.expanded && otherNode.id !== node.id) {
            otherNode.setExpanded(false);
          }
        });

        // Ocultar todas las demás filas (altura 0)
        api.forEachNode((otherNode: any) => {
          if (otherNode.id !== node.id) {
            otherNode.setRowHeight(0);
          }
        });

        // Si la fila está expandida con otro tipo de detalle, cerrarla primero
        if (node.expanded && event.data.detailType !== detailType) {
          node.setExpanded(false);
        }

        // Asignar el tipo de detalle
        event.data.detailType = detailType;

        // Aplicar los cambios de altura
        api.onRowHeightChanged();

        // Expandir con el detalle correspondiente
        setTimeout(() => {
          node.setExpanded(true);
        }, 0);
      }
    }
  }

  override obtenerDatos(): any {
    // Datos fake para Primera Fase
    this.rowData = [
      {
        id: 1,
        articulo: 'Salsa Picante Premium',
        fase: 'Primera',
        costoFinal: 1887.77,
        fechaCambio: '2025-01-15T00:00:00',
        numArticulo: 'ART-001',
        materialesData: [
          {
            id: 101,
            materiales: 'Chile Habanero',
            costo: 125.50,
            cantidad: '15.5 KG',
            proporcion: '25%',
            checkBox: true,
            costoTotal: 1850.75,
            merma: '0.31 KG (2%)'
          },
          {
            id: 102,
            materiales: 'Vinagre Blanco',
            costo: 45.00,
            cantidad: '5.0 LTS',
            proporcion: '10%',
            checkBox: true,
            costoTotal: 225.00,
            merma: '0.10 LTS (2%)'
          },
          {
            id: 103,
            materiales: 'Sal Marina',
            costo: 12.50,
            cantidad: '2.0 KG',
            proporcion: '5%',
            checkBox: false,
            costoTotal: 25.00,
            merma: '0.04 KG (2%)'
          },
          {
            id: 104,
            materiales: 'Especias Mix',
            costo: 85.00,
            cantidad: '1.5 KG',
            proporcion: '3%',
            checkBox: true,
            costoTotal: 127.50,
            merma: '0.03 KG (2%)'
          }
        ],
        parametrosData: [
          {
            id: 1001,
            parametros: 'Temperatura',
            minimo: '4°C',
            objetivo: '6°C',
            maximo: '8°C'
          },
          {
            id: 1002,
            parametros: 'pH',
            minimo: '3.5',
            objetivo: '3.8',
            maximo: '4.0'
          },
          {
            id: 1003,
            parametros: 'Viscosidad',
            minimo: '500 cP',
            objetivo: '600 cP',
            maximo: '700 cP'
          }
        ],
        historicoData: [
          {
            materialPrimeraFase: 'Salsa Picante Premium',
            materiaPrimaBasica: 'Chile Habanero',
            costo: 125.50,
            cantidadLtsKg: '15.5 KG',
            costoTotal: 1850.75,
            productoMermaLtsKg: '0.31 KG',
            porcentajeMerma: '2.00%',
            costoFinal: 1887.77,
            fechaCambio: '2025-01-15T00:00:00',
            asignado: true
          },
          {
            materialPrimeraFase: 'Salsa Picante Premium',
            materiaPrimaBasica: 'Chile Habanero',
            costo: 120.00,
            cantidadLtsKg: '15.5 KG',
            costoTotal: 1767.50,
            productoMermaLtsKg: '0.31 KG',
            porcentajeMerma: '2.00%',
            costoFinal: 1803.05,
            fechaCambio: '2024-12-10T00:00:00',
            asignado: false
          },
          {
            materialPrimeraFase: 'Salsa Picante Premium',
            materiaPrimaBasica: 'Chile Habanero',
            costo: 115.75,
            cantidadLtsKg: '15.0 KG',
            costoTotal: 1702.50,
            productoMermaLtsKg: '0.30 KG',
            porcentajeMerma: '2.00%',
            costoFinal: 1736.55,
            fechaCambio: '2024-11-20T00:00:00',
            asignado: false
          },
          {
            materialPrimeraFase: 'Salsa Picante Premium',
            materiaPrimaBasica: 'Chile Habanero',
            costo: 110.00,
            cantidadLtsKg: '14.5 KG',
            costoTotal: 1620.00,
            productoMermaLtsKg: '0.29 KG',
            porcentajeMerma: '2.00%',
            costoFinal: 1652.40,
            fechaCambio: '2024-10-15T00:00:00',
            asignado: false
          }
        ]
      },
      {
        id: 2,
        articulo: 'Base Chocolate Obscuro',
        fase: 'Primera',
        costoFinal: 3315.61,
        fechaCambio: '2025-01-10T00:00:00',
        numArticulo: 'ART-002',
        materialesData: [
          {
            id: 201,
            materiales: 'Cacao en Polvo',
            costo: 285.00,
            cantidad: '22.8 KG',
            proporcion: '45%',
            checkBox: true,
            costoTotal: 3250.60,
            merma: '0.46 KG (2%)'
          },
          {
            id: 202,
            materiales: 'Azúcar Refinada',
            costo: 65.00,
            cantidad: '18.0 KG',
            proporcion: '35%',
            checkBox: true,
            costoTotal: 1170.00,
            merma: '0.36 KG (2%)'
          },
          {
            id: 203,
            materiales: 'Leche en Polvo',
            costo: 120.00,
            cantidad: '8.0 KG',
            proporcion: '15%',
            checkBox: true,
            costoTotal: 960.00,
            merma: '0.16 KG (2%)'
          },
          {
            id: 204,
            materiales: 'Vainilla',
            costo: 95.00,
            cantidad: '0.5 KG',
            proporcion: '1%',
            checkBox: true,
            costoTotal: 47.50,
            merma: '0.01 KG (2%)'
          },
          {
            id: 205,
            materiales: 'Lecitina de Soya',
            costo: 55.00,
            cantidad: '1.0 KG',
            proporcion: '2%',
            checkBox: false,
            costoTotal: 55.00,
            merma: '0.02 KG (2%)'
          },
          {
            id: 206,
            materiales: 'Sal',
            costo: 8.00,
            cantidad: '0.8 KG',
            proporcion: '2%',
            checkBox: true,
            costoTotal: 6.40,
            merma: '0.02 KG (2%)'
          },
          {
            id: 207,
            materiales: 'Manteca de Cacao',
            costo: 340.00,
            cantidad: '4.5 KG',
            proporcion: '9%',
            checkBox: true,
            costoTotal: 1530.00,
            merma: '0.09 KG (2%)'
          },
          {
            id: 208,
            materiales: 'Esencia de Chocolate',
            costo: 180.00,
            cantidad: '0.3 KG',
            proporcion: '0.5%',
            checkBox: false,
            costoTotal: 54.00,
            merma: '0.01 KG (2%)'
          },
          {
            id: 209,
            materiales: 'Emulsificante E476',
            costo: 210.00,
            cantidad: '0.6 KG',
            proporcion: '1.5%',
            checkBox: true,
            costoTotal: 126.00,
            merma: '0.01 KG (2%)'
          }
        ],
        parametrosData: [
          {
            id: 2001,
            parametros: 'Temperatura',
            minimo: '18°C',
            objetivo: '20°C',
            maximo: '22°C'
          },
          {
            id: 2002,
            parametros: 'Humedad',
            minimo: '40%',
            objetivo: '45%',
            maximo: '50%'
          },
          {
            id: 2003,
            parametros: 'Tiempo Mezclado',
            minimo: '15 min',
            objetivo: '20 min',
            maximo: '25 min'
          }
        ],
        historicoData: [
          {
            materialPrimeraFase: 'Base Chocolate Obscuro',
            materiaPrimaBasica: 'Cacao en Polvo',
            costo: 285.00,
            cantidadLtsKg: '22.8 KG',
            costoTotal: 3250.60,
            productoMermaLtsKg: '0.46 KG',
            porcentajeMerma: '2.00%',
            costoFinal: 3315.61,
            fechaCambio: '2025-01-10T00:00:00',
            asignado: true
          },
          {
            materialPrimeraFase: 'Base Chocolate Obscuro',
            materiaPrimaBasica: 'Cacao en Polvo',
            costo: 275.00,
            cantidadLtsKg: '22.8 KG',
            costoTotal: 3135.00,
            productoMermaLtsKg: '0.46 KG',
            porcentajeMerma: '2.00%',
            costoFinal: 3197.70,
            fechaCambio: '2024-12-01T00:00:00',
            asignado: false
          },
          {
            materialPrimeraFase: 'Base Chocolate Obscuro',
            materiaPrimaBasica: 'Cacao en Polvo',
            costo: 265.00,
            cantidadLtsKg: '22.0 KG',
            costoTotal: 2987.50,
            productoMermaLtsKg: '0.44 KG',
            porcentajeMerma: '2.00%',
            costoFinal: 3047.25,
            fechaCambio: '2024-10-15T00:00:00',
            asignado: false
          }
        ]
      },
      {
        id: 3,
        articulo: 'Aderezo Ranch Especial',
        fase: 'Segunda',
        costoFinal: 1449.22,
        fechaCambio: '2025-01-12T00:00:00',
        numArticulo: 'ART-003',
        materialesData: [
          {
            id: 301,
            materiales: 'Crema Ácida',
            costo: 98.75,
            cantidad: '12.0 LTS',
            proporcion: '35%',
            checkBox: true,
            costoTotal: 1420.80,
            merma: '0.24 LTS (2%)'
          },
          {
            id: 302,
            materiales: 'Mayonesa',
            costo: 75.00,
            cantidad: '8.0 LTS',
            proporcion: '25%',
            checkBox: true,
            costoTotal: 600.00,
            merma: '0.16 LTS (2%)'
          },
          {
            id: 303,
            materiales: 'Perejil Deshidratado',
            costo: 45.00,
            cantidad: '1.5 KG',
            proporcion: '10%',
            checkBox: true,
            costoTotal: 67.50,
            merma: '0.03 KG (2%)'
          },
          {
            id: 304,
            materiales: 'Cebollín',
            costo: 38.00,
            cantidad: '1.2 KG',
            proporcion: '8%',
            checkBox: false,
            costoTotal: 45.60,
            merma: '0.02 KG (2%)'
          },
          {
            id: 305,
            materiales: 'Ajo en Polvo',
            costo: 55.00,
            cantidad: '0.8 KG',
            proporcion: '5%',
            checkBox: true,
            costoTotal: 44.00,
            merma: '0.02 KG (2%)'
          }
        ],
        parametrosData: [
          {
            id: 3001,
            parametros: 'Temperatura',
            minimo: '2°C',
            objetivo: '4°C',
            maximo: '6°C'
          },
          {
            id: 3002,
            parametros: 'Caducidad',
            minimo: '25 días',
            objetivo: '30 días',
            maximo: '35 días'
          },
          {
            id: 3003,
            parametros: 'Densidad',
            minimo: '0.95 g/ml',
            objetivo: '1.0 g/ml',
            maximo: '1.05 g/ml'
          }
        ],
        historicoData: [
          {
            materialPrimeraFase: 'Aderezo Ranch Especial',
            materiaPrimaBasica: 'Crema Ácida',
            costo: 98.75,
            cantidadLtsKg: '12.0 LTS',
            costoTotal: 1420.80,
            productoMermaLtsKg: '0.24 LTS',
            porcentajeMerma: '2.00%',
            costoFinal: 1449.22,
            fechaCambio: '2025-01-12T00:00:00',
            asignado: true
          },
          {
            materialPrimeraFase: 'Aderezo Ranch Especial',
            materiaPrimaBasica: 'Crema Ácida',
            costo: 95.00,
            cantidadLtsKg: '12.0 LTS',
            costoTotal: 1367.00,
            productoMermaLtsKg: '0.24 LTS',
            porcentajeMerma: '2.00%',
            costoFinal: 1394.34,
            fechaCambio: '2025-01-08T00:00:00',
            asignado: false
          },
          {
            materialPrimeraFase: 'Aderezo Ranch Especial',
            materiaPrimaBasica: 'Crema Ácida',
            costo: 92.00,
            cantidadLtsKg: '12.0 LTS',
            costoTotal: 1324.00,
            productoMermaLtsKg: '0.24 LTS',
            porcentajeMerma: '2.00%',
            costoFinal: 1350.48,
            fechaCambio: '2024-12-20T00:00:00',
            asignado: false
          },
          {
            materialPrimeraFase: 'Aderezo Ranch Especial',
            materiaPrimaBasica: 'Crema Ácida',
            costo: 88.00,
            cantidadLtsKg: '11.5 LTS',
            costoTotal: 1254.00,
            productoMermaLtsKg: '0.23 LTS',
            porcentajeMerma: '2.00%',
            costoFinal: 1279.08,
            fechaCambio: '2024-11-05T00:00:00',
            asignado: false
          }
        ]
      },
      {
        id: 4,
        articulo: 'Conservador Natural',
        fase: 'Primera',
        costoFinal: 637.81,
        fechaCambio: '2025-01-08T00:00:00',
        numArticulo: 'ART-004',
        materialesData: [
          {
            id: 401,
            materiales: 'Ácido Cítrico',
            costo: 45.20,
            cantidad: '5.5 KG',
            proporcion: '10%',
            checkBox: true,
            costoTotal: 625.30,
            merma: '0.11 KG (2%)'
          },
          {
            id: 402,
            materiales: 'Sal Refinada',
            costo: 12.00,
            cantidad: '3.0 KG',
            proporcion: '15%',
            checkBox: true,
            costoTotal: 36.00,
            merma: '0.06 KG (2%)'
          }
        ],
        parametrosData: [
          {
            id: 4001,
            parametros: 'Temperatura Ambiente',
            minimo: '18°C',
            objetivo: '22°C',
            maximo: '25°C'
          },
          {
            id: 4002,
            parametros: 'pH',
            minimo: '2.0',
            objetivo: '2.5',
            maximo: '3.0'
          },
          {
            id: 4003,
            parametros: 'Concentración',
            minimo: '8%',
            objetivo: '10%',
            maximo: '12%'
          }
        ],
        historicoData: [
          {
            materialPrimeraFase: 'Conservador Natural',
            materiaPrimaBasica: 'Ácido Cítrico',
            costo: 45.20,
            cantidadLtsKg: '5.5 KG',
            costoTotal: 625.30,
            productoMermaLtsKg: '0.11 KG',
            porcentajeMerma: '2.00%',
            costoFinal: 637.81,
            fechaCambio: '2025-01-08T00:00:00',
            asignado: true
          },
          {
            materialPrimeraFase: 'Conservador Natural',
            materiaPrimaBasica: 'Ácido Cítrico',
            costo: 43.50,
            cantidadLtsKg: '5.5 KG',
            costoTotal: 601.75,
            productoMermaLtsKg: '0.11 KG',
            porcentajeMerma: '2.00%',
            costoFinal: 613.79,
            fechaCambio: '2024-11-25T00:00:00',
            asignado: false
          },
          {
            materialPrimeraFase: 'Conservador Natural',
            materiaPrimaBasica: 'Ácido Cítrico',
            costo: 40.00,
            cantidadLtsKg: '5.0 KG',
            costoTotal: 550.00,
            productoMermaLtsKg: '0.10 KG',
            porcentajeMerma: '2.00%',
            costoFinal: 561.00,
            fechaCambio: '2024-09-10T00:00:00',
            asignado: false
          }
        ]
      },
      {
        id: 5,
        articulo: 'Emulsificante Vegetal',
        fase: 'Primera',
        costoFinal: 1989.46,
        fechaCambio: '2025-01-14T00:00:00',
        numArticulo: 'ART-005',
        materialesData: [
          {
            id: 501,
            materiales: 'Lecitina de Soya',
            costo: 165.90,
            cantidad: '8.2 KG',
            proporcion: '18%',
            checkBox: true,
            costoTotal: 1360.38,
            merma: '0.16 KG (2%)'
          },
          {
            id: 502,
            materiales: 'Mono y Diglicéridos',
            costo: 185.50,
            cantidad: '5.5 KG',
            proporcion: '12%',
            checkBox: true,
            costoTotal: 1020.25,
            merma: '0.11 KG (2%)'
          },
          {
            id: 503,
            materiales: 'Goma Xantana',
            costo: 220.00,
            cantidad: '3.8 KG',
            proporcion: '8%',
            checkBox: false,
            costoTotal: 836.00,
            merma: '0.08 KG (2%)'
          },
          {
            id: 504,
            materiales: 'Goma Guar',
            costo: 195.75,
            cantidad: '4.2 KG',
            proporcion: '9%',
            checkBox: true,
            costoTotal: 822.15,
            merma: '0.08 KG (2%)'
          },
          {
            id: 505,
            materiales: 'Polisorbato 60',
            costo: 310.00,
            cantidad: '2.5 KG',
            proporcion: '5%',
            checkBox: false,
            costoTotal: 775.00,
            merma: '0.05 KG (2%)'
          },
          {
            id: 506,
            materiales: 'Aceite de Girasol',
            costo: 95.40,
            cantidad: '12.0 LT',
            proporcion: '26%',
            checkBox: true,
            costoTotal: 1144.80,
            merma: '0.24 LT (2%)'
          },
          {
            id: 507,
            materiales: 'Estearato de Magnesio',
            costo: 145.00,
            cantidad: '1.8 KG',
            proporcion: '3%',
            checkBox: true,
            costoTotal: 261.00,
            merma: '0.04 KG (2%)'
          },
          {
            id: 508,
            materiales: 'Antioxidante BHT',
            costo: 275.00,
            cantidad: '0.6 KG',
            proporcion: '1%',
            checkBox: false,
            costoTotal: 165.00,
            merma: '0.01 KG (2%)'
          },
          {
            id: 509,
            materiales: 'Colorante Natural',
            costo: 190.00,
            cantidad: '0.4 KG',
            proporcion: '0.8%',
            checkBox: true,
            costoTotal: 76.00,
            merma: '0.01 KG (2%)'
          }
        ],
        parametrosData: [
          {
            id: 5001,
            parametros: 'Temperatura Almacenamiento',
            minimo: '15°C',
            objetivo: '20°C',
            maximo: '25°C'
          },
          {
            id: 5002,
            parametros: 'Índice de Emulsificación',
            minimo: '85%',
            objetivo: '92%',
            maximo: '95%'
          },
          {
            id: 5003,
            parametros: 'Viscosidad',
            minimo: '800 cP',
            objetivo: '1000 cP',
            maximo: '1200 cP'
          }
        ],
        historicoData: [
          {
            materialPrimeraFase: 'Emulsificante Vegetal',
            materiaPrimaBasica: 'Lecitina de Soya',
            costo: 165.90,
            cantidadLtsKg: '8.2 KG',
            costoTotal: 1950.45,
            productoMermaLtsKg: '0.16 KG',
            porcentajeMerma: '2.00%',
            costoFinal: 1989.46,
            fechaCambio: '2025-01-14T00:00:00',
            asignado: true
          },
          {
            materialPrimeraFase: 'Emulsificante Vegetal',
            materiaPrimaBasica: 'Lecitina de Soya',
            costo: 160.00,
            cantidadLtsKg: '8.2 KG',
            costoTotal: 1880.00,
            productoMermaLtsKg: '0.16 KG',
            porcentajeMerma: '2.00%',
            costoFinal: 1917.60,
            fechaCambio: '2024-12-18T00:00:00',
            asignado: false
          },
          {
            materialPrimeraFase: 'Emulsificante Vegetal',
            materiaPrimaBasica: 'Lecitina de Soya',
            costo: 155.00,
            cantidadLtsKg: '8.0 KG',
            costoTotal: 1805.00,
            productoMermaLtsKg: '0.16 KG',
            porcentajeMerma: '2.00%',
            costoFinal: 1841.10,
            fechaCambio: '2024-10-30T00:00:00',
            asignado: false
          },
          {
            materialPrimeraFase: 'Emulsificante Vegetal',
            materiaPrimaBasica: 'Lecitina de Soya',
            costo: 145.00,
            cantidadLtsKg: '8.0 KG',
            costoTotal: 1690.00,
            productoMermaLtsKg: '0.16 KG',
            porcentajeMerma: '2.00%',
            costoFinal: 1723.80,
            fechaCambio: '2024-08-15T00:00:00',
            asignado: false
          }
        ]
      }
    ];
  }
}
