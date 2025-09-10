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
import { InandoutService } from './inandout.service';

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

interface InAndOutResponse {
  id: number;
  folio: string;
  idOc: number;
  deliverName: string;
  deliveryDate: string;
  comment: string;
  numBill: string;
  type: string;
}

interface ProjectResponse {
  description: string;
}

interface ReqResponse {
  comments: string;
  folio: string;
  typeReference: string;
  idReference: number;
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
  };
}

@Injectable({
  providedIn: 'root',
})
export class ReceiptsService {
  private requisitionsService = inject(OcAndReqsService);
  private rootService = inject(RootService);
  private projectsService = inject(ProjectsService);
  private usersService = inject(UsersService);
  private base64EncodeService = inject(Base64EncodeService);
  private providerService = inject(ProvidersService);
  private inAndOutService = inject(InandoutService);

  private reqItems: any[] = [];
  private inOutItems: any;
  private detailedReq: any;
  private idRoot = Number(localStorage.getItem('company'));
  private isInOut: boolean = false;
  private authorizer: any;
  private solicitant: any;
  private projectDescription: string = null;
  private rootResponse: any;
  private providerResponse: any;
  private requisitionName: string;
  private idInOut: number;
  private idOc: number;
  private headerTitle: string;

  private getIdRoot(): number {
    return Number(localStorage.getItem('company'));
  }

  private getIdProject(): number {
    return Number(localStorage.getItem('project'));
  }

  async generateOC(id: number, action: string): Promise<void> {
    try {
      this.isInOut = false;
      await this.getRequisitionData(id);
      this.headerTitle = this.getHeaderTitle();
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

  async generateInOut(id: number, action: string): Promise<void> {
    try {
      this.isInOut = true;
      this.idInOut = id;
      await this.getInOrOutData(this.idInOut);
      await this.getRequisitionData(this.idOc);
      this.headerTitle = this.getHeaderTitle();

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
      console.error('Error generating in/out:', error);
    }
  }

  private async getInOrOutData(id: number): Promise<void> {
    try {
      const data = (await lastValueFrom(
        this.inAndOutService.getDetailedInOut(id)
      )) as InAndOutResponse;
      this.inOutItems = data;
      this.idOc = data.idOc;
      console.log(this.idOc);
    } catch (error) {
      console.error('Error fetching in/out items:', error);
      throw error;
    }
  }

  private async getRequisitionData(id: number): Promise<void> {
    try {
      // Aqui obtengo los items de la requisicion
      var data;
      if (this.isInOut == true) {
        data = await lastValueFrom(
          this.inAndOutService.getInAndOutItems(this.idInOut)
        );
      } else {
        data = await lastValueFrom(this.requisitionsService.getReqItems(id));
      }

      this.reqItems = data;
      console.log(this.reqItems);
      // Aqui obtengo la requisicion detallada
      const detailedReq = (await lastValueFrom(
        this.requisitionsService.getDetailedReq(id)
      )) as ReqResponse;
      this.detailedReq = detailedReq; // Cambia 'detailedReq' por el nombre correcto de la propiedad
      console.log("detalles de requis", this.detailedReq);
      // Ahora el proyecto
      const projectId = this.getIdProject();
      if(projectId == 0){
        console.log("no tiene proyecto")
        this.projectDescription = 'N/A'; // Cambia 'contractDescription' por el nombre correcto de la propiedad
      }
      else {
        console.log("tiene proyecto");
        const projectResponse = (await lastValueFrom(
          this.projectsService.getProjectsById(projectId)
        )) as unknown as ProjectResponse;
        this.projectDescription = projectResponse.description; // Cambia 'contractDescription' por el nombre correcto de la propiedad
      }
      
      // Ahora consigo el dato del root
      const rootResponse = (await lastValueFrom(
        this.rootService.getRootbyId(this.getIdRoot())
      )) as RootResponse;
      // Si es una orden de compra, consigo el dato del proveedor
      if (detailedReq.type == 'OC') {
        const providerResponse = (await lastValueFrom(
          this.providerService.getProviderById(this.detailedReq.idProvider)
        )) as RootResponse;
        this.providerResponse = providerResponse;
        const requisitionName = (await lastValueFrom(
          this.requisitionsService.getDetailedReq(this.detailedReq.idReq)
        )) as ReqResponse;
        this.requisitionName = requisitionName ? requisitionName.folio : 'N/A';
      }
      this.rootResponse = rootResponse;
      console.log("imagen", this.rootResponse.picture);
      if (this.isInOut == false) {
        // Consigo el dato de quien autoriza
        if (detailedReq.type == 'OC') {
          const authorizer = (await lastValueFrom(
            this.usersService.getUserById(this.detailedReq.idAuthorize)
          )) as UserResponse;
          this.authorizer = authorizer.data;
          console.log(this.authorizer);
        } else {
          const authorizer = (await lastValueFrom(
            this.usersService.findEmail(localStorage.getItem('mail'))
          )) as AuthorizerResponse;
          this.authorizer = authorizer;
        }

        // Ahora consigo el nombre de quien solicita, pero solo si es OC
        if (detailedReq.type == 'OC') {
          const user = (await lastValueFrom(
            this.usersService.getUserById(this.detailedReq.idSolicit)
          )) as UserResponse;
          this.solicitant = user.data;
          console.log(this.solicitant);
        }
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
        bolditalics: 'Roboto-MediumItalic.ttf',
      },
    };

    const logoBase64 = await this.base64EncodeService.convertImageToBase64(
      this.rootResponse.picture
    );
    var signature: any;
    var signatureSolicitant: any;
    if (this.isInOut == false) {
      signature = await this.base64EncodeService.convertImageToBase64(
        this.authorizer.signature
      );
      if (this.detailedReq.type == 'OC') {
        signatureSolicitant =
          await this.base64EncodeService.convertImageToBase64(
            this.solicitant.signature
          );
      }
    }

    return {
      pageSize: 'LETTER',
      pageMargins: [40, 40, 40, 40],
      defaultStyle: {
        fontSize: 9,
        lineHeight: 1.2,
      },
      styles: {
        header: {
          fontSize: 14,
          bold: true,
          alignment: 'center',
          margin: [0, 0, 0, 20],
        },
        subheader: {
          fontSize: 12,
          bold: true,
          margin: [0, 10, 0, 5],
        },
        tableHeader: {
          bold: true,
          fontSize: 10,
          color: 'black',
          fillColor: '#eeeeee',
        },
        tableCell: {
          fontSize: 9,
        },
        footer: {
          fontSize: 8,
          alignment: 'center',
          margin: [0, 10, 0, 0],
        },
      },
      footer: (currentPage, pageCount) => ({
        text: `Página ${currentPage} de ${pageCount}`,
        style: 'footer',
      }),
      content: [
        {
          image: 'logo',
          width: 80,
        },
        {
          text: this.headerTitle,
          style: 'header',
        },
        {
          columns: [
            {
              width: '*',

              text: [
                { text: 'Obra o proyecto:\n' },
                { text: `${this.projectDescription}`, bold: true },
                { text: `\n\n` },
              ],
              alignment: 'left',
              margin: [0, 0, 0, 10],
            },
            {
              width: 'auto',
              table: {
                widths: ['*', '*'],
                body: [
                  [
                    { text: 'Fecha:', alignment: 'right' },
                    {
                      text: this.formatTime(this.detailedReq.dateCreate),
                      alignment: 'left',
                    },
                  ],
                  [
                    {
                      text: this.detailedReq.type == 'OC' ? 'Req. No.' : '',
                      alignment: 'right',
                    },
                    {
                      text:
                        this.detailedReq.type == 'OC'
                          ? this.requisitionName
                          : '',
                      alignment: 'left',
                    },
                  ],
                  [
                    {
                      text:
                        this.detailedReq.type == 'OC'
                          ? 'OC. No.:'
                          : 'Requis. No.:',
                      alignment: 'right',
                    },
                    {
                      text:
                        this.detailedReq.folio != null
                          ? this.detailedReq.folio
                          : 'N/D',
                      alignment: 'left',
                    },
                  ],
                ],
              },
              layout: {
                hLineWidth: (i, node) => 0,
                vLineWidth: (i, node) => 0,
                hLineColor: (i, node) => '#aaa',
                vLineColor: (i, node) => '#aaa',
                paddingTop: (i, node) => 0,
                paddingBottom: (i, node) => 0,
              },
              margin: [0, 0, 0, 10],
            },
          ],
        },

        this.detailedReq.type == 'OC'
          ? {
              table: {
                widths: ['*', '*'],
                body: [
                  [
                    {
                      stack: [
                        {
                          text:
                            this.detailedReq.type == 'OC' ? 'FACTURAR A' : '',
                          bold: true,
                        },
                        { text: `${this.rootResponse.name}` },
                        { text: `${this.rootResponse.address}` },
                        { text: `${this.rootResponse.rfc}` },
                        {
                          text: `${this.rootResponse.city}, ${this.rootResponse.state}, ${this.rootResponse.country}`,
                        },
                        { text: `${this.rootResponse.phone}` },
                      ],
                      margin: [0, 0, 10, 0],
                    },
                    {
                      stack: [
                        {
                          text:
                            this.detailedReq.type == 'OC' ? 'PROVEEDOR' : '',
                          bold: true,
                        },
                        {
                          text:
                            this.detailedReq.type == 'OC'
                              ? `${this.providerResponse.name}`
                              : '',
                        },
                        {
                          text:
                            this.detailedReq.type == 'OC'
                              ? `${this.providerResponse.address}`
                              : '',
                        },
                        {
                          text:
                            this.detailedReq.type == 'OC'
                              ? `${this.providerResponse.rfc}`
                              : '',
                        },
                        {
                          text:
                            this.detailedReq.type == 'OC'
                              ? `${this.providerResponse.city}, ${this.providerResponse.state}, ${this.providerResponse.country}`
                              : '',
                        },
                        {
                          text:
                            this.detailedReq.type == 'OC'
                              ? `${this.providerResponse.phone}`
                              : '',
                        },
                      ],
                      margin: [10, 0, 0, 0],
                    },
                  ],
                ],
              },
              layout: 'noBorders',
              margin: [0, 0, 0, 10],
            }
          : {
              table: {
                widths: ['*'],
                body: [
                  [
                    {
                      stack: [
                        { text: `${this.rootResponse.name}` },
                        { text: `${this.rootResponse.address}` },
                        { text: `${this.rootResponse.rfc}` },
                        {
                          text: `${this.rootResponse.city}, ${this.rootResponse.state}, ${this.rootResponse.country}`,
                        },
                        { text: `${this.rootResponse.phone}` },
                      ],
                    },
                  ],
                ],
              },
              layout: 'noBorders',
              margin: [0, 0, 0, 10],
            },
        {
          table: {
            headerRows: 1,
            widths:
              this.detailedReq.type == 'OC'
                ? this.isInOut
                  ? ['auto', 'auto', 'auto', 'auto', '*']
                  : ['auto', 'auto', 'auto', 'auto', '*', 'auto', 'auto']
                : this.isInOut
                ? ['auto', 'auto', 'auto', 'auto', '*']
                : ['auto', 'auto', 'auto', 'auto', '*', 'auto'],
            body:
              this.detailedReq.type == 'OC'
                ? [
                    [
                      { text: 'Pda', style: 'tableHeader' },
                      { text: 'Código', style: 'tableHeader' },
                      { text: 'Cantidad', style: 'tableHeader' },
                      { text: 'Unidad', style: 'tableHeader' },
                      {
                        text: 'Descripción del producto',
                        style: 'tableHeader',
                      },
                      ...(this.isInOut
                        ? []
                        : [
                            { text: 'Precio', style: 'tableHeader' },
                            { text: 'Importe', style: 'tableHeader' },
                          ]),
                    ],
                    ...this.reqItems.map((item, index) => [
                      { text: (index + 1).toString(), style: 'tableCell' },
                      { text: item.code, style: 'tableCell' },
                      {
                        text: item.quantity.toString(),
                        style: 'tableCell',
                        alignment: 'right',
                      },
                      {
                        text: item.measure,
                        style: 'tableCell',
                        alignment: 'right',
                      },
                      { text: item.description, style: 'tableCell' },
                      ...(this.isInOut
                        ? []
                        : [
                            {
                              text: '$' + item.price.toFixed(2).toString(),
                              style: 'tableCell',
                              alignment: 'right',
                            },
                            {
                              text: '$' + item.total.toFixed(2).toString(),
                              style: 'tableCell',
                              alignment: 'right',
                            },
                          ]),
                    ]),
                  ]
                : [
                    [
                      { text: 'Pda', style: 'tableHeader' },
                      { text: 'Código', style: 'tableHeader' },
                      { text: 'Cantidad', style: 'tableHeader' },
                      { text: 'Unidad', style: 'tableHeader' },
                      {
                        text: 'Descripción del producto',
                        style: 'tableHeader',
                      },
                      ...(!this.isInOut
                        ? [
                            {
                              text: 'Fecha de utilización',
                              style: 'tableHeader',
                            },
                          ]
                        : []),
                    ],
                    ...this.reqItems.map((item, index) => [
                      { text: (index + 1).toString(), style: 'tableCell' },
                      { text: item.code, style: 'tableCell' },
                      {
                        text: item.quantity.toString(),
                        style: 'tableCell',
                        alignment: 'right',
                      },
                      {
                        text: item.measure,
                        style: 'tableCell',
                        alignment: 'right',
                      },
                      { text: item.description, style: 'tableCell' },
                      ...(!this.isInOut
                        ? [
                            {
                              text: this.formatTime(item.dateuse),
                              style: 'tableCell',
                            },
                          ]
                        : []),
                    ]),
                  ],
          },
          layout: {
            hLineWidth: (i, node) => 0.5,
            vLineWidth: (i, node) => 0.5,
            hLineColor: (i, node) => '#aaa',
            vLineColor: (i, node) => '#aaa',
            paddingTop: (i, node) => 2,
            paddingBottom: (i, node) => 2,
          },
        },
        this.detailedReq.type == 'OC' && !this.isInOut
          ? {
              columns: [
                {
                  width: '*',
                  text: '',
                },
                {
                  width: 'auto',
                  table: {
                    widths: ['*', '*'],
                    body: [
                      [
                        { text: 'Suma:', alignment: 'right' },
                        {
                          text:
                            '$' + this.calculateTotal().toFixed(2).toString(),
                          alignment: 'right',
                        },
                      ],
                      [
                        { text: 'Descuento:', alignment: 'right' },
                        {
                          text:
                            '$' +
                            this.detailedReq.discount.toFixed(2).toString(),
                          alignment: 'right',
                        },
                      ],
                      [
                        { text: 'Subtotal:', alignment: 'right' },
                        {
                          text:
                            '$' +
                            (this.calculateTotal() - this.detailedReq.discount)
                              .toFixed(2)
                              .toString(),
                          alignment: 'right',
                        },
                      ],
                      [
                        { text: 'IVA 16%:', alignment: 'right' },
                        {
                          text:
                            '$' +
                            (
                              (this.calculateTotal() -
                                this.detailedReq.discount) *
                              0.16
                            )
                              .toFixed(2)
                              .toString(),
                          alignment: 'right',
                        },
                      ],
                      [
                        { text: 'Retención IVA:', alignment: 'right' },
                        {
                          text:
                            '$' +
                            this.detailedReq.ivaRetention.toFixed(2).toString(),
                          alignment: 'right',
                        },
                      ],
                      [
                        { text: 'Total:', alignment: 'right', bold: true },
                        {
                          text:
                            '$' +
                            (
                              (this.calculateTotal() -
                                this.detailedReq.discount) *
                                1.16 -
                              this.detailedReq.ivaRetention
                            )
                              .toFixed(2)
                              .toString(),
                          alignment: 'right',
                          bold: true,
                        },
                      ],
                    ],
                  },
                  layout: {
                    hLineWidth: (i, node) => 0.5,
                    vLineWidth: (i, node) => 0.5,
                    hLineColor: (i, node) => '#aaa',
                    vLineColor: (i, node) => '#aaa',
                    paddingTop: (i, node) => 2,
                    paddingBottom: (i, node) => 2,
                  },
                  margin: [0, 10, 0, 0],
                },
              ],
            }
          : {
              text: '',
            },
        { text: 'Observaciones: ', alignment: 'left', margin: [0, 10, 0, 0] },
        {
          text: this.isInOut
            ? this.inOutItems.comment
            : this.detailedReq.comments,
          alignment: 'left',
          margin: [0, 0, 0, 10],
        },
        this.isInOut
          ? {
              table: {
                widths: ['*', '*'],
                body: [
                  [
                    { text: 'Entrega:', alignment: 'center' },
                    { text: 'Recibe:', alignment: 'center' },
                  ],
                  [
                    {
                      stack: [{
                        text: ' ',
                        margin: [0, 35, 0, 35]
                      }],
                      alignment: 'center',
                      border: [false, false]
                    },
                    {
                      stack: [{
                        text: ' ',
                        margin: [0, 35, 0, 35]
                      }],
                      alignment: 'center',
                      border: [false, false]
                    },
                  ],
                  [
                    {
                      text: '_________________________________________',
                      border: [false, true, false, false],
                      margin: [0, 0, 0, 0],
                      alignment: 'center',
                    },
                    {
                      text: '_________________________________________',
                      border: [false, true, false, false],
                      margin: [0, 0, 0, 0],
                      alignment: 'center',
                    },
                  ],
                  [
                    {
                      text:
                        this.inOutItems.deliverName,
                      alignment: 'center',
                    },
                    { text: '', alignment: 'center' },
                  ],
                ],
              },
              layout: 'noBorders',
              margin: [0, 0, 0, 10],
            }
          : {
              table: {
                widths: ['*', '*'],
                body: [
                  [
                    { text: 'Solicita:', alignment: 'center' },
                    { text: 'Autoriza:', alignment: 'center' },
                  ],
                  [
                    this.detailedReq.type == 'OC'
                      ? {
                          image: 'signatureSolicitant',
                          fit: ['*', 70],
                          alignment: 'center',
                        }
                      : {
                          text: '',
                          fit: ['*', 70],
                          alignment: 'center',
                          border: [false, false],
                        },
                    {
                      image: 'signature',
                      fit: ['*', 70],
                      alignment: 'center',
                    },
                  ],
                  [
                    {
                      text: '_________________________________________',
                      border: [false, true, false, false],
                      margin: [0, 0, 0, 0],
                      alignment: 'center',
                    },
                    {
                      text: '_________________________________________',
                      border: [false, true, false, false],
                      margin: [0, 0, 0, 0],
                      alignment: 'center',
                    },
                  ],
                  [
                    {
                      text:
                        this.detailedReq.type == 'OC'
                          ? this.solicitant.displayName
                          : this.detailedReq.solicit,
                      alignment: 'center',
                    },
                    { text: this.authorizer.displayName, alignment: 'center' },
                  ],
                ],
              },
              layout: 'noBorders',
              margin: [0, 0, 0, 10],
            },
      ],
      images: this.isInOut
        ? {
            logo: logoBase64,
          }
        : this.detailedReq.type == 'OC'
        ? {
            signatureSolicitant: signatureSolicitant,
            logo: logoBase64,
            signature: signature,
          }
        : {
            logo: logoBase64,
            signature: signature,
          },
    };
  }

  getHeaderTitle(): string {
    var headerTitle = '';
    if (this.isInOut == true) {
      if (this.inOutItems.type == 'IN') {
        headerTitle = 'Vale de Entrada';
      } else {
        headerTitle = 'Vale de Salida';
      }
    } else {
      if (this.detailedReq.type == 'OC') {
        headerTitle = 'Orden de Compra';
      } else {
        headerTitle = 'Requisición';
      }
    }
    return headerTitle;
  }
}
