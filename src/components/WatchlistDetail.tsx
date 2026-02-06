'use client';

interface TokenTransfer {
  hash: string;
  from: string;
  to: string;
  value: string;
  valueFormatted: string;
  timestamp: number;
  blockNumber: number;
  isLargeTransfer: boolean;
}

interface HolderInfo {
  address: string;
  balance: string;
  percentage: string;
}

interface KnownAddressData {
  id: string;
  address: string;
  name: string;
  type: string;
  category?: string;
  description?: string;
  tags?: string[];
  color?: string;
  isFavorite: boolean;
}

interface WatchlistDetailProps {
  knownAddress: KnownAddressData;
  holderData?: HolderInfo;
  recentTransfers: TokenTransfer[];
  tokenSymbol: string;
  onClose: () => void;
}

export default function WatchlistDetail({
  knownAddress,
  holderData,
  recentTransfers,
  tokenSymbol,
  onClose,
}: WatchlistDetailProps) {
  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const typeColors: Record<string, string> = {
    CONTRACT: 'bg-accent text-accent-foreground',
    WALLET: 'bg-accent text-primary',
    EXCHANGE: 'bg-destructive/10 text-destructive',
    VESTING: 'bg-success/10 text-success',
    TOKEN: 'bg-warning/10 text-warning',
    UNKNOWN: 'bg-muted text-card-foreground',
  };

  return (
    <div className="bg-card rounded-lg border border-border p-5 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-lg font-semibold text-card-foreground">{knownAddress.name}</h4>
            <span className={`px-2 py-0.5 rounded text-xs ${typeColors[knownAddress.type] || typeColors.UNKNOWN}`}>
              {knownAddress.type}
            </span>
          </div>
          <a
            href={`https://basescan.org/address/${knownAddress.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:opacity-80 font-mono text-sm"
          >
            {knownAddress.address}
          </a>
          {knownAddress.category && (
            <p className="text-sm text-muted-foreground mt-1">{knownAddress.category}</p>
          )}
          {knownAddress.description && (
            <p className="text-sm text-muted-foreground mt-1">{knownAddress.description}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tags */}
      {knownAddress.tags && knownAddress.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {knownAddress.tags.map((tag, i) => (
            <span key={i} className="px-2 py-1 bg-muted text-card-foreground rounded text-xs">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Balance info */}
      {holderData && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className="text-lg font-bold text-card-foreground">
              {parseFloat(holderData.balance).toLocaleString()} {tokenSymbol}
            </p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground">% Supply</p>
            <p className="text-lg font-bold text-card-foreground">
              {parseFloat(holderData.percentage).toFixed(2)}%
            </p>
          </div>
        </div>
      )}

      {/* Recent transfers */}
      <div>
        <h5 className="text-sm font-medium text-muted-foreground mb-2">
          Transferencias Recientes ({recentTransfers.length})
        </h5>
        {recentTransfers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin transferencias recientes</p>
        ) : (
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Fecha</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Tipo</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Contra</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentTransfers.map((tx, idx) => {
                  const isOutgoing = tx.from.toLowerCase() === knownAddress.address.toLowerCase();
                  const counterparty = isOutgoing ? tx.to : tx.from;
                  return (
                    <tr key={`${tx.hash}-${idx}`} className="hover:bg-muted/50">
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {new Date(tx.timestamp * 1000).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={isOutgoing ? 'text-destructive' : 'text-success'}>
                          {isOutgoing ? 'Envio' : 'Recibido'}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-mono">
                        <a
                          href={`https://basescan.org/address/${counterparty}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:opacity-80"
                        >
                          {formatAddress(counterparty)}
                        </a>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right font-medium">
                        {parseFloat(tx.valueFormatted).toLocaleString()} {tokenSymbol}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
