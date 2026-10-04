import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Homepage from './pages/Homepage'
import Wardrobe from './pages/Wardrobe'
import Critique from './pages/Critique'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/critique" element={<Critique />} />
        <Route path="/wardrobe" element={<Wardrobe />} />
      </Routes>
    </BrowserRouter>
  )
}

