
// fájl szerepe az, hogy létrehozza és központosítsa 
// a kapcsolatot az alkalmazásod és az adatbázis között 
// a Prisma ORM segítségével.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma;