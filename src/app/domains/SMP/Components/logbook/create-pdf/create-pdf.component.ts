import { HttpClient } from '@angular/common/http';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { BlobService } from 'app/services/blob.service';

import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
//import { TDocumentDefinitions, Alignment } from 'pdfmake/interfaces';
(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

import { catchError, finalize, of, tap } from 'rxjs';

import { ReceivedataService } from 'app/services/receivedata.service';
import { Base64encodeService } from 'app/services/base64encode.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-create-pdf',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './create-pdf.component.html',
  styleUrl: './create-pdf.component.scss'
})
export class CreatePdfComponent implements OnChanges {
  @Input() inputData: { id: number, date: string };
  entrada: any[] = [];
  photos: any[] = [];
  numPhotos: number = 0;
  numItems: number = 0;
  gestionarDatos: any[] = [];
  gestionarFotos: any[] = [];
  captions: string[] = [];
  imagenes: any = {};
  urlAzure = 'https://bi24.azurewebsites.net/api/Logbook';
  lb: string;
  id: number;
  punto: number = 1;
  isLoading: boolean = true;
  isGeneratingPdf: boolean = false;
  j: number;

  // Recibe estos datos desde el componente padre
  ngOnChanges(changes: SimpleChanges) {
    if (changes['inputData'] && changes['inputData'].currentValue) {
      this.id = this.inputData.id;
      this.lb = this.inputData.date;
      this.conseguirDatos();
    }
  }

  constructor(private datos: ReceivedataService, private http: HttpClient, private imageService: Base64encodeService, private blobService: BlobService) { }

  // Leyendo la API
  conseguirDatos() {
    this.isLoading = true;
    this.datos.recibirDatos(this.urlAzure, this.lb, this.id).pipe(
      tap(data => {
        this.entrada = data;
        this.numItems = this.entrada.length;
      }),
      catchError(error => {
        console.error('Error occurred:', error);
        return of(null);
      }),
      finalize(() => {
        this.conseguirDatos2();
        this.isLoading = false;
      })
    ).subscribe();
  }

  conseguirDatos2() {
    this.datos.recibirDatos(this.urlAzure + '/showphotos', this.lb, this.id).pipe(
      tap(data => {
        this.photos = data;
        this.numPhotos = this.photos.length;
        this.bucleDatos();  // Moved here to ensure it runs after photos are loaded
      }),
      catchError(error => {
        console.error('Error occurred:', error);
        return of(null);
      })
    ).subscribe();
  }

  // Generamos los datos para que pdfmake pueda 
  // leer esos datos.
  async bucleDatos() {
    this.gestionarDatos = [];
    this.gestionarFotos = [];
    this.captions = [];
    this.imagenes = {};
    this.j = 1;

    if (!this.entrada) {
      return;
    }

    const titles = {
      1: "TRABAJO ANTECEDENTES",
      2: "ACTIVIDADES RELEVANTES",
      3: "PROXIMOS PASOS"
    };

    const foundOrders = new Set<number>();

    // Recorre los títulos en orden
    for (let i = 1; i <= 3; i++) {
      const correspondingNotes = this.entrada.filter(note => note.orden === i);

      if (correspondingNotes.length > 0) {
        this.gestionarDatos.push({
          text: i + '.- ' + titles[i],
          style: 'puntosATratar'
        });

        for (const note of correspondingNotes) {
          this.gestionarDatos.push({ text: note.description, margin: [15, 0, 0, 0] });
        }

        foundOrders.add(i);
      } else {
        this.gestionarDatos.push({
          text: i + '.- ' + titles[i],
          style: 'puntosATratar'
        });
        this.gestionarDatos.push({ text: 'No hay notas en este punto.', margin: [15, 0, 0, 0] });
      }
    }

    const orderedPhotos = this.photos.map((item, index) => ({ item, index }));

    for (const { item, index } of orderedPhotos) {
      this.captions[index] = item.description;
      const blobUrl = await this.blobService.sendBlobUrl(item.imageAzure).toPromise();
      this.imagenes[`photo${index}`] = await this.imageService.convertImageToBase64(blobUrl.url);
    }
  }

  // Convierto la fecha para el encabezado
  convertirFecha(dateString: string): string {
    const date = new Date(dateString);
    const monthsOfYear = ['Enero', 'Febrero', 'Marzo', 'Abril',
      'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre',
      'Octubre', 'Noviembre', 'Diciembre'];

    const day = date.getDate();
    const monthName = monthsOfYear[date.getMonth()];
    const year = date.getFullYear();

    return `Fecha: ${day} de ${monthName} de ${year}`;
  }

  async crearPdf() {
    console.log(this.imagenes);
    if (this.entrada.length > 0) {
      this.isGeneratingPdf = true;
      await this.bucleDatos();  // Consigo los datos

      const contenido = [];
      const imageKeys = Object.keys(this.imagenes).sort();

      if (imageKeys.length === 0 || !this.imagenes["photo0"]) {
        contenido.push({
          text: 'No hay fotografías subidas.',
          margin: [15, 0, 0, 0]
        });
      } else {
        for (let i = 0; i < imageKeys.length; i += 2) {
          const rowcontenido = {
            columns: [],
            columnGap: 20
          };

          if (!this.imagenes[imageKeys[i]].startsWith("data:text/xml;base64")) {
            rowcontenido.columns.push({
              width: '*',
              stack: [
                {
                  image: this.imagenes[imageKeys[i]],
                  width: 200,
                  height: 134,
                  alignment: 'center',
                  margin: [0, 0, 0, 0],
                }
              ],
              layout: {
                hLineColor: 'transparent',
                vLineColor: 'transparent',
                paddingBottom: 0
              }
            });
          }

          if (i + 1 < imageKeys.length && !this.imagenes[imageKeys[i + 1]].startsWith("data:text/xml;base64")) {
            rowcontenido.columns.push({
              width: '*',
              stack: [
                {
                  image: this.imagenes[imageKeys[i + 1]],
                  width: 200,
                  height: 134,
                  alignment: 'center',
                  margin: [0, 0, 0, 0],
                }
              ],
              layout: {
                hLineColor: 'transparent',
                vLineColor: 'transparent',
                paddingBottom: 0
              }
            });
          }

          contenido.push(rowcontenido);

          const rowCaptions = {
            columns: [],
            columnGap: 20
          };

          if (!this.imagenes[imageKeys[i]].startsWith("data:text/xml;base64")) {
            rowCaptions.columns.push({
              width: '*',
              text: this.captions[i] || '',
              style: 'captionsImg',
              margin: [0, 0, 0, 10]
            });
          }

          if (i + 1 < imageKeys.length && !this.imagenes[imageKeys[i + 1]].startsWith("data:text/xml;base64")) {
            rowCaptions.columns.push({
              width: '*',
              text: this.captions[i + 1] || '',
              style: 'captionsImg',
              margin: [0, 0, 0, 10]
            });
          }

          contenido.push(rowCaptions);
        }
      }

      pdfMake.fonts = {
        Montserrat: {
          normal: 'https://fonts.cdnfonts.com/s/14883/Montserrat-Regular.ttf',
          bold: 'https://fonts.cdnfonts.com/s/14883/Montserrat-Bold.ttf',
          italics: 'https://fonts.cdnfonts.com/s/14883/Montserrat-Italic.ttf',
          bolditalics: 'https://fonts.cdnfonts.com/s/14883/Montserrat-BoldItalic.ttf'
        },
      };

      // Imagenes de encabezado y pie de pagina
      const encabezado = 'data:image/jpg;base64,/9j/4AAQSkZJRgABAQEAlgCWAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAQDAwMDAgQDAwMEBAQFBgoGBgUFBgwICQcKDgwPDg4MDQ0PERYTDxAVEQ0NExoTFRcYGRkZDxIbHRsYHRYYGRj/2wBDAQQEBAYFBgsGBgsYEA0QGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBj/wAARCABxBL8DASIAAhEBAxEB/8QAHQABAAEFAQEBAAAAAAAAAAAAAAcBAgUGCAQDCf/EAFIQAAEDAwMCBAQDBAYGBQgLAAEAAgMEBREGBxIhMQgTQVEUImFxMoGRFUJSoRYXI7HB0RgzQ3J0oiQoVmLhJzZzg5KzwtJGU2NkZXWClJWlsv/EABsBAQADAQEBAQAAAAAAAAAAAAABAgMEBQYH/8QANxEAAgIBAwIFAgQEBAcAAAAAAAECEQMEEiEFMRMiQVFhFHEygaHBBiNC8EORseEVM0RyktHS/9oADAMBAAIRAxEAPwDv5ERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAVCcKqoeoKAoX4OMLz1FxoaQtFXWU9PyOG+bIGcvtlc3+I3xHXDby6xaP0X8M+9lgkqqmZnmNpQfwtDexce65I1pu7uBuBNSS6nvnxBpMiEQwtjDc9z0HVZPKk6OrHpJTVtn6msmjkjD43Nc09QWnIKvz1XBW1vik1hpWlorJqGjpLtZYY+DHNHCoaB6A9nH7rtXRur7RrjSNHqOxzebR1LcgH8UbvVrh6EKYZFJ0Z5cEsfLNhREWhiFTKZ+XKt5OHogL1TP0VAemVbyJ7BCPsfQFMqxpy7B6fdC5wd0HRBbLs/RVVnJ38Jwr0JCplUcTkADKoDluUIdovREQkIiIAiIgCJnqqZSwVVCVa+RrYy4noOq1uv1U1tEai20T61gHNpBDeY5cXcc+o74KrKaj3JjFy7GzZB9VVRvUaqr6mmMsVwMTHBzeIjDHtc2UBwIPUHg79VdLeLsH1DHV0/kwskNFKxvWqeCMA+/t9VzfUw9DTwmSLke6fmtV03da643ivbUztMcTWlrGNHEZ9j79wQV9qDWVrqJ3wTOMUhqpKaJuC4yBgyX49B9StY5o0m+Crg7o2VF8oamCogbNBK2SN4y17TkEL6Z6rYoVREQBEJwqZSwVRUymUBVFTl1TkPqgKoqZTIQWVRUymUsFUVMplRYKoqZTKkFUVMjKr6JYCKmQhOEsFUVMhOQQiyqKmQThVQkIqZ6quUAREQBERAEREAREQBEVMoAThUz06lWucOQzlc872b3VWndVUentK1DTPRzNmr5B1BA6+V+fr+SyzZo4o7pHZoNBm12XwcK5OiM/VVBWuaL1ZbtaaOo9QW14dFO352+sbx+Jp+oK2JpB7LRNSVo5smOWOThNU1wXIiKSgREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERA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';

      const pieDePagina = 'data:image/jpg;base64,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';

      const docDefinition = {
        pageSize: 'LETTER',
        pageMargins: [80, 80, 80, 40],
        defaultStyle: {
          fontSize: 9,
          alignment: 'justify',
          font: 'Montserrat',
          lineHeight: 1.2
        },
        styles: {
          fecha: {
            fontSize: 7,
            alignment: 'right',
            margin: [0, 10]
          },
          title: {
            fontSize: 11,
            alignment: 'center',
            margin: [0, 0, 0, 10]
          },
          puntosATratar: {
            fontSize: 10,
            alignment: 'justify',
            bold: true,
            decoration: 'underline',
            margin: [0, 10, 0, 10]
          },
          boldUl: {
            bold: true,
            margin: [20, 0, 0, 0]
          },
          defaultUl: {
            margin: [20, 0, 0, 0]
          },
          revisan: {
            fontSize: 5,
            alignment: 'justify',
            margin: [15, 10, 0, 10]
          },
          numPag: {
            Alignment: 'right',
            fontSize: 6,
            margin: [0, -15, 20, 0]
          },
          captionsImg: {
            alignment: 'center',
            fontSize: 8,
            bold: true,
            margin: [0, 4, 0, 10]
          }
        },
        header: encabezado
          ? {
            image: encabezado,
            width: 600,
            alignment: 'center',
            margin: [0, 10, 0, 0]
          }
          : undefined,
        footer: (currentPage, pageCount) => [
          pieDePagina
            ? {
              image: pieDePagina,
              width: 450,
              alignment: 'center'
            }
            : null,
          {
            text: `Pag. ${currentPage} de ${pageCount}`,
            style: 'numPag'
          }
        ],
        content: [
          { text: this.convertirFecha(this.entrada[0]?.date || ''), style: 'fecha' },
          { text: 'Reporte de Bitácora', style: 'title' },
          ...this.gestionarDatos,
          { text: '', pageBreak: 'after' },
          {
            text: '4.- REPORTE FOTOGRAFICO',
            pageBreak: (currentPage, pageSize, currentNode, nodesOnPage) => {
              return nodesOnPage.length > 0 ? 'before' : '';
            },
            style: 'puntosATratar'
          },
          ...contenido
        ],
        images: this.imagenes
      };
      pdfMake.createPdf(docDefinition as any).open();
      this.isGeneratingPdf = false;
    } else {
      console.log('No hay datos en el JSON');
    }
  }
}

