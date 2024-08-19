export interface Ibooklog {
   id           : number;
   projectId?   : number; // ? indica que es opcional
   reportId?    : number;
   date?        : Date;
   typeNote     : string;
   timexnote?   : string;  
   description? : string;
   supervisor?  : string;
}