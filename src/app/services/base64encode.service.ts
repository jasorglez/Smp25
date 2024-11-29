import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class Base64EncodeService {

  constructor(private http: HttpClient) {}

   // Método para convertir imagen a Base64
  convertImageToBase64(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function() {
        const reader = new FileReader();
        reader.onloadend = function() {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(xhr.response);
      };
      xhr.onerror = function() {
        resolve("data:text/xml;base64,TGEgaW1hZ2VuIG5vIGV4aXN0ZQ==");
      };
      //xhr.open('GET', this.corsUrl + url);
      xhr.open('GET',  url);

      xhr.responseType = 'blob';
      xhr.send();
    });
  }
}
