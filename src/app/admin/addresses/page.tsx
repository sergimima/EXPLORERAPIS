'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface KnownAddress {
  id: string;
  address: string;
  name: string;
  type: string;
  category: string | null;
  description: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export default function AdminAddressesPage() {
  const [addresses, setAddresses] = useState<KnownAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/addresses');
      if (response.ok) {
        const data = await response.json();
        setAddresses(data.addresses || []);
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/addresses/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setAddresses(addresses.filter((addr) => addr.id !== id));
        setShowDeleteModal(false);
        setDeleteTarget(null);
      } else {
        alert('Error al eliminar address');
      }
    } catch (error) {
      console.error('Error deleting address:', error);
      alert('Error al eliminar address');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`¿Eliminar ${selectedIds.size} addresses?`)) return;

    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/addresses/${id}`, { method: 'DELETE' })
        )
      );

      setAddresses(addresses.filter((addr) => !selectedIds.has(addr.id)));
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error bulk deleting:', error);
      alert('Error al eliminar addresses');
    }
  };

  const handleExportCSV = () => {
    const filtered = getFilteredAddresses();
    const csv = [
      ['Address', 'Name', 'Type', 'Category', 'Description', 'Tags'].join(','),
      ...filtered.map((addr) =>
        [
          addr.address,
          addr.name,
          addr.type,
          addr.category || '',
          addr.description || '',
          addr.tags.join(';'),
        ]
          .map((field) => `"${field}"`)
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `addresses_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const filtered = getFilteredAddresses();
    const json = JSON.stringify(filtered, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `addresses_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    const filtered = getFilteredAddresses();
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((addr) => addr.id)));
    }
  };

  const getFilteredAddresses = () => {
    return addresses.filter((addr) => {
      const matchesSearch =
        searchQuery === '' ||
        addr.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        addr.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        addr.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = typeFilter === 'all' || addr.type === typeFilter;

      return matchesSearch && matchesType;
    });
  };

  const getPaginatedAddresses = () => {
    const filtered = getFilteredAddresses();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  };

  const filteredAddresses = getFilteredAddresses();
  const paginatedAddresses = getPaginatedAddresses();
  const totalPages = Math.ceil(filteredAddresses.length / itemsPerPage);

  const types = Array.from(new Set(addresses.map((addr) => addr.type)));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Cargando addresses...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">📝 Gestión de Addresses</h1>
          <p className="text-gray-600 mt-1">
            {addresses.length} addresses etiquetadas
          </p>
        </div>
        <Link
          href="/admin/addresses/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Nueva Address
        </Link>
      </div>

      {/* Filtros y búsqueda */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[300px]">
            <input
              type="text"
              placeholder="🔍 Buscar por address, nombre o descripción..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-2 items-center">
            <label className="text-sm text-gray-600">Tipo:</label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos</option>
              {types.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              📥 CSV
            </button>
            <button
              onClick={handleExportJSON}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
            >
              📥 JSON
            </button>
          </div>
        </div>

        {filteredAddresses.length !== addresses.length && (
          <div className="mt-2 text-sm text-gray-600">
            Mostrando {filteredAddresses.length} de {addresses.length} addresses
          </div>
        )}
      </div>

      {/* Acciones masivas */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center justify-between">
          <div className="text-blue-900 font-medium">
            {selectedIds.size} addresses seleccionadas
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              🗑️ Eliminar seleccionadas
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.size === filteredAddresses.length &&
                      filteredAddresses.length > 0
                    }
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Address
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Nombre
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Categoría
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Tags
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedAddresses.map((addr) => (
                <tr key={addr.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(addr.id)}
                      onChange={() => toggleSelect(addr.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`https://basescan.org/address/${addr.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-mono text-sm"
                    >
                      {addr.address.slice(0, 10)}...{addr.address.slice(-8)}
                    </a>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {addr.name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                      {addr.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {addr.category || '-'}
                  </td>
                  <td className="px-4 py-3">
                    {addr.tags.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {addr.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                        {addr.tags.length > 2 && (
                          <span className="text-xs text-gray-500">
                            +{addr.tags.length - 2}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">Sin tags</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <Link
                        href={`/admin/addresses/${addr.id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        ✏️
                      </Link>
                      <button
                        onClick={() => {
                          setDeleteTarget(addr.id);
                          setShowDeleteModal(true);
                        }}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Página {currentPage} de {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                ← Anterior
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1 rounded text-sm ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de confirmación de eliminar */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              ¿Eliminar address?
            </h3>
            <p className="text-gray-600 mb-6">
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
