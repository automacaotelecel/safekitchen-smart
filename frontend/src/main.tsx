import React, { useEffect, useState } from 'react';

export const InstallButton = () => {
  // Estado para guardar o evento de instalação do navegador
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Função para capturar o evento
    const handleBeforeInstallPrompt = (e: Event) => {
      // Impede o navegador de mostrar o prompt padrão imediatamente
      e.preventDefault();
      // Guarda o evento no estado para usarmos quando o usuário clicar no botão
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Limpeza do evento
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Mostra o prompt de instalação nativo do navegador
    deferredPrompt.prompt();

    // Aguarda a escolha do usuário (aceitou ou recusou)
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('O usuário aceitou a instalação do PWA');
    } else {
      console.log('O usuário recusou a instalação do PWA');
    }

    // Limpa o prompt guardado, pois ele só pode ser usado uma vez
    setDeferredPrompt(null);
  };

  // Se o evento ainda não foi disparado (ou se o app já está instalado), não renderiza o botão
  if (!deferredPrompt) {
    return null; 
  }

  return (
    <button onClick={handleInstallClick} className="seu-estilo-de-botao-aqui">
      Baixar Aplicativo
    </button>
  );
};