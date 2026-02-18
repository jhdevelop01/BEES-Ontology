import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const locale = request.cookies.get('NEXT_LOCALE')?.value || 'ko';
  const response = NextResponse.next();

  // 쿠키가 없으면 기본 locale 설정
  if (!request.cookies.get('NEXT_LOCALE')) {
    response.cookies.set('NEXT_LOCALE', locale, { path: '/', sameSite: 'lax' });
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)']
};
