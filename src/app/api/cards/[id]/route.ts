import { NextRequest, NextResponse } from 'next/server';

const API_BASE = 'https://api.pokemontcg.io/v2';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const resp = await fetch(`${API_BASE}/cards/${id}`, {
      headers: { 'User-Agent': 'pokeprice/1.0' },
    });
    const data = await resp.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch card data' }, { status: 502 });
  }
}
