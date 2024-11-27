import { inject, Injectable } from '@angular/core';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { lastValueFrom } from 'rxjs';
import { RequisitionsService } from './requisitions.service';
import { RootService } from './root.service';
import { ProjectsService } from './projects.service';

(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

interface RootResponse {
  picture: string;
  // otras propiedades...
}

interface ProjectResponse {
  description: string;
  // otras propiedades...
}

@Injectable({
  providedIn: 'root'
})
export class ReceiptsService {
  private requisitionsService = inject(RequisitionsService);
  private rootService = inject(RootService);
  private projectsService = inject(ProjectsService);
  private reqItems: any[] = [];
  private detailedReq: any;
  private idRoot = Number(localStorage.getItem('company'));
  private rootLogo: string = null;
  private projectDescription: string = null;

  async generateOC(id: number): Promise<void> {
    try {
      await this.getRequisitionData(id);
      const docDefinition = this.generateDocDefinition();
      pdfMake.createPdf(docDefinition).open();
    } catch (error) {
      console.error('Error generating OC:', error);
    }
  }

  private async getRequisitionData(id: number): Promise<void> {
    try {
      const data = await lastValueFrom(this.requisitionsService.getReqItems(id));
      this.reqItems = data;

      // Almacenar el idMovement del primer elemento (asumiendo que todos tienen el mismo)
      const idMovement = data.length > 0 ? data[0].idMovement : null; // Cambia 'idMovement' por el nombre correcto de la propiedad
      console.log('idMovement:', idMovement);

      const detailedReq = await lastValueFrom(this.requisitionsService.getDetailedReq(idMovement));
      this.detailedReq = detailedReq; // Cambia 'detailedReq' por el nombre correcto de la propiedad

      // Almacenar el logo del cliente
      const rootLogoResponse = await lastValueFrom(this.rootService.getRootbyId(this.idRoot)) as RootResponse;
      this.rootLogo = rootLogoResponse.picture;

      const projectId = Number(localStorage.getItem('project'));
      const projectResponse = await lastValueFrom(this.projectsService.getProjectsById(projectId)) as unknown as ProjectResponse;
      this.projectDescription = projectResponse.description; // Cambia 'contractDescription' por el nombre correcto de la propiedad

    } catch (error) {
      console.error('Error fetching requisition items:', error);
      throw error;
    }
  }

  private convertirFecha(dateString: string): string {
    const date = new Date(dateString);
    const monthsOfYear = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const day = date.getDate();
    const monthName = monthsOfYear[date.getMonth()];
    const year = date.getFullYear();

    return `${day} de ${monthName} de ${year}`;
  }

  private formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES');
  }

  private generateDocDefinition(): TDocumentDefinitions {
    pdfMake.fonts = {
      Montserrat: {
        normal: 'https://fonts.cdnfonts.com/s/14883/Montserrat-Regular.ttf',
        bold: 'https://fonts.cdnfonts.com/s/14883/Montserrat-Bold.ttf',
        italics: 'https://fonts.cdnfonts.com/s/14883/Montserrat-Italic.ttf',
        bolditalics: 'https://fonts.cdnfonts.com/s/14883/Montserrat-BoldItalic.ttf'
      }
    };

    return {
      pageSize: 'LETTER',
      pageMargins: [40, 60, 40, 60],
      defaultStyle: {
        fontSize: 9,
        font: 'Montserrat',
        lineHeight: 1.2
      },
      styles: {
        header: {
          fontSize: 16,
          bold: true,
          alignment: 'center',
          margin: [0, 0, 0, 20]
        },
        subheader: {
          fontSize: 14,
          bold: true,
          margin: [0, 10, 0, 5]
        },
        tableHeader: {
          bold: true,
          fontSize: 10,
          color: 'black',
          fillColor: '#eeeeee'
        },
        tableCell: {
          fontSize: 9
        },
        footer: {
          fontSize: 8,
          alignment: 'center',
          margin: [0, 10, 0, 0]
        }
      },
      footer: (currentPage, pageCount) => ({
        text: `Página ${currentPage} de ${pageCount}`,
        style: 'footer'
      }),
      content: [
        {
          image: 'logo',
          width: 90
        },
        {
          text: 'Requisición',
          style: 'header'
        },
        {
          text: `Fecha: ${this.convertirFecha(new Date().toISOString())}`,
          alignment: 'right',
          margin: [0, 0, 0, 20]
        },
        {
          text: 'Obra o proyecto: ' + this.projectDescription
        },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto', 'auto', 'auto', '*'],
            body: [
              [
                { text: 'Código', style: 'tableHeader' },
                { text: 'Material', style: 'tableHeader' },
                { text: 'Cantidad', style: 'tableHeader' },
                { text: 'Unidad', style: 'tableHeader' },
                { text: 'Fecha', style: 'tableHeader' },
                { text: 'Comentario', style: 'tableHeader' }
              ],
              ...this.reqItems.map(item => [
                { text: item.code, style: 'tableCell' },
                { text: item.description, style: 'tableCell' },
                { text: item.quantity.toString(), style: 'tableCell', alignment: 'right' },
                { text: item.measure, style: 'tableCell', alignment: 'right' },
                { text: this.formatTime(item.dateuse), style: 'tableCell' },
                { text: item.comment, style: 'tableCell' }
              ])
            ]
          },
          layout: {
            hLineWidth: (i, node) => 0.5,
            vLineWidth: (i, node) => 0.5,
            hLineColor: (i, node) => '#aaa',
            vLineColor: (i, node) => '#aaa',
            paddingTop: (i, node) => 8,
            paddingBottom: (i, node) => 8
          }
        },
        { text: 'Comentario: ', alignment: 'left' },
        { text: this.detailedReq.comments, alignment: 'left', margin: [0, 0, 0, 20] }
      ],
      images: {
        logo: this.rootLogo
      }
    };
  }
}