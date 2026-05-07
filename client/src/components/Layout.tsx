import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function Layout() {
  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden px-4 py-6 pt-16 md:px-8 md:pt-6">
        <Outlet />
      </main>
    </div>
  );
}
