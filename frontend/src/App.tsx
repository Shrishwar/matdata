import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './layouts/Layout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import HistoryPage from './pages/HistoryPage';
import PredictionsPage from './pages/PredictionsPage';
import AddResultPage from './pages/AddResultPage';
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
              <Route path="history" element={<HistoryPage />} />
              <Route path="predictions" element={<PredictionsPage />} />
              <Route path="add-result" element={<AddResultPage />} />
            </Route>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;