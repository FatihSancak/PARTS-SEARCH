require('dotenv').config();
const fastify = require('fastify')({ logger: false });
const sql = require('mssql');
const QRCode = require('qrcode');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const LABEL_TEMPLATE_PATH = path.join(__dirname, 'data', 'label-template.json');

const quoteSqlName = value => `[${String(value).replace(/]/g, ']]')}]`;
const normalizeDbColumnName = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00df/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
const findColumnName = (columns, candidates) => {
    const normalizedCandidates = candidates.map(normalizeDbColumnName);
    return columns.find(column => normalizedCandidates.includes(normalizeDbColumnName(column))) || null;
};
const optionalColumnSelect = (columns, candidates, alias, sqlType = 'nvarchar(255)') => {
    const column = findColumnName(columns, candidates);
    return column
        ? `f.${quoteSqlName(column)} AS ${quoteSqlName(alias)}`
        : `CAST(NULL AS ${sqlType}) AS ${quoteSqlName(alias)}`;
};
const chooseColumn = (columns, patterns) => {
    const normalizedPatterns = patterns.map(normalizeDbColumnName);
    for (const pattern of patterns) {
        const exact = columns.find(column => column.name.toLowerCase() === pattern);
        if (exact) return exact;
    }
    for (const pattern of normalizedPatterns) {
        const exact = columns.find(column => normalizeDbColumnName(column.name) === pattern);
        if (exact) return exact;
    }
    for (const pattern of patterns) {
        const partial = columns.find(column => column.name.toLowerCase().includes(pattern));
        if (partial) return partial;
    }
    for (const pattern of normalizedPatterns) {
        const partial = columns.find(column => normalizeDbColumnName(column.name).includes(pattern));
        if (partial) return partial;
    }
    return null;
};

const SALES_UNIT_NAMES = {
    '0': 'Genel / AtanmamÄ±ÅŸ',
    '1': 'German Car PartÂ´s',
    '2': 'EU Car PartÂ´s',
    '3': 'Japan Car PartÂ´s',
    '4': 'BaytemÃ¼r Autoteile GmbH',
    '5': 'Internet Business'
};

const SEARCH_FIELDS = {
    "designation": "Bezeichnung",
    "article": "Artikelnummer",
    "brand": "Marke",
    "model": "Modellcode",
    "type": "Typ",
    "additional": "Zusatztext",
    "engine": "Motorcode",
    "gearbox": "Getriebecode",
    "displacement": "Hubraum",
    "location": "Lagerort",
    "ebay": "Ebayartikelnummer",
    "vehicle": "FahrzeugNummer",
};

const SORT_FIELDS = {
    "name": "g.[Bezeichnung]",
    "brand": "g.[Marke]",
    "model": "g.[Modellcode]",
    "stock": "g.[Lagermenge]",
    "price": "g.[VK_Brutto]",
    "article": "g.[Artikelnummer]",
    "location": "g.[Lagerort]",
    "newest": "g.[Fahrzeug-ID]",
};

const normalizePartSearchValue = value => String(value || '')
    .toUpperCase()
    .replace(/Ã„/g, 'A')
    .replace(/Ã–/g, 'O')
    .replace(/Ãœ/g, 'U')
    .replace(/ÃŸ/g, 'SS')
    .replace(/Ä°/g, 'I')
    .replace(/IÌ‡/g, 'I')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');

const normalizedSqlText = expression => `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(UPPER(CONVERT(NVARCHAR(4000), ${expression})), N'Ã„', N'A'), N'Ã–', N'O'), N'Ãœ', N'U'), N'áºž', N'SS'), N'ÃŸ', N'SS'), N'Ä°', N'I'), N' ', N''), CHAR(9), N''), N'-', N''), N'.', N''), N'/', N''), N'_', N'')`;

const SELECT_COLUMNS = [
    "Fahrzeug-ID", "ArtikelNr", "Artikelnummer", "Bezeichnung", "Zusatztext",
    "Marke", "Modellcode", "Typ", "Motorcode", "Getriebecode", "Hubraum",
    "Lagerort", "Lagerplatz", "Lagermenge", "Mindestmenge", "MaxMenge",
    "VK_Brutto", "Verkaufspreis", "Einkaufspreis", "Ebayartikelnummer",
    "Kilometer", "Baujahr", "Erstzulassung", "Kraftstoff", "Farbe",
    "KBA_Nummer", "Zylinder", "Getriebeart", "Zustand", "Bemerkung",
    "Pfand", "Euro_Norm", "Status", "Reserviert", "Letzte_Buchung",
    "EbayMarkiertVonAbteilung",
    "FahrzeugNummer",
];

// Helper to guess mime type without external dependencies
function guessMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const map = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml'
    };
    return map[ext] || 'application/octet-stream';
}

// Function to resolve database config from Access or Env
function getDbConfig() {
    const source = process.env.DB_CONFIG_SOURCE || 'ENV';
    if (source === 'ACCESS') {
        const scriptPath = path.join(__dirname, 'get_db_config.ps1');
        let pwshPath = 'powershell.exe';
        const sysWow64Pwsh = 'C:\\Windows\\SysWOW64\\WindowsPowerShell\\v1.0\\powershell.exe';
        if (fsSync.existsSync(sysWow64Pwsh)) {
            pwshPath = sysWow64Pwsh;
        }
        try {
            const output = execFileSync(pwshPath, [
                '-NoProfile',
                '-ExecutionPolicy',
                'Bypass',
                '-File',
                scriptPath
            ], { encoding: 'utf-8-sig' });
            return JSON.parse(output.trim());
        } catch (err) {
            console.error('get_db_config.ps1 running error:', err);
            throw new Error('Access veritabanÄ±ndan baÄŸlantÄ± bilgileri okunamadÄ±.');
        }
    } else {
        const profile = process.env.ENV_PROFILE || 'WORK';
        const prefix = profile === 'HOME' ? 'HOME_' : 'WORK_';
        
        const server = process.env[`${prefix}DB_SERVER`];
        const database = process.env[`${prefix}DB_DATABASE`];
        const user = process.env[`${prefix}DB_USER`];
        const password = process.env[`${prefix}DB_PASSWORD`];
        const trustCert = process.env[`${prefix}DB_TRUST_SERVER_CERTIFICATE`] !== 'false';
        const timeout = parseInt(process.env[`${prefix}DB_CONNECTION_TIMEOUT`], 10) || 15;

        if (!server || !database) {
            throw new Error(`.env dosyasÄ±nda ${prefix}DB_SERVER ve ${prefix}DB_DATABASE tanÄ±mlanmalÄ±dÄ±r.`);
        }
        if (!user || !password) {
            throw new Error(`.env dosyasÄ±nda ${prefix}DB_USER ve ${prefix}DB_PASSWORD tanÄ±mlanmalÄ±dÄ±r.`);
        }

        return {
            server,
            database,
            user,
            password,
            trust_server_certificate: trustCert,
            connection_timeout: timeout
        };
    }
}

// Cached pool
let pool = null;

async function getDbPool() {
    if (pool) return pool;

    const config = getDbConfig();
    let serverHost = config.server;
    let instanceName = undefined;
    if (serverHost.includes('\\')) {
        const parts = serverHost.split('\\');
        serverHost = parts[0];
        instanceName = parts[1];
    }

    const dbConfig = {
        server: serverHost,
        database: config.database,
        user: config.user,
        password: config.password,
        options: {
            encrypt: false,
            trustServerCertificate: config.trust_server_certificate !== false,
        },
        connectionTimeout: (parseInt(config.connection_timeout, 10) || 15) * 1000,
        requestTimeout: 30000,
        pool: {
            max: 15,
            min: 1,
            idleTimeoutMillis: 30000
        }
    };

    if (instanceName) {
        dbConfig.options.instanceName = instanceName;
    }

    try {
        pool = await new sql.ConnectionPool(dbConfig).connect();
        console.log(`Connected to SQL Server: ${serverHost} (DB: ${config.database}, Profile: ${process.env.ENV_PROFILE || 'WORK'})`);
        
        // Handle pool level errors
        pool.on('error', err => {
            console.error('Database pool error:', err);
            pool = null;
        });

        return pool;
    } catch (err) {
        console.error('Database connection failed:', err);
        pool = null;
        throw err;
    }
}

// Convert dates and decimals to match Python's formatting requirements
function formatRow(row) {
    if (!row) return row;
    const formatted = {};
    for (const [key, val] of Object.entries(row)) {
        if (val instanceof Date) {
            // ISO format date/time
            formatted[key] = val.toISOString();
        } else if (val && typeof val === 'object' && val.constructor && val.constructor.name === 'Decimal') {
            // Convert Decimal to float
            formatted[key] = parseFloat(val.toString());
        } else if (Buffer.isBuffer(val)) {
            // Convert buffers to hex
            formatted[key] = val.toString('hex');
        } else {
            formatted[key] = val;
        }
    }
    return formatted;
}

function escapeExcelHtml(value) {
    if (value === null || value === undefined) return '';
    const text = value instanceof Date ? value.toISOString() : String(value);
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function excelCellValue(value) {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 19).replace('T', ' ');
    if (Buffer.isBuffer(value)) return value.toString('hex');
    if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'Decimal') {
        return value.toString();
    }
    return value;
}

function excelHtmlTable(rows, columns, title) {
    const header = columns.map(column => `<th>${escapeExcelHtml(column)}</th>`).join('');
    const body = rows.map(row => `<tr>${columns.map(column => (
        `<td style="mso-number-format:'\\@';">${escapeExcelHtml(excelCellValue(row[column]))}</td>`
    )).join('')}</tr>`).join('');
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
body{font-family:Arial,sans-serif}
table{border-collapse:collapse}
th,td{border:1px solid #999;padding:4px 6px;vertical-align:top;white-space:nowrap}
th{background:#d9e8fb;font-weight:700}
</style>
</head>
<body>
<h1>${escapeExcelHtml(title)}</h1>
<table>
<thead><tr>${header}</tr></thead>
<tbody>${body}</tbody>
</table>
</body>
</html>`;
}

// Register Static files directory
fastify.register(require('@fastify/static'), {
    root: path.join(__dirname, 'static'),
    prefix: '/',
});

// WMKAT otomasyonu baÄŸÄ±msÄ±z ve isteÄŸe baÄŸlÄ±dÄ±r; mevcut arama akÄ±ÅŸÄ±nÄ± etkilemez.
fastify.register(require('./modules/wmkat'), {
    localStockSearch: ({ references, unit }) => require('./modules/wmkat/local-stock-search').findLocalStock({
        references, unit, getDbPool, sql, selectColumns: SELECT_COLUMNS, formatRow
    })
});
fastify.register(require('./modules/recycle'));

// API Routes

const REPORT_SESSION_COOKIE = 'report_session';
const C_O_REPORT_SESSION_COOKIE = 'c_o_report_session';
const REPORT_SESSION_TTL_MS = 3 * 60 * 1000;
const reportSessions = new Map();
const cOReportSessions = new Map();

fastify.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (request, body, done) => done(null, body));

function parseCookies(header) {
    return String(header || '').split(';').reduce((cookies, part) => {
        const separator = part.indexOf('=');
        if (separator < 0) return cookies;
        const key = part.slice(0, separator).trim();
        const value = part.slice(separator + 1).trim();
        if (key) cookies[key] = value;
        return cookies;
    }, {});
}

function hasSession(request, cookieName, sessions) {
    const token = parseCookies(request.headers.cookie)[cookieName];
    if (!token) return false;
    const expiresAt = sessions.get(token);
    if (!expiresAt || expiresAt <= Date.now()) {
        sessions.delete(token);
        return false;
    }
    sessions.set(token, Date.now() + REPORT_SESSION_TTL_MS);
    return true;
}

function sessionCookie(cookieName, token, request, maxAge = REPORT_SESSION_TTL_MS / 1000) {
    const secure = request.protocol === 'https' ? '; Secure' : '';
    return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

function safePasswordMatch(value, environmentName) {
    const expected = Buffer.from(String(process.env[environmentName] || ''), 'utf8');
    const received = Buffer.from(String(value || ''), 'utf8');
    return expected.length > 0 && expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function reportLoginPage(action, error = false) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Authentication Required</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:linear-gradient(135deg,#eef3fb,#dce7f7);font-family:Inter,Segoe UI,Arial,sans-serif;color:#17243b}.card{width:min(420px,100%);background:#fff;border:1px solid #dce3ee;border-radius:20px;padding:34px;box-shadow:0 18px 55px #284a7b24}.mark{width:52px;height:52px;display:grid;place-items:center;border-radius:15px;background:#2458bd;color:#fff;font-size:25px}.eyebrow{margin:22px 0 7px;color:#2458bd;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}h1{margin:0;font-size:27px}p{color:#667085;line-height:1.55}label{display:block;margin:24px 0 8px;font-weight:700;font-size:14px}input{width:100%;height:48px;border:1px solid #cbd5e1;border-radius:11px;padding:0 14px;font-size:17px;outline:none}input:focus{border-color:#2458bd;box-shadow:0 0 0 4px #2458bd18}button{width:100%;height:48px;margin-top:14px;border:0;border-radius:11px;background:#2458bd;color:#fff;font-size:15px;font-weight:800;cursor:pointer}.error{margin:14px 0 0;padding:10px 12px;border-radius:9px;background:#fff0f0;color:#b42318;font-size:14px}@media(max-width:480px){.card{padding:26px}}
</style></head><body><main class="card"><div class="mark">â—</div><div class="eyebrow">Restricted access</div><h1>Password required</h1><p>Please enter your password to continue.</p><form method="post" action="${action}"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" autofocus required><button type="submit">Continue</button>${error ? '<div class="error" role="alert">Incorrect password. Please try again.</div>' : ''}</form></main></body></html>`;
}

function sessionGuard(cookieName, sessions, loginPath) {
    return async function guard(request, reply) {
        if (hasSession(request, cookieName, sessions)) {
            const token = parseCookies(request.headers.cookie)[cookieName];
            reply.header('Set-Cookie', sessionCookie(cookieName, token, request));
            return;
        }
        return reply.redirect(loginPath);
    };
}

const requireReportSession = sessionGuard(REPORT_SESSION_COOKIE, reportSessions, '/rapor-giris');
const requireCOReportSession = sessionGuard(C_O_REPORT_SESSION_COOKIE, cOReportSessions, '/c_o_giris');

async function requireReportApiSession(request, reply) {
    const cookies = parseCookies(request.headers.cookie);
    if (hasSession(request, REPORT_SESSION_COOKIE, reportSessions)) {
        reply.header('Set-Cookie', sessionCookie(REPORT_SESSION_COOKIE, cookies[REPORT_SESSION_COOKIE], request));
        return;
    }
    return reply.status(401).send({ error: 'Oturum gerekli. LÃ¼tfen /rapor/auto sayfasÄ±na tekrar giriÅŸ yapÄ±n.', read_only: true });
}

async function requireAnyReportSession(request, reply) {
    const cookies = parseCookies(request.headers.cookie);
    if (hasSession(request, REPORT_SESSION_COOKIE, reportSessions)) {
        reply.header('Set-Cookie', sessionCookie(REPORT_SESSION_COOKIE, cookies[REPORT_SESSION_COOKIE], request));
        return;
    }
    if (hasSession(request, C_O_REPORT_SESSION_COOKIE, cOReportSessions)) {
        reply.header('Set-Cookie', sessionCookie(C_O_REPORT_SESSION_COOKIE, cookies[C_O_REPORT_SESSION_COOKIE], request));
        return;
    }
    return reply.status(401).send({ error: 'Oturum gerekli.' });
}

fastify.get('/rapor-giris', async (request, reply) => {
    if (hasSession(request, REPORT_SESSION_COOKIE, reportSessions)) return reply.redirect('/rapor');
    return reply.type('text/html; charset=utf-8').send(reportLoginPage('/rapor-giris', request.query.hata === '1'));
});

fastify.post('/rapor-giris', async (request, reply) => {
    const body = String(request.body || '');
    const params = new URLSearchParams(body);
    if (!safePasswordMatch(params.get('password'), 'REPORT_PASSWORD')) return reply.redirect('/rapor-giris?hata=1');
    for (const [sessionToken, expiresAt] of reportSessions) {
        if (expiresAt <= Date.now()) reportSessions.delete(sessionToken);
    }
    const token = crypto.randomBytes(32).toString('base64url');
    reportSessions.set(token, Date.now() + REPORT_SESSION_TTL_MS);
    reply.header('Set-Cookie', sessionCookie(REPORT_SESSION_COOKIE, token, request));
    return reply.redirect('/rapor');
});

fastify.get('/rapor-cikis', async (request, reply) => {
    const token = parseCookies(request.headers.cookie)[REPORT_SESSION_COOKIE];
    if (token) reportSessions.delete(token);
    reply.header('Set-Cookie', sessionCookie(REPORT_SESSION_COOKIE, '', request, 0));
    return reply.redirect('/rapor-giris');
});

fastify.get('/rapor', { preHandler: requireReportSession }, async (request, reply) => reply.sendFile('sales-report.html'));
fastify.get('/rapor/auto', { preHandler: requireReportSession }, async (request, reply) => reply.sendFile('auto-invoice-report.html'));
fastify.get('/kba', async (request, reply) => reply.sendFile('kba.html'));
fastify.get('/c_o_giris', async (request, reply) => {
    if (hasSession(request, C_O_REPORT_SESSION_COOKIE, cOReportSessions)) return reply.redirect('/c_o_report');
    return reply.type('text/html; charset=utf-8').send(reportLoginPage('/c_o_giris', request.query.hata === '1'));
});

fastify.post('/c_o_giris', async (request, reply) => {
    const params = new URLSearchParams(String(request.body || ''));
    if (!safePasswordMatch(params.get('password'), 'C_O_REPORT_PASSWORD')) return reply.redirect('/c_o_giris?hata=1');
    for (const [sessionToken, expiresAt] of cOReportSessions) {
        if (expiresAt <= Date.now()) cOReportSessions.delete(sessionToken);
    }
    const token = crypto.randomBytes(32).toString('base64url');
    cOReportSessions.set(token, Date.now() + REPORT_SESSION_TTL_MS);
    reply.header('Set-Cookie', sessionCookie(C_O_REPORT_SESSION_COOKIE, token, request));
    return reply.redirect('/c_o_report');
});

fastify.get('/c_o_cikis', async (request, reply) => {
    const token = parseCookies(request.headers.cookie)[C_O_REPORT_SESSION_COOKIE];
    if (token) cOReportSessions.delete(token);
    reply.header('Set-Cookie', sessionCookie(C_O_REPORT_SESSION_COOKIE, '', request, 0));
    return reply.redirect('/c_o_giris');
});

fastify.get('/c_o_report', { preHandler: requireCOReportSession }, async (request, reply) => reply.sendFile('c_o_report.html'));

fastify.get('/api/qr', async (request, reply) => {
    try {
        const value = String(request.query.text || '').slice(0, 500);
        if (!value) return reply.status(400).send('QR text required');
        const png = await QRCode.toBuffer(value, { type: 'png', width: 360, margin: 1, errorCorrectionLevel: 'M' });
        reply.type('image/png').header('Cache-Control', 'private, max-age=86400').send(png);
    } catch (err) {
        reply.status(500).send({ error: err.message });
    }
});

fastify.get('/api/label-template', async (request, reply) => {
    try {
        const content = await fs.readFile(LABEL_TEMPLATE_PATH, 'utf8');
        return { template: JSON.parse(content) };
    } catch (err) {
        if (err.code === 'ENOENT') return { template: null };
        reply.status(500).send({ error: err.message });
    }
});

fastify.put('/api/label-template', async (request, reply) => {
    try {
        const source = request.body;
        if (!source || !Array.isArray(source.elements)) return reply.status(400).send({ error: 'Invalid label template' });
        const width = Number(source.width);
        const height = Number(source.height);
        if (!Number.isFinite(width) || width < 20 || width > 210 || !Number.isFinite(height) || height < 15 || height > 297 || source.elements.length > 100) {
            return reply.status(400).send({ error: 'Invalid label dimensions or elements' });
        }
        const template = {
            width,
            height,
            elements: source.elements.map((item, index) => ({
                id: String(item.id || `element-${index}`).slice(0, 80),
                type: String(item.type || 'custom').slice(0, 40),
                x: Number(item.x) || 0,
                y: Number(item.y) || 0,
                w: Math.max(3, Number(item.w) || 3),
                h: Math.max(3, Number(item.h) || 3),
                fontSize: Math.min(72, Math.max(5, Number(item.fontSize) || 10)),
                bold: Boolean(item.bold),
                align: ['left', 'center', 'right'].includes(item.align) ? item.align : 'left',
                text: String(item.text || '').slice(0, 500)
            }))
        };
        await fs.mkdir(path.dirname(LABEL_TEMPLATE_PATH), { recursive: true });
        const temporaryPath = `${LABEL_TEMPLATE_PATH}.tmp`;
        await fs.writeFile(temporaryPath, JSON.stringify(template, null, 2), 'utf8');
        await fs.rename(temporaryPath, LABEL_TEMPLATE_PATH);
        return { ok: true, template };
    } catch (err) {
        reply.status(500).send({ error: err.message });
    }
});

// /api/health
fastify.get('/api/health', async (request, reply) => {
    try {
        const dbPool = await getDbPool();
        const result = await dbPool.query('SELECT @@SERVERNAME AS server, DB_NAME() AS [database], SUSER_SNAME() AS [user]');
        const row = result.recordset[0];
        return { ok: true, server: row.server, database: row.database, user: row.user };
    } catch (err) {
        reply.status(500).send({ error: err.message });
    }
});

// Read-only sales performance report. This route only reads schema metadata and sales rows.
fastify.get('/api/sales-report', { preHandler: requireAnyReportSession }, async (request, reply) => {
    try {
        const dbPool = await getDbPool();
        const reportDatabases = [...new Set(String(process.env.WORK_REPORT_DB_DATABASES || getDbConfig().database)
            .split(',').map(value => value.trim()).filter(Boolean))];
        const schemaRows = [];
        for (const database of reportDatabases) {
            try {
                const databaseLiteral = database.replace(/'/g, "''");
                const schemaResult = await dbPool.request().query(`
                    SELECT N'${databaseLiteral}' AS DatabaseName, s.[name] AS SchemaName,
                           t.[name] AS TableName, c.[name] AS ColumnName, ty.[name] AS DataType
                    FROM ${quoteSqlName(database)}.sys.objects t
                    JOIN ${quoteSqlName(database)}.sys.schemas s ON s.[schema_id]=t.[schema_id]
                    JOIN ${quoteSqlName(database)}.sys.columns c ON c.[object_id]=t.[object_id]
                    JOIN ${quoteSqlName(database)}.sys.types ty ON ty.[user_type_id]=c.[user_type_id]
                    WHERE t.[is_ms_shipped]=0 AND t.[type] IN ('U','V')
                    ORDER BY s.[name], t.[name], c.[column_id]
                `);
                schemaRows.push(...schemaResult.recordset);
            } catch (error) {
                console.warn(`Sales report schema skipped for ${database}: ${error.message}`);
            }
        }
        const tables = new Map();
        for (const row of schemaRows) {
            const key = `${row.DatabaseName}.${row.SchemaName}.${row.TableName}`;
            if (!tables.has(key)) tables.set(key, { database: row.DatabaseName, schema: row.SchemaName, table: row.TableName, columns: [] });
            tables.get(key).columns.push({ name: row.ColumnName, type: String(row.DataType).toLowerCase() });
        }
        const datePatterns = ['auftrags-/rg-datum','auftrags_rg_datum','auftragsdatum','auftrags-datum','rgdatum','rg-datum','rechnungsdatum','rechnungs-datum','belegdatum','datum'];
        const personPatterns = ['bearbeiter / abteilung','bearbeiter/abteilung','bearbeiter_abteilung','bearbeiterkÃ¼rzel','bearbeiterkuerzel','bearbeiterkurzel','mitarbeiterkÃ¼rzel','mitarbeiterkuerzel','mitarbeiterkurzel','personalcode','personalkÃ¼rzel','personalkuerzel','personalkurzel','benutzerkÃ¼rzel','benutzerkuerzel','benutzerkurzel','bearbeiter','bearbeiter-id','bearbeiter_id'];
        const amountPatterns = ['rechnungsbetrag','rechnungs-betrag','rechnungs_betrag','in gewÃ¤hlter wÃ¤hrung','gesamtbetrag','bruttobetrag','endbetrag','zahlbetrag','rechnungswert','betrag'];
        const numberPatterns = ['auftrags-nr','auftragsnr','rechnungs-nr','rechnungsnr','quittungs-nr','quittungsnr','belegnr'];
        const numericTypes = new Set(['int','bigint','smallint','tinyint','decimal','numeric','float','real','money','smallmoney']);
        const dateTypes = new Set(['date','datetime','datetime2','smalldatetime','datetimeoffset']);
        const candidates = [...tables.values()].map(item => {
            const date = chooseColumn(item.columns, datePatterns);
            const person = chooseColumn(item.columns, personPatterns);
            const amount = chooseColumn(item.columns.filter(column => numericTypes.has(column.type) && !/fahrleistung|kilometer|kmstand|gewicht|menge|anzahl/.test(column.name.toLowerCase())), amountPatterns);
            const number = chooseColumn(item.columns, numberPatterns);
            const tableName = item.table.toLowerCase();
            let score = (date ? 5 : 0) + (person ? 5 : 0) + (amount ? 5 : 0) + (number ? 1 : 0);
            if (/auftrag|rechnung|quittung|beleg/.test(tableName)) score += 12;
            if (tableName === 'auftrag') score += 100;
            if (/fahrzeug|gebrauchtteil|reifen|lager|kunden|personal|mitarbeiter|benutzer/.test(tableName)) score -= 20;
            if (/detail|position|leistung|artikel/.test(tableName)) score -= 5;
            if (date && dateTypes.has(date.type)) score += 2;
            return { ...item, date, person, amount, number, score };
        }).filter(item => item.date && item.person && item.amount).sort((a, b) => b.score - a.score);
        if (!candidates.length) return reply.status(503).send({ error: 'SatÄ±ÅŸ baÅŸlÄ±k tablosu otomatik olarak bulunamadÄ±.', read_only: true });
        const source = candidates[0];
        const year = Math.min(2100, Math.max(2000, parseInt(request.query.year, 10) || new Date().getFullYear()));
        const month = Math.min(12, Math.max(0, parseInt(request.query.month, 10) || 0));
        const day = month ? Math.min(31, Math.max(0, parseInt(request.query.day, 10) || 0)) : 0;
        const sqlRequest = dbPool.request();
        sqlRequest.input('year', sql.Int, year);
        const monthClause = month ? `AND MONTH(src.SaleDate)=@month ${day ? 'AND DAY(src.SaleDate)=@day' : ''}` : '';
        if (month) sqlRequest.input('month', sql.Int, month);
        if (day) sqlRequest.input('day', sql.Int, day);
        const fullTable = `${quoteSqlName(source.database)}.${quoteSqlName(source.schema)}.${quoteSqlName(source.table)}`;
        const numberSelect = source.number ? `CONVERT(nvarchar(100), ${quoteSqlName(source.number.name)})` : `CAST(NULL AS nvarchar(100))`;
        const cancelledColumn = chooseColumn(source.columns, ['storniert_jn','storniert-jn','storniert']);
        const cancelledSelect = cancelledColumn ? `ISNULL(TRY_CONVERT(int, a.${quoteSqlName(cancelledColumn.name)}), 0)` : '0';
        const unitColumn = chooseColumn(source.columns, ['abteilungsnr','abteilungs-nr','abteilung','arbeitsbereich','filiale']);
        const unitSelect = unitColumn
            ? `COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(100), a.${quoteSqlName(unitColumn.name)}))), N''), N'BelirtilmemiÅŸ')`
            : `N'BelirtilmemiÅŸ'`;
        const bearbeiterTable = [...tables.values()].find(item => item.database === source.database && item.table.toLowerCase() === 'bearbeiter')
            || [...tables.values()].find(item => item.table.toLowerCase() === 'bearbeiter');
        const bearbeiterId = bearbeiterTable && chooseColumn(bearbeiterTable.columns, ['bearbeiter-id','bearbeiter_id']);
        const bearbeiterCode = bearbeiterTable && chooseColumn(bearbeiterTable.columns, ['kÃ¼rzel','kuerzel','kurzel']);
        const bearbeiterName = bearbeiterTable && chooseColumn(bearbeiterTable.columns, ['name']);
        const usesBearbeiterRelation = source.table.toLowerCase() === 'auftrag'
            && /bearbeiter[-_ ]?id/i.test(source.person.name)
            && bearbeiterTable
            && bearbeiterId
            && (bearbeiterCode || bearbeiterName);
        const personExpr = usesBearbeiterRelation
            ? `UPPER(LTRIM(RTRIM(CONVERT(nvarchar(100), b.${quoteSqlName((bearbeiterCode || bearbeiterId).name)}))))`
            : `UPPER(LTRIM(RTRIM(CONVERT(nvarchar(100), a.${quoteSqlName(source.person.name)}))))`;
        const personNameExpr = usesBearbeiterRelation && bearbeiterName
            ? `LTRIM(RTRIM(CONVERT(nvarchar(200), b.${quoteSqlName(bearbeiterName.name)})))`
            : `CAST(NULL AS nvarchar(200))`;
        const relationJoin = usesBearbeiterRelation
            ? `LEFT JOIN ${quoteSqlName(bearbeiterTable.database)}.${quoteSqlName(bearbeiterTable.schema)}.${quoteSqlName(bearbeiterTable.table)} b ON b.${quoteSqlName(bearbeiterId.name)}=a.${quoteSqlName(source.person.name)}`
            : '';
        const data = await sqlRequest.query(`
            WITH src AS (
              SELECT TRY_CONVERT(datetime2, a.${quoteSqlName(source.date.name)}) AS SaleDate,
                     ${personExpr} AS PersonCode,
                     ${personNameExpr} AS PersonName,
                     TRY_CONVERT(decimal(19,2), a.${quoteSqlName(source.amount.name)}) AS Amount,
                     ${numberSelect} AS DocumentNumber,
                     ${cancelledSelect} AS Cancelled,
                     ${unitSelect} AS UnitCode
              FROM ${fullTable} a ${relationJoin}
            )
            SELECT SaleDate, PersonCode, PersonName, Amount, DocumentNumber, Cancelled, UnitCode
            FROM src WHERE SaleDate IS NOT NULL AND PersonCode<>'' AND Amount IS NOT NULL
              AND YEAR(SaleDate)=@year ${monthClause}
            ORDER BY SaleDate;
        `);
        const rows = data.recordset.map(row => {
            const unit = row.UnitCode || '0';
            return { date: row.SaleDate, code: row.PersonCode, name: row.PersonName || null, amount: Number(row.Amount), document: row.DocumentNumber, cancelled: Boolean(row.Cancelled), unit, unit_name: SALES_UNIT_NAMES[unit] || `Birim ${unit}` };
        });
        const personCodes = [...new Set(rows.map(row => row.code).filter(Boolean))];
        const staff = {};
        for (const row of data.recordset) if (row.PersonCode && row.PersonName) staff[row.PersonCode] = row.PersonName;
        if (bearbeiterTable && (bearbeiterCode || bearbeiterId)) {
            const allStaffCode = quoteSqlName((bearbeiterCode || bearbeiterId).name);
            const allStaffName = bearbeiterName ? `LTRIM(RTRIM(CONVERT(nvarchar(200), ${quoteSqlName(bearbeiterName.name)})))` : `N''`;
            try {
                const allStaffRows = await dbPool.request().query(`
                    SELECT UPPER(LTRIM(RTRIM(CONVERT(nvarchar(100), ${allStaffCode})))) AS Code,
                           ${allStaffName} AS FullName
                    FROM ${quoteSqlName(bearbeiterTable.database)}.${quoteSqlName(bearbeiterTable.schema)}.${quoteSqlName(bearbeiterTable.table)}
                    WHERE NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(100), ${allStaffCode}))), N'') IS NOT NULL
                `);
                for (const person of allStaffRows.recordset) if (person.Code) staff[person.Code] = person.FullName || person.Code;
            } catch (error) {
                console.warn(`All staff list could not be read: ${error.message}`);
            }
        }
        if (personCodes.length) {
            const staffCandidates = [...tables.values()].filter(item => /bearbeiter|personal|mitarbeiter|benutzer|user/i.test(item.table)).map(item => ({
                ...item,
                code: chooseColumn(item.columns, ['kÃ¼rzel','kuerzel','kurzel','kurzzeichen','bearbeiter','benutzername','login','code']),
                id: chooseColumn(item.columns, ['bearbeiter-id','bearbeiter_id','personal-id','personal_id','mitarbeiter-id','mitarbeiter_id','benutzer-id','benutzer_id','id']),
                firstName: chooseColumn(item.columns, ['vorname','firstname','first_name']),
                lastName: chooseColumn(item.columns, ['nachname','name1','lastname','last_name','name'])
            })).filter(item => (item.code || item.id) && (item.firstName || item.lastName));
            for (const staffSource of staffCandidates) {
                const staffRequest = dbPool.request();
                personCodes.forEach((code, index) => staffRequest.input(`staff${index}`, sql.NVarChar, code));
                const codeParams = personCodes.map((_, index) => `@staff${index}`).join(',');
                const matchColumn = staffSource.code || staffSource.id;
                const codeSelect = staffSource.code ? `UPPER(LTRIM(RTRIM(CONVERT(nvarchar(100), ${quoteSqlName(staffSource.code.name)}))))` : `UPPER(LTRIM(RTRIM(CONVERT(nvarchar(100), ${quoteSqlName(staffSource.id.name)}))))`;
                const firstSelect = staffSource.firstName ? `CONVERT(nvarchar(150), ${quoteSqlName(staffSource.firstName.name)})` : `N''`;
                const lastSelect = staffSource.lastName ? `CONVERT(nvarchar(150), ${quoteSqlName(staffSource.lastName.name)})` : `N''`;
                try {
                    const staffRows = await staffRequest.query(`SELECT ${codeSelect} AS Code, LTRIM(RTRIM(CONCAT(${firstSelect}, N' ', ${lastSelect}))) AS FullName FROM ${quoteSqlName(staffSource.database)}.${quoteSqlName(staffSource.schema)}.${quoteSqlName(staffSource.table)} WHERE UPPER(LTRIM(RTRIM(CONVERT(nvarchar(100), ${quoteSqlName(matchColumn.name)})))) IN (${codeParams})`);
                    for (const person of staffRows.recordset) if (person.Code && person.FullName) staff[person.Code] = person.FullName;
                    if (Object.keys(staff).length) break;
                } catch (_) {}
            }
            const idStaffCandidates = [...tables.values()].filter(item => /bearbeiter|personal|mitarbeiter|benutzer|user/i.test(item.table)).map(item => ({
                ...item,
                id: chooseColumn(item.columns, ['bearbeiter-id','bearbeiter_id','personal-id','personal_id','mitarbeiter-id','mitarbeiter_id','benutzer-id','benutzer_id','id']),
                code: chooseColumn(item.columns, ['kÃ¼rzel','kuerzel','kurzel','kurzzeichen','bearbeiter','benutzername','login','code']),
                firstName: chooseColumn(item.columns, ['vorname','firstname','first_name']),
                lastName: chooseColumn(item.columns, ['nachname','name1','lastname','last_name','name'])
            })).filter(item => item.id && (item.code || item.firstName || item.lastName));
            for (const staffSource of idStaffCandidates) {
                const unresolvedCodes = personCodes.filter(code => !staff[code]);
                if (!unresolvedCodes.length) break;
                const staffRequest = dbPool.request();
                unresolvedCodes.forEach((code, index) => staffRequest.input(`idStaff${index}`, sql.NVarChar, code));
                const codeParams = unresolvedCodes.map((_, index) => `@idStaff${index}`).join(',');
                const shortSelect = staffSource.code ? `NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(80), ${quoteSqlName(staffSource.code.name)}))), N'')` : `NULL`;
                const firstSelect = staffSource.firstName ? `CONVERT(nvarchar(150), ${quoteSqlName(staffSource.firstName.name)})` : `N''`;
                const lastSelect = staffSource.lastName ? `CONVERT(nvarchar(150), ${quoteSqlName(staffSource.lastName.name)})` : `N''`;
                try {
                    const staffRows = await staffRequest.query(`
                        SELECT UPPER(LTRIM(RTRIM(CONVERT(nvarchar(100), ${quoteSqlName(staffSource.id.name)})))) AS Code,
                               LTRIM(RTRIM(CONCAT(COALESCE(${shortSelect} + N' - ', N''), ${firstSelect}, N' ', ${lastSelect}))) AS FullName
                        FROM ${quoteSqlName(staffSource.database)}.${quoteSqlName(staffSource.schema)}.${quoteSqlName(staffSource.table)}
                        WHERE UPPER(LTRIM(RTRIM(CONVERT(nvarchar(100), ${quoteSqlName(staffSource.id.name)})))) IN (${codeParams})
                    `);
                    for (const person of staffRows.recordset) if (person.Code && person.FullName) staff[person.Code] = person.FullName;
                    if (unresolvedCodes.every(code => staff[code])) break;
                } catch (_) {}
            }
        }
        staff.FER = staff.FER || 'Feras J. Alterek';
        return { read_only: true, year, month, day, source: `${source.database}.${source.schema}.${source.table}`, fields: { date: source.date.name, person: source.person.name, amount: source.amount.name, unit: unitColumn ? unitColumn.name : null }, units: SALES_UNIT_NAMES, staff, rows };
    } catch (err) {
        reply.status(500).send({ error: err.message, read_only: true });
    }
});

// Read-only deep invoice details for the sales reports.
fastify.get('/api/sales-report/invoice/:document', { preHandler: requireAnyReportSession }, async (request, reply) => {
    try {
        const document = String(request.params.document || '').trim();
        if (!document || document.length > 100) return reply.status(400).send({ error: 'GeÃ§ersiz fatura numarasÄ±.', read_only: true });
        const reportDatabases = String(process.env.WORK_REPORT_DB_DATABASES || 'BaytemÃ¼r').split(',').map(value => value.trim()).filter(Boolean);
        const database = reportDatabases.find(value => value.toLocaleLowerCase('tr-TR') === 'baytemÃ¼r') || reportDatabases[0];
        const dbPool = await getDbPool();
        const result = await dbPool.request().input('document', sql.NVarChar(100), document).query(`
            SELECT TOP 1
              [Auftrag_ID] AS OrderId, [Auftrags-Rechnungs-Nr] AS OrderInvoiceNumber,
              [Rechnungsnummer] AS InvoiceNumber, [Quittungsnummer] AS ReceiptNumber,
              [Auftragsdatum] AS OrderDate, [Rechnungsdatum] AS InvoiceDate,
              [Lieferdatum] AS DeliveryDate, [Zahlungsdatum] AS PaymentDate,
              [Kundennummer] AS CustomerNumber, [Kundenart] AS CustomerType,
              [Auftraggeber_Anrede] AS Salutation, [Auftraggeber_Vorname] AS FirstName,
              [Auftraggeber_Name1] AS Name1, [Auftraggeber_Name2] AS Name2,
              [Auftraggeber_Strasse] AS Street, [Auftraggeber_LKZ] AS Country,
              [Auftraggeber_PLZ] AS PostalCode, [Auftraggeber_Ort] AS City,
              [Auftraggeber_Telefon] AS Phone, [Auftraggeber_Telefax] AS Fax,
              [Fahrzeug-Marke/Typ] AS VehicleMakeType, [Fahrzeug-Marke] AS VehicleMake,
              [Fahrzeug-PolKennzeichen] AS LicensePlate, [Fahrgestellnummer] AS Vin,
              [KBA_Nummer] AS Kba, [Erstzul] AS FirstRegistration, [Kilometer] AS Mileage,
              [Farbe] AS Color, [Hubraum] AS Displacement, [KW] AS Kw, [PS] AS Ps,
              [Nettobetrag] AS NetAmount, [Netto_ATeile] AS NetUsedParts,
              [Netto_Teile] AS NetParts, [MwSt_Betrag] AS VatAmount,
              [MWST_SATZ_VORGANG] AS VatRate, [Rechnungsbetrag] AS GrossAmount,
              [Zwischensumme] AS Subtotal, [Rabattsatz] AS DiscountRate,
              [Rabatt_DM] AS DiscountAmount, [Zusatzrabatt] AS ExtraDiscount,
              [Anzahlungsbetrag] AS DepositAmount, [Skonto] AS CashDiscountRate,
              [Skontobetrag] AS CashDiscountAmount, [BetragOffen] AS OpenAmount,
              [Restforderung] AS RemainingClaim, [GebÃ¼hren] AS Fees,
              [Versicherung_Betrag] AS InsuranceAmount, [WÃ¤hrungID] AS CurrencyId,
              [WÃ¤hrung_Kurs] AS CurrencyRate, [Barverkauf] AS CashSale,
              [Barzahlung] AS CashPayment, [Scheck] AS ChequePayment,
              [Zahlungsziel] AS PaymentTerms, [Zahlungszieldatum] AS PaymentDueDate,
              [Zahlungsvermerk] AS PaymentNote, [Ausgeliefert] AS Delivered,
              [Storniert_JN] AS Cancelled, [Auftragsart] AS OrderType,
              [Auftragsbeschr] AS Description, [Bemerkung] AS Note,
              [Bemerkung_Intern] AS InternalNote, [Transportart] AS TransportType,
              [Einsatzort] AS OperationLocation, [Bestimmungsort] AS Destination,
              [GebietBetrag] AS AreaAmount, [HilfeBetrag] AS AssistanceAmount,
              [km a] AS KmQuantity, [kmBetrag] AS KmAmount,
              [Bergung STD] AS RecoveryHours, [BergungBetrag] AS RecoveryAmount,
              [Zusatzpersonal Std] AS ExtraStaffHours, [Zusatzpersonal Betrag] AS ExtraStaffAmount,
              [Sonstiges_Anz] AS OtherQuantity, [Sonstiges Text] AS OtherText,
              [Sonstiges Betrag] AS OtherAmount, [ZuschlÃ¤ge_Anz] AS SurchargeQuantity,
              [ZuschlÃ¤ge Text] AS SurchargeText, [ZuschlÃ¤ge Betrag] AS SurchargeAmount,
              [Sicherung Tage] AS StorageDays, [Sicherung Betrag] AS StorageAmount,
              [Ersatzteile_Anz] AS PartQuantity, [Ersatzteile Text] AS PartText,
              [Ersatzteile Betrag] AS PartAmount, [Stadt_Anz] AS CityQuantity,
              [Stadt_Betrag] AS CityAmount, [Schlepp_km] AS TowingKm,
              [Schlepp_Betrag] AS TowingAmount, [Tel] AS TelephoneAmount,
              [Kraftstoff] AS FuelAmount
            FROM ${quoteSqlName(database)}.[dbo].[Auftrag]
            WHERE CONVERT(nvarchar(100), [Auftrags-Rechnungs-Nr])=@document
               OR CONVERT(nvarchar(100), [Rechnungsnummer])=@document
               OR CONVERT(nvarchar(100), [Quittungsnummer])=@document
            ORDER BY [Auftragsdatum] DESC
        `);
        if (!result.recordset.length) return reply.status(404).send({ error: 'Fatura ayrÄ±ntÄ±sÄ± bulunamadÄ±.', read_only: true });
        let items = [];
        try {
            const detailDatabase = reportDatabases.find(value => value.toLocaleLowerCase('tr-TR') === 'baytemÃ¼rii') || 'BaytemÃ¼rII';
            const itemResult = await dbPool.request().input('document', sql.NVarChar(100), document).query(`
                SELECT * FROM (
                  SELECT N'Genel' AS ItemType, [Position] AS Position,
                         CAST(NULL AS nvarchar(100)) AS ArticleNumber,
                         CONVERT(nvarchar(max), [LeistBeschreibung]) AS Description,
                         TRY_CONVERT(decimal(19,3), [Menge]) AS Quantity,
                         TRY_CONVERT(decimal(19,2), [Preis]) AS UnitPrice,
                         TRY_CONVERT(decimal(19,2), [Rabatt]) AS Discount,
                         TRY_CONVERT(decimal(19,2), [Gesamtpreis]) AS TotalPrice,
                         CONVERT(nvarchar(max), [Bemerkung]) AS Note,
                         CAST(NULL AS nvarchar(100)) AS VehicleNumber,
                         CAST(NULL AS nvarchar(100)) AS EbayNumber, 1 AS SortOrder
                  FROM ${quoteSqlName(detailDatabase)}.[dbo].[Leistung]
                  WHERE CONVERT(nvarchar(100), [Auftrags-Rechnungs-Nr])=@document
                  UNION ALL
                  SELECT N'ParÃ§a' AS ItemType, [Position], CONVERT(nvarchar(100), [Artikelnummer]),
                         CONVERT(nvarchar(max), [LeistBeschreibung]), TRY_CONVERT(decimal(19,3), [Menge]),
                         TRY_CONVERT(decimal(19,2), COALESCE(NULLIF([FW_Preis],0), [Preis])),
                         CAST(NULL AS decimal(19,2)),
                         TRY_CONVERT(decimal(19,2), COALESCE(NULLIF([FW_Gesamtpreis],0), [Gesamtpreis])),
                         CONVERT(nvarchar(max), [Bemerkung]), CONVERT(nvarchar(100), [Fahrzeugnummer]),
                         CONVERT(nvarchar(100), [Ebayartikelnummer]), 2 AS SortOrder
                  FROM ${quoteSqlName(detailDatabase)}.[dbo].[LeistungBarverkauf]
                  WHERE CONVERT(nvarchar(100), [Auftrags-Rechnungs-Nr])=@document
                  UNION ALL
                  SELECT N'AtÃ¶lye' AS ItemType, [Position], CONVERT(nvarchar(100), [EAN]),
                         CONVERT(nvarchar(max), [LeistBeschreibung]), TRY_CONVERT(decimal(19,3), [Menge]),
                         TRY_CONVERT(decimal(19,2), COALESCE(NULLIF([FW_Preis],0), [Preis])),
                         TRY_CONVERT(decimal(19,2), [Zuschlag]),
                         TRY_CONVERT(decimal(19,2), COALESCE(NULLIF([FW_Gesamtpreis],0), [Gesamtpreis])),
                         CONVERT(nvarchar(max), [Bemerkung]), CAST(NULL AS nvarchar(100)),
                         CAST(NULL AS nvarchar(100)), 3 AS SortOrder
                  FROM ${quoteSqlName(detailDatabase)}.[dbo].[LeistungWerk]
                  WHERE CONVERT(nvarchar(100), [Auftrags-Rechnungs-Nr])=@document
                ) invoiceItems ORDER BY SortOrder, Position
            `);
            items = itemResult.recordset.map(item => ({
                type: item.ItemType, position: item.Position, article: item.ArticleNumber,
                description: item.Description, quantity: Number(item.Quantity), unit_price: Number(item.UnitPrice),
                discount: item.Discount === null ? null : Number(item.Discount), total: Number(item.TotalPrice),
                note: item.Note, vehicle: item.VehicleNumber, ebay: item.EbayNumber
            }));
        } catch (error) {
            console.warn(`Invoice items could not be read for ${document}: ${error.message}`);
        }
        return { read_only: true, document, source: `${database}.dbo.Auftrag`, invoice: result.recordset[0], items };
    } catch (err) {
        reply.status(500).send({ error: err.message, read_only: true });
    }
});

// Read-only vehicle sales invoice search. Hidden report page: /rapor/auto
fastify.get('/api/auto-invoices', { preHandler: requireReportApiSession }, async (request, reply) => {
    try {
        const query = String(request.query.q || '').trim();
        if (!query) return { read_only: true, source: 'BaytemÃ¼rII.dbo.FH_Verkauf', rows: [] };
        if (query.length > 120) return reply.status(400).send({ error: 'Arama metni Ã§ok uzun.', read_only: true });

        const dbPool = await getDbPool();
        const like = `%${query}%`;
        const result = await dbPool.request()
            .input('query', sql.NVarChar(120), query)
            .input('like', sql.NVarChar(140), like)
            .query(`
                SELECT TOP 50
                  v.[VerkaufID] AS SaleId,
                  v.[ID] AS VehicleIdRef,
                  v.[Datum] AS SaleDate,
                  v.[Lieferdatum] AS DeliveryDate,
                  CONVERT(nvarchar(100), v.[Rechnungsnummer]) AS InvoiceNumber,
                  v.[Kundennummer] AS CustomerNumber,
                  v.[Kundenart] AS CustomerType,
                  v.[Anrede] AS Salutation,
                  v.[Vorname] AS FirstName,
                  v.[Name] AS LastName,
                  v.[Strasse] AS Street,
                  v.[PLZ] AS PostalCode,
                  v.[Ort] AS City,
                  v.[Telefon] AS Phone,
                  TRY_CONVERT(decimal(19,2), COALESCE(NULLIF(v.[Preis], 0), v.[Verkaufspreis])) AS Price,
                  TRY_CONVERT(decimal(19,2), v.[Anzahlung]) AS Deposit,
                  TRY_CONVERT(decimal(19,2), v.[Restzahlung]) AS RemainingPayment,
                  TRY_CONVERT(decimal(19,2), v.[Zwischenbetrag]) AS Subtotal,
                  v.[Mwst] AS VatAmount,
                  v.[MWST_SATZ_VORGANG] AS VatRate,
                  v.[Zahlungstext] AS PaymentText,
                  v.[Verkaufstext] AS SaleText,
                  f.[Fahrzeug-ID] AS VehicleId,
                  CONVERT(nvarchar(100), f.[Fahrzeug_Nummer]) AS VehicleNumber,
                  f.[Marke] AS Brand,
                  f.[Modell] AS Model,
                  f.[Marke/Typ] AS VehicleType,
                  f.[Fahrgestellnummer] AS Vin,
                  f.[letztKennzeichen] AS LicensePlate,
                  f.[Erstzulassung] AS FirstRegistration,
                  f.[Baujahr] AS BuildYear,
                  f.[kmStand] AS Mileage,
                  f.[Farbe] AS Color,
                  f.[KBA_Nummer] AS Kba,
                  f.[Motorcode] AS EngineCode,
                  f.[Getriebecode] AS GearboxCode
                FROM ${quoteSqlName(getDbConfig().database)}.[dbo].[FH_Verkauf] v
                LEFT JOIN ${quoteSqlName(getDbConfig().database)}.[dbo].[Fahrzeughandel] f
                  ON f.[Fahrzeug-ID]=TRY_CONVERT(int, v.[ID])
                WHERE CONVERT(nvarchar(100), v.[Rechnungsnummer])=@query
                   OR (
                     NOT EXISTS (
                       SELECT 1 FROM ${quoteSqlName(getDbConfig().database)}.[dbo].[FH_Verkauf] exactInvoice
                       WHERE CONVERT(nvarchar(100), exactInvoice.[Rechnungsnummer])=@query
                     )
                     AND (
                       CONVERT(nvarchar(100), v.[VerkaufID])=@query
                       OR CONVERT(nvarchar(100), v.[ID])=@query
                       OR CONVERT(nvarchar(100), f.[Fahrzeug_Nummer])=@query
                       OR LOWER(CONCAT(v.[Vorname], N' ', v.[Name])) LIKE LOWER(@like)
                       OR LOWER(CONCAT(v.[Name], N' ', v.[Vorname])) LIKE LOWER(@like)
                       OR LOWER(CONVERT(nvarchar(200), f.[Fahrgestellnummer])) LIKE LOWER(@like)
                       OR LOWER(CONVERT(nvarchar(200), f.[letztKennzeichen])) LIKE LOWER(@like)
                       OR LOWER(CONCAT(f.[Marke], N' ', f.[Modell], N' ', f.[Marke/Typ])) LIKE LOWER(@like)
                     )
                   )
                ORDER BY
                  CASE WHEN CONVERT(nvarchar(100), v.[Rechnungsnummer])=@query THEN 0 ELSE 1 END,
                  v.[Datum] DESC,
                  v.[VerkaufID] DESC
            `);

        const rows = result.recordset.map(row => ({
            sale_id: row.SaleId,
            vehicle_ref: row.VehicleIdRef,
            invoice_number: row.InvoiceNumber,
            sale_date: row.SaleDate,
            delivery_date: row.DeliveryDate,
            customer_number: row.CustomerNumber,
            customer_type: row.CustomerType,
            salutation: row.Salutation,
            first_name: row.FirstName,
            last_name: row.LastName,
            street: row.Street,
            postal_code: row.PostalCode,
            city: row.City,
            phone: row.Phone,
            price: row.Price === null ? null : Number(row.Price),
            deposit: row.Deposit === null ? null : Number(row.Deposit),
            remaining_payment: row.RemainingPayment === null ? null : Number(row.RemainingPayment),
            subtotal: row.Subtotal === null ? null : Number(row.Subtotal),
            vat_amount: row.VatAmount === null ? null : Number(row.VatAmount),
            vat_rate: row.VatRate === null ? null : Number(row.VatRate),
            payment_text: row.PaymentText,
            sale_text: row.SaleText,
            vehicle_id: row.VehicleId,
            vehicle_number: row.VehicleNumber,
            brand: row.Brand,
            model: row.Model,
            vehicle_type: row.VehicleType,
            vin: row.Vin,
            license_plate: row.LicensePlate,
            first_registration: row.FirstRegistration,
            build_year: row.BuildYear,
            mileage: row.Mileage,
            color: row.Color,
            kba: row.Kba,
            engine_code: row.EngineCode,
            gearbox_code: row.GearboxCode
        }));
        return { read_only: true, source: `${getDbConfig().database}.dbo.FH_Verkauf`, rows };
    } catch (err) {
        reply.status(500).send({ error: err.message, read_only: true });
    }
});

// /api/units
fastify.get('/api/units', async (request, reply) => {
    try {
        const dbPool = await getDbPool();
        const result = await dbPool.query(`
            SELECT [EbayMarkiertVonAbteilung] AS id, COUNT_BIG(*) AS count
            FROM dbo.Gebrauchtteile
            WHERE NULLIF(LTRIM(RTRIM([EbayMarkiertVonAbteilung])), '') IS NOT NULL
            GROUP BY [EbayMarkiertVonAbteilung]
            ORDER BY COUNT_BIG(*) DESC
        `);
        const list = result.recordset.map(row => ({
            id: String(row.id).trim(),
            count: parseInt(row.count, 10)
        }));
        return list;
    } catch (err) {
        reply.status(500).send({ error: err.message });
    }
});

// /api/suggestions
fastify.get('/api/suggestions', async (request, reply) => {
    try {
        const dbPool = await getDbPool();
        const query = request.query;
        const field = query.field || '';
        const column = SEARCH_FIELDS[field];
        if (!column) return [];

        const q = query.q || '';
        const unit = query.unit || '';

        const dbReq = dbPool.request();
        const clauses = [`[${column}] IS NOT NULL`, `LTRIM(RTRIM([${column}])) <> ''`];

        if (q) {
            clauses.push(`[${column}] LIKE @q`);
            dbReq.input('q', sql.NVarChar, `%${q}%`);
        }
        if (unit) {
            clauses.push(`[EbayMarkiertVonAbteilung] = @unit`);
            dbReq.input('unit', sql.NVarChar, unit);
        }

        const where = clauses.join(' AND ');
        const sqlStr = `SELECT TOP 20 [${column}] AS val FROM dbo.Gebrauchtteile WHERE ${where} GROUP BY [${column}] ORDER BY [${column}]`;
        
        const result = await dbReq.query(sqlStr);
        return result.recordset.map(row => String(row.val).trim());
    } catch (err) {
        reply.status(500).send({ error: err.message });
    }
});

// /api/search
fastify.get('/api/search', async (request, reply) => {
    try {
        const dbPool = await getDbPool();
        const query = request.query;
        
        const clauses = [];
        const dbReq = dbPool.request();
        let paramCount = 0;

        const addParam = (value, type = sql.NVarChar) => {
            const name = `p${paramCount++}`;
            dbReq.input(name, type, value);
            return `@${name}`;
        };

        const part_number = normalizePartSearchValue(query.part_number);
        if (part_number) {
            const compactParam = addParam(`%${part_number}%`);
            clauses.push(`(
                ${normalizedSqlText('g.[Zusatztext]')} LIKE ${compactParam}
                OR ${normalizedSqlText('g.[Artikelnummer]')} LIKE ${compactParam}
                OR ${normalizedSqlText('g.[ArtikelNr]')} LIKE ${compactParam}
            )`);
        }

        for (const [key, column] of Object.entries(SEARCH_FIELDS)) {
            let val = query[key];
            if (val) {
                if (val.includes('*')) {
                    val = val.replace(/\*/g, '%');
                    clauses.push(`g.[${column}] LIKE ${addParam(val)}`);
                } else {
                    clauses.push(`g.[${column}] LIKE ${addParam(`%${val}%`)}`);
                }
            }
        }

        const in_stock = query.in_stock !== '0';
        if (in_stock) {
            clauses.push(`ISNULL(g.[Lagermenge], 0) > 0`);
        }

        const unit = query.unit || '';
        if (unit) {
            clauses.push(`g.[EbayMarkiertVonAbteilung] = ${addParam(unit)}`);
        }

        const where = clauses.length > 0 ? clauses.join(' AND ') : '1=1';

        let page_size = parseInt(query.limit, 10) || 50;
        if (![50, 100, 200, 500].includes(page_size)) page_size = 50;

        let page = parseInt(query.page, 10) || 1;
        if (page < 1) page = 1;

        const sort_key = query.sort || 'newest';
        const sort_column = SORT_FIELDS[sort_key] || SORT_FIELDS['newest'];
        const sort_dir = String(query.dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        
        const order_by = sort_key === 'newest' 
            ? `${sort_column} ${sort_dir}` 
            : `${sort_column} ${sort_dir}, g.[Fahrzeug-ID] DESC`;

        const offset = (page - 1) * page_size;
        const select = SELECT_COLUMNS.map(name => `g.[${name}]`).join(', ');

        // Multiple query batch execution for speed (reduces network roundtrips)
        const batchSql = `
            SELECT COUNT_BIG(*) AS total FROM dbo.Gebrauchtteile g WHERE ${where};
            
            SELECT ${select}, pic.MainPictureID, pic.ImageCount
            FROM dbo.Gebrauchtteile g
            OUTER APPLY (
                SELECT TOP 1 p.Picture_ID AS MainPictureID, COUNT(*) OVER() AS ImageCount
                FROM dbo.GT_Picture p
                WHERE p.Teile_ID=g.[Fahrzeug-ID]
                  AND (NULLIF(LTRIM(RTRIM(p.Teile_Picture_File)), '') IS NOT NULL OR DATALENGTH(p.Teile_Picture)>0)
                ORDER BY CASE WHEN p.Hauptbild_JN<>0 THEN 0 ELSE 1 END, p.Picture_ID
            ) pic
            WHERE ${where}
            ORDER BY ${order_by}
            OFFSET ${offset} ROWS FETCH NEXT ${page_size} ROWS ONLY;
        `;

        const result = await dbReq.query(batchSql);
        const total = parseInt(result.recordsets[0][0].total, 10);
        const rawRows = result.recordsets[1];
        const rows = rawRows.map(formatRow);
        const pages = Math.max(1, Math.ceil(total / page_size));

        return {
            rows,
            count: total,
            shown: rows.length,
            page,
            pages,
            page_size,
            sort: sort_key,
            dir: sort_dir.toLowerCase()
        };
    } catch (err) {
        console.error(err);
        reply.status(500).send({ error: err.message });
    }
});

// Eski araÃ§-parÃ§a eÅŸleme sorgusu; uyumluluk iÃ§in tutulur, arayÃ¼z bunu kullanmaz.
fastify.get('/api/vehicles-legacy', async (request, reply) => {
    try {
        const dbPool = await getDbPool();
        const query = request.query;
        const dbReq = dbPool.request();
        const vinRequested = String(query.vin || '').trim();
        const vinSchema = await dbPool.request().query(`
            SELECT CASE WHEN OBJECT_ID('dbo.MSYSFH_Angebote') IS NOT NULL
              AND COL_LENGTH('dbo.MSYSFH_Angebote', 'Fahrgestellnummer') IS NOT NULL
              AND COL_LENGTH('dbo.MSYSFH_Angebote', 'KfzNummer') IS NOT NULL THEN 1 ELSE 0 END AS available
        `);
        const hasVinSource = vinSchema.recordset[0].available === 1;
        if (vinRequested && !hasVinSource) return { rows: [], total: 0, page: 1, pages: 1 };
        if (vinRequested && hasVinSource) {
            const page = Math.max(1, parseInt(query.page, 10) || 1);
            const limit = 50;
            const offset = (page - 1) * limit;
            // BaÅŸtaki/sondaki * SQL LIKE joker karakterine Ã§evrilir; Ã¶rn. *97235 = 97235 ile biten VIN.
            const vinPattern = vinRequested.includes('*') ? vinRequested.replace(/\*/g, '%') : `%${vinRequested}%`;
            const vinRequest = dbPool.request();
            vinRequest.input('vin', sql.NVarChar, vinPattern);
            const vinResult = await vinRequest.query(`
                SELECT COUNT_BIG(*) AS total
                FROM dbo.MSYSFH_Angebote
                WHERE [Fahrgestellnummer] LIKE @vin;

                SELECT
                    CONVERT(nvarchar(100), [KfzNummer]) AS [FahrzeugNummer],
                    [Hersteller] AS [Marke], [Modellreihe] AS [Modellcode], [Typ],
                    CAST(NULL AS nvarchar(100)) AS [Motorcode], [KBANummer] AS [KBA_Nummer],
                    CAST(NULL AS nvarchar(30)) AS [Baujahr], CAST(NULL AS datetime) AS [Erstzulassung],
                    [Laufleistung] AS [Kilometer], [Motorart] AS [Kraftstoff],
                    CAST(NULL AS nvarchar(100)) AS [Farbe], CAST(NULL AS nvarchar(100)) AS [Status],
                    CAST(NULL AS nvarchar(100)) AS [Getriebecode], CAST(NULL AS nvarchar(100)) AS [Getriebeart],
                    CAST(NULL AS nvarchar(100)) AS [Hubraum], CAST(NULL AS nvarchar(100)) AS [Zylinder],
                    CAST(NULL AS nvarchar(100)) AS [Euro_Norm], [Fahrgestellnummer] AS [VIN]
                FROM dbo.MSYSFH_Angebote
                WHERE [Fahrgestellnummer] LIKE @vin
                ORDER BY [AngebotID] DESC
                OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY;
            `);
            const total = parseInt(vinResult.recordsets[0][0].total, 10);
            return { rows: vinResult.recordsets[1].map(formatRow), total, page, pages: Math.max(1, Math.ceil(total / limit)) };
        }
        const vinApply = hasVinSource ? `OUTER APPLY (
            SELECT TOP 1 fa.[Fahrgestellnummer]
            FROM dbo.MSYSFH_Angebote fa
            WHERE CONVERT(nvarchar(100), fa.[KfzNummer])=CONVERT(nvarchar(100), g.[FahrzeugNummer])
              AND NULLIF(LTRIM(RTRIM(fa.[Fahrgestellnummer])), '') IS NOT NULL
            ORDER BY fa.[AngebotID] DESC
        ) vin` : '';
        const clauses = ["NULLIF(LTRIM(RTRIM(g.[FahrzeugNummer])), '') IS NOT NULL"];
        const fields = {
            number: 'FahrzeugNummer', brand: 'Marke', model: 'Modellcode', type: 'Typ',
            engine: 'Motorcode', kba: 'KBA_Nummer', status: 'Status'
        };
        let index = 0;
        for (const [key, column] of Object.entries(fields)) {
            const value = String(query[key] || '').trim();
            if (!value) continue;
            const name = `v${index++}`;
            dbReq.input(name, sql.NVarChar, `%${value.replace(/\*/g, '%')}%`);
            clauses.push(`g.[${column}] LIKE @${name}`);
        }
        if (vinRequested) {
            dbReq.input('vin', sql.NVarChar, `%${vinRequested.replace(/\*/g, '%')}%`);
            clauses.push('vin.[Fahrgestellnummer] LIKE @vin');
        }
        const where = clauses.join(' AND ');
        const page = Math.max(1, parseInt(query.page, 10) || 1);
        const limit = 50;
        const offset = (page - 1) * limit;
        const columns = ['FahrzeugNummer','Marke','Modellcode','Typ','Motorcode','KBA_Nummer','Baujahr','Erstzulassung','Kilometer','Kraftstoff','Farbe','Status','Getriebecode','Getriebeart','Hubraum','Zylinder','Euro_Norm'];
        const baseSelect = columns.map(column => `g.[${column}]`).join(', ');
        const resultSelect = columns.map(column => `[${column}]`).join(', ');
        const vinSelect = hasVinSource ? ', vin.[Fahrgestellnummer] AS [VIN]' : ', CAST(NULL AS nvarchar(100)) AS [VIN]';
        const result = await dbReq.query(`
            WITH vehicles AS (
                SELECT ${baseSelect}${vinSelect}, ROW_NUMBER() OVER (PARTITION BY g.[FahrzeugNummer] ORDER BY g.[Fahrzeug-ID] DESC) AS rn
                FROM dbo.Gebrauchtteile g ${vinApply} WHERE ${where}
            )
            SELECT COUNT_BIG(*) AS total FROM vehicles WHERE rn=1;
            WITH vehicles AS (
                SELECT ${baseSelect}${vinSelect}, ROW_NUMBER() OVER (PARTITION BY g.[FahrzeugNummer] ORDER BY g.[Fahrzeug-ID] DESC) AS rn
                FROM dbo.Gebrauchtteile g ${vinApply} WHERE ${where}
            )
            SELECT ${resultSelect}, [VIN] FROM vehicles WHERE rn=1 ORDER BY [FahrzeugNummer] DESC
            OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY;
        `);
        const total = parseInt(result.recordsets[0][0].total, 10);
        return { rows: result.recordsets[1].map(formatRow), total, page, pages: Math.max(1, Math.ceil(total / limit)), holder_source: holderColumn || null };
    } catch (err) {
        console.error(err);
        reply.status(500).send({ error: err.message });
    }
});

// AraÃ§ formu iÃ§in baÄŸlama duyarlÄ±, tekil akÄ±llÄ± Ã¶neriler.
fastify.get('/api/vehicle-suggestions', async (request, reply) => {
    try {
        const dbPool = await getDbPool();
        const query = request.query;
        const fields = {
            number: 'Fahrzeug_Nummer', vin: 'Fahrgestellnummer', brand: 'Marke',
            model: 'Modell', type: 'Marke/Typ', engine: 'Motorcode', kba: 'KBA_Nummer'
        };
        const field = String(query.field || '');
        const column = fields[field];
        if (!column) return [];

        const dbReq = dbPool.request();
        const clauses = [`f.[${column}] IS NOT NULL`, `LTRIM(RTRIM(CONVERT(nvarchar(255), f.[${column}])) ) <> ''`];
        let index = 0;
        for (const [key, contextColumn] of Object.entries(fields)) {
            if (key === field) continue;
            const value = String(query[key] || '').trim();
            if (!value) continue;
            const parameter = `c${index++}`;
            dbReq.input(parameter, sql.NVarChar, `%${value.replace(/\*/g, '%')}%`);
            clauses.push(`CONVERT(nvarchar(255), f.[${contextColumn}]) LIKE @${parameter}`);
        }
        const status = String(query.status || '').trim();
        if (status) {
            dbReq.input('suggestStatus', sql.Int, parseInt(status, 10));
            clauses.push('f.[StatusID] = @suggestStatus');
        }
        const q = String(query.q || '').trim();
        if (q) {
            dbReq.input('suggestQ', sql.NVarChar, `%${q.replace(/\*/g, '%')}%`);
            dbReq.input('suggestPrefix', sql.NVarChar, `${q.replace(/\*/g, '%')}%`);
            clauses.push(`CONVERT(nvarchar(255), f.[${column}]) LIKE @suggestQ`);
        }
        const order = q ? `CASE WHEN CONVERT(nvarchar(255), f.[${column}]) LIKE @suggestPrefix THEN 0 ELSE 1 END, val` : 'val';
        const suggestionLimit = Math.min(500, Math.max(1, parseInt(query.limit, 10) || 20));
        const result = await dbReq.query(`
            SELECT TOP ${suggestionLimit} LTRIM(RTRIM(CONVERT(nvarchar(255), f.[${column}]))) AS val
            FROM dbo.Fahrzeughandel f
            WHERE ${clauses.join(' AND ')}
            GROUP BY f.[${column}]
            ORDER BY ${order}
        `);
        return result.recordset.map(row => row.val);
    } catch (err) {
        console.error(err);
        reply.status(500).send({ error: err.message });
    }
});

// Ana Fahrzeughandel tablosundan salt okunur araÃ§ sorgusu.
fastify.get('/api/vehicles', async (request, reply) => {
    try {
        const dbPool = await getDbPool();
        const query = request.query;
        const dbReq = dbPool.request();
        const clauses = [];
        const fields = {
            number: '[Fahrzeug_Nummer]', vin: '[Fahrgestellnummer]', brand: '[Marke]',
            model: '[Modell]', type: '[Marke/Typ]', engine: '[Motorcode]', kba: '[KBA_Nummer]'
        };
        let paramIndex = 0;
        for (const [key, column] of Object.entries(fields)) {
            const raw = String(query[key] || '').trim();
            if (!raw) continue;
            const parameter = `f${paramIndex++}`;
            const pattern = raw.includes('*') ? raw.replace(/\*/g, '%') : `%${raw}%`;
            dbReq.input(parameter, sql.NVarChar, pattern);
            clauses.push(`${column} LIKE @${parameter}`);
        }
        const status = String(query.status || '').trim();
        if (status) {
            dbReq.input('status', sql.NVarChar, `%${status.replace(/\*/g, '%')}%`);
            clauses.push(`(CONVERT(nvarchar(30), f.[StatusID]) LIKE @status OR s.[Bezeichnung_Kunde] LIKE @status OR s.[Bezeichnung_AOL] LIKE @status)`);
        }
        const where = clauses.length ? clauses.join(' AND ') : '1=1';
        const page = Math.max(1, parseInt(query.page, 10) || 1);
        const limit = 50;
        const offset = (page - 1) * limit;
        const vehicleSchema = await dbPool.request().query(`
            SELECT [name] AS ColumnName
            FROM sys.columns
            WHERE [object_id] = OBJECT_ID('dbo.Fahrzeughandel')
            ORDER BY [column_id]
        `);
        const vehicleColumnNames = vehicleSchema.recordset.map(row => row.ColumnName);
        const holderColumn = findColumnName(vehicleColumnNames, ['Halter', 'AnzahlHalter', 'HalterAnzahl']);
        const holderSelect = holderColumn ? `f.[${String(holderColumn).replace(/]/g, ']]')}] AS [AnzahlHalter]` : `CAST(NULL AS nvarchar(30)) AS [AnzahlHalter]`;
        const sellerSelects = [
            optionalColumnSelect(vehicleColumnNames, ['Kundenart'], 'SellerType'),
            optionalColumnSelect(vehicleColumnNames, ['Verkaeufer_Vorname', 'Verkaufer_Vorname'], 'SellerFirstName'),
            optionalColumnSelect(vehicleColumnNames, ['Verkaeufer_Name1', 'Verkaufer_Name1'], 'SellerName1'),
            optionalColumnSelect(vehicleColumnNames, ['Verkaeufer_Name2', 'Verkaufer_Name2'], 'SellerName2'),
            optionalColumnSelect(vehicleColumnNames, ['Verkaeufer_Strasse', 'Verkaufer_Strasse'], 'SellerStreet'),
            optionalColumnSelect(vehicleColumnNames, ['Verkaeufer_PLZ', 'Verkaufer_PLZ'], 'SellerPostalCode'),
            optionalColumnSelect(vehicleColumnNames, ['Verkaeufer_PLZ_Ort', 'Verkaufer_PLZ_Ort'], 'SellerCity'),
            optionalColumnSelect(vehicleColumnNames, ['Verkaeufer_Telefon', 'Verkaufer_Telefon'], 'SellerPhone'),
            optionalColumnSelect(vehicleColumnNames, ['Verkaeufer_Telefax', 'Verkaufer_Telefax'], 'SellerFax'),
            optionalColumnSelect(vehicleColumnNames, ['Verkaeufer_Geburtstag', 'Verkaufer_Geburtstag'], 'SellerBirthDate'),
            optionalColumnSelect(vehicleColumnNames, ['Staatsangehoerigkeit', 'Staatsangehorigkeit'], 'SellerNationality'),
            optionalColumnSelect(vehicleColumnNames, ['AusweisNr'], 'SellerDocument')
        ].join(',\n                ');
        const result = await dbReq.query(`
            SELECT COUNT_BIG(*) AS total FROM dbo.Fahrzeughandel f
            LEFT JOIN dbo.FH_Status s ON s.[Status_ID]=f.[StatusID] WHERE ${where};
            SELECT
                [Fahrzeug-ID] AS [FahrzeugID], [Fahrzeug_Nummer] AS [FahrzeugNummer],
                [Fahrgestellnummer] AS [VIN], [Marke], [Modell] AS [Modellcode], [Marke/Typ] AS [Typ],
                [Motorcode], [KBA_Nummer], [Baujahr], [Erstzulassung],
                COALESCE(NULLIF(CONVERT(nvarchar(100), [kmStand]), ''), CONVERT(nvarchar(100), [Gesamtfahrleistung])) AS [Kilometer],
                [Kraftstoffbezeichnung] AS [Kraftstoff], [Farbe], f.[StatusID] AS [StatusCode],
                COALESCE(s.[Bezeichnung_Kunde], s.[Bezeichnung_AOL], CONVERT(nvarchar(30), f.[StatusID])) AS [Status],
                [Getriebecode], [Getriebe] AS [Getriebeart], [Hubraum], [Zylinder],
                CAST(NULL AS nvarchar(100)) AS [Euro_Norm], [Kfz-Briefnr] AS [FZGBrief],
                [letztKennzeichen], [VW_Nr], [Gewicht],
                [Transporteur], [Annahmestelle], [Gekauft], [Annahmenotiz_neu], ${holderSelect}
                , ${sellerSelects}
            FROM dbo.Fahrzeughandel f
            LEFT JOIN dbo.FH_Status s ON s.[Status_ID]=f.[StatusID]
            WHERE ${where}
            ORDER BY f.[Fahrzeug-ID] DESC
            OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY;
        `);
        const total = parseInt(result.recordsets[0][0].total, 10);
        return { rows: result.recordsets[1].map(formatRow), total, page, pages: Math.max(1, Math.ceil(total / limit)) };
    } catch (err) {
        console.error(err);
        reply.status(500).send({ error: err.message });
    }
});

// Gizli Excel ihraci: 2000 ve sonrasi, Zum Schlachten / Verschrottet araclar.
// MenÃ¼ye bagli degildir; rapor oturumu olan kullanici dogrudan URL ile indirir.
fastify.get('/rapor/arac-hurda-excel', { preHandler: requireReportSession }, async (request, reply) => {
    try {
        const dbPool = await getDbPool();
        const columnResult = await dbPool.request().query(`
            SELECT [name]
            FROM sys.columns
            WHERE [object_id] = OBJECT_ID('dbo.Fahrzeughandel')
            ORDER BY [column_id];
        `);
        const vehicleColumns = columnResult.recordset.map(row => row.name);
        if (!vehicleColumns.length) {
            return reply.status(503).send('Fahrzeughandel tablosu veya kolonlari bulunamadi.');
        }

        const selectColumns = vehicleColumns
            .map(column => `f.${quoteSqlName(column)} AS ${quoteSqlName(column)}`)
            .join(',\n                ');
        const columns = [
            ...vehicleColumns,
            'Status_Bezeichnung_Kunde',
            'Status_Bezeichnung_AOL',
            'Export_Filter_Yil'
        ];
        const dbReq = dbPool.request();
        dbReq.input('minYear', sql.Int, 2000);
        const result = await dbReq.query(`
            SELECT
                ${selectColumns},
                s.[Bezeichnung_Kunde] AS [Status_Bezeichnung_Kunde],
                s.[Bezeichnung_AOL] AS [Status_Bezeichnung_AOL],
                COALESCE(
                    TRY_CONVERT(int, NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(30), f.[Baujahr]))), '')),
                    YEAR(TRY_CONVERT(date, f.[Erstzulassung]))
                ) AS [Export_Filter_Yil]
            FROM dbo.Fahrzeughandel f
            LEFT JOIN dbo.FH_Status s ON s.[Status_ID] = f.[StatusID]
            WHERE f.[StatusID] IN (4, 5)
              AND COALESCE(
                    TRY_CONVERT(int, NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(30), f.[Baujahr]))), '')),
                    YEAR(TRY_CONVERT(date, f.[Erstzulassung]))
                  ) >= @minYear
            ORDER BY f.[Fahrzeug-ID] DESC;
        `);

        const today = new Date().toISOString().slice(0, 10);
        const title = `2000 sonrasi ZUM SCHLACHTEN ve VERSCHROTTET araclar (${result.recordset.length})`;
        const workbook = excelHtmlTable(result.recordset, columns, title);
        return reply
            .type('application/vnd.ms-excel; charset=utf-8')
            .header('Content-Disposition', `attachment; filename="arac-hurda-2000-${today}.xls"`)
            .header('Cache-Control', 'no-store')
            .send(workbook);
    } catch (err) {
        console.error(err);
        reply.status(500).send({ error: err.message });
    }
});

// KBA numarasi bulunan arac marka/model kombinasyonlari.
fastify.get('/api/kba', async (request, reply) => {
    try {
        const dbPool = await getDbPool();
        const query = request.query;
        const dbReq = dbPool.request();
        const kbaCompact = `REPLACE(REPLACE(REPLACE(CONVERT(nvarchar(100), f.[KBA_Nummer]), ' ', ''), '-', ''), '/', '')`;
        const clauses = [
            `f.[KBA_Nummer] IS NOT NULL`,
            `LTRIM(RTRIM(CONVERT(nvarchar(100), f.[KBA_Nummer]))) <> ''`,
            `LTRIM(RTRIM(CONVERT(nvarchar(100), f.[KBA_Nummer]))) NOT IN ('-', '0', '0000000')`
        ];
        const fields = {
            brand: `CONVERT(nvarchar(255), f.[Marke])`,
            model: `CONVERT(nvarchar(255), f.[Modell])`,
            type: `CONVERT(nvarchar(255), f.[Marke/Typ])`,
            engine: `CONVERT(nvarchar(255), f.[Motorcode])`,
            kba: kbaCompact
        };
        let paramIndex = 0;
        for (const [key, expression] of Object.entries(fields)) {
            const raw = String(query[key] || '').trim();
            if (!raw) continue;
            const parameter = `k${paramIndex++}`;
            const value = key === 'kba' ? raw.replace(/[\s\-\/]/g, '') : raw;
            const pattern = value.includes('*') ? value.replace(/\*/g, '%') : `%${value}%`;
            dbReq.input(parameter, sql.NVarChar, pattern);
            clauses.push(`${expression} LIKE @${parameter}`);
        }
        const q = String(query.q || '').trim();
        if (q) {
            const parameter = `k${paramIndex++}`;
            const compactParameter = `k${paramIndex++}`;
            const pattern = q.includes('*') ? q.replace(/\*/g, '%') : `%${q}%`;
            const compactPattern = q.replace(/[\s\-\/]/g, '').includes('*')
                ? q.replace(/[\s\-\/]/g, '').replace(/\*/g, '%')
                : `%${q.replace(/[\s\-\/]/g, '')}%`;
            dbReq.input(parameter, sql.NVarChar, pattern);
            dbReq.input(compactParameter, sql.NVarChar, compactPattern);
            clauses.push(`(
                CONVERT(nvarchar(255), f.[Marke]) LIKE @${parameter}
                OR CONVERT(nvarchar(255), f.[Modell]) LIKE @${parameter}
                OR CONVERT(nvarchar(255), f.[Marke/Typ]) LIKE @${parameter}
                OR CONVERT(nvarchar(255), f.[Motorcode]) LIKE @${parameter}
                OR CONVERT(nvarchar(255), f.[Fahrzeug_Nummer]) LIKE @${parameter}
                OR CONVERT(nvarchar(255), f.[Fahrgestellnummer]) LIKE @${parameter}
                OR ${kbaCompact} LIKE @${compactParameter}
            )`);
        }
        const where = clauses.join(' AND ');
        const page = Math.max(1, parseInt(query.page, 10) || 1);
        const limit = Math.min(200, Math.max(25, parseInt(query.limit, 10) || 50));
        const offset = (page - 1) * limit;
        const result = await dbReq.query(`
            WITH grouped AS (
                SELECT
                    LTRIM(RTRIM(CONVERT(nvarchar(120), f.[Marke]))) AS [Marke],
                    LTRIM(RTRIM(CONVERT(nvarchar(160), f.[Modell]))) AS [Modell],
                    LTRIM(RTRIM(CONVERT(nvarchar(180), f.[Marke/Typ]))) AS [Typ],
                    LTRIM(RTRIM(CONVERT(nvarchar(100), f.[KBA_Nummer]))) AS [KBA_Nummer],
                    MIN(NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(120), f.[Motorcode]))), '')) AS [Motorcode],
                    MIN(f.[Baujahr]) AS [BaujahrVon],
                    MAX(f.[Baujahr]) AS [BaujahrBis],
                    COUNT_BIG(*) AS [FahrzeugAnzahl],
                    MAX(f.[Fahrzeug_Nummer]) AS [BeispielFahrzeug]
                FROM dbo.Fahrzeughandel f
                WHERE ${where}
                GROUP BY
                    LTRIM(RTRIM(CONVERT(nvarchar(120), f.[Marke]))),
                    LTRIM(RTRIM(CONVERT(nvarchar(160), f.[Modell]))),
                    LTRIM(RTRIM(CONVERT(nvarchar(180), f.[Marke/Typ]))),
                    LTRIM(RTRIM(CONVERT(nvarchar(100), f.[KBA_Nummer])))
            )
            SELECT COUNT_BIG(*) AS total, SUM([FahrzeugAnzahl]) AS vehicles FROM grouped;

            WITH grouped AS (
                SELECT
                    LTRIM(RTRIM(CONVERT(nvarchar(120), f.[Marke]))) AS [Marke],
                    LTRIM(RTRIM(CONVERT(nvarchar(160), f.[Modell]))) AS [Modell],
                    LTRIM(RTRIM(CONVERT(nvarchar(180), f.[Marke/Typ]))) AS [Typ],
                    LTRIM(RTRIM(CONVERT(nvarchar(100), f.[KBA_Nummer]))) AS [KBA_Nummer],
                    MIN(NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(120), f.[Motorcode]))), '')) AS [Motorcode],
                    MIN(f.[Baujahr]) AS [BaujahrVon],
                    MAX(f.[Baujahr]) AS [BaujahrBis],
                    COUNT_BIG(*) AS [FahrzeugAnzahl],
                    MAX(f.[Fahrzeug_Nummer]) AS [BeispielFahrzeug]
                FROM dbo.Fahrzeughandel f
                WHERE ${where}
                GROUP BY
                    LTRIM(RTRIM(CONVERT(nvarchar(120), f.[Marke]))),
                    LTRIM(RTRIM(CONVERT(nvarchar(160), f.[Modell]))),
                    LTRIM(RTRIM(CONVERT(nvarchar(180), f.[Marke/Typ]))),
                    LTRIM(RTRIM(CONVERT(nvarchar(100), f.[KBA_Nummer])))
            )
            SELECT * FROM grouped
            ORDER BY [FahrzeugAnzahl] DESC, [Marke], [Modell], [Typ], [KBA_Nummer]
            OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY;
        `);
        const total = parseInt(result.recordsets[0][0]?.total || 0, 10);
        const vehicles = parseInt(result.recordsets[0][0]?.vehicles || 0, 10);
        return {
            rows: result.recordsets[1].map(formatRow),
            total,
            vehicles,
            page,
            pages: Math.max(1, Math.ceil(total / limit)),
            limit
        };
    } catch (err) {
        console.error(err);
        reply.status(500).send({ error: err.message });
    }
});

fastify.get('/api/kba/details', async (request, reply) => {
    try {
        const dbPool = await getDbPool();
        const query = request.query;
        const dbReq = dbPool.request();
        const cleanKba = String(query.kba || '').replace(/[\s\-\/]/g, '').trim();
        if (!cleanKba) return reply.status(400).send({ error: 'KBA gerekli.' });
        const kbaCompact = `REPLACE(REPLACE(REPLACE(CONVERT(nvarchar(100), f.[KBA_Nummer]), ' ', ''), '-', ''), '/', '')`;
        const clauses = [
            `f.[KBA_Nummer] IS NOT NULL`,
            `LTRIM(RTRIM(CONVERT(nvarchar(100), f.[KBA_Nummer]))) <> ''`,
            `LTRIM(RTRIM(CONVERT(nvarchar(100), f.[KBA_Nummer]))) NOT IN ('-', '0', '0000000')`
        ];
        dbReq.input('detailKba', sql.NVarChar, cleanKba);
        clauses.push(`${kbaCompact} = @detailKba`);
        const exactFields = {
            brand: 'Marke',
            model: 'Modell',
            type: 'Marke/Typ'
        };
        let index = 0;
        for (const [key, column] of Object.entries(exactFields)) {
            const raw = String(query[key] ?? '').trim();
            const expression = `LTRIM(RTRIM(CONVERT(nvarchar(255), f.[${column}])))`;
            if (!raw) {
                clauses.push(`(f.[${column}] IS NULL OR ${expression} = '')`);
                continue;
            }
            const parameter = `detail${index++}`;
            dbReq.input(parameter, sql.NVarChar, raw);
            clauses.push(`${expression} = @${parameter}`);
        }
        const result = await dbReq.query(`
            SELECT TOP 500
                [Fahrzeug-ID] AS [FahrzeugID], [Fahrzeug_Nummer] AS [FahrzeugNummer],
                [Fahrgestellnummer] AS [VIN], [Marke], [Modell] AS [Modellcode],
                [Marke/Typ] AS [Typ], [Motorcode], [KBA_Nummer], [Baujahr], [Erstzulassung],
                COALESCE(NULLIF(CONVERT(nvarchar(100), [kmStand]), ''), CONVERT(nvarchar(100), [Gesamtfahrleistung])) AS [Kilometer],
                [Kraftstoffbezeichnung] AS [Kraftstoff], [Farbe],
                [Getriebecode], [Getriebe] AS [Getriebeart], [Hubraum], [Zylinder],
                [letztKennzeichen], [Gekauft], [Transporteur], [Annahmestelle]
            FROM dbo.Fahrzeughandel f
            WHERE ${clauses.join(' AND ')}
            ORDER BY f.[Fahrzeug-ID] DESC;
        `);
        return { rows: result.recordset.map(formatRow), total: result.recordset.length };
    } catch (err) {
        console.error(err);
        reply.status(500).send({ error: err.message });
    }
});

// /api/parts/:partId/images
fastify.get('/api/parts/:partId/images', async (request, reply) => {
    try {
        const dbPool = await getDbPool();
        const partId = parseInt(request.params.partId, 10);

        const dbReq = dbPool.request();
        dbReq.input('partId', sql.Int, partId);

        const result = await dbReq.query(`
            SELECT Picture_ID, Hauptbild_JN, Teile_Picture_Text
            FROM dbo.GT_Picture
            WHERE Teile_ID=@partId AND (NULLIF(LTRIM(RTRIM(Teile_Picture_File)), '') IS NOT NULL OR DATALENGTH(Teile_Picture)>0)
            ORDER BY CASE WHEN Hauptbild_JN<>0 THEN 0 ELSE 1 END, Picture_ID
        `);

        return result.recordset.map(row => ({
            Picture_ID: row.Picture_ID,
            Hauptbild_JN: row.Hauptbild_JN,
            Teile_Picture_Text: row.Teile_Picture_Text
        }));
    } catch (err) {
        reply.status(500).send({ error: err.message });
    }
});

// /api/parts/:partId/images/:pictureId
fastify.get('/api/parts/:partId/images/:pictureId', async (request, reply) => {
    try {
        const dbPool = await getDbPool();
        const partId = parseInt(request.params.partId, 10);
        const pictureId = parseInt(request.params.pictureId, 10);

        const dbReq = dbPool.request();
        dbReq.input('partId', sql.Int, partId);
        dbReq.input('pictureId', sql.Int, pictureId);

        const result = await dbReq.query(`
            SELECT Teile_Picture_File, Teile_Picture
            FROM dbo.GT_Picture
            WHERE Teile_ID=@partId AND Picture_ID=@pictureId
        `);

        if (result.recordset.length === 0) {
            reply.status(404).send('Not Found');
            return;
        }

        const row = result.recordset[0];
        const filePath = String(row.Teile_Picture_File || '').trim();

        if (filePath) {
            const normalized = filePath.replace(/\//g, '\\');
            const lowerNormalized = normalized.toLowerCase();
            if (!lowerNormalized.startsWith('x:\\') &&
                !lowerNormalized.startsWith('\\\\192.168.0.105\\data\\') &&
                !lowerNormalized.startsWith('\\\\server\\d\\')) {
                reply.status(403).send('Forbidden picture path');
                return;
            }
            try {
                const data = await fs.readFile(normalized);
                const contentType = guessMimeType(normalized);
                reply.type(contentType)
                     .header('Cache-Control', 'private, max-age=3600')
                     .send(data);
                return;
            } catch (err) {
                // If not found on disk, fallback or error out
                reply.status(404).send('File Not Found on Disk');
                return;
            }
        }

        if (row.Teile_Picture) {
            reply.type('image/jpeg')
                 .header('Cache-Control', 'private, max-age=3600')
                 .send(row.Teile_Picture);
            return;
        }

        reply.status(404).send('Not Found');
    } catch (err) {
        reply.status(500).send({ error: err.message });
    }
});

// Start Server
const start = async () => {
    const port = parseInt(process.env.PORT, 10) || 8088;
    const host = process.env.HOST || '0.0.0.0';
    try {
        // Pre-warm DB pool
        await getDbPool().catch(err => {
            console.warn('VeritabanÄ± baÅŸlangÄ±Ã§ta baÄŸlanamadÄ±, ilk istekte tekrar denenecek.');
        });
        
        await fastify.listen({ port, host });
        console.log(`\n===================================================`);
        console.log(`TecDoc Arama Sistemi BaÅŸarÄ±yla Ã‡alÄ±ÅŸtÄ±rÄ±ldÄ±!`);
        console.log(`Yerel Adres: http://localhost:${port}`);
        
        const os = require('os');
        const interfaces = os.networkInterfaces();
        const intranetAddresses = [];
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    intranetAddresses.push(iface.address);
                }
            }
        }
        
        if (intranetAddresses.length > 0) {
            console.log(`Yerel AÄŸ (Intranet) EriÅŸim Adresleri:`);
            for (const addr of intranetAddresses) {
                console.log(` - http://${addr}:${port}`);
            }
        }
        console.log(`===================================================\n`);
    } catch (err) {
        console.error('Server startup failed:', err);
        process.exit(1);
    }
};

start();
