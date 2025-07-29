import { Injectable } from '@angular/core';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { ReceivedataService } from './receivedata.service';
import { Base64EncodeService } from './base64encode.service';
import { BlobService } from './blob.service';
import { TrackingService } from './tracking.service';
(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

@Injectable({
  providedIn: 'root',
})
export class PdfGeneratorService {
  entrada: any[] = [];
  photos: any[] = [];
  numPhotos: number = 0;
  numItems: number = 0;
  gestionarDatos: any[] = [];
  gestionarFotos: any[] = [];
  captions: string[] = [];
  imagenes: any = {};
  lb: string;
  id: number;
  punto: number = 1;
  j: number;
  description: any;
  personalData: any[];
  materialesData: any[];
  equiposData: any[];

  constructor(
    private datos: ReceivedataService,
    private imageService: Base64EncodeService,
    private blobService: BlobService,
    private trackingService: TrackingService
  ) {}

  async generatePdfData(inputData: { 
    id: number; 
    date: string; 
    description?: string;
    personalData?: any[];
    materialesData?: any[];
    equiposData?: any[];
    fotografiasData?: any[];
  }) {
    this.id = inputData.id;
    this.lb = inputData.date;
    // Si se proporciona descripción desde la OT, usarla directamente
    if (inputData.description) {
      this.description = inputData.description;
    }
    // Guardar datos para procesamiento
    if (inputData.personalData) {
      this.personalData = inputData.personalData;
    }
    if (inputData.materialesData) {
      this.materialesData = inputData.materialesData;
    }
    if (inputData.equiposData) {
      this.equiposData = inputData.equiposData;
    }
    
    // Si se proporcionan fotografías desde Ordenes, procesarlas directamente
    console.log('Fotografías recibidas en PDF service:', inputData.fotografiasData);
    if (inputData.fotografiasData && inputData.fotografiasData.length > 0) {
      console.log('Procesando fotografías desde Ordenes, cantidad:', inputData.fotografiasData.length);
      await this.processFotografiasFromOrdenes(inputData.fotografiasData);
    } else {
      console.log('No hay fotografías de Ordenes, usando método original');
      // Fallback al método original si no hay fotografías
      await this.conseguirDatos();
    }
    return this.generateDocDefinition();
  }

  private async conseguirDatos() {
    try {
      const datos = await this.datos.recibirDatosForOt(this.lb, this.id).toPromise();
      this.entrada = datos;
      this.numItems = this.entrada.length;

      // Solo obtener nombre de obra si no se proporcionó descripción
      const promises = [this.conseguirDatos2()];
      if (!this.description) {
        promises.push(this.conseguirNombreObra());
      }
      
      await Promise.all(promises);
    } catch (error) {
      console.error('Error occurred:', error);
    }
  }

  private async conseguirDatos2() {
    try {
      const fotos = await this.datos.recibirFotos(this.lb, this.id).toPromise();
      this.photos = fotos;
      this.numPhotos = this.photos.length;
      await this.bucleDatos();
    } catch (error) {
      console.error('Error occurred:', error);
    }
  }

  private conseguirNombreObra() {
    return this.datos
      .recibirNombreObra(this.id)
      .toPromise()
      .then((data) => {
        this.description = data.description;
      })
      .catch((error) => {
        console.error('Error occurred:', error);
      });
  }

  private async processFotografiasFromOrdenes(fotografiasData: any[]) {
    try {
      // Inicializar el objeto de imágenes al principio
      this.imagenes = {};
      console.log('Datos de fotografías a procesar:', fotografiasData);
      // Procesar fotografías directamente desde los datos de Ordenes
      this.photos = fotografiasData.map((foto, index) => {
        console.log(`Foto ${index}:`, foto);
        // Usar imageUrl en lugar de imageAzure que viene como "NO FILE"
        const mappedPhoto = {
          description: foto.descripcion || foto.description || '',
          imageAzure: foto.imageUrl || foto.url || '' // imageUrl contiene la URL real de Firebase
        };
        console.log(`Foto ${index} mapeada:`, mappedPhoto);
        console.log(`URL que se usará: ${mappedPhoto.imageAzure}`);
        return mappedPhoto;
      });
      this.numPhotos = this.photos.length;
      console.log('Total de fotos procesadas:', this.numPhotos);
      
      // Para fotografías desde Ordenes, podemos omitir los datos de notas
      // ya que el PDF se enfoca en las fotografías
      this.entrada = [];
      this.numItems = 0;

      // Procesar directamente las fotografías
      console.log('Procesando fotografías directamente...');
      await this.bucleDatosConFotosFromOrdenes();
      console.log('Procesamiento completado. Estado final de imágenes:', this.imagenes);
    } catch (error) {
      console.error('Error processing fotografias from ordenes:', error);
    }
  }

  private async bucleDatosConFotosFromOrdenes() {
    this.gestionarDatos = [];
    this.gestionarFotos = [];
    this.captions = [];

    // Limpia las claves $$pdfmake$$
    this.limpiarPdfMakeKeys(this.imagenes);
    // NO reinicializar this.imagenes = {} aquí porque borra las imágenes procesadas
    this.j = 1;

    // Procesar notas (igual que bucleDatos original)
    if (this.entrada) {
      const titles = {
        1: 'TRABAJO ANTECEDENTES',
        2: 'ACTIVIDADES RELEVANTES',
        3: 'PROXIMOS PASOS',
      };

      for (let i = 1; i <= 3; i++) {
        const correspondingNotes = this.entrada.filter(
          (note) => note.orden === i
        );

        if (correspondingNotes.length > 0) {
          this.gestionarDatos.push({
            text: i + '.- ' + titles[i],
            style: 'puntosATratar',
          });

          const listItems = correspondingNotes.map((note) => {
            return {
              text: this.splitTextByEmoji(note.description),
              margin: [15, 0, 0, 0],
            };
          });

          this.gestionarDatos.push(listItems);
        } else {
          this.gestionarDatos.push({
            text: i + '.- ' + titles[i],
            style: 'puntosATratar',
          });

          this.gestionarDatos.push({
            text: 'No hay notas en este punto.',
            margin: [15, 0, 0, 0],
          });
        }
      }
    }

    // Procesar fotografías directamente usando las URLs de Firebase
    console.log('Procesando imágenes, total:', this.photos.length);
    for (let index = 0; index < this.photos.length; index++) {
      const photo = this.photos[index];
      this.captions[index] = photo.description;
      console.log(`Procesando imagen ${index}, URL: ${photo.imageAzure}, descripción: ${photo.description}`);
      
      // Convertir la URL de Firebase a base64 para PDFMake
      console.log(`Verificando imagen ${index}: imageAzure = "${photo.imageAzure}"`);
      if (photo.imageAzure && photo.imageAzure !== 'NO FILE') {
        try {
          console.log(`Convirtiendo imagen ${index} a base64...`);
          const base64Image = await this.imageService.convertImageToBase64(photo.imageAzure);
          this.imagenes[`photo${index}`] = base64Image;
          console.log(`Imagen ${index} convertida exitosamente a base64`);
        } catch (error) {
          console.error(`Error convirtiendo imagen ${index}:`, error);
          // Continuar con las siguientes imágenes en caso de error
        }
      } else {
        console.log(`Imagen ${index} no tiene URL válida (es "${photo.imageAzure}"), saltando...`);
      }
    }
    
    console.log('=== FIN DEL PROCESAMIENTO DE IMÁGENES ===');
    console.log('Imágenes procesadas:', Object.keys(this.imagenes));
    console.log('Captions procesadas:', this.captions);
    console.log('Estado final de this.imagenes:', this.imagenes);
  }

  private limpiarPdfMakeKeys(obj: any) {
    Object.keys(obj).forEach((key) => {
      if (key.startsWith('$$pdfmake$$')) {
        delete obj[key];
      }
    });
  }

  private async bucleDatos() {
    this.gestionarDatos = [];
    this.gestionarFotos = [];
    this.captions = [];

    // Limpia las claves $$pdfmake$$
    this.limpiarPdfMakeKeys(this.imagenes);

    this.imagenes = {}; // Asegúrate de inicializar this.imagenes después de limpiar

    this.j = 1;

    if (!this.entrada) {
      return;
    }

    const titles = {
      1: 'TRABAJO ANTECEDENTES',
      2: 'ACTIVIDADES RELEVANTES',
      3: 'PROXIMOS PASOS',
    };

    const foundOrders = new Set<number>();

    for (let i = 1; i <= 3; i++) {
      const correspondingNotes = this.entrada.filter(
        (note) => note.orden === i
      );

      if (correspondingNotes.length > 0) {
        this.gestionarDatos.push({
          text: i + '.- ' + titles[i],
          style: 'puntosATratar',
        });

        const listItems = correspondingNotes.map((note) => {
          return {
            text: this.splitTextByEmoji(note.description),
            margin: [15, 0, 0, 0],
          };
        });

        this.gestionarDatos.push(listItems);

        foundOrders.add(i);
      } else {
        this.gestionarDatos.push({
          text: i + '.- ' + titles[i],
          style: 'puntosATratar',
        });

        this.gestionarDatos.push({
          text: 'No hay notas en este punto.',
          margin: [15, 0, 0, 0],
        });
      }
    }

    const orderedPhotos = this.photos.map((item, index) => ({ item, index }));

    for (const { item, index } of orderedPhotos) {
      this.captions[index] = item.description;
      const blobUrl = await this.blobService
        .sendBlobUrl(item.imageAzure)
        .toPromise();
      this.imagenes[`photo${index}`] =
        await this.imageService.convertImageToBase64(blobUrl.url);
    }
  }

  private convertirFecha(dateString: string): string {
    const date = new Date(dateString);
    const monthsOfYear = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];

    const day = date.getDate();
    const monthName = monthsOfYear[date.getMonth()];
    const year = date.getFullYear();

    return `Fecha: ${day} de ${monthName} de ${year}`;
  }

  private splitTextByEmoji(text: string) {
    const emojiRegex =
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const parts = text.split(emojiRegex);
    const emojis = text.match(emojiRegex) || [];

    const result = [];
    for (let i = 0; i < parts.length; i++) {
      if (parts[i]) {
        result.push({ text: parts[i], font: 'Montserrat' });
      }
      if (emojis[i]) {
        result.push({ text: emojis[i], font: 'Emoji' });
      }
    }

    return result;
  }

  private processPersonalData() {
    if (!this.personalData || this.personalData.length === 0) {
      return [
        ['Cargo', 'Cantidad'],
        ['No hay datos de personal', '0']
      ];
    }

    // Agrupar por cargo y sumar cantidades
    const cargoMap = new Map<string, number>();
    
    this.personalData.forEach(person => {
      const cargo = person.position || 'Sin cargo';
      const cantidad = parseInt(person.quantity) || 1;
      
      if (cargoMap.has(cargo)) {
        cargoMap.set(cargo, cargoMap.get(cargo)! + cantidad);
      } else {
        cargoMap.set(cargo, cantidad);
      }
    });

    // Convertir a array para la tabla
    const tableData = [['Cargo', 'Cantidad']];
    cargoMap.forEach((cantidad, cargo) => {
      tableData.push([cargo, cantidad.toString()]);
    });

    return tableData;
  }

  private processMaterialesData() {
    if (!this.materialesData || this.materialesData.length === 0) {
      return [
        ['Material', 'Cantidad', 'Unidad'],
        ['No hay datos de materiales', '0', '-']
      ];
    }

    // Agrupar por nombre de material y sumar cantidades
    const materialMap = new Map<string, { cantidad: number, unidad: string }>();
    
    this.materialesData.forEach(material => {
      const nombre = material.nombre || 'Sin nombre';
      const cantidad = parseInt(material.cantidad) || 0;
      const unidad = material.unidad || 'unidad';
      
      if (materialMap.has(nombre)) {
        const existing = materialMap.get(nombre)!;
        materialMap.set(nombre, { 
          cantidad: existing.cantidad + cantidad, 
          unidad: existing.unidad 
        });
      } else {
        materialMap.set(nombre, { cantidad, unidad });
      }
    });

    // Convertir a array para la tabla
    const tableData = [['Material', 'Cantidad', 'Unidad']];
    materialMap.forEach((data, nombre) => {
      tableData.push([nombre, data.cantidad.toString(), data.unidad]);
    });

    return tableData;
  }

  private processEquiposData() {
    if (!this.equiposData || this.equiposData.length === 0) {
      return [
        ['Equipo', 'Horas'],
        ['No hay datos de equipos', '0']
      ];
    }

    // Agrupar por nombre de equipo y sumar horas
    const equipoMap = new Map<string, number>();
    
    this.equiposData.forEach(equipo => {
      const nombre = equipo.nombre || 'Sin nombre';
      const horas = parseFloat(equipo.horasUso) || 0;
      
      if (equipoMap.has(nombre)) {
        equipoMap.set(nombre, equipoMap.get(nombre)! + horas);
      } else {
        equipoMap.set(nombre, horas);
      }
    });

    // Convertir a array para la tabla
    const tableData = [['Equipo', 'Horas']];
    equipoMap.forEach((horas, nombre) => {
      tableData.push([nombre, horas.toFixed(1)]);
    });

    return tableData;
  }

  private generateDocDefinition() {
    console.log('=== GENERANDO DOCUMENTO PDF ===');
    console.log('Imágenes ANTES de limpiar:', this.imagenes);
    console.log('Keys ANTES de limpiar:', Object.keys(this.imagenes));
    
    this.limpiarPdfMakeKeys(this.imagenes);
    
    console.log('Imágenes DESPUÉS de limpiar:', this.imagenes);
    const imageKeys = Object.keys(this.imagenes).sort();
    console.log('Keys de imágenes:', imageKeys);
    console.log('Número total de imágenes:', imageKeys.length);
    console.log('¿Existe photo0?', !!this.imagenes['photo0']);
    console.log('Contenido de photo0:', this.imagenes['photo0'] ? this.imagenes['photo0'].substring(0, 100) : 'No existe');

    const contenido = [];

    if (imageKeys.length === 0 || !this.imagenes['photo0']) {
      console.log('No hay imágenes válidas, mostrando mensaje de no fotografías');
      contenido.push({
        text: 'No hay fotografías subidas.',
        margin: [15, 0, 0, 0],
      });
    } else {
      console.log('Procesando imágenes para el PDF, total:', imageKeys.length);
      for (let i = 0; i < imageKeys.length; i += 2) {
        const rowcontenido = {
          columns: [],
          columnGap: 20,
        };

        if (!this.imagenes[imageKeys[i]].startsWith('data:text/xml;base64')) {
          rowcontenido.columns.push({
            width: '*',
            stack: [
              {
                image: this.imagenes[imageKeys[i]],
                width: 200,
                height: 134,
                alignment: 'center',
                margin: [0, 0, 0, 0],
              },
            ],
            layout: {
              hLineColor: 'transparent',
              vLineColor: 'transparent',
              paddingBottom: 0,
            },
          });
        }

        if (
          i + 1 < imageKeys.length &&
          !this.imagenes[imageKeys[i + 1]].startsWith('data:text/xml;base64')
        ) {
          rowcontenido.columns.push({
            width: '*',
            stack: [
              {
                image: this.imagenes[imageKeys[i + 1]],
                width: 200,
                height: 134,
                alignment: 'center',
                margin: [0, 0, 0, 0],
              },
            ],
            layout: {
              hLineColor: 'transparent',
              vLineColor: 'transparent',
              paddingBottom: 0,
            },
          });
        }

        contenido.push(rowcontenido);

        const rowCaptions = {
          columns: [],
          columnGap: 20,
        };

        if (!this.imagenes[imageKeys[i]].startsWith('data:text/xml;base64')) {
          rowCaptions.columns.push({
            width: '*',
            text: this.captions[i] || '',
            style: 'captionsImg',
            margin: [0, 0, 0, 10],
          });
        }

        if (
          i + 1 < imageKeys.length &&
          !this.imagenes[imageKeys[i + 1]].startsWith('data:text/xml;base64')
        ) {
          rowCaptions.columns.push({
            width: '*',
            text: this.captions[i + 1] || '',
            style: 'captionsImg',
            margin: [0, 0, 0, 10],
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
        bolditalics:
          'https://fonts.cdnfonts.com/s/14883/Montserrat-BoldItalic.ttf',
      },
      Emoji: {
        normal:
          'https://cdn.jsdelivr.net/fontsource/fonts/noto-emoji@latest/emoji-400-normal.ttf',
        bold: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-emoji@latest/emoji-400-normal.ttf',
        italics:
          'https://cdn.jsdelivr.net/fontsource/fonts/noto-emoji@latest/emoji-400-normal.ttf',
        bolditalics:
          'https://cdn.jsdelivr.net/fontsource/fonts/noto-emoji@latest/emoji-400-normal.ttf',
      },
    };

    const docDefinition = {
      pageSize: 'LETTER',
      pageMargins: [80, 80, 80, 40],
      defaultStyle: {
        fontSize: 9,
        alignment: 'justify',
        font: 'Montserrat',
        lineHeight: 1.2,
      },
      styles: {
        obra: {
          fontSize: 9,
          alignment: 'left',
          margin: [0, 10],
        },
        fecha: {
          fontSize: 7,
          alignment: 'right',
          margin: [0, 10],
        },
        title: {
          fontSize: 11,
          alignment: 'center',
          margin: [0, 0, 0, 10],
        },
        puntosATratar: {
          fontSize: 10,
          alignment: 'justify',
          bold: true,
          decoration: 'underline',
          margin: [0, 10, 0, 10],
        },
        boldUl: {
          bold: true,
          margin: [20, 0, 0, 0],
        },
        defaultUl: {
          margin: [20, 0, 0, 0],
        },
        revisan: {
          fontSize: 5,
          alignment: 'justify',
          margin: [15, 10, 0, 10],
        },
        numPag: {
          Alignment: 'right',
          fontSize: 6,
          margin: [0, -15, 20, 0],
        },
        captionsImg: {
          alignment: 'center',
          fontSize: 8,
          bold: true,
          margin: [0, 4, 0, 10],
        },
        tableHeader: {
          fontSize: 9,
          bold: true,
          alignment: 'center',
          margin: [0, 0, 0, 5],
        },
        tableContent: {
          fontSize: 8,
          margin: [0, 0, 0, 0],
        },
      },
      header: {
        image: 'zheader',
        width: 100,
        alignment: 'center',
        margin: [0, 5, 0, 5],
      },
      footer: (currentPage, pageCount) => [
        {
          image: 'zfooter',
          width: 100,
          alignment: 'center',
        },
        {
          text: `Pag. ${currentPage} de ${pageCount}`,
          style: 'numPag',
        },
      ],
      content: [
        {
          table: {
            widths: ['60%', '15%', '25%'],
            body: [
              [
                {
                  text: [{ text: 'Descripción del servicio: ', bold: true }, this.description],
                  style: 'obra',
                },
                {
                  text: '',
                },
                {
                  text: this.convertirFecha(this.lb || this.entrada[0]?.date || ''),
                  style: 'fecha',
                  alignment: 'right',
                },
              ],
            ],
          },
          layout: 'noBorders',
        },
        { text: 'Reporte de Bitácora', style: 'title' },
        ...this.gestionarDatos,
        { text: '', pageBreak: 'after' },
        {
          text: '4.- REPORTE FOTOGRAFICO',
          pageBreak: (currentPage, pageSize, currentNode, nodesOnPage) => {
            return nodesOnPage.length > 0 ? 'before' : '';
          },
          style: 'puntosATratar',
        },
        ...contenido,
        { text: '', pageBreak: 'after' },
        {
          text: '5.- CONTROL DE RECURSOS',
          style: 'puntosATratar',
          margin: [0, 20, 0, 10]
        },
        {
          columns: [
            {
              width: '33%',
              stack: [
                {
                  text: 'CONTROL DE PERSONAL',
                  style: 'tableHeader',
                  margin: [0, 0, 0, 5]
                },
                {
                  table: {
                    headerRows: 1,
                    widths: ['*', 'auto'],
                    body: this.processPersonalData()
                  },
                  layout: {
                    fillColor: function (rowIndex) {
                      return (rowIndex === 0) ? '#CCCCCC' : null;
                    }
                  },
                  style: 'tableContent'
                }
              ]
            },
            {
              width: '33%',
              stack: [
                {
                  text: 'CONTROL DE MATERIALES',
                  style: 'tableHeader',
                  margin: [0, 0, 0, 5]
                },
                {
                  table: {
                    headerRows: 1,
                    widths: ['*', 'auto', 'auto'],
                    body: this.processMaterialesData()
                  },
                  layout: {
                    fillColor: function (rowIndex) {
                      return (rowIndex === 0) ? '#CCCCCC' : null;
                    }
                  },
                  style: 'tableContent'
                }
              ]
            },
            {
              width: '33%',
              stack: [
                {
                  text: 'CONTROL DE EQUIPOS',
                  style: 'tableHeader',
                  margin: [0, 0, 0, 5]
                },
                {
                  table: {
                    headerRows: 1,
                    widths: ['*', 'auto'],
                    body: this.processEquiposData()
                  },
                  layout: {
                    fillColor: function (rowIndex) {
                      return (rowIndex === 0) ? '#CCCCCC' : null;
                    }
                  },
                  style: 'tableContent'
                }
              ]
            }
          ],
          columnGap: 10
        }
      ],
      images: {
        zheader: this.trackingService.getPictureComp2(),
        zfooter: this.trackingService.getPictureComp3(),
      },
    };
    return docDefinition;
  }
}
