// controllerUser.js
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();
const UserModel = require('../models/modelUser');
const bcrypt = require('bcrypt');
const multer = require('multer');
const pool = require('../database/db');
const pdf = require('html-pdf');
const ejs = require('ejs');

// Configuración para subir imágenes
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: (req, file, cb) => {
        // Evita colisiones de nombres usando timestamp + random
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage });

const UserController = {
    // Registrar usuario
    async registrarUsuario(req, res) {
        const { nombre, apellidos, email, password } = req.body;
        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            await UserModel.registrarUsuario({
                nombre,
                apellidos,
                email: email.toLowerCase(),
                password: hashedPassword
            });

            req.session.user = {
                nombre,
                apellidos,
                email: email.toLowerCase(),
                rol: 'usuario'
            };
            res.redirect('/');
        } catch (error) {
            console.error('Error al registrar el usuario:', error);
            res.status(500).send('Error al registrar el usuario.');
        }
    },

    // Autenticación
    async authenticateUser(req, res) {
        const { email, password } = req.body;
        try {
            const user = await UserModel.authenticateUser(email.toLowerCase(), password);
            if (user) {
                if (user.estado === 'suspendido') {
                    return res.render('loggin', { error: 'Tu cuenta está suspendida' });
                }
                req.session.user = user;
                res.redirect('/');
            } else {
                res.render('loggin', { error: 'Datos incorrectos, intente de nuevo' });
            }
        } catch (error) {
            console.error('Error durante la autenticación del usuario:', error);
            res.status(500).send('Error durante la autenticación del usuario');
        }
    },

    showLogginPage(req, res) {
        res.render('loggin', { error: null });
    },

    logout(req, res) {
        req.session.destroy(err => {
            if (err) return res.status(500).send('Error al cerrar la sesión');
            res.redirect('/');
        });
    },

    // Categorías
    async getAccesorios(req, res) {
        try {
            const productos = await UserModel.getProductsByCategory('Accesorios');
            if (req.session.user?.rol === 'administrador') {
                res.render('admin/categorias/accesorios', { productos });
            } else {
                res.render('usuarios/categorias/accesorios', { productos });
            }
        } catch (error) {
            console.error('Error al obtener los productos de accesorios:', error);
            res.status(500).send('Error al obtener los productos de accesorios');
        }
    },

    async getBolsos(req, res) {
        try {
            const productos = await UserModel.getProductsByCategory('Bolsos');
            if (req.session.user?.rol === 'administrador') {
                res.render('admin/categorias/bolsos', { productos });
            } else {
                res.render('usuarios/categorias/bolsos', { productos });
            }
        } catch (error) {
            console.error('Error al obtener los productos de bolsos:', error);
            res.status(500).send('Error al obtener los productos de bolsos');
        }
    },

    async getSombreros(req, res) {
        try {
            const productos = await UserModel.getProductsByCategory('Sombreros');
            if (req.session.user?.rol === 'administrador') {
                res.render('admin/categorias/sombreros', { productos });
            } else {
                res.render('usuarios/categorias/sombreros', { productos });
            }
        } catch (error) {
            console.error('Error al obtener los productos de sombreros:', error);
            res.status(500).send('Error al obtener los productos de sombreros');
        }
    },

    async getBlusas(req, res) {
        try {
            const productos = await UserModel.getProductsByCategory('Blusas');
            if (req.session.user?.rol === 'administrador') {
                res.render('admin/categorias/blusas', { productos });
            } else {
                res.render('usuarios/categorias/blusas', { productos });
            }
        } catch (error) {
            console.error('Error al obtener los productos de blusas:', error);
            res.status(500).send('Error al obtener los productos de blusas');
        }
    },

    async getPeluches(req, res) {
        try {
            const productos = await UserModel.getProductsByCategory('Peluches');
            if (req.session.user?.rol === 'administrador') {
                res.render('admin/categorias/peluches', { productos });
            } else {
                res.render('usuarios/categorias/peluches', { productos });
            }
        } catch (error) {
            console.error('Error al obtener los productos de peluches:', error);
            res.status(500).send('Error al obtener los productos de peluches');
        }
    },

    async getLlaveros(req, res) {
        try {
            const productos = await UserModel.getProductsByCategory('Llaveros');
            if (req.session.user?.rol === 'administrador') {
                res.render('admin/categorias/llaveros', { productos });
            } else {
                res.render('usuarios/categorias/llaveros', { productos });
            }
        } catch (error) {
            console.error('Error al obtener los productos de llaveros:', error);
            res.status(500).send('Error al obtener los productos de llaveros');
        }
    },

    // Restablecer contraseña
    async sendResetToken(req, res) {
        const { email } = req.body;
        try {
            const user = await UserModel.authenticateUser(email.toLowerCase());
            if (!user) return res.render('forgot-password', { message: 'Usuario no encontrado' });

            const token = crypto.randomBytes(32).toString('hex');
            const expiration = new Date(Date.now() + 3600000); // 1 hora
            await UserModel.setResetToken(email.toLowerCase(), token, expiration);

            const transporter = nodemailer.createTransport({
                host: 'smtp.ionos.com',
                port: 587,
                secure: false,
                auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
            });

            const resetLink = `${process.env.BASE_URL}/usuarios/reset-password/${token}`;
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Restablece tu contraseña',
                html: `<p>Haz clic en el siguiente enlace para restablecer tu contraseña:</p><a href="${resetLink}">${resetLink}</a>`
            });

            res.render('forgot-password', { message: 'Correo enviado con éxito' });
        } catch (error) {
            console.error('Error al enviar el correo:', error);
            res.render('forgot-password', { message: 'Error al enviar el correo' });
        }
    },
    // Resetear contraseña
    async resetPassword(req, res) {
        const { token, newPassword } = req.body;
        try {
            const user = await UserModel.verifyResetToken(token);
            if (!user) {
                return res.render('reset-password', { token: null, message: 'Token inválido o expirado' });
            }

            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await UserModel.updatePassword(user.id_usuario, hashedPassword);

            req.session.user = {
                id: user.id_usuario,
                nombre: user.nombre,
                rol: user.rol,
                email: user.email
            };

            let redirectUrl = '/';
            if (user.rol === 'administrador') {
                redirectUrl = '/admin/bienvenida';
            } else if (user.rol === 'vendedor') {
                redirectUrl = '/vendedor/bienvenida';
            }

            res.redirect(redirectUrl);
        } catch (error) {
            console.error('Error al actualizar la contraseña e iniciar sesión:', error);
            res.status(500).send('Error al actualizar la contraseña');
        }
    },

    // Mostrar formulario para agregar productos
    async mostrarFormularioAgregar(req, res) {
        try {
            const categorias = await UserModel.obtenerCategorias();
            res.render('admin/agregar-producto', { categorias });
        } catch (error) {
            console.error('Error al mostrar el formulario', error);
            res.status(500).send('Error al cargar el formulario');
        }
    },

    // Agregar productos
    async agregarProducto(req, res) {
        try {
            const { nombre_producto, descripcion, precio, cantidad, id_categoria, vendedor } = req.body;

            const primeraImagen = req.files?.[0];
            const imagen_url = primeraImagen ? `/uploads/${Date.now()}-${primeraImagen.originalname}` : null;

            const result = await UserModel.agregarProducto({
                nombre_producto,
                descripcion,
                precio,
                cantidad,
                imagen_url,
                id_categoria,
                vendedor
            });

            const id_producto = result.insertId;

            if (req.files && req.files.length > 0) {
                let orden = 1;
                for (const file of req.files) {
                    const uniqueName = `${Date.now()}-${file.originalname}`;
                    const url_imagen = `/uploads/${uniqueName}`;
                    await UserModel.agregarImagenProducto({ id_producto, url_imagen, orden });
                    orden++;
                }
            }

            res.redirect(`/usuarios/admin/categorias/${id_categoria}`);
        } catch (error) {
            console.error('Error al agregar el producto', error);
            res.status(500).send('Error al agregar el producto');
        }
    },

    // Listar productos según categorías
    async listarProductos(req, res) {
        try {
            const { categoria } = req.params;
            const productos = await UserModel.getProductsByCategory(categoria);
            res.render(`admin/categorias/${categoria}`, { productos, categoria });
        } catch (error) {
            console.error('Error al obtener los productos:', error);
            res.status(500).send('Error al obtener los productos');
        }
    },

    // Obtener producto por ID
    async obtenerProductos(req, res) {
        try {
            const { id_producto } = req.params;
            const producto = await UserModel.obtenerProductosPorId(id_producto);
            const categorias = await UserModel.obtenerCategorias();
            const imagenes = await UserModel.obtenerImagenesPorProducto(id_producto);
            res.render('admin/editar-producto', { producto, categorias, imagenes });
        } catch (error) {
            console.error('Error al obtener el producto:', error);
            res.status(500).send('Error al obtener el producto');
        }
    },

    // Actualizar productos
    async actualizarProductos(req, res) {
        try {
            const { id_producto } = req.params;
            const { nombre_producto, descripcion, precio, cantidad, id_categoria, vendedor } = req.body;

            await UserModel.actualizarProducto(id_producto, {
                nombre_producto,
                descripcion,
                precio,
                cantidad,
                id_categoria,
                vendedor
            });

            if (req.files && req.files.length > 0) {
                await UserModel.eliminarImagenesProducto(id_producto);
                let orden = 1;
                for (const file of req.files) {
                    const uniqueName = `${Date.now()}-${file.originalname}`;
                    const url_imagen = `/uploads/${uniqueName}`;
                    await UserModel.agregarImagenProducto({ id_producto, url_imagen, orden });
                    orden++;
                }
                await UserModel.actualizarImagenPrincipalProducto(id_producto, `/uploads/${req.files[0].originalname}`);
            }

            res.redirect(`/usuarios/admin/categorias/${id_categoria}`);
        } catch (error) {
            console.error('Error al actualizar el producto', error);
            res.status(500).send('Error al actualizar el producto');
        }
    },

    // Eliminar productos
    async eliminarProducto(req, res) {
        try {
            const { id_producto } = req.params;
            await UserModel.eliminarImagenesProducto(id_producto);
            await UserModel.eliminarProducto(id_producto);
            res.redirect('/usuarios/admin/categorias/accesorios');
        } catch (error) {
            console.error('Error al eliminar el producto', error);
            res.status(500).send('Error al eliminar el producto');
        }
    },

    // Listar usuarios
    async listarUsuarios(req, res) {
        try {
            const usuarios = await UserModel.obtenerUsuarios();
            res.render('admin/usuarios', { usuarios });
        } catch (error) {
            console.error('Error al listar los usuarios', error);
            res.status(500).send('Error al listar los usuarios');
        }
    },

    // Mostrar formulario para agregar usuarios
    async mostrarFormularioAgregarUsuario(req, res) {
        res.render('admin/agregar-usuario');
    },

    // Agregar usuario
    async agregarUsuario(req, res) {
        const { nombre, apellidos, email, password } = req.body;
        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            await UserModel.agregarUsuario({ nombre, apellidos, email: email.toLowerCase(), password: hashedPassword });
            res.redirect('/usuarios/usuariosExistentes');
        } catch (error) {
            console.error('Error al agregar el usuario', error);
            res.status(500).send('Error al agregar el usuario');
        }
    },

    // Obtener usuario para editar
    async obtenerUsuarioParaEditar(req, res) {
        const { id_usuario } = req.params;
        try {
            const usuario = await UserModel.obtenerUsuarioPorId(id_usuario);
            res.render('admin/editar-usuario', { usuario });
        } catch (error) {
            console.error('Error al obtener el usuario', error);
            res.status(500).send('Error al obtener el usuario');
        }
    },

    // Actualizar usuario
    async actualizarUsuario(req, res) {
        const { id_usuario } = req.params;
        const { nombre, apellidos, email } = req.body;
        try {
            await UserModel.actualizarUsuarios(id_usuario, { nombre, apellidos, email: email.toLowerCase() });
            res.redirect('/usuarios/usuariosExistentes');
        } catch (error) {
            console.error('Error al actualizar el usuario:', error);
            res.status(500).send('Error al actualizar el usuario');
        }
    },
    // Listar usuarios activos
    async listarUsuariosActivos(req, res) {
        try {
            const usuarios = await UserModel.obtenerUsuariosPorEstado('activo');
            res.render('usuariosExistentes', { usuarios });
        } catch (error) {
            console.error('Error al listar los usuarios activos:', error);
            res.status(500).send('Error al listar los usuarios activos');
        }
    },

    // Listar todos los usuarios
    async listarTodosLosUsuarios(req, res) {
        try {
            const usuarios = await UserModel.obtenerTodosLosUsuarios();
            res.render('usuariosExistentes', { usuarios });
        } catch (error) {
            console.error('Error al listar todos los usuarios:', error);
            res.status(500).send('Error al listar todos los usuarios');
        }
    },

    // Búsqueda tradicional de usuarios
    async buscarUsuarios(req, res) {
        const searchTerm = (req.query.search || '').trim().toLowerCase();
        try {
            const usuarios = await UserModel.buscarUsuarios(searchTerm);
            res.render('usuariosExistentes', { usuarios });
        } catch (error) {
            console.error('Error al buscar usuarios:', error);
            res.status(500).send('Error al buscar usuarios');
        }
    },

    // Búsqueda en tiempo real (AJAX)
    async buscarUsuariosTiempoReal(req, res) {
        const searchTerm = (req.query.search || '').trim().toLowerCase();
        try {
            const usuarios = await UserModel.buscarUsuarios(searchTerm);
            res.json(usuarios);
        } catch (error) {
            console.error('Error en búsqueda AJAX:', error);
            res.status(500).json([]);
        }
    },

    // Búsqueda tradicional de productos
    async buscarProductos(req, res) {
        const searchTerm = (req.query.search || '').trim().toLowerCase();
        try {
            const productos = await UserModel.buscarProductos(searchTerm);
            res.render('usuarios/tienda', { productos });
        } catch (error) {
            console.error('Error al buscar productos:', error);
            res.status(500).send('Error al buscar productos');
        }
    },

    // Búsqueda en tiempo real de productos
    async buscarProductosTiempoReal(req, res) {
        const searchTerm = (req.query.search || '').trim().toLowerCase();
        try {
            const productos = await UserModel.buscarProductos(searchTerm);
            res.json(productos);
        } catch (error) {
            console.error('Error en búsqueda AJAX de productos:', error);
            res.status(500).json([]);
        }
    },

    // Listar usuarios suspendidos
    async listarUsuariosSuspendidos(req, res) {
        try {
            const usuariosSuspendidos = await UserModel.obtenerUsuariosPorEstado('suspendido');
            res.render('admin/usuarios-suspendidos', { usuariosSuspendidos });
        } catch (error) {
            console.error('Error al listar los usuarios suspendidos:', error);
            res.status(500).send('Error al listar los usuarios suspendidos');
        }
    },

    // Suspender usuario
    async suspenderUsuario(req, res) {
        const { id_usuario } = req.params;
        try {
            await UserModel.cambiarEstadoUsuario(id_usuario, 'suspendido');
            res.redirect('/usuarios/usuariosExistentes');
        } catch (error) {
            console.error('Error al suspender el usuario', error);
            res.status(500).send('Error al suspender el usuario');
        }
    },

    // Activar usuario
    async activarUsuario(req, res) {
        const { id_usuario } = req.params;
        try {
            await UserModel.cambiarEstadoUsuario(id_usuario, 'activo');
            res.redirect('/usuarios/usuariosExistentes');
        } catch (error) {
            console.error('Error al activar el usuario', error);
            res.status(500).send('Error al activar el usuario');
        }
    },

    // Eliminar usuario
    async eliminarUsuario(req, res) {
        try {
            const { id_usuario } = req.params;
            await UserModel.eliminarUsuario(id_usuario);
            res.redirect('/usuarios/admin/usuarios/suspendidos');
        } catch (error) {
            console.error('Error al eliminar el usuario', error);
            res.status(500).send('Error al eliminar el usuario');
        }
    },

    // Tienda – página de bienvenida
    async mostrarTiendaBienvenida(req, res) {
        try {
            const productos = await UserModel.obtenerProductosConCategoria();
            res.render('bienvenida', { productos });
        } catch (error) {
            console.error('Error al obtener los productos', error);
            res.status(500).send('Error al cargar los productos');
        }
    },

    // Tienda – usuario
    async mostrarTiendaUsuario(req, res) {
        try {
            const productos = await UserModel.obtenerProductos();
            res.render('usuarios/tienda', { productos });
        } catch (error) {
            console.error('Error al obtener productos:', error);
            res.status(500).send('Error al cargar la tienda');
        }
    },

    // Tienda – administrador
    async mostrarTiendaAdministrador(req, res) {
        try {
            if (!req.session.user || req.session.user.rol !== 'administrador') {
                return res.redirect('/usuarios/tienda');
            }
            const productos = await UserModel.obtenerProductos();
            res.render('admin/tienda', { productos });
        } catch (error) {
            console.error('Error al obtener productos:', error);
            res.status(500).send('Error al cargar la tienda de administrador');
        }
    },

    // Mostrar pedidos del usuario
    async mostrarPedidos(req, res) {
        const usuario = req.session.user;
        if (!usuario) return res.redirect('/usuarios/loggin');
        try {
            const pedidos = await UserModel.obtenerPedidosPorUsuario(usuario.id_usuario);
            res.render('pedidos', { pedidos });
        } catch (error) {
            console.error("Error al obtener pedidos:", error);
            res.status(500).send("Error interno");
        }
    },

    // Mostrar seguimiento del usuario
    async mostrarSeguimiento(req, res) {
        const usuario = req.session.user;
        if (!usuario) return res.redirect('/usuarios/loggin');
        try {
            const seguimiento = await UserModel.obtenerSeguimientoPorUsuario(usuario.id_usuario);
            res.render('seguimiento', { seguimiento });
        } catch (error) {
            console.error("Error al obtener seguimiento:", error);
            res.status(500).send("Error interno");
        }
    },

    // Ver detalle de producto
    async verDetalleProducto(req, res) {
        const id_producto = req.params.id_producto;
        try {
            const producto = await UserModel.obtenerProductosPorId(id_producto);
            if (!producto) return res.status(404).send('Producto no encontrado');

            const imagenes = await UserModel.obtenerImagenesPorProducto(id_producto);
            const destacados = await UserModel.obtenerProductosDestacados();
            const relacionados = await UserModel.obtenerProductosRelacionados(producto.id_categoria, id_producto);

            res.render('usuarios/detalleProducto', { producto, imagenes, destacados, relacionados });
        } catch (error) {
            console.error('Error al cargar detalle del producto:', error);
            res.status(500).send('Error interno');
        }
    },

    // Mostrar formulario nueva dirección
    async mostrarFormularioNuevaDireccion(req, res) {
        const id_usuario = req.session.user?.id_usuario;
        if (!id_usuario) return res.redirect('/usuarios/loggin');
        res.render('usuarios/nuevaDireccion', { direccion: null });
    },

    // Guardar nueva dirección
    async guardarNuevaDireccion(req, res) {
        const id_usuario = req.session.user?.id_usuario;
        if (!id_usuario) return res.redirect('/usuarios/loggin');
        const { telefono, direccion, ciudad, municipio, estado2, codigo_postal } = req.body;
        await UserModel.agregarDireccion(id_usuario, { telefono, direccion, ciudad, municipio, estado2, codigo_postal });
        res.redirect('/usuarios/direcciones');
    },

    // Mostrar todas las direcciones
    async mostrarTodasLasDirecciones(req, res) {
        const id_usuario = req.session.user?.id_usuario;
        if (!id_usuario) return res.redirect('/usuarios/loggin');
        const direcciones = await UserModel.obtenerDirecciones(id_usuario);
        res.render('usuarios/direcciones', { direcciones });
    },

    // Mostrar formulario editar dirección
    async mostrarFormularioEditarDireccion(req, res) {
        const id_direccion = req.params.id;
        const direccion = await UserModel.obtenerDireccionPorId(id_direccion);
        res.render('usuarios/editarDireccion', { direccion });
    },

    // Actualizar dirección
    async actualizarDireccion(req, res) {
        const id_direccion = req.params.id;
        const { telefono, direccion, ciudad, municipio, estado2, codigo_postal } = req.body;
        await UserModel.actualizarDireccionPorId(id_direccion, { telefono, direccion, ciudad, municipio, estado2, codigo_postal });
        res.redirect('/usuarios/direcciones');
    },

    // Ver compra
    async verCompra(req, res) {
        const id_pedido = req.params.id;
        try {
            const { pedido, productos } = await UserModel.obtenerResumenCompra(id_pedido);
            if (!pedido) return res.status(404).send('Pedido no encontrado');
            res.render('usuarios/verCompra', { pedido, productos });
        } catch (error) {
            console.error('Error al mostrar compra:', error);
            res.status(500).send('Error al cargar la compra');
        }
    },
    // Reordenar pedido
    async reordenarPedido(req, res) {
        const idPedido = req.params.id_pedido;
        try {
            const producto = await UserModel.obtenerPedidos(idPedido);
            if (!producto || !producto.id_producto) {
                return res.redirect('/usuarios/tienda');
            }
            res.redirect(`/usuarios/producto/${producto.id_producto}`);
        } catch (error) {
            console.error('Error al reordenar:', error);
            res.redirect('/usuarios/tienda');
        }
    },

    // Enviar mensaje de contacto
    async enviarMensaje(req, res) {
        const { nombre, email, asunto, mensaje } = req.body;
        try {
            const transporter = nodemailer.createTransport({
                host: 'smtp.ionos.com',
                port: 587,
                secure: false,
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            const mailOptions = {
                from: `"${nombre}" <${email}>`,
                to: process.env.EMAIL_USER,
                subject: `Contacto: ${asunto}`,
                text: mensaje,
                html: `
                <h3>Nuevo mensaje de contacto</h3>
                <p><strong>Nombre:</strong> ${nombre}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Asunto:</strong> ${asunto}</p>
                <p><strong>Mensaje:</strong><br>${mensaje}</p>
            `
            };

            await transporter.sendMail(mailOptions);
            res.redirect('/ayuda?enviado=true');
        } catch (error) {
            console.error('Error al enviar el correo:', error);
            res.redirect('/ayuda?error=true');
        }
    },

    // Perfil de usuario
    async verPerfilUsuario(req, res) {
        const id_usuario = req.session.user?.id_usuario;
        try {
            const [result] = await pool.query('SELECT * FROM usuarios WHERE id_usuario = ?', [id_usuario]);
            res.render('usuarios/perfil', { usuario: result[0] });
        } catch (error) {
            console.error('Error al cargar perfil:', error);
            res.status(500).send('Error al cargar perfil');
        }
    },

    async actualizarPerfilUsuario(req, res) {
        const { nombre, apellidos, email } = req.body;
        const idUsuario = req.session.user.id_usuario;
        try {
            await UserModel.actualizarUsuarios(idUsuario, { nombre, apellidos, email: email.toLowerCase() });
            res.redirect('/usuarios/perfil');
        } catch (error) {
            console.error('Error al actualizar perfil del usuario:', error);
            res.status(500).send('Error al actualizar perfil');
        }
    },

    // Perfil de administrador
    async verPerfilAdmin(req, res) {
        const id_admin = req.session.user?.id_usuario;
        try {
            const [result] = await pool.query('SELECT * FROM usuarios WHERE id_usuario = ?', [id_admin]);
            res.render('admin/perfil', { admin: result[0] });
        } catch (error) {
            console.error('Error al cargar perfil del admin:', error);
            res.status(500).send('Error al cargar perfil');
        }
    },

    async actualizarPerfilAdmin(req, res) {
        const { nombre, apellidos, email } = req.body;
        const id_admin = req.session.user.id_usuario;
        try {
            await UserModel.actualizarUsuarios(id_admin, { nombre, apellidos, email: email.toLowerCase() });
            res.redirect('/admin/perfil');
        } catch (error) {
            console.error('Error al actualizar perfil del admin:', error);
            res.status(500).send('Error al actualizar perfil');
        }
    },

    // Historial de ventas
    async verHistorialVentas(req, res) {
        if (!req.session.user || req.session.user.rol !== 'administrador') {
            return res.redirect('/admin/historialVentas');
        }
        const filtro = req.query.filtro || '';
        try {
            const historial = await UserModel.obtenerHistorialVentas(filtro);
            const totalVentas = historial.reduce((acc, venta) => acc + (parseFloat(venta.subtotal) || 0), 0);
            res.render('admin/historialVentas', { historial, filtro, totalVentas: totalVentas.toFixed(2) });
        } catch (error) {
            console.error('Error al obtener historial de ventas:', error);
            res.status(500).send('Error al cargar historial de ventas');
        }
    },

    // Generar reporte PDF
    async generarPDFVentas(req, res) {
        try {
            const { filtro } = req.query;
            const ventas = await UserModel.obtenerHistorialVentas(filtro);
            const total = ventas.reduce((acc, venta) => acc + (parseFloat(venta.subtotal) || 0), 0);
            const html = await ejs.renderFile('views/admin/pdfVentas.ejs', { ventas, filtro, total: total.toFixed(2) });
            pdf.create(html).toStream((err, stream) => {
                if (err) return res.status(500).send('Error al generar PDF');
                res.setHeader('Content-Type', 'application/pdf');
                stream.pipe(res);
            });
        } catch (error) {
            console.error('Error al generar PDF:', error);
            res.status(500).send('Error interno al generar PDF');
        }
    },

    // Editar pedido
    async formEditarPedido(req, res) {
        const { id } = req.params;
        const [result] = await pool.query('SELECT * FROM pedidos WHERE id_pedido = ?', [id]);
        res.render('admin/editarPedido', { pedido: result[0] });
    },

    async actualizarPedido(req, res) {
        const { id } = req.params;
        const { estado, numero_seguimiento } = req.body;
        await pool.query('UPDATE pedidos SET estado = ?, numero_seguimiento = ? WHERE id_pedido = ?', [estado, numero_seguimiento, id]);
        res.redirect('/usuarios/admin/historialVentas');
    },

    // Cancelar pedido
    async cancelarPedido(req, res) {
        const { id } = req.params;
        try {
            const [result] = await pool.query('SELECT * FROM pedidos WHERE id_pedido = ?', [id]);
            const pedido = result[0];
            if (!pedido) return res.status(404).send('Pedido no encontrado.');
            if (['entregado', 'cancelado'].includes(pedido.estado)) return res.status(400).send('Este pedido no puede ser cancelado.');
            const fechaCancelacion = new Date();
            await pool.query('UPDATE pedidos SET estado = ?, fecha_cancelacion = ?, fecha_entrega_estimada = ? WHERE id_pedido = ?', ['cancelado', fechaCancelacion, fechaCancelacion, id]);
            res.redirect('/usuarios/pedidos');
        } catch (error) {
            console.error('Error al cancelar el pedido:', error);
            res.status(500).send('Error interno al cancelar el pedido.');
        }
    },

    // Ver reembolso
    async verReembolso(req, res) {
        const id_pedido = req.params.id;
        try {
            const { pedido, productos } = await UserModel.obtenerResumenCompra(id_pedido);
            if (!pedido || pedido.estado !== 'cancelado') return res.status(404).send('Este pedido no está cancelado o no existe.');
            res.render('usuarios/reembolso', { pedido, productos });
        } catch (error) {
            console.error('Error al cargar reembolso:', error);
            res.status(500).send('Error interno del servidor.');
        }
    },

    // Endpoint de testeo
    async listarUsuariosTesteo(req, res) {
        try {
            const [usuarios] = await pool.query('SELECT * FROM usuarios');
            res.json(usuarios);
        } catch (error) {
            console.error('Error al listar usuarios:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
};

module.exports = { ...UserController, upload };
