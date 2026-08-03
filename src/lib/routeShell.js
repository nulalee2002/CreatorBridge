export function getRouteShellClass(pathname) {
  if (pathname === '/') return 'cb-home-route';
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/client')) {
    return 'cb-inner-route cb-account-route';
  }
  if (pathname.startsWith('/admin')) {
    return 'cb-inner-route cb-admin-route';
  }
  return 'cb-inner-route';
}
