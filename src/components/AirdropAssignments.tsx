import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Network } from '@/lib/types';

interface AirdropAssignmentsProps {
  walletAddress: string;
  network: Network;
  isLoading: boolean;
  searchTriggered?: number; // Opcional para mantener compatibilidad con código existente
  preloadedData?: {tokens: UserToken[], points: UserPoints[]};
}

interface UserToken {
  tokenName: string;
  tokenSymbol: string;
  amount: string;
  projectName?: string;
  status: 'pending' | 'completed' | 'cancelled';
}

interface UserPoints {
  referrer: string;
  name: string;
  totalUsers: number;
  activeUsers: number;
  usersPercentage: number;
  totalXp: number;
  xpPercentage: number;
}

interface UserInfo {
  id: string;
  email: string;
  name?: string;
  wallet?: string;
}

const AirdropAssignments: React.FC<AirdropAssignmentsProps> = ({ walletAddress, network, isLoading, searchTriggered, preloadedData }) => {
  const [userTokens, setUserTokens] = useState<UserToken[]>(preloadedData?.tokens || []);
  const [userPoints, setUserPoints] = useState<UserPoints[]>(preloadedData?.points || []);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'tokens' | 'points'>('tokens');
  
  // Token de administrador fijo para la herramienta interna
  const adminToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NDI5OTY2NzMsImp0aSI6IjJ1b00zUW5GSkQ1SXdkeldDT3N4dGJIenhrYSIsInR5cGUiOiJlcnAiLCJpZCI6IiIsInVzZXJuYW1lIjoidGVjbmljb0B2b3R0dW4uY29tIiwiY2lkIjoiNTQzYzljYjYtMzBmNy00ODU3LTllYmUtMjY4MDcwNmRhNGE2Iiwic2t1IjpbeyJyIjoxMDAsInMiOjAsImUiOjB9LHsiciI6MTAwLCJzIjozLCJlIjowfSx7InIiOjEwMCwicyI6NywiZSI6MH0seyJyIjoxMDAsInMiOjgsImUiOjB9LHsiciI6MTAwLCJzIjoxMiwiZSI6MH0seyJyIjoxMDAsInMiOjgwMDEsImUiOjB9LHsiciI6MTAwLCJzIjo4MDAyLCJlIjowfSx7InIiOjEwMCwicyI6ODAwMywiZSI6MH0seyJyIjoxMDAsInMiOjgwMDQsImUiOjB9LHsiciI6MTAwLCJzIjo4MDA1LCJlIjowfSx7InIiOjEwMCwicyI6ODAxMCwiZSI6MH0seyJyIjoxMDAsInMiOjgwMTEsImUiOjB9XSwicHVjIjoiMDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAwIn0.R-MMb6BTuhEK8CzJ02m4srY-CWlQxWXY4ZTjZaTvUwIqjyp20eKPVDX4XuO8k35zaucY5YFl1ReyKH4S186AdQ4qtp0TVM8LLqX0qUqHB0h82Z0kmvP2cmzMSYINsDqjWgolpihoqfPR2pMpsQ-Cwfs8Db-hs6FUGOE8Sdn0YkXXFMvgt4U481X0MF8pDxwZhArSLxLmvXTUhk48ssDfkyra892JIaryffbKnliEXpFrdVeDeIvtDeAJYS49HFun0Wn6oKXrvw3gBBPWpY5YVKu8z5x6KsjfyrKAYUQ8iTbQmkuR_63C3DvndjIo1oQmSNE-i5cZ8fp-Ob1Lx9ro5yIjVtj6cOA9uQdv_Zp1A-tawS5ttYhfjt0IgaY3ehhSy_pDgk68FrHJx3hm-KpmnOlWsTj43jnuxSnKz4ifW2Phqkx_KjF71XUP83eHLpnEFGdf3EbXgPdeO5yE1aepBcOpIJZWfPMQSkSWyGVsmKfgvEroOcov32QvDP0y1UgUudIvAVEFfPgj59qrUStmSGMjgJeGR6ObalCBK0bw4TvRwCu-GbIKuDyAYdxG6rQtZPfmoAuDkNp5HPi7xUgEZy_iMI-O2DLuw_Y2znZiBKui3u1Q_dNwjCfFdGFoPNGF_dKQv8QZPIdKWb--w8MmwGFsZX6-mGvJB6shyfqiNs4';

  // Función para buscar usuario por email
  const fetchUserByEmail = async () => {
    if (!userEmail) {
      setError('Por favor, introduce un correo electrónico válido');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Usamos el nuevo endpoint simplificado
      const response = await axios.get(`/api/search?email=${encodeURIComponent(userEmail)}`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      
      if (response.data && response.data.id) {
        setUserId(response.data.id);
        console.log('Usuario encontrado:', response.data);
        
        // Después de obtener el ID, buscamos los datos del usuario
        fetchUserData(response.data.id);
      } else {
        throw new Error('No se encontró el usuario');
      }
    } catch (err) {
      console.error('Error al buscar usuario por email:', err);
      setError('No se pudo encontrar un usuario con ese correo electrónico. Intenta con el ID directamente.');
      setLoading(false);
    }
  };

  // Función para obtener datos del usuario (tokens y puntos)
  const fetchUserData = async (userId: string) => {
    if (!userId) {
      setError('ID de usuario no válido');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (activeTab === 'tokens') {
        // Usar el endpoint de proxy para obtener tokens
        const tokensResponse = await axios.get(`/api/vottun/userTokens?userId=${userId}`, {
          headers: {
            'Authorization': `Bearer ${adminToken}`
          }
        });
        
        if (tokensResponse.data && Array.isArray(tokensResponse.data)) {
          setUserTokens(tokensResponse.data.map((token: any) => ({
            tokenName: token.name || 'Token Desconocido',
            tokenSymbol: token.symbol || 'TKN',
            amount: token.amount?.toString() || '0',
            projectName: token.project || 'Vottun Airdrop',
            status: token.status || 'pending'
          })));
        } else {
          throw new Error('Formato de respuesta inesperado');
        }
      } else if (activeTab === 'points') {
        // Usar el endpoint de proxy para obtener puntos
        const pointsResponse = await axios.get(`/api/vottun/userPoints?userId=${userId}`, {
          headers: {
            'Authorization': `Bearer ${adminToken}`
          }
        });
        
        if (pointsResponse.data && pointsResponse.data.xpReferrerTotals && Array.isArray(pointsResponse.data.xpReferrerTotals)) {
          setUserPoints(pointsResponse.data.xpReferrerTotals);
        } else {
          setUserPoints(pointsResponse.data || []);
        }
      }

      setLoading(false);
    } catch (error: any) {
      console.error(`Error al obtener ${activeTab === 'tokens' ? 'tokens' : 'puntos'} del usuario:`, error);
      setError(`No se pudieron obtener los ${activeTab === 'tokens' ? 'tokens' : 'puntos'} del usuario. ${error.message}`);
      setLoading(false);
    }
  };

  // Función para buscar por ID de usuario
  const fetchUserById = async () => {
    if (!userId) {
      setError('Por favor, introduce un ID de usuario válido');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Después de obtener el ID, buscamos los datos del usuario
      fetchUserData(userId);
    } catch (err) {
      console.error('Error al buscar usuario por ID:', err);
      setError('No se pudo encontrar un usuario con ese ID.');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchTriggered !== undefined) {
      fetchUserByEmail();
    }
  }, [searchTriggered]);

  if (isLoading) {
    return (
      <div className="bg-card p-6 rounded-lg shadow-md border border-border">
        <p className="text-center text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="bg-card p-6 rounded-lg shadow-md border border-border">
      <h2 className="text-xl font-semibold mb-4">Tokens y Puntos Asignados en Vottun</h2>
      
      <div className="mb-6">
        <div className="mb-4">
          <div className="flex space-x-4 mb-4">
            <button
              onClick={() => setActiveTab('tokens')}
              className={`px-4 py-2 rounded ${activeTab === 'tokens' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            >
              Tokens Asignados
            </button>
            <button
              onClick={() => setActiveTab('points')}
              className={`px-4 py-2 rounded ${activeTab === 'points' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            >
              Puntos por Referido
            </button>
          </div>

          <div>
            <label htmlFor="userEmail" className="block text-sm font-medium text-foreground mb-1">
              Correo Electrónico del Usuario
            </label>
            <div className="flex space-x-2">
              <input
                type="email"
                id="userEmail"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="usuario@ejemplo.com"
                className="flex-grow px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary bg-background text-foreground"
              />
              <button
                onClick={fetchUserByEmail}
                disabled={loading || !userEmail}
                className="bg-primary hover:opacity-90 text-primary-foreground font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
              >
                {loading ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Introduce el correo electrónico del usuario de Vottun que deseas consultar.
            </p>
          </div>

          <div className="mt-4">
            <label htmlFor="userId" className="block text-sm font-medium text-foreground mb-1">
              ID de Usuario en Vottun
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Ej: 000871ee-abe0-4550-81cb-d52a4d541553"
                className="flex-grow px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary bg-background text-foreground"
              />
              <button
                onClick={fetchUserById}
                disabled={loading || !userId}
                className="bg-primary hover:opacity-90 text-primary-foreground font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
              >
                {loading ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              O introduce directamente el ID del usuario.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
      </div>

      {activeTab === 'tokens' ? (
        userTokens.length === 0 && !loading ? (
          <p className="text-center text-muted-foreground">
            No se encontraron tokens asignados. Por favor, introduce un ID de usuario o correo electrónico válido y consulta.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Token</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Cantidad</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Proyecto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {userTokens.map((token, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="ml-4">
                          <div className="text-sm font-medium text-card-foreground">{token.tokenSymbol}</div>
                          <div className="text-sm text-muted-foreground">{token.tokenName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-card-foreground">{token.amount}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-card-foreground">{token.projectName || 'No especificado'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        token.status === 'pending' 
                          ? 'bg-warning/10 text-warning' 
                          : token.status === 'completed' 
                            ? 'bg-success/10 text-success' 
                            : 'bg-destructive/10 text-destructive'
                      }`}>
                        {token.status === 'pending' 
                          ? 'Pendiente' 
                          : token.status === 'completed' 
                            ? 'Completado' 
                            : 'Cancelado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        userPoints.length === 0 && !loading ? (
          <p className="text-center text-muted-foreground">
            No se encontraron puntos asignados. Por favor, introduce un ID de usuario o correo electrónico válido y consulta.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Referido</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Usuarios</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Usuarios Activos</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">% Usuarios</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Total XP</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">% XP</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {userPoints.map((point, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="ml-4">
                          <div className="text-sm font-medium text-card-foreground">{point.name || 'Sin nombre'}</div>
                          <div className="text-sm text-muted-foreground">ID: {point.referrer}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-card-foreground">{point.totalUsers}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-card-foreground">{point.activeUsers}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-card-foreground">{(point.usersPercentage * 100).toFixed(2)}%</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-card-foreground">{point.totalXp.toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-card-foreground">{(point.xpPercentage * 100).toFixed(2)}%</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
};

export default AirdropAssignments;
