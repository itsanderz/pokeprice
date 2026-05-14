const { mdToPdf } = require('md-to-pdf');
const path = require('path');

(async () => {
  const pdf = await mdToPdf({ path: path.resolve('findings.md') }, {
    dest: path.resolve('PokePrice_Research_Findings.pdf'),
    pdf_options: {
      format: 'Letter',
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size:9px; color:#666; width:100%; text-align:center; padding:5mm 0; font-family:system-ui,sans-serif;">
          PokePrice User Research Findings &mdash; May 2026
        </div>`,
      footerTemplate: `
        <div style="font-size:9px; color:#666; width:100%; text-align:center; padding:5mm 0; font-family:system-ui,sans-serif;">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>`,
    },
    body_class: 'markdown-body',
    highlight_style: 'github',
  });

  if (pdf && pdf.filename) {
    console.log('PDF created:', pdf.filename);
  } else {
    console.error('PDF creation failed');
    process.exit(1);
  }
})();
