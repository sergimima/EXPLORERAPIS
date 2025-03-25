import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const authHeader = request.headers.get('Authorization');

    if (!email) {
      return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
    }

    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header is required' }, { status: 401 });
    }

    try {
      // Intentamos buscar un usuario por email usando la API de Vottun
      // Nota: Aquí deberíamos usar el endpoint real de búsqueda por email de Vottun
      // Por ahora, usamos el endpoint de usuario autenticado y devolvemos su ID
      
      // Obtenemos el ID del usuario autenticado con el token
      const userResponse = await axios.get('https://api.vottun.io/coreauth/v1/user', {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Origin': 'https://backoffice.vottun.io',
          'Referer': 'https://backoffice.vottun.io/'
        }
      });

      if (userResponse.data && userResponse.data.id) {
        // Devolvemos el ID real del usuario autenticado
        return NextResponse.json({
          id: userResponse.data.id,
          email: email,
          // Si el usuario real tiene un nombre, lo usamos, de lo contrario extraemos del email
          name: userResponse.data.name || email.split('@')[0]
        });
      } else {
        return NextResponse.json({ error: 'No se pudo obtener el ID del usuario' }, { status: 404 });
      }
    } catch (apiError: any) {
      console.error('Error al obtener información del usuario:', apiError);
      return NextResponse.json(
        { error: apiError.message || 'Error al obtener información del usuario' },
        { status: apiError.response?.status || 500 }
      );
    }
    
  } catch (error: any) {
    console.error('Error searching user by email:', error);
    return NextResponse.json(
      { error: error.message || 'Error searching user by email' },
      { status: 500 }
    );
  }
}
