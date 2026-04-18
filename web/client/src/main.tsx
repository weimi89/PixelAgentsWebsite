import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

// 兩個頁面獨立打包為 chunk — Dashboard 使用者較少才載入
const App = lazy(() => import('./App.tsx'))
const Dashboard = lazy(() => import('./pages/Dashboard.tsx').then(m => ({ default: m.Dashboard })))

const isDashboard = window.location.hash === '#/dashboard'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense fallback={null}>
        {isDashboard ? <Dashboard /> : <App />}
      </Suspense>
    </ErrorBoundary>
  </StrictMode>,
)

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failed — app continues without offline support
    })
  })
}
