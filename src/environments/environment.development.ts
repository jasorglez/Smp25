// Environment de DESARROLLO - Usado en rama develop
// NO EDITAR DIRECTAMENTE - Edita este archivo y el hook lo copiará a environment.ts

export const environment = {
  firebase: {
    projectId: 'beapp-501d1',
    appId: '1:151993360357:web:127db5b6d20896fb84990c',
    databaseURL: 'https://beapp-501d1-default-rtdb.firebaseio.com',
    storageBucket: 'beapp-501d1.appspot.com',
    locationId: 'us-central',
    apiKey: 'AIzaSyDxCBGKk8nT09hdW85-PyOkhw5_JPZLF1A',
    authDomain: 'beapp-501d1.firebaseapp.com',
    messagingSenderId: '151993360357',
  },

  production: false,
  urlFirebase: 'https://beapp-501d1-default-rtdb.firebaseio.com/',

  urlAzure: 'https://bi24.azurewebsites.net/',

  // Endpoints de STAGING/DESARROLLO
  urlSecurity: 'https://ms-pruebas-api.bi2.mx/api',
  urlSmp: 'https://ms-pruebas-api.bi2.mx/smp/api',
  urlBpi: 'https://ms-pruebas-api.bi2.mx/bpi/api',
  urlWarehouse: 'https://ms-pruebas-api.bi2.mx/warehouse/api',
  urlAdministration: 'https://ms-pruebas-api.bi2.mx/tracking/api',

  root: 'root@bi2.mx',

  googleDriveCredentials: {
    client_email: 'jsorglez@gmail.com',
    private_key: '	9bb18cadc7bbafd5bd7fb4c2cea3ffb503b0900a',
  },

  urlLogin: 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyDxCBGKk8nT09hdW85-PyOkhw5_JPZLF1A',
  urlGetUser: 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=AIzaSyDxCBGKk8nT09hdW85-PyOkhw5_JPZLF1A',
  urlFiles: 'gs://beapp-501d1.appspot.com',
  urlProfile: './assets/img/profile.png',
  adminFiles: 'http://localhost/sistemas-angular/marketplace/src/assets/img/index.php?key=AIzaSyDxCBGKk8nT09hdW85-PyOkhw5_JPZLF1A',
  deleteFiles: 'http://localhost/sistemas-angular/marketplace/src/assets/img/delete.php?key=AIzaSyDxCBGKk8nT09hdW85-PyOkhw5_JPZLF1A',
  urlRefreshToken: 'https://securetoken.googleapis.com/v1/token?key=AIzaSyDxCBGKk8nT09hdW85-PyOkhw5_JPZLF1A',

  version: '4.09-dev (29 Enero 2026 09:47) - Metamorphosis',
};
