import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Homepage from './pages/Homepage'
import Wardrobe from './pages/Wardrobe'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/wardrobe" element={<Wardrobe />} />
      </Routes>
    </BrowserRouter>
  )
}

