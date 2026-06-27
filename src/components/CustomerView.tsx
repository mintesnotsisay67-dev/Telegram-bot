import React, { useEffect, useState, useRef } from 'react';
import { socket } from '@/lib/socket';
import { MenuItem, OrderItem, Table as TableType } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { ShoppingCart, Utensils, CreditCard, Wallet, Landmark, Hash, Check, Info, ChevronRight, Star, Clock, Plus, ChevronDown, Minus, Flame, Sparkles, ShieldAlert, Zap, ShoppingBag, Search, X, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose } from '@/components/ui/dialog';

export default function CustomerView() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<TableType[]>([]);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [tableNumber, setTableNumber] = useState<string>(() => localStorage.getItem('primecut_table') || '');
  const [isOrdered, setIsOrdered] = useState(() => localStorage.getItem('primecut_isordered') === 'true');
  const [orderId, setOrderId] = useState<string | null>(() => localStorage.getItem('primecut_orderid'));
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [allOrderItems, setAllOrderItems] = useState<Record<string, any[]>>({});
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [paymentStep, setPaymentStep] = useState<'none' | 'method' | 'success'>('none');
  const [activeTab, setActiveTab] = useState<'menu' | 'orders'>('menu');
  const [searchQuery, setSearchQuery] = useState('');
  const finishedSound = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    localStorage.setItem('primecut_table', tableNumber);
    localStorage.setItem('primecut_isordered', String(isOrdered));
    if (orderId) localStorage.setItem('primecut_orderid', orderId);
  }, [tableNumber, isOrdered, orderId]);

  useEffect(() => {
    finishedSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3');
    
    const params = new URLSearchParams(window.location.search);
    const table = params.get('table');
    if (table) setTableNumber(table);

    fetchMenu();
    fetchTables();
    if (tableNumber) fetchTableOrders();

    socket.on('order_finished', (data: { id: string }) => {
      fetchTableOrders();
      finishedSound.current?.play();
      toast.success("Your food is ready! Please collect it or wait for server.");
    });

    socket.on('order_status_updated', ({ id, status }) => {
      fetchTableOrders();
      if (status === 'completed') {
         toast.success("Order completed! Hope you enjoyed the meat.");
      }
      fetchTables();
    });

    socket.on('new_order', () => {
       fetchTableOrders();
    });

    return () => {
      socket.off('order_finished');
      socket.off('order_status_updated');
    };
  }, [orderId]);

  const fetchTableOrders = async () => {
    if (!tableNumber) return;
    try {
       const res = await fetch(`/api/orders/table/${tableNumber}`);
       const orders: any[] = await res.json();
       setActiveOrders(orders);
       
       const itemsMap: Record<string, any[]> = {};
       for (const order of orders) {
         const itemsRes = await fetch(`/api/orders/${order.id}/items`);
         if (itemsRes.ok) {
           itemsMap[order.id] = await itemsRes.json();
         }
       }
       setAllOrderItems(itemsMap);
       
       if (orders.length > 0) {
         setIsOrdered(true);
         setOrderId(orders[0].id);
       } else {
         setIsOrdered(false);
         setOrderId(null);
       }
    } catch (err) {
       console.error(err);
    }
  };

  const fetchMenu = async () => {
    const res = await fetch('/api/menu');
    setMenu(await res.json());
  };

  const fetchTables = async () => {
    try {
      const res = await fetch('/api/tables');
      if (res.ok) {
        setTables(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch tables", err);
    }
  };

  const addToCart = (item: MenuItem, quantity: number = 1) => {
    setCart(prev => {
      const existing = prev.find(i => i.menu_item_id === item.id);
      if (existing) {
        return prev.map(i => i.menu_item_id === item.id ? { ...i, quantity: i.quantity + quantity } : i);
      }
      return [...prev, { menu_item_id: item.id, item_name: item.name, quantity, price: item.price }];
    });
    toast.success(`Added ${quantity}x ${item.name} to cart`);
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.menu_item_id === itemId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(i => i.menu_item_id !== itemId));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const placeOrder = async () => {
    if (!tableNumber) {
      toast.error("Please enter your table number");
      return;
    }
    if (cart.length === 0) return;

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table_number: tableNumber,
        items: cart,
        total_amount: totalAmount,
      }),
    });
    const data = await res.json();
    setCart([]);
    toast.success("Order sent to kitchen!");
    fetchTableOrders();
  };

  const handlePayment = async (method: string, specificOrderId?: string) => {
    const targetId = specificOrderId || orderId;
    if (!targetId) return;
    await fetch(`/api/orders/${targetId}/payment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment_method: method,
        payment_status: 'paid',
      }),
    });
    setPaymentStep('success');
    toast.success(`Payment confirmed via ${method}`);
    fetchTableOrders();
  };

  if (paymentStep === 'success') {
    return (
      <div className="flex flex-col items-center justify-center min-vh-100 min-h-screen p-8 text-center bg-white">
        <motion.div 
          initial={{ scale: 0 }} 
          animate={{ scale: 1 }} 
          className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6"
        >
          <Check className="w-12 h-12 text-green-600" />
        </motion.div>
        <h1 className="text-3xl font-bold mb-2">Thank You!</h1>
        <p className="text-slate-500 mb-8">Your payment was successful. We are preparing your delicious meat!</p>
        <div className="space-y-3 w-full max-w-xs">
           <Button onClick={() => setPaymentStep('none')} className="w-full h-12 rounded-xl bg-red-600">Track Order Progress</Button>
           <Button onClick={() => {
             localStorage.clear();
             window.location.reload();
           }} variant="outline" className="w-full h-12 rounded-xl">Order Something Else</Button>
        </div>
      </div>
    );
  }

   if (!tableNumber) {
    const availableTables = tables.filter(t => t.is_available === 1 || t.is_available === true);
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col relative overflow-hidden">
        {/* Abstract Background Orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-red-500/5 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-slate-900/5 rounded-full blur-[100px] animate-pulse" />
        
        <header className="mb-16 text-center pt-20 relative z-10 px-6">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0, rotate: -15 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="w-24 h-24 bg-slate-900 rounded-[2rem] flex items-center justify-center text-white font-black text-4xl mx-auto mb-8 shadow-[0_20px_50px_rgba(0,0,0,0.15)] relative"
          >
            <div className="absolute inset-0 bg-red-600 rounded-[2rem] -z-10 translate-x-3 translate-y-3 opacity-20" />
            P
          </motion.div>
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-4xl font-black text-slate-900 tracking-tighter mb-3"
          >
            PrimeCut <span className="text-red-600">.</span>
          </motion.h1>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400"
          >
            Excellence in Gastronomy
          </motion.p>
        </header>

        <main className="flex-1 px-6 pb-20 relative z-10">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mb-10"
          >
            <h2 className="text-xl font-black text-slate-900 tracking-tight text-center">Reserve Station</h2>
            <div className="h-1 w-8 bg-red-600 rounded-full mx-auto mt-3" />
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {availableTables.map((table, i) => (
              <motion.button
                key={table.id}
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 + (i * 0.08), type: "spring", stiffness: 100 }}
                onClick={() => setTableNumber(table.number)}
                className="bg-white p-8 rounded-[2.5rem] shadow-[0_10px_40px_rgba(0,0,0,0.02)] border-2 border-transparent hover:border-red-500 hover:shadow-2xl hover:shadow-red-500/10 transition-all duration-500 group relative flex flex-col items-center gap-6"
              >
                <div className="w-20 h-20 bg-slate-50 rounded-[1.8rem] flex items-center justify-center text-slate-300 group-hover:bg-red-600 group-hover:text-white transition-all duration-500 shadow-inner group-hover:rotate-12 group-hover:scale-110">
                  <span className="text-2xl font-black tabular-nums">{table.number}</span>
                </div>
                <div className="text-center">
                  <span className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-300 group-hover:text-red-500 transition-colors">Station</span>
                  <h3 className="text-lg font-black text-slate-900 mt-1">Table {table.number}</h3>
                </div>
                {/* Decorative dots */}
                <div className="absolute top-4 right-4 flex gap-1">
                   <div className="w-1.5 h-1.5 bg-slate-100 rounded-full group-hover:bg-red-200" />
                   <div className="w-1.5 h-1.5 bg-slate-100 rounded-full group-hover:bg-red-300" />
                   <div className="w-1.5 h-1.5 bg-slate-100 rounded-full group-hover:bg-red-400" />
                </div>
              </motion.button>
            ))}
          </div>

          {availableTables.length === 0 && (
            <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               className="py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100 shadow-sm"
            >
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200">
                <ShieldAlert className="w-10 h-10" />
              </div>
              <p className="text-slate-900 font-black text-xl tracking-tight">Prime Capacity Reached</p>
              <p className="text-sm text-slate-400 px-12 mt-2 leading-relaxed font-medium">Please wait a moment while we prepare your next curated experience.</p>
            </motion.div>
          )}
        </main>
        
        <footer className="py-12 text-center relative z-10">
          <div className="flex items-center justify-center gap-4 opacity-20 mb-4">
             <div className="h-px w-8 bg-slate-900" />
             <Star className="w-4 h-4 fill-current text-slate-900" />
             <div className="h-px w-8 bg-slate-900" />
          </div>
          <p className="text-slate-400 font-black uppercase tracking-[0.4em] text-[10px]">PrimeCut Gastronomy</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="pb-32 max-w-4xl mx-auto bg-slate-50 min-h-screen border-x border-slate-100">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <motion.div 
            whileHover={{ scale: 1.05, rotate: 5 }}
            className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-xl shadow-red-500/20"
          >
            P
          </motion.div>
          <div>
            <h1 className="font-black text-lg tracking-tighter text-slate-900 leading-none">PrimeCut</h1>
            <p className="text-[8px] font-bold text-red-600 uppercase tracking-[0.2em] mt-1">Butchery & Grill</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Badge 
            variant="secondary" 
            className="px-3 py-1 bg-slate-900 text-white border-none font-black text-[10px] uppercase tracking-widest cursor-pointer hover:bg-red-600 transition-all rounded-full shadow-lg shadow-slate-200"
            onClick={() => {
              if (activeOrders.length === 0) {
                setTableNumber('');
              } else {
                toast.info("You have active orders at this table.");
              }
            }}
          >
            Table {tableNumber}
          </Badge>
        </div>
      </header>

      <div className="px-4 py-8">
         {activeTab === 'menu' ? (
           <div className="space-y-12">
             {activeOrders.length > 0 && (() => {
                const latestStatus = activeOrders.reduce((acc, o) => {
                  const hierarchy = { 'pending': 1, 'preparing': 2, 'completed': 3, 'cancelled': 0 };
                  return hierarchy[o.status as keyof typeof hierarchy] > hierarchy[acc as keyof typeof hierarchy] ? o.status : acc;
                }, 'pending');
                
                return (
                  <Card 
                    onClick={() => setActiveTab('orders')}
                    className="mb-10 border-none bg-slate-900 text-white shadow-2xl shadow-slate-300 overflow-hidden rounded-[2.5rem] relative cursor-pointer group"
                  >
                     <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                       <Zap className="w-16 h-16 text-white" />
                     </div>
                     
                     <CardHeader className="pb-2 p-8 pt-10">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.5)]" />
                            <CardTitle className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black">Preparation Status</CardTitle>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={`text-[9px] px-3 py-1 border-none font-black uppercase tracking-widest ${
                              latestStatus === 'preparing' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'
                            }`}
                          >
                            {latestStatus}
                          </Badge>
                        </div>
                     </CardHeader>
                     
                     <CardContent className="pb-10 px-8">
                        <div className="flex justify-between items-center relative py-6">
                           <div className="absolute top-1/2 left-0 w-full h-1.5 bg-slate-800 -translate-y-1/2 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ 
                                  width: latestStatus === 'pending' ? '33%' : 
                                         latestStatus === 'preparing' ? '66%' : '100%' 
                                }}
                                transition={{ type: "spring", stiffness: 50, damping: 20 }}
                                className="h-full bg-red-600 relative overflow-hidden"
                              >
                                <motion.div 
                                  animate={{ x: ['-100%', '100%'] }}
                                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent w-full h-full"
                                />
                              </motion.div>
                           </div>
                           <div className={`z-10 w-4 h-4 rounded-full border-4 border-slate-900 transition-all duration-500 ${latestStatus !== 'none' ? 'bg-red-600 scale-125 shadow-[0_0_15px_rgba(220,38,38,0.4)]' : 'bg-slate-800'}`} />
                           <div className={`z-10 w-4 h-4 rounded-full border-4 border-slate-900 transition-all duration-500 ${latestStatus === 'preparing' || latestStatus === 'completed' ? 'bg-red-600 scale-125 shadow-[0_0_15_rgba(220,38,38,0.4)]' : 'bg-slate-800'}`} />
                           <div className={`z-10 w-4 h-4 rounded-full border-4 border-slate-900 transition-all duration-500 ${latestStatus === 'completed' ? 'bg-red-600 scale-125 shadow-[0_0_15px_rgba(220,38,38,0.4)]' : 'bg-slate-800'}`} />
                        </div>
                        
                        <div className="flex justify-between text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 px-1">
                           <span className={latestStatus === 'pending' ? 'text-white' : ''}>Queue</span>
                           <span className={latestStatus === 'preparing' ? 'text-white' : ''}>Grilling</span>
                           <span className={latestStatus === 'completed' ? 'text-white' : ''}>Ready</span>
                        </div>

                        <div className="mt-8 flex justify-center">
                           <div className="flex items-center gap-2 group-hover:gap-3 transition-all">
                              <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 group-hover:text-white transition-colors">Details & Items</span>
                              <ChevronRight className="w-3 h-3 text-red-600" />
                           </div>
                        </div>
                     </CardContent>
                  </Card>
                );
             })()}

             <div className="space-y-12">
              <div className="space-y-8">
                 {/* Promotional Banner */}
                 <motion.div 
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="relative h-56 rounded-[3rem] overflow-hidden bg-slate-950 group shadow-2xl shadow-slate-200"
                 >
                    <img 
                      src="https://picsum.photos/seed/primegrill/1200/600" 
                      className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-1000 ease-out" 
                      alt="Banner"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                    <div className="absolute inset-0 p-10 flex flex-col justify-end">
                       <div className="flex items-center gap-2.5 mb-3">
                          <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center">
                            <Gift className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.4em]">Seasonal Exclusive</span>
                       </div>
                       <h3 className="text-4xl font-black text-white tracking-tighter leading-[0.9] mb-2">PRIME REVELATION</h3>
                       <p className="text-slate-400 text-[11px] font-bold uppercase tracking-[0.3em] max-w-[200px] leading-relaxed">20% Special on all Tomahawk selections</p>
                    </div>
                    <div className="absolute top-8 right-8">
                       <motion.div 
                         animate={{ rotate: [0, 10, 0] }}
                         transition={{ repeat: Infinity, duration: 4 }}
                         className="w-16 h-16 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl flex items-center justify-center text-white shadow-2xl"
                       >
                          <Sparkles className="w-8 h-8 text-amber-400" />
                       </motion.div>
                    </div>
                 </motion.div>

                 {/* Modern Search Bar */}
                 <div className="relative group mx-1">
                    <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                       <Search className={`w-5 h-5 transition-all duration-300 ${searchQuery ? 'text-red-500 scale-110' : 'text-slate-400 group-focus-within:text-red-500 group-focus-within:scale-110'}`} />
                    </div>
                    <input 
                      type="text"
                      placeholder="What are you craving today?"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-16 bg-white border-2 border-slate-100 rounded-[2rem] pl-16 pr-14 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-8 focus:ring-red-500/5 focus:border-red-500 transition-all shadow-[0_10px_40px_rgb(0,0,0,0.02)]"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute inset-y-0 right-6 flex items-center text-slate-300 hover:text-red-500 transition-colors"
                      >
                         <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center">
                            <X className="w-3.5 h-3.5" />
                         </div>
                      </button>
                    )}
                 </div>

                 <div className="flex items-end justify-between px-2">
                     <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tighter leading-none">
                           {searchQuery ? 'Search Results' : 'Curated Menu'}
                        </h2>
                        <div className="h-1.5 w-12 bg-red-600 rounded-full mt-3" />
                     </div>
                     {!searchQuery && (
                        <div className="flex items-center gap-2 bg-red-50 px-4 py-2 rounded-full border border-red-100 animate-pulse">
                          <Flame className="w-4 h-4 text-red-600 fill-red-600" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-red-600">Flash Sales</span>
                        </div>
                     )}
                 </div>
              </div>
              
              <div className="grid grid-cols-1 gap-5">
                {menu
                  .filter(item => 
                    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.category.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((item, idx) => {
                  const isExpanded = expandedItemId === item.id;
                  return (
                    <motion.div 
                      key={item.id} 
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.05 }}
                      className="group"
                    >
                      <motion.div
                        onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                        className={`relative flex flex-col md:flex-row gap-6 bg-white p-5 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border-2 transition-all duration-500 cursor-pointer ${
                          isExpanded ? 'border-red-500 shadow-2xl shadow-red-500/10 scale-[1.02]' : 'border-slate-50 hover:border-slate-200 hover:scale-[1.01]'
                        }`}
                      >
                         <div className="w-full md:w-44 h-44 rounded-3xl overflow-hidden shrink-0 shadow-2xl bg-slate-100 relative group-hover:shadow-red-500/10 transition-shadow duration-500">
                           <img 
                             src={item.image_url || `https://picsum.photos/seed/${item.name}/400/400`} 
                             alt={item.name} 
                             className={`w-full h-full object-cover transition-transform duration-1000 ${isExpanded ? 'scale-110' : 'group-hover:scale-110'}`}
                             referrerPolicy="no-referrer"
                           />
                           <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                           {item.is_popular && (
                             <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md text-red-600 text-[9px] font-black px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-xl border border-white">
                               <Sparkles className="w-3 h-3 fill-red-600" />
                               ELITE CHOICE
                             </div>
                           )}
                        </div>
                        <div className="flex-1 flex flex-col justify-between py-1">
                          <div className="space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-black text-slate-900 text-xl tracking-tight leading-none group-hover:text-red-600 transition-colors uppercase">{item.name}</h3>
                                <div className="flex grow gap-2 mt-2">
                                  <Badge className="bg-slate-100 text-slate-500 border-none font-bold text-[8px] px-2 py-0.5 rounded-full uppercase tracking-widest">{item.category}</Badge>
                                  {item.is_spicy && <Flame className="w-3 h-3 text-red-500 fill-red-500" />}
                                </div>
                              </div>
                              <motion.div
                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                className="w-8 h-8 rounded-full border border-slate-100 flex items-center justify-center text-slate-400 group-hover:border-red-200 group-hover:text-red-500 transition-all"
                              >
                                <ChevronDown className="w-5 h-5" />
                              </motion.div>
                            </div>
                            <p className="text-sm text-slate-400 font-medium leading-relaxed line-clamp-2">{item.description}</p>
                          </div>
                          <div className="flex justify-between items-center mt-6">
                             <div className="flex flex-col">
                               <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">Price</span>
                               <span className="text-2xl font-black text-slate-900 tracking-tighter tabular-nums">{item.price} <span className="text-xs font-bold text-slate-400">ETB</span></span>
                             </div>
                             <Button 
                                size="lg" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToCart(item);
                                }} 
                                className="rounded-2xl px-6 bg-slate-900 hover:bg-red-600 shadow-2xl shadow-slate-200 hover:shadow-red-500/20 transition-all duration-300 h-14"
                             >
                                <span className="text-xs font-black uppercase tracking-[0.1em] mr-2">Quick Add</span>
                                <Plus className="w-5 h-5" />
                             </Button>
                          </div>
                        </div>
                      </motion.div>
                      
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ type: "spring", duration: 0.5, bounce: 0.1 }}
                            className="overflow-hidden"
                          >
                            <motion.div 
                              initial="hidden"
                              animate="visible"
                              variants={{
                                visible: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } }
                              }}
                              className="p-5 pt-10 space-y-6 bg-white border-x border-b border-red-50 rounded-b-[1.5rem] -mt-8 shadow-xl shadow-red-500/5 relative"
                            >
                              <motion.div 
                                variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
                                className="flex grow gap-3 overflow-x-auto pb-2 no-scrollbar"
                              >
                                 <Badge className="bg-red-50 text-red-600 border-red-100 whitespace-nowrap px-3 py-1 font-black text-[10px] uppercase tracking-wider">{item.category}</Badge>
                                 <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-full text-slate-500 whitespace-nowrap">
                                    <Clock className="w-3 h-3" />
                                    <span className="text-[10px] font-bold uppercase">{item.prep_time || '15-20 MIN'}</span>
                                 </div>
                                 <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-full text-slate-500 whitespace-nowrap">
                                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                    <span className="text-[10px] font-bold">4.9 (120+)</span>
                                 </div>
                                 {item.is_spicy && (
                                   <div className="flex items-center gap-1.5 bg-red-50 px-3 py-1 rounded-full text-red-500 whitespace-nowrap border border-red-100">
                                     <Flame className="w-3 h-3 fill-red-500" />
                                     <span className="text-[10px] font-black uppercase tracking-tight">Spicy</span>
                                   </div>
                                 )}
                              </motion.div>

                              <motion.p 
                                variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
                                className="text-slate-500 text-xs leading-relaxed font-medium"
                              >
                                 {item.description}
                              </motion.p>

                              <motion.div 
                                variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
                                className="grid grid-cols-2 gap-3"
                               >
                                 <div className="bg-slate-50/50 p-4 rounded-[1.5rem] border border-slate-100 group hover:border-red-500/30 transition-colors">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Zap className="w-3 h-3 text-red-500" />
                                      <span className="text-[9px] uppercase font-black text-slate-400 tracking-widest leading-none">Nutrients</span>
                                    </div>
                                    <span className="text-slate-900 font-extrabold text-xs block mb-0.5">{item.protein || 'High'} Protein</span>
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight leading-none">{item.fat || 'Balanced'} FAT • {item.calories || 650} kcal</span>
                                 </div>
                                 <div className="bg-slate-50/50 p-4 rounded-[1.5rem] border border-slate-100 group hover:border-red-500/30 transition-colors">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Landmark className="w-3 h-3 text-red-500" />
                                      <span className="text-[9px] uppercase font-black text-slate-400 tracking-widest leading-none">Provenance</span>
                                    </div>
                                    <span className="text-slate-900 font-extrabold text-xs block mb-0.5">{item.origin || 'Prime Grade'}</span>
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight leading-none">Selected Selection</span>
                                 </div>
                              </motion.div>

                              {item.allergens && item.allergens !== 'None' && (
                                <motion.div 
                                  variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
                                  className="flex items-start gap-3 p-3 bg-amber-50/50 rounded-2xl border border-amber-100/50"
                                >
                                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                  <div>
                                    <span className="text-[9px] uppercase font-black text-amber-700 block mb-0.5">Allergen Notice</span>
                                    <span className="text-[10px] font-bold text-amber-600/80 leading-tight">Contains: {item.allergens}</span>
                                  </div>
                                </motion.div>
                              )}

                              <motion.div 
                                variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
                                className="flex gap-3 items-center"
                              >
                                <div className="flex items-center bg-slate-100 rounded-2xl p-1">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="w-10 h-10 rounded-xl hover:bg-white transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setItemQuantities(prev => ({
                                        ...prev,
                                        [item.id]: Math.max(1, (prev[item.id] || 1) - 1)
                                      }));
                                    }}
                                  >
                                    <Minus className="w-4 h-4" />
                                  </Button>
                                  <span className="px-4 font-black w-10 text-center">{itemQuantities[item.id] || 1}</span>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="w-10 h-10 rounded-xl hover:bg-white transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setItemQuantities(prev => ({
                                        ...prev,
                                        [item.id]: (prev[item.id] || 1) + 1
                                      }));
                                    }}
                                  >
                                    <Plus className="w-4 h-4" />
                                  </Button>
                                </div>
                                <Button 
                                  onClick={() => {
                                    addToCart(item, itemQuantities[item.id] || 1);
                                    setItemQuantities(prev => ({ ...prev, [item.id]: 1 }));
                                  }}
                                  className="flex-1 h-12 rounded-2xl bg-slate-900 hover:bg-red-600 text-sm font-black transition-all shadow-lg"
                                >
                                   Add {itemQuantities[item.id] || 1} {item.name}
                                </Button>
                              </motion.div>
                            </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </div>
           </div>
         ) : (
           <div className="space-y-12 animate-in fade-in slide-in-from-bottom-5 duration-700 pb-20">
             <div className="bg-slate-900 p-10 rounded-[3rem] border border-slate-800 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12 group-hover:rotate-0 transition-transform duration-1000">
                   <Clock className="w-32 h-32 text-white" />
                </div>
                <div className="relative z-10">
                  <h1 className="text-3xl font-black text-white tracking-tighter leading-none">Dining Session</h1>
                  <div className="flex items-center gap-3 mt-4">
                     <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.8)]" />
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Real-time Order Tracking</p>
                  </div>
                </div>
                <div className="flex items-center gap-10 relative z-10">
                   <div className="text-right">
                     <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-2">Total Tickets</span>
                     <span className="text-4xl font-black text-white tracking-tighter tabular-nums">{activeOrders.length}</span>
                   </div>
                   <div className="w-px h-14 bg-slate-800 rotate-6" />
                   <div className="flex flex-col items-end">
                     <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.3em] mb-2">Grand Total</span>
                     <span className="text-3xl font-black text-white tracking-tighter tabular-nums">
                       {activeOrders.reduce((sum, o) => sum + o.total_amount, 0).toLocaleString()} <span className="text-xs text-slate-500">ETB</span>
                     </span>
                   </div>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                {activeOrders.map((order, idx) => (
                   <motion.div 
                     key={order.id}
                     initial={{ opacity: 0, scale: 0.95 }}
                     whileInView={{ opacity: 1, scale: 1 }}
                     viewport={{ once: true }}
                     transition={{ delay: idx * 0.1 }}
                     className="bg-white rounded-[2.5rem] border-2 border-slate-50 shadow-[0_10px_50px_rgba(0,0,0,0.03)] hover:shadow-2xl hover:shadow-red-500/5 transition-all duration-500 overflow-hidden group"
                   >
                     <div className="bg-slate-50/50 px-8 py-6 flex justify-between items-center border-b border-slate-100">
                       <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-xs font-black shadow-xl">#{idx + 1}</div>
                         <div>
                           <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Order Ref</p>
                           <p className="text-sm font-black text-slate-900 tracking-tight">ID_{order.id.slice(0, 8).toUpperCase()}</p>
                         </div>
                       </div>
                       <div className="flex flex-col items-end">
                          <Badge 
                            variant="outline" 
                            className={`text-[8px] px-3 py-1 font-black border-none tracking-widest uppercase rounded-full ${
                              order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'
                            }`}
                          >
                            {order.payment_status}
                          </Badge>
                          <span className="text-[8px] font-bold text-slate-400 uppercase mt-2 tracking-tighter">Status: {order.status}</span>
                       </div>
                     </div>
                     <div className="p-8 space-y-5">
                       {(allOrderItems[order.id] || []).map((item: any) => (
                         <div key={item.id} className="flex justify-between items-center bg-slate-50/30 p-3 rounded-2xl border border-transparent hover:border-slate-100 transition-colors group/item">
                           <div className="flex gap-4 items-center">
                             <div className="w-12 h-12 rounded-xl overflow-hidden bg-white border border-slate-100 shadow-sm group-hover/item:scale-110 transition-transform">
                                <img src={`https://picsum.photos/seed/${item.item_name}/100/100`} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                             </div>
                             <div>
                                <p className="text-sm font-black text-slate-900 leading-none uppercase tracking-tight">{item.item_name}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.1em] mt-1.5">{item.quantity} Unit(s) • {item.price} ETB</p>
                             </div>
                           </div>
                           <span className="text-sm font-black text-slate-900 tabular-nums">{(item.price * item.quantity).toLocaleString()}</span>
                         </div>
                       ))}
                       
                       {order.payment_status === 'unpaid' && (
                         <div className="pt-6 mt-4 border-t border-dashed border-slate-200">
                            <Button 
                              onClick={() => {
                                setOrderId(order.id);
                                setPaymentStep('method');
                              }}
                             className="w-full rounded-2xl bg-red-600 hover:bg-red-700 font-black text-[10px] h-14 shadow-2xl shadow-red-500/20 uppercase tracking-[0.2em] group"
                            >
                               Settle Bill <ChevronRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Button>
                         </div>
                       )}
                     </div>
                   </motion.div>
                ))}
             </div>
           </div>
         )}
         <div className="h-24" />
      </div>
      
      <div className="fixed bottom-6 left-0 right-0 z-40 px-4 pointer-events-none">
        <div className="max-w-md mx-auto pointer-events-auto">
          <div className="bg-slate-950/90 backdrop-blur-3xl border border-white/5 shadow-2xl rounded-[2.5rem] p-1.5 flex items-center justify-between relative overflow-hidden">
            {/* Dock Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-[1px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
            
            {/* Menu Tab */}
            <button 
              onClick={() => setActiveTab('menu')}
              className={`flex-1 group relative flex flex-col items-center justify-center py-3.5 rounded-2xl transition-all duration-300 z-10 ${activeTab === 'menu' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {activeTab === 'menu' && (
                <motion.div 
                  layoutId="activeTabGlow"
                  className="absolute inset-0 bg-red-600 rounded-2xl -z-10 shadow-[0_0_20px_rgba(220,38,38,0.3)]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <motion.div whileTap={{ scale: 0.9 }}>
                <Utensils className={`w-5 h-5 transition-transform duration-300 ${activeTab === 'menu' ? 'scale-110 mb-0.5' : 'group-hover:scale-110'}`} />
              </motion.div>
              <span className={`text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${activeTab === 'menu' ? 'opacity-100 mt-0.5' : 'opacity-60 scale-90'}`}>Menu</span>
            </button>
            
            {/* Cart Sheet Integration */}
            <Sheet>
               <SheetTrigger asChild>
                  <button 
                    className="flex-1 group flex flex-col items-center justify-center py-3.5 rounded-2xl text-slate-500 hover:text-slate-300 relative z-10 transition-all duration-300 active:scale-95"
                  >
                    <div className="relative">
                      <motion.div whileHover={{ scale: 1.1 }}>
                        <ShoppingCart className="w-5 h-5 group-hover:text-red-500 transition-colors" />
                      </motion.div>
                      <AnimatePresence>
                        {cart.length > 0 && (
                          <motion.div 
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="absolute -top-2.5 -right-2.5 min-w-[18px] h-[18px] px-1 bg-white rounded-full flex items-center justify-center text-[8px] font-black text-slate-900 shadow-xl"
                          >
                            {cart.reduce((a, b) => a + b.quantity, 0)}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.15em] opacity-60 group-hover:opacity-100 group-hover:text-red-500 transition-all mt-0.5">BASKET</span>
                  </button>
               </SheetTrigger>
               <SheetContent side="bottom" className="h-[85vh] rounded-t-[3.5rem] border-t-0 p-0 overflow-hidden bg-white shadow-2xl flex flex-col">
                <div className="p-6 pb-0 flex items-center justify-between">
                  <SheetHeader>
                    <SheetTitle className="text-2xl font-black flex items-center gap-3">
                       <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white"><ShoppingBag /></div>
                       Review Your Order
                    </SheetTitle>
                  </SheetHeader>
                  <SheetClose asChild>
                    <Button variant="ghost" className="text-red-600 font-black text-[10px] uppercase tracking-widest gap-2 hover:bg-red-50 hover:text-red-700 rounded-xl">
                       Back to Menu
                    </Button>
                  </SheetClose>
                </div>

                <ScrollArea className="flex-1 my-2 px-6">
                  <div className="space-y-6 pb-12">
                    {cart.map(item => (
                      <motion.div 
                        layout
                        key={item.menu_item_id} 
                        className="flex justify-between items-center group bg-white p-5 rounded-[2.5rem] border border-slate-50 shadow-[0_4px_25px_rgba(0,0,0,0.03)] hover:shadow-xl hover:shadow-red-500/5 transition-all duration-500"
                      >
                        <div className="flex gap-5 items-center">
                          <div className="flex flex-col items-center bg-slate-900 rounded-2xl p-1 shadow-2xl">
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               className="w-8 h-8 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
                               onClick={() => updateQuantity(item.menu_item_id, 1)}
                             >
                               <Plus className="w-3 h-3" />
                             </Button>
                             <span className="font-black text-xs py-1 tabular-nums text-white">{item.quantity}</span>
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               className="w-8 h-8 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
                               onClick={() => updateQuantity(item.menu_item_id, -1)}
                             >
                               <Minus className="w-3 h-3" />
                             </Button>
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-lg tracking-tight leading-tight uppercase">{item.item_name}</p>
                            <div className="flex items-center gap-2 mt-2">
                               <Badge className="bg-red-50 text-red-600 border-none font-black text-[8px] px-2 py-0.5 rounded-full">PREMIUM ITEM</Badge>
                               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{item.price} ETB / Unit</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-3">
                           <span className="font-black text-slate-900 text-xl tracking-tighter tabular-nums">{(item.price * item.quantity).toLocaleString()}</span>
                           <button 
                             onClick={() => removeFromCart(item.menu_item_id)}
                             className="text-[9px] font-black uppercase text-slate-300 hover:text-red-500 tracking-[0.2em] transition-colors"
                           >
                              Remove
                           </button>
                        </div>
                      </motion.div>
                    ))}
                    {cart.length === 0 && (
                      <div className="py-24 flex flex-col items-center justify-center text-slate-300 gap-6">
                         <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center relative">
                            <ShoppingBag className="w-10 h-10 opacity-20" />
                            <div className="absolute top-0 right-0 w-4 h-4 bg-slate-100 rounded-full border-4 border-white" />
                         </div>
                         <div className="text-center">
                            <p className="font-black text-slate-900 text-lg">Your basket is empty</p>
                            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Start exploring our premium selections</p>
                            <SheetClose asChild>
                              <Button variant="outline" className="mt-8 rounded-2xl border-slate-200 font-black text-xs uppercase tracking-widest px-8">
                                Browse the Menu
                              </Button>
                            </SheetClose>
                         </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <div className="p-8 pt-6 pb-12 border-t border-slate-50 bg-white/80 backdrop-blur-xl relative">
                   <div className="flex justify-between items-end w-full mb-8">
                     <div>
                       <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] block mb-2">Subtotal Amount</span>
                       <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-black tabular-nums text-slate-900 tracking-tighter">{totalAmount.toLocaleString()}</span>
                          <span className="text-sm font-black text-slate-400">ETB</span>
                       </div>
                     </div>
                     <div className="text-right">
                       <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Vat Included</span>
                       <span className="text-xs font-bold text-slate-900">Total payable</span>
                     </div>
                   </div>
                   
                   <Button 
                     disabled={cart.length === 0}
                     onClick={placeOrder}
                     className="w-full h-16 rounded-[2rem] bg-slate-900 hover:bg-slate-800 text-white shadow-2xl shadow-slate-200 transition-all duration-500 overflow-hidden group border-none"
                   >
                     <div className="relative z-10 flex flex-col items-center">
                        <span className="text-xs text-slate-400 group-hover:text-red-100 font-black uppercase tracking-[0.2em] mb-1">Secure Checkout</span>
                        <span className="text-base font-black uppercase tracking-widest flex items-center gap-3">
                           Confirm Order <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </span>
                     </div>
                     <motion.div 
                        className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        style={{ backgroundSize: '200% 100%' }}
                        animate={{ backgroundPosition: ['0% 0%', '100% 0%'] }}
                        transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                     />
                   </Button>
                   <div className="mt-4 flex justify-center">
                     {tableNumber === '' && (
                       <motion.div 
                         initial={{ opacity: 0, scale: 0.9 }}
                         animate={{ opacity: 1, scale: 1 }}
                         className="flex items-center justify-center gap-2 mt-4 text-red-500"
                       >
                          <ShieldAlert className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Table registration required</span>
                       </motion.div>
                     )}
                   </div>
                </div>
               </SheetContent>
            </Sheet>

            {/* Session Tab */}
            <button 
              onClick={() => setActiveTab('orders')}
              className={`flex-1 group flex flex-col items-center justify-center py-3.5 rounded-2xl transition-all duration-300 relative z-10 ${activeTab === 'orders' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {activeTab === 'orders' && (
                <motion.div 
                  layoutId="activeTabGlow"
                  className="absolute inset-0 bg-red-600 rounded-2xl -z-10 shadow-[0_0_20px_rgba(220,38,38,0.3)]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <div className="relative">
                <motion.div whileTap={{ scale: 0.9 }}>
                  <ShoppingBag className={`w-5 h-5 transition-transform duration-300 ${activeTab === 'orders' ? 'scale-110 mb-0.5' : 'group-hover:scale-110'}`} />
                </motion.div>
                {activeOrders.length > 0 && (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white rounded-full border-2 border-slate-950 shadow-sm" 
                  />
                )}
              </div>
              <span className={`text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${activeTab === 'orders' ? 'opacity-100 mt-0.5' : 'opacity-60 scale-90'}`}>Session</span>
            </button>
          </div>
        </div>
      </div>

      {isOrdered && paymentStep === 'method' && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center">
           <motion.div 
             initial={{ y: '100%' }} animate={{ y: 0 }}
             className="bg-white w-full max-w-lg rounded-t-3xl p-8 pb-10"
           >
              <h2 className="text-2xl font-black mb-1">Select Payment</h2>
              <p className="text-slate-500 mb-8 font-mono">Order ID: {orderId?.slice(0,8)}</p>
              
              <div className="grid grid-cols-1 gap-3">
                <Button onClick={() => handlePayment('Credit Card')} className="h-16 rounded-2xl bg-slate-50 hover:bg-red-50 text-slate-900 hover:text-red-600 border border-slate-100 flex items-center justify-between px-6 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform"><CreditCard className="w-5 h-5" /></div>
                    <span className="font-bold">Credit/Debit Card</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </Button>
                <Button onClick={() => handlePayment('Mobile Wallet')} className="h-16 rounded-2xl bg-slate-50 hover:bg-red-50 text-slate-900 hover:text-red-600 border border-slate-100 flex items-center justify-between px-6 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform"><Wallet className="w-5 h-5" /></div>
                    <span className="font-bold">Mobile Money</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </Button>
                <Button onClick={() => handlePayment('Cash')} className="h-16 rounded-2xl bg-slate-50 hover:bg-red-50 text-slate-900 hover:text-red-600 border border-slate-100 flex items-center justify-between px-6 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform"><Landmark className="w-5 h-5" /></div>
                    <span className="font-bold">Cash to Server</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </Button>
              </div>
              <Button onClick={() => setPaymentStep('none')} variant="ghost" className="w-full mt-6 h-12 text-slate-400 font-bold">Cancel</Button>
           </motion.div>
        </div>
      )}
    </div>
  );
}
