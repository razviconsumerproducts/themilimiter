import './globals.css'

export const metadata = { title: 'MILLIMETRE ERP', description: 'Manufacturing and enterprise operations platform' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
