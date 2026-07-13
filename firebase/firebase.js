// firebaseConfig.js
const admin = require('firebase-admin');
const serviceAccount =  process.env.NODE_ENV === 'production'  ? require('/etc/secrets/fivlia.json')
  : require('./bikaner.json');


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
