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

interface BaseEntity {
  name: string;
  picture: string;
  rfc: string;
  address: string;
  phone: string;
  city: string;
  state: string;
  country: string;
}

interface RootResponse extends BaseEntity {
  idReq: number;
}

interface ProviderResponse extends BaseEntity {}

interface ProjectResponse {
  description: string;
  // otras propiedades...
}

interface ReqResponse {
  comments: string;
  folio: string;
  idProject: number;
  idReq: number;
  solicit: string;
  dateCreate: string;
  idProvider: number;
  idSolicit: number;
  idAuthorize: number;
  type: string;
}

interface AuthorizerResponse {
  displayName: string;
  email: string;
  picture: string;
  signature: string;
}

interface UserResponse {
  data: {
    id: number;
    signature: string;
    displayName: string;
    // Otros campos que necesites
  };
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
  private solicitant: any;
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
      if (detailedReq.type == "OC") {
        const authorizer = await lastValueFrom(this.usersService.getUserById(this.detailedReq.idAuthorize)) as UserResponse;
        this.authorizer = authorizer.data;
        console.log(this.authorizer);
      }
      else {
        const authorizer = await lastValueFrom(this.usersService.findEmail(localStorage.getItem('mail'))) as AuthorizerResponse;
        this.authorizer = authorizer;
      }

      // Ahora consigo el nombre de quien solicita, pero solo si es OC
      if (detailedReq.type == "OC") {
        const user = await lastValueFrom(this.usersService.getUserById(this.detailedReq.idSolicit)) as UserResponse;
        this.solicitant = user.data;
        console.log(this.solicitant);
      }

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

  private calculateTotal(): number {
    return this.reqItems.reduce((sum, item) => sum + item.total, 0);
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
    var signatureSolicitant: any;
    if (this.detailedReq.type == "OC") {
      signatureSolicitant = await this.base64EncodeService.convertImageToBase64(this.solicitant.signature);
    }

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
                { text: `\n\n` }
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
                    { text: this.detailedReq.type == "OC" ? 'Req. No.' : '', alignment: 'right' },
                    { text: this.detailedReq.type == "OC" ? this.requisitionName : '', alignment: 'left' }
                  ],
                  [
                    { text: this.detailedReq.type == "OC" ? 'OC. No.:' : 'Requis. No.:', alignment: 'right' },
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
          columns: [
            {
              width: 'auto',
              text: [
                { text: this.detailedReq.type == "OC" ? 'FACTURAR A\n' : '', bold: true },
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
              text: [
                { text: this.detailedReq.type == "OC" ? 'PROVEEDOR\n' : '', bold: true },
                { text: this.detailedReq.type == "OC" ? `${this.providerResponse.name}\n` : '' },
                { text: this.detailedReq.type == "OC" ? `${this.providerResponse.address}\n` : '' },
                { text: this.detailedReq.type == "OC" ? `${this.providerResponse.rfc}\n` : '' },
                { text: this.detailedReq.type == "OC" ? `${this.providerResponse.city}, ${this.providerResponse.state}, ${this.providerResponse.country}\n` : '' },
                { text: this.detailedReq.type == "OC" ? `${this.providerResponse.phone}` : '' }
              ],
              alignment: 'left',
              margin: [0, 0, 0, 20]
            },
          ]
        },
        {
          table: {
            headerRows: 1,
            widths: this.detailedReq.type == "OC" ? ['auto', 'auto', '*', 'auto', 'auto', 'auto', 'auto'] : ['auto', 'auto', '*', 'auto', 'auto', 'auto'],
            body: this.detailedReq.type == "OC" ? [
              [
                { text: 'Pda', style: 'tableHeader' },
                { text: 'Código', style: 'tableHeader' },
                { text: 'Cantidad', style: 'tableHeader' },
                { text: 'Unidad', style: 'tableHeader' },
                { text: 'Descripción del producto', style: 'tableHeader' },
                { text: 'Precio', style: 'tableHeader' },
                { text: 'Importe', style: 'tableHeader' }
              ],
              ...this.reqItems.map((item, index) => [
                { text: (index + 1).toString(), style: 'tableCell' },
                { text: item.code, style: 'tableCell' },
                { text: item.quantity.toString(), style: 'tableCell', alignment: 'right' },
                { text: item.measure, style: 'tableCell', alignment: 'right' },
                { text: item.description, style: 'tableCell' },
                { text: '$' + item.price.toFixed(2).toString(), style: 'tableCell' },
                { text: '$' + item.total.toFixed(2).toString(), style: 'tableCell' }
              ])
            ] : [
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
        this.detailedReq.type == "OC" ?
          {
            columns: [
              {
                width: '*',
                text: ''
              },
              {
                width: 'auto',
                table: {
                  widths: ['*', '*'],
                  body: [
                    [
                      { text: 'Suma:', alignment: 'right' },
                      { text: '$' + this.calculateTotal().toFixed(2).toString(), alignment: 'right' }
                    ],
                    [
                      { text: 'Descuento:', alignment: 'right' },
                      { text: '$' + this.detailedReq.discount.toFixed(2).toString(), alignment: 'right' }
                    ],
                    [
                      { text: 'Subtotal:', alignment: 'right' },
                      { text: '$' + (this.calculateTotal() - this.detailedReq.discount).toFixed(2).toString(), alignment: 'right' }
                    ],
                    [
                      { text: 'IVA 16%:', alignment: 'right' },
                      { text: '$' + ((this.calculateTotal() - this.detailedReq.discount) * 0.16).toFixed(2).toString(), alignment: 'right' }
                    ],
                    [
                      { text: 'Retención IVA:', alignment: 'right' },
                      { text: '$' + this.detailedReq.ivaRetention.toFixed(2).toString(), alignment: 'right' }
                    ],
                    [
                      { text: 'Total:', alignment: 'right' },
                      { text: '$' + ((this.calculateTotal() - this.detailedReq.discount) * 1.16 - this.detailedReq.ivaRetention).toFixed(2).toString(), alignment: 'right' }
                    ],
                  ],

                },
                layout: {
                  hLineWidth: (i, node) => 0.5,
                  vLineWidth: (i, node) => 0.5,
                  hLineColor: (i, node) => '#aaa',
                  vLineColor: (i, node) => '#aaa',
                  paddingTop: (i, node) => 4,
                  paddingBottom: (i, node) => 4
                },
                margin: [0, 20, 0, 20]
              }
            ]
          } : {
            text: ''
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
                this.detailedReq.type == 'OC' ?
                  {
                    image: 'signatureSolicitant',
                    fit: ['*', 90],
                    alignment: 'center'
                  } :
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
                },
              ],
              [
                { text: '_________________________________________', border: [false, true, false, false], margin: [0, 0, 0, 0], alignment: 'center' },
                { text: '_________________________________________', border: [false, true, false, false], margin: [0, 0, 0, 0], alignment: 'center' }
              ],
              [
                { text: this.detailedReq.type == "OC" ? this.solicitant.displayName : this.detailedReq.solicit, alignment: 'center' },
                { text: this.authorizer.displayName, alignment: 'center' }
              ]
            ]
          },
          layout: 'noBorders', // Sin bordes para una apariencia más limpia
          margin: [0, 0, 0, 20]
        },
      ],
      images: this.detailedReq.type == "OC" ? {
        signatureSolicitant: signatureSolicitant,
        logo: logoBase64,
        signature: signature
      }: {
        logo: logoBase64,
        signature: signature
      }
    };
  }
}