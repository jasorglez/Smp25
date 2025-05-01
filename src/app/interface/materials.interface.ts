export interface MaterialsResponse {
  id: number;
  idCompany: number;
  insumo: string;
  barCode: string;
  articulo: null;
  idFamilia: number;
  idSubfamilia: number;
  idMedida: number;
  idUbication: number;
  description: string;
  date: Date;
  aplicaResg: boolean;
  costoMN: number;
  costoDLL: number;
  ventaMN: number;
  ventaDLL: number;
  stockMin: number;
  stockMax: number;
  picture: string;
  vigente: boolean;
  typeMaterial: string;
  active: boolean;
  pricePresentations: PricePresentations[];
}

export interface PricePresentations {
  id: number;
  idCatalogs: number;
  description: string;
  price: number;
  active: boolean;
}
