/* 
JWT hitelesítő és szerepkör-ellenőrző middleware-ek
*/
import jwt from 'jsonwebtoken';

// --- TOKEN ELLENŐRZÉS ---
// Ellenőrzi a Bearer tokent, és a felhasználót a req.user-ba teszi
export const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Hiányzó vagy érvénytelen token.' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'nagyon_titkos_kulcs_ide');
        
        req.user = { id: decoded.id, szerepkor: decoded.szerepkor };
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Érvénytelen vagy lejárt token.' });
    }
};

// --- SZEREPKÖR ELLENŐRZÉS ---
// Csak a megadott szerepkörökkel engedi tovább a kérést
export const authorize = (...szerepkorok) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Nincs bejelentkezve.' });
        }
        if (!szerepkorok.includes(req.user.szerepkor)) {
            return res.status(403).json({ success: false, message: 'Nincs jogosultságod ehhez a művelethez.' });
        }
        next();
    };
};