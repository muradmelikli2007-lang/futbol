import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { ErrorState, Loading } from './components/ui';
import { useApp } from './state/app';
import Home from './pages/Home';
import Players from './pages/Players';
import PlayerProfilePage from './pages/PlayerProfile';
import Matches from './pages/Matches';
import MatchDetail from './pages/MatchDetail';
import MatchEditor from './pages/MatchEditor';
import Rankings from './pages/Rankings';
import StatisticsPage from './pages/Statistics';
import Seasons from './pages/Seasons';
import Compare from './pages/Compare';

export default function App() {
  const { loaded, bootError } = useApp();

  if (!loaded) {
    return (
      <div className="boot">
        <Loading label="Starting up" />
      </div>
    );
  }
  if (bootError) {
    return (
      <div className="boot">
        <ErrorState message={bootError} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/players" element={<Players />} />
        <Route path="/players/:id" element={<PlayerProfilePage />} />
        <Route path="/matches" element={<Matches />} />
        <Route path="/matches/new" element={<MatchEditor />} />
        <Route path="/matches/:id" element={<MatchDetail />} />
        <Route path="/matches/:id/edit" element={<MatchEditor />} />
        <Route path="/rankings" element={<Navigate to="/rankings/top-scorers" replace />} />
        <Route path="/rankings/:type" element={<Rankings />} />
        <Route path="/statistics" element={<StatisticsPage />} />
        <Route path="/seasons" element={<Seasons />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
