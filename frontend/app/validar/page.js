import { redirect } from 'next/navigation';
import CertificateApp from '../../components/CertificateApp';
export default async function Page({ searchParams }) {
  const { codigo } = await searchParams;
  if (typeof codigo === 'string' && codigo.trim()) redirect(`/validar/${encodeURIComponent(codigo.trim())}`);
  return <CertificateApp view="validar" />;
}
