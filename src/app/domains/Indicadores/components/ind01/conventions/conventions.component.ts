import { CommonModule } from '@angular/common';
import { Component, effect, ElementRef, HostListener, inject, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AgGridModule } from 'ag-grid-angular';
import { GridApi, ColDef, GridReadyEvent, CellDoubleClickedEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { ConventionsService } from 'app/services/conventions.service';
import { lastValueFrom, concat, toArray, catchError, EMPTY, throwError, of, finalize, tap, firstValueFrom } from 'rxjs';
import { SignalsService } from 'app/services/signals.service';
import { HttpErrorResponse } from '@angular/common/http';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AttachHandlerService } from 'app/services/attach-handler.service';
import { MultiLineEditorComponent } from "../../../../../shared/multi-line/multi-line-editor.component";
import { ModalService } from 'app/services/modal.service';

@Component({
  selector: 'app-conventions',
  standalone: true,
  imports: [DomainsModule, CommonModule, FormsModule, AgGridModule, MultiLineEditorComponent],
  templateUrl: './conventions.component.html',
  styleUrl: './conventions.component.scss'
})
export class ConventionsComponent {

  private conventionsService = inject(ConventionsService);
  private signalsService = inject(SignalsService);
  private modalService = inject(NgbModal);
  public attachHandlerService = inject(AttachHandlerService);
  private modalServiceTable = inject(ModalService);
  numItemsDocuments: number;
  documents: any[];

  constructor() {
    effect(() => {
      this.selectedContract = this.signalsService.getContractSelectedBySidebar()();
      this.selectedProject = this.signalsService.getProjectSelectedBySidebar()();
      if(this.selectedProject != null) {
        this.idc = this.selectedProject;
        this.type = 'Project';
      }
      else {
        this.idc = this.selectedContract;
        this.type = 'Contract';
      }

      // Este efecto se ejecutará cada vez que selectedContract cambie
      this.obtenerDatos();
    });
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
  idc: number = null;
  type: string = null;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  selectedContract: number = null;
  selectedProject: number = null;
  currentIndexCarousel: number;
  images: any[] = [];
  entradaCarousel: any[];
  numItemsCarousel: number = 0;

  obtenerDatos() {
    this.conventionsService
      .getConventionsByContractOrProject(this.type, this.idc)
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

  gridOptions = {
    headerHeight: 30,
    rowHeight: 30
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
        editable: false,
        flex: 2,
        cellEditor: 'agPopupTextCellEditor',
        cellEditorParams: {
          maxLength: 100,
          cols: 50,
          rows: 3,
          onKeyDown: (event: KeyboardEvent) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.stopPropagation();
            }
          },
        },
        onCellDoubleClicked: (event: CellDoubleClickedEvent) => {
          if (!event.node.group) {
            this.modalServiceTable.showModal({
              params: event,
              value: event.value,
            });
          }
        },
        cellRenderer: (params: ICellRendererParams) => {
          if (params.node.group) {
            return params.value;
          }
          return params.value;
        }
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
        editable: false,
        flex: 2,
        cellEditor: 'agPopupTextCellEditor',
        cellEditorParams: {
          maxLength: 100,
          cols: 50,
          rows: 3,
          onKeyDown: (event: KeyboardEvent) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.stopPropagation();
            }
          },
        },
        onCellDoubleClicked: (event: CellDoubleClickedEvent) => {
          if (!event.node.group) {
            this.modalServiceTable.showModal({
              params: event,
              value: event.value,
            });
          }
        },
        cellRenderer: (params: ICellRendererParams) => {
          if (params.node.group) {
            return params.value;
          }
          return params.value;
        }
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
      this.getDataDocument();
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
      id_type: 1,
      idContract: this.type === 'Contract'? this.selectedContract : 0,
      idProject: this.type === 'Project'? this.selectedProject : 0,
      type: this.type,
      name: '',
      amountMX: 0,
      amountDLL: 0,
      comment: '',
      active: 1,
      __isNew: true
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
  }

  async saveChanges() {
    const isValid = this.rowData.every((item) =>
      item.name && item.description && item.start && item.end);
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
      const url = await this.attachHandlerService.uploadImg();
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
  async addDocument() {
    try {
      const url = await this.attachHandlerService.uploadPdf();
      await firstValueFrom(this.conventionsService.uploadDocument(this.id, url));
      alerts.basicAlert(
        'Subir imagen',
        'La imagen ha sido subida con éxito.',
        'success'
      );
      this.getDataDocument();
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

  deleteDocument(id: number) {
    alerts
      .confirmAlert(
        'Eliminar documento',
        '¿Está seguro de querer borrar este documento? Esta acción es irreversible.',
        'warning',
        'Borrar'
      )
      .then((result) => {
        if (result.isConfirmed) {
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
                  'Eliminar documento',
                  'Documento borrado satisfactoriamente.',
                  'success'
                );
                this.getDataDocument();
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

  getDataDocument() {
    this.documents = [];
    this.numItemsDocuments = 0;
    this.conventionsService
      .getDocuments(this.id)
      .pipe(
        tap((data: any[]) => {
          this.documents = data;
          this.numItemsDocuments = this.entradaCarousel.length;
          console.log(this.documents);
        }),
        catchError((error: any) => {
          console.log('No se encontraron datos para el contrato seleccionado.');
          this.documents = []; // O asigna un valor por defecto
          this.numItemsDocuments = 0;
          return of([]); // Devuelve un observable vacío
        }),
        finalize(() => {
          console.log('Listo');
        })
      )
      .subscribe();
  }

}
