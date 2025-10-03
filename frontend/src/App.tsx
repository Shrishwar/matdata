import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './layouts/Layout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
// Removed import of HistoryPage as it will be deleted
import PredictionsPage from './pages/PredictionsPage';
import AddResultPage from './pages/AddResultPage';
import DesigningPage from './components/DesigningPage';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              {/* Redirect /history to /predictions */}
              <Route path="history" element={<Navigate to="/predictions" replace />} />
              <Route path="predictions" element={<PredictionsPage />} />
              <Route path="add-result" element={<AddResultPage />} />
              <Route path="designing" element={<DesigningPage />} />
            </Route>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
