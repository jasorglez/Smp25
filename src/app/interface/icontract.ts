export interface Icontract {
  id: number;
  numberContract: string;
  description   : string;
  descripSmall  : string;
  idContrato     : number;
  idBranch      : number;
  idProvider    : number;
  dateStar      : string | null;
  dateEnd      : string | null;
  term          : number;
  amountMx      : number;
  amountDll     : number;
  resident      : string | null;
  supervisor    : string | null;
  name          : string | null;
  speciality    : string | null;
  active        : number;
  stateContract : string | null;
  consecutive   : number;
}
