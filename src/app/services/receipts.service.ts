import { inject, Injectable } from '@angular/core';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { lastValueFrom } from 'rxjs';
import { OcAndReqsService } from './ocandreqs.service';
import { RootService } from './root.service';
import { ProjectsService } from './projects.service';
import { UsersService } from './users.service';
import { Base64EncodeService } from './base64encode.service';
import { ProvidersService } from './providers.service';

(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

interface RootResponse {
  name: string;
  picture: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  rfc: string;
  address: string;
  idReq: number;
  // otras propiedades...
}

interface ProjectResponse {
  description: string;
  // otras propiedades...
}

interface ProviderResponse {
  picture: string;
  name: string;
  rfc: string;
  address: string;
  phone: string;
}

interface ReqResponse {
  comments: string;
  folio: string;
  idProject: number;
  idReq: number;
  idProveedor: number;
  solicit: string;
  dateCreate: string;
  idProvider: number;
  type: string;
}

interface AuthorizerResponse {
  displayName: string;
  email: string;
  picture: string;
  signature: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReceiptsService {
  private requisitionsService = inject(OcAndReqsService);
  private rootService = inject(RootService);
  private projectsService = inject(ProjectsService);
  private usersService = inject(UsersService);
  private base64EncodeService = inject(Base64EncodeService);
  private providerService = inject(ProvidersService);

  private reqItems: any[] = [];
  private detailedReq: any;
  private idRoot = Number(localStorage.getItem('company'));
  private authorizer: any;
  private projectDescription: string = null;
  private rootResponse: any;
  private providerResponse: any;
  private requisitionName: string;

  async generateOC(id: number, action: string): Promise<void> {
    try {
      await this.getRequisitionData(id);
      const docDefinition = await this.generateDocDefinition();
      switch (action) {
        case 'print':
          pdfMake.createPdf(docDefinition).print();
          break;
        case 'open':
          pdfMake.createPdf(docDefinition).open();
          break;
      }
    } catch (error) {
      console.error('Error generating OC:', error);
    }
  }

  private async getRequisitionData(id: number): Promise<void> {
    try {
      const data = await lastValueFrom(this.requisitionsService.getReqItems(id));
      this.reqItems = data;

      const detailedReq = await lastValueFrom(this.requisitionsService.getDetailedReq(id)) as ReqResponse;
      this.detailedReq = detailedReq; // Cambia 'detailedReq' por el nombre correcto de la propiedad

      // Ahora el proyecto
      const projectId = Number(localStorage.getItem('project'));
      const projectResponse = await lastValueFrom(this.projectsService.getProjectsById(projectId)) as unknown as ProjectResponse;
      this.projectDescription = projectResponse.description; // Cambia 'contractDescription' por el nombre correcto de la propiedad

      // Ahora consigo el dato del root
      const rootResponse = await lastValueFrom(this.rootService.getRootbyId(this.idRoot)) as RootResponse;

      // Si es una orden de compra, consigo el dato del proveedor
      if (detailedReq.type == "OC") {
        const providerResponse = await lastValueFrom(this.providerService.getProviderById(this.detailedReq.idProvider)) as RootResponse;
        this.providerResponse = providerResponse;
        const requisitionName = await lastValueFrom(this.requisitionsService.getDetailedReq(this.detailedReq.idReq)) as ReqResponse;
        this.requisitionName = requisitionName.folio; // Cambia 'requisitionName' por el nombre correcto de la propiedad
      }
      this.rootResponse = rootResponse;

      // Consigo el dato de quien autoriza
      const authorizer = await lastValueFrom(this.usersService.findEmail(localStorage.getItem('mail'))) as AuthorizerResponse;
      this.authorizer = authorizer;

      console.log(this.detailedReq);

    } catch (error) {
      console.error('Error fetching requisition items:', error);
      throw error;
    }
  }
  private formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES');
  }

  private async generateDocDefinition(): Promise<TDocumentDefinitions> {
    pdfMake.fonts = {
      Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf'
      }
    };

    const logoBase64 = await this.base64EncodeService.convertImageToBase64(this.rootResponse.picture);
    const signature = await this.base64EncodeService.convertImageToBase64(this.authorizer.signature);

    return {
      pageSize: 'LETTER',
      pageMargins: [40, 60, 40, 60],
      defaultStyle: {
        fontSize: 9,
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
          text: this.detailedReq.type == "REQUIS" ? 'Requisición' : 'Orden de compra',
          style: 'header'
        },
        {
          columns: [
            {
              width: '*',

              text: [
                { text: 'Obra o proyecto:\n' },
                { text: `${this.projectDescription}`, bold: true },
                { text: `\n\n` },
                { text: `${this.rootResponse.name}\n` },
                { text: `${this.rootResponse.address}\n` },
                { text: `${this.rootResponse.rfc}\n` },
                { text: `${this.rootResponse.city}, ${this.rootResponse.state}, ${this.rootResponse.country}\n` },
                { text: `${this.rootResponse.phone}` }
              ],
              alignment: 'left',
              margin: [0, 0, 0, 20]
            },
            {
              width: 'auto',
              table: {
                widths: ['*', '*'],
                body: [
                  [
                    { text: 'Fecha:', alignment: 'right' },
                    { text: this.formatTime(this.detailedReq.dateCreate), alignment: 'left' }
                  ],
                  [
                    { text: this.detailedReq.type == "REQUIS" ? 'Req. No.' : '', alignment: 'right' },
                    { text: this.detailedReq.type == "REQUIS" ? this.requisitionName: '', alignment: 'left' }
                  ],
                  [
                    { text: this.detailedReq.type == "REQUIS" ? 'Requis. No.:' : 'OC No.:', alignment: 'right' },
                    { text: this.detailedReq.folio, alignment: 'left' }
                  ]
                ]
              },
              layout: 'noBorders', // Sin bordes para una apariencia más limpia
              margin: [0, 0, 0, 20]
            }
          ]
        },
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', '*', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: 'Pda', style: 'tableHeader' },
                { text: 'Código', style: 'tableHeader' },
                { text: 'Cantidad', style: 'tableHeader' },
                { text: 'Unidad', style: 'tableHeader' },
                { text: 'Descripción del producto', style: 'tableHeader' },
                { text: 'Fecha de utilización', style: 'tableHeader' }
              ],
              ...this.reqItems.map((item, index) => [
                { text: (index + 1).toString(), style: 'tableCell' },
                { text: item.code, style: 'tableCell' },
                { text: item.quantity.toString(), style: 'tableCell', alignment: 'right' },
                { text: item.measure, style: 'tableCell', alignment: 'right' },
                { text: item.description, style: 'tableCell' },
                { text: this.formatTime(item.dateuse), style: 'tableCell' }
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
        { text: 'Observaciones: ', alignment: 'left', margin: [0, 20, 0, 0] },
        { text: this.detailedReq.comments, alignment: 'left', margin: [0, 0, 0, 20] },
        {
          table: {
            widths: ['*', '*'],
            body: [
              [
                { text: 'Solicita:', alignment: 'center' },
                { text: 'Autoriza:', alignment: 'center' }
              ],
              [
                {
                  text: '',
                  fit: ['*', 90],
                  alignment: 'center',
                  border: [false, false]
                },
                {
                  image: 'signature',
                  fit: ['*', 90],
                  alignment: 'center'
                }
              ],
              [
                { text: '_________________________________________', border: [false, true, false, false], margin: [0, 0, 0, 0], alignment: 'center' },
                { text: '_________________________________________', border: [false, true, false, false], margin: [0, 0, 0, 0], alignment: 'center' }
              ],
              [
                { text: this.detailedReq.solicit, alignment: 'center' },
                { text: this.authorizer.displayName, alignment: 'center' }
              ]
            ]
          },
          layout: 'noBorders', // Sin bordes para una apariencia más limpia
          margin: [0, 0, 0, 20]
        }
      ],
      images: {
        logo: logoBase64,
        signature: signature
      }
    };
  }
}