import React, { useState } from 'react';
import CustomerView from './components/CustomerView';
import KitchenView from './components/KitchenView';
import AdminView from './components/AdminView';
import { Toaster } from '@/components/ui/sonner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, CookingPot, Settings } from 'lucide-react';

export default function App() {
  const [role, setRole] = useState<'customer' | 'kitchen' | 'admin'>('customer');

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Dev Role Switcher - In a real app these would be separate routes/domains */}
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[200] opacity-30 hover:opacity-100 transition-opacity">
        <Tabs value={role} onValueChange={(v) => setRole(v as any)}>
          <TabsList className="bg-white/80 backdrop-blur shadow-sm border">
            <TabsTrigger value="customer" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
              <User className="w-4 h-4 mr-2" />
              Customer
            </TabsTrigger>
            <TabsTrigger value="kitchen" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
              <CookingPot className="w-4 h-4 mr-2" />
              Kitchen
            </TabsTrigger>
            <TabsTrigger value="admin" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
              <Settings className="w-4 h-4 mr-2" />
              Admin
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {role === 'customer' && <CustomerView />}
      {role === 'kitchen' && <KitchenView />}
      {role === 'admin' && <AdminView />}

      <Toaster position="top-center" expand={true} richColors />
    </div>
  );
}
