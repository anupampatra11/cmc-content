// ── PDF constants ─────────────────────────────────────────────────────────────
const LineBreakPDF = {
	section: 12,
	text: 6
};

const FontSizesPDF = {
	title: 20,
	header: 16,
	largeText: 14,
	mediumText: 12,
	smallText: 11
};

const increaseCoordinate = (current, spaceToAdd, pdf) => {
	const possibleCoordinate = current + spaceToAdd;
	if (possibleCoordinate > 590) {
		pdf.addPage();
		return 50;
	}
	return possibleCoordinate;
};

// ── Download the data as a PDF ────────────────────────────────────────────────
function downloadPdf() {
	const { jsPDF } = window.jspdf;

	const pdf = new jsPDF({unit: "px"});
	let x = 40;
	let y = 50;

	pdf.setFont("helvetica", "normal");
	pdf.setCharSpace(0);

	// Title
	pdf.setFontSize(FontSizesPDF.title);
	pdf.text('Content Velocity Scan Report', x, y);
	y += LineBreakPDF.section

	// Scanned website and how many pages were scanned
	pdf.setFontSize(FontSizesPDF.mediumText);
	y += FontSizesPDF.mediumText;
	pdf.text(
		`Domain: ${document.getElementById('summaryDomain')?.textContent || ''}`,
		x,
		y
	);

	y += FontSizesPDF.mediumText;
	pdf.text(
		`Pages scanned: ${document.getElementById('summaryCount')?.textContent || ''}`,
		x,
		y
	);

	y += LineBreakPDF.section

	// Average scores - all pages
	pdf.setFontSize(FontSizesPDF.largeText);
	y += FontSizesPDF.largeText;
	pdf.text(
		`Average SEO: ${document.getElementById('avgSeo')?.textContent || '-'}`,
		x,
		y
	);

	y += FontSizesPDF.largeText;
	pdf.text(
		`Average GEO: ${document.getElementById('avgGeo')?.textContent || '-'}`,
		x,
		y
	);

	y += FontSizesPDF.largeText;
	pdf.text(
		`Velocity Score: ${document.getElementById('avgCombined')?.textContent || '-'}`,
		x,
		y
	);

	y += LineBreakPDF.section

	// Results overview - all pages
	pdf.setFontSize(FontSizesPDF.header);
	y += FontSizesPDF.header;
	pdf.text('Page Results', x, y);
	y += LineBreakPDF.text;

	pdf.setFontSize(FontSizesPDF.smallText);
	y += FontSizesPDF.smallText;
	for (const page of allPages) {
		if (y > 590) {
			pdf.addPage();
			y = 50;
		}

		const pageDesc = (page.title ?? page.url)
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '');
		const pageName = pdf.splitTextToSize(pageDesc, 360);
		pdf.text(pageName, x, y)

		y += pageName.length * FontSizesPDF.smallText;

		const score = `    Score: ${page.scores?.combined ?? 0}`;
		pdf.text(score, x, y)

		y += FontSizesPDF.smallText;
	}

	// Individual pages with more details
	for (const page of allPages) {
		pdf.addPage();
		y = 50;

		// Header with the name of the analysed page
		pdf.setFontSize(FontSizesPDF.header)
		const pageDesc = (page.title ?? page.url)
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '');
		const pageName = pdf.splitTextToSize(pageDesc, 360);
		pdf.text(pageName, x, y)
		y += pageName.length * FontSizesPDF.smallText;

		// Page scores
		pdf.setFontSize(FontSizesPDF.largeText);
		y += FontSizesPDF.largeText;

		pdf.text(
			`SEO: ${page.scores.seo || '-'}`,
			x,
			y
		);

		y += FontSizesPDF.largeText;
		pdf.text(
			`GEO: ${page.scores.geo || '-'}`,
			x,
			y
		);

		y += FontSizesPDF.largeText;
		pdf.text(
			`Velocity: ${page.scores.combined || '-'}`,
			x,
			y
		);

		y += LineBreakPDF.section;

		// Issues to fix
		pdf.setFontSize(FontSizesPDF.largeText);
		y += FontSizesPDF.largeText;
		pdf.text("Issues to fix", x, y)

		const failed = page.checks
			.filter((c) => !c.pass)
			.sort((a, b) => b.weight - a.weight);

		failed.map((check) => {
			pdf.setFontSize(FontSizesPDF.mediumText).setFont(undefined, 'bold');
			y = increaseCoordinate(y, FontSizesPDF.smallText, pdf)
			pdf.text(check.label, x, y);

			// Description with suggestion on what/how to fix the issue
			pdf.setFontSize(FontSizesPDF.smallText).setFont(undefined, 'normal');
			y = increaseCoordinate(y, FontSizesPDF.smallText, pdf)
			const fixDesc = pdf.splitTextToSize(check.howToFix, 360);
			pdf.text(fixDesc, x, y);
			y = increaseCoordinate(y, fixDesc.length * FontSizesPDF.smallText, pdf)

			// Show the code example if present
			if (check.codeExample) {
				x += LineBreakPDF.section;
				const codeSnippet = pdf.splitTextToSize(check.codeExample, 360 - LineBreakPDF.section);
				pdf.text(codeSnippet, x, y);
				y = increaseCoordinate(y, codeSnippet.length * 10, pdf)
				x -= LineBreakPDF.section;
			}
		})

		// Passed checks
		pdf.setFontSize(FontSizesPDF.largeText);
		y += FontSizesPDF.largeText;
		pdf.text("Passed checks", x, y)

		const passed = page.checks.filter((c) => c.pass);
		passed.map((check) => {
			pdf.setFontSize(FontSizesPDF.mediumText).setFont(undefined, 'bold');
			y = increaseCoordinate(y, FontSizesPDF.smallText, pdf)
			pdf.text(check.label, x, y);

			// Description with findings which made the check pass
			pdf.setFontSize(FontSizesPDF.smallText).setFont(undefined, 'normal');
			y = increaseCoordinate(y, FontSizesPDF.smallText, pdf)
			const passDetail = pdf.splitTextToSize(check.detail, 360);
			pdf.text(passDetail, x, y);
			y = increaseCoordinate(y, passDetail.length * FontSizesPDF.smallText, pdf)
		})
	}

	pdf.save("Content-velocity-scanner_Report.pdf")
}
