import { CommonModule } from '@angular/common';
import { Component, effect, ElementRef, HostListener, inject, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AgGridModule } from 'ag-grid-angular';
import { GridApi, ColDef, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { ConventionsService } from 'app/services/conventions.service';
import { lastValueFrom, concat, toArray, catchError, EMPTY, throwError, of, finalize, tap, firstValueFrom } from 'rxjs';
import { ContractsService } from 'app/services/contracts.service';
import { SignalsService } from 'app/services/signals.service';
import { HttpErrorResponse } from '@angular/common/http';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AttachHandlerService } from 'app/services/attach-handler.service';

@Component({
  selector: 'app-conventions',
  standalone: true,
  imports: [DomainsModule, CommonModule, FormsModule, AgGridModule],
  templateUrl: './conventions.component.html',
  styleUrl: './conventions.component.scss'
})
export class ConventionsComponent {


  private conventionsService = inject(ConventionsService);
  private contractsService = inject(ContractsService);
  private signalsService = inject(SignalsService);
  private modalService = inject(NgbModal);
  private attachHandler = inject(AttachHandlerService);

  constructor() {
    effect(() => {
      // Este efecto se ejecutará cada vez que selectedContract cambie
      this.obtenerDatos();
    });
  }

  ngOnInit() {
    this.getContracts();
    console.log(this.id);
  }

  @ViewChild('carousel', { static: false }) carousel: ElementRef | undefined;
  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  notSavedChanges: boolean = false;
  rowData: any;
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  id: number = null;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  selectedContract = this.signalsService.getContractSelectedBySidebar();
  currentIndexCarousel: number;
  images: any[] = [];
  entradaCarousel: any[];
  numItemsCarousel: number = 0;

  obtenerDatos() {
    if (this.selectedContract() == null) {
      this.conventionsService.getConventions().subscribe((data: any) => {
        this.rowData = data;
      });
    } else {
      this.conventionsService
        .getConventionsByContract(this.selectedContract())
        .pipe(
          catchError((error: HttpErrorResponse) => {
            if (error.status === 404) {
              // Manejar el error 404 silenciosamente
              console.log('No se encontraron datos para el contrato seleccionado');
              this.rowData = []; // O asigna un valor por defecto
              return of([]); // Devuelve un observable vacío
            }
            // Para otros errores, permite que se propaguen
            throw error;
          })
        )
        .subscribe((data: any) => {
          this.rowData = data;
        });
    }
  }

  getContracts() {
    this.contractsService.getContracts(1).subscribe((data: any[]) => {
      this.contracts = data.reduce((acc, dep) => {
        acc[dep.idContrato] = dep.numberContract + ' - ' + dep.descripSmall; // Cambia la estructura para que solo almacene el nombre
        return acc;
      }, {});
    });
  }

  get columnDefs(): ColDef[] {
    return [
      {
        field: 'name',
        headerName: 'Nombre',
        editable: true,
        flex: 1
      },
      {
        field: 'description',
        headerName: 'Descripción',
        editable: true,
        flex: 2
      },
      {
        field: 'idContract',
        headerName: 'Contrato',
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: Object.keys(this.contracts).sort((a, b) => this.contracts[a].localeCompare(this.contracts[b])),
        },
        valueFormatter: (params) => this.contracts[params.value] || '',
        valueSetter: (params) => {
          const newValue = params.newValue;
          if (this.contracts.hasOwnProperty(newValue)) {
            params.data[params.colDef.field] = newValue;
            return true;
          }
          return false;
        },
        valueParser: (params) => params.newValue,
        editable: true,
        flex: 2,
      },
      {
        field: 'start',
        headerName: 'Fecha inicio',
        editable: true,
        cellDataType: 'dateString',
        flex: 1,
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        }
      },
      {
        field: 'end',
        headerName: 'Fecha fin',
        editable: true,
        cellDataType: 'dateString',
        flex: 1,
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        }
      },
      {
        field: 'amountMX',
        headerName: 'Monto MXN',
        editable: true,
        cellDataType: 'number',
        valueFormatter: params => {
          return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
          }).format(params.value);
        },
        flex: 1
      },
      {
        field: 'amountDLL',
        headerName: 'Monto USD',
        editable: true,
        cellDataType: 'number',
        valueFormatter: params => {
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
          }).format(params.value);
        },
        flex: 1
      },
      {
        field: 'comment',
        headerName: 'Comentario',
        editable: true,
        flex: 2
      },
    ];
  }

  onSelectedRow(event: any) {
    //this.id = event.data.id;
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
      this.id = this.selectedRowData.id;
      this.getDataCarousel();
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      contractId: 1,
      name: '',
      direccion: '',
      coordinates: '',
      active: 1,
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
  }

  async saveChanges() {
    const isValid = this.rowData.every((item) =>
      item.name && item.description && item.idContract && item.start && item.end);
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar todos los campos antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.conventionsService.addConvention(cleanedData).pipe(
        catchError((error) => {
          console.error('Error adding agreement:', error);
          return throwError(() => new Error(`Error al añadir acuerdo: ${error.message}`));
        })
      );
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.conventionsService.updateConvention(row.id, cleanedData).pipe(
        catchError((error) => {
          console.error('Error updating agreement:', error);
          return throwError(() => new Error(`Error al actualizar acuerdo: ${error.message}`));
        })
      );
    });

    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(
          toArray(),
          catchError((error) => {
            console.error('Error in observable chain:', error);
            return throwError(() => new Error(`Error en la operación: ${error.message}`));
          })
        )
      );

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      this.obtenerDatos(); // Refrescar los datos
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        `Ocurrió un error al actualizar los datos: ${error.message}. Por favor, intente nuevamente.`,
        'error'
      );
    }
  }

  async deleteEntry() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Por favor, seleccione una entrada para eliminar.',
        'error'
      );
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;
    selectedData.active = 0;
    this.conventionsService.deleteConvention(id).pipe(
      catchError((error) => {
        alerts.basicAlert(
          'Eliminar entrada',
          'Error al eliminar la entrada.',
          'error'
        );
        console.error(error);
        return EMPTY;
      })
    )
      .subscribe(
        () => {
          alerts.basicAlert(
            'Eliminar entrada',
            'Entrada eliminada satisfactoriamente.',
            'success'
          );
          this.obtenerDatos();

          alerts.basicAlert(
            'Eliminar entrada',
            'Entrada eliminada satisfactoriamente.',
            'success'
          );
          this.notSavedChanges = false;
          this.selectedRowData = null;
        }
      );
  }

  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  // Definimos el carrusel de imagenes

  getDataCarousel() {
    this.entradaCarousel = [];
    this.numItemsCarousel = 0;
    this.conventionsService
      .getImages(this.id)
      .pipe(
        tap((data: any[]) => {
          this.entradaCarousel = data;
          this.numItemsCarousel = this.entradaCarousel.length;
        }),
        catchError((error: any) => {
          console.log('No se encontraron datos para el contrato seleccionado.');
          this.entradaCarousel = []; // O asigna un valor por defecto
          this.numItemsCarousel = 0;
          return of([]); // Devuelve un observable vacío
        }),
        finalize(() => {
          this.bucleDatosCarousel();
        })
      )
      .subscribe();
  }

  async bucleDatosCarousel() {
    // Vaciamos los datos
    this.images = [];

    for (let i = 0; i < this.numItemsCarousel; i++) {
      let temporal = [];
      temporal = [
        {
          src: this.entradaCarousel[i]?.docto,
          idPhoto: this.entradaCarousel[i]?.id,
          alt: 'Imagen'
        },
      ];
      // Empujamos los datos almacenados en temporal a gestionarDatos
      this.images.push(...temporal);
    }
  }

  openCarouselModal(content: any, index: number): void {
    this.currentIndexCarousel = index;
    this.modalService.open(content, { size: 'md', centered: true }).result.then(
      () => {
        // Modal closed
      },
      () => {
        // Modal dismissed
      }
    );
  }

  closeCarouselModal(modal) {
    modal.close();
  }

  async addPhoto() {
    try {
      const url = await this.attachHandler.upload();
      await firstValueFrom(this.conventionsService.uploadImage(this.id, url));
      alerts.basicAlert(
        'Subir imagen',
        'La imagen ha sido subida con éxito.',
        'success'
      );
      this.getDataCarousel();
    }
    catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Subir imagen',
        'La imagen no se ha podido subir.',
        'error'
      );
    }
  }

  deletePhoto(id: number, modal: any) {
    alerts
      .confirmAlert(
        'Eliminar imagen',
        '¿Está seguro de querer borrar esta imagen? Esta acción es irreversible.',
        'warning',
        'Borrar'
      )
      .then((result) => {
        if (result.isConfirmed) {
          this.closeCarouselModal(modal);
          this.conventionsService
            .deleteAttachment(id)
            .pipe(
              tap((data: any[]) => {
                console.log(data);
              }),
              catchError((error: any) => {
                console.error('Error occurred:', error);
                return of(null);
              }),
              finalize(() => {
                alerts.basicAlert(
                  'Eliminar imagen',
                  'Imagen borrada satisfactoriamente.',
                  'success'
                );
                this.getDataCarousel();
              })
            )
            .subscribe();
        } else {
          console.log('hola');
          alerts.basicAlert(
            'Eliminar imagen',
            'La imagen no ha sido borrada.',
            'success'
          );
        }
      });
  }
}
