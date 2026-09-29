import '../public/css/app.css';

export const metadata = {
  title: 'Certifica CES',
  description: 'Emissão e validação de certificados do Centro de Estudo Sena.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
