import prisma from '../config/prisma.mjs';

// Adatbázis kapcsolat és állapot ellenőrzése
export const getStatus = async (req, res) => {
    try {
        // Megszámoljuk a kategóriákat az adatbázisban, ezzel tesztelve a kapcsolatot
        const categoriesCount = await prisma.category.count();
        
        return res.status(200).json({
            success: true,
            message: 'A backend sikeresen csatlakozott a PostgreSQL adatbázishoz a Prisma segítségével!',
            categoriesInDb: categoriesCount
        });
    } catch (error) {
        console.error('Adatbázis hiba:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Nem sikerült elérni az adatbázist.' 
        });
    }
};