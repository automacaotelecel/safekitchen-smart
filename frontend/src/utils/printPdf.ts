type PrintPdfOptions = {
  token?: string | null;
  fileName?: string;
};

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function blobToPrintableIframe(blob: Blob) {
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

  await wait(350);

  try {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  } catch {
    window.open(blobUrl, '_blank');
  }

  const cleanup = () => {
    window.setTimeout(() => {
      iframe.remove();
      URL.revokeObjectURL(blobUrl);
    }, 2000);
  };

  iframe.contentWindow?.addEventListener?.('afterprint', cleanup, { once: true });

  window.setTimeout(cleanup, 60000);
}

export async function printPdfBlob(blob: Blob) {
  if (!blob || blob.size === 0) {
    throw new Error('PDF inválido para impressão.');
  }

  await blobToPrintableIframe(blob);
}

export async function printPdfFromUrl(url: string, options?: PrintPdfOptions) {
  const headers: HeadersInit = {};

  if (options?.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    let message = 'Erro ao carregar PDF para impressão.';

    try {
      const json = await response.json();
      message = json?.message || message;
    } catch {
      // mantém mensagem padrão
    }

    throw new Error(message);
  }

  const blob = await response.blob();

  await printPdfBlob(blob);
}

export async function printPdfFromPost(
  url: string,
  body: unknown,
  options?: PrintPdfOptions
) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (options?.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = 'Erro ao gerar PDF para impressão.';

    try {
      const json = await response.json();
      message = json?.message || message;
    } catch {
      // mantém mensagem padrão
    }

    throw new Error(message);
  }

  const blob = await response.blob();

  await printPdfBlob(blob);
}