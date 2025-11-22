// 📦 Dependencias
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const engine = require('ejs-locals');
const methodOverride = require('method-override');
const cors = require('cors');

// 🧠 Rutas y controladores
const userRoutes = require('./routes/routes');
const categoryRoutes = require('./routes/categoryRoutes');
const rutasApis = require('./routes/api');
const UserController = require('./controllers/controllerUser');

const app = express();

// 🛡️ CORS para permitir peticiones externas (como desde tu app móvil)
app.use(cors());

// 🧠 Configuración de sesiones
app.use(session({
    secret: process.env.SESSION_SECRET || 'secretKey',
    resave: false,
    saveUninitialized: true,
}));


// 📦 Lectura de formularios y JSON
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔄 Método override
app.use(methodOverride('_method'));

// 🧠 Middleware para pasar el usuario a las vistas
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// 🖼️ Archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/img', express.static(path.join(__dirname, 'img')));
app.use(express.static(path.join(__dirname, 'public')));

// 🎨 Motor de vistas
app.engine('ejs', engine);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 🌐 Rutas web
app.get('/', UserController.mostrarTiendaBienvenida);
app.get('/nosotros', (req, res) => res.render('nosotros'));
app.get('/ayuda', (req, res) => res.render('ayuda', { req }));
app.get('/registro', (req, res) => res.render('registro'));
app.get('/compras', (req, res) => res.render('compras'));
app.get('/politicas', (req, res) => res.render('politicas'));
app.get('/terminos', (req, res) => res.render('terminos'));

// 📁 Rutas de categorías y usuarios
app.use('/admin', categoryRoutes);
app.use('/usuarios', categoryRoutes);
app.use('/usuarios', userRoutes);

// 📱 Rutas API para móvil
app.use('/api', rutasApis);

module.exports = app; // ✅ solo exporta la app
