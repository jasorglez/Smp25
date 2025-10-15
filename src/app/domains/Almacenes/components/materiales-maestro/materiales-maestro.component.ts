import { Component, OnInit } from '@angular/core';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-materiales-maestro',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
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
        nodeLevel: 'material',
        activo: true,
        numMat: 'MAT-001',
        articulo: 'Tornillo Hexagonal 1/2"',
        categoria: 'Ferretería',
        familia: 'Tornillería',
        subfamilia: 'Hexagonales',
        proveedor: 'Tornillos SA de CV',
        imagen: '📷',
        isExpanded: false,
        proveedores: [
          {
            id: 101,
            nombreProveedor: 'Tornillos SA de CV',
            contacto: 'Juan Pérez',
            telefono: '555-1234',
            email: 'ventas@tornillos.com',
            direccion: 'Av. Industrial 123',
            precioUnitario: 2.50,
            tiempoEntrega: '5 días'
          },
          {
            id: 102,
            nombreProveedor: 'Ferretería del Norte',
            contacto: 'María García',
            telefono: '555-5678',
            email: 'info@ferrenorte.com',
            direccion: 'Calle Comercio 456',
            precioUnitario: 2.30,
            tiempoEntrega: '3 días'
          }
        ]
      },
      {
        id: 2,
        nodeLevel: 'material',
        activo: true,
        numMat: 'MAT-002',
        articulo: 'Cemento Portland Gris 50kg',
        categoria: 'Construcción',
        familia: 'Cemento',
        subfamilia: 'Portland',
        proveedor: 'Cementos Mexicanos',
        imagen: '📷',
        isExpanded: false,
        proveedores: [
          {
            id: 201,
            nombreProveedor: 'Cementos Mexicanos',
            contacto: 'Carlos Rodríguez',
            telefono: '555-9876',
            email: 'ventas@cemex.com',
            direccion: 'Zona Industrial Ote.',
            precioUnitario: 180.00,
            tiempoEntrega: '1 día'
          }
        ]
      },
      {
        id: 3,
        nodeLevel: 'material',
        activo: false,
        numMat: 'MAT-003',
        articulo: 'Cable Eléctrico Cal 12 AWG',
        categoria: 'Eléctrico',
        familia: 'Cables',
        subfamilia: 'Conductores',
        proveedor: 'Distribuidora Eléctrica',
        imagen: '📷',
        isExpanded: false,
        proveedores: [
          {
            id: 301,
            nombreProveedor: 'Distribuidora Eléctrica',
            contacto: 'Luis Martínez',
            telefono: '555-4321',
            email: 'contacto@diselec.com',
            direccion: 'Blvd. Electricistas 789',
            precioUnitario: 15.50,
            tiempoEntrega: '2 días'
          },
          {
            id: 302,
            nombreProveedor: 'Cables y Más',
            contacto: 'Ana López',
            telefono: '555-8765',
            email: 'ventas@cablesymas.com',
            direccion: 'Av. Tecnología 321',
            precioUnitario: 14.80,
            tiempoEntrega: '4 días'
          }
        ]
      }
    ];
  }

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    suppressClickEdit: true,
    singleClickEdit: false,
    stopEditingWhenCellsLoseFocus: true,
    getRowClass: (params: any) => {
      if (params.data.nodeLevel === 'material') {
        return 'material-row';
      }
      if (params.data.nodeLevel === 'proveedor-detail') {
        return 'proveedor-detail-row';
      }
      return '';
    }
  };

  get colMaster(): ColDef[] {
    return [
      {
        field: 'activo',
        headerName: 'Activo',
        width: 100,
        cellRenderer: (params: any) => {
          if (params.data.nodeLevel === 'material') {
            const checked = params.data.activo ? 'checked' : '';
            return `<input type="checkbox" ${checked} disabled style="cursor: pointer;">`;
          }
          return '';
        }
      },
      {
        field: 'numMat',
        headerName: 'Num Mat',
        width: 130,
        filter: true,
        cellRenderer: (params: any) => {
          return params.data.nodeLevel === 'material' ? params.value || '' : '';
        }
      },
      {
        field: 'articulo',
        headerName: 'Artículo',
        width: 250,
        filter: true,
        cellRenderer: (params: any) => {
          return params.data.nodeLevel === 'material' ? params.value || '' : '';
        }
      },
      {
        field: 'categoria',
        headerName: 'Categoría',
        width: 150,
        filter: true,
        cellRenderer: (params: any) => {
          return params.data.nodeLevel === 'material' ? params.value || '' : '';
        }
      },
      {
        field: 'familia',
        headerName: 'Familia',
        width: 150,
        filter: true,
        cellRenderer: (params: any) => {
          return params.data.nodeLevel === 'material' ? params.value || '' : '';
        }
      },
      {
        field: 'subfamilia',
        headerName: 'Subfamilia',
        width: 150,
        filter: true,
        cellRenderer: (params: any) => {
          return params.data.nodeLevel === 'material' ? params.value || '' : '';
        }
      },
      {
        field: 'proveedor',
        headerName: 'Proveedor',
        width: 200,
        filter: true,
        cellRenderer: (params: any) => {
          return params.data.nodeLevel === 'material' ? params.value || '' : '';
        }
      },
      {
        field: 'imagen',
        headerName: 'Imagen',
        width: 100,
        cellRenderer: (params: any) => {
          if (params.data.nodeLevel === 'material') {
            return params.value ? '📷 Ver' : '📷 Subir';
          }
          return '';
        }
      },
      {
        field: 'verProveedor',
        headerName: 'Ver Proveedor',
        width: 150,
        cellRenderer: (params: any) => {
          if (params.data.nodeLevel === 'material') {
            const proveedorCount = params.data.proveedores?.length || 0;
            const isExpanded = params.data.isExpanded || false;
            const chevron = isExpanded ? '▼' : '▶';
            return `<button class="btn btn-sm btn-primary">${chevron} Ver (${proveedorCount})</button>`;
          }
          return '';
        },
        onCellClicked: (event: any) => {
          if (event.data.nodeLevel === 'material') {
            this.toggleProveedorExpansion(event.data);
          }
        }
      }
    ];
  }

  // Columnas para el grid de detalle de proveedores (cascada)
  get colProveedorDetail(): ColDef[] {
    return [
      {
        field: 'nombreProveedor',
        headerName: 'Nombre Proveedor',
        width: 200
      },
      {
        field: 'contacto',
        headerName: 'Contacto',
        width: 150
      },
      {
        field: 'telefono',
        headerName: 'Teléfono',
        width: 120
      },
      {
        field: 'email',
        headerName: 'Email',
        width: 200
      },
      {
        field: 'direccion',
        headerName: 'Dirección',
        width: 250
      },
      {
        field: 'precioUnitario',
        headerName: 'Precio Unitario',
        width: 130,
        cellRenderer: (params: any) => {
          return params.value ? `$${params.value.toFixed(2)}` : '';
        }
      },
      {
        field: 'tiempoEntrega',
        headerName: 'Tiempo Entrega',
        width: 130
      }
    ];
  }

  toggleProveedorExpansion(materialData: any) {
    const materialIndex = this.rowData.findIndex(item => item.id === materialData.id);

    if (materialIndex === -1) return;

    const material = this.rowData[materialIndex];
    material.isExpanded = !material.isExpanded;

    if (material.isExpanded) {
      // Insertar filas de proveedores justo después del material
      const proveedorRows = material.proveedores.map((prov: any) => ({
        ...prov,
        nodeLevel: 'proveedor-detail',
        parentId: material.id
      }));

      this.rowData.splice(materialIndex + 1, 0, ...proveedorRows);
    } else {
      // Remover filas de proveedores
      this.rowData = this.rowData.filter(item =>
        !(item.nodeLevel === 'proveedor-detail' && item.parentId === material.id)
      );
    }

    this.gridApi.setGridOption('rowData', this.rowData);
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }
}
