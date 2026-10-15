/** Construye la URL para previsualizar un PDF sin el panel de miniaturas. */
export const pdfPreviewUrl = (url: string): string => {
  if (!url) return url;

  const hashIndex = url.indexOf('#');
  const baseUrl = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const existingOptions = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const options = new URLSearchParams(existingOptions);

  options.set('toolbar', '0');
  options.set('navpanes', '0');
  options.set('pagemode', 'none');

  return `${baseUrl}#${options.toString()}`;
};
