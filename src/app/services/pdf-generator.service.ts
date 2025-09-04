import { Injectable, effect } from '@angular/core';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { ReceivedataService } from './receivedata.service';
import { Base64EncodeService } from './base64encode.service';
import { BlobService } from './blob.service';
import { TrackingService } from './tracking.service';
import { LogbookService } from './logbook.service';
import { MaterialsService } from './materials.service';
import { SignalsService } from './signals.service';
import { CatalogsService } from './catalogs.service';
import { EquipmentService } from './equipment.service';
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
  idReport: number;
  punto: number = 1;
  j: number;
  description: any;
  personalData: any[];
  materialesData: any[];
  equiposData: any[];
  idcompany: number;
  catalogMateriales: any[] = [];
  unitsCatalog: any[] = [];
  catalogEquipos: any[] = [];
  notasData: any[] = [];
  typeNotesCatalog: any[] = [];
  conceptosData: any[] = [];
  conceptosCatalog: any[] = [];

  constructor(
    private datos: ReceivedataService,
    private imageService: Base64EncodeService,
    private blobService: BlobService,
    private trackingService: TrackingService,
    private logbookService: LogbookService, 
    private materialsService: MaterialsService,
    private signalsService: SignalsService,
    private catalogsService: CatalogsService,
    private equipmentService: EquipmentService
  ) {

    effect(() => { 
      this.idcompany = this.signalsService.getRootSelectedBySidebar()();
      this.catalogoMateriales();
      this.catalogoEquipo();
      this.obtenerUnidades();
    })
  }

  async generatePdfData(inputData: { 
    id: number; 
    date: string; 
    description?: string;
    personalData?: any[];
    materialesData?: any[];
    equiposData?: any[];
    fotografiasData?: any[];
    notasData?: any[];
    idReport?: number;
    typeNotesCatalog?: any[];
    conceptosData?: any[];
    conceptosCatalog?: any[];
  }) {
    console.log('Input data for PDF generation:', inputData);
    this.id = inputData.id;
    this.lb = inputData.date;
    this.idReport = inputData.idReport;
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
    if (inputData.notasData) {
      this.notasData = inputData.notasData;
    }
    if (inputData.typeNotesCatalog) {
      this.typeNotesCatalog = inputData.typeNotesCatalog;
    }
    if (inputData.conceptosData) {
      this.conceptosData = inputData.conceptosData;
    }
    if (inputData.conceptosCatalog) {
      this.conceptosCatalog = inputData.conceptosCatalog;
    }

    // Si se proporcionan fotografías desde Ordenes, procesarlas directamente
    if (inputData.fotografiasData && inputData.fotografiasData.length > 0) {
      await this.processFotografiasFromOrdenes(inputData.fotografiasData);
    } else {
      // Fallback al método original si no hay fotografías
      await this.conseguirDatos();
    }
    return this.generateDocDefinition();
  }

  private async conseguirDatos() {
    try {
      // Priorizar notasData si está disponible
      if (this.notasData && this.notasData.length > 0) {
        this.processNotasDataLocally();
      } else if (this.idReport) {
        // Si se proporciona idReport, usar el nuevo método para obtener todas las notas
        await this.obtenerTodasLasNotas();
      } else {
        // Fallback al método original
        const datos = await this.datos.recibirDatosForOt(this.lb, this.id).toPromise();
        this.entrada = datos;
        this.numItems = this.entrada.length;
      }

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

  private async obtenerNotasFromReport(typeNote: string) {
    try {
      const response = await this.logbookService.getNotesFromReport(this.idReport, typeNote).toPromise();
      
      if (response && response.success && response.data) {
        const notasMapeadas = response.data.map((nota: any) => {
          return {
            description: nota.description || '',
            typeNote: typeNote, // Mantener el typeNote original para filtrado
            orden: nota.orden || 1 // Mantener orden como backup
          };
        });
        return notasMapeadas;
      } else {
        return [];
      }
    } catch (error) {
      console.error(`Error obteniendo notas de ${typeNote}:`, error);
      return [];
    }
  }

  private async obtenerTodasLasNotas() {
    try {
      const todasLasNotas = [];
      
      if (this.typeNotesCatalog && this.typeNotesCatalog.length > 0) {
        // Obtener notas dinámicamente basado en el catálogo
        for (const tipo of this.typeNotesCatalog) {
          const notasTipo = await this.obtenerNotasFromReport(tipo.description);
          todasLasNotas.push(...notasTipo);
        }
      } else {
        // Fallback a los tipos hardcodeados
        const notasAntecedentes = await this.obtenerNotasFromReport('TRABAJO ANTECEDENTES');
        const notasActividades = await this.obtenerNotasFromReport('ACTIVIDADES RELEVANTES');
        todasLasNotas.push(...notasAntecedentes, ...notasActividades);
      }
      
      this.entrada = todasLasNotas;
      this.numItems = this.entrada.length;
      
    } catch (error) {
      console.error('Error obteniendo todas las notas:', error);
      this.entrada = [];
      this.numItems = 0;
    }
  }

  private async processFotografiasFromOrdenes(fotografiasData: any[]) {
    try {
      // Inicializar el objeto de imágenes al principio
      this.imagenes = {};
      // Procesar fotografías directamente desde los datos de Ordenes
      this.photos = fotografiasData.map((foto, index) => {
        // Usar imageUrl en lugar de imageAzure que viene como "NO FILE"
        const mappedPhoto = {
          description: foto.descripcion || foto.description || '',
          imageAzure: foto.imageUrl || foto.url || '' // imageUrl contiene la URL real de Firebase
        };
        return mappedPhoto;
      });
      this.numPhotos = this.photos.length;
      
      // Priorizar notasData si está disponible, sino usar idReport
      if (this.notasData && this.notasData.length > 0) {
        this.processNotasDataLocally();
      } else if (this.idReport) {
        await this.obtenerTodasLasNotas();
      } else {
        // Para fotografías desde Ordenes sin idReport ni notasData, omitir los datos de notas
        this.entrada = [];
        this.numItems = 0;
      }

      // Procesar directamente las fotografías
      await this.bucleDatosConFotosFromOrdenes();
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

    // Procesar notas usando typeNote en lugar de orden
    if (this.entrada) {
      const secciones = this.generateSecciones();

      secciones.forEach(seccion => {
        const correspondingNotes = this.entrada.filter((note) => {
          // Si tenemos typeNoteId en la sección, usarlo para matching
          if (seccion.typeNoteId !== null && note.typeNoteId) {
            return note.typeNoteId === seccion.typeNoteId;
          }
          // Fallback a comparación por descripción
          return note.typeNote === seccion.typeNote;
        });

        if (correspondingNotes.length > 0) {
          this.gestionarDatos.push({
            text: seccion.titulo,
            style: 'puntosATratar',
          });

          const listItems = correspondingNotes.map((note) => {
            return {
              text: [
                { text: '• ', font: 'Montserrat' }, // Agregar bullet point
                ...this.splitTextByEmoji(note.description)
              ],
              margin: [15, 0, 0, 0],
            };
          });

          this.gestionarDatos.push(listItems);
        } else {
          this.gestionarDatos.push({
            text: seccion.titulo,
            style: 'puntosATratar',
          });

          this.gestionarDatos.push({
            text: 'No hay notas en este punto.',
            margin: [15, 0, 0, 0],
          });
        }
      });
    }

    // Procesar fotografías directamente usando las URLs de Firebase
    for (let index = 0; index < this.photos.length; index++) {
      const photo = this.photos[index];
      this.captions[index] = photo.description;
      
      // Convertir la URL de Firebase a base64 para PDFMake
      if (photo.imageAzure && photo.imageAzure !== 'NO FILE') {
        try {
          const base64Image = await this.imageService.convertImageToBase64(photo.imageAzure);
          this.imagenes[`photo${index}`] = base64Image;
        } catch (error) {
          console.error(`Error convirtiendo imagen ${index}:`, error);
          // Continuar con las siguientes imágenes en caso de error
        }
      }
    }
  }

  private limpiarPdfMakeKeys(obj: any) {
    Object.keys(obj).forEach((key) => {
      if (key.startsWith('$$pdfmake$$')) {
        delete obj[key];
      }
    });
  }

  private generateSecciones() {
    if (!this.typeNotesCatalog || this.typeNotesCatalog.length === 0) {
      // Fallback a las secciones hardcodeadas si no hay catálogo
      return [
        { typeNoteId: null, typeNote: 'TRABAJO ANTECEDENTES', titulo: '1.- TRABAJO ANTECEDENTES' },
        { typeNoteId: null, typeNote: 'ACTIVIDADES RELEVANTES', titulo: '2.- ACTIVIDADES RELEVANTES' }
      ];
    }

    // Generar secciones dinámicamente desde el catálogo usando IDs
    return this.typeNotesCatalog.map((tipo, index) => ({
      typeNoteId: tipo.id, // ID del tipo de nota para matching
      typeNote: tipo.description, // Descripción para compatibilidad
      titulo: `${index + 1}.- ${tipo.description}`
    }));
  }

  private processNotasDataLocally() {
    if (!this.notasData || this.notasData.length === 0) {
      console.log('No hay notasData para procesar');
      this.entrada = [];
      this.numItems = 0;
      return;
    }

    console.log('Procesando notasData localmente:', this.notasData);
    console.log('typeNotesCatalog disponible:', this.typeNotesCatalog);

    // Mapear las notas locales al formato esperado
    this.entrada = this.notasData.map((nota: any) => {
      // Buscar el tipo de nota en el catálogo para obtener la descripción
      const tipoNota = this.typeNotesCatalog?.find(tipo => tipo.id === nota.idResource);
      
      return {
        description: nota.description || '',
        typeNote: tipoNota ? tipoNota.description : 'SIN TIPO', // Usar descripción del catálogo
        typeNoteId: nota.idResource, // ID del tipo de nota
        orden: nota.orden || 1
      };
    });

    this.numItems = this.entrada.length;
    console.log('Notas procesadas para PDF:', this.entrada);
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

    // Verificar si tenemos typeNote (datos del nuevo endpoint) o usar orden (datos antiguos)
    const tieneTypeNote = this.entrada.some(note => note.typeNote);
    
    if (tieneTypeNote) {
      // Usar el nuevo método basado en typeNote
      const secciones = this.generateSecciones();

      secciones.forEach(seccion => {
        const correspondingNotes = this.entrada.filter((note) => {
          // Si tenemos typeNoteId en la sección, usarlo para matching
          if (seccion.typeNoteId !== null && note.typeNoteId) {
            return note.typeNoteId === seccion.typeNoteId;
          }
          // Fallback a comparación por descripción
          return note.typeNote === seccion.typeNote;
        });

        if (correspondingNotes.length > 0) {
          this.gestionarDatos.push({
            text: seccion.titulo,
            style: 'puntosATratar',
          });

          const listItems = correspondingNotes.map((note) => {
            return {
              text: [
                { text: '• ', font: 'Montserrat' }, // Agregar bullet point
                ...this.splitTextByEmoji(note.description)
              ],
              margin: [15, 0, 0, 0],
            };
          });

          this.gestionarDatos.push(listItems);
        } else {
          this.gestionarDatos.push({
            text: seccion.titulo,
            style: 'puntosATratar',
          });

          this.gestionarDatos.push({
            text: 'No hay notas en este punto.',
            margin: [15, 0, 0, 0],
          });
        }
      });
    } else {
      // Fallback al método original basado en orden
      const titles = {
        1: 'TRABAJO ANTECEDENTES',
        2: 'ACTIVIDADES RELEVANTES'
      };

      for (let i = 1; i <= 2; i++) {
        const correspondingNotes = this.entrada.filter(
          (note) => note.orden === i
        );

        if (correspondingNotes.length > 0) {
          this.gestionarDatos.push({
            text: (i) + '.- ' + titles[i],
            style: 'puntosATratar',
          });

          const listItems = correspondingNotes.map((note) => {
            return {
              text: [
                { text: '• ', font: 'Montserrat' }, // Agregar bullet point
                ...this.splitTextByEmoji(note.description)
              ],
              margin: [15, 0, 0, 0],
            };
          });

          this.gestionarDatos.push(listItems);
        } else {
          this.gestionarDatos.push({
            text: (i) + '.- ' + titles[i],
            style: 'puntosATratar',
          });

          this.gestionarDatos.push({
            text: 'No hay notas en este punto.',
            margin: [15, 0, 0, 0],
          });
        }
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
        ['Cargo', 'Can.'],
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
    const tableData = [['Cargo', 'Can.']];
    cargoMap.forEach((cantidad, cargo) => {
      tableData.push([cargo, cantidad.toString()]);
    });

    return tableData;
  }
  private processNotasData() {
    /*if (!this.notasData || this.notasData.length === 0) {
      return [
        ['Nota', 'Descripción'],
        ['No hay datos de notas', '0']
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
    const tableData = [['Cargo', 'Can.']];
    cargoMap.forEach((cantidad, cargo) => {
      tableData.push([cargo, cantidad.toString()]);
    });

    return tableData;*/
  }

private processMaterialesData(): string[][] {
  if (!this.materialesData || this.materialesData.length === 0) {
    return [
      ['Material', 'Can.', 'Unidad'],
      ['No hay datos de materiales', '0', '-']
    ];
  }

  const materialMap = new Map<string, { nombre: string, cantidad: number, unidad: string }>();

  this.materialesData.forEach(material => {
    const materialSeleccionado = this.catalogMateriales.find(m => m.id === material.idResource);
    console.log('Material seleccionado:', materialSeleccionado);
    const nombre = materialSeleccionado ? materialSeleccionado.description : 'Sin nombre';
    const cantidad = material.quantity ?? 0;
    const unidadMaterial = this.unitsCatalog.find(u => u.id === materialSeleccionado.idMedida);
    const unidad = unidadMaterial ? unidadMaterial.description : 'unidad desconocida';

    const key = `${material.idResource}-${unidad}`;

    if (materialMap.has(key)) {
      const existing = materialMap.get(key)!;
      materialMap.set(key, {
        nombre: existing.nombre,
        cantidad: existing.cantidad + cantidad,
        unidad: existing.unidad
      });
    } else {
      materialMap.set(key, { nombre, cantidad, unidad });
    }
  });

  const tableData = [['Material', 'Can.', 'Unidad']];
  materialMap.forEach(data => {
    tableData.push([data.nombre, data.cantidad.toString(), data.unidad]);
  });

  return tableData;
}


  private processEquiposData() {
    if (!this.equiposData || this.equiposData.length === 0) {
      return [
        ['Equipo', 'Can.'],
        ['No hay datos de equipos', '0']
      ];
    }
    const equipoMap = new Map<string, number>();
    this.equiposData.forEach(equipo => {
      const equipoSeleccionado = this.catalogEquipos.find(e => e.id === equipo.idResource);
      const nombre = equipoSeleccionado ? equipoSeleccionado.description : 'Sin nombre';
      const Cantidad = equipo.quantity ?? 0;;
      if (equipoMap.has(nombre)) {
        equipoMap.set(nombre, equipoMap.get(nombre)! + Cantidad);
      } else {
        equipoMap.set(nombre, Cantidad);
      }
    });
    // Convertir a array para la tabla
    const tableData = [['Equipo', 'Can.']];
    equipoMap.forEach((Cantidad, nombre) => {
      tableData.push([nombre, Cantidad.toString()]);
    });

    return tableData;
  }

   private processConceptosData(): string[][] {
    if (!this.conceptosData || this.conceptosData.length === 0) {
      return [
        ['Conc.', 'Descripción', 'Can.', 'P.U.', 'Monto'],
        ['No hay datos de conceptos', 'Sin descripción disponible', '0', '$0.00', '$0.00']
      ];
    }

    // Agrupar por concepto y sumar cantidades
    const conceptoMap = new Map<string, { activity: string, description: string, cantidad: number, precioUnitario: number, monto: number }>();
    
    this.conceptosData.forEach(conceptos => {
      // Usar el conceptName procesado si está disponible, sino buscar en el catálogo
      let activity: string;
      let description: string;
      let precioUnitario = 0;
      
      if (conceptos.conceptName) {
        // Usar el nombre ya procesado desde el componente
        activity = conceptos.conceptName;
        description = conceptos.conceptName;
      } else {
        // Fallback al método original si no está procesado
        const conceptosSeleccionado = this.conceptosCatalog.find(e => e.id === conceptos.idResource);
        activity = conceptosSeleccionado ? conceptosSeleccionado.activity : 'Sin nombre';
        description = conceptosSeleccionado ? conceptosSeleccionado.text : 'Sin descripción';
      }

      // Obtener el precio unitario del catálogo
      const conceptosSeleccionado = this.conceptosCatalog.find(e => e.id === conceptos.idResource);
      if (conceptosSeleccionado && conceptosSeleccionado.costMX) {
        precioUnitario = Number(conceptosSeleccionado.costMX);
      }
      
      const cantidad = conceptos.quantity ?? 0;
      const monto = precioUnitario * cantidad;
      
      const key = `${conceptos.idResource}-${activity}`;
      
      if (conceptoMap.has(key)) {
        const existing = conceptoMap.get(key)!;
        conceptoMap.set(key, {
          activity: existing.activity,
          description: existing.description,
          cantidad: existing.cantidad + cantidad,
          precioUnitario: existing.precioUnitario, // El precio unitario no se suma
          monto: existing.monto + monto
        });
      } else {
        conceptoMap.set(key, { activity, description, cantidad, precioUnitario, monto });
      }
    });
    
    // Convertir a array para la tabla
    const tableData = [['Conc.', 'Descripción', 'Can.', 'P.U.', 'Monto']];
    conceptoMap.forEach(data => {
      const precioUnitarioFormatted = `$${data.precioUnitario.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
      const montoFormatted = `$${data.monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
      tableData.push([data.activity, data.description, data.cantidad.toString(), precioUnitarioFormatted, montoFormatted]);
    });

    return tableData;
  } 

  private generateDocDefinition() {
    this.limpiarPdfMakeKeys(this.imagenes);
    const imageKeys = Object.keys(this.imagenes).sort();

    const contenido = [];

    if (imageKeys.length === 0 || !this.imagenes['photo0']) {
      contenido.push({
        text: 'No hay fotografías subidas.',
        margin: [15, 0, 0, 0],
      });
    } else {
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
        {
          columns: [
            {
              width: '100%',
              table: {
                headerRows: 1,
                widths: ['auto', '*', 'auto', 'auto', 'auto'],
                body: this.processConceptosData()
              },
              layout: {
                fillColor: function (rowIndex) {
                  return (rowIndex === 0) ? '#CCCCCC' : null;
                }
              },
              style: 'tableContent'
            },
            {
              width: '100%',
              text: ''
            }
          ],
          columnGap: 10
        },
        ...this.gestionarDatos,
        {
          text: '3.- LISTADO DE CONTROL',
          pageBreak: (currentPage, pageSize, currentNode, nodesOnPage) => {
            return nodesOnPage.length > 0 ? 'before' : '';
          },
          style: 'puntosATratar',
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
        },
        { text: '', pageBreak: 'after' },
        {
          text: '4.- REPORTE FOTOGRAFICO',
          pageBreak: (currentPage, pageSize, currentNode, nodesOnPage) => {
            return nodesOnPage.length > 0 ? 'before' : '';
          },
          style: 'puntosATratar',
        },
        ...contenido,
        
      ],
      images: {
        zheader: this.trackingService.getPictureComp2(),
        zfooter: this.trackingService.getPictureComp3(),
      },
    };
    return docDefinition;
  }
  catalogoMateriales(){
    return this.materialsService.getMaterials(this.idcompany, 'CONSUMABLE').subscribe(
      (data: any) => {
        this.catalogMateriales = data;
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

  catalogoEquipo(){
    return this.equipmentService.getEquipment(this.idcompany).subscribe(
      (data: any) => {
        this.catalogEquipos = data;
      },
      (error) => console.error('Error fetching data:', error)
    );
  }
  obtenerUnidades(){
    return this.catalogsService.getUnits(this.idcompany).subscribe(
      (data: any) => {
        this.unitsCatalog = data;
      },
      (error) => console.error('Error fetching units:', error)
    );
  }
  obtenerTypeNotes(){
    return this.catalogsService.getTypeNote(this.idcompany).subscribe(
      (data: any) => {
        this.typeNotesCatalog = data;
        console.log('Catálogo de tipos de nota obtenido:', this.typeNotesCatalog);
      },
      (error) => console.error('Error fetching type notes:', error)
    );
  }
}
