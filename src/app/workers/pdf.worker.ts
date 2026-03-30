/// <reference lib="webworker" />

const SIAF_TABLE_LAYOUTS: Record<string, any> = {
  // Franja azul oscuro (#1a365d) + stripes grises
  siafStripe: {
    hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.3,
    vLineWidth: () => 0.3,
    hLineColor: () => '#aaa',
    vLineColor: () => '#ccc',
    fillColor: (rowIndex: number) => rowIndex === 0 ? '#1a365d' : (rowIndex % 2 === 0 ? '#f8fafc' : null)
  },
  // Franja teal (#1a5276) + stripes azul claro
  siafStripeTeal: {
    hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.3,
    vLineWidth: () => 0.3,
    hLineColor: () => '#aaa',
    vLineColor: () => '#ccc',
    fillColor: (rowIndex: number) => rowIndex === 0 ? '#1a5276' : (rowIndex % 2 === 0 ? '#eaf4fb' : null)
  },
  // Franja azul (#1e40af) + stripes grises
  siafStripeBlue: {
    hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.3,
    vLineWidth: () => 0.3,
    hLineColor: () => '#aaa',
    vLineColor: () => '#ccc',
    fillColor: (rowIndex: number) => rowIndex === 0 ? '#1e40af' : (rowIndex % 2 === 0 ? '#f8fafc' : null)
  },
  // Solo líneas, sin fill (sub-tablas con 2 filas de header)
  siafSubTable: {
    hLineWidth: (i: number, node: any) => (i <= 2 || i === node.table.body.length) ? 1 : 0.3,
    vLineWidth: () => 0.3,
    hLineColor: () => '#aaa',
    vLineColor: () => '#ccc'
  },
  // Solo líneas, sin fill (tablas sin stripe)
  siafLines: {
    hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.3,
    vLineWidth: () => 0.3,
    hLineColor: () => '#aaa',
    vLineColor: () => '#ccc'
  },
  // KPI cards con padding y colores suaves
  siafKpi: {
    hLineColor: () => '#E2E8F0',
    vLineColor: () => '#E2E8F0',
    paddingLeft: () => 6,
    paddingRight: () => 6,
    paddingTop: () => 8,
    paddingBottom: () => 8
  }
};

interface FooterTemplate {
  text: string;
  alignment: string;
  fontSize: number;
  margin: number[];
}

addEventListener('message', async ({ data }: MessageEvent) => {
  try {
    const pdfMake = (await import('pdfmake/build/pdfmake')).default;
    const pdfFonts = (await import('pdfmake/build/vfs_fonts')).default;
    // vfs_fonts may export differently in worker context — try all known patterns
    (pdfMake as any).vfs =
      (pdfFonts as any).pdfMake?.vfs ??
      (pdfFonts as any).default?.pdfMake?.vfs ??
      (typeof pdfFonts === 'object' && !Array.isArray(pdfFonts) ? pdfFonts : undefined);
    (pdfMake as any).tableLayouts = SIAF_TABLE_LAYOUTS;

    const { docDefinition, footerTemplate, fileName } = data as {
      docDefinition: any;
      footerTemplate?: FooterTemplate;
      fileName: string;
    };

    // Las funciones no son serializables por postMessage.
    // Si header/footer llegan como objetos estáticos, envolverlos en función.
    if (docDefinition.header && typeof docDefinition.header !== 'function') {
      const headerContent = docDefinition.header;
      docDefinition.header = () => headerContent;
    }

    if (footerTemplate) {
      docDefinition.footer = (currentPage: number, pageCount: number) => ({
        ...footerTemplate,
        text: footerTemplate.text
          .replace('{cp}', String(currentPage))
          .replace('{pc}', String(pageCount))
      });
    }

    // Registrar layouts también a nivel de documento (fallback si el global no funciona)
    docDefinition.tableLayouts = SIAF_TABLE_LAYOUTS;

    await new Promise<void>((resolve, reject) => {
      try {
        (pdfMake as any).createPdf(docDefinition).getBuffer((buf: any) => {
          try {
            // getBuffer devuelve Uint8Array/Buffer, no ArrayBuffer — extraer el ArrayBuffer subyacente
            const ab: ArrayBuffer = buf instanceof ArrayBuffer
              ? buf
              : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
            postMessage({ buffer: ab, fileName }, [ab]);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  } catch (err) {
    postMessage({ error: String(err), fileName: data?.fileName });
  }
});
