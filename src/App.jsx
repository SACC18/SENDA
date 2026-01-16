// Ejemplo rápido de cómo debe verse tu App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile' // <--- IMPORTAR

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} /> {/* <--- AGREGAR ESTA RUTA */}
      </Routes>
    </BrowserRouter>
  )
}