import { FormEvent, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Plus,
  RefreshCcw,
  Thermometer,
} from 'lucide-react';

import { api } from '../api/client';
import { localDateTimeInput } from '../utils/date';
import type {
  TemperatureCategory,
  TemperaturePoint,
  TemperatureReading,
} from '../types';

const categoryLabels: Record<TemperatureCategory, string> = {
  EQUIPMENT: 'Equipamentos',
  PREPARATION: 'Durante o preparo',
  DELIVERY: 'Durante a entrega',
  FRYING_OIL: 'Óleo de fritura',
  READY_FOOD: 'Alimento pronto',
  REFRIGERATED_FOOD: 'Alimento refrigerado',
  DISTRIBUTION: 'Distribuição',
  RECEIVING: 'Recebimento de perecíveis',
};

const categories = Object.keys(categoryLabels) as TemperatureCategory[];

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR');
}

type DeviceCreated = {
  device: {
    id: string;
    name: string;
  };
  apiKey: string;
  ingestPath: string;
  warning: string;
};

export function TemperatureControl() {
  const [readings, setReadings] = useState<TemperatureReading[]>([]);
  const [points, setPoints] = useState<TemperaturePoint[]>([]);
  const [summary, setSummary] = useState({
    total24h: 0,
    alerts24h: 0,
    activeDevices: 0,
  });
  const [form, setForm] = useState({
    category: 'EQUIPMENT' as TemperatureCategory,
    pointId: '',
    subject: '',
    temperatureC: '',
    secondaryTemperatureC: '',
    tertiaryTemperatureC: '',
    occurredAt: localDateTimeInput(),
    responsibleName: '',
    notes: '',
    destination: '',
  });
  const [pointForm, setPointForm] = useState({
    name: '',
    category: 'EQUIPMENT' as TemperatureCategory,
    minTemperature: '',
    maxTemperature: '',
  });
  const [deviceForm, setDeviceForm] = useState({
    name: '',
    pointId: '',
    protocol: 'API',
  });
  const [createdDevice, setCreatedDevice] = useState<DeviceCreated | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setMessage('');

    try {
      const [summaryData, pointsData, readingsData] = await Promise.all([
        api<typeof summary>('/api/temperature/summary'),
        api<TemperaturePoint[]>('/api/temperature/points'),
        api<TemperatureReading[]>('/api/temperature/readings?limit=100'),
      ]);

      setSummary(summaryData);
      setPoints(pointsData);
      setReadings(readingsData);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao carregar temperaturas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveReading(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      await api<TemperatureReading>('/api/temperature/readings', {
        method: 'POST',
        body: JSON.stringify({
          category: form.category,
          pointId: form.pointId || null,
          subject: form.subject,
          temperatureC: Number(form.temperatureC),
          secondaryTemperatureC: form.secondaryTemperatureC
            ? Number(form.secondaryTemperatureC)
            : null,
          tertiaryTemperatureC: form.tertiaryTemperatureC
            ? Number(form.tertiaryTemperatureC)
            : null,
          occurredAt: new Date(form.occurredAt).toISOString(),
          responsibleName: form.responsibleName,
          notes: form.notes || null,
          metadata: {
            destination: form.destination || null,
          },
        }),
      });

      setForm((old) => ({
        ...old,
        subject: '',
        temperatureC: '',
        secondaryTemperatureC: '',
        tertiaryTemperatureC: '',
        occurredAt: localDateTimeInput(),
        notes: '',
        destination: '',
      }));
      setMessage('Medição registrada com sucesso.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao registrar medição.');
    } finally {
      setSaving(false);
    }
  }

  async function savePoint(event: FormEvent) {
    event.preventDefault();
    setMessage('');

    try {
      const point = await api<TemperaturePoint>('/api/temperature/points', {
        method: 'POST',
        body: JSON.stringify({
          name: pointForm.name,
          category: pointForm.category,
          minTemperature: pointForm.minTemperature
            ? Number(pointForm.minTemperature)
            : null,
          maxTemperature: pointForm.maxTemperature
            ? Number(pointForm.maxTemperature)
            : null,
        }),
      });

      setPointForm({
        name: '',
        category: 'EQUIPMENT',
        minTemperature: '',
        maxTemperature: '',
      });
      setForm((old) => ({ ...old, pointId: point.id, category: point.category }));
      setMessage('Ponto de medição cadastrado.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao cadastrar ponto.');
    }
  }

  async function saveDevice(event: FormEvent) {
    event.preventDefault();
    setCreatedDevice(null);
    setMessage('');

    try {
      const data = await api<DeviceCreated>('/api/temperature/devices', {
        method: 'POST',
        body: JSON.stringify({
          name: deviceForm.name,
          pointId: deviceForm.pointId || null,
          protocol: deviceForm.protocol,
        }),
      });

      setCreatedDevice(data);
      setDeviceForm({ name: '', pointId: '', protocol: 'API' });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao cadastrar dispositivo.');
    }
  }

  const pointsForCategory = points.filter((point) => point.category === form.category);
  const showSecondaryTemperature = [
    'DELIVERY',
    'DISTRIBUTION',
    'REFRIGERATED_FOOD',
    'READY_FOOD',
  ].includes(form.category);
  const showTertiaryTemperature = ['DELIVERY', 'DISTRIBUTION'].includes(
    form.category
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-safe-green">
              Segurança dos alimentos
            </p>
            <h1 className="mt-2 text-3xl font-black text-safe-dark">Controle de temperatura</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-500">
              Registre medições manuais ou receba leituras de termômetros e gateways compatíveis.
              Limites configurados geram alertas automaticamente.
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"
          >
            <RefreshCcw size={16} />
            Atualizar
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Medições em 24h" value={summary.total24h} icon={Thermometer} />
          <SummaryCard label="Alertas em 24h" value={summary.alerts24h} icon={AlertTriangle} alert />
          <SummaryCard label="Dispositivos ativos" value={summary.activeDevices} icon={Cpu} />
        </div>

        {message && (
          <div className="mt-4 rounded-2xl bg-safe-soft px-4 py-3 text-sm font-bold text-safe-dark">
            {message}
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <form
          onSubmit={saveReading}
          className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-xl font-black text-safe-dark">Nova medição manual</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Tipo de controle">
              <select
                value={form.category}
                onChange={(event) =>
                  setForm((old) => ({
                    ...old,
                    category: event.target.value as TemperatureCategory,
                    pointId: '',
                  }))
                }
                className="input-base"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabels[category]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Ponto/área de medição">
              <select
                value={form.pointId}
                onChange={(event) =>
                  setForm((old) => ({ ...old, pointId: event.target.value }))
                }
                className="input-base"
              >
                <option value="">Sem área/ponto cadastrado</option>
                {pointsForCategory.map((point) => (
                  <option key={point.id} value={point.id}>
                    {point.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                É o local físico ou equipamento onde a medição acontece, por exemplo:
                açougue, câmara fria, freezer, área de preparo ou balcão de distribuição.
              </p>
            </Field>

            <Field label={form.category === 'EQUIPMENT' ? 'Equipamento' : 'Alimento/produto'}>
              <input
                required
                value={form.subject}
                onChange={(event) =>
                  setForm((old) => ({ ...old, subject: event.target.value }))
                }
                className="input-base"
                placeholder="Ex.: Câmara fria 01"
              />
            </Field>

            <Field label="Temperatura (°C)">
              <input
                required
                type="number"
                step="0.1"
                min="-100"
                max="400"
                value={form.temperatureC}
                onChange={(event) =>
                  setForm((old) => ({ ...old, temperatureC: event.target.value }))
                }
                className="input-base"
              />
            </Field>

            {form.category === 'READY_FOOD' && (
              <Field label="Destino do produto">
                <input
                  value={form.destination}
                  onChange={(event) =>
                    setForm((old) => ({
                      ...old,
                      destination: event.target.value,
                    }))
                  }
                  className="input-base"
                  placeholder="Ex.: distribuição, resfriamento"
                />
              </Field>
            )}

            {showSecondaryTemperature && (
              <>
                <Field
                  label={
                    form.category === 'READY_FOOD'
                      ? 'Temperatura final para distribuição (°C)'
                      : 'Temperatura após 2h (°C)'
                  }
                >
                  <input
                    type="number"
                    step="0.1"
                    value={form.secondaryTemperatureC}
                    onChange={(event) =>
                      setForm((old) => ({
                        ...old,
                        secondaryTemperatureC: event.target.value,
                      }))
                    }
                    className="input-base"
                  />
                </Field>
              </>
            )}

            {showTertiaryTemperature && (
              <>
                <Field label="Temperatura após 4h/final (°C)">
                  <input
                    type="number"
                    step="0.1"
                    value={form.tertiaryTemperatureC}
                    onChange={(event) =>
                      setForm((old) => ({
                        ...old,
                        tertiaryTemperatureC: event.target.value,
                      }))
                    }
                    className="input-base"
                  />
                </Field>
              </>
            )}

            <Field label="Data e horário">
              <input
                required
                type="datetime-local"
                value={form.occurredAt}
                onChange={(event) =>
                  setForm((old) => ({ ...old, occurredAt: event.target.value }))
                }
                className="input-base"
              />
            </Field>

            <Field label="Responsável">
              <input
                required
                value={form.responsibleName}
                onChange={(event) =>
                  setForm((old) => ({ ...old, responsibleName: event.target.value }))
                }
                className="input-base"
              />
            </Field>

            <div className="md:col-span-2">
              <Field label="Observação">
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((old) => ({ ...old, notes: event.target.value }))
                  }
                  className="input-base min-h-24"
                />
              </Field>
            </div>
          </div>

          <button
            disabled={saving}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-safe-green px-5 py-4 text-sm font-black text-white disabled:opacity-60"
          >
            <Plus size={18} />
            {saving ? 'Salvando...' : 'Registrar medição'}
          </button>
        </form>

        <div className="space-y-4">
          <details className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <summary className="cursor-pointer text-lg font-black text-safe-dark">
              Cadastrar área/ponto e limites
            </summary>
            <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
              “Ponto” representa uma área da cozinha ou um equipamento específico que precisa
              ser monitorado.
            </p>
            <form onSubmit={savePoint} className="mt-4 space-y-3">
              <input
                required
                value={pointForm.name}
                onChange={(event) =>
                  setPointForm((old) => ({ ...old, name: event.target.value }))
                }
                className="input-base"
                placeholder="Ex.: Açougue, câmara fria 01 ou freezer"
              />
              <select
                value={pointForm.category}
                onChange={(event) =>
                  setPointForm((old) => ({
                    ...old,
                    category: event.target.value as TemperatureCategory,
                  }))
                }
                className="input-base"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabels[category]}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  step="0.1"
                  value={pointForm.minTemperature}
                  onChange={(event) =>
                    setPointForm((old) => ({
                      ...old,
                      minTemperature: event.target.value,
                    }))
                  }
                  className="input-base"
                  placeholder="Mínima °C"
                />
                <input
                  type="number"
                  step="0.1"
                  value={pointForm.maxTemperature}
                  onChange={(event) =>
                    setPointForm((old) => ({
                      ...old,
                      maxTemperature: event.target.value,
                    }))
                  }
                  className="input-base"
                  placeholder="Máxima °C"
                />
              </div>
              <button className="w-full rounded-2xl bg-safe-dark px-4 py-3 text-sm font-black text-white">
                Salvar ponto
              </button>
            </form>
          </details>

          <details className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <summary className="cursor-pointer text-lg font-black text-safe-dark">
              Integração automática
            </summary>
            <p className="mt-3 text-sm font-medium leading-6 text-slate-500">
              Cadastre um termômetro Wi-Fi ou um gateway BLE/API. O aparelho deve enviar as
              leituras para o endereço e a chave gerados pelo sistema.
            </p>
            <form onSubmit={saveDevice} className="mt-4 space-y-3">
              <input
                required
                value={deviceForm.name}
                onChange={(event) =>
                  setDeviceForm((old) => ({ ...old, name: event.target.value }))
                }
                className="input-base"
                placeholder="Nome do dispositivo"
              />
              <select
                value={deviceForm.pointId}
                onChange={(event) =>
                  setDeviceForm((old) => ({ ...old, pointId: event.target.value }))
                }
                className="input-base"
              >
                <option value="">Sem ponto vinculado</option>
                {points.map((point) => (
                  <option key={point.id} value={point.id}>
                    {point.name}
                  </option>
                ))}
              </select>
              <select
                value={deviceForm.protocol}
                onChange={(event) =>
                  setDeviceForm((old) => ({ ...old, protocol: event.target.value }))
                }
                className="input-base"
              >
                <option value="API">API/HTTP</option>
                <option value="WIFI">Wi-Fi</option>
                <option value="BLE_GATEWAY">Gateway Bluetooth</option>
                <option value="MQTT">MQTT</option>
              </select>
              <button className="w-full rounded-2xl bg-safe-dark px-4 py-3 text-sm font-black text-white">
                Gerar integração
              </button>
            </form>

            {createdDevice && (
              <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-xs font-bold text-amber-800">
                <p>{createdDevice.warning}</p>
                <p className="mt-2 break-all">Rota: {createdDevice.ingestPath}</p>
                <p className="mt-2 break-all">Chave: {createdDevice.apiKey}</p>
              </div>
            )}
          </details>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black text-safe-dark">Histórico de medições</h2>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Carregando...</p>
        ) : readings.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500">
            Nenhuma medição registrada.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {readings.map((reading) => (
              <article
                key={reading.id}
                className={`rounded-2xl border p-4 ${
                  reading.status === 'ALERT'
                    ? 'border-red-200 bg-red-50'
                    : 'border-emerald-100 bg-emerald-50/60'
                }`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      {reading.status === 'ALERT' ? (
                        <AlertTriangle size={18} className="text-red-600" />
                      ) : (
                        <CheckCircle2 size={18} className="text-emerald-600" />
                      )}
                      <p className="font-black text-safe-dark">{reading.subject}</p>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {categoryLabels[reading.category]} • {formatDate(reading.occurredAt)} •{' '}
                      {reading.responsibleName} • {reading.source === 'DEVICE' ? 'Automática' : 'Manual'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-safe-dark">
                      {reading.temperatureC.toFixed(1)} °C
                    </p>
                    {(reading.secondaryTemperatureC !== null &&
                      reading.secondaryTemperatureC !== undefined) && (
                      <p className="text-xs font-bold text-slate-500">
                        2h: {reading.secondaryTemperatureC.toFixed(1)} °C
                        {reading.tertiaryTemperatureC !== null &&
                          reading.tertiaryTemperatureC !== undefined &&
                          ` • final: ${reading.tertiaryTemperatureC.toFixed(1)} °C`}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-700">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  alert = false,
}: {
  label: string;
  value: number;
  icon: typeof Thermometer;
  alert?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-4 ${alert ? 'bg-red-50 text-red-700' : 'bg-safe-soft text-safe-dark'}`}>
      <Icon size={20} />
      <p className="mt-3 text-3xl font-black">{value}</p>
      <p className="text-xs font-bold uppercase tracking-wider opacity-70">{label}</p>
    </div>
  );
}

export default TemperatureControl;
