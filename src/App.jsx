import './App.css'

import NavigationBar from './components/common/NavigationBar';

import Home from './pages/Home';
import Profile from './pages/Profile';
import Login from "./pages/Login";
import TestPage from './pages/TestPage';
import Connections from './pages/Connections';
import MapPage from './pages/MapPage';
import ConnectionInventory from './pages/ConnectionInventory';
import Inventory from './pages/Inventory';

import ProtectedRoute from './components/auth/ProtectedRoute';
import PublicRoute from './components/auth/PublicRoute';
import { Routes, Route } from 'react-router-dom';

function App() {

  return (
    <div>
        <div className="nav-center-container">
          <NavigationBar />
        </div>
        <Routes>
            <Route path="/" element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            } />

            <Route path="/inventory" element={
              <ProtectedRoute>
                <Inventory />
              </ProtectedRoute>
            } />
            
            <Route path="/profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />

            <Route path="/connections" element={
              <ProtectedRoute>
                <Connections />
              </ProtectedRoute>
            } />

            <Route path="/mappage" element={
              <ProtectedRoute>
                <MapPage />
              </ProtectedRoute>
            } />

            <Route path="/connections/:connectionId/inventory" element={
              <ProtectedRoute>
                <ConnectionInventory />
              </ProtectedRoute>
            } />

            

            <Route path="/login" element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } />

            <Route path="/testpage" element={
              <TestPage /> 
            } />
        </Routes>
    </div>
  )
}

export default App
