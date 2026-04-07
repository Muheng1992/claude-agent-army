import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ParticleBackground } from './components/ParticleBackground';
import { Header } from './components/Header';
import { MissionListPage } from './pages/MissionListPage';
import { DashboardPage } from './pages/DashboardPage';

export default function App() {
  return (
    <BrowserRouter basename="/dashboard">
      <div className="relative min-h-screen bg-void">
        <ParticleBackground />

        <div className="relative z-10 flex flex-col min-h-screen">
          <Header />
          <Routes>
            <Route path="/" element={<MissionListPage />} />
            <Route path="/mission/:id" element={<DashboardPage />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
