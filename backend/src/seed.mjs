/*
Alapadatok feltöltése
Futtatás: npm run seed (a backend mappából)
*/
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from './db_drizzle/index.js';
import { users } from './db_drizzle/users.js';
import { categories, topics, bodyRegions } from './db_drizzle/questions.js';

const log = (msg) => console.log(`[SEED] ${msg}`);

const biologyTopics = [
    'Bevezető',
    'Biokémiai vegyületek',
    'Sejtek és sejtélettan',
    'A szövetek',
    'A köztakaró',
    'Csontok és ízületek',
    'A csontrendszer',
    'Izomszövet',
    'Az izmok',
    'Az idegszövet',
    'Az idegrendszer felépítése',
    'Az érzékszervek',
    'Endokrin rendszer',
    'Vér',
    'Szív- és érrendszer',
    'A nyirok- és immunrendszer',
    'Légzőrendszer',
    'Emésztőrendszer',
    'Anyagcsere és táplálkozás',
    'Kiválasztó rendszer',
    'Víz-, elektrolit- és sav-bázis egyensúly',
    'Férfi szaporító rendszer',
    'Női szaporító rendszer',
];

const bodyRegionData = [
    { regionKey: 'whole_body', name: 'Teljes test', svgRegionId: 'whole-body' },
    { regionKey: 'head', name: 'Fej', svgRegionId: 'head' },
    { regionKey: 'chest', name: 'Mellkas', svgRegionId: 'chest' },
    { regionKey: 'abdomen', name: 'Has', svgRegionId: 'abdomen' },
    { regionKey: 'pelvis', name: 'Medence', svgRegionId: 'pelvis' },
    { regionKey: 'arms', name: 'Karok', svgRegionId: 'arms' },
    { regionKey: 'legs', name: 'Lábak', svgRegionId: 'legs' },
    { regionKey: 'skin', name: 'Köztakaró', svgRegionId: 'skin' },
];

async function ensureUser({ name, email, role, passwordHash }) {
    const existing = await db.select({ id: users.id }).from(users)
        .where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
        log(`${role === 'TEACHER' ? 'Tanár' : 'Diák'} már létezik (id: ${existing[0].id})`);
        return;
    }

    const inserted = await db.insert(users).values({
        name,
        email,
        passwordHash,
        role,
    }).returning({ id: users.id });
    log(`${role === 'TEACHER' ? 'Tanár' : 'Diák'} létrehozva (id: ${inserted[0].id})`);
}

async function ensureCategory(name) {
    const existing = await db.select({ id: categories.id }).from(categories)
        .where(eq(categories.name, name)).limit(1);
    if (existing.length > 0) return existing[0].id;

    const inserted = await db.insert(categories).values({ name })
        .returning({ id: categories.id });
    return inserted[0].id;
}

async function seed() {
    log('Alapadatok feltöltése elkezdődött...');

    const passwordHash = await bcrypt.hash('jelszo123', 10);
    await ensureUser({
        name: 'Dr. Kovács Anna',
        email: 'tanar@passmed.hu',
        role: 'TEACHER',
        passwordHash,
    });
    await ensureUser({
        name: 'Nagy Péter',
        email: 'diak@passmed.hu',
        role: 'STUDENT',
        passwordHash,
    });

    const biologyCategoryId = await ensureCategory('Biológia');
    await ensureCategory('Kémia');

    for (const name of biologyTopics) {
        const existing = await db.select({ id: topics.id, categoryId: topics.categoryId })
            .from(topics).where(eq(topics.name, name)).limit(1);
        if (existing.length > 0) {
            if (existing[0].categoryId !== biologyCategoryId) {
                await db.update(topics).set({ categoryId: biologyCategoryId })
                    .where(eq(topics.id, existing[0].id));
            }
            continue;
        }
        await db.insert(topics).values({ name, categoryId: biologyCategoryId });
    }

    for (const region of bodyRegionData) {
        const existing = await db.select({ id: bodyRegions.id }).from(bodyRegions)
            .where(eq(bodyRegions.regionKey, region.regionKey)).limit(1);
        if (existing.length === 0) {
            await db.insert(bodyRegions).values(region);
        }
    }

    log('Alapadatok feltöltése kész.');
    log('Vizsgatárgyak: Biológia, Kémia');
    log(`Biológiai témakörök: ${biologyTopics.length}`);
    log(`Testtérkép-régiók: ${bodyRegionData.length}`);
    log('Tesztek és kérdések nincsenek seedelve; ezeket a tanár hozza létre.');
    log('Fejlesztői belépés: tanar@passmed.hu / diak@passmed.hu (jelszó: jelszo123)');
}

seed().catch((error) => {
    console.error('[SEED] Hiba történt:', error);
    process.exitCode = 1;
});
