import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom'
import PhotoUpload from './components/PhotoUpload.js'
import WardrobeView from './components/WardrobeView.js'

function App() {
  const navLinkBase =
    'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-white/10 hover:text-white'
  const navLinkActive = 'bg-indigo-500 text-white'

  return (
    <Router>
      <div className="flex min-h-screen w-full flex-col bg-gradient-to-br from-gray-50 to-gray-100 font-sans text-slate-800">
        <nav className="sticky top-0 z-50 flex h-16 items-center justify-between bg-gradient-to-br from-gray-900 to-gray-800 px-4 text-white shadow-lg sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-indigo-400 text-lg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.47a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.47a2 2 0 00-1.34-2.23z" />
              </svg>
            </div>
            <h1 className="text-[1.375rem] font-bold tracking-tight text-transparent bg-gradient-to-br from-white to-indigo-100 bg-clip-text">
              ClotherAI
            </h1>
          </div>
          <div className="flex gap-2">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `${navLinkBase} ${isActive ? navLinkActive : ''}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload
            </NavLink>
            <NavLink
              to="/wardrobe"
              className={({ isActive }) => `${navLinkBase} ${isActive ? navLinkActive : ''}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Wardrobe
            </NavLink>
          </div>
        </nav>

        <main className="mx-auto flex w-full max-w-[1400px] flex-1 px-4 py-8 sm:px-8">
          <Routes>
            <Route path="/" element={<PhotoUpload />} />
            <Route path="/wardrobe" element={<WardrobeView />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
