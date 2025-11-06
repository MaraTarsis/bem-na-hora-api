const jsonServer = require("json-server");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const server = jsonServer.create();
const router = jsonServer.router("db.json");
const middlewares = jsonServer.defaults();

server.use(cors());
server.use(jsonServer.bodyParser);
server.use(middlewares);

const dbFile = path.join(__dirname, "db.json");

// Rota personalizada para buscar pacientes por cuidador
server.get("/pacientes-por-cuidador/:cuidadorId", (req, res) => {
  const db = readDb();
  const cuidadorId = parseInt(req.params.cuidadorId);

  const pacientes = db.usuarios.filter(
    (usuario) =>
      usuario.tipoUsuario === "PACIENTE" &&
      usuario.statusPaciente === "ASSISTIDO" &&
      usuario.cuidadorId === cuidadorId
  );

  res.json(pacientes);
});

// -------------------------
// Funções auxiliares
// -------------------------
function readDb() {
  return JSON.parse(fs.readFileSync(dbFile, "utf-8"));
}

function writeDb(data) {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

// Gera ID incremental (baseado no maior existente)
function gerarId(lista) {
  return lista.length ? Math.max(...lista.map((i) => i.id)) + 1 : 1;
}

// -------------------------
// LOGIN
// -------------------------
server.post("/login", (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: "Informe email e senha." });
  }

  const db = readDb();
  const usuario = db.usuarios.find(
    (u) => u.email === email && u.senha === senha
  );

  if (!usuario) {
    return res.status(401).json({ erro: "Credenciais inválidas." });
  }

  const { senha: _, ...userData } = usuario;
  res.json({
    mensagem: "Login bem-sucedido!",
    usuario: userData,
  });
});

// -------------------------
// USUÁRIOS
// -------------------------
server.get("/usuarios", (req, res) => {
  const db = readDb();
  res.json(db.usuarios);
});

server.post("/usuarios", (req, res) => {
  const db = readDb();
  const novo = { id: gerarId(db.usuarios), ...req.body };
  db.usuarios.push(novo);
  writeDb(db);
  res.status(201).json(novo);
});

server.put("/usuarios/:id", (req, res) => {
  const db = readDb();
  const id = Number(req.params.id);
  const index = db.usuarios.findIndex((u) => u.id === id);
  if (index === -1)
    return res.status(404).json({ erro: "Usuário não encontrado" });
  db.usuarios[index] = { ...db.usuarios[index], ...req.body };
  writeDb(db);
  res.json(db.usuarios[index]);
});

server.delete("/usuarios/:id", (req, res) => {
  const db = readDb();
  db.usuarios = db.usuarios.filter((u) => u.id !== Number(req.params.id));
  writeDb(db);
  res.status(204).end();
});

// -------------------------
// RECEITAS
// -------------------------
server.get("/receitas", (req, res) => {
  const db = readDb();
  const { usuarioId } = req.query;
  const receitas = usuarioId
    ? db.receitas.filter((r) => r.usuarioId === Number(usuarioId))
    : db.receitas;
  res.json(receitas);
});

server.post("/receitas", (req, res) => {
  const db = readDb();
  const nova = { id: gerarId(db.receitas), ...req.body };
  db.receitas.push(nova);
  writeDb(db);
  res.status(201).json(nova);
});

server.put("/receitas/:id", (req, res) => {
  const db = readDb();
  const id = Number(req.params.id);
  const index = db.receitas.findIndex((r) => r.id === id);
  if (index === -1)
    return res.status(404).json({ erro: "Receita não encontrada" });
  db.receitas[index] = { ...db.receitas[index], ...req.body };
  writeDb(db);
  res.json(db.receitas[index]);
});

server.delete("/receitas/:id", (req, res) => {
  const db = readDb();
  db.receitas = db.receitas.filter((r) => r.id !== Number(req.params.id));
  writeDb(db);
  res.status(204).end();
});

// -------------------------
// MEDICAMENTOS
// -------------------------
server.get("/medicamentos", (req, res) => {
  const db = readDb();
  const { usuarioId, receitaId, proximasHoras } = req.query;
  let meds = db.medicamentos;

  if (usuarioId) meds = meds.filter((m) => m.usuarioId === Number(usuarioId));
  if (receitaId) meds = meds.filter((m) => m.receitaId === Number(receitaId));

  // Se proximasHoras for especificado, retorna apenas medicamentos que precisam ser tomados
  // nas próximas N horas
  if (proximasHoras) {
    const horasLimite = Number(proximasHoras);
    const agora = new Date();
    const limite = new Date(agora.getTime() + horasLimite * 60 * 60 * 1000);

    meds = meds.filter((med) => {
      const dataInicio = new Date(med.dataInicio);
      const dataFim = new Date(med.dataFim);

      // Verifica se o medicamento está dentro do período de tratamento
      if (agora >= dataInicio && agora <= dataFim) {
        // Calcula próximo horário baseado no intervalo
        const ultimoRegistro = db.registros
          .filter((r) => r.medicamentoId === med.id)
          .sort((a, b) => new Date(b.horario) - new Date(a.horario))[0];

        const baseTime = ultimoRegistro
          ? new Date(ultimoRegistro.horario)
          : new Date(med.dataInicio);

        const proximaHora = new Date(
          baseTime.getTime() + med.intervaloHoras * 60 * 60 * 1000
        );

        return proximaHora <= limite;
      }
      return false;
    });
  }

  res.json(meds);
});

server.post("/medicamentos", (req, res) => {
  const db = readDb();
  const novo = { id: gerarId(db.medicamentos), ...req.body };
  db.medicamentos.push(novo);
  writeDb(db);
  res.status(201).json(novo);
});

server.put("/medicamentos/:id", (req, res) => {
  const db = readDb();
  const id = Number(req.params.id);
  const index = db.medicamentos.findIndex((m) => m.id === id);
  if (index === -1)
    return res.status(404).json({ erro: "Medicamento não encontrado" });
  db.medicamentos[index] = { ...db.medicamentos[index], ...req.body };
  writeDb(db);
  res.json(db.medicamentos[index]);
});

server.delete("/medicamentos/:id", (req, res) => {
  const db = readDb();
  db.medicamentos = db.medicamentos.filter(
    (m) => m.id !== Number(req.params.id)
  );
  writeDb(db);
  res.status(204).end();
});

// -------------------------
// REGISTROS DE TOMADA
// -------------------------
server.get("/registros", (req, res) => {
  const db = readDb();
  const { medicamentoId, usuarioId } = req.query;
  let regs = db.registros;
  if (medicamentoId)
    regs = regs.filter((r) => r.medicamentoId === Number(medicamentoId));
  if (usuarioId) regs = regs.filter((r) => r.usuarioId === Number(usuarioId));
  res.json(regs);
});

server.post("/registros", (req, res) => {
  const db = readDb();
  const novo = { id: gerarId(db.registros), ...req.body };
  db.registros.push(novo);
  writeDb(db);
  res.status(201).json(novo);
});

server.put("/registros/:id", (req, res) => {
  const db = readDb();
  const id = Number(req.params.id);
  const index = db.registros.findIndex((r) => r.id === id);
  if (index === -1)
    return res.status(404).json({ erro: "Registro não encontrado" });
  db.registros[index] = { ...db.registros[index], ...req.body };
  writeDb(db);
  res.json(db.registros[index]);
});

server.delete("/registros/:id", (req, res) => {
  const db = readDb();
  db.registros = db.registros.filter((r) => r.id !== Number(req.params.id));
  writeDb(db);
  res.status(204).end();
});

// -------------------------
// Fallback do JSON Server padrão
// -------------------------
server.use(router);

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`🚀 API rodando em http://localhost:${PORT}`);
});
