
const http = require('http');
const path = require('path');
const url = require('url');
const { Pool } = require('pg');

const PORT = 8080;

// Configuración de Conexión a PostgreSQL
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'diagramador_db',
  password: 'kellyduran2210', 
  port: 5432,
});

// Inicialización automática del esquema de base de datos en PostgreSQL
async function initPgDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id VARCHAR(50) PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        nombre_completo VARCHAR(150),
        rol VARCHAR(50),
        departamento VARCHAR(100),
        avatar_url TEXT,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS departamentos (
        id VARCHAR(50) PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        descripcion TEXT,
        activo BOOLEAN DEFAULT TRUE,
        creado_por VARCHAR(100),
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS uml_diagramas (
        id VARCHAR(100) PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        diagrama_json JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS solicitudes (
        id VARCHAR(50) PRIMARY KEY,
        codigo_seguimiento VARCHAR(50),
        titulo VARCHAR(200),
        descripcion TEXT,
        prioridad VARCHAR(20),
        estado VARCHAR(50),
        departamento_actual VARCHAR(100),
        usuario_creador VARCHAR(100),
        usuario_asignado VARCHAR(100),
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        historial_json JSONB
      );
    `);

    // Insertar usuarios iniciales si la tabla está vacía
    const userCheck = await pool.query('SELECT COUNT(*) FROM usuarios');
    if (parseInt(userCheck.rows[0].count, 10) === 0) {
      await pool.query(`
        INSERT INTO usuarios (id, username, password, nombre_completo, rol, departamento) VALUES
        ('usr-1', 'admin', 'admin', 'Administrador del Sistema', 'ADMINISTRADOR', 'Sistemas'),
        ('usr-2', 'revisor', 'revisor', 'Revisor de RRHH', 'REVISOR', 'Recursos Humanos'),
        ('usr-3', 'solicitante', 'solicitante', 'Carlos Solicitante', 'SOLICITANTE', 'Ventas');
      `);
    }

    console.log('🐘 PostgreSQL: Esquema de base de datos listo en db "diagramador_db"');
  } catch (err) {
    console.error('⚠️ Error al inicializar PostgreSQL:', err.message);
  }
}

initPgDb();

// Helpers HTTP
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Usuario, X-Rol, X-Departamento'
  });
  res.end(JSON.stringify(data));
}

function wrapResponse(datos, mensaje = 'Operación exitosa', exito = true) {
  return {
    exito,
    mensaje,
    datos,
    timestamp: new Date().toISOString()
  };
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve(body);
      }
    });
  });
}

// Clientes SSE activos para colaboración en tiempo real
const sseClients = new Set();

// Memoria y persistencia de Invitaciones y Proyectos de la Organización
let enterpriseInvitations = [];
let enterpriseProjects = [
  {
    id: 'proj_salud_2026',
    name: 'Sistema de Gestión de Salud Hospitalaria',
    description: 'Modelo conceptual de datos UML 2.5 para consultas, médicos y pacientes.',
    ownerId: 'usr_carlos',
    ownerName: 'Ing. Carlos Mendoza',
    colaboradores: [
      { userId: 'usr_laura', username: 'laura', nombreCompleto: 'Dra. Laura Paredes', color: '#f97316', permission: 'EDITOR', canDownloadBackend: true },
      { userId: 'usr_pedro', username: 'pedro', nombreCompleto: 'Ing. Pedro Quispe', color: '#10b981', permission: 'VIEWER', canDownloadBackend: false },
      { userId: 'usr_sofia', username: 'sofia', nombreCompleto: 'Sofía Rojas', color: '#ec4899', permission: 'EDITOR', canDownloadBackend: true }
    ],
    totalClases: 4,
    totalRelaciones: 3,
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'proj_ecommerce_2026',
    name: 'Plataforma de Facturación y Pedidos',
    description: 'Diagrama de clases para el módulo de pagos y comprobantes fiscales.',
    ownerId: 'usr_carlos',
    ownerName: 'Ing. Carlos Mendoza',
    colaboradores: [
      { userId: 'usr_laura', username: 'laura', nombreCompleto: 'Dra. Laura Paredes', color: '#f97316', permission: 'VIEWER', canDownloadBackend: false },
      { userId: 'usr_sofia', username: 'sofia', nombreCompleto: 'Sofía Rojas', color: '#ec4899', permission: 'EDITOR', canDownloadBackend: true }
    ],
    totalClases: 5,
    totalRelaciones: 4,
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'proj_laboratorio_2026',
    name: 'Gestión de Laboratorio Clínico y Muestras',
    description: 'Modelo de entidades UML para análisis de sangre, reactivos y resultados.',
    ownerId: 'usr_laura',
    ownerName: 'Dra. Laura Paredes',
    colaboradores: [
      { userId: 'usr_carlos', username: 'carlos', nombreCompleto: 'Ing. Carlos Mendoza', color: '#0ea5e9', permission: 'EDITOR', canDownloadBackend: true },
      { userId: 'usr_pedro', username: 'pedro', nombreCompleto: 'Ing. Pedro Quispe', color: '#10b981', permission: 'VIEWER', canDownloadBackend: false },
      { userId: 'usr_sofia', username: 'sofia', nombreCompleto: 'Sofía Rojas', color: '#ec4899', permission: 'EDITOR', canDownloadBackend: true }
    ],
    totalClases: 3,
    totalRelaciones: 2,
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'proj_farmacia_2026',
    name: 'Inventario y Dispensación Farmacéutica',
    description: 'Control de stocks de medicamentos, lotes y prescripciones médicas.',
    ownerId: 'usr_pedro',
    ownerName: 'Ing. Pedro Quispe',
    colaboradores: [
      { userId: 'usr_carlos', username: 'carlos', nombreCompleto: 'Ing. Carlos Mendoza', color: '#0ea5e9', permission: 'EDITOR', canDownloadBackend: true },
      { userId: 'usr_laura', username: 'laura', nombreCompleto: 'Dra. Laura Paredes', color: '#f97316', permission: 'EDITOR', canDownloadBackend: true },
      { userId: 'usr_sofia', username: 'sofia', nombreCompleto: 'Sofía Rojas', color: '#ec4899', permission: 'EDITOR', canDownloadBackend: true }
    ],
    totalClases: 4,
    totalRelaciones: 3,
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const server = http.createServer(async (req, res) => {
  // Manejo de Preflight CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Usuario, X-Rol, X-Departamento'
    });
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Helper para consultas rápidas
  const getDbUsers = async () => {
    try {
      const res = await pool.query('SELECT * FROM usuarios');
      return res.rows;
    } catch (e) {
      return [
        { id: 'usr-1', username: 'admin', password: 'admin', nombreCompleto: 'Administrador del Sistema', rol: 'ADMINISTRADOR', departamento: 'Sistemas' },
        { id: 'usr-2', username: 'revisor', password: 'revisor', nombreCompleto: 'Revisor de RRHH', rol: 'REVISOR', departamento: 'Recursos Humanos' },
        { id: 'usr-3', username: 'solicitante', password: 'solicitante', nombreCompleto: 'Carlos Solicitante', rol: 'SOLICITANTE', departamento: 'Ventas' }
      ];
    }
  };

  // 1. SSE Stream para BPMN / Colaboración
  if (pathname === '/api/v1/bpmn/colaboracion/stream' && method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('data: {"type":"CONNECTED","data":{"mensaje":"SSE conectado"}}\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // 2. Auth: Login
  if (pathname === '/api/v1/auth/login' && method === 'POST') {
    const body = await parseBody(req);
    try {
      const dbRes = await pool.query('SELECT * FROM usuarios WHERE username = $1 AND password = $2', [body.username, body.password]);
      const user = dbRes.rows[0];
      if (!user) {
        return sendJson(res, 401, wrapResponse(null, 'Credenciales incorrectas', false));
      }
      const token = 'token-local-' + Buffer.from(user.username).toString('base64');
      return sendJson(res, 200, wrapResponse({
        username: user.username,
        nombreCompleto: user.nombre_completo || user.username,
        rol: user.rol,
        departamento: user.departamento,
        token,
        avatarUrl: user.avatar_url || ''
      }, 'Login exitoso'));
    } catch (e) {
      return sendJson(res, 500, wrapResponse(null, 'Error en base de datos PostgreSQL', false));
    }
  }

  // 3. Auth: Registro
  if (pathname === '/api/v1/auth/registro' && method === 'POST') {
    const body = await parseBody(req);
    const id = 'usr-' + Date.now();
    try {
      await pool.query(
        'INSERT INTO usuarios (id, username, password, nombre_completo, rol, departamento) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, body.username, body.password || '123456', body.nombreCompleto || body.username, body.rol || 'SOLICITANTE', body.departamento || 'Ventas']
      );
      return sendJson(res, 200, wrapResponse({
        username: body.username,
        nombreCompleto: body.nombreCompleto || body.username,
        rol: body.rol || 'SOLICITANTE',
        departamento: body.departamento || 'Ventas',
        token: 'token-local-' + Buffer.from(body.username).toString('base64')
      }, 'Usuario registrado'));
    } catch (e) {
      return sendJson(res, 500, wrapResponse(null, 'Error registrando usuario en PostgreSQL', false));
    }
  }

  // 4. Departamentos
  if (pathname === '/api/v1/departamentos') {
    if (method === 'GET') {
      return sendJson(res, 200, wrapResponse(db.departamentos));
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      const nuevoDep = {
        id: 'dep-' + Date.now(),
        nombre: body.nombre,
        descripcion: body.descripcion || '',
        creadoPor: req.headers['x-usuario'] || 'admin',
        activo: true,
        fechaCreacion: new Date().toISOString()
      };
      db.departamentos.push(nuevoDep);
      saveDb(db);
      return sendJson(res, 200, wrapResponse(nuevoDep, 'Departamento creado'));
    }
  }

  if (pathname.startsWith('/api/v1/departamentos/')) {
    const depId = pathname.split('/')[4];
    if (pathname.endsWith('/reactivar') && method === 'PATCH') {
      const dep = db.departamentos.find(d => d.id === depId);
      if (dep) { dep.activo = true; saveDb(db); }
      return sendJson(res, 200, wrapResponse(dep, 'Departamento reactivado'));
    }
    if (method === 'PUT') {
      const body = await parseBody(req);
      const dep = db.departamentos.find(d => d.id === depId);
      if (dep) {
        dep.nombre = body.nombre || dep.nombre;
        dep.descripcion = body.descripcion !== undefined ? body.descripcion : dep.descripcion;
        saveDb(db);
      }
      return sendJson(res, 200, wrapResponse(dep, 'Departamento actualizado'));
    }
    if (method === 'DELETE') {
      const index = db.departamentos.findIndex(d => d.id === depId);
      if (index !== -1) {
        const removed = db.departamentos.splice(index, 1)[0];
        saveDb(db);
        return sendJson(res, 200, wrapResponse({ accion: 'ELIMINAR', nombre: removed.nombre, mensaje: 'Eliminado', totalTareas: '0' }));
      }
    }
  }

  // 5. Admin Usuarios
  if (pathname === '/api/v1/admin/usuarios') {
    if (method === 'GET') {
      return sendJson(res, 200, wrapResponse(db.usuarios.map(u => ({ ...u, password: '***' }))));
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      const nuevo = {
        id: 'usr-' + Date.now(),
        username: body.username,
        password: body.password,
        nombreCompleto: body.nombreCompleto,
        rol: body.rol,
        departamento: body.departamento,
        avatarUrl: body.avatarUrl || '',
        fechaCreacion: new Date().toISOString()
      };
      db.usuarios.push(nuevo);
      saveDb(db);
      return sendJson(res, 200, wrapResponse({ ...nuevo, password: '***' }));
    }
  }

  if (pathname.startsWith('/api/v1/admin/usuarios/')) {
    const userId = pathname.split('/')[5];
    if (method === 'PUT') {
      const body = await parseBody(req);
      const user = db.usuarios.find(u => u.id === userId);
      if (user) {
        if (body.nombreCompleto) user.nombreCompleto = body.nombreCompleto;
        if (body.rol) user.rol = body.rol;
        if (body.departamento) user.departamento = body.departamento;
        if (body.password) user.password = body.password;
        if (body.avatarUrl) user.avatarUrl = body.avatarUrl;
        saveDb(db);
      }
      return sendJson(res, 200, wrapResponse({ ...user, password: '***' }));
    }
    if (method === 'DELETE') {
      db.usuarios = db.usuarios.filter(u => u.id !== userId);
      saveDb(db);
      return sendJson(res, 200, wrapResponse({ id: userId, mensaje: 'Eliminado' }));
    }
  }

  // 6. Workflows / Solicitudes
  if (pathname === '/api/v1/workflows/estadisticas' && method === 'GET') {
    const total = db.solicitudes.length;
    const pendientes = db.solicitudes.filter(s => s.estado === 'PENDIENTE').length;
    const enRevision = db.solicitudes.filter(s => s.estado === 'EN_REVISION').length;
    const aprobadas = db.solicitudes.filter(s => s.estado === 'APROBADO').length;
    const rechazadas = db.solicitudes.filter(s => s.estado === 'RECHAZADO').length;
    return sendJson(res, 200, wrapResponse({
      total, pendientes, enRevision, aprobadas, rechazadas,
      promedioResolucionHoras: 4.5,
      cumplimientoSla: 94.2
    }));
  }

  if (pathname === '/api/v1/workflows/diagrama/calles' && method === 'GET') {
    const agrupado = {};
    db.departamentos.forEach(d => { agrupado[d.nombre] = []; });
    db.solicitudes.forEach(s => {
      const dep = s.departamentoActual || 'Sistemas';
      if (!agrupado[dep]) agrupado[dep] = [];
      agrupado[dep].push(s);
    });
    return sendJson(res, 200, wrapResponse(agrupado));
  }

  if (pathname === '/api/v1/workflows/buscar' && method === 'GET') {
    const query = (parsedUrl.query.titulo || '').toLowerCase();
    const filtrados = db.solicitudes.filter(s => (s.titulo || '').toLowerCase().includes(query));
    return sendJson(res, 200, wrapResponse(filtrados));
  }

  if (pathname.startsWith('/api/v1/workflows/usuario/')) {
    const usuario = decodeURIComponent(pathname.split('/')[5]);
    const misSolicitudes = db.solicitudes.filter(s => s.usuarioCreador === usuario);
    return sendJson(res, 200, wrapResponse(misSolicitudes));
  }

  if (pathname.startsWith('/api/v1/workflows/departamento/')) {
    const parts = pathname.split('/');
    const depto = decodeURIComponent(parts[5]);
    let lista = db.solicitudes.filter(s => (s.departamentoActual || '').toLowerCase() === depto.toLowerCase());
    if (parts[6] === 'estado' && parts[7]) {
      lista = lista.filter(s => s.estado === parts[7]);
    }
    return sendJson(res, 200, wrapResponse(lista));
  }

  if (pathname === '/api/v1/workflows') {
    if (method === 'GET') {
      return sendJson(res, 200, wrapResponse(db.solicitudes));
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      const nueva = {
        id: 'sol-' + Date.now(),
        codigoSeguimiento: 'SOL-2026-' + Math.floor(100 + Math.random() * 900),
        titulo: body.titulo || 'Solicitud sin título',
        descripcion: body.descripcion || '',
        prioridad: body.prioridad || 'MEDIA',
        estado: 'PENDIENTE',
        departamentoActual: body.departamento || body.departamentoActual || 'Sistemas',
        usuarioCreador: body.solicitante || req.headers['x-usuario'] || 'solicitante',
        usuarioAsignado: 'admin',
        workflowDefinitionId: 'wf-general',
        tareaActualId: 'task-inicio',
        tareaActualNombre: 'Recepción',
        fechaCreacion: new Date().toISOString(),
        fechaActualizacion: new Date().toISOString(),
        fechaLimiteAtencion: new Date(Date.now() + 3600000 * 48).toISOString(),
        estadoSla: 'EN_TIEMPO',
        minutosRestantesSla: 2880,
        totalEventos: 1,
        historial: [
          {
            fecha: new Date().toISOString(),
            estadoAnterior: 'PENDIENTE',
            estadoNuevo: 'PENDIENTE',
            usuarioResponsable: req.headers['x-usuario'] || 'solicitante',
            rolUsuario: req.headers['x-rol'] || 'SOLICITANTE',
            comentario: 'Solicitud creada con éxito.'
          }
        ],
        archivosAdjuntos: []
      };
      db.solicitudes.unshift(nueva);
      saveDb(db);
      return sendJson(res, 200, wrapResponse(nueva, 'Solicitud creada exitosamente'));
    }
  }

  if (pathname.startsWith('/api/v1/workflows/')) {
    const parts = pathname.split('/');
    const solId = parts[4];
    const sol = db.solicitudes.find(s => s.id === solId);

    if (parts[5] === 'estado' && method === 'PATCH') {
      const body = await parseBody(req);
      if (sol) {
        const estadoAnt = sol.estado;
        sol.estado = body.nuevoEstado || body.estado;
        sol.fechaActualizacion = new Date().toISOString();
        sol.historial.push({
          fecha: new Date().toISOString(),
          estadoAnterior: estadoAnt,
          estadoNuevo: sol.estado,
          usuarioResponsable: body.usuario || req.headers['x-usuario'] || 'usuario',
          rolUsuario: req.headers['x-rol'] || 'REVISOR',
          comentario: body.comentario || 'Cambio de estado a ' + sol.estado
        });
        saveDb(db);
      }
      return sendJson(res, 200, wrapResponse(sol, 'Estado actualizado'));
    }

    if (parts[5] === 'departamento' && method === 'PATCH') {
      const body = await parseBody(req);
      if (sol) {
        const depAnt = sol.departamentoActual;
        sol.departamentoActual = body.departamento || body.nuevoDepartamento;
        sol.fechaActualizacion = new Date().toISOString();
        sol.historial.push({
          fecha: new Date().toISOString(),
          estadoAnterior: sol.estado,
          estadoNuevo: sol.estado,
          usuarioResponsable: body.usuario || req.headers['x-usuario'] || 'admin',
          rolUsuario: 'ADMINISTRADOR',
          comentario: `Reasignado de ${depAnt} a ${sol.departamentoActual}: ${body.comentario || ''}`
        });
        saveDb(db);
      }
      return sendJson(res, 200, wrapResponse(sol, 'Departamento reasignado'));
    }

    if (parts[5] === 'asignar' && method === 'PATCH') {
      const body = await parseBody(req);
      if (sol) {
        sol.usuarioAsignado = body.usuarioAsignado || body.usuario;
        saveDb(db);
      }
      return sendJson(res, 200, wrapResponse(sol, 'Usuario asignado'));
    }

    if (parts[5] === 'recomendacion-reasignacion' && method === 'GET') {
      return sendJson(res, 200, wrapResponse({
        departamentoSugerido: 'Sistemas',
        probabilidadExito: 92.5,
        razon: 'El departamento de Sistemas tiene el menor tiempo medio de respuesta actual.',
        tiempoEstimadoMinutos: 45
      }));
    }

    if (method === 'GET') {
      if (!sol) return sendJson(res, 404, wrapResponse(null, 'Solicitud no encontrada', false));
      return sendJson(res, 200, wrapResponse(sol));
    }
  }

  // 7.1 UML Diagram Persistence (CASE Studio) en PostgreSQL
  if (pathname === '/api/v1/uml/diagram') {
    if (method === 'GET') {
      try {
        const resPg = await pool.query("SELECT diagrama_json FROM uml_diagramas WHERE id = 'active_diagram'");
        const diagram = resPg.rows.length > 0 ? resPg.rows[0].diagrama_json : null;
        return sendJson(res, 200, wrapResponse(diagram));
      } catch (e) {
        return sendJson(res, 200, wrapResponse(null));
      }
    }
    if (method === 'PUT' || method === 'POST') {
      const body = await parseBody(req);
      try {
        await pool.query(
          `INSERT INTO uml_diagramas (id, nombre, diagrama_json, updated_at) 
           VALUES ('active_diagram', $1, $2, NOW()) 
           ON CONFLICT (id) DO UPDATE SET diagrama_json = $2, updated_at = NOW()`,
          [body.name || 'Diagrama UML', JSON.stringify(body)]
        );
        return sendJson(res, 200, wrapResponse(body, 'Diagrama UML guardado en PostgreSQL'));
      } catch (e) {
        return sendJson(res, 500, wrapResponse(null, 'Error guardando diagrama en PostgreSQL', false));
      }
    }
  }

  // 7. BPMN Diagrams & Definitions
  if (pathname === '/api/v1/bpmn/diagrama') {
    if (method === 'GET') {
      return sendJson(res, 200, wrapResponse({ xml: db.bpmnDiagram, version: 1 }));
    }
    if (method === 'PUT') {
      const body = await parseBody(req);
      if (body.xml) {
        db.bpmnDiagram = body.xml;
        saveDb(db);
      }
      return sendJson(res, 200, wrapResponse({ guardado: true }, 'Diagrama guardado'));
    }
  }

  if (pathname === '/api/v1/bpmn/definitions') {
    if (method === 'GET') return sendJson(res, 200, wrapResponse(db.bpmnDefinitions));
    if (method === 'POST') {
      const body = await parseBody(req);
      db.bpmnDefinitions.push(body);
      saveDb(db);
      return sendJson(res, 200, wrapResponse(body, 'Definición guardada'));
    }
  }

  if (pathname === '/api/v1/bpmn/definitions/reset-seed' && method === 'POST') {
    db.bpmnDefinitions = initialData.bpmnDefinitions;
    db.bpmnDiagram = initialData.bpmnDiagram;
    saveDb(db);
    return sendJson(res, 200, wrapResponse(db.bpmnDefinitions, 'Semilla reiniciada'));
  }

  if (pathname === '/api/v1/bpmn/colaboracion' && method === 'POST') {
    const body = await parseBody(req);
    // Notifica a todos los clientes SSE
    const payloadStr = JSON.stringify(body);
    sseClients.forEach(client => {
      client.write(`data: ${payloadStr}\n\n`);
    });
    return sendJson(res, 200, wrapResponse('OK', 'Evento colaborativo emitido'));
  }

  // 8. Documentos y Archivos
  if (pathname === '/api/v1/documentos' && method === 'GET') {
    return sendJson(res, 200, wrapResponse(db.documentos));
  }

  if (pathname === '/api/v1/archivos/todos' && method === 'GET') {
    const archivos = [];
    db.documentos.forEach(d => {
      d.versiones.forEach(v => {
        archivos.push({
          id: d.id,
          nombreOriginal: v.nombreOriginal,
          nombreAlmacenado: v.nombreAlmacenado || v.nombreOriginal,
          tipoContenido: v.tipoContenido,
          tamanoBytes: v.tamanoBytes,
          subidoPor: v.subidoPor,
          fechaSubida: v.fechaSubida,
          origenTipo: 'DOCUMENTO',
          origenNombre: d.nombre,
          documentoId: d.id
        });
      });
    });
    return sendJson(res, 200, wrapResponse(archivos));
  }

  if (pathname.startsWith('/api/v1/documentos/solicitud/')) {
    const solId = pathname.split('/')[5];
    const docs = db.documentos.filter(d => d.solicitudId === solId);
    return sendJson(res, 200, wrapResponse(docs));
  }

  if (pathname.startsWith('/api/v1/documentos/')) {
    const docId = pathname.split('/')[4];
    const doc = db.documentos.find(d => d.id === docId);

    if (pathname.endsWith('/contenido') && method === 'PUT') {
      const body = await parseBody(req);
      if (doc) {
        doc.contenidoColaborativo = typeof body === 'string' ? body : (body.contenido || '');
        doc.fechaActualizacion = new Date().toISOString();
        saveDb(db);
      }
      return sendJson(res, 200, wrapResponse(doc, 'Contenido guardado'));
    }

    if (method === 'GET') {
      return sendJson(res, 200, wrapResponse(doc || {}));
    }
  }

  // 9. Presencia y Notificaciones
  if (pathname === '/api/v1/presencia/resumen' && method === 'GET') {
    return sendJson(res, 200, wrapResponse({
      count: 3,
      totalOnlineVisible: 3,
      totalOnlineSistema: 3,
      usuariosOnline: [
        { username: 'admin', nombreCompleto: 'Administrador', rol: 'ADMINISTRADOR', depto: 'Sistemas', x: 100, y: 120, lastSeen: Date.now() },
        { username: 'revisor', nombreCompleto: 'Revisor RRHH', rol: 'REVISOR', depto: 'Recursos Humanos', x: 250, y: 120, lastSeen: Date.now() },
        { username: 'solicitante', nombreCompleto: 'Carlos Solicitante', rol: 'SOLICITANTE', depto: 'Ventas', x: 400, y: 120, lastSeen: Date.now() }
      ],
      usuarios: []
    }));
  }

  if (pathname === '/api/v1/presencia/heartbeat') {
    return sendJson(res, 200, wrapResponse({ ok: true }));
  }

  if (pathname === '/api/v1/notifications/status') {
    return sendJson(res, 200, { enabled: true });
  }

  if (pathname === '/api/v1/notifications/register-token' || pathname === '/api/v1/notifications/unregister-token') {
    return sendJson(res, 200, wrapResponse({ registrado: true }));
  }

  // 10. Asistente IA
  if (pathname === '/api/v1/ia/chat' && method === 'POST') {
    const body = await parseBody(req);
    const mensaje = body.mensaje || '';
    return sendJson(res, 200, wrapResponse({
      respuesta: `[Asistente IA Local]: Recibí tu consulta: "${mensaje}". Todo el sistema de workflows está operando con normalidad.`,
      sugerencias: ['Ver solicitudes pendientes', 'Reasignar trámites atrasados', 'Consultar estadísticas SLA']
    }));
  }

  if (pathname.startsWith('/api/v1/ia/prediccion/solicitud/')) {
    const solId = pathname.split('/')[6];
    return sendJson(res, 200, wrapResponse({
      solicitudId: solId,
      probabilidadExito: 0.95,
      riesgoRetraso: 0.05,
      tiempoEstimadoMinutos: 35,
      recomendacionPrioridad: 'NORMAL',
      anomaliasDetectadas: [],
      insightsModel: 'Gemini Workflow Predictor Local'
    }));
  }

  // 11. Digitalización de Pizarras UML con IA (Visión por Computadora)
  if (pathname === '/api/v1/uml/vision-scan' && method === 'POST') {
    const body = await parseBody(req);
    const { imageBase64, apiKey } = body;
    const effectiveKey = apiKey || process.env.GEMINI_API_KEY;

    // Si hay API key de Gemini configurada, invocar a Gemini 1.5 Flash Vision
    if (effectiveKey && imageBase64) {
      try {
        const https = require('https');
        const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
        const payload = JSON.stringify({
          contents: [{
            parts: [
              {
                text: "Actúa como un experto arquitecto de software UML 2.5. Analiza esta imagen de una pizarra dibujada a mano con un diagrama de clases. Extrae todas las clases (nombre, atributos con visibilidad +/-/# y tipos de datos [Long, String, Double, Boolean, LocalDate], métodos) y las relaciones con cardinalidades (ONE_TO_MANY, MANY_TO_MANY, INHERITANCE, COMPOSITION, AGGREGATION). Devuelve ÚNICAMENTE un JSON válido con: {\"classes\": [...], \"relations\": [...]}."
              },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: cleanBase64
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        });

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${effectiveKey}`;
        
        const geminiResponse = await new Promise((resolve, reject) => {
          const u = new URL(url);
          const reqPost = https.request({
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload)
            }
          }, (resGemini) => {
            let data = '';
            resGemini.on('data', chunk => data += chunk);
            resGemini.on('end', () => resolve(data));
          });
          reqPost.on('error', reject);
          reqPost.write(payload);
          reqPost.end();
        });

        const parsed = JSON.parse(geminiResponse);
        const textContent = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textContent) {
          const cleanJson = textContent.replace(/```json/g, '').replace(/```/g, '').trim();
          const diagramData = JSON.parse(cleanJson);
          return sendJson(res, 200, wrapResponse(diagramData, 'Pizarra digitalizada con Gemini 1.5 Flash Vision'));
        }
      } catch (err) {
        console.warn('Fallo llamada externa Gemini Vision, recurriendo a modelo de examen:', err.message);
      }
    }

    // Respuesta resiliente para el aula de examen (Sin internet o sin API Key)
    const examWhiteboardData = {
      classes: [
        {
          name: 'Paciente',
          stereotype: '«entity»',
          attributes: [
            { name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true },
            { name: 'nombreCompleto', type: 'String', visibility: '+' },
            { name: 'documentoIdentidad', type: 'String', visibility: '+' },
            { name: 'fechaNacimiento', type: 'LocalDate', visibility: '+' },
            { name: 'grupoSanguineo', type: 'String', visibility: '+' }
          ],
          methods: [
            { name: 'calcularEdad', returnType: 'Integer', visibility: '+' },
            { name: 'validarSeguro', returnType: 'Boolean', visibility: '+' }
          ]
        },
        {
          name: 'ConsultaMedica',
          stereotype: '«entity»',
          attributes: [
            { name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true },
            { name: 'fechaHora', type: 'LocalDateTime', visibility: '+' },
            { name: 'motivoConsulta', type: 'String', visibility: '+' },
            { name: 'diagnosticoPresuntivo', type: 'Text', visibility: '+' },
            { name: 'costo', type: 'Double', visibility: '+' }
          ],
          methods: [
            { name: 'registrarAtencion', returnType: 'void', visibility: '+' },
            { name: 'emitirComprobante', returnType: 'Boolean', visibility: '+' }
          ]
        },
        {
          name: 'Medico',
          stereotype: '«entity»',
          attributes: [
            { name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true },
            { name: 'nombre', type: 'String', visibility: '+' },
            { name: 'matriculaProfesional', type: 'String', visibility: '+' },
            { name: 'especialidad', type: 'String', visibility: '+' },
            { name: 'activo', type: 'Boolean', visibility: '+' }
          ],
          methods: [
            { name: 'programarTurno', returnType: 'void', visibility: '+' },
            { name: 'firmarDiagnostico', returnType: 'void', visibility: '+' }
          ]
        },
        {
          name: 'RecetaDigital',
          stereotype: '«entity»',
          attributes: [
            { name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true },
            { name: 'posologia', type: 'Text', visibility: '+' },
            { name: 'fechaVencimiento', type: 'LocalDate', visibility: '+' }
          ],
          methods: [
            { name: 'validarFirma', returnType: 'Boolean', visibility: '+' }
          ]
        }
      ],
      relations: [
        { source: 'Paciente', target: 'ConsultaMedica', type: 'ONE_TO_MANY', name: 'solicita', sourceMultiplicity: '1', targetMultiplicity: '0..*' },
        { source: 'Medico', target: 'ConsultaMedica', type: 'ONE_TO_MANY', name: 'atiende', sourceMultiplicity: '1', targetMultiplicity: '0..*' },
        { source: 'ConsultaMedica', target: 'RecetaDigital', type: 'COMPOSITION', name: 'genera', sourceMultiplicity: '1', targetMultiplicity: '1' }
      ]
    };

  // ============================================================================
  // GESTIÓN GLOBAL DE INVITACIONES Y PROYECTOS COLABORATIVOS (ENTRE DISPOSITIVOS)
  // ============================================================================

  // Obtener todas las invitaciones
  if ((pathname === '/api/invitaciones' || pathname === '/api/v1/invitaciones') && method === 'GET') {
    return sendJson(res, 200, wrapResponse(enterpriseInvitations));
  }

  // Crear y emitir nueva invitación
  if ((pathname === '/api/invitaciones' || pathname === '/api/v1/invitaciones') && method === 'POST') {
    const body = await parseBody(req);
    const newInv = {
      id: body.id || ('inv_' + Date.now()),
      projectId: body.projectId,
      projectName: body.projectName,
      senderId: body.senderId,
      senderName: body.senderName,
      targetUserId: body.targetUserId,
      targetUsername: body.targetUsername,
      targetFullName: body.targetFullName,
      role: body.role || 'EDITOR',
      status: 'PENDING',
      createdAt: body.createdAt || new Date().toISOString()
    };

    enterpriseInvitations = [newInv, ...enterpriseInvitations.filter(i => i.id !== newInv.id)];
    broadcastToAllClients({ type: 'NEW_INVITATION', invitation: newInv });
    broadcastToAllClients({ type: 'SYNC_INVITATIONS', invitations: enterpriseInvitations });
    return sendJson(res, 200, wrapResponse(newInv, 'Invitación registrada y transmitida con éxito'));
  }

  // Aceptar invitación formal
  if ((pathname === '/api/invitaciones/aceptar' || pathname === '/api/v1/invitaciones/aceptar') && method === 'POST') {
    const body = await parseBody(req);
    const invId = body.invitationId || body.id;
    const inv = enterpriseInvitations.find(i => i.id === invId);
    if (inv) {
      inv.status = 'ACCEPTED';
      inv.acceptedAt = new Date().toISOString();

      // Agregar colaborador al proyecto en el backend
      const proj = enterpriseProjects.find(p => p.id === inv.projectId);
      if (proj) {
        if (!proj.colaboradores) proj.colaboradores = [];
        const idx = proj.colaboradores.findIndex(c => c.userId === inv.targetUserId);
        if (idx >= 0) {
          proj.colaboradores[idx].permission = inv.role;
        } else {
          proj.colaboradores.push({
            userId: inv.targetUserId,
            username: inv.targetUsername,
            nombreCompleto: inv.targetFullName,
            color: '#0ea5e9',
            permission: inv.role
          });
        }
        proj.updatedAt = new Date().toISOString();
      }

      broadcastToAllClients({ type: 'INVITATION_ACCEPTED', invitation: inv });
      broadcastToAllClients({ type: 'SYNC_INVITATIONS', invitations: enterpriseInvitations });
      broadcastToAllClients({ type: 'PROJECTS_SYNCED', projects: enterpriseProjects });
      return sendJson(res, 200, wrapResponse({ invitation: inv, projects: enterpriseProjects }, 'Invitación aceptada y colaborador registrado'));
    }
    return sendJson(res, 404, wrapResponse(null, 'Invitación no encontrada', false));
  }

  // Rechazar o cancelar invitación
  if ((pathname === '/api/invitaciones/rechazar' || pathname === '/api/v1/invitaciones/rechazar') && method === 'POST') {
    const body = await parseBody(req);
    const invId = body.invitationId || body.id;
    enterpriseInvitations = enterpriseInvitations.filter(i => i.id !== invId);
    broadcastToAllClients({ type: 'SYNC_INVITATIONS', invitations: enterpriseInvitations });
    return sendJson(res, 200, wrapResponse(null, 'Invitación cancelada'));
  }

  // Obtener catálogo de proyectos sincronizados
  if ((pathname === '/api/proyectos' || pathname === '/api/v1/proyectos') && method === 'GET') {
    return sendJson(res, 200, wrapResponse(enterpriseProjects));
  }

  // Guardar o actualizar proyectos sincronizados
  if ((pathname === '/api/proyectos' || pathname === '/api/v1/proyectos') && method === 'POST') {
    const body = await parseBody(req);
    if (Array.isArray(body)) {
      const map = new Map();
      for (const p of enterpriseProjects) {
        if (p && p.id) map.set(p.id, p);
      }
      for (const p of body) {
        if (p && p.id) {
          map.set(p.id, p);
        }
      }
      enterpriseProjects = Array.from(map.values());
    } else if (body && body.id) {
      const idx = enterpriseProjects.findIndex(p => p.id === body.id);
      if (idx >= 0) {
        enterpriseProjects[idx] = { ...enterpriseProjects[idx], ...body, updatedAt: new Date().toISOString() };
      } else {
        enterpriseProjects.unshift(body);
      }
    }
    broadcastToAllClients({ type: 'PROJECTS_SYNCED', projects: enterpriseProjects });
    return sendJson(res, 200, wrapResponse(enterpriseProjects, 'Proyectos actualizados'));
  }

  // Asignación directa de colaborador a un proyecto específico
  if ((pathname === '/api/proyectos/colaborador' || pathname === '/api/v1/proyectos/colaborador') && method === 'POST') {
    const body = await parseBody(req);
    const { projectId, collaborator } = body;
    const proj = enterpriseProjects.find(p => p.id === projectId);
    if (proj && collaborator) {
      if (!proj.colaboradores) proj.colaboradores = [];
      const idx = proj.colaboradores.findIndex(c => 
        c.userId?.toLowerCase() === collaborator.userId?.toLowerCase() || 
        c.username?.toLowerCase() === collaborator.username?.toLowerCase()
      );
      if (collaborator.permission === 'NONE') {
        if (idx >= 0) proj.colaboradores.splice(idx, 1);
      } else {
        if (idx >= 0) {
          proj.colaboradores[idx] = { ...proj.colaboradores[idx], ...collaborator };
        } else {
          proj.colaboradores.push(collaborator);
        }
      }
      proj.updatedAt = new Date().toISOString();
      broadcastToAllClients({ type: 'PROJECTS_SYNCED', projects: enterpriseProjects });
      return sendJson(res, 200, wrapResponse(enterpriseProjects, 'Colaborador asignado directamente'));
    }
    return sendJson(res, 200, wrapResponse(enterpriseProjects, 'Operación procesada'));
  }

  // Si no coincide, respuesta genérica exitosa
  return sendJson(res, 200, wrapResponse({}, 'Endpoint simulado local'));
});

// ============================================================================
// SERVIDOR WEBSOCKET RFC 6455 NATIVO (Colaboración y Exclusión Mutua en Tiempo Real)
// ============================================================================
const crypto = require('crypto');

// projectRooms: Map<projectId, Set<{ socket, userId, user }>>
const projectRooms = new Map();
// projectLocks: Map<projectId, Map<elementId, lockData>>
const projectLocks = new Map();

function broadcastToAllClients(payload) {
  const frame = encodeWsFrame(JSON.stringify(payload));
  for (const sockets of projectRooms.values()) {
    for (const client of sockets) {
      if (!client.socket.destroyed) {
        try {
          client.socket.write(frame);
        } catch (e) {}
      }
    }
  }
}

function getRoomSockets(projectId) {
  if (!projectRooms.has(projectId)) {
    projectRooms.set(projectId, new Set());
  }
  return projectRooms.get(projectId);
}

function getRoomLocks(projectId) {
  if (!projectLocks.has(projectId)) {
    projectLocks.set(projectId, new Map());
  }
  return projectLocks.get(projectId);
}

function encodeWsFrame(str) {
  const payload = Buffer.from(str, 'utf8');
  const len = payload.length;
  let header;

  if (len <= 125) {
    header = Buffer.from([0x81, len]);
  } else if (len <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function broadcastToRoom(projectId, payload, excludeSocket = null) {
  const sockets = getRoomSockets(projectId);
  const frame = encodeWsFrame(JSON.stringify(payload));
  for (const client of sockets) {
    if (client.socket !== excludeSocket && !client.socket.destroyed) {
      try {
        client.socket.write(frame);
      } catch (e) {
        // Socket disconnected
      }
    }
  }
}

server.on('upgrade', (req, socket, head) => {
  const parsedUrl = url.parse(req.url, true);
  if (!parsedUrl.pathname.startsWith('/ws/uml')) {
    socket.destroy();
    return;
  }

  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  const acceptKey = crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  const headers = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`
  ];
  socket.write(headers.join('\r\n') + '\r\n\r\n');

  const clientInfo = {
    socket,
    projectId: parsedUrl.query.project || 'proj_salud_2026',
    userId: parsedUrl.query.user || 'usr_anon',
    user: null
  };

  const room = getRoomSockets(clientInfo.projectId);
  room.add(clientInfo);

  let buffer = Buffer.alloc(0);

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (buffer.length >= 2) {
      const byte1 = buffer[0];
      const byte2 = buffer[1];
      const opcode = byte1 & 0x0f;
      const isMasked = (byte2 & 0x80) !== 0;
      let payloadLen = byte2 & 0x7f;
      let offset = 2;

      if (opcode === 0x08) {
        socket.end();
        return;
      }

      if (payloadLen === 126) {
        if (buffer.length < 4) return;
        payloadLen = buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (buffer.length < 10) return;
        payloadLen = Number(buffer.readBigUInt64BE(2));
        offset = 10;
      }

      const maskLength = isMasked ? 4 : 0;
      if (buffer.length < offset + maskLength + payloadLen) {
        return;
      }

      let maskKey = null;
      if (isMasked) {
        maskKey = buffer.slice(offset, offset + 4);
        offset += 4;
      }

      const rawPayload = buffer.slice(offset, offset + payloadLen);
      buffer = buffer.slice(offset + payloadLen);

      if (isMasked) {
        for (let i = 0; i < rawPayload.length; i++) {
          rawPayload[i] ^= maskKey[i % 4];
        }
      }

      if (opcode === 0x01) {
        try {
          const text = rawPayload.toString('utf8');
          const data = JSON.parse(text);
          handleWsMessage(data, clientInfo);
        } catch (err) {
          console.error('Error parseando JSON de frame WS:', err);
        }
      }
    }
  });

  socket.on('close', () => {
    handleClientDisconnect(clientInfo);
  });

  socket.on('error', () => {
    handleClientDisconnect(clientInfo);
  });
});

function handleWsMessage(msg, client) {
  const projectId = msg.projectId || client.projectId;

  switch (msg.type) {
    case 'JOIN_ROOM':
      client.projectId = projectId;
      if (msg.user) {
        client.userId = msg.user.userId;
        client.user = msg.user;
      }
      broadcastToRoom(projectId, {
        type: 'JOIN_ROOM',
        projectId,
        user: client.user
      }, client.socket);
      break;

    case 'LOCK_ELEMENT':
      if (msg.lock) {
        const locks = getRoomLocks(projectId);
        locks.set(msg.lock.elementId, msg.lock);
        broadcastToRoom(projectId, {
          type: 'ELEMENT_LOCKED',
          projectId,
          lock: msg.lock
        }, client.socket);
      }
      break;

    case 'UNLOCK_ELEMENT':
      if (msg.elementId) {
        const locks = getRoomLocks(projectId);
        locks.delete(msg.elementId);
        broadcastToRoom(projectId, {
          type: 'ELEMENT_UNLOCKED',
          projectId,
          elementId: msg.elementId
        }, client.socket);
      }
      break;

    case 'MOVE_ELEMENT':
      broadcastToRoom(projectId, {
        type: 'ELEMENT_MOVED',
        projectId,
        elementId: msg.elementId,
        position: msg.position,
        userId: client.userId
      }, client.socket);
      break;

    case 'SYNC_DIAGRAM':
      broadcastToRoom(projectId, {
        type: 'DIAGRAM_SYNCED',
        projectId,
        diagram: msg.diagram,
        userId: client.userId
      }, client.socket);
      break;

    case 'AUDIT_EVENT':
    case 'PERMISSION_CHANGED':
      broadcastToRoom(projectId, msg, client.socket);
      break;

    case 'NEW_INVITATION':
    case 'INVITATION_ACCEPTED':
    case 'SYNC_INVITATIONS':
    case 'PROJECTS_SYNCED':
      broadcastToAllClients(msg);
      break;
  }
}

function handleClientDisconnect(client) {
  const room = getRoomSockets(client.projectId);
  room.delete(client);

  const locks = getRoomLocks(client.projectId);
  for (const [elemId, lock] of locks.entries()) {
    if (lock.userId === client.userId) {
      locks.delete(elemId);
      broadcastToRoom(client.projectId, {
        type: 'ELEMENT_UNLOCKED',
        projectId: client.projectId,
        elementId: elemId
      });
    }
  }

  broadcastToRoom(client.projectId, {
    type: 'LEAVE_ROOM',
    projectId: client.projectId,
    userId: client.userId
  });
}

server.listen(PORT, () => {
  console.log(`\n========================================================`);
  console.log(`🚀 SERVIDOR BACKEND DEL DIAGRAMADOR EJECUTÁNDOSE EN:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`========================================================`);
  console.log(`🐘 Conectado a PostgreSQL: db "diagramador_db"`);
  console.log(`🔑 Usuarios disponibles para Login:`);
  console.log(`   - admin / admin        (Rol: ADMINISTRADOR, Depto: Sistemas)`);
  console.log(`   - revisor / revisor    (Rol: REVISOR, Depto: Recursos Humanos)`);
  console.log(`   - solicitante / solicitante (Rol: SOLICITANTE, Depto: Ventas)`);
  console.log(`========================================================\n`);
});
