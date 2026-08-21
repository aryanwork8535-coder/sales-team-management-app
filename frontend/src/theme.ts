export const theme = {
  colors: {
    surface: '#FAFBFA',
    onSurface: '#1A1C1A',
    surfaceSecondary: '#FFFFFF',
    onSurfaceSecondary: '#2D312E',
    surfaceTertiary: '#EEF2F0',
    onSurfaceTertiary: '#434845',
    surfaceInverse: '#2D312E',
    onSurfaceInverse: '#FFFFFF',
    brand: '#0F5A3E',
    brandPrimary: '#0F5A3E',
    onBrandPrimary: '#FFFFFF',
    brandSecondary: '#E1F0E7',
    onBrandSecondary: '#0F5A3E',
    brandTertiary: '#F0F6F2',
    onBrandTertiary: '#1B6E4E',
    success: '#0D824B',
    onSuccess: '#FFFFFF',
    warning: '#D97706',
    onWarning: '#FFFFFF',
    error: '#DC2626',
    onError: '#FFFFFF',
    info: '#0891B2',
    onInfo: '#FFFFFF',
    border: '#E4E7E5',
    borderStrong: '#B9C2BD',
    divider: '#EDF0EE',
    muted: '#6E7671',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { sm: 6, md: 12, lg: 20, pill: 999 },
  font: {
    display: 'Outfit',
    text: 'Manrope',
  },
  fontSize: { sm: 12, base: 14, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
};

export const fmtINR = (n: number | undefined | null): string => {
  const v = Number(n || 0);
  return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 });
};
