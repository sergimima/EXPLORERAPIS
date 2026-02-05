'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';

export default function AbiSettingsPage() {
  const params = useParams();
  const tokenId = params.id as string;

  const [abiSource, setAbiSource] = useState<'standard' | 'custom'>('standard');
  const [customAbi, setCustomAbi] = useState<any>(null);
  const [abiJson, setAbiJson] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    fetchAbi();
  }, [tokenId]);

  const fetchAbi = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tokens/${tokenId}/abi`);
      const data = await res.json();

      if (data.source !== 'STANDARD') {
        setAbiSource('custom');
        setCustomAbi(data);
        setAbiJson(JSON.stringify(data.abi, null, 2));
      }
    } catch (error) {
      console.error('Error fetching ABI:', error);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const abi = JSON.parse(abiJson);
      await fetch(`/api/tokens/${tokenId}/abi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ abi, source: 'UPLOADED' })
      });
      toast.success('ABI guardado correctamente');
      fetchAbi();
    } catch (error: any) {
      toast.error('Error al guardar ABI: ' + (error.message || 'Error desconocido'));
    }
    setSaving(false);
  };

  const handleDetect = async () => {
    setDetecting(true);
    try {
      const res = await fetch(`/api/tokens/${tokenId}/abi/detect`, {
        method: 'POST'
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(`ABI detectado: ${data.customAbi.methodCount} métodos, ${data.customAbi.eventCount} eventos`);
        fetchAbi();
      } else {
        toast.error(data.error || 'Error al detectar ABI');
      }
    } catch (error: any) {
      toast.error('Error al detectar ABI: ' + (error.message || 'Error desconocido'));
    }
    setDetecting(false);
  };

  const handleDelete = async () => {
    if (!confirm('¿Volver al ABI estándar ERC20?')) return;

    setSaving(true);
    try {
      await fetch(`/api/tokens/${tokenId}/abi`, {
        method: 'DELETE'
      });
      toast.success('ABI custom eliminado. Ahora se usa el ABI estándar.');
      setAbiSource('standard');
      setCustomAbi(null);
      setAbiJson('');
      fetchAbi();
    } catch (error: any) {
      toast.error('Error al eliminar ABI: ' + (error.message || 'Error desconocido'));
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">ABI del Token</h2>
        <p className="text-muted-foreground">
          Configura el ABI del contrato. Por defecto se usa el ABI estándar ERC20.
        </p>
      </div>

      {/* ABI Source Selection */}
      <div className="bg-card rounded-lg shadow p-6 border border-border">
        <h3 className="text-lg font-semibold mb-4">Tipo de ABI</h3>

        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={abiSource === 'standard'}
              onChange={() => setAbiSource('standard')}
              className="w-4 h-4"
            />
            <span className="font-medium">ABI Estándar ERC20</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={abiSource === 'custom'}
              onChange={() => setAbiSource('custom')}
              className="w-4 h-4"
            />
            <span className="font-medium">ABI Custom</span>
          </label>
        </div>
      </div>

      {/* Custom ABI Section */}
      {abiSource === 'custom' && (
        <>
          {/* Actions */}
          <div className="bg-card rounded-lg shadow p-6 border border-border">
            <h3 className="text-lg font-semibold mb-4">Acciones Rápidas</h3>

            <div className="flex gap-3">
              <button
                onClick={handleDetect}
                disabled={detecting}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 font-medium"
              >
                {detecting ? 'Detectando...' : '🔍 Auto-detectar desde BaseScan'}
              </button>
              {customAbi && (
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 disabled:opacity-50 font-medium"
                >
                  ↺ Volver a Estándar
                </button>
              )}
            </div>
          </div>

          {/* Current ABI Info */}
          {customAbi && (
            <div className="bg-success/10 border border-success rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">✅</div>
                <div className="flex-1">
                  <p className="font-medium text-success">ABI Custom Configurado</p>
                  <div className="text-sm text-success mt-1 space-y-1">
                    <p>• Origen: <strong>{customAbi.source}</strong></p>
                    <p>• Métodos: <strong>{customAbi.methodCount || 0}</strong></p>
                    <p>• Eventos: <strong>{customAbi.eventCount || 0}</strong></p>
                    <p>• Actualizado: <strong>{new Date(customAbi.updatedAt).toLocaleString()}</strong></p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ABI Editor */}
          <div className="bg-card rounded-lg shadow p-6 border border-border">
            <h3 className="text-lg font-semibold mb-4">Editor de ABI</h3>

            <div>
              <label className="block text-sm font-medium mb-2">
                ABI JSON
              </label>
              <textarea
                value={abiJson}
                onChange={(e) => setAbiJson(e.target.value)}
                placeholder='[{"type": "function", "name": "transfer", ...}]'
                className="w-full px-3 py-2 border rounded font-mono text-xs focus:ring-2 focus:ring-primary focus:border-transparent"
                rows={12}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Pega el ABI en formato JSON. Puedes obtenerlo desde BaseScan o usar auto-detección.
              </p>
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !abiJson}
              className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {saving ? 'Guardando...' : 'Guardar ABI'}
            </button>
          </div>

          {/* Info Box */}
          <div className="bg-accent border border-border rounded-lg p-4">
            <p className="text-sm text-accent-foreground">
              <strong>💡 Tip:</strong> El ABI custom solo se aplica al contrato del token principal.
              Para otros contratos (vesting, staking, etc.), configura ABIs individuales en la sección "Contratos".
            </p>
          </div>
        </>
      )}

      {/* Standard ABI Info */}
      {abiSource === 'standard' && (
        <div className="bg-background border border-border rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="text-2xl">📄</div>
            <div className="flex-1">
              <p className="font-medium text-card-foreground mb-2">Usando ABI Estándar ERC20</p>
              <p className="text-sm text-muted-foreground">
                El ABI estándar incluye los métodos básicos de ERC20: transfer, balanceOf, approve, transferFrom, etc.
                Es suficiente para la mayoría de tokens.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Si tu token tiene métodos custom (mint, burn, pause, etc.), cambia a "ABI Custom" para tener acceso completo.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
