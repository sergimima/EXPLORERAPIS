'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ImportRow {
  address: string;
  name: string;
  type: string;
  category?: string;
  description?: string;
  tags?: string;
}

export default function AdminImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);
  const router = useRouter();

  const downloadTemplate = () => {
    const template = [
      ['address', 'name', 'type', 'category', 'description', 'tags'].join(','),
      [
        '0x3cd751e6b0078be393132286c442345e5dc49699',
        'Coinbase',
        'Exchange',
        'CEX',
        'Coinbase hot wallet',
        'exchange;coinbase;cex',
      ].join(','),
      [
        '0xa699Cf416FFe6063317442c3Fbd0C39742E971c5',
        'Vottun World',
        'Vesting',
        'Vesting Contract',
        'World vesting contract',
        'vottun;vesting',
      ].join(','),
    ].join('\n');

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'address_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(selectedFile);
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter((line) => line.trim());
    if (lines.length < 2) {
      alert('CSV vacío o sin datos');
      return;
    }

    // Saltar header
    const dataLines = lines.slice(1);
    const parsed: ImportRow[] = [];

    for (const line of dataLines) {
      // Simple CSV parser (no maneja comillas complejas)
      const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));

      if (values.length < 3) continue; // Necesita al menos address, name, type

      parsed.push({
        address: values[0],
        name: values[1],
        type: values[2],
        category: values[3] || undefined,
        description: values[4] || undefined,
        tags: values[5] || undefined,
      });
    }

    setPreview(parsed);
  };

  const handleImport = async () => {
    if (preview.length === 0) return;

    setImporting(true);
    const errors: string[] = [];
    let successCount = 0;

    for (const row of preview) {
      try {
        // Validar address
        if (!/^0x[a-fA-F0-9]{40}$/.test(row.address)) {
          errors.push(`${row.address}: Formato de address inválido`);
          continue;
        }

        // Preparar datos
        const data = {
          address: row.address.toLowerCase(),
          name: row.name,
          type: row.type,
          category: row.category || null,
          description: row.description || null,
          tags: row.tags ? row.tags.split(';').map((t) => t.trim()) : [],
        };

        // Crear address
        const response = await fetch('/api/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (response.ok) {
          successCount++;
        } else {
          const error = await response.json();
          errors.push(`${row.address}: ${error.error || 'Error desconocido'}`);
        }
      } catch (error) {
        errors.push(`${row.address}: ${error}`);
      }
    }

    setResult({ success: successCount, errors });
    setImporting(false);

    if (successCount > 0) {
      setTimeout(() => {
        router.push('/admin/addresses');
      }, 3000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">📥 Importar Addresses</h1>
        <p className="text-gray-600 mt-1">
          Importa addresses desde un archivo CSV
        </p>
      </div>

      {/* Instrucciones */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-900 mb-2">📋 Instrucciones</h3>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Descarga la plantilla CSV haciendo clic en el botón abajo</li>
          <li>Completa el CSV con tus addresses</li>
          <li>Sube el archivo aquí</li>
          <li>Revisa la vista previa y confirma la importación</li>
        </ol>

        <button
          onClick={downloadTemplate}
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          📄 Descargar Plantilla CSV
        </button>
      </div>

      {/* Formato del CSV */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">Formato del CSV</h3>
        <div className="bg-gray-50 p-4 rounded border border-gray-200 font-mono text-xs overflow-x-auto">
          <div className="text-gray-600 mb-1">
            address,name,type,category,description,tags
          </div>
          <div className="text-gray-800">
            0x3cd7...,Coinbase,Exchange,CEX,Coinbase hot wallet,exchange;coinbase;cex
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm text-gray-600">
          <p>
            <strong>address:</strong> Dirección Ethereum (0x..., requerido)
          </p>
          <p>
            <strong>name:</strong> Nombre descriptivo (requerido)
          </p>
          <p>
            <strong>type:</strong> Tipo (Exchange, Vesting, Wallet, Contract, etc., requerido)
          </p>
          <p>
            <strong>category:</strong> Categoría (opcional)
          </p>
          <p>
            <strong>description:</strong> Descripción (opcional)
          </p>
          <p>
            <strong>tags:</strong> Tags separados por punto y coma (opcional)
          </p>
        </div>
      </div>

      {/* Upload */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">Seleccionar Archivo</h3>
        <div className="flex items-center gap-4">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
          {file && (
            <div className="text-sm text-gray-600 whitespace-nowrap">
              {file.name}
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">
              Vista Previa ({preview.length} addresses)
            </h3>
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {importing ? '⏳ Importando...' : '✅ Confirmar Importación'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                    Address
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                    Name
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                    Type
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                    Category
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                    Tags
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {preview.slice(0, 10).map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.address.slice(0, 10)}...
                    </td>
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                        {row.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {row.category || '-'}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {row.tags || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 10 && (
              <div className="text-center text-sm text-gray-500 py-2">
                ... y {preview.length - 10} más
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div
          className={`rounded-lg p-6 mb-6 ${
            result.errors.length === 0
              ? 'bg-green-50 border border-green-200'
              : 'bg-yellow-50 border border-yellow-200'
          }`}
        >
          <h3
            className={`font-semibold mb-2 ${
              result.errors.length === 0 ? 'text-green-900' : 'text-yellow-900'
            }`}
          >
            {result.errors.length === 0 ? '✅ Importación Exitosa' : '⚠️ Importación Completa con Errores'}
          </h3>
          <p
            className={`${
              result.errors.length === 0 ? 'text-green-800' : 'text-yellow-800'
            }`}
          >
            {result.success} addresses importadas correctamente
          </p>

          {result.errors.length > 0 && (
            <div className="mt-4">
              <p className="text-yellow-800 font-medium mb-2">
                {result.errors.length} errores:
              </p>
              <div className="bg-white rounded border border-yellow-300 p-3 max-h-60 overflow-y-auto">
                {result.errors.map((error, idx) => (
                  <div key={idx} className="text-sm text-red-600 py-1">
                    {error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.success > 0 && (
            <p className="text-green-700 text-sm mt-3">
              Redirigiendo a la lista de addresses en 3 segundos...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
