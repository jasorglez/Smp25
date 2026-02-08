import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { NotificationsTelegramService } from '../../../../services/notifications-telegram.service';

@Component({
  selector: 'app-public-doc-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './public-doc-viewer.component.html',
  styles: [`
    .public-doc-container {
      min-height: 100vh;
      background-color: #f5f5f5;
    }
    .header-bar {
      background: linear-gradient(135deg, #1a237e 0%, #283593 100%);
      padding: 12px 24px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
  `]
})
export class PublicDocViewerComponent implements OnInit {
  loading = true;
  errorMessage = '';
  docData: any = null;
  detailColumns: { field: string, label: string }[] = [];

  // Field labels for known document fields
  private fieldLabels: Record<string, string> = {
    id: 'ID',
    folio: 'Folio',
    date: 'Fecha',
    fecha: 'Fecha',
    description: 'Descripción',
    descripcion: 'Descripción',
    total: 'Total',
    subtotal: 'Subtotal',
    iva: 'IVA',
    status: 'Estado',
    estatus: 'Estado',
    provider: 'Proveedor',
    proveedor: 'Proveedor',
    providerName: 'Proveedor',
    nameProvider: 'Proveedor',
    solicitName: 'Solicitante',
    authorizeName: 'Autorizador',
    amount: 'Monto',
    monto: 'Monto',
    currency: 'Moneda',
    moneda: 'Moneda',
    observations: 'Observaciones',
    observaciones: 'Observaciones',
    notes: 'Notas',
    notas: 'Notas',
    concept: 'Concepto',
    concepto: 'Concepto',
    idCompany: 'ID Empresa',
    nameCompany: 'Empresa',
    warehouse: 'Almacén',
    almacen: 'Almacén',
  };

  // Fields to exclude from display
  private excludeFields = new Set([
    'active', 'activo', '__isNew', '__modified', 'idSolicit', 'idAuthorize',
    'idDocumentType', 'telegramMsgId', 'telegramChatId', 'callbackSent',
    'solicitNotified', 'accessToken', 'createdAt', 'updatedAt'
  ]);

  constructor(
    private route: ActivatedRoute,
    private notificationsService: NotificationsTelegramService
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      if (!token) {
        this.loading = false;
        this.errorMessage = 'No se proporcionó un token de acceso.';
        return;
      }
      this.loadDocument(token);
    });
  }

  private loadDocument(token: string) {
    this.loading = true;
    this.errorMessage = '';

    this.notificationsService.getPublicDocument(token).subscribe({
      next: (data) => {
        this.docData = data;
        this.buildDetailColumns();
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        if (err.status === 404) {
          this.errorMessage = 'Enlace inválido o no encontrado.';
        } else if (err.status === 400) {
          this.errorMessage = err.error?.error || 'Este enlace ha expirado.';
        } else {
          this.errorMessage = 'Error al cargar el documento. Intente nuevamente.';
        }
      }
    });
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'PENDING': 'Pendiente de Autorización',
      'APPROVED': 'Aprobado',
      'REJECTED': 'Rechazado',
      'AWAITING_REASON': 'Esperando Motivo',
      'ERROR': 'Error'
    };
    return labels[status] || status;
  }

  getDocumentFields(): { label: string, value: any }[] {
    if (!this.docData?.documentData?.document) return [];

    const doc = this.docData.documentData.document;
    const fields: { label: string, value: any }[] = [];

    for (const key of Object.keys(doc)) {
      const lowerKey = key.toLowerCase();
      if (this.excludeFields.has(lowerKey) || this.excludeFields.has(key)) continue;
      if (typeof doc[key] === 'object' && doc[key] !== null) continue;

      const label = this.fieldLabels[key] || this.fieldLabels[lowerKey] || this.formatFieldName(key);
      let value = doc[key];

      // Format dates
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        value = new Date(value).toLocaleDateString('es-MX', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
      }

      // Format currency
      if (typeof value === 'number' && (lowerKey.includes('total') || lowerKey.includes('amount') ||
        lowerKey.includes('monto') || lowerKey.includes('subtotal') || lowerKey.includes('iva') ||
        lowerKey.includes('price') || lowerKey.includes('precio'))) {
        value = '$' + value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }

      fields.push({ label, value: value ?? '-' });
    }

    return fields;
  }

  private buildDetailColumns() {
    if (!this.docData?.documentData?.details) return;

    const details = this.docData.documentData.details;
    const rows = Array.isArray(details) ? details : [];
    if (rows.length === 0) return;

    // Build columns from first row
    const firstRow = rows[0];
    this.detailColumns = Object.keys(firstRow)
      .filter(key => {
        const lowerKey = key.toLowerCase();
        return !this.excludeFields.has(lowerKey) && typeof firstRow[key] !== 'object';
      })
      .map(key => ({
        field: key,
        label: this.fieldLabels[key] || this.fieldLabels[key.toLowerCase()] || this.formatFieldName(key)
      }));
  }

  getDetailRows(): any[] {
    if (!this.docData?.documentData?.details) return [];
    return Array.isArray(this.docData.documentData.details)
      ? this.docData.documentData.details
      : [];
  }

  private formatFieldName(name: string): string {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .replace(/^\s/, '')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
}
