import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area 
} from 'recharts';
import { 
  LayoutDashboard, ShoppingBag, Box, Trash2, QrCode, UtensilsCrossed, Plus, ArrowUpRight, TrendingUp, DollarSign, Package, AlertCircle 
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { socket } from '@/lib/socket';
import { InventoryItem, MenuItem, Order, WasteItem, Table as TableType } from '@/types';

export default function AdminView() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [waste, setWaste] = useState<WasteItem[]>([]);
  const [tables, setTables] = useState<TableType[]>([]);
  const [analytics, setAnalytics] = useState<any[]>([]);

  // Form states
  const [newMenuItem, setNewMenuItem] = useState({ 
    name: '', price: '', category: 'Main', description: '', image_url: '',
    prep_time: '', calories: '', origin: '', is_spicy: false, is_popular: false,
    allergens: '', protein: '', fat: ''
  });
  const [newInventory, setNewInventory] = useState({ name: '', category: 'Meat', quantity: '', unit: 'kg', price: '' });
  const [newWaste, setNewWaste] = useState({ item_name: '', quantity: '', unit: 'kg', reason: '' });

  useEffect(() => {
    fetchData();

    socket.on('new_order', (order: Order) => {
      setOrders(prev => [order, ...prev]);
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

  useEffect(() => {
    if (activeTab !== 'dashboard') { // Skip initial redundant fetch since mount useEffect handles it
       fetchData();
    }
  }, [activeTab]);

  const fetchData = async () => {
    const [invRes, menuRes, ordRes, wasteRes, tablesRes, analRes] = await Promise.all([
      fetch('/api/inventory'), fetch('/api/admin/menu'), fetch('/api/orders'), 
      fetch('/api/waste'), fetch('/api/tables'), fetch('/api/analytics/finance')
    ]);
    setInventory(await invRes.json());
    setMenu(await menuRes.json());
    setOrders(await ordRes.json());
    setWaste(await wasteRes.json());
    setTables(await tablesRes.json());
    setAnalytics(await analRes.json());
  };

  const handleAddMenu = async () => {
    await fetch('/api/admin/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newMenuItem, price: parseFloat(newMenuItem.price) }),
    });
    setNewMenuItem({ 
      name: '', price: '', category: 'Main', description: '', image_url: '',
      prep_time: '', calories: '', origin: '', is_spicy: false, is_popular: false,
      allergens: '', protein: '', fat: ''
    });
    fetchData();
    toast.success("Menu item added");
  };

  const handleAddInventory = async () => {
    await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        ...newInventory, 
        quantity: parseFloat(newInventory.quantity),
        price: parseFloat(newInventory.price)
      }),
    });
    setNewInventory({ name: '', category: 'Meat', quantity: '', unit: 'kg', price: '' });
    fetchData();
    toast.success("Inventory item added");
  };

  const generateQRCode = async (tableNum: string) => {
    const url = `${window.location.origin}/?table=${tableNum}`;
    const qrDataUrl = await QRCode.toDataURL(url);
    await fetch('/api/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: tableNum, qr_code: qrDataUrl }),
    });
    fetchData();
    toast.success(`QR Code generated for Table ${tableNum}`);
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success(`Order status updated to ${status}`);
      }
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleAddWaste = async () => {
     await fetch('/api/waste', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newWaste, quantity: parseFloat(newWaste.quantity) }),
    });
    setNewWaste({ item_name: '', quantity: '', unit: 'kg', reason: '' });
    fetchData();
    toast.success("Waste logged");
  };

  const dashboardCards = [
    { title: 'Total Revenue', value: `${orders.filter(o => o.payment_status === 'paid').reduce((a,b) => a + b.total_amount, 0).toLocaleString()} ETB`, icon: DollarSign, color: 'text-green-600', trend: '+12.5%' },
    { title: 'Total Orders', value: orders.length, icon: ShoppingBag, color: 'text-blue-600', trend: '+5.2%' },
    { title: 'Inventory Items', value: inventory.length, icon: Box, color: 'text-orange-600', trend: 'In Stock' },
    { title: 'Stock Waste', value: `${waste.reduce((a,b) => a + b.quantity, 0)} kg`, icon:Trash2, color: 'text-red-500', trend: 'This Month' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 text-white flex flex-col hidden md:flex">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-bold">P</div>
          <span className="font-black text-lg">PrimeCut Admin</span>
        </div>
        <nav className="flex-1 px-4 space-y-2 py-4">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'orders', label: 'All Orders', icon: ShoppingBag },
            { id: 'inventory', label: 'Inventory', icon: Box },
            { id: 'menu', label: 'Menu Mgmt', icon: UtensilsCrossed },
            { id: 'tables', label: 'QR Tables', icon: QrCode },
            { id: 'waste', label: 'Waste Mgmt', icon: Trash2 },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === item.id ? 'bg-red-600 shadow-lg shadow-red-900/20' : 'hover:bg-slate-800 text-slate-400'}`}
            >
              <item.icon className="w-4 h-4" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-6 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-700 mx-auto md:mx-0" />
            <div className="hidden md:block">
              <p className="text-sm font-bold">Admin User</p>
              <p className="text-xs text-slate-500">Super Admin</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Dashboard View */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              <div className="flex justify-between items-end">
                <div>
                  <h1 className="text-3xl font-black text-slate-900">Dashboard</h1>
                  <p className="text-slate-500">Business overview and analytics</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={fetchData}>Refresh Data</Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {dashboardCards.map((card, i) => (
                  <Card key={i} className="border-none shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className={`p-2 rounded-lg bg-slate-100 ${card.color}`}>
                          <card.icon className="w-5 h-5" />
                        </div>
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none font-bold">
                          {card.trend}
                        </Badge>
                      </div>
                      <p className="text-slate-500 text-sm font-medium">{card.title}</p>
                      <p className="text-2xl pt-1 font-black text-slate-900">{card.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="border-none shadow-sm h-[400px]">
                  <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                      <span>Revenue Analysis</span>
                      <TrendingUp className="w-5 h-5 text-green-500" />
                    </CardTitle>
                    <CardDescription>Daily revenue for the last 30 days</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics}>
                        <defs>
                          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" hide />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                        <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                        <Area type="monotone" dataKey="total" stroke="#ef4444" fillOpacity={1} fill="url(#colorTotal)" strokeWidth={3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm h-[400px]">
                  <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                      <span>Recent Orders</span>
                      <ArrowUpRight className="w-5 h-5 text-slate-400" />
                    </CardTitle>
                    <CardDescription>Latest customer activity</CardDescription>
                  </CardHeader>
                  <CardContent>
                     <ScrollArea className="h-[300px]">
                        <div className="space-y-4">
                           {orders.slice(0, 10).map(order => (
                             <div key={order.id} className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100">
                                <div>
                                   <p className="font-bold">Table {order.table_number}</p>
                                   <p className="text-xs text-slate-400 font-mono">{new Date(order.created_at).toLocaleTimeString()}</p>
                                </div>
                                <div className="text-right">
                                   <p className="font-black font-mono">{order.total_amount} ETB</p>
                                   <Badge variant={order.status === 'completed' ? 'secondary' : 'default'} className="mt-1">{order.status}</Badge>
                                </div>
                             </div>
                           ))}
                        </div>
                     </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Orders View */}
          {activeTab === 'orders' && (
             <div className="space-y-4">
                <h1 className="text-2xl font-black">All Orders</h1>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map(o => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{o.id.slice(0,8)}</TableCell>
                        <TableCell className="font-bold">{o.table_number}</TableCell>
                        <TableCell className="font-mono">{o.total_amount} ETB</TableCell>
                        <TableCell>
                          <div className="space-y-1.5 min-w-[120px]">
                            <div className="flex items-center gap-2">
                               <div className={`w-2 h-2 rounded-full ${
                                 o.status === 'completed' ? 'bg-green-500' : 
                                 o.status === 'preparing' ? 'bg-amber-500 animate-pulse' :
                                 o.status === 'pending' ? 'bg-blue-500 animate-pulse' :
                                 'bg-slate-400'
                               }`} />
                               <Badge variant={
                                 o.status === 'completed' ? 'secondary' : 
                                 o.status === 'preparing' ? 'default' :
                                 'destructive'
                               } className="capitalize py-0 h-5 text-[10px] font-black">{o.status}</Badge>
                            </div>
                            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                               <motion.div 
                                 initial={{ width: 0 }}
                                 animate={{ 
                                   width: o.status === 'pending' ? '33%' : 
                                          o.status === 'preparing' ? '66%' : 
                                          o.status === 'completed' ? '100%' : '0%' 
                                 }}
                                 className={`h-full ${
                                   o.status === 'completed' ? 'bg-green-500' : 
                                   o.status === 'preparing' ? 'bg-amber-500' : 'bg-blue-500'
                                 }`}
                               />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                           <Badge variant="outline" className={o.payment_status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}>
                              {o.payment_status}
                           </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-400">{new Date(o.created_at).toLocaleString()}</TableCell>
                        <TableCell className="text-xs text-slate-500 font-medium">
                           {o.updated_at ? new Date(o.updated_at).toLocaleTimeString() : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Select 
                            value={o.status} 
                            onValueChange={(val) => handleUpdateOrderStatus(o.id, val)}
                          >
                            <SelectTrigger className="w-32 ml-auto">
                              <SelectValue placeholder="Update Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="preparing">Preparing</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
             </div>
          )}

          {/* Inventory View */}
          {activeTab === 'inventory' && (
             <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-black">Inventory Control</h1>
                  <Dialog>
                    <DialogTrigger
                      render={
                        <Button className="bg-red-600 hover:bg-red-700 rounded-xl">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Stock
                        </Button>
                      }
                    />
                    <DialogContent>
                      <DialogHeader><DialogTitle>Add New Inventory Item</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2"><Label>Item Name</Label><Input value={newInventory.name} onChange={e => setNewInventory({...newInventory, name: e.target.value})} placeholder="Beef Tenderloin" /></div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2"><Label>Quantity</Label><Input type="number" value={newInventory.quantity} onChange={e => setNewInventory({...newInventory, quantity: e.target.value})} /></div>
                           <div className="space-y-2"><Label>Unit</Label><Input value={newInventory.unit} onChange={e => setNewInventory({...newInventory, unit: e.target.value})} placeholder="kg" /></div>
                        </div>
                        <div className="space-y-2"><Label>Purchase Price (ETB)</Label><Input type="number" value={newInventory.price} onChange={e => setNewInventory({...newInventory, price: e.target.value})} /></div>
                      </div>
                      <DialogFooter><Button onClick={handleAddInventory} className="w-full bg-red-600">Save Item</Button></DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                
                <div className="grid grid-cols-1 gap-6">
                   <Table>
                      <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead>In Stock</TableHead><TableHead>Price/Unit</TableHead><TableHead>Last Updated</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {inventory.map(item => (
                          <TableRow key={item.id}>
                            <TableCell className="font-bold">{item.name}</TableCell>
                            <TableCell><Badge variant="outline">{item.category}</Badge></TableCell>
                            <TableCell className="font-bold">{item.quantity} {item.unit}</TableCell>
                            <TableCell>{item.price} ETB</TableCell>
                            <TableCell className="text-xs text-slate-400">{new Date(item.last_updated).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                   </Table>
                </div>
             </div>
          )}

          {/* Menu View */}
          {activeTab === 'menu' && (
            <div className="space-y-6">
               <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-black">Menu Management</h1>
                  <Dialog>
                    <DialogTrigger
                      render={
                        <Button className="bg-red-600 hover:bg-red-700 rounded-xl">
                          <Plus className="w-4 h-4 mr-2" />
                          New Item
                        </Button>
                      }
                    />
                    <DialogContent>
                       <DialogHeader><DialogTitle>Add New Dish</DialogTitle></DialogHeader>
                       <ScrollArea className="max-h-[70vh] pr-4">
                         <div className="space-y-4 py-4">
                           <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2"><Label>Dish Name</Label><Input value={newMenuItem.name} onChange={e => setNewMenuItem({...newMenuItem, name: e.target.value})} /></div>
                             <div className="space-y-2"><Label>Price (ETB)</Label><Input type="number" value={newMenuItem.price} onChange={e => setNewMenuItem({...newMenuItem, price: e.target.value})} /></div>
                           </div>
                           <div className="space-y-2"><Label>Category</Label>
                             <Select value={newMenuItem.category} onValueChange={v => setNewMenuItem({...newMenuItem, category: v})}>
                               <SelectTrigger><SelectValue /></SelectTrigger>
                               <SelectContent>
                                 <SelectItem value="Main Course">Main Course</SelectItem>
                                 <SelectItem value="Appetizers">Appetizers</SelectItem>
                                 <SelectItem value="Sides">Sides</SelectItem>
                                 <SelectItem value="Desserts">Desserts</SelectItem>
                               </SelectContent>
                             </Select>
                           </div>
                           <div className="space-y-2"><Label>Description</Label><Input value={newMenuItem.description} onChange={e => setNewMenuItem({...newMenuItem, description: e.target.value})} /></div>
                           
                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2"><Label>Prep Time</Label><Input value={newMenuItem.prep_time} placeholder="20-25 min" onChange={e => setNewMenuItem({...newMenuItem, prep_time: e.target.value})} /></div>
                              <div className="space-y-2"><Label>Calories</Label><Input type="number" value={newMenuItem.calories} onChange={e => setNewMenuItem({...newMenuItem, calories: e.target.value})} /></div>
                           </div>

                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2"><Label>Protein</Label><Input value={newMenuItem.protein} placeholder="35g" onChange={e => setNewMenuItem({...newMenuItem, protein: e.target.value})} /></div>
                              <div className="space-y-2"><Label>Fat</Label><Input value={newMenuItem.fat} placeholder="12g" onChange={e => setNewMenuItem({...newMenuItem, fat: e.target.value})} /></div>
                           </div>

                           <div className="space-y-2"><Label>Origin</Label><Input value={newMenuItem.origin} placeholder="Angus Farm" onChange={e => setNewMenuItem({...newMenuItem, origin: e.target.value})} /></div>
                           <div className="space-y-2"><Label>Allergens</Label><Input value={newMenuItem.allergens} placeholder="Gluten, Dairy" onChange={e => setNewMenuItem({...newMenuItem, allergens: e.target.value})} /></div>
                           <div className="space-y-2"><Label>Image URL</Label><Input value={newMenuItem.image_url} onChange={e => setNewMenuItem({...newMenuItem, image_url: e.target.value})} /></div>
                           
                           <div className="flex gap-4 pt-2">
                              <div className="flex items-center space-x-2">
                                <input type="checkbox" checked={newMenuItem.is_spicy} onChange={e => setNewMenuItem({...newMenuItem, is_spicy: e.target.checked})} id="spicy" className="accent-red-600" />
                                <Label htmlFor="spicy">Spicy Dish</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <input type="checkbox" checked={newMenuItem.is_popular} onChange={e => setNewMenuItem({...newMenuItem, is_popular: e.target.checked})} id="popular" className="accent-red-600" />
                                <Label htmlFor="popular">Popular/Top Rated</Label>
                              </div>
                           </div>
                         </div>
                       </ScrollArea>
                       <DialogFooter><Button onClick={handleAddMenu} className="w-full bg-red-600">Publish to Menu</Button></DialogFooter>
                    </DialogContent>
                  </Dialog>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {menu.map(item => (
                    <Card key={item.id} className="overflow-hidden">
                       <img src={item.image_url || `https://picsum.photos/seed/${item.name}/200/200`} alt={item.name} className="h-40 w-full object-cover" referrerPolicy="no-referrer" />
                       <CardHeader>
                          <div className="flex justify-between items-start">
                             <CardTitle>{item.name}</CardTitle>
                             <Badge variant="outline" className="text-red-600 font-mono">{item.price} ETB</Badge>
                          </div>
                          <CardDescription>{item.description}</CardDescription>
                       </CardHeader>
                    </Card>
                  ))}
               </div>
            </div>
          )}

          {/* Tables View */}
          {activeTab === 'tables' && (
             <div className="space-y-6">
                <div className="flex justify-between items-center">
                   <h1 className="text-2xl font-black">Table & QR Management</h1>
                   <Dialog>
                      <DialogTrigger
                        render={
                          <Button className="bg-slate-900 border-none rounded-xl">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Table
                          </Button>
                        }
                      />
                      <DialogContent>
                         <DialogHeader><DialogTitle>Generate New Table QR</DialogTitle></DialogHeader>
                         <div className="py-4 space-y-4">
                            <Label>Table Number</Label>
                            <Input placeholder="Enter table number (e.g. 5)" id="table_num_input" />
                         </div>
                         <DialogFooter>
                            <Button onClick={() => {
                              const input = document.getElementById('table_num_input') as HTMLInputElement;
                              if (input.value) generateQRCode(input.value);
                            }} className="w-full bg-red-600">Generate & Save</Button>
                         </DialogFooter>
                      </DialogContent>
                   </Dialog>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                   {tables.map(table => (
                     <Card key={table.id} className="bg-white flex flex-col items-center p-6 text-center border-none shadow-sm group">
                        <div className="text-3xl font-black mb-4">Table {table.number}</div>
                        <img src={table.qr_code} alt={`Table ${table.number} QR`} className="w-40 h-40 mb-6 border p-2 rounded-xl group-hover:scale-110 transition-transform" />
                        <Button variant="outline" size="sm" onClick={() => {
                           const link = document.createElement('a');
                           link.href = table.qr_code;
                           link.download = `table-${table.number}-qr.png`;
                           link.click();
                        }}>Download PNG</Button>
                     </Card>
                   ))}
                   {tables.length === 0 && <p className="col-span-full py-20 text-center text-slate-400">No tables configured. Generate your first QR code!</p>}
                </div>
             </div>
          )}

          {/* Waste View */}
          {activeTab === 'waste' && (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                   <h1 className="text-2xl font-black text-red-700">Waste Management</h1>
                   <Dialog>
                      <DialogTrigger
                        render={
                          <Button variant="destructive" className="rounded-xl">
                            <Plus className="w-4 h-4 mr-2" />
                            Report Waste
                          </Button>
                        }
                      />
                      <DialogContent>
                         <DialogHeader><DialogTitle>Log Stock Waste</DialogTitle></DialogHeader>
                         <div className="py-4 space-y-4">
                            <div className="space-y-2"><Label>Item Name</Label><Input value={newWaste.item_name} onChange={e => setNewWaste({...newWaste, item_name: e.target.value})} placeholder="Ribeye Steak" /></div>
                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2"><Label>Quantity</Label><Input type="number" value={newWaste.quantity} onChange={e => setNewWaste({...newWaste, quantity: e.target.value})} /></div>
                               <div className="space-y-2"><Label>Unit</Label><Input value={newWaste.unit} onChange={e => setNewWaste({...newWaste, unit: e.target.value})} /></div>
                            </div>
                            <div className="space-y-2"><Label>Reason</Label><Input value={newWaste.reason} onChange={e => setNewWaste({...newWaste, reason: e.target.value})} placeholder="Spoiled / Trimmed" /></div>
                         </div>
                         <DialogFooter><Button onClick={handleAddWaste} className="w-full bg-red-600">Save Log</Button></DialogFooter>
                      </DialogContent>
                   </Dialog>
                </div>
                <Table>
                   <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Quantity</TableHead><TableHead>Reason</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                   <TableBody>
                     {waste.map(w => (
                       <TableRow key={w.id}>
                         <TableCell className="font-bold text-red-700">{w.item_name}</TableCell>
                         <TableCell>{w.quantity} {w.unit}</TableCell>
                         <TableCell>{w.reason}</TableCell>
                         <TableCell className="text-xs text-slate-400">{new Date(w.date).toLocaleString()}</TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                </Table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
