import { Component, OnInit } from '@angular/core';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { alerts } from 'app/helpers/alerts';
import { DetailCellRendererProveedoresComponent } from './details/detail-cell-renderer-proveedores.component';
import { DetailCellRendererFamiliaComponent } from './details/detail-cell-renderer-familia.component';
import { DetailCellRendererSucursalComponent } from './details/detail-cell-renderer-sucursal.component';
import { ModalMaterialComponent } from './modal-material/modal-material.component';

@Component({
  selector: 'app-materiales-maestro',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridModule,
    DetailCellRendererProveedoresComponent,
    DetailCellRendererFamiliaComponent,
    DetailCellRendererSucursalComponent
  ],
  templateUrl: './materiales-maestro.component.html',
  styleUrl: './materiales-maestro.component.scss'
})
export class MaterialesMaestroComponent implements OnInit {

  private gridApi!: GridApi;

  rowData: any[] = [];
  gridHeight: string = '80vh';
  selectedMaterial: any = null;
  hasUnsavedChanges: boolean = false;

  public rowSelection: 'single' | 'multiple' = 'single';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  constructor(private modalService: NgbModal) {}

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
        articulo: 'Corcholata Dorada',
        categoria: 'Materia Prima',
        familia: 'Basica',
        subfamilia: '3',
        proveedor: '2',
        imagen: '📷',
        proveedoresData: [
          {
            id: 101,
            nombreProveedor: 'Envasadora llos SA de CV',
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
            subfamilia: 'Refresco',
            sabor: '2',
            presentacion: 'Caja 100 pzas',
            descripcion: 'Tornillos hexagonales estándar para uso general'
          },
          {
            id: 1002,
            consecutivo: 2,
            subfamilia: 'Sidra',
            sabor: '6',
            presentacion: 'Caja 50 pzas',
            descripcion: 'Tornillos hexagonales de acero inoxidable para ambientes húmedos'
          },
          {
            id: 1003,
            consecutivo: 3,
            subfamilia: 'Vinos',
            sabor: '4',
            presentacion: 'Bolsa 200 pzas',
            descripcion: 'Tornillos hexagonales galvanizados para exteriores'
          }
        ],
        sucursalData: [
          {
            id: 10001,
            sucursal: 'Monterrey Centro',
            fechaAlta: '2024-01-15',
            stockMinimo: 500,
            resurtido: 2000,
            capacidadMaxAlmacen: 10000,
            tiempoEntrega: '2-3 días hábiles'
          },
          {
            id: 10002,
            sucursal: 'Guadalajara Sur',
            fechaAlta: '2024-02-20',
            stockMinimo: 300,
            resurtido: 1500,
            capacidadMaxAlmacen: 8000,
            tiempoEntrega: '3-4 días hábiles'
          },
          {
            id: 10003,
            sucursal: 'Ciudad de México Norte',
            fechaAlta: '2024-03-10',
            stockMinimo: 1000,
            resurtido: 3000,
            capacidadMaxAlmacen: 15000,
            tiempoEntrega: '1-2 días hábiles'
          }
        ]
      },
      {
        id: 2,
        activo: true,
        numMat: 'MAT-002',
        articulo: 'Jugo Manzana',
        categoria: 'Materia Prima',
        familia: 'Basica',
        subfamilia: 'Basica',
        proveedor: 'Jugos Mexicanos',
        imagen: '📷',
        proveedoresData: [
          {
            id: 201,
            nombreProveedor: 'Jugos Mexicanos',
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
        ],
        sucursalData: [
          {
            id: 20001,
            sucursal: 'Ciudad de México Norte',
            fechaAlta: '2023-11-05',
            stockMinimo: 200,
            resurtido: 800,
            capacidadMaxAlmacen: 5000,
            tiempoEntrega: '1-2 días hábiles'
          },
          {
            id: 20002,
            sucursal: 'Querétaro Este',
            fechaAlta: '2024-01-12',
            stockMinimo: 150,
            resurtido: 600,
            capacidadMaxAlmacen: 4000,
            tiempoEntrega: '2-3 días hábiles'
          }
        ]
      },
      {
        id: 3,
        activo: false,
        numMat: 'MAT-003',
        articulo: 'Azucar Morena',
        categoria: 'Eléctrico',
        familia: 'Basica',
        subfamilia: 'Basica',
        proveedor: 'ingenio IOca',
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
        ],
        sucursalData: [
          {
            id: 30001,
            sucursal: 'Puebla Centro',
            fechaAlta: '2024-02-18',
            stockMinimo: 1000,
            resurtido: 5000,
            capacidadMaxAlmacen: 20000,
            tiempoEntrega: '2-3 días hábiles'
          },
          {
            id: 30002,
            sucursal: 'León Norte',
            fechaAlta: '2024-03-05',
            stockMinimo: 800,
            resurtido: 4000,
            capacidadMaxAlmacen: 18000,
            tiempoEntrega: '3-4 días hábiles'
          },
          {
            id: 30003,
            sucursal: 'Tijuana Oeste',
            fechaAlta: '2024-04-10',
            stockMinimo: 600,
            resurtido: 3000,
            capacidadMaxAlmacen: 15000,
            tiempoEntrega: '4-5 días hábiles'
          }
        ]
      },
      {
        id: 4,
        activo: true,
        numMat: 'MAT-004',
        articulo: 'Envase para Refresco Embotellado',
        categoria: 'Alimentos y Bebidas',
        familia: 'Basica',
        subfamilia: 'Primaria',
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
        ],
        sucursalData: [
          {
            id: 40001,
            sucursal: 'Monterrey Centro',
            fechaAlta: '2024-05-01',
            stockMinimo: 2000,
            resurtido: 10000,
            capacidadMaxAlmacen: 50000,
            tiempoEntrega: '1-2 días hábiles'
          }
        ]
      },
      {
        id: 5,
        activo: true,
        numMat: 'MAT-005',
        articulo: 'Valvulas de Control para Fluidos',
        categoria: 'Alimentos y Bebidas',
        familia: 'Basica',
        subfamilia: 'Primaria',
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
        ],
        sucursalData: [
          {
            id: 50001,
            sucursal: 'Guadalajara Centro',
            fechaAlta: '2024-06-15',
            stockMinimo: 1500,
            resurtido: 6000,
            capacidadMaxAlmacen: 30000,
            tiempoEntrega: '2-3 días hábiles'
          }
        ]
      },
      {
        id: 6,
        activo: true,
        numMat: 'MAT-006',
        articulo: 'Endulcorante Natural',
        categoria: 'Alimentos y Bebidas',
        familia: 'Basica',
        subfamilia: 'Primaria',
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
        ],
        sucursalData: [
          {
            id: 60001,
            sucursal: 'Querétaro Norte',
            fechaAlta: '2024-07-10',
            stockMinimo: 500,
            resurtido: 2500,
            capacidadMaxAlmacen: 12000,
            tiempoEntrega: '1-2 días hábiles'
          },
          {
            id: 60002,
            sucursal: 'Monterrey Centro',
            fechaAlta: '2024-08-01',
            stockMinimo: 400,
            resurtido: 2000,
            capacidadMaxAlmacen: 10000,
            tiempoEntrega: '2-3 días hábiles'
          }
        ]
      }
    ];
  }

  components = {
    detailCellRendererProveedores: DetailCellRendererProveedoresComponent,
    detailCellRendererFamilia: DetailCellRendererFamiliaComponent,
    detailCellRendererSucursal: DetailCellRendererSucursalComponent
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
      } else if (params.data.detailType === 'sucursal') {
        return { component: 'detailCellRendererSucursal' };
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
        headerName: 'Categoria',
        width: 250,
        filter: true
      },
  
      {
        field: 'familia',
        headerName: 'Familia',
        width: 150,
        filter: true
      },
      {
        field: 'subfamilia',
        headerName: 'Subfamilia',
        width: 150,
        filter: true,
        cellRenderer: this.createDetailToggleCellRenderer('familia'),
        cellStyle: { backgroundColor: '#fff3e0', cursor: 'pointer', textDecoration: 'underline' }
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
    if (colId === 'subfamilia') return 'familia';
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
    const isDetailColumn = colId === 'proveedor' || colId === 'subfamilia';

    if (isDetailColumn) {
      const node = event.node;
      const api = event.api;
      const detailType = this.getDetailTypeFromColId(colId);

      // Determinar si la fila actual ya está expandida CON ESTE MISMO tipo de detalle
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

        // Cambiar el tipo de detalle
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

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  onSelectionChanged(event: any): void {
    const selectedRows = event.api.getSelectedRows();
    this.selectedMaterial = selectedRows.length > 0 ? selectedRows[0] : null;
  }

  addMaterial(): void {
    const modalRef = this.modalService.open(ModalMaterialComponent, {
      size: 'lg',
      backdrop: 'static'
    });

    modalRef.componentInstance.isEdit = false;

    modalRef.result.then(
      (newMaterial) => {
        if (newMaterial) {
          this.rowData = [...this.rowData, newMaterial];
          this.hasUnsavedChanges = true;
        }
      },
      () => { }
    );
  }

  editMaterial(): void {
    if (!this.selectedMaterial) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un material para editar', 'warning');
      return;
    }

    const modalRef = this.modalService.open(ModalMaterialComponent, {
      size: 'lg',
      backdrop: 'static'
    });

    modalRef.componentInstance.material = { ...this.selectedMaterial };
    modalRef.componentInstance.isEdit = true;

    modalRef.result.then(
      (updatedMaterial) => {
        if (updatedMaterial) {
          const index = this.rowData.findIndex(m => m.id === updatedMaterial.id);
          if (index !== -1) {
            this.rowData[index] = updatedMaterial;
            this.rowData = [...this.rowData]; // Trigger change detection
            this.hasUnsavedChanges = true;
          }
        }
      },
      () => { }
    );
  }

  async deleteMaterial(): Promise<void> {
    if (!this.selectedMaterial) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un material para eliminar', 'warning');
      return;
    }

    const result = await alerts.confirmAlert(
      '¿Eliminar material?',
      `¿Está seguro de eliminar el material ${this.selectedMaterial.numMat} - ${this.selectedMaterial.articulo}?`,
      'warning',
      'Sí, eliminar'
    );

    if (result.isConfirmed) {
      // Eliminar del array de datos
      this.rowData = this.rowData.filter(m => m.id !== this.selectedMaterial.id);
      this.selectedMaterial = null;
      this.hasUnsavedChanges = true;
      alerts.basicAlert('Eliminado', 'El material ha sido eliminado', 'success');
    }
  }

  saveChanges(): void {
    if (!this.hasUnsavedChanges) {
      return;
    }
    // TODO: Guardar cambios en el servidor
    alerts.basicAlert('Guardado', 'Los cambios han sido guardados correctamente', 'success');
    this.hasUnsavedChanges = false;
  }

  refreshData(): void {
    this.cargarDatosFalsos();
    this.selectedMaterial = null;
    this.hasUnsavedChanges = false;
    alerts.basicAlert('Recargado', 'Los datos han sido recargados', 'success');
  }
}
