type SharePdfOptions = {
  token?: string | null;
  fileName?: string;
  title?: string;
  text?: string;
};

function getSafeFileName(fileName?: string) {
  const base = fileName?.trim() || 'etiqueta-safekitchen.pdf';

  if (base.toLowerCase().endsWith('.pdf')) {
    return base;
  }

  return `${base}.pdf`;
}

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;

  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(
    navigator.userAgent
  );
}

function openUrlInNewTab(url: string) {
  const opened = window.open(url, '_blank', 'noopener,noreferrer');

  if (!opened) {
    window.location.href = url;
  }
}

function openBlobInNewTab(blob: Blob) {
  const blobUrl = URL.createObjectURL(blob);
  const opened = window.open(blobUrl, '_blank', 'noopener,noreferrer');

  if (!opened) {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = 'etiquetas-safekitchen.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  window.setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 60_000);
}

async function sharePdfBlob(blob: Blob, options?: SharePdfOptions) {
  const fileName = getSafeFileName(options?.fileName);
  const file = new File([blob], fileName, {
    type: 'application/pdf',
  });

  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };

  const canShareFiles =
    typeof nav.share === 'function' &&
    typeof nav.canShare === 'function' &&
    nav.canShare({
      files: [file],
    });

  if (!canShareFiles) {
    return false;
  }

  await nav.share({
    title: options?.title || 'Etiqueta SafeKitchen',
    text:
      options?.text ||
      'Etiqueta gerada pelo SafeKitchen Smart. Você pode imprimir, salvar ou compartilhar.',
    files: [file],
  });

  return true;
}

async function fetchPdfFromUrl(url: string, options?: SharePdfOptions) {
  const headers: HeadersInit = {};

  if (options?.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    let message = 'Erro ao carregar PDF.';

    try {
      const json = await response.json();
      message = json?.message || message;
    } catch {
      // mantém mensagem padrão
    }

    throw new Error(message);
  }

  return response.blob();
}

async function fetchPdfFromPost(
  url: string,
  body: unknown,
  options?: SharePdfOptions
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
    let message = 'Erro ao gerar PDF.';

    try {
      const json = await response.json();
      message = json?.message || message;
    } catch {
      // mantém mensagem padrão
    }

    throw new Error(message);
  }

  return response.blob();
}

export async function shareOrOpenPdfFromUrl(
  url: string,
  options?: SharePdfOptions
) {
  const mobile = isMobileDevice();
  const blob = await fetchPdfFromUrl(url, options);

  if (!mobile) {
    openBlobInNewTab(blob);
    return {
      mode: 'opened' as const,
      message: 'PDF aberto em nova aba. Use Ctrl+P ou o botão de imprimir do navegador.',
    };
  }

  try {
    const shared = await sharePdfBlob(blob, options);

    if (shared) {
      return {
        mode: 'shared' as const,
        message:
          'Etiqueta enviada para o compartilhamento do celular. Escolha imprimir, salvar ou enviar.',
      };
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        mode: 'cancelled' as const,
        message: 'Compartilhamento cancelado.',
      };
    }

    console.warn('Falha no compartilhamento do PDF:', error);
  }

  openBlobInNewTab(blob);

  return {
    mode: 'opened' as const,
    message:
      'PDF aberto. No celular, use o menu do navegador/visualizador para imprimir ou compartilhar.',
  };
}

export async function shareOrOpenPdfFromPost(
  url: string,
  body: unknown,
  options?: SharePdfOptions
) {
  const blob = await fetchPdfFromPost(url, body, options);

  if (isMobileDevice()) {
    try {
      const shared = await sharePdfBlob(blob, options);

      if (shared) {
        return {
          mode: 'shared' as const,
          message:
            'Etiquetas enviadas para o compartilhamento do celular. Escolha imprimir, salvar ou enviar.',
        };
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return {
          mode: 'cancelled' as const,
          message: 'Compartilhamento cancelado.',
        };
      }

      console.warn('Falha no compartilhamento do PDF:', error);
    }
  }

  openBlobInNewTab(blob);

  return {
    mode: 'opened' as const,
    message:
      'PDF aberto. Use a opção de imprimir, salvar ou compartilhar do navegador/visualizador.',
  };
}

export function getMobilePrintHelpText() {
  if (!isMobileDevice()) {
    return 'No computador, o PDF será aberto em uma nova aba para impressão.';
  }

  return 'No celular, o sistema abre o compartilhamento quando possível. Se não abrir, o PDF será exibido para você tocar em Compartilhar ou Imprimir.';
}
