import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BlobService {

  private urlApiSASAzure = 'https://biwhats.azurewebsites.net/api/Blob/GetBlobSasUrl';

  constructor(private http: HttpClient) { }

  sendBlobUrl(blobUrl: string): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(this.urlApiSASAzure, { url: blobUrl });
  }
}