import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export interface DocumentCommentFlags {
  hasNoAuth: boolean;
  hasChangeSpec: boolean;
}

export interface ItemComment {
  id?: number;
  documentType: string;   // 'REQ' | 'COTIZ' | 'PROVEEDOR'
  idDocument: number;
  numArticle: string;
  idProvider?: number;
  idUser: number;
  userName: string;
  text: string;
  createdAt?: string;
  active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ItemCommentsService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  /** Emite cuando un componente externo quiere abrir el chat de un ítem específico */
  readonly openChatFor$ = new Subject<{
    documentType: string;
    idDocument: number;
    numArticle: string;
    autoMessage?: string;
    forceComment?: boolean;
    articleName?: string;
    defaultTab?: 'articulo' | 'proveedor';
    providerMessages?: { idProvider: number; providerName?: string };
  }>();

  /** Emite cuando un comentario es guardado exitosamente */
  readonly commentSaved$ = new Subject<ItemComment>();

  /** Emite cuando el chat se cierra — útil para diferir acciones que afectan el foco */
  readonly chatClosed$ = new Subject<void>();

  getComments(documentType: string, idDocument: number, numArticle: string): Observable<ItemComment[]> {
    return this.http.get<ItemComment[]>(
      `${environment.urlWarehouse}/ItemComments?documentType=${documentType}&idDocument=${idDocument}&numArticle=${encodeURIComponent(numArticle)}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getProviderComments(documentType: string, idDocument: number, idProvider: number, numArticle: string = ''): Observable<ItemComment[]> {
    const articleParam = numArticle ? `&numArticle=${encodeURIComponent(numArticle)}` : '';
    return this.http.get<ItemComment[]>(
      `${environment.urlWarehouse}/ItemComments?documentType=${documentType}&idDocument=${idDocument}&idProvider=${idProvider}${articleParam}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getFlags(documentType: string, idDocument: number): Observable<DocumentCommentFlags> {
    return this.http.get<DocumentCommentFlags>(
      `${environment.urlWarehouse}/ItemComments?documentType=${documentType}&idDocument=${idDocument}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  addComment(comment: ItemComment): Observable<ItemComment> {
    return this.http.post<ItemComment>(
      `${environment.urlWarehouse}/ItemComments`,
      comment,
      { headers: this.trackingService.getHeaders() }
    );
  }

  editComment(id: number, text: string): Observable<ItemComment> {
    return this.http.put<ItemComment>(
      `${environment.urlWarehouse}/ItemComments/${id}`,
      { text },
      { headers: this.trackingService.getHeaders() }
    );
  }

  /**
   * Borrado FÍSICO de comentarios de un artículo en un documento.
   * - Sin textPrefix: borra TODOS (al eliminar un renglón de la requisición; los comentarios se
   *   atan a numArticle, no al id del renglón, así que no deben reaparecer al re-agregar).
   * - Con textPrefix: borra solo los que empiezan así (ej. "🧮 [Req]" del panel de presentaciones),
   *   para reemplazar el anterior y dejar solo el último, sin tocar comentarios manuales.
   */
  deleteCommentsByArticle(documentType: string, idDocument: number, numArticle: string, textPrefix?: string): Observable<{ deleted: number }> {
    const prefixParam = textPrefix ? `&textPrefix=${encodeURIComponent(textPrefix)}` : '';
    return this.http.delete<{ deleted: number }>(
      `${environment.urlWarehouse}/ItemComments/by-article?documentType=${documentType}&idDocument=${idDocument}&numArticle=${encodeURIComponent(numArticle)}${prefixParam}`,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
