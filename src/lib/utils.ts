import { Network } from './types';

/**
 * Obtiene la URL del explorador de bloques para una red específica
 * @param network Red blockchain
 * @returns URL del explorador
 */
export function getExplorerUrl(network: Network): string {
  switch (network) {
    case 'base':
      return 'https://basescan.org';
    case 'base-testnet':
      return 'https://goerli.basescan.org';
    default:
      return 'https://basescan.org';
  }
}

/**
 * Formatea una fecha Unix timestamp a formato legible
 * @param timestamp Unix timestamp en segundos
 * @returns Fecha formateada
 */
export function formatDate(timestamp: number): string {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}
