export interface MaterialsResponse {
  id: number;
  idCompany: number;
  idBranch: number | null;
  idCustomer: number | null;
  insumo: string;
  barCode: string;
  articulo: null;
  idCategory: number;
  idFamilia: number;
  idSubfamilia: number;
  idMedida: number;
  idUbication: number;
  description: string;
  date: string | Date;
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
  descriptionPackage: string | null;
  packageQuantity: number;
  measure: string | null;
  weightOrVolumes: number;
  expiration: number;
  active: boolean;
  pricePresentations?: PricePresentations[];
}

export interface PricePresentations {
  id: number;
  idCatalogs: number;
  description: string;
  price: number;
  active: boolean;
}
