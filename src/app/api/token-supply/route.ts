import { NextResponse } from 'next/server';
import axios, { AxiosError } from 'axios';

export const dynamic = 'force-dynamic';

export async function GET() {
  console.log('Iniciando petición a la API de token-supply');
  try {
    console.log('Realizando peticiones a las APIs de Vottun');
    
    // Configurar cabeceras para las peticiones
    const config = {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };
    
    // Realizar peticiones a las APIs de Vottun con las cabeceras configuradas
    const totalSupplyResponse = await axios.get('https://intapi.vottun.tech/tkn/v1/total-supply', config);
    const circulatingSupplyResponse = await axios.get('https://intapi.vottun.tech/tkn/v1/circulating-supply', config);
    
    // Extraer los datos de las respuestas
    const totalSupply = totalSupplyResponse.data?.totalSupply || '0';
    const circulatingSupply = circulatingSupplyResponse.data?.circulatingSupply || '0';
    
    // Calcular el suministro bloqueado
    const totalSupplyNum = parseFloat(totalSupply);
    const circulatingSupplyNum = parseFloat(circulatingSupply);
    const lockedSupply = (totalSupplyNum - circulatingSupplyNum).toFixed(2);

    // Devolver la respuesta con los datos combinados
    return NextResponse.json({
      totalSupply,
      circulatingSupply,
      lockedSupply,
      lastUpdated: new Date().toISOString()
    });
  } catch (error: unknown) {
    console.error('Error al obtener información del suministro de tokens:', error);
    
    let errorMessage = 'Error al obtener información del suministro de tokens';
    
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        errorMessage += ` - Status: ${axiosError.response.status}`;
        console.error('Datos de respuesta:', axiosError.response.data);
      } else if (axiosError.request) {
        errorMessage += ' - No se recibió respuesta del servidor';
      } else {
        errorMessage += ` - ${axiosError.message}`;
      }
    } else if (error instanceof Error) {
      errorMessage += ` - ${error.message}`;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
