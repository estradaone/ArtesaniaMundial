const express = require('express');
const router = express.Router();
const UserController = require('../controllers/controllerUser');
const UserModel = require('../models/modelUser');
const { upload } = require('../controllers/controllerUser');
const controladorPaypal = require('../controllers/controladorPaypal');

// Registro y login
router.post('/registrar', UserController.registrarUsuario);
router.get('/usuariosExistentes', UserController.listarUsuariosActivos);

router.get('/loggin', UserController.showLogginPage);
router.post('/loggin', UserController.authenticateUser);
router.get('/registro', (req, res) => res.render('registro.ejs'));
router.get('/logout', UserController.logout);

// Tienda
router.get('/tienda', UserController.mostrarTiendaUsuario);
router.get('/admin/tienda', UserController.mostrarTiendaAdministrador);
router.get('/usuarios/tienda', UserController.mostrarTiendaUsuario);

// Categorías
router.get('/admin/categorias/accesorios', UserController.getAccesorios);
router.get('/usuarios/categorias/accesorios', UserController.getAccesorios);
router.get('/admin/categorias/bolsos', UserController.getBolsos);
router.get('/usuarios/categorias/bolsos', UserController.getBolsos);
router.get('/admin/categorias/sombreros', UserController.getSombreros);
router.get('/usuarios/categorias/sombreros', UserController.getSombreros);
router.get('/admin/categorias/blusas', UserController.getBlusas);
router.get('/usuarios/categorias/blusas', UserController.getBlusas);
router.get('/admin/categorias/peluches', UserController.getPeluches);
router.get('/usuarios/categorias/peluches', UserController.getPeluches);
router.get('/admin/categorias/llaveros', UserController.getLlaveros);
router.get('/usuarios/categorias/llaveros', UserController.getLlaveros);

// Recuperación de contraseña
router.get('/forgot-password', (req, res) => res.render('forgot-password'));
router.post('/forgot-password', UserController.sendResetToken);
router.get('/reset-password/:token', (req, res) => res.render('reset-password', { token: req.params.token }));
router.post('/reset-password', UserController.resetPassword);

// CRUD Productos (ADMIN)
router.get('/admin/productos/agregar', UserController.mostrarFormularioAgregar);
router.post('/admin/productos/agregar', upload.array('imagenes', 5), UserController.agregarProducto);
router.get('/admin/productos/editar/:id_producto', UserController.obtenerProductos);
router.post('/admin/productos/editar/:id_producto', upload.array('imagenes', 5), UserController.actualizarProductos);
router.get('/admin/productos/eliminar/:id_producto', UserController.eliminarProducto);

// CRUD Usuarios (ADMIN)
router.get('/admin/usuarios', UserController.listarUsuarios);
router.get('/admin/usuarios/agregar', UserController.mostrarFormularioAgregarUsuario);
router.post('/admin/usuarios/agregar', UserController.agregarUsuario);
router.get('/admin/usuarios/editar/:id_usuario', UserController.obtenerUsuarioParaEditar);
router.post('/admin/usuarios/editar/:id_usuario', UserController.actualizarUsuario);
router.get('/admin/usuarios/suspendidos', UserController.listarUsuariosSuspendidos);
router.post('/admin/usuarios/suspender/:id_usuario', UserController.suspenderUsuario);
router.post('/admin/usuarios/activar/:id_usuario', UserController.activarUsuario);
router.post('/admin/usuarios/eliminar/:id_usuario', UserController.eliminarUsuario);

// Perfil
router.get('/perfil', UserController.verPerfilUsuario);
router.post('/actualizar-perfil', UserController.actualizarPerfilUsuario);
router.get('/admin/perfil', UserController.verPerfilAdmin);
router.post('/admin/actualizar-perfil', UserController.actualizarPerfilAdmin);

// Historial ventas
router.get('/admin/historialVentas', UserController.verHistorialVentas);
router.get('/admin/historialVentas/pdf', UserController.generarPDFVentas);

// Pedidos y seguimiento
router.get('/pedidos', UserController.mostrarPedidos);
router.get('/seguimiento', UserController.mostrarSeguimiento);
router.get('/producto/:id_producto', UserController.verDetalleProducto);
router.get('/ver-compra/:id', UserController.verCompra);
router.get('/reordenar/:id_pedido', UserController.reordenarPedido);
router.get('/admin/editarPedido/:id', UserController.formEditarPedido);
router.post('/admin/editarPedido/:id', UserController.actualizarPedido);
router.post('/cancelar-pedido/:id', UserController.cancelarPedido);
router.get('/reembolso/:id', UserController.verReembolso);

// Carrito
router.get('/carrito', (req, res) => res.render('carrito', { carrito: req.session.carrito || [] }));
router.get('/pagar', (req, res) => res.render('pagar', { carrito: req.session.carrito || [] }));
router.get('/confirmacion', (req, res) => res.render('confirmacion'));

router.post('/api/carrito/agregar', (req, res) => {
    const { idProducto, nombre, precio, imagen_url } = req.body;
    if (!idProducto || !nombre || !precio || !imagen_url) {
        return res.status(400).json({ success: false, message: "Datos faltantes en la solicitud." });
    }
    req.session.carrito = req.session.carrito || [];
    const productoExistente = req.session.carrito.find(p => p.id_producto === idProducto);
    if (productoExistente) {
        productoExistente.cantidad += 1;
    } else {
        req.session.carrito.push({ id_producto: idProducto, nombre_producto: nombre, precio, imagen_url, cantidad: 1 });
    }
    res.json({ success: true });
});

router.post('/api/carrito/eliminar', (req, res) => {
    const { idProducto } = req.body;
    req.session.carrito = (req.session.carrito || []).filter(p => p.id_producto !== idProducto);
    res.json({ success: true });
});

router.get('/api/carrito/count', (req, res) => {
    const total = req.session.carrito ? req.session.carrito.reduce((acc, p) => acc + p.cantidad, 0) : 0;
    res.json({ count: total });
});

// Finalizar compra
router.post('/api/finalizar-compra', async (req, res) => {
    const carrito = req.session.carrito || [];
    const usuario = req.session.user;
    if (!usuario || carrito.length === 0) {
        return res.status(400).json({ success: false, message: "Sesión inválida o carrito vacío." });
    }
    try {
        await UserModel.finalizarCompra(usuario.id_usuario, carrito);
        req.session.carrito = [];
        res.json({ success: true });
    } catch (error) {
        console.error("Error al finalizar compra:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

// API producto
router.get('/api/producto/:id_producto', async (req, res) => {
    try {
        const producto = await UserModel.obtenerProductosPorId(req.params.id_producto);
        if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json(producto);
    } catch (error) {
        console.error('Error al obtener el producto:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Búsquedas
router.get('/buscarUsuarios', UserController.buscarUsuarios);
router.get('/buscar-usuarios', UserController.buscarUsuariosTiempoReal);
router.get('/buscar-productos', UserController.buscarProductos);
router.get('/buscar-productos-tiempo-real', UserController.buscarProductosTiempoReal);

// Direcciones
router.get('/nueva-direccion', UserController.mostrarFormularioNuevaDireccion);
router.post('/nueva-direccion', UserController.guardarNuevaDireccion);
router.get('/direcciones', UserController.mostrarTodasLasDirecciones);
router.get('/editar-direccion/:id', UserController.mostrarFormularioEditarDireccion);
router.post('/editar-direccion/:id', UserController.actualizarDireccion);

// Mensajes
router.post('/enviar-mensaje', UserController.enviarMensaje);

// Testing
router.get('/', UserController.listarUsuariosTesteo);

// PayPal
router.post('/api/pago-tarjeta', controladorPaypal.pagoTarjeta);

module.exports = router;
