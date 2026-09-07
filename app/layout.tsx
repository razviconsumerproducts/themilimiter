import './globals.css'
import './public.css'
import './auth.css'

export const metadata = {
  title: 'MILLIMETRE — Furniture Manufacturing OS',
  description: 'Connected furniture manufacturing software from measurement and design through costing, procurement, production, delivery, installation and service.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
