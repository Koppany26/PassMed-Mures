/* 
regisztráció és a bejelentkezés
*/
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../db_drizzle/index.js';
import { users } from '../db_drizzle/users.js';

// --- REGISZTRÁCIÓ ---
export const registerUser = async (req, res) => {
    try {
        const { nev, email, jelszo } = req.body;
        const normalizedEmail = email.toLowerCase().trim();

        // 1. Foglaltság ellenőrzése
        const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Ez az email cím már foglalt.' });
        }

        // 2. Jelszó titkosítása
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(jelszo, salt);

        // 3. Mentés az adatbázisba
        const newUser = await db.insert(users).values({
            nev,
            email: normalizedEmail,
            jelszoHash: hashedPassword,
        }).returning();

        return res.status(201).json({
            success: true,
            message: 'Sikeres regisztráció!',
            user: { id: newUser[0].id, nev: newUser[0].nev }
        });
    } catch (error) {
        console.error('Regisztrációs hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};

// --- BEJELENTKEZÉS ---
export const loginUser = async (req, res) => {
    try {
        const { email, jelszo } = req.body;
        const normalizedEmail = email.toLowerCase().trim();

        // 1. Felhasználó keresése
        const foundUsers = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
        const user = foundUsers[0];

        // Diszkrét hibaüzenet, ha nincs ilyen email
        if (!user) {
            return res.status(401).json({ success: false, message: 'Helytelen email vagy jelszó.' });
        }

        // 2. Jelszó ellenőrzése
        const isMatch = await bcrypt.compare(jelszo, user.jelszoHash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Helytelen email vagy jelszó.' });
        }

        // 3. Token generálása (1 napig érvényes)
        const token = jwt.sign(
            { id: user.id, szerepkor: user.szerepkor },
            process.env.JWT_SECRET || 'nagyon_titkos_kulcs_ide',
            { expiresIn: '1d' }
        );

        return res.status(200).json({
            success: true,
            message: 'Sikeres bejelentkezés!',
            token,
            user: { id: user.id, nev: user.nev, szerepkor: user.szerepkor }
        });
    } catch (error) {
        console.error('Belépési hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};

// --- AKTUÁLIS FELHASZNÁLÓ LEKÉRÉSE ---
// A token alapján visszaadja a bejelentkezett felhasználó adatait
export const getMe = async (req, res) => {
    try {
        const foundUsers = await db.select({
            id: users.id,
            nev: users.nev,
            email: users.email,
            szerepkor: users.szerepkor,
            csoportId: users.csoportId,
        }).from(users).where(eq(users.id, req.user.id)).limit(1);

        const user = foundUsers[0];
        if (!user) {
            return res.status(404).json({ success: false, message: 'Felhasználó nem található.' });
        }

        return res.status(200).json({ success: true, user });
    } catch (error) {
        console.error('Felhasználó lekérési hiba:', error);
        return res.status(500).json({ success: false, message: 'Szerverhiba történt.' });
    }
};
