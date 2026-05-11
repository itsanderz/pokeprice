import { NextRequest, NextResponse } from 'next/server';

const API_BASE = 'https://api.pokemontcg.io/v2';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const limit = searchParams.get('limit') || '12';

  if (!q) {
    return NextResponse.json({ error: 'Missing query parameter "q"' }, { status: 400 });
  }

  try {
    const resp = await fetch(
      `${API_BASE}/cards?q=name:"${encodeURIComponent(q)}"&pageSize=${limit}&orderBy=set.releaseDate`,
      { headers: { 'User-Agent': 'pokeprice/1.0' } }
    );
    const data = await resp.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch card data' }, { status: 502 });
  }
}
