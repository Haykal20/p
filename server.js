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
const getUploadDir = () => {
    const baseDir = process.env.NODE_ENV === 'production' 
        ? path.resolve('/tmp/data/uploads')
        : path.join(__dirname, 'uploads');
    
    if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
    }
    return baseDir;
};

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = getUploadDir();
        console.log('Upload directory:', uploadDir); // Debug log
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueName = `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

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
    saveUninitialized: false, // Changed to false
    cookie: {
        secure: false, // Changed to false for development
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

// Helper function to get user data file path
const getUsersFilePath = () => {
    if (process.env.NODE_ENV === 'production') {
        return path.join(process.env.PERSISTENT_STORAGE || '/tmp/data', 'users.json');
    }
    return path.join(__dirname, 'data', 'users.json');
};

// Helper function to read users from the file
const readUsers = () => {
    const usersFile = getUsersFilePath();
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
    const usersFile = getUsersFilePath();
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

        // Set session data
        req.session.user = {
            username: user.username,
            name: user.name,
            email: user.email,
            nim: user.nim,
            photo: user.photo
        };

        console.log('Setting session:', req.session); // Add debug log

        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ message: 'Error creating session' });
            }
            console.log('Session saved:', req.session.id); // Add debug log
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
    console.log('Accessing profile. Session:', req.session);
    console.log('Session ID:', req.session.id);
    console.log('User data:', req.session.user);
    
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
    console.log('Update photo request received');
    console.log('Session user:', req.session.user);
    
    if (!req.session.user) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    console.log('File uploaded:', req.file);

    try {
        const users = readUsers();
        const userIndex = users.findIndex(user => user.username === req.session.user.username);

        if (userIndex === -1) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Delete old photo if exists and isn't default
        if (users[userIndex].photo && users[userIndex].photo !== 'default-avatar.png') {
            const oldPhotoPath = path.join(getUploadDir(), users[userIndex].photo);
            if (fs.existsSync(oldPhotoPath)) {
                fs.unlinkSync(oldPhotoPath);
            }
        }

        // Update photo in users.json and session
        users[userIndex].photo = req.file.filename;
        req.session.user.photo = req.file.filename;
        writeUsers(users);

        console.log('Photo updated successfully');
        res.json({ 
            photo: req.file.filename,
            message: 'Photo updated successfully'
        });
    } catch (error) {
        console.error('Error updating photo:', error);
        res.status(500).json({ message: 'Error updating photo' });
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
    // Create base directories
    const baseDir = process.env.NODE_ENV === 'production' ? '/tmp/data' : path.join(__dirname, 'data');
    const dirs = [
        baseDir,
        path.join(baseDir, 'uploads'),
        path.join(baseDir, 'sessions'),
        path.join(baseDir, 'tmp')
    ];
    
    dirs.forEach(dir => {
        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`Created directory: ${dir}`);
            }
        } catch (error) {
            console.error(`Error creating directory ${dir}:`, error);
        }
    });

    // Initialize users.json
    try {
        const users = readUsers();
        if (users.length === 0) {
            const defaultAdmin = {
                username: "admin",
                name: "Administrator",
                nim: "admin123",
                email: "admin@example.com",
                password: "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LudZ4OceRKGy3RqOy",
                photo: "default-avatar.png"
            };
            writeUsers([defaultAdmin]);
            console.log('Created default admin user');
        }
    } catch (error) {
        console.error('Error initializing users:', error);
    }
};

// Update server startup with error handling
app.listen(PORT, () => {
    try {
        initializeApp();
        console.log(`Server is running at http://localhost:${PORT}`);
    } catch (error) {
        console.error('Error during initialization:', error);
    }
});

// Update static file serving configuration
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Add this new configuration for uploads directory
const uploadPath = process.env.NODE_ENV === 'production' 
    ? '/tmp/data/uploads'
    : path.join(__dirname, 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

// Update static serving for uploads
app.use('/uploads', express.static(uploadPath));

// Update photo upload handler
app.post('/update-photo', upload.single('photo'), (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    try {
        const users = readUsers();
        const userIndex = users.findIndex(user => user.username === req.session.user.username);

        if (userIndex === -1) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update photo path in users.json and session
        const photoFilename = req.file.filename;
        users[userIndex].photo = photoFilename;
        req.session.user.photo = photoFilename;
        writeUsers(users);

        // Return full URL for the photo
        const photoUrl = `/uploads/${photoFilename}`;
        console.log('Photo updated successfully:', photoUrl);
        
        res.json({ 
            photo: photoFilename,
            photoUrl: photoUrl,
            message: 'Photo updated successfully'
        });
    } catch (error) {
        console.error('Error updating photo:', error);
        res.status(500).json({ message: 'Error updating photo' });
    }
});
