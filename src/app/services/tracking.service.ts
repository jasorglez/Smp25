import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { BehaviorSubject, map } from 'rxjs';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class TrackingService {


   private http= inject(HttpClient) ;

 formatearMoneda(valor: number): string {
    const formatter = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    });
    return formatter.format(valor);
  }


  private currentProject = new BehaviorSubject<string>('');

  private emailser     : string = '' ;
  setEmail(email: string): void {
    this.emailser = email;
    localStorage.setItem('mail', this.emailser)
  }
  getEmail(): string {
    return this.emailser;
  }

  // DATOS DE LA COMPANIA
  private namecomp     : string = '' ;
  setnameComp(namecomp: string): void {
    this.namecomp = namecomp;
  }
  getnameComp():string {
    return this.namecomp
  }

  private picturecomp  : string = '' ;
  setpictureComp(picturecomp: string): void {
    this.picturecomp = picturecomp;
  }
  getpictureComp():string {
    return this.picturecomp
 }

 // TERMINO DE LA CIA

  private fri          : string = '' ;
  setformatrepint(fri : string): void {
    this.fri = fri ;
  }
  getformrepint() : string {
  return this.fri ;
  }

  private nameuser     : string = '' ;
  setnameUser(name: string) : void{
    this.nameuser = name ;
  }
  getnameUser() {
    return this.nameuser ;
  }

  private pictureuser : string = '' ;
  setpictureUser(picture : string) : void {
    this.pictureuser = picture
  }
  getpictureUser(){
    return this.pictureuser ;
  }

  private projectser   : string = '' ;
  setProject(project: string) : void {
    this.projectser = project ;
    localStorage.setItem('project', this.projectser) ;
 }
 getProject() {
   return this.projectser ;
 }

 private branchser: string = '';
 setBranch(branch: string): void {
   this.branchser = branch;
   localStorage.setItem('branch', this.branchser);
 }
 getBranch(): string {
   if (!this.branchser) {
     const storedBranch = localStorage.getItem('branch');
     this.branchser = storedBranch !== null ? storedBranch : '';
   }
   return this.branchser;
 }


  private companyser   : string = '' ;
  setCompany(company : string) : void {
    this.companyser = company ;
    localStorage.setItem("company",this.companyser);
  }
  getCompany(){
    return this.companyser ;
  }

  private contract         : string = '' ;
  setContract(contract: string): void {
    this.contract = contract ;
  }
  getContract() {
    return this.contract ;
  }

  private nameproject      : string = '' ;
  setnameProject(name: string): void {
    this.nameproject= name ;
   }
  getnameProject() {
    return this.nameproject ;
  }

  private ubicationproject : string = '' ;
  setubicationProject(ubication: string): void {
    this.ubicationproject= ubication ;
   }
   getubicationProject() {
    return this.ubicationproject
  }

  private startproject : string = '' ;
  setStart(start : string): void {
    this.startproject = start ;
   }
   getStart() {
    return this.startproject ;
   }

  private endproject   : string = '' ;
  setEnd(end : string): void {
    this.endproject = end ;
   }
   getEnd() {
    return this.endproject ;
   }

  public ultimaventana : string  = '';
  setultimaVentana(ultven : string): void {
    this.ultimaventana = ultven ;
  }
  getultimaVentana() {
    return this.ultimaventana;
  }

  public idEmp : number = 0 ;
  setidEmp(ne : number) : void {
    this.idEmp = ne;
  }
  getidEmp() {
    return this.idEmp ;
 }

  private fecha: Date = new Date('2024-01-01');
  setfecha(fec : Date) : void{
    this.fecha = fec;
   }
   getFecha() {
    return this.fecha ;
  }

  private numRes  : string = '';
  setnumRes (nr : string) : void {
    this.numRes = nr ;
  }
  getnumRes () {
    return this.numRes  ;
  }

  private comment : string = '' ;
  setCommen (co : string) : void {
    this.comment =  co ;
  }
  getCom() {
    return this.comment ;
  }

  private idNumSap : number = 0 ;
  setidnumsap(id: number) : void {
    this.idNumSap = id ;
   }
   getidNumSap() {
      return this.idNumSap ;
   }

  private cpser : number = 0 ;
  setCp(cp: number) : void {
    this.cpser = cp ;
   }
   getCp() {
      return this.cpser ;
   }

  private platformser : number = 0 ;
  setPlatform(pl: number) : void {
    this.platformser = pl ;
   }
   getPlat() {
      return this.platformser ;
   }

   private plataforma:string = '' ;
   setPlataforma(p2: string) : void {
    this.plataforma = p2 ;
   }
   getPlataforma() {
      return this.plataforma ;
   }

   private platform : number = 0;
   setIdPlatform(p2: number) : void {
    this.platform = p2 ;
   }
   getIdPlatform() {
      return this.platform ;
   }

  private numprov : number = 0;
  setnumpro (n: number) {
      this.numprov = n ;
  }
   getnumpro() {
    return this.numprov ;
   }

   private aproject : string = '' ;
  setaproject (ap: string) {
      this.aproject = ap ;
  }
   getaproject() {
    return this.aproject ;
   }

   private abranch : string = '' ;
  setabranch (ab: string) {
      this.abranch = ab ;
  }
   getabranch() {
    return this.abranch ;
   }

   private aplatform : string = '' ;
  setaplatform (apl: string) {
      this.aplatform = apl ;
  }
   getaplat() {
    return this.aplatform ;
   }

   private emailprofile : string = '' ;
  setemailprof (epf: string) {
      this.emailprofile = epf ;
  }
   getemailprof() {
    return this.emailprofile ;
   }

   private bandform : string = '' ;
   setbandform (bandform: string) {
       this.bandform = bandform ;
   }
    getbandform() {
     return this.bandform ;
    }

    private bandformEO : string = '' ;
    setbandformEO (bandformEO: string) {
        this.bandformEO = bandformEO ;
    }
     getbandformEO() {
      return this.bandformEO ;
     }

  changeProject(project : string) {
      this.currentProject.next(project) ;
  }


  /*=============================================
	Guardar información de la
	=============================================*/
  async addLog(company: string, description: string, origin: string, user: string) {
    // Obtener la fecha actual
    const datetime = new Date();

    if (!user) user = this.getEmail();

    const data = {
      company,
      datetime,
      origin,
      description,
      user,
      idn: 0,
    };

    //console.log("Tracking", data)

    try {
      const response: any = await this.http.get(`${environment.urlFirebase}tracking.json?orderBy="$key"&limitToLast=1`).toPromise();

      const lastLogId = Object.keys(response)[0]; // Obtener la clave del último registro
      const lastLog = response[lastLogId] as { idn: number }; // Obtener el último registro completo con la propiedad "id"

      // Asignar el valor de "id" del último registro al nuevo registro
      data['idn'] = lastLog ? lastLog.idn + 1 : 1;

      //console.log(data) ;

      const postResponse = await this.http.post(`${environment.urlFirebase}tracking.json`, data).toPromise();

      const postResponseAzu = await this.http.post(`${environment.urlAzure}api/Trackings`, data).toPromise();

      //console.log('Log creado exitosamente:', postResponse);
    } catch (error) {

      console.error('Error al crear el log TRACKINGS:', error);

    }
  }


	getDataTracking(valoruser :string){

    return this.http.get(`${environment.urlFirebase}tracking.json?orderBy="user"&equalTo="${valoruser}"&orderBy="$idn"&print=pretty&sortOrder="desc"`);

	}


  getTrackingRecordsByUser(user: string) {
    const url = `${environment.urlFirebase}tracking.json?orderBy="user"&equalTo="${user}"`;

    return this.http.get(url).pipe(
      map((response: any) => {
        // Filtrar los registros por el campo "user"
        const filteredRecords = Object.values(response).filter((record: any) => record.user === user);

        // Ordenar los registros por el campo "idn" en forma ascendente
        const sortedRecords = filteredRecords.sort((a: any, b: any) => a.idn - b.idn);

        // Invertir el orden de los registros para que los últimos aparezcan primero
        const reversedRecords = sortedRecords.reverse();

        return reversedRecords;

      })
    );
  }



}
