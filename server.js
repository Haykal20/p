require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const path = require('path');
const multer = require('multer');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const app = express();

// Update these values to use environment variables
const PORT = process.env.PORT || 8080;
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;

// Generate a random session secret if none is provided
const SESSION_SECRET = process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex');

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = process.env.NODE_ENV === 'production' 
            ? process.env.UPLOAD_DIR 
            : './uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Middleware
app.use(bodyParser.json());
app.use('/uploads', express.static('uploads'));

// Melayani file statis
app.use(express.static(path.join(__dirname)));

// Update session configuration for Railway
app.use(session({
    store: new FileStore({
        path: process.env.NODE_ENV === 'production' ? '/tmp/sessions' : './sessions',
        ttl: 86400,
        reapInterval: 3600,
        logFn: function(){}, // Disable verbose session logs
        retries: 0 // Disable retries
    }),
    secret: SESSION_SECRET,
    resave: true, // Changed to true
    saveUninitialized: true, // Changed to true
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24,
        sameSite: 'lax'
    }
}));

// Add session error handler
app.use((req, res, next) => {
    if (!req.session) {
        console.error('Session error occurred');
        return res.status(500).send('Session error');
    }
    next();
});

// Update CORS headers for Railway
app.use((req, res, next) => {
    if (process.env.RAILWAY_STATIC_URL) {
        const allowedOrigin = process.env.RAILWAY_STATIC_URL.startsWith('http') 
            ? process.env.RAILWAY_STATIC_URL 
            : `https://${process.env.RAILWAY_STATIC_URL}`;
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    next();
});

// Rute untuk menangani permintaan GET ke root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'signin.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'signup.html'));
});

// Helper function to read users from the file
const readUsers = () => {
    const usersFile = process.env.NODE_ENV === 'production' 
        ? path.join(process.env.PERSISTENT_STORAGE, 'users.json')
        : './users.json';
        
    try {
        if (!fs.existsSync(usersFile)) {
            const defaultUsers = [{
                username: "admin",
                name: "Administrator",
                nim: "admin123",
                email: "admin@example.com",
                password: "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LudZ4OceRKGy3RqOy",
                photo: "default-avatar.png"
            }];
            writeUsers(defaultUsers);
            return defaultUsers;
        }
        const data = fs.readFileSync(usersFile);
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading users:', error);
        return [];
    }
};

// Helper function to write users to the file
const writeUsers = (users) => {
    const usersFile = process.env.NODE_ENV === 'production' 
        ? path.join(process.env.PERSISTENT_STORAGE, 'users.json')
        : './users.json';
    
    try {
        const dirPath = path.dirname(usersFile);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('Error writing users:', error);
    }
};

// Signup route
app.post('/signup', async (req, res) => {
    const { username, name, nim, email, password } = req.body;
    const users = readUsers();

    if (users.find(user => user.username === username || user.email === email)) {
        return res.status(400).json({ message: 'Username or email already exists' });
    }

    if (users.find(user => user.nim === nim)) {
        return res.status(400).json({ message: 'NIM already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    users.push({
        username,
        name,
        nim,
        email,
        password: hashedPassword,
        photo: 'default-avatar.png'
    });
    writeUsers(users);
    res.status(201).json({ message: 'User registered successfully' });
});

// Signin route
app.post('/signin', async (req, res) => {
    const { identifier, password } = req.body;
    
    if (!identifier || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    const users = readUsers();
    const user = users.find(user => 
        user.email === identifier || 
        user.username === identifier || 
        user.nim === identifier
    );

    if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    try {
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        req.session.user = {
            username: user.username,
            name: user.name,
            email: user.email,
            nim: user.nim,
            photo: user.photo
        };

        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ message: 'Error creating session' });
            }
            res.status(200).json({ 
                message: 'Sign-in successful',
                redirectUrl: '/profile'
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Update profile route with better security
app.get('/profile', (req, res) => {
    console.log('Session ID:', req.session.id);
    console.log('Session Data:', req.session);
    if (!req.session.user) {
        console.log('No session user found, redirecting to signin');
        return res.redirect('/');
    }
    console.log('User authenticated, serving profile page');
    res.sendFile(path.join(__dirname, 'profile.html'));
});

app.get('/profile-data', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Not authenticated' });
    }
    res.json(req.session.user);
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Add this after other routes
app.post('/update-photo', upload.single('photo'), (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const users = readUsers();
    const userIndex = users.findIndex(user => user.username === req.session.user.username);

    if (userIndex !== -1) {
        // Delete old photo if exists
        if (users[userIndex].photo) {
            const oldPhotoPath = path.join(__dirname, 'uploads', users[userIndex].photo);
            if (fs.existsSync(oldPhotoPath)) {
                fs.unlinkSync(oldPhotoPath);
            }
        }

        // Update photo in users.json and session
        users[userIndex].photo = req.file.filename;
        req.session.user.photo = req.file.filename;
        writeUsers(users);
        res.json({ photo: req.file.filename });
    } else {
        res.status(404).json({ message: 'User not found' });
    }
});

// Add reset password endpoint
app.post('/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;
    const users = readUsers();
    
    const userIndex = users.findIndex(user => user.email === email);
    if (userIndex === -1) {
        return res.status(404).json({ message: 'User not found' });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
        users[userIndex].password = hashedPassword;
        writeUsers(users);
        res.status(200).json({ message: 'Password reset successful' });
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Add startup initialization before app.listen
const initializeApp = () => {
    // Create necessary directories
    const dirs = process.env.NODE_ENV === 'production' 
        ? [
            process.env.PERSISTENT_STORAGE,
            process.env.UPLOAD_DIR,
            '/tmp/sessions'
          ]
        : [
            './uploads',
            './sessions',
            './tmp'
          ];
    
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created directory: ${dir}`);
        }
    });
    
    // Initialize users.json
    const users = readUsers();
    if (users.length === 0) {
        const defaultAdmin = {
            username: "admin",
            name: "Administrator",
            nim: "admin123",
            email: "admin@example.com",
            password: "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LudZ4OceRKGy3RqOy", // admin123
            photo: "default-avatar.png"
        };
        writeUsers([defaultAdmin]);
        console.log('Created default admin user');
    }
};

// Update server startup
app.listen(PORT, () => {
    initializeApp();
    console.log(`Server is running at http://localhost:${PORT}`);
});
