import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { Router } from '@angular/router';
import { OtService } from 'app/services/ot.service';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';
import { alerts } from 'app/helpers/alerts';

interface OrdenesData {
  id: string;
  registerDate: string;
  otNumber: string;
  assignedTo: string;
  description: string;
  nameConsumer: string;
}

@Component({
  selector: 'app-ordenes',
  standalone: true,
  imports: [CommonModule, TranslateModule, AgGridModule],
  templateUrl: './ordenes.component.html',
  styleUrl: './ordenes.component.scss'
})
export class OrdenesComponent implements OnInit {
  
  private otService = inject(OtService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  private router = inject(Router);
  
  // Variables de control
  public isUploading: boolean = false;

  // Configuración del grid
  public gridApi!: GridApi;
  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 30,
    suppressDragLeaveHidesColumns: true,
    suppressHorizontalScroll: false,
    animateRows: true,
    pagination: true,
    paginationPageSize: 10,
    onRowDoubleClicked: (event: any) => this.onRowDoubleClicked(event)
  };

  // Definición de columnas
  public columnDefs: ColDef[] = [
    {
      field: 'id',
      headerName: 'ID',
      sortable: true,
      filter: true,
      resizable: true,
      width: 77,      
    },
    {
      field: 'registerDate',
      headerName: 'Registro',
      sortable: true,
      filter: true,
      resizable: true,
      width: 88,
    },
    {
      field: 'otNumber',
      headerName: 'Número',
      sortable: true,
      filter: true,
      resizable: true,
      width: 85,
    },
    {
      field: 'assignedTo',
      headerName: 'Unidad',
      sortable: true,
      filter: true,
      resizable: true,
      flex: 2
    },
    {
      field: 'description',
      headerName: 'Servicio',
      sortable: true,
      filter: true,
      resizable: true,
      flex: 2
    },
    {
      field: 'nameConsumer',
      headerName: 'Catastrales',
      sortable: true,
      filter: true,
      resizable: true,
      flex: 2
    }
  ];

  // Datos del grid obtenidos del servicio
  public rowData: OrdenesData[] = [];

  ngOnInit() {
    this.obtenerDatos();
  }

  obtenerDatos() {
    this.otService.getOtList().subscribe({
      next: (data: any) => {
        console.log('Datos obtenidos del servicio OT:', data);
        this.rowData = data;
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Get Lista de OT',
          'Menu Proyectos Ordenes de Trabajo',
          this.trackingService.getEmail()
        );
      },
      error: (error) => {
        console.error('Error al obtener datos de OT:', error);
        this.rowData = [];
      }
    });
  }

  // Métodos del grid
  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    params.api.sizeColumnsToFit();
  }

  onSelectionChanged(event: any) {
    const selectedRows = this.gridApi.getSelectedRows();
    console.log('Fila seleccionada:', selectedRows);
  }

  onRowDoubleClicked(event: any) {
    const rowData = event.data;
    if (rowData && rowData.id) {
      this.router.navigate(['/projects/ot/details', rowData.id]);
    }
  }

  // Métodos CRUD
  addRow() {
    this.router.navigate(['/projects/ot/details']);
  }

  revert() {
    // Recargar datos originales desde el servicio
    this.obtenerDatos();
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Revertir Cambios en Lista de OT',
      'Menu Proyectos Ordenes de Trabajo',
      this.trackingService.getEmail()
    );
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      // Validar que sea un PDF
      if (file.type !== 'application/pdf') {
        alert('Por favor seleccione un archivo PDF válido.');
        return;
      }
      
      // Validar tamaño del archivo (ej: máximo 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        alert('El archivo es demasiado grande. El tamaño máximo permitido es 10MB.');
        return;
      }
      
      this.uploadPdf(file);
    }
    
    // Limpiar el input para permitir seleccionar el mismo archivo nuevamente
    input.value = '';
  }

  uploadPdf(file: File) {
    this.isUploading = true;
    
    console.log('=== PDF Upload Process Started ===');
    console.log('File details:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: new Date(file.lastModified)
    });
    console.log('Project ID being sent:', 760);
    console.log('Calling OtService.addOtViaPdf with parameters:', { projectId: 760, file: file });
    
    this.otService.addOtViaPdf(760, file).subscribe({
      next: (response: any) => {
        console.log('=== PDF Upload Success ===');
        console.log('Response received:', response);
        
        this.isUploading = false;
        
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          `Upload PDF OT - ID: ${response.otId}`,
          'Menu Proyectos Ordenes de Trabajo',
          this.trackingService.getEmail()
        );
        
        // Mostrar alerta de éxito personalizada
        alerts.basicAlert(
          'PDF Procesado Exitosamente', 
          `El PDF ha sido cargado y se han obtenido algunos datos. Será redirigido al formulario de OT para que corrobore los datos.\n\nNúmero OT: ${response.otNumber}`, 
          'success'
        );
        
        // Redirigir a la página de detalles después de un breve delay
        console.log('Navigating to details page with otId:', response.otId);
        setTimeout(() => {
          this.router.navigate(['/projects/ot/details', response.otId]);
        }, 2000);
      },
      error: (error) => {
        console.log('=== PDF Upload Error ===');
        console.error('Complete error object:', error);
        console.error('Error status:', error.status);
        console.error('Error statusText:', error.statusText);
        console.error('Error headers:', error.headers);
        console.error('Error body:', error.error);
        
        this.isUploading = false;
        
        let errorMessage = 'Error al procesar el archivo PDF.';
        if (error.error?.message) {
          errorMessage = error.error.message;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        alert(errorMessage);
      }
    });
  }

}