const {openDatabase}=require('../lib/club/database.cjs'); const db=openDatabase(); console.log('Applied migrations:',db.prepare('SELECT * FROM rc_migrations').all()); db.close();
