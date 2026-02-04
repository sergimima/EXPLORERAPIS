'use client';

import { useState, useEffect } from 'react';

interface EditAddressModalProps {
  address: string;
  currentName?: string;
  currentData?: any; // Datos completos de la dirección conocida si existe
  isOpen: boolean;
  onClose: () => void;
  onSave: (address: string, name: string) => void;
}

export default function EditAddressModal({
  address,
  currentName,
  currentData,
  isOpen,
  onClose,
  onSave,
}: EditAddressModalProps) {
  const [formAddress, setFormAddress] = useState(address || '');
  const [name, setName] = useState(currentName || '');
  const [type, setType] = useState<'CONTRACT' | 'WALLET' | 'EXCHANGE' | 'VESTING' | 'TOKEN' | 'UNKNOWN'>('WALLET');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormAddress(address || '');
      setName(currentName || currentData?.name || '');
      setType(currentData?.type || 'WALLET');
      setCategory(currentData?.category || '');
      setDescription(currentData?.description || '');
      setTags(currentData?.tags?.join(', ') || '');
      setColor(currentData?.color || '#3B82F6');
    }
  }, [address, currentName, currentData, isOpen]);

  const handleSave = async () => {
    if (!formAddress.trim()) {
      alert('La dirección no puede estar vacía');
      return;
    }

    if (!name.trim()) {
      alert('El nombre no puede estar vacío');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: formAddress.trim(),
          name: name.trim(),
          type,
          category: category.trim() || undefined,
          description: description.trim() || undefined,
          tags: tags.trim() ? tags.split(',').map(t => t.trim()).filter(t => t) : [],
          color: color || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save address');
      }

      const result = await response.json();
      onSave(formAddress.trim(), name.trim());
      onClose();
    } catch (error) {
      console.error('Error saving address:', error);
      alert('Error al guardar la dirección');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const isNewAddress = !address;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-border">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            {isNewAddress ? 'Añadir Nueva Dirección' : 'Editar Dirección Conocida'}
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Dirección */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dirección *
            </label>
            {isNewAddress ? (
              <input
                type="text"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            ) : (
              <div className="text-xs font-mono text-muted-foreground bg-muted p-2 rounded break-all">
                {address}
              </div>
            )}
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Mi Wallet Personal"
              className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo *
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="WALLET">Wallet</option>
              <option value="CONTRACT">Contract</option>
              <option value="EXCHANGE">Exchange</option>
              <option value="VESTING">Vesting</option>
              <option value="TOKEN">Token</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categoría
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ej: Team, Investor, Marketing..."
              className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción adicional..."
              rows={3}
              className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags (separados por comas)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="vesting, important, monitored"
              className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-20 border border-input rounded cursor-pointer"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#3B82F6"
                className="flex-1 px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Guardando...
              </>
            ) : (
              'Guardar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
