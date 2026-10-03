// Клієнтський застосунок салону: /s/{slug} — публічна сторінка і запис; /cabinet/{вкладка} — кабінет
import { Routes, Route, Navigate } from 'react-router-dom'
import SalonProvider from './Provider'
import { useSalon } from './ctx'
import Public from './Public'
import Cabinet from './Cabinet'
import { Empty } from './kit'

function Home() {
  const { slug, noSlug } = useSalon()
  return noSlug ? <Empty icon="💈" text="Відкрийте посилання для запису, яке дав вам салон" /> : <Navigate to={`/s/${slug}`} replace />
}

export default function SalonClientApp() {
  return (
    <SalonProvider>
      <Routes>
        <Route path="/s/:slug" element={<Public />} />
        <Route path="/cabinet" element={<Navigate to="/cabinet/bookings" replace />} />
        <Route path="/cabinet/:tab" element={<Cabinet />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </SalonProvider>
  )
}
