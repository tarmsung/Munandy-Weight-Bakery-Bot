const PDFDocument = require('pdfkit');

/**
 * Generate a monthly PDF weight analysis report.
 * @param {Object} results - Results from analyzeMonthlyWeights
 * @param {string} monthLabel - e.g. "April 2026"
 * @returns {Promise<Buffer>}
 */
function generateMonthlyWeightPDF(results, monthLabel) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
        const chunks = [];
        doc.on('data', (c) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // ── Header ────────────────────────────────────────────────────────────────
        doc.rect(0, 0, doc.page.width, 100).fill('#1a2a6c');
        doc.fillColor('white')
            .fontSize(26).font('Helvetica-Bold')
            .text('Munandy Bakery', 50, 25, { align: 'left' });
        doc.fontSize(14).font('Helvetica')
            .text('Monthly Quality & Weight Analysis Report', 50, 60, { align: 'left' });
        doc.fontSize(12).font('Helvetica-Bold')
            .text(monthLabel, 50, 78, { align: 'left' });

        doc.fillColor('#333333').moveDown(4);

        // ── Executive Summary Section ─────────────────────────────────────────────
        doc.fontSize(18).font('Helvetica-Bold').fillColor('#1a2a6c')
            .text('Executive Analysis', { underline: true });
        doc.moveDown(0.5);
        
        doc.fontSize(11).font('Helvetica').fillColor('#333333');
        const paragraphs = results.analysis.split('\n');
        let bulletItems = [];

        const flushBullets = () => {
            if (bulletItems.length > 0) {
                doc.font('Helvetica').fontSize(11).fillColor('#333333');
                doc.list(bulletItems, { bulletRadius: 2, textIndent: 15, bulletIndent: 10 });
                bulletItems = [];
            }
        };

        for (const p of paragraphs) {
            const line = p.trim();
            if (!line) {
                flushBullets();
                doc.moveDown(0.5);
                continue;
            }
            if (line.startsWith('- ')) {
                // Collect bullet points instead of drawing immediately
                bulletItems.push(line.substring(2).trim());
            } else {
                flushBullets();
                // Check if it looks like a numbered section header (e.g. "1. Performance Overview")
                if (/^\d\.\s[A-Za-z\s&-]+$/.test(line) && line.length < 60) {
                    doc.moveDown(0.5);
                    doc.font('Helvetica-Bold').fontSize(14).fillColor('#1a2a6c').text(line, { align: 'left' });
                    doc.moveDown(0.2);
                } else {
                    doc.font('Helvetica').fontSize(11).fillColor('#333333').text(line, { align: 'justify', lineGap: 2 });
                }
            }
        }
        flushBullets();
        
        doc.moveDown(2);

        // ── Branch Performance Comparison ────────────────────────────────────────
        doc.fontSize(18).font('Helvetica-Bold').fillColor('#1a2a6c')
            .text('Branch Performance Summary');
        doc.moveDown(0.5);

        // Table Header
        const startX = 50;
        let currentY = doc.y;
        const colWidths = [120, 100, 100, 100, 80];
        const headers = ['Branch', 'Total Batches', 'Consistency', 'Avg Var', 'Rating'];

        doc.rect(startX, currentY, 500, 25).fill('#f0f2f5');
        doc.fillColor('#1a2a6c').fontSize(10).font('Helvetica-Bold');
        
        let headerX = startX + 5;
        headers.forEach((h, i) => {
            doc.text(h, headerX, currentY + 7);
            headerX += colWidths[i];
        });

        currentY += 25;
        doc.fillColor('#333333').font('Helvetica');

        // Table Rows
        Object.entries(results.branchStats).forEach(([branch, stats]) => {
            doc.rect(startX, currentY, 500, 25).fill(currentY % 50 === 0 ? '#ffffff' : '#f9f9f9');
            
            let cellX = startX + 5;
            const rating = parseFloat(stats.optimalPercent) >= 90 ? 'Excellent' : 
                           parseFloat(stats.optimalPercent) >= 75 ? 'Good' : 
                           parseFloat(stats.optimalPercent) >= 60 ? 'Fair' : 'Needs Work';
            
            const rowData = [
                branch,
                stats.total.toString(),
                `${stats.optimalPercent}%`,
                `${stats.avgVariance}g`,
                rating
            ];

            rowData.forEach((data, i) => {
                if (i === 4) { // Highlight rating
                    const color = rating === 'Excellent' ? '#27ae60' : 
                                 rating === 'Good' ? '#2ecc71' : 
                                 rating === 'Fair' ? '#f39c12' : '#e74c3c';
                    doc.fillColor(color).font('Helvetica-Bold');
                } else {
                    doc.fillColor('#333333').font('Helvetica');
                }
                doc.text(data, cellX, currentY + 7);
                cellX += colWidths[i];
            });
            currentY += 25;
        });

        doc.y = currentY; 
        doc.moveDown(2);

        // ── Statistics Highlights ────────────────────────────────────────────────
        const best = results.bestBranch;
        const worst = results.worstBranch;

        if (best || worst) {
            doc.fontSize(16).font('Helvetica-Bold').fillColor('#1a2a6c')
                .text('Monthly Highlights', 50, doc.y, { align: 'center', width: 500 });
            doc.moveDown(0.5);

            const hStartX = 50;
            let hY = doc.y;
            const hColWidths = [120, 90, 290];
            const hHeaders = ['Category', 'Branch', 'Performance Summary'];

            // Header
            doc.rect(hStartX, hY, 500, 20).fill('#f0f2f5');
            doc.fillColor('#1a2a6c').fontSize(10).font('Helvetica-Bold');
            let hHeaderX = hStartX + 5;
            hHeaders.forEach((h, i) => {
                doc.text(h, hHeaderX, hY + 5);
                hHeaderX += hColWidths[i];
            });
            hY += 20;

            // Rows
            if (best) {
                const stats = results.branchStats[best];
                doc.rect(hStartX, hY, 500, 35).fill('#e8f5e9'); // Shade of Green
                doc.fillColor('#27ae60').fontSize(10).font('Helvetica-Bold').text('Best Performing', hStartX + 5, hY + 12);
                doc.fillColor('#333333').font('Helvetica-Bold').text(best, hStartX + hColWidths[0] + 5, hY + 12);
                doc.font('Helvetica').fontSize(9).text(`Achieved ${stats.optimalPercent}% consistency across ${stats.total} batches. High quality standards maintained.`, hStartX + hColWidths[0] + hColWidths[1] + 5, hY + 7, { width: 280 });
                hY += 35;
            }

            if (worst) {
                const stats = results.branchStats[worst];
                doc.rect(hStartX, hY, 500, 35).fill('#fbe9e7'); // Shade of Red
                doc.fillColor('#e74c3c').fontSize(10).font('Helvetica-Bold').text('Worst Performing', hStartX + 5, hY + 12);
                doc.fillColor('#333333').font('Helvetica-Bold').text(worst, hStartX + hColWidths[0] + 5, hY + 12);
                doc.font('Helvetica').fontSize(9).text(`Struggled with ${stats.optimalPercent}% consistency. Management intervention and root cause analysis required.`, hStartX + hColWidths[0] + hColWidths[1] + 5, hY + 7, { width: 280 });
                hY += 35;
            }
            
            doc.y = hY;
            doc.moveDown(2);
        }

        // ── Footer ────────────────────────────────────────────────────────────────
        const pageCount = doc.bufferedPageRange().count;
        for (let i = 0; i < pageCount; i++) {
            doc.switchToPage(i);
            doc.fontSize(8).fillColor('#999999')
                .text(
                    `Generated by Munandy AI Auditor · Confidential Report · ${new Date().toLocaleDateString()}`,
                    50,
                    doc.page.height - 50,
                    { align: 'center' }
                );
        }

        doc.end();
    });
}

module.exports = { generateMonthlyWeightPDF };
