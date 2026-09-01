'use strict';

const MAX_REFERENCES = 400;
const BATCH_SIZE = 40;
const MAX_RESULTS = 250;

const normalize = (value) => String(value || '')
  .toUpperCase()
  .replace(/Ä/g, 'A')
  .replace(/Ö/g, 'O')
  .replace(/Ü/g, 'U')
  .replace(/ß/g, 'SS')
  .replace(/İ/g, 'I')
  .replace(/İ/g, 'I')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Z0-9]/g, '');

function matchesReference(value, normalizedReference) {
  const characters = [...normalizedReference].map((character) => character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(^|[^A-Z0-9])${characters.join('[^A-Z0-9]*')}($|[^A-Z0-9])`, 'i');
  return pattern.test(String(value || ''));
}

function uniqueReferences(items) {
  const output = [];
  const seen = new Set();
  for (const item of items || []) {
    const reference = String(item?.reference || '').trim();
    const normalized = normalize(reference);
    if (normalized.length < 4 || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push({ reference, normalized, group: String(item?.group || 'Unbekannt').trim() });
    if (output.length >= MAX_REFERENCES) break;
  }
  return output;
}

async function findLocalStock({ references, unit, getDbPool, sql, selectColumns, formatRow }) {
  const candidates = uniqueReferences(references);
  if (!candidates.length) return { rows: [], searchedReferences: 0 };

  const pool = await getDbPool();
  const found = new Map();
  for (let offset = 0; offset < candidates.length && found.size < MAX_RESULTS; offset += BATCH_SIZE) {
    const batch = candidates.slice(offset, offset + BATCH_SIZE);
    const request = pool.request();
    const clauses = batch.map((item, index) => {
      request.input(`ref${index}`, sql.NVarChar, `%${item.reference}%`);
      request.input(`compact${index}`, sql.NVarChar, `%${item.normalized}%`);
      return `(
        CONVERT(NVARCHAR(4000), g.[Zusatztext]) LIKE @ref${index}
        OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(CONVERT(NVARCHAR(4000), g.[Zusatztext]), ' ', ''), '-', ''), '.', ''), '/', ''), '_', '') LIKE @compact${index}
      )`;
    });
    request.input('remaining', sql.Int, MAX_RESULTS - found.size);
    let unitClause = '';
    if (unit) {
      request.input('unit', sql.NVarChar, unit);
      unitClause = ' AND g.[EbayMarkiertVonAbteilung] = @unit';
    }
    const select = selectColumns.map((name) => `g.[${name}]`).join(', ');
    const result = await request.query(`
      SELECT TOP (@remaining) ${select}, pic.MainPictureID, pic.ImageCount
      FROM dbo.Gebrauchtteile g
      OUTER APPLY (
        SELECT TOP 1 p.Picture_ID AS MainPictureID, COUNT(*) OVER() AS ImageCount
        FROM dbo.GT_Picture p
        WHERE p.Teile_ID=g.[Fahrzeug-ID]
          AND (NULLIF(LTRIM(RTRIM(p.Teile_Picture_File)), '') IS NOT NULL OR DATALENGTH(p.Teile_Picture)>0)
        ORDER BY CASE WHEN p.Hauptbild_JN<>0 THEN 0 ELSE 1 END, p.Picture_ID
      ) pic
      WHERE ISNULL(g.[Lagermenge], 0) > 0${unitClause}
        AND (${clauses.join(' OR ')})
      ORDER BY g.[Lagermenge] DESC, g.[Fahrzeug-ID] DESC;
    `);

    for (const rawRow of result.recordset) {
      const id = String(rawRow['Fahrzeug-ID']);
      for (const match of batch.filter((item) => matchesReference(rawRow.Zusatztext, item.normalized))) {
        const matchKey = `${match.normalized}:${id}`;
        if (!found.has(matchKey)) {
          found.set(matchKey, { ...formatRow(rawRow), WmkatReference: match.reference, WmkatGroup: match.group });
        }
      }
    }
  }

  const rows = [...found.values()].sort((left, right) =>
    left.WmkatGroup.localeCompare(right.WmkatGroup, 'de') ||
    left.WmkatReference.localeCompare(right.WmkatReference, 'de', { numeric: true })
  );
  return { rows, searchedReferences: candidates.length };
}

module.exports = { findLocalStock, matchesReference, normalize, uniqueReferences };
