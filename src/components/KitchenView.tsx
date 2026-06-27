import React, { useEffect, useState, useRef } from 'react';
import { socket } from '@/lib/socket';
import { Order, OrderItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, CheckCircle2, CookingPot, Timer } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export default function KitchenView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const newOrderSound = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    newOrderSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

    fetchOrders();

    socket.on('new_order', (order: Order) => {
      setOrders(prev => [order, ...prev]);
      newOrderSound.current?.play();
      toast.info(`New Order from Table ${order.table_number}`);
    });

    socket.on('order_status_updated', ({ id, status }) => {
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    });

    return () => {
      socket.off('new_order');
      socket.off('order_status_updated');
    };
  }, []);

  const fetchOrders = async () => {
    const res = await fetch('/api/orders');
    const data = await res.json();
    const activeOrders = data.filter((o: Order) => o.status !== 'completed' && o.status !== 'cancelled');
    
    // Fetch items for each order
    const ordersWithItems = await Promise.all(activeOrders.map(async (o: Order) => {
      const itemsRes = await fetch(`/api/orders/${o.id}/items`);
      const items = await itemsRes.json();
      return { ...o, items };
    }));
    
    setOrders(ordersWithItems);
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/orders/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Kitchen Display</h1>
          <p className="text-slate-500">Live order management</p>
        </div>
        <div className="flex items-center gap-2">
           <Badge variant="outline" className="px-3 py-1 bg-white">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
              Connected
           </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {orders.map((order) => (
          <Card key={order.id} className={`border-2 ${order.status === 'pending' ? 'border-orange-200' : 'border-blue-200'}`}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <Badge variant={order.status === 'pending' ? 'destructive' : 'default'} className="uppercase">
                  {order.status}
                </Badge>
                <div className="text-sm text-slate-500 flex items-center">
                  <Timer className="w-3 h-3 mr-1" />
                  {formatDistanceToNow(new Date(order.created_at))} ago
                </div>
              </div>
              <CardTitle className="text-2xl mt-2 font-black">Table {order.table_number}</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48 pr-4">
                <div className="space-y-3">
                  {order.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <div>
                        <span className="font-bold text-lg mr-2">{item.quantity}x</span>
                        <span className="font-medium">{item.item_name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
            <CardFooter className="gap-2">
              {order.status === 'pending' && (
                <Button 
                  onClick={() => updateStatus(order.id, 'preparing')} 
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <CookingPot className="w-4 h-4 mr-2" />
                  Start Cooking
                </Button>
              )}
              {order.status === 'preparing' && (
                <Button 
                  onClick={() => updateStatus(order.id, 'completed')} 
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Complete Order
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
        {orders.length === 0 && (
          <div className="col-span-full py-20 text-center text-slate-400">
             <Bell className="w-12 h-12 mx-auto mb-4 opacity-20" />
             <p className="text-lg">No active orders. Kitchen is quiet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
