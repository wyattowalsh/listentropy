import { Navigate, Route, Routes } from 'react-router-dom'

import { DashboardApp } from '@/app/DashboardApp'
import { SharePage } from '@/components/share/SharePage'

function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<DashboardApp />} />
      <Route path="/share" element={<SharePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
