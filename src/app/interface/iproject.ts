export interface Iproject {
      id: number;
      idConsecutivo: number;
      number       : string;
      name         : string;
      priority     : Number;
      description  : string;
      programStart?: Date;
      programEnd?  : Date;
      realPronosticLPO?: Date;
      realPronosticTTT?: Date;
      campo?       : string;
      contrato?: string;
      company?: string;
    }
    