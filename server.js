require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const path = require('path');
const multer = require('multer');
const session = require('express-session');
const app = express();

// Update these values to use environment variables
const PORT = process.env.PORT || 3000;
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
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

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        httpOnly: true, // Prevents client side JS from reading the cookie 
        maxAge: 1000 * 60 * 60 * 24 // Session max age in milliseconds (1 day)
    }
}));

// Add this before app.listen
app.use((req, res, next) => {
  if (process.env.RAILWAY_STATIC_URL) {
    res.setHeader('Access-Control-Allow-Origin', process.env.RAILWAY_STATIC_URL);
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

const usersFile = './users.json';

// Helper function to read users from the file
const readUsers = () => {
    if (!fs.existsSync(usersFile)) {
        return [];
    }
    const data = fs.readFileSync(usersFile);
    return JSON.parse(data);
};

// Helper function to write users to the file
const writeUsers = (users) => {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
};

// Update signup route to handle without file upload
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
        photo: 'default-avatar.png'  // You can add a default avatar image
    });
    writeUsers(users);

    res.status(201).json({ message: 'User registered successfully' });
});

// Sign-in route
app.post('/signin', async (req, res) => {
    const { identifier, password } = req.body;
    
    if (!identifier || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    const users = readUsers();
    console.log('Attempting sign in for:', identifier);

    const user = users.find(user => 
        user.email === identifier || 
        user.username === identifier || 
        user.nim === identifier
    );

    if (!user) {
        console.log('User not found');
        return res.status(400).json({ message: 'Invalid credentials' });
    }

    try {
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            console.log('Invalid password');
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        req.session.user = user;
        console.log('Sign in successful for:', user.username);
        res.status(200).json({ message: 'Sign-in successful' });
    } catch (error) {
        console.error('Error during sign in:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/profile', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
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

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
