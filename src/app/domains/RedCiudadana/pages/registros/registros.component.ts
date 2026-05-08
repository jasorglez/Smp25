import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Camera } from '@capacitor/camera';
import { FormsModule } from '@angular/forms';
import { SharedModule } from 'app/shared/shared.module';
import { NgSelectModule } from '@ng-select/ng-select';
import { RedMiembrosService } from 'app/services/red-miembros.service';
import { OfflineQueueService } from 'app/services/offline-queue.service';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { SignalsService } from 'app/services/signals.service';
import { IRedMiembro } from 'app/interface/ired-miembro';
import { alerts } from 'app/helpers/alerts';

type Vista = 'lista' | 'rapido' | 'completo';


@Component({
  selector: 'app-red-registros',
  standalone: true,
  imports: [SharedModule, FormsModule, NgSelectModule],
  templateUrl: './registros.component.html',
  styleUrl: './registros.component.scss',
})
export class RedRegistrosComponent implements OnInit, OnDestroy {
  private redService      = inject(RedMiembrosService);
  private offlineQueue    = inject(OfflineQueueService);
  private imageHandler    = inject(ImageHandlerService);
  private signalsService  = inject(SignalsService);

  readonly estadosMexico = [
    'AGUASCALIENTES','BAJA CALIFORNIA','BAJA CALIFORNIA SUR','CAMPECHE',
    'CHIAPAS','CHIHUAHUA','CIUDAD DE MÉXICO','COAHUILA DE ZARAGOZA',
    'COLIMA','DURANGO','ESTADO DE MÉXICO','GUANAJUATO','GUERRERO','HIDALGO',
    'JALISCO','MICHOACÁN DE OCAMPO','MORELOS','NAYARIT','NUEVO LEÓN',
    'OAXACA','PUEBLA','QUERÉTARO','QUINTANA ROO','SAN LUIS POTOSÍ',
    'SINALOA','SONORA','TABASCO','TAMAULIPAS','TLAXCALA',
    'VERACRUZ DE IGNACIO DE LA LLAVE','YUCATÁN','ZACATECAS'
  ];

  currentView: Vista = 'lista';
  currentStep        = 1;
  readonly TOTAL_STEPS = 4;

  isLoading      = false;
  isOnline       = navigator.onLine;
  pendingCount   = 0;
  showModeSheet  = false;
  searchText     = '';

  miembros:          IRedMiembro[] = [];
  miembrosFiltrados: IRedMiembro[] = [];

  readonly PAGE_SIZE = 5;
  currentPage = 0;

  get totalPages() { return Math.max(1, Math.ceil(this.miembrosFiltrados.length / this.PAGE_SIZE)); }
  get miembrosPagina() {
    const start = this.currentPage * this.PAGE_SIZE;
    return this.miembrosFiltrados.slice(start, start + this.PAGE_SIZE);
  }
  nextPage() { if (this.currentPage < this.totalPages - 1) this.currentPage++; }
  prevPage() { if (this.currentPage > 0) this.currentPage--; }

  form: Partial<IRedMiembro> = {};
  previewFrente: string | null = null;
  previewReverso: string | null = null;
  fileFrente:  File | null = null;
  fileReverso: File | null = null;

  private idRoot = 0;
  private onlineHandler  = () => { this.isOnline = true;  this.syncPending(); };
  private offlineHandler = () => { this.isOnline = false; };

  ngOnInit() {
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    window.addEventListener('online',  this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
    this.loadMiembros();
    this.refreshPendingCount();
  }

  ngOnDestroy() {
    window.removeEventListener('online',  this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);
  }

  async loadMiembros() {
    this.isLoading = true;
    this.redService.getByRoot(this.idRoot).subscribe({
      next: (data) => {
        this.miembros = data;
        this.applyFilter();
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; }
    });
  }

  applyFilter() {
    const q = this.searchText.toLowerCase().trim();
    this.miembrosFiltrados = q
      ? this.miembros.filter(m =>
          `${m.nombre} ${m.apellidoPaterno} ${m.apellidoMaterno ?? ''} ${m.claveElector ?? ''}`
            .toLowerCase().includes(q))
      : [...this.miembros];
    this.currentPage = 0;
  }

  get totalMiembros()  { return this.miembros.length; }
  get totalAfiliados() { return this.miembros.filter(m => m.afiliado).length; }

  openModeSheet()  { this.showModeSheet = true; }
  closeModeSheet() { this.showModeSheet = false; }

  openForm(modo: 'rapido' | 'completo') {
    this.closeModeSheet();
    this.resetForm();
    this.currentView = modo;
    this.currentStep = 1;
  }

  backToList() {
    this.currentView = 'lista';
    this.resetForm();
  }

  resetForm() {
    this.form = { idRoot: this.idRoot, activo: true, afiliado: false };
    this.previewFrente  = null;
    this.previewReverso = null;
    this.fileFrente     = null;
    this.fileReverso    = null;
  }

  async captureFrente(): Promise<void> {
    try {
      const result = await Camera.chooseFromGallery({ quality: 85 });
      const first = result.results?.[0];
      if (!first?.webPath) return;
      const { dataUrl, file } = await this.webPathToDataUrlAndFile(first.webPath, 'ine-frente.jpg');
      this.previewFrente = dataUrl;
      this.fileFrente = file;
    } catch { /* cancelado por el usuario */ }
  }

  async captureReverso(): Promise<void> {
    try {
      const result = await Camera.chooseFromGallery({ quality: 85 });
      const first = result.results?.[0];
      if (!first?.webPath) return;
      const { dataUrl, file } = await this.webPathToDataUrlAndFile(first.webPath, 'ine-reverso.jpg');
      this.previewReverso = dataUrl;
      this.fileReverso = file;
    } catch { /* cancelado por el usuario */ }
  }

  private async webPathToDataUrlAndFile(webPath: string, filename: string): Promise<{ dataUrl: string; file: File }> {
    const response = await fetch(webPath);
    const blob = await response.blob();
    const dataUrl = await new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    return { dataUrl, file: new File([blob], filename, { type: blob.type || 'image/jpeg' }) };
  }

  clearPhoto(side: 'frente' | 'reverso') {
    if (side === 'frente')  { this.previewFrente  = null; this.fileFrente  = null; }
    if (side === 'reverso') { this.previewReverso = null; this.fileReverso = null; }
  }

  onCpInput(event: Event) {
    const input = event.target as HTMLInputElement;
    input.value = input.value.replace(/\D/g, '').slice(0, 5);
    this.form.codigoPostal = input.value;
  }


  // ─── Validación ─────────────────────────────────────────────────────────────

  private validarPaso1(): boolean {
    if (!this.form.nombre?.trim() || !this.form.apellidoPaterno?.trim()) {
      alerts.basicAlert('Campos requeridos', 'Nombre y Apellido Paterno son obligatorios', 'warning');
      return false;
    }
    return true;
  }

  nextStep() {
    if (this.currentStep === 1 && !this.validarPaso1()) return;
    if (this.currentStep < this.TOTAL_STEPS) this.currentStep++;
  }

  prevStep() {
    if (this.currentStep > 1) this.currentStep--;
  }

  prevStepOrBack() {
    if (this.currentStep > 1) this.prevStep();
    else this.backToList();
  }

  // ─── Guardar ────────────────────────────────────────────────────────────────

  private normalizeForm() {
    const fields: (keyof IRedMiembro)[] = [
      'nombre','apellidoPaterno','apellidoMaterno','curp','claveElector',
      'calle','colonia','municipio','numExterior','numInterior',
      'distritoElectoral','entidadFederativa','observaciones'
    ];
    for (const f of fields) {
      if (typeof this.form[f] === 'string') {
        (this.form as any)[f] = (this.form[f] as string).toUpperCase();
      }
    }
  }

  async guardar() {
    this.normalizeForm();
    if (!this.validarPaso1()) return;
    this.isLoading = true;
    try {
      if (this.isOnline) {
        await this.guardarOnline();
      } else {
        await this.guardarOffline();
      }
      this.backToList();
      await this.loadMiembros();
    } catch {
      alerts.basicAlert('Error', 'No se pudo guardar el registro', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  private async guardarOnline() {
    if (this.fileFrente) {
      this.form.ineFrenteUrl = await this.imageHandler.uploadFileToFirebase(
        this.fileFrente, 'red-ciudadana/ine'
      );
    }
    if (this.fileReverso) {
      this.form.ineReversoUrl = await this.imageHandler.uploadFileToFirebase(
        this.fileReverso, 'red-ciudadana/ine'
      );
    }
    await new Promise<void>((res, rej) =>
      this.redService.create(this.form).subscribe({ next: () => res(), error: rej })
    );
    alerts.basicAlert('Éxito', 'Miembro registrado', 'success');
  }

  private async guardarOffline() {
    await this.offlineQueue.enqueue({
      miembro:           { ...this.form },
      ineFrenteBase64:   this.previewFrente,
      ineReversoBase64:  this.previewReverso,
    });
    await this.refreshPendingCount();
    alerts.basicAlert('Guardado', 'Se sincronizará cuando tengas conexión', 'info');
  }

  // ─── Afiliación ─────────────────────────────────────────────────────────────

  toggleAfiliado(miembro: IRedMiembro) {
    miembro.afiliado = !miembro.afiliado;
    this.redService.update(miembro.id!, miembro).subscribe({
      error: () => { miembro.afiliado = !miembro.afiliado; } // revert on error
    });
  }

  // ─── Sincronización offline ─────────────────────────────────────────────────

  async syncPending() {
    const queue = await this.offlineQueue.getQueue();
    if (!queue.length) return;

    let synced = 0;
    for (const item of queue) {
      try {
        if (item.ineFrenteBase64) {
          item.miembro.ineFrenteUrl = await this.imageHandler.uploadFileToFirebase(
            this.base64ToFile(item.ineFrenteBase64, 'ine-frente.jpg'), 'red-ciudadana/ine'
          );
        }
        if (item.ineReversoBase64) {
          item.miembro.ineReversoUrl = await this.imageHandler.uploadFileToFirebase(
            this.base64ToFile(item.ineReversoBase64, 'ine-reverso.jpg'), 'red-ciudadana/ine'
          );
        }
        await new Promise<void>((res, rej) =>
          this.redService.create(item.miembro).subscribe({ next: () => res(), error: rej })
        );
        await this.offlineQueue.remove(item.id);
        synced++;
      } catch { /* continuar con el siguiente */ }
    }

    await this.refreshPendingCount();
    if (synced > 0) {
      await this.loadMiembros();
      alerts.basicAlert('Sincronizado', `${synced} registro(s) enviados`, 'success');
    }
  }

  async refreshPendingCount() {
    this.pendingCount = await this.offlineQueue.count();
  }

  private base64ToFile(base64: string, filename: string): File {
    const [header, data] = base64.split(',');
    const mime = header.match(/:(.*?);/)![1];
    const bytes = atob(data);
    const arr   = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new File([arr], filename, { type: mime });
  }
}
