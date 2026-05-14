// One-off generator: produces a realistic manufacturing/ERP workbook for
// uploading into Odoo Spreadsheet (Documents app) — the canvas-rendered grid
// we want to exercise against Playwright.
//
// Run: node scripts/gen-erp-xlsx.mjs
// Output: ./odoo-erp-mock.xlsx

import ExcelJS from 'exceljs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, '..', 'odoo-erp-mock.xlsx');

const wb = new ExcelJS.Workbook();
wb.creator = 'Bot Arena';
wb.created = new Date();
wb.modified = new Date();

// ---------------------------------------------------------------------------
// Shared styling helpers
// ---------------------------------------------------------------------------
const HEADER_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1F4E78' },
};
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
const SECTION_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFD9E1F2' },
};
const TOTAL_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFF2CC' },
};
const BORDER_THIN = { style: 'thin', color: { argb: 'FFB7B7B7' } };
const ALL_BORDERS = {
  top: BORDER_THIN,
  left: BORDER_THIN,
  bottom: BORDER_THIN,
  right: BORDER_THIN,
};

function styleHeader(row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = ALL_BORDERS;
  });
  row.height = 22;
}

function styleBody(sheet, startRow, endRow) {
  for (let r = startRow; r <= endRow; r++) {
    sheet.getRow(r).eachCell((cell) => {
      cell.border = ALL_BORDERS;
      if (!cell.alignment) cell.alignment = { vertical: 'middle' };
    });
  }
}

// ---------------------------------------------------------------------------
// 1. Items (master data)
// ---------------------------------------------------------------------------
const items = wb.addWorksheet('Items', { views: [{ state: 'frozen', ySplit: 1 }] });
items.columns = [
  { header: 'SKU', key: 'sku', width: 14 },
  { header: 'Description', key: 'desc', width: 38 },
  { header: 'Type', key: 'type', width: 12 },
  { header: 'UoM', key: 'uom', width: 8 },
  { header: 'Std Cost', key: 'cost', width: 12, style: { numFmt: '#,##0.00' } },
  { header: 'List Price', key: 'price', width: 12, style: { numFmt: '#,##0.00' } },
  { header: 'Lead Time (d)', key: 'lead', width: 14 },
  { header: 'Reorder Pt', key: 'reorder', width: 12 },
  { header: 'Default Supplier', key: 'supplier', width: 22 },
  { header: 'Last Updated', key: 'updated', width: 14, style: { numFmt: 'yyyy-mm-dd' } },
];
styleHeader(items.getRow(1));

const itemRows = [
  // Finished goods
  ['FG-1001', 'Industrial Pump Assembly Mk II', 'Finished', 'EA', 412.50, 925.00, 21, 25, 'Internal Production', '2026-04-12'],
  ['FG-1002', 'Industrial Pump Assembly Mk III', 'Finished', 'EA', 478.20, 1095.00, 28, 18, 'Internal Production', '2026-04-12'],
  ['FG-1101', 'Hydraulic Cylinder 250mm', 'Finished', 'EA', 188.75, 415.00, 14, 40, 'Internal Production', '2026-04-08'],
  ['FG-1102', 'Hydraulic Cylinder 400mm', 'Finished', 'EA', 252.10, 565.00, 17, 30, 'Internal Production', '2026-04-08'],
  ['FG-1203', 'Gearbox Reduction Unit 30:1', 'Finished', 'EA', 318.40, 740.00, 24, 22, 'Internal Production', '2026-03-29'],
  // Sub-assemblies / WIP
  ['SA-2010', 'Pump Housing Cast (Machined)', 'WIP', 'EA', 92.30, null, 10, 60, 'Acme Castings GmbH', '2026-04-02'],
  ['SA-2011', 'Impeller, Stainless 316L', 'WIP', 'EA', 64.80, null, 8, 80, 'NorthSteel Foundry', '2026-04-02'],
  ['SA-2012', 'Cylinder Tube, Honed', 'WIP', 'EA', 71.20, null, 12, 50, 'PrecisionBore Ltd', '2026-03-30'],
  ['SA-2013', 'Piston Rod, Chrome-plated', 'WIP', 'EA', 38.55, null, 9, 75, 'PrecisionBore Ltd', '2026-03-30'],
  // Raw materials
  ['RM-3001', 'Cast Iron GG25 — 50kg ingot', 'Raw', 'KG', 1.85, null, 14, 1500, 'Acme Castings GmbH', '2026-04-15'],
  ['RM-3002', 'Stainless 316L bar — 60mm', 'Raw', 'M', 14.20, null, 18, 200, 'NorthSteel Foundry', '2026-04-15'],
  ['RM-3003', 'Steel Plate S355 — 8mm', 'Raw', 'M2', 28.60, null, 10, 80, 'EuroSteel SA', '2026-04-10'],
  ['RM-3010', 'NBR O-ring 25mm ID', 'Raw', 'EA', 0.18, null, 5, 5000, 'SealPro AG', '2026-04-18'],
  ['RM-3011', 'NBR O-ring 50mm ID', 'Raw', 'EA', 0.31, null, 5, 4000, 'SealPro AG', '2026-04-18'],
  ['RM-3020', 'M10x40 Hex Bolt, A2-70', 'Raw', 'EA', 0.22, null, 7, 10000, 'FastenAll Co', '2026-04-05'],
  ['RM-3021', 'M12x50 Hex Bolt, A2-70', 'Raw', 'EA', 0.34, null, 7, 8000, 'FastenAll Co', '2026-04-05'],
  ['RM-3030', 'Ball Bearing 6205-2RS', 'Raw', 'EA', 4.85, null, 12, 600, 'BearingsDirect EU', '2026-04-01'],
  ['RM-3031', 'Ball Bearing 6305-2RS', 'Raw', 'EA', 7.40, null, 12, 400, 'BearingsDirect EU', '2026-04-01'],
  ['RM-3040', 'Hydraulic Oil ISO VG46 — 20L', 'Raw', 'L', 3.85, null, 3, 800, 'LubricaChem', '2026-04-22'],
  ['RM-3050', 'Powder Coat, Industrial Blue', 'Raw', 'KG', 12.40, null, 14, 120, 'CoatTech sro', '2026-04-09'],
];
itemRows.forEach((r) => items.addRow(r));
styleBody(items, 2, 1 + itemRows.length);
items.autoFilter = { from: 'A1', to: 'J1' };

// ---------------------------------------------------------------------------
// 2. Bill of Materials
// ---------------------------------------------------------------------------
const bom = wb.addWorksheet('BOM', { views: [{ state: 'frozen', ySplit: 1 }] });
bom.columns = [
  { header: 'Parent SKU', key: 'parent', width: 14 },
  { header: 'Parent Description', key: 'parentDesc', width: 34 },
  { header: 'Component SKU', key: 'comp', width: 14 },
  { header: 'Component Description', key: 'compDesc', width: 34 },
  { header: 'Qty per Parent', key: 'qty', width: 14, style: { numFmt: '0.000' } },
  { header: 'UoM', key: 'uom', width: 8 },
  { header: 'Scrap %', key: 'scrap', width: 10, style: { numFmt: '0.00%' } },
  { header: 'Effective Qty', key: 'eff', width: 14, style: { numFmt: '0.000' } },
  { header: 'Unit Cost', key: 'cost', width: 12, style: { numFmt: '#,##0.0000' } },
  { header: 'Extended Cost', key: 'ext', width: 14, style: { numFmt: '#,##0.00' } },
];
styleHeader(bom.getRow(1));

// Cost lookup by SKU
const costBySku = Object.fromEntries(itemRows.map((r) => [r[0], r[4]]));
const descBySku = Object.fromEntries(itemRows.map((r) => [r[0], r[1]]));

const bomRows = [
  // FG-1001 → its sub-assemblies and direct components
  ['FG-1001', 'SA-2010', 1.0, 'EA', 0.02],
  ['FG-1001', 'SA-2011', 1.0, 'EA', 0.03],
  ['FG-1001', 'RM-3010', 4.0, 'EA', 0.05],
  ['FG-1001', 'RM-3020', 8.0, 'EA', 0.01],
  ['FG-1001', 'RM-3030', 2.0, 'EA', 0.01],
  ['FG-1001', 'RM-3040', 0.8, 'L', 0.04],
  ['FG-1001', 'RM-3050', 0.4, 'KG', 0.06],
  // FG-1002 — uprated variant
  ['FG-1002', 'SA-2010', 1.0, 'EA', 0.02],
  ['FG-1002', 'SA-2011', 1.0, 'EA', 0.03],
  ['FG-1002', 'RM-3011', 4.0, 'EA', 0.05],
  ['FG-1002', 'RM-3021', 8.0, 'EA', 0.01],
  ['FG-1002', 'RM-3031', 2.0, 'EA', 0.01],
  ['FG-1002', 'RM-3040', 1.2, 'L', 0.04],
  ['FG-1002', 'RM-3050', 0.5, 'KG', 0.06],
  // FG-1101 hydraulic cylinder
  ['FG-1101', 'SA-2012', 1.0, 'EA', 0.02],
  ['FG-1101', 'SA-2013', 1.0, 'EA', 0.02],
  ['FG-1101', 'RM-3010', 6.0, 'EA', 0.05],
  ['FG-1101', 'RM-3020', 6.0, 'EA', 0.01],
  ['FG-1101', 'RM-3040', 0.5, 'L', 0.04],
  // FG-1102 larger cylinder
  ['FG-1102', 'SA-2012', 1.0, 'EA', 0.02],
  ['FG-1102', 'SA-2013', 1.0, 'EA', 0.02],
  ['FG-1102', 'RM-3011', 6.0, 'EA', 0.05],
  ['FG-1102', 'RM-3021', 8.0, 'EA', 0.01],
  ['FG-1102', 'RM-3040', 0.8, 'L', 0.04],
  // FG-1203 gearbox
  ['FG-1203', 'RM-3002', 0.6, 'M', 0.04],
  ['FG-1203', 'RM-3003', 0.3, 'M2', 0.05],
  ['FG-1203', 'RM-3021', 12.0, 'EA', 0.01],
  ['FG-1203', 'RM-3031', 4.0, 'EA', 0.01],
  ['FG-1203', 'RM-3040', 0.6, 'L', 0.04],
  // Sub-assemblies and what they consume (just SA-2010 example)
  ['SA-2010', 'RM-3001', 12.0, 'KG', 0.08],
  ['SA-2011', 'RM-3002', 0.4, 'M', 0.06],
  ['SA-2012', 'RM-3003', 0.2, 'M2', 0.05],
  ['SA-2013', 'RM-3002', 0.25, 'M', 0.06],
];

bomRows.forEach((r, i) => {
  const [parent, comp, qty, uom, scrap] = r;
  const rowNum = i + 2;
  bom.addRow({
    parent,
    parentDesc: descBySku[parent] || '',
    comp,
    compDesc: descBySku[comp] || '',
    qty,
    uom,
    scrap,
  });
  // Effective qty = qty * (1 + scrap)
  bom.getCell(`H${rowNum}`).value = { formula: `E${rowNum}*(1+G${rowNum})` };
  bom.getCell(`I${rowNum}`).value = costBySku[comp] ?? 0;
  bom.getCell(`J${rowNum}`).value = { formula: `H${rowNum}*I${rowNum}` };
});
styleBody(bom, 2, 1 + bomRows.length);
bom.autoFilter = { from: 'A1', to: 'J1' };

// ---------------------------------------------------------------------------
// 3. Inventory On-Hand
// ---------------------------------------------------------------------------
const inv = wb.addWorksheet('Inventory', { views: [{ state: 'frozen', ySplit: 1 }] });
inv.columns = [
  { header: 'SKU', key: 'sku', width: 14 },
  { header: 'Description', key: 'desc', width: 36 },
  { header: 'Warehouse', key: 'wh', width: 14 },
  { header: 'On Hand', key: 'oh', width: 10, style: { numFmt: '#,##0' } },
  { header: 'Allocated', key: 'alloc', width: 10, style: { numFmt: '#,##0' } },
  { header: 'Available', key: 'avail', width: 10, style: { numFmt: '#,##0' } },
  { header: 'Reorder Pt', key: 'rp', width: 10, style: { numFmt: '#,##0' } },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Unit Cost', key: 'cost', width: 12, style: { numFmt: '#,##0.00' } },
  { header: 'Inventory Value', key: 'val', width: 16, style: { numFmt: '#,##0.00' } },
  { header: 'Last Count', key: 'count', width: 14, style: { numFmt: 'yyyy-mm-dd' } },
];
styleHeader(inv.getRow(1));

const warehouses = ['WH-MAIN', 'WH-SOUTH', 'WH-EU2'];
const invSeed = [
  // [sku, [oh by warehouse], allocated]
  ['FG-1001', [42, 18, 6], 15],
  ['FG-1002', [12, 4, 2], 8],
  ['FG-1101', [62, 30, 14], 22],
  ['FG-1102', [38, 12, 8], 18],
  ['FG-1203', [9, 3, 1], 4],
  ['SA-2010', [120, 0, 0], 30],
  ['SA-2011', [98, 0, 0], 25],
  ['SA-2012', [110, 0, 0], 28],
  ['SA-2013', [140, 0, 0], 35],
  ['RM-3001', [3200, 0, 0], 800],
  ['RM-3002', [420, 0, 0], 90],
  ['RM-3003', [180, 0, 0], 40],
  ['RM-3010', [8400, 0, 0], 2100],
  ['RM-3011', [6800, 0, 0], 1700],
  ['RM-3020', [22000, 0, 0], 4200],
  ['RM-3021', [18500, 0, 0], 3600],
  ['RM-3030', [950, 0, 0], 220],
  ['RM-3031', [620, 0, 0], 140],
  ['RM-3040', [1280, 0, 0], 220],
  ['RM-3050', [180, 0, 0], 35],
];
const reorderBySku = Object.fromEntries(itemRows.map((r) => [r[0], r[7]]));

let invRowNum = 2;
invSeed.forEach(([sku, ohs, alloc]) => {
  ohs.forEach((oh, i) => {
    if (oh === 0 && i > 0) return;
    inv.addRow({
      sku,
      desc: descBySku[sku] || '',
      wh: warehouses[i],
      oh,
      alloc: i === 0 ? alloc : 0,
      rp: reorderBySku[sku] ?? 0,
      cost: costBySku[sku] ?? 0,
      count: new Date(2026, 3, 15 + (invRowNum % 10)),
    });
    inv.getCell(`F${invRowNum}`).value = { formula: `D${invRowNum}-E${invRowNum}` };
    inv.getCell(`H${invRowNum}`).value = {
      formula: `IF(F${invRowNum}<G${invRowNum},"REORDER","OK")`,
    };
    inv.getCell(`J${invRowNum}`).value = { formula: `D${invRowNum}*I${invRowNum}` };
    invRowNum++;
  });
});
styleBody(inv, 2, invRowNum - 1);

// Conditional formatting: REORDER cells get a red fill
inv.addConditionalFormatting({
  ref: `H2:H${invRowNum - 1}`,
  rules: [
    {
      type: 'containsText',
      operator: 'containsText',
      text: 'REORDER',
      priority: 1,
      style: {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } },
        font: { color: { argb: 'FF9C0006' }, bold: true },
      },
    },
  ],
});
inv.autoFilter = { from: 'A1', to: 'K1' };

// Totals row
const totalRow = inv.addRow({
  sku: 'TOTAL',
  desc: '',
  wh: '',
  oh: { formula: `SUM(D2:D${invRowNum - 1})` },
  alloc: { formula: `SUM(E2:E${invRowNum - 1})` },
  avail: { formula: `SUM(F2:F${invRowNum - 1})` },
  val: { formula: `SUM(J2:J${invRowNum - 1})` },
});
totalRow.eachCell((cell) => {
  cell.fill = TOTAL_FILL;
  cell.font = { bold: true };
  cell.border = ALL_BORDERS;
});

// ---------------------------------------------------------------------------
// 4. Sales Orders
// ---------------------------------------------------------------------------
const so = wb.addWorksheet('Sales Orders', { views: [{ state: 'frozen', ySplit: 1 }] });
so.columns = [
  { header: 'SO #', key: 'so', width: 12 },
  { header: 'Order Date', key: 'date', width: 12, style: { numFmt: 'yyyy-mm-dd' } },
  { header: 'Customer', key: 'cust', width: 28 },
  { header: 'Country', key: 'country', width: 10 },
  { header: 'SKU', key: 'sku', width: 12 },
  { header: 'Description', key: 'desc', width: 30 },
  { header: 'Qty', key: 'qty', width: 8, style: { numFmt: '#,##0' } },
  { header: 'Unit Price', key: 'price', width: 12, style: { numFmt: '#,##0.00' } },
  { header: 'Discount %', key: 'disc', width: 11, style: { numFmt: '0.0%' } },
  { header: 'Net Total', key: 'net', width: 13, style: { numFmt: '#,##0.00' } },
  { header: 'VAT %', key: 'vat', width: 8, style: { numFmt: '0.0%' } },
  { header: 'VAT Amount', key: 'vatA', width: 13, style: { numFmt: '#,##0.00' } },
  { header: 'Gross Total', key: 'gross', width: 14, style: { numFmt: '#,##0.00' } },
  { header: 'Status', key: 'status', width: 12 },
  { header: 'Due Date', key: 'due', width: 12, style: { numFmt: 'yyyy-mm-dd' } },
];
styleHeader(so.getRow(1));

const priceBySku = Object.fromEntries(itemRows.filter((r) => r[5] != null).map((r) => [r[0], r[5]]));

const soSeed = [
  ['SO-2026-0421', '2026-04-02', 'Brno Industrial Pumps as', 'CZ', 'FG-1001', 8, 0.05, 0.21, 'Invoiced'],
  ['SO-2026-0422', '2026-04-03', 'Brno Industrial Pumps as', 'CZ', 'FG-1101', 12, 0.05, 0.21, 'Invoiced'],
  ['SO-2026-0423', '2026-04-05', 'Bavaria Hydraulik GmbH', 'DE', 'FG-1102', 6, 0.10, 0.19, 'Invoiced'],
  ['SO-2026-0424', '2026-04-08', 'Bavaria Hydraulik GmbH', 'DE', 'FG-1002', 4, 0.10, 0.19, 'Invoiced'],
  ['SO-2026-0425', '2026-04-10', 'Polskie Maszyny Sp.z.o.o.', 'PL', 'FG-1203', 3, 0.00, 0.23, 'Shipped'],
  ['SO-2026-0426', '2026-04-12', 'Polskie Maszyny Sp.z.o.o.', 'PL', 'FG-1001', 10, 0.07, 0.23, 'Shipped'],
  ['SO-2026-0427', '2026-04-15', 'Iberian Marine SL', 'ES', 'FG-1101', 20, 0.08, 0.21, 'Shipped'],
  ['SO-2026-0428', '2026-04-18', 'Iberian Marine SL', 'ES', 'FG-1102', 8, 0.08, 0.21, 'Confirmed'],
  ['SO-2026-0429', '2026-04-21', 'Nordic OEM AB', 'SE', 'FG-1001', 14, 0.03, 0.25, 'Confirmed'],
  ['SO-2026-0430', '2026-04-23', 'Nordic OEM AB', 'SE', 'FG-1203', 5, 0.00, 0.25, 'Confirmed'],
  ['SO-2026-0431', '2026-04-25', 'Adriatic Pumps doo', 'HR', 'FG-1002', 6, 0.06, 0.25, 'Quotation'],
  ['SO-2026-0432', '2026-04-28', 'Adriatic Pumps doo', 'HR', 'FG-1101', 18, 0.06, 0.25, 'Quotation'],
  ['SO-2026-0433', '2026-05-02', 'Helvetica Mechanik AG', 'CH', 'FG-1102', 10, 0.04, 0.077, 'Quotation'],
  ['SO-2026-0434', '2026-05-05', 'Helvetica Mechanik AG', 'CH', 'FG-1203', 6, 0.04, 0.077, 'Quotation'],
];
soSeed.forEach((r, i) => {
  const rowNum = i + 2;
  const [soNum, date, cust, country, sku, qty, disc, vat, status] = r;
  so.addRow({
    so: soNum,
    date: new Date(date),
    cust,
    country,
    sku,
    desc: descBySku[sku] || '',
    qty,
    price: priceBySku[sku] ?? 0,
    disc,
    vat,
    status,
    due: new Date(new Date(date).getTime() + 30 * 86400000),
  });
  so.getCell(`J${rowNum}`).value = { formula: `G${rowNum}*H${rowNum}*(1-I${rowNum})` };
  so.getCell(`L${rowNum}`).value = { formula: `J${rowNum}*K${rowNum}` };
  so.getCell(`M${rowNum}`).value = { formula: `J${rowNum}+L${rowNum}` };
});
styleBody(so, 2, 1 + soSeed.length);
so.autoFilter = { from: 'A1', to: 'O1' };

// Totals
const soTotal = so.addRow({
  so: 'TOTAL',
  net: { formula: `SUM(J2:J${1 + soSeed.length})` },
  vatA: { formula: `SUM(L2:L${1 + soSeed.length})` },
  gross: { formula: `SUM(M2:M${1 + soSeed.length})` },
});
soTotal.eachCell((cell) => {
  cell.fill = TOTAL_FILL;
  cell.font = { bold: true };
  cell.border = ALL_BORDERS;
});

// ---------------------------------------------------------------------------
// 5. Purchase Orders
// ---------------------------------------------------------------------------
const po = wb.addWorksheet('Purchase Orders', { views: [{ state: 'frozen', ySplit: 1 }] });
po.columns = [
  { header: 'PO #', key: 'po', width: 12 },
  { header: 'Order Date', key: 'date', width: 12, style: { numFmt: 'yyyy-mm-dd' } },
  { header: 'Supplier', key: 'sup', width: 26 },
  { header: 'SKU', key: 'sku', width: 12 },
  { header: 'Description', key: 'desc', width: 30 },
  { header: 'Qty', key: 'qty', width: 10, style: { numFmt: '#,##0' } },
  { header: 'Unit Cost', key: 'cost', width: 12, style: { numFmt: '#,##0.0000' } },
  { header: 'Net Total', key: 'net', width: 14, style: { numFmt: '#,##0.00' } },
  { header: 'Expected Receipt', key: 'exp', width: 16, style: { numFmt: 'yyyy-mm-dd' } },
  { header: 'Status', key: 'status', width: 12 },
];
styleHeader(po.getRow(1));

const poSeed = [
  ['PO-2026-3110', '2026-04-04', 'Acme Castings GmbH', 'RM-3001', 4000, '2026-04-22', 'Received'],
  ['PO-2026-3111', '2026-04-05', 'NorthSteel Foundry', 'RM-3002', 600, '2026-04-25', 'Received'],
  ['PO-2026-3112', '2026-04-06', 'EuroSteel SA', 'RM-3003', 220, '2026-04-18', 'Received'],
  ['PO-2026-3113', '2026-04-09', 'SealPro AG', 'RM-3010', 12000, '2026-04-15', 'Received'],
  ['PO-2026-3114', '2026-04-09', 'SealPro AG', 'RM-3011', 10000, '2026-04-15', 'Received'],
  ['PO-2026-3115', '2026-04-11', 'FastenAll Co', 'RM-3020', 30000, '2026-04-20', 'Received'],
  ['PO-2026-3116', '2026-04-11', 'FastenAll Co', 'RM-3021', 24000, '2026-04-20', 'Received'],
  ['PO-2026-3117', '2026-04-15', 'BearingsDirect EU', 'RM-3030', 1200, '2026-04-29', 'In Transit'],
  ['PO-2026-3118', '2026-04-15', 'BearingsDirect EU', 'RM-3031', 800, '2026-04-29', 'In Transit'],
  ['PO-2026-3119', '2026-04-18', 'LubricaChem', 'RM-3040', 1600, '2026-04-23', 'Received'],
  ['PO-2026-3120', '2026-04-20', 'CoatTech sro', 'RM-3050', 240, '2026-05-06', 'Confirmed'],
  ['PO-2026-3121', '2026-04-26', 'Acme Castings GmbH', 'RM-3001', 5000, '2026-05-12', 'Confirmed'],
  ['PO-2026-3122', '2026-05-02', 'NorthSteel Foundry', 'RM-3002', 700, '2026-05-22', 'Draft'],
];
poSeed.forEach((r, i) => {
  const rowNum = i + 2;
  const [poNum, date, sup, sku, qty, exp, status] = r;
  po.addRow({
    po: poNum,
    date: new Date(date),
    sup,
    sku,
    desc: descBySku[sku] || '',
    qty,
    cost: costBySku[sku] ?? 0,
    exp: new Date(exp),
    status,
  });
  po.getCell(`H${rowNum}`).value = { formula: `F${rowNum}*G${rowNum}` };
});
styleBody(po, 2, 1 + poSeed.length);
po.autoFilter = { from: 'A1', to: 'J1' };

const poTotal = po.addRow({
  po: 'TOTAL',
  net: { formula: `SUM(H2:H${1 + poSeed.length})` },
});
poTotal.eachCell((cell) => {
  cell.fill = TOTAL_FILL;
  cell.font = { bold: true };
  cell.border = ALL_BORDERS;
});

// ---------------------------------------------------------------------------
// 6. Production Schedule
// ---------------------------------------------------------------------------
const prod = wb.addWorksheet('Production', { views: [{ state: 'frozen', ySplit: 1 }] });
prod.columns = [
  { header: 'WO #', key: 'wo', width: 12 },
  { header: 'SKU', key: 'sku', width: 12 },
  { header: 'Description', key: 'desc', width: 30 },
  { header: 'Qty Planned', key: 'qty', width: 12, style: { numFmt: '#,##0' } },
  { header: 'Qty Produced', key: 'done', width: 13, style: { numFmt: '#,##0' } },
  { header: '% Complete', key: 'pct', width: 12, style: { numFmt: '0.0%' } },
  { header: 'Work Center', key: 'wc', width: 14 },
  { header: 'Start Date', key: 'start', width: 12, style: { numFmt: 'yyyy-mm-dd' } },
  { header: 'Due Date', key: 'due', width: 12, style: { numFmt: 'yyyy-mm-dd' } },
  { header: 'Status', key: 'status', width: 12 },
  { header: 'Std Cost', key: 'cost', width: 12, style: { numFmt: '#,##0.00' } },
  { header: 'WIP Value', key: 'wip', width: 14, style: { numFmt: '#,##0.00' } },
];
styleHeader(prod.getRow(1));

const prodSeed = [
  ['WO-2026-0801', 'FG-1001', 30, 30, 'WC-ASSY-1', '2026-03-25', '2026-04-08', 'Done'],
  ['WO-2026-0802', 'FG-1101', 60, 60, 'WC-MACH-2', '2026-03-28', '2026-04-11', 'Done'],
  ['WO-2026-0803', 'FG-1002', 16, 12, 'WC-ASSY-1', '2026-04-05', '2026-04-22', 'In Progress'],
  ['WO-2026-0804', 'FG-1102', 24, 18, 'WC-MACH-2', '2026-04-06', '2026-04-24', 'In Progress'],
  ['WO-2026-0805', 'FG-1203', 12, 0, 'WC-ASSY-2', '2026-04-25', '2026-05-15', 'Scheduled'],
  ['WO-2026-0806', 'FG-1001', 40, 0, 'WC-ASSY-1', '2026-05-02', '2026-05-20', 'Scheduled'],
  ['WO-2026-0807', 'FG-1101', 30, 0, 'WC-MACH-2', '2026-05-10', '2026-05-26', 'Scheduled'],
  ['WO-2026-0808', 'SA-2010', 200, 200, 'WC-CAST', '2026-04-01', '2026-04-12', 'Done'],
  ['WO-2026-0809', 'SA-2011', 180, 120, 'WC-CAST', '2026-04-15', '2026-04-30', 'In Progress'],
];
prodSeed.forEach((r, i) => {
  const rowNum = i + 2;
  const [wo, sku, qty, done, wc, start, due, status] = r;
  prod.addRow({
    wo,
    sku,
    desc: descBySku[sku] || '',
    qty,
    done,
    wc,
    start: new Date(start),
    due: new Date(due),
    status,
    cost: costBySku[sku] ?? 0,
  });
  prod.getCell(`F${rowNum}`).value = { formula: `IFERROR(E${rowNum}/D${rowNum},0)` };
  prod.getCell(`L${rowNum}`).value = { formula: `E${rowNum}*K${rowNum}` };
});
styleBody(prod, 2, 1 + prodSeed.length);
prod.autoFilter = { from: 'A1', to: 'L1' };

// % complete conditional bar
prod.addConditionalFormatting({
  ref: `F2:F${1 + prodSeed.length}`,
  rules: [
    {
      type: 'dataBar',
      priority: 1,
      cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: 1 }],
      color: { argb: 'FF5B9BD5' },
    },
  ],
});

// ---------------------------------------------------------------------------
// 7. General Ledger / Trial Balance
// ---------------------------------------------------------------------------
const gl = wb.addWorksheet('Trial Balance', { views: [{ state: 'frozen', ySplit: 1 }] });
gl.columns = [
  { header: 'Account #', key: 'acc', width: 12 },
  { header: 'Account Name', key: 'name', width: 38 },
  { header: 'Type', key: 'type', width: 16 },
  { header: 'Opening Balance', key: 'open', width: 16, style: { numFmt: '#,##0.00' } },
  { header: 'Period Debit', key: 'debit', width: 14, style: { numFmt: '#,##0.00' } },
  { header: 'Period Credit', key: 'credit', width: 14, style: { numFmt: '#,##0.00' } },
  { header: 'Closing Balance', key: 'close', width: 16, style: { numFmt: '#,##0.00' } },
];
styleHeader(gl.getRow(1));

// debit-positive convention for Asset/Expense, credit-positive for Liab/Equity/Revenue.
// We store opening + debits - credits = closing on a signed basis.
const glSeed = [
  ['1010', 'Cash on Hand', 'Asset', 84200.00, 412800.00, 358900.00],
  ['1020', 'Bank — Operating', 'Asset', 312500.00, 1248000.00, 1192800.00],
  ['1110', 'Accounts Receivable', 'Asset', 218400.00, 624900.00, 561200.00],
  ['1210', 'Inventory — Raw Materials', 'Asset', 198600.00, 286400.00, 232100.00],
  ['1211', 'Inventory — WIP', 'Asset', 64200.00, 142800.00, 121500.00],
  ['1212', 'Inventory — Finished Goods', 'Asset', 312800.00, 421500.00, 384200.00],
  ['1510', 'Property, Plant & Equipment', 'Asset', 1820000.00, 28000.00, 0.00],
  ['1610', 'Accumulated Depreciation', 'Asset', -612000.00, 0.00, 24300.00],
  ['2010', 'Accounts Payable', 'Liability', -184300.00, 218600.00, 296400.00],
  ['2110', 'VAT Payable', 'Liability', -28400.00, 32100.00, 64200.00],
  ['2210', 'Payroll Payable', 'Liability', -42600.00, 184200.00, 192800.00],
  ['2510', 'Long-term Debt', 'Liability', -480000.00, 12000.00, 0.00],
  ['3010', 'Share Capital', 'Equity', -500000.00, 0.00, 0.00],
  ['3110', 'Retained Earnings', 'Equity', -812400.00, 0.00, 0.00],
  ['4010', 'Revenue — Pumps', 'Revenue', 0.00, 0.00, 412800.00],
  ['4020', 'Revenue — Hydraulics', 'Revenue', 0.00, 0.00, 318600.00],
  ['4030', 'Revenue — Gearboxes', 'Revenue', 0.00, 0.00, 84200.00],
  ['4910', 'Sales Discounts', 'Revenue', 0.00, 28600.00, 0.00],
  ['5010', 'COGS — Materials', 'Expense', 0.00, 312400.00, 0.00],
  ['5020', 'COGS — Labor', 'Expense', 0.00, 118600.00, 0.00],
  ['5030', 'COGS — Overhead', 'Expense', 0.00, 74200.00, 0.00],
  ['6010', 'Salaries & Wages', 'Expense', 0.00, 142800.00, 0.00],
  ['6020', 'Rent & Utilities', 'Expense', 0.00, 38400.00, 0.00],
  ['6030', 'Depreciation', 'Expense', 0.00, 24300.00, 0.00],
  ['6040', 'Marketing & Sales', 'Expense', 0.00, 28600.00, 0.00],
  ['6050', 'Travel & Entertainment', 'Expense', 0.00, 12400.00, 0.00],
  ['6060', 'IT & Software', 'Expense', 0.00, 18200.00, 0.00],
  ['6090', 'Other Operating Expense', 'Expense', 0.00, 9800.00, 0.00],
  ['7010', 'Interest Expense', 'Expense', 0.00, 6400.00, 0.00],
  ['7020', 'Tax Expense', 'Expense', 0.00, 32100.00, 0.00],
];
glSeed.forEach((r, i) => {
  const rowNum = i + 2;
  gl.addRow({
    acc: r[0],
    name: r[1],
    type: r[2],
    open: r[3],
    debit: r[4],
    credit: r[5],
  });
  gl.getCell(`G${rowNum}`).value = { formula: `D${rowNum}+E${rowNum}-F${rowNum}` };
});
styleBody(gl, 2, 1 + glSeed.length);
gl.autoFilter = { from: 'A1', to: 'G1' };

const glTotal = gl.addRow({
  acc: 'TOTAL',
  open: { formula: `SUM(D2:D${1 + glSeed.length})` },
  debit: { formula: `SUM(E2:E${1 + glSeed.length})` },
  credit: { formula: `SUM(F2:F${1 + glSeed.length})` },
  close: { formula: `SUM(G2:G${1 + glSeed.length})` },
});
glTotal.eachCell((cell) => {
  cell.fill = TOTAL_FILL;
  cell.font = { bold: true };
  cell.border = ALL_BORDERS;
});

// ---------------------------------------------------------------------------
// 8. P&L — Income Statement (cross-sheet formulas referencing Trial Balance)
// ---------------------------------------------------------------------------
const pl = wb.addWorksheet('P&L');
pl.columns = [
  { header: 'Income Statement — Period 4 / 2026', key: 'lbl', width: 44 },
  { header: 'Amount (EUR)', key: 'amt', width: 18, style: { numFmt: '#,##0.00' } },
  { header: '% of Revenue', key: 'pct', width: 14, style: { numFmt: '0.0%' } },
];
styleHeader(pl.getRow(1));

// Helpers — fetch closing balance from Trial Balance by account
function tbLookup(account) {
  return `VLOOKUP("${account}",'Trial Balance'!A:G,7,FALSE)`;
}

const plLayout = [
  { lbl: 'Revenue', section: true },
  { lbl: '  Pumps', formula: `-${tbLookup('4010')}` },
  { lbl: '  Hydraulics', formula: `-${tbLookup('4020')}` },
  { lbl: '  Gearboxes', formula: `-${tbLookup('4030')}` },
  { lbl: '  Less: Discounts', formula: `-${tbLookup('4910')}` },
  { lbl: 'Net Revenue', total: true, formula: 'SUM(B3:B6)' },
  { lbl: '', spacer: true },
  { lbl: 'Cost of Goods Sold', section: true },
  { lbl: '  Materials', formula: tbLookup('5010') },
  { lbl: '  Direct Labor', formula: tbLookup('5020') },
  { lbl: '  Overhead', formula: tbLookup('5030') },
  { lbl: 'Total COGS', total: true, formula: 'SUM(B10:B12)' },
  { lbl: '', spacer: true },
  { lbl: 'Gross Profit', total: true, formula: 'B7-B13' },
  { lbl: 'Gross Margin %', formula: 'B15/B7', isPct: true },
  { lbl: '', spacer: true },
  { lbl: 'Operating Expenses', section: true },
  { lbl: '  Salaries & Wages', formula: tbLookup('6010') },
  { lbl: '  Rent & Utilities', formula: tbLookup('6020') },
  { lbl: '  Depreciation', formula: tbLookup('6030') },
  { lbl: '  Marketing & Sales', formula: tbLookup('6040') },
  { lbl: '  Travel & Entertainment', formula: tbLookup('6050') },
  { lbl: '  IT & Software', formula: tbLookup('6060') },
  { lbl: '  Other', formula: tbLookup('6090') },
  { lbl: 'Total OpEx', total: true, formula: 'SUM(B19:B25)' },
  { lbl: '', spacer: true },
  { lbl: 'Operating Income (EBIT)', total: true, formula: 'B15-B26' },
  { lbl: 'Operating Margin %', formula: 'B28/B7', isPct: true },
  { lbl: '', spacer: true },
  { lbl: 'Interest Expense', formula: tbLookup('7010') },
  { lbl: 'Pre-tax Income', total: true, formula: 'B28-B31' },
  { lbl: 'Tax Expense', formula: tbLookup('7020') },
  { lbl: 'Net Income', total: true, formula: 'B32-B33' },
  { lbl: 'Net Margin %', formula: 'B34/B7', isPct: true },
];

plLayout.forEach((item, idx) => {
  const rowNum = idx + 2;
  const row = pl.addRow([item.lbl]);
  if (item.section) {
    row.getCell(1).fill = SECTION_FILL;
    row.getCell(1).font = { bold: true };
  } else if (item.total) {
    row.getCell(1).font = { bold: true };
    row.getCell(2).font = { bold: true };
    row.getCell(2).numFmt = '#,##0.00';
    row.getCell(1).fill = TOTAL_FILL;
    row.getCell(2).fill = TOTAL_FILL;
  }
  if (item.formula) {
    pl.getCell(`B${rowNum}`).value = { formula: item.formula };
    if (item.isPct) {
      pl.getCell(`B${rowNum}`).numFmt = '0.0%';
    }
  }
  if (!item.isPct && !item.spacer && !item.section && item.formula) {
    pl.getCell(`C${rowNum}`).value = { formula: `IFERROR(B${rowNum}/$B$7,0)` };
    pl.getCell(`C${rowNum}`).numFmt = '0.0%';
  }
});

// ---------------------------------------------------------------------------
// 9. AR Aging
// ---------------------------------------------------------------------------
const ar = wb.addWorksheet('AR Aging', { views: [{ state: 'frozen', ySplit: 1 }] });
ar.columns = [
  { header: 'Customer', key: 'cust', width: 28 },
  { header: 'Invoice #', key: 'inv', width: 14 },
  { header: 'Invoice Date', key: 'date', width: 13, style: { numFmt: 'yyyy-mm-dd' } },
  { header: 'Due Date', key: 'due', width: 13, style: { numFmt: 'yyyy-mm-dd' } },
  { header: 'Total', key: 'total', width: 14, style: { numFmt: '#,##0.00' } },
  { header: 'Days Overdue', key: 'days', width: 14 },
  { header: '0–30', key: 'b30', width: 12, style: { numFmt: '#,##0.00' } },
  { header: '31–60', key: 'b60', width: 12, style: { numFmt: '#,##0.00' } },
  { header: '61–90', key: 'b90', width: 12, style: { numFmt: '#,##0.00' } },
  { header: '90+', key: 'b91', width: 12, style: { numFmt: '#,##0.00' } },
];
styleHeader(ar.getRow(1));

const arSeed = [
  ['Brno Industrial Pumps as', 'INV-26-1042', '2026-03-12', '2026-04-11', 18420.50],
  ['Brno Industrial Pumps as', 'INV-26-1051', '2026-03-28', '2026-04-27', 9840.00],
  ['Bavaria Hydraulik GmbH', 'INV-26-1063', '2026-04-02', '2026-05-02', 24600.00],
  ['Bavaria Hydraulik GmbH', 'INV-26-1071', '2026-04-14', '2026-05-14', 14820.00],
  ['Polskie Maszyny Sp.z.o.o.', 'INV-26-1080', '2026-04-18', '2026-05-18', 12400.00],
  ['Iberian Marine SL', 'INV-26-1086', '2026-04-21', '2026-05-21', 18600.00],
  ['Nordic OEM AB', 'INV-26-1092', '2026-04-25', '2026-05-25', 22400.00],
  ['Adriatic Pumps doo', 'INV-26-0998', '2026-01-20', '2026-02-19', 6800.00],
  ['Adriatic Pumps doo', 'INV-26-1015', '2026-02-18', '2026-03-20', 9200.00],
  ['Helvetica Mechanik AG', 'INV-26-1099', '2026-05-02', '2026-06-01', 16400.00],
];
const TODAY_REF = `DATE(2026,5,14)`;

arSeed.forEach((r, i) => {
  const rowNum = i + 2;
  const [cust, inv, date, due, total] = r;
  ar.addRow({
    cust,
    inv,
    date: new Date(date),
    due: new Date(due),
    total,
  });
  ar.getCell(`F${rowNum}`).value = { formula: `MAX(0,${TODAY_REF}-D${rowNum})` };
  ar.getCell(`G${rowNum}`).value = { formula: `IF(F${rowNum}<=30,E${rowNum},0)` };
  ar.getCell(`H${rowNum}`).value = { formula: `IF(AND(F${rowNum}>30,F${rowNum}<=60),E${rowNum},0)` };
  ar.getCell(`I${rowNum}`).value = { formula: `IF(AND(F${rowNum}>60,F${rowNum}<=90),E${rowNum},0)` };
  ar.getCell(`J${rowNum}`).value = { formula: `IF(F${rowNum}>90,E${rowNum},0)` };
});
styleBody(ar, 2, 1 + arSeed.length);
ar.autoFilter = { from: 'A1', to: 'J1' };

const arTotal = ar.addRow({
  cust: 'TOTAL',
  total: { formula: `SUM(E2:E${1 + arSeed.length})` },
  b30: { formula: `SUM(G2:G${1 + arSeed.length})` },
  b60: { formula: `SUM(H2:H${1 + arSeed.length})` },
  b90: { formula: `SUM(I2:I${1 + arSeed.length})` },
  b91: { formula: `SUM(J2:J${1 + arSeed.length})` },
});
arTotal.eachCell((cell) => {
  cell.fill = TOTAL_FILL;
  cell.font = { bold: true };
  cell.border = ALL_BORDERS;
});

// ---------------------------------------------------------------------------
// 10. Dashboard / KPI summary (front sheet)
// ---------------------------------------------------------------------------
const dash = wb.addWorksheet('Dashboard');
dash.getColumn(1).width = 4;
dash.getColumn(2).width = 38;
dash.getColumn(3).width = 22;
dash.getColumn(4).width = 22;

dash.mergeCells('B2:D2');
dash.getCell('B2').value = 'Helios Manufacturing s.r.o. — Operations Snapshot';
dash.getCell('B2').font = { bold: true, size: 16, color: { argb: 'FF1F4E78' } };
dash.getRow(2).height = 28;

dash.mergeCells('B3:D3');
dash.getCell('B3').value = 'Period: April 2026   ·   Reporting currency: EUR   ·   Source workbook for Odoo Spreadsheet import test';
dash.getCell('B3').font = { italic: true, color: { argb: 'FF595959' } };

const kpis = [
  ['Net Revenue (period)', `='P&L'!B7`, '#,##0.00'],
  ['Gross Profit', `='P&L'!B15`, '#,##0.00'],
  ['Gross Margin %', `='P&L'!B15/'P&L'!B7`, '0.0%'],
  ['Operating Income (EBIT)', `='P&L'!B28`, '#,##0.00'],
  ['Net Income', `='P&L'!B34`, '#,##0.00'],
  ['Open Sales Orders (count)', `=COUNTIF('Sales Orders'!N:N,"Confirmed")+COUNTIF('Sales Orders'!N:N,"Quotation")`, '#,##0'],
  ['Inventory Value', `='Inventory'!J${invRowNum}`, '#,##0.00'],
  ['AR Outstanding', `='AR Aging'!E${2 + arSeed.length}`, '#,##0.00'],
  ['AR Past Due (>30d)', `='AR Aging'!H${2 + arSeed.length}+'AR Aging'!I${2 + arSeed.length}+'AR Aging'!J${2 + arSeed.length}`, '#,##0.00'],
  ['Production Work Orders Open', `=COUNTIF('Production'!J:J,"In Progress")+COUNTIF('Production'!J:J,"Scheduled")`, '#,##0'],
  ['Items Below Reorder Point', `=COUNTIF('Inventory'!H:H,"REORDER")`, '#,##0'],
];

let rowIdx = 5;
kpis.forEach(([label, formula, fmt]) => {
  dash.getCell(`B${rowIdx}`).value = label;
  dash.getCell(`B${rowIdx}`).font = { bold: true, color: { argb: 'FF1F4E78' } };
  dash.getCell(`B${rowIdx}`).alignment = { vertical: 'middle' };
  dash.getCell(`C${rowIdx}`).value = { formula: formula.replace(/^=/, '') };
  dash.getCell(`C${rowIdx}`).numFmt = fmt;
  dash.getCell(`C${rowIdx}`).font = { size: 13, bold: true };
  dash.getCell(`C${rowIdx}`).alignment = { horizontal: 'right', vertical: 'middle' };
  [`B${rowIdx}`, `C${rowIdx}`].forEach((c) => {
    dash.getCell(c).border = {
      top: BORDER_THIN,
      left: BORDER_THIN,
      bottom: BORDER_THIN,
      right: BORDER_THIN,
    };
    dash.getCell(c).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: rowIdx % 2 === 0 ? 'FFF2F2F2' : 'FFFFFFFF' },
    };
  });
  dash.getRow(rowIdx).height = 24;
  rowIdx++;
});

// Move Dashboard to be first sheet
wb.views = [{ activeTab: 0 }];
const order = ['Dashboard', 'Items', 'BOM', 'Inventory', 'Sales Orders', 'Purchase Orders', 'Production', 'Trial Balance', 'P&L', 'AR Aging'];
wb.worksheets.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
wb.worksheets.forEach((ws, i) => {
  ws.orderNo = i;
});

await wb.xlsx.writeFile(outPath);
console.log(`Wrote: ${outPath}`);
console.log(`Sheets: ${wb.worksheets.map((w) => w.name).join(', ')}`);
