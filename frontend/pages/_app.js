import '../styles/globals.css';
import { useState, createContext } from 'react';
import Nav from '../components/Nav';

export const SidebarContext = createContext();

export default function App({ Component, pageProps }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <div className={`app-layout${collapsed ? ' sidebar-collapsed' : ''}`}>
        <Nav />
        <main className="app-main">
          <Component {...pageProps} />
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
