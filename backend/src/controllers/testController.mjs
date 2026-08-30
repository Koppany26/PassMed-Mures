import { count } from 'drizzle-orm';
// Az indexből kényelmesen behúzzuk, amire szükségünk van
import { db } from '../db_drizzle/index.js';
import { users } from '../db_drizzle/users.js';
// Adatbázis kapcsolat és állapot ellenőrzése
export const getStatus = async (req, res) => {
    try {
        // Megszámoljuk a felhasználókat az adatbázisban a Drizzle módszerével
        const result = await db.select({ value: count() }).from(users);
        const recordsCount = result[0].value;
        
        return res.status(200).json({
            success: true,
            message: 'A backend sikeresen csatlakozott a PostgreSQL adatbázishoz a Drizzle segítségével!',
            recordsInDb: recordsCount
        });
    } catch (error) {
        console.error('Adatbázis hiba:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Nem sikerült elérni az adatbázist.' 
        });
    }
};