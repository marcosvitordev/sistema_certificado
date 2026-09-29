import CertificateApp from '../../../components/CertificateApp';

export default async function ValidationPage({ params }) {
  const { codigo } = await params;
  return <CertificateApp view="validar" code={codigo} />;
}
