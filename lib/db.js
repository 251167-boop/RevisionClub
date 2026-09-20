import { openDatabase } from './club/database.cjs';
export const db = globalThis.__revisionDb || openDatabase();
if (process.env.NODE_ENV !== 'production') globalThis.__revisionDb = db;
