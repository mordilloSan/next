const { Router } = require("express");
const router = Router();
const { authenticate } = require("authenticate-pam");

// Check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session?.user) {
        return next();
    }
    req.session?.destroy((err) => {
        if (err) console.error("Error destroying session:", err);
        res.clearCookie('connect.sid').clearCookie('token').status(401).send("Unauthorized");
        console.log("Unauthorized access blocked");
    });
}

// Login route
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    authenticate(username, password, (err) => {
        if (err) {
            console.error('Authentication failed:', err);
            return res.status(401).json({ error: 'Authentication failed' });
        }
        console.log(`User authenticated successfully: ${username}`);
        req.session.user = { username, password };
        return res.json({ username, message: 'Authenticated successfully' });
    },
        { serviceName: 'login' }
    );
});

// Logout route
router.get('/logout', (req, res) => {
    req.session?.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).send('Logout failed');
        }
        res.clearCookie('connect.sid').clearCookie('token').send('Logout successful');
        console.log('Logout successful');
    });
});

module.exports = { router, isAuthenticated };
