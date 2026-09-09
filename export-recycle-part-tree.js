'use strict';

require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');
const RecycleClient = require('./modules/recycle/client');
const { loadConfig } = require('./modules/recycle/config');

const TARGET_URL = 'https://recycle.baytemuer.de/recycle/partselect.do?formname=vehicleDisassemblyForm&formfield=0&selpartpk=&multiple=true';
const OUTPUT_PATH = path.join(__dirname, 'tmp', 'recycle-part-tree.csv');

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows) {
  const headers = [
    'row',
    'node_id',
    'level',
    'parent_id',
    'path',
    'label',
    'select_name',
    'select_value',
    'select_href',
    'expand_id',
    'expand_onclick',
    'branch_id',
    'form_hidden_values',
    'classes'
  ];
  return [
    headers.map(csvCell).join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(','))
  ].join('\r\n');
}

async function main() {
  const client = new RecycleClient();
  try {
    const config = loadConfig();
    const page = await client.ensurePage();
    page.setDefaultTimeout(config.timeoutMs);
    await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('input[name="username"]').fill(config.username);
    await page.locator('input[name="password"]').fill(config.password);
    await Promise.all([
      page.waitForLoadState('domcontentloaded').catch(() => {}),
      page.locator('form[name="LoginForm"] input[type="submit"]').click()
    ]);
    await page.waitForTimeout(1500);
    client.loggedIn = Boolean(page.frame({ name: 'CONTENT' }) || page.frame({ name: 'MENU' }));
    if (!client.loggedIn && await page.locator('input[name="password"]').count()) {
      throw new Error('Recycle girişi tamamlanamadı.');
    }
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    if (await page.locator('input[name="password"]').count()) {
      client.loggedIn = false;
      await page.locator('input[name="username"]').fill(config.username);
      await page.locator('input[name="password"]').fill(config.password);
      await Promise.all([
        page.waitForLoadState('domcontentloaded').catch(() => {}),
        page.locator('form[name="LoginForm"] input[type="submit"]').click()
      ]);
      await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
    }

    const parseTreeRows = async () => page.evaluate(() => {
        const clean = (value) => String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
        const hiddenInputs = [...document.querySelectorAll('input[type="hidden"]')].map((input) => ({
          name: input.getAttribute('name') || '',
          id: input.id || '',
          value: input.value || ''
        }));
        const hiddenValues = hiddenInputs
          .filter((input) => input.name || input.id || input.value)
          .map((input) => `${input.name || input.id}=${input.value}`)
          .join('; ');
        const menuRows = [...document.querySelectorAll('tr[id^="menuitem_"]')];
        const stack = [];
        const output = [];

        for (const row of menuRows) {
          const match = row.id.match(/^menuitem_(\d+)_(\d+)$/);
          if (!match) continue;
          const nodeId = match[1];
          const level = Number(match[2]) - 1;
          const checkbox = row.querySelector('input[type="checkbox"]');
          const anchor = row.querySelector('a[href^="javascript:selectPart"]');
          const expander = row.querySelector('img[id^="imgexpand_"]');
          const branch = row.querySelector('img[id^="branch_"]');
          const label = clean(anchor?.textContent || [...row.cells].at(-1)?.textContent || row.textContent);
          stack[level] = { id: nodeId, label };
          stack.length = level + 1;

          output.push({
            node_id: nodeId,
            level,
            parent_id: level > 0 ? stack[level - 1]?.id || '' : '',
            path: stack.filter(Boolean).map((entry) => entry.label).join(' > '),
            label,
            select_name: checkbox?.getAttribute('name') || '',
            select_value: checkbox?.getAttribute('value') || '',
            select_href: anchor?.getAttribute('href') || '',
            expand_id: expander?.id || '',
            expand_onclick: expander?.getAttribute('onclick') || '',
            branch_id: branch?.id || '',
            form_hidden_values: hiddenValues,
            classes: row.className || ''
          });
        }
        return output;
      });

    const rootRows = await parseTreeRows();
    const rootIds = rootRows
      .filter((row) => row.expand_onclick && /^ECr\(\d+\)$/.test(row.expand_onclick))
      .map((row) => row.node_id);
    if (!rootIds.length) throw new Error('Kök ağaç düğümleri bulunamadı.');

    const byNodeId = new Map();
    for (const rootId of rootIds) {
      const expandedUrl = new URL(TARGET_URL);
      expandedUrl.searchParams.set('ex', rootId);
      await page.goto(expandedUrl.toString(), { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      for (const row of await parseTreeRows()) {
        if (!byNodeId.has(row.node_id) || row.select_value) byNodeId.set(row.node_id, row);
      }
      console.log(`expanded ${rootId}: ${byNodeId.size} unique rows`);
    }

    const rows = [...byNodeId.values()]
      .sort((a, b) => Number(a.node_id) - Number(b.node_id))
      .map((row, index) => ({ row: index + 1, ...row }));
    await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await fs.writeFile(OUTPUT_PATH, `\ufeff${toCsv(rows)}`, 'utf8');
    console.log(JSON.stringify({ output: OUTPUT_PATH, rows: rows.length, roots: rootIds }, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
