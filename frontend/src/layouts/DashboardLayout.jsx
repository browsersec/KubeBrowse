import { Outlet } from 'react-router-dom';
import Sidebar from '../components/sidebar/Sidebar';

export default function DashboardLayout() {
  return (
    <div className="flex h-screen bg-background text-foreground transition-colors duration-200">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}