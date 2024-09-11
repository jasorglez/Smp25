// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  firebase: {
     projectId: 'beapp-501d1',
     appId: '1:151993360357:web:127db5b6d20896fb84990c',
     //aqui juego con las base de datos
     databaseURL: 'https://beapp-501d1-default-rtdb.firebaseio.com',
     // databaseURL: 'https://beapp-testing-b89.firebaseio.com/',
     storageBucket: 'beapp-501d1.appspot.com',
     locationId: 'us-central',
     apiKey: 'AIzaSyDxCBGKk8nT09hdW85-PyOkhw5_JPZLF1A',
     authDomain: 'beapp-501d1.firebaseapp.com',
     messagingSenderId: '151993360357',
  },

  production: false,
//aqui juego con las base de datos
  urlFirebase   : 'https://beapp-501d1-default-rtdb.firebaseio.com/',
  urlAzure    : 'https://bi24.azurewebsites.net/',
  urlAzure2    : 'http://198.71.49.16:5003/',
  //  urlAzure    : 'https://localhost:7089/',


  googleDriveCredentials:{ client_email: 'jsorglez@gmail.com',
                           private_key: '	9bb18cadc7bbafd5bd7fb4c2cea3ffb503b0900a',
  },

  urlLogin: 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyDxCBGKk8nT09hdW85-PyOkhw5_JPZLF1A',

  urlGetUser: 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=AIzaSyDxCBGKk8nT09hdW85-PyOkhw5_JPZLF1A',

  urlFiles: 'gs://beapp-501d1.appspot.com',

  urlProfile :'./assets/img/profile.png',

  adminFiles: 'http://localhost/sistemas-angular/marketplace/src/assets/img/index.php?key=AIzaSyDxCBGKk8nT09hdW85-PyOkhw5_JPZLF1A',

  deleteFiles:'http://localhost/sistemas-angular/marketplace/src/assets/img/delete.php?key=AIzaSyDxCBGKk8nT09hdW85-PyOkhw5_JPZLF1A',

  urlRefreshToken: 'https://securetoken.googleapis.com/v1/token?key=AIzaSyDxCBGKk8nT09hdW85-PyOkhw5_JPZLF1A',
};


/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.


