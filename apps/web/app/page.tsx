import { LazarusExperience } from '../components/lazarus-experience';

export default function Page() {
  return (
    <main style={{ minHeight: '100vh', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <LazarusExperience />
    </main>
  );
}
