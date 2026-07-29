import { AlertTriangle, Bell, BellRing, CheckCheck, CircleAlert, Mail, RefreshCcw, Settings2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../api/client';
import type { AppNotification, NotificationPreference } from '../types';
import {
  disableDeviceNotifications,
  enableDeviceNotifications,
  getDeviceNotificationStatus,
  type DeviceNotificationStatus,
} from '../utils/deviceNotifications';

const preferenceLabels: Array<[keyof NotificationPreference, string]> = [
  ['inAppEnabled', 'Alertas dentro do aplicativo'],
  ['emailEnabled', 'Enviar alertas por e-mail'],
  ['labelsEnabled', 'Etiquetas vencendo ou vencidas'],
  ['documentsEnabled', 'Documentos e licenças'],
  ['complianceEnabled', 'Controles sanitários'],
  ['temperatureEnabled', 'Temperaturas fora do limite'],
  ['deviceOfflineEnabled', 'Dispositivos de temperatura offline'],
];

export function Notifications() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [deviceStatus, setDeviceStatus] = useState<DeviceNotificationStatus>(
    getDeviceNotificationStatus,
  );

  async function load() {
    setLoading(true);
    try {
      const [notifications, preference] = await Promise.all([
        api<AppNotification[]>('/api/notifications?limit=100'),
        api<NotificationPreference>('/api/notifications/preferences'),
      ]);
      setItems(notifications);
      setPreferences(preference);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao carregar alertas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function updatePreference(key: keyof NotificationPreference, value: boolean) {
    if (!preferences) return;
    const optimistic = { ...preferences, [key]: value };
    setPreferences(optimistic);
    try {
      setPreferences(await api<NotificationPreference>('/api/notifications/preferences', {
        method: 'PATCH', body: JSON.stringify({ [key]: value }),
      }));
    } catch (error) {
      setPreferences(preferences);
      setMessage(error instanceof Error ? error.message : 'Erro ao salvar preferências.');
    }
  }

  async function markRead(item: AppNotification) {
    if (!item.readAt) await api(`/api/notifications/${item.id}/read`, { method: 'PATCH' });
    if (item.link) window.location.assign(item.link);
    else await load();
  }

  async function readAll() {
    await api('/api/notifications/read-all', { method: 'POST' });
    await load();
  }

  async function configureDeviceNotifications() {
    const status = await enableDeviceNotifications();
    setDeviceStatus(status);

    if (status === 'enabled') {
      setMessage('Notificações ativadas neste dispositivo.');
    } else if (status === 'denied') {
      setMessage('A permissão foi bloqueada. Libere as notificações nas configurações do navegador.');
    } else if (status === 'unsupported') {
      setMessage('Este navegador não oferece notificações para o SafeKitchen.');
    }
  }

  function turnOffDeviceNotifications() {
    disableDeviceNotifications();
    setDeviceStatus('disabled');
    setMessage('Notificações desativadas neste dispositivo.');
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border bg-white p-5 shadow-sm md:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.26em] text-safe-green">Central de alertas</p><h1 className="mt-2 text-3xl font-black">Notificações</h1><p className="mt-2 text-sm font-medium text-slate-500">Vencimentos, temperaturas e pendências importantes da operação.</p></div>
          <div className="flex flex-wrap gap-2"><button onClick={readAll} className="inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black"><CheckCheck size={17} /> Marcar lidas</button><button onClick={load} className="inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black"><RefreshCcw size={17} /> Atualizar</button></div>
        </div>
        {message && <div className="mt-4 rounded-2xl bg-safe-soft p-4 text-sm font-bold">{message}</div>}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="rounded-[28px] border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><Bell className="text-safe-green" /><h2 className="text-xl font-black">Alertas recentes</h2></div>
          {loading ? <p className="mt-6 text-sm text-slate-500">Atualizando alertas...</p> : items.length === 0 ? <p className="mt-6 rounded-2xl border border-dashed p-8 text-center text-sm font-semibold text-slate-500">Nenhuma pendência encontrada.</p> : (
            <div className="mt-5 space-y-3">{items.map((item) => {
              const critical = item.severity === 'CRITICAL';
              const Icon = critical ? CircleAlert : AlertTriangle;
              return <button key={item.id} onClick={() => markRead(item)} className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${item.readAt ? 'bg-slate-50 opacity-70' : critical ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}><Icon className={critical ? 'text-red-600' : 'text-amber-600'} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black">{item.title}</p><span className="text-xs font-bold text-slate-500">{new Date(item.createdAt).toLocaleString('pt-BR')}</span></div><p className="mt-1 text-sm leading-6 text-slate-600">{item.message}</p>{item.emailSentAt && <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-safe-green"><Mail size={13} /> E-mail enviado</span>}</div></button>;
            })}</div>
          )}
        </div>

        <aside className="h-fit rounded-[28px] border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><Settings2 className="text-safe-green" /><h2 className="text-xl font-black">Preferências</h2></div>
          <div className="mt-5 space-y-3">{preferences && preferenceLabels.map(([key, label]) => <label key={key} className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 text-sm font-bold"><span>{label}</span><input type="checkbox" checked={preferences[key]} onChange={(event) => updatePreference(key, event.target.checked)} className="h-5 w-5 accent-emerald-500" /></label>)}</div>
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <BellRing className="mt-0.5 shrink-0 text-safe-green" size={20} />
              <div>
                <p className="text-sm font-black text-safe-dark">Notificações deste dispositivo</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                  Receba um aviso visual e sonoro quando surgir um novo alerta enquanto o sistema estiver aberto.
                </p>
              </div>
            </div>

            {deviceStatus === 'enabled' ? (
              <>
                <div className="mt-4 rounded-xl bg-emerald-100 px-3 py-2 text-center text-xs font-black text-emerald-800">
                  Notificações ativadas
                </div>
                <button
                  type="button"
                  onClick={turnOffDeviceNotifications}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-black text-slate-600"
                >
                  Desativar neste dispositivo
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={configureDeviceNotifications}
                disabled={deviceStatus === 'unsupported'}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-safe-dark px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <BellRing size={17} />
                Configurar notificações
              </button>
            )}
          </div>
          <Link to="/assinatura" className="mt-3 block text-center text-xs font-bold text-safe-green">Ver plano e limites</Link>
        </aside>
      </section>
    </div>
  );
}
