/**
 * Interfaz segura para datos de usuario
 * NO incluye información sensible como contraseñas, edad personal, teléfonos, etc.
 * Solo contiene datos necesarios para el funcionamiento de la aplicación
 */
export interface SafeUserData {
  id: number;
  displayName: string;
  email: string;
  idRol: number;
  picture: string;
  signature: string;
  idDepartament: number;
  id_company: number;
  id_position: number;
  usersmall: string;
  active: number;
  country: string;

  // Permisos y configuración
  applyBranch: string | null;
  applyPlatform: string | null;
  applyProject: string | null;
  branch: string | null;
  platform: string | null;
  project: string | null;
  allowWhatsapp: boolean;
  isRoot: boolean;
  invited: boolean;
}

/**
 * Respuesta genérica de la API
 */
export interface ApiResponse<T> {
  code: number;
  status: boolean;
  message: string;
  data: T;
}

/**
 * Limpia datos sensibles de la respuesta de usuario de la API
 * Elimina: password, age, phone, y otros campos sensibles
 */
export function sanitizeUserData(userData: any): SafeUserData {
  if (!userData) {
    throw new Error('No se recibieron datos de usuario');
  }

  // Extraer solo los campos necesarios y seguros
  const safeData: SafeUserData = {
    id: userData.id,
    displayName: userData.displayName || '',
    email: userData.email || '',
    idRol: userData.idRol || 0,
    picture: userData.picture || './assets/img/profile.png',
    signature: userData.signature || '',
    idDepartament: userData.idDepartament || 0,
    id_company: userData.id_company || 0,
    id_position: userData.id_position || 0,
    usersmall: userData.usersmall || '',
    active: userData.active ?? 1,
    country: userData.country || '',

    // Permisos
    applyBranch: userData.applyBranch ?? null,
    applyPlatform: userData.applyPlatform ?? null,
    applyProject: userData.applyProject ?? null,
    branch: userData.branch ?? null,
    platform: userData.platform ?? null,
    project: userData.project ?? null,
    allowWhatsapp: userData.allowWhatsapp ?? false,
    isRoot: userData.isRoot ?? false,
    invited: userData.invited ?? false
  };

  return safeData;
}
