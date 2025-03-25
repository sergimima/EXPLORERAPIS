import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const authHeader = request.headers.get('Authorization');

    if (!userId) {
      return NextResponse.json({ error: 'User ID parameter is required' }, { status: 400 });
    }

    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header is required' }, { status: 401 });
    }

    try {
      // Hacer la solicitud a la API de Vottun
      const response = await axios.get(`https://api.vottun.tech/tkn/v1/admin/user/${userId}/tokens`, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Origin': 'https://backoffice.vottun.io',
          'Referer': 'https://backoffice.vottun.io/'
        }
      });

      // Devolvemos los datos tal como vienen de la API
      return NextResponse.json(response.data);
    } catch (apiError: any) {
      console.error('Error fetching user tokens from Vottun API:', apiError);
      return NextResponse.json(
        { error: apiError.message || 'Error fetching user tokens from Vottun API' },
        { status: apiError.response?.status || 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in userTokens API route:', error);
    return NextResponse.json(
      { error: error.message || 'Error fetching user tokens' },
      { status: 500 }
    );
  }
}
