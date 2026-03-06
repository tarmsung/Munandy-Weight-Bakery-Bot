const PDFDocument = require('pdfkit');

function statusColor(status) {
    if (status === 'Optimal') return '#27ae60';
    if (status === 'Overweight') return '#e74c3c';
    return '#2980b9'; // Underweight
}

function statusLabel(status) {
    if (status === 'Optimal') return '✓ Optimal';
    if (status === 'Overweight') return '▲ Overweight';
    return '▼ Underweight';
}

/**
 * Generate a PDF quality-control report.
 * @param {Array}  records  - rows from weight_records joined with products
 * @param {string} [aiAnalysis] - Optional concise AI summary paragraph
 * @returns {Promise<Buffer>}
 */
function generatePDFReport(records, dateLabel, aiAnalysis) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const chunks = [];
        doc.on('data', (c) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const date = dateLabel || new Date().toLocaleDateString('en-ZA', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });

        // ── Header ────────────────────────────────────────────────────────────────
        doc.rect(0, 0, doc.page.width, 70).fill('#2c3e50');
        doc.fillColor('white')
            .fontSize(22).font('Helvetica-Bold')
            .text('Munandy Bakery', 40, 15, { align: 'center' });
        doc.fontSize(12).font('Helvetica')
            .text('Quality Control Report', 40, 40, { align: 'center' });

        doc.fillColor('#333333').moveDown(2);

        // ── Date & Summary ────────────────────────────────────────────────────────
        doc.fontSize(11).font('Helvetica-Bold').text(date, { align: 'center' });
        doc.moveDown(0.5);

        const optimal = records.filter((r) => r.status === 'Optimal').length;
        const overweight = records.filter((r) => r.status === 'Overweight').length;
        const underweight = records.filter((r) => r.status === 'Underweight').length;

        doc.fontSize(10).font('Helvetica')
            .text(`Batches recorded: ${records.length}   |   ✓ Optimal: ${optimal}   |   ▲ Overweight: ${overweight}   |   ▼ Underweight: ${underweight}`,
                { align: 'center' });

        if (aiAnalysis) {
            doc.moveDown(1);
            doc.fillColor('#2980b9').fontSize(10).font('Helvetica-Bold')
                .text('🤖 AI Quality Insight:', { align: 'center' });
            doc.moveDown(0.2);
            doc.fillColor('#555555').fontSize(9).font('Helvetica-Oblique')
                .text(aiAnalysis, { align: 'center' });
            doc.moveDown(1.5);
        } else {
            doc.moveDown(1.2);
        }

        // ── Table ─────────────────────────────────────────────────────────────────
        const PAGE_LEFT = 40;
        const ROW_HEIGHT = 22;

        // Column definitions: [label, width, align]
        const cols = [
            { label: 'Product', width: 85, align: 'left' },
            { label: 'S1', width: 35, align: 'center' },
            { label: 'S2', width: 35, align: 'center' },
            { label: 'S3', width: 35, align: 'center' },
            { label: 'S4', width: 35, align: 'center' },
            { label: 'Avg', width: 38, align: 'center' },
            { label: 'Range (g)', width: 65, align: 'center' },
            { label: 'Variance', width: 52, align: 'center' },
            { label: 'Qty', width: 35, align: 'center' },
            { label: 'Status', width: 76, align: 'left' },
        ];

        const totalWidth = cols.reduce((s, c) => s + c.width, 0);

        function drawRow(y, cells, opts = {}) {
            const { bg = null, bold = false, colors = [] } = opts;
            if (bg) doc.rect(PAGE_LEFT, y, totalWidth, ROW_HEIGHT).fill(bg);

            let x = PAGE_LEFT;
            cells.forEach((cell, i) => {
                const col = cols[i];
                doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
                    .fontSize(9)
                    .fillColor(colors[i] || '#333333')
                    .text(String(cell), x + 3, y + 6, {
                        width: col.width - 6,
                        height: ROW_HEIGHT,
                        align: col.align,
                        lineBreak: false,
                    });
                x += col.width;
            });
        }

        // Header row
        let y = doc.y;
        drawRow(y, cols.map((c) => c.label), { bg: '#2c3e50', bold: true, colors: Array(cols.length).fill('white') });
        y += ROW_HEIGHT;

        // Data rows
        records.forEach((r, idx) => {
            const bg = idx % 2 === 0 ? '#f4f6f8' : '#ffffff';
            const sc = statusColor(r.status);

            // Variance display
            let varianceDisplay = 'Within range';
            if (r.variance > 0) varianceDisplay = `+${r.variance}g`;
            else if (r.variance < 0) varianceDisplay = `${r.variance}g`;

            drawRow(
                y,
                [
                    r.product_name,
                    r.sample1,
                    r.sample2,
                    r.sample3,
                    r.sample4,
                    `${Math.round(r.average)}g`,
                    `${r.min_weight}–${r.max_weight}g`,
                    varianceDisplay,
                    r.quantity ?? '-',
                    statusLabel(r.status),
                ],
                { bg, colors: [null, null, null, null, null, null, null, null, null, sc] }
            );
            y += ROW_HEIGHT;
        });

        // Bottom border
        doc.rect(PAGE_LEFT, y, totalWidth, 1).fill('#2c3e50');

        // ── Footer ────────────────────────────────────────────────────────────────
        doc.moveDown(3);
        doc.fontSize(8).fillColor('#999999').font('Helvetica-Oblique')
            .text(`Generated by Munandy Weight Bot · ${new Date().toLocaleString('en-ZA')}`, { align: 'center' });

        doc.end();
    });
}

module.exports = { generatePDFReport };
