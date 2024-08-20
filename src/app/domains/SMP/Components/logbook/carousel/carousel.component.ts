import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, Injectable, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BlobService } from 'app/services/blob.service';
import { ReceivedataService } from 'app/services/receivedata.service';
import { catchError, finalize, of, tap } from 'rxjs';

@Component({
  selector: 'app-carousel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './carousel.component.html',
  styleUrl: './carousel.component.scss'
})

@Injectable()
export class CarouselComponent implements OnChanges {
  @Input()
  inputData!: { id: number; date: string; };
  entrada: any[] = [];
  numItems: number = 0;
  images: any[] = [];
  urlAzure = 'https://bi24.azurewebsites.net/api/Logbook/showphotos';
  lb: string = '';
  id: number = 0;
  currentIndex: number = 0;
  isLoading: boolean = true;
  imagenReal: string = '';

  ngOnChanges(changes: SimpleChanges) {
    if (changes['inputData'] && changes['inputData'].currentValue) {
      this.id = this.inputData.id;
      this.lb = this.inputData.date;
      this.conseguirDatos();
    }
  }

  @ViewChild('carousel', { static: false }) carousel: ElementRef | undefined;

  constructor(private modalService: NgbModal, private datos: ReceivedataService, private http: HttpClient, private blobService: BlobService) {
  }

  conseguirDatos() {

    this.isLoading = true;

    this.datos.recibirDatos(this.urlAzure, this.lb, this.id).pipe(
      tap((data: any[]) => {
        this.entrada = data;
        this.numItems = this.entrada.length;
      }),
      catchError((error: any) => {
        console.error('Error occurred:', error);
        return of(null);
      }),
      finalize(() => {
        this.bucleDatos();
        this.isLoading = false;
      })
    ).subscribe();
  }

  async bucleDatos() {
    // Vaciamos los datos
    this.images = [];

    for (let i = 0; i < this.numItems; i++) {
      let temporal = [];
      const urlBlob = await this.blobService.sendBlobUrl(this.entrada[i]?.imageAzure).toPromise();
      temporal = [
        {
          src: urlBlob?.url,
          alt: this.entrada[i]?.description,
          description: this.entrada[i]?.description
        }
      ]
      // Empujamos los datos almacenados en temporal a gestionarDatos
      this.images.push(...temporal);
    }
  }

  ngAfterViewInit(): void {
    // Optional: any logic needed after view initialization
  }

  openCarouselModal(content: any, index: number): void {
    this.currentIndex = index;
    this.modalService.open(content, { size: 'lg', centered: true }).result.then(() => {
      // Modal closed
    }, () => {
      // Modal dismissed
    });
  }

  // Function to set the active slide in the carousel
  setActiveSlide(): void {
    if (this.carousel && this.carousel.nativeElement) {
      const carouselElement = this.carousel.nativeElement;
      const carouselInner = carouselElement.querySelector('.carousel-inner');
      const items = carouselInner.querySelectorAll('.carousel-item');
      items.forEach((item: HTMLElement, index: number) => {
        item.classList.remove('active');
        if (index === this.currentIndex) {
          item.classList.add('active');
        }
      });
      const indicators = carouselElement.querySelectorAll('.carousel-indicators button');
      indicators.forEach((indicator: HTMLElement, index: number) => {
        indicator.classList.remove('active');
        if (index === this.currentIndex) {
          indicator.classList.add('active');
        }
      });
    }
  }


}