export interface MaterialsResponse {
  id: number | string;
  idCompany: number;
  idBranch?: number | null;
  typeOcorReq?: string;
  idCustomer?: number | null;
  insumo: string;
  barCode?: string;
  barcode?: string;
  company?: string;
  articulo: string | null;
  idCategory: number;
  categoria: string;
  idFamilia: number;
  familia: string;
  idSubfamilia: number;
  subfamilia: string;
  idMedida?: number;
  idUbication?: number;
  description?: string;
  folio?: string;
  price?: number;
  quantity?: number;
  date?: string | Date;
  aplicaResg?: boolean;
  costoMN?: number;
  costoDLL?: number;
  ventaMN?: number;
  ventaDLL?: number;
  stockMin?: number;
  stockMax?: number;
  picture: string;
  vigente?: boolean;
  typeMaterial?: string;
  descriptionPackage?: string | null;
  packageQuantity?: number;
  measure?: string | null;
  weightOrVolumes?: number;
  expiration?: number;
  folioOcorReq?: string;
  inOrOutQuantity?: number;
  pending?: number;
  active?: boolean;
  providerCount: number;
  subfamilyCount: number;
  pricePresentations?: PricePresentations[];
  // Propiedades para detalles
  proveedoresData?: any[];
  familiaData?: any[];
  sucursalData?: any[];
  detailType?: string;
  // Propiedades de control para el grid
  __isNew?: boolean;
  __modified?: boolean;
  porAutorizar?: boolean;
}

export interface PricePresentations {
  id: number;
  idCatalogs: number;
  description: string;
  price: number;
  active: boolean;
}
