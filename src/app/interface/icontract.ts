export interface Icontract {
  id: number;
  numberContract: string;
  description   : string;
  descripSmall  : string;
  idCompany     : number;
  datestar      : Date | null;
  dateend      : Date | null;
  amountMx      : number;
  amountDll     : number;
  resident      : string | null;
  supervisor    : string | null;
  name          : string | null;
}
