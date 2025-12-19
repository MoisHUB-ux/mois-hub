import '../styles/globals.css'
import '../styles/toast.css'
import { useEffect } from 'react'

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // Отключаем Next.js Error Overlay
    if (typeof window !== 'undefined') {
      const style = document.createElement('style')
      style.innerHTML = `
        nextjs-portal { display: none !important; }
        body > nextjs-portal { display: none !important; }
      `
      document.head.appendChild(style)
    }
  }, [])

  return <Component {...pageProps} />
}

export default MyApp
