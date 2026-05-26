type PrintPdfOptions = {
  token?: string | null;
  fileName?: string;
};

export type PrintPdfResult = {
  mode: 'print-dialog' | 'mobile-opened' | 'opened-fallback';
  message: string;
};

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function isMobilePrintEnvironment() {
  const userAgent = navigator.userAgent || '';
  const mobileByAgent =
    /Android|iPhone|iPad|iPod|Mobile|Windows Phone|webOS|BlackBerry/i.test(userAgent);

  const mobileByScreen = window.matchMedia?.('(max-width: 768px)').matches;
  const touchDevice = navigator.maxTouchPoints > 1;

  return Boolean(mobileByAgent || (mobileByScreen && touchDevice));
}

function buildUrlWithToken(url: string, token?: string | null) {
  if (!token) return url;

  try {
    const finalUrl = new URL(url, window.location.origin);
    finalUrl.searchParams.set('token', token);
    return finalUrl.toString();
  } catch {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}token=${encodeURIComponent(token)}`;
  }
}

async function fetchPdfBlob(
  url: string,
  method: 'GET' | 'POST',
  body: unknown,
  options?: PrintPdfOptions
) {
  const headers: HeadersInit = {};

  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
  }

  if (options?.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const fallbackMessage =
      method === 'POST'
        ? 'Erro ao gerar PDF para impressão.'
        : 'Erro ao carregar PDF para impressão.';

    let message = fallbackMessage;

    try {
      const json = await response.json();
      message = json?.message || message;
    } catch {
      // mantém mensagem padrão
    }

    throw new Error(message);
  }

  const blob = await response.blob();

  if (!blob || blob.size === 0) {
    throw new Error('PDF inválido para impressão.');
  }

  return blob;
}

function openBlobInNewTab(blob: Blob, fileName?: string): PrintPdfResult {
  const blobUrl = URL.createObjectURL(blob);
  const openedWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer');

  if (!openedWindow) {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.download = fileName || 'etiqueta.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  window.setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 120000);

  return {
    mode: 'mobile-opened',
    message:
      'No celular, o PDF foi aberto. Use o menu do navegador/visualizador para imprimir ou compartilhar com a impressora.',
  };
}

function openUrlInNewTab(url: string): PrintPdfResult {
  const openedWindow = window.open(url, '_blank', 'noopener,noreferrer');

  if (!openedWindow) {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return {
    mode: 'opened-fallback',
    message:
      'O PDF foi aberto em uma nova aba. No celular, toque em compartilhar ou no menu do navegador para imprimir.',
  };
}

async function blobToPrintableIframe(blob: Blob): Promise<PrintPdfResult> {
  const blobUrl = URL.createObjectURL(blob);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.src = blobUrl;

  document.body.appendChild(iframe);

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('Tempo excedido ao preparar impressão.'));
    }, 15000);

    iframe.onload = () => {
      window.clearTimeout(timeout);
      resolve();
    };

    iframe.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error('Não foi possível carregar o PDF para impressão.'));
    };
  });

  await wait(450);

  try {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  } catch {
    iframe.remove();
    return openBlobInNewTab(blob);
  }

  const cleanup = () => {
    window.setTimeout(() => {
      iframe.remove();
      URL.revokeObjectURL(blobUrl);
    }, 2000);
  };

  iframe.contentWindow?.addEventListener?.('afterprint', cleanup, { once: true });
  window.setTimeout(cleanup, 60000);

  return {
    mode: 'print-dialog',
    message: 'Janela de impressão aberta.',
  };
}

export async function printPdfBlob(blob: Blob, options?: PrintPdfOptions): Promise<PrintPdfResult> {
  if (!blob || blob.size === 0) {
    throw new Error('PDF inválido para impressão.');
  }

  if (isMobilePrintEnvironment()) {
    return openBlobInNewTab(blob, options?.fileName);
  }

  return blobToPrintableIframe(blob);
}

export async function printPdfFromUrl(
  url: string,
  options?: PrintPdfOptions
): Promise<PrintPdfResult> {
  if (isMobilePrintEnvironment()) {
    return openUrlInNewTab(buildUrlWithToken(url, options?.token));
  }

  const blob = await fetchPdfBlob(url, 'GET', undefined, options);
  return printPdfBlob(blob, options);
}

export async function printPdfFromPost(
  url: string,
  body: unknown,
  options?: PrintPdfOptions
): Promise<PrintPdfResult> {
  const blob = await fetchPdfBlob(url, 'POST', body, options);
  return printPdfBlob(blob, options);
}
