import Head from 'next/head';
import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with browser-specific code
const QRPanel = dynamic(() => import('../components/QRPanel'), {
  ssr: false,
  loading: () => <div className="loading">Loading...</div>
});

export default function Home() {
  return (
    <>
      <Head>
        <title>Zalo QR Panel - IMEI Extractor</title>
        <meta name="description" content="Extract IMEI and cookies from Zalo QR code" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
        <QRPanel />
      </main>
    </>
  );
}
