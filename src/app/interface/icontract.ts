export interface Icontract {
  id: number;
  numberContract: string;
  description   : string;
  descripSmall  : string;
  idCompany     : number;
  idState       : number ;
  year          : number ;
  datestar      : Date | null;
  dateendcont   : Date | null;
  pronostic     : Date | null;
  amountMx      : number;
  amountDll     : number;
  resident      : string | null;
  supervisor    : string | null;
}
