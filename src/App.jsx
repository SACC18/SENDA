import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile' 
import AdminDashboard from './pages/AdminDashboard'
import Notification from './components/Notification'
import CoordinatorDashboard from './pages/CoordinatorDashboard'

export default function App() {
  const handleNotify = (msg, type) => console.log(`${type}: ${msg}`);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin" element={<AdminDashboard onNotify={handleNotify} />} />
        <Route path="/coordinador" element={<CoordinatorDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}