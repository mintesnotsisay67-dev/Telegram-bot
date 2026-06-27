import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

const db = new Database('butcher.db');

// Database Initialization
db.exec(`
  CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    price REAL NOT NULL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS menu (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    category TEXT NOT NULL,
    image_url TEXT,
    available BOOLEAN DEFAULT 1,
    prep_time TEXT,
    calories INTEGER,
    origin TEXT,
    is_spicy BOOLEAN DEFAULT 0,
    is_popular BOOLEAN DEFAULT 0,
    allergens TEXT,
    protein TEXT,
    fat TEXT
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    table_number TEXT NOT NULL,
    status TEXT NOT NULL, -- 'pending', 'preparing', 'completed', 'cancelled'
    total_amount REAL NOT NULL,
    payment_status TEXT NOT NULL, -- 'unpaid', 'paid'
    payment_method TEXT, -- 'cash', 'mobile_banking', 'chapa'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    menu_item_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );

  CREATE TABLE IF NOT EXISTS waste (
    id TEXT PRIMARY KEY,
    item_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    reason TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tables (
    id TEXT PRIMARY KEY,
    number TEXT NOT NULL UNIQUE,
    qr_code TEXT
  );
`);

app.use(express.json());

// API Routes
app.get('/api/menu', (req, res) => {
  const items = db.prepare('SELECT * FROM menu WHERE available = 1').all();
  res.json(items);
});

app.get('/api/admin/menu', (req, res) => {
  const items = db.prepare('SELECT * FROM menu').all();
  res.json(items);
});

  app.post('/api/admin/menu', (req, res) => {
    const { name, description, price, category, image_url, prep_time, calories, origin, is_spicy, is_popular, allergens, protein, fat } = req.body;
    const id = uuidv4();
    db.prepare(`
      INSERT INTO menu (
        id, name, description, price, category, image_url, 
        prep_time, calories, origin, is_spicy, is_popular, 
        allergens, protein, fat
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, name, description, price, category, image_url, 
      prep_time, calories, origin, is_spicy ? 1 : 0, is_popular ? 1 : 0, 
      allergens, protein, fat
    );
    res.json({ id });
  });

  // Seed Menu Data
  const menuCount = db.prepare('SELECT COUNT(*) as count FROM menu').get() as { count: number };
  if (menuCount.count === 0) {
    const seedMenu = [
      {
        id: uuidv4(),
        name: 'Prime Rib Eye',
        description: '30-day dry-aged beef, perfectly marbled and flame-grilled to perfection.',
        price: 1850.00,
        category: 'Main Course',
        image_url: 'https://images.unsplash.com/photo-1546241072-48010ad28c2c?q=80&w=1000',
        prep_time: '25-30 min',
        calories: 840,
        origin: 'Highlands Angus',
        is_spicy: false,
        is_popular: true,
        allergens: 'None',
        protein: '42g',
        fat: '28g'
      },
      {
        id: uuidv4(),
        name: 'Spicy Wagyu Sliders',
        description: 'Three mini Wagyu burgers with jalapeño aioli and caramelized onions.',
        price: 950.00,
        category: 'Appetizers',
        image_url: 'https://images.unsplash.com/photo-1550317144-b38c2089c961?q=80&w=1000',
        prep_time: '15-20 min',
        calories: 620,
        origin: 'Domestic Wagyu',
        is_spicy: true,
        is_popular: true,
        allergens: 'Gluten, Dairy',
        protein: '28g',
        fat: '32g'
      },
      {
        id: uuidv4(),
        name: 'Truffle Mac & Cheese',
        description: 'Five-cheese blend with fresh black truffle shavings and herb crust.',
        price: 650.00,
        category: 'Sides',
        image_url: 'https://images.unsplash.com/photo-1543339494-b4cd717eb40c?q=80&w=1000',
        prep_time: '10-15 min',
        calories: 540,
        origin: 'Local Dairy',
        is_spicy: false,
        is_popular: false,
        allergens: 'Gluten, Dairy',
        protein: '12g',
        fat: '24g'
      }
    ];

    const insert = db.prepare(`
      INSERT INTO menu (
        id, name, description, price, category, image_url, 
        prep_time, calories, origin, is_spicy, is_popular, 
        allergens, protein, fat
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of seedMenu) {
      insert.run(
        item.id, item.name, item.description, item.price, item.category, item.image_url,
        item.prep_time, item.calories, item.origin, item.is_spicy ? 1 : 0, item.is_popular ? 1 : 0,
        item.allergens, item.protein, item.fat
      );
    }
  }

app.get('/api/inventory', (req, res) => {
  const items = db.prepare('SELECT * FROM inventory').all();
  res.json(items);
});

app.post('/api/inventory', (req, res) => {
  const { name, category, quantity, unit, price } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO inventory (id, name, category, quantity, unit, price) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, name, category, quantity, unit, price);
  res.json({ id });
});

app.patch('/api/inventory/:id', (req, res) => {
  const { quantity } = req.body;
  db.prepare('UPDATE inventory SET quantity = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?')
    .run(quantity, req.params.id);
  res.json({ success: true });
});

app.get('/api/orders', (req, res) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  res.json(orders);
});

app.post('/api/orders', (req, res) => {
  const { table_number, items, total_amount } = req.body;
  const orderId = uuidv4();

  const insertOrder = db.transaction((orderData, orderItems) => {
    db.prepare('INSERT INTO orders (id, table_number, status, total_amount, payment_status) VALUES (?, ?, ?, ?, ?)')
      .run(orderId, table_number, 'pending', total_amount, 'unpaid');

    for (const item of orderItems) {
      db.prepare('INSERT INTO order_items (id, order_id, menu_item_id, quantity, price) VALUES (?, ?, ?, ?, ?)')
        .run(uuidv4(), orderId, item.menu_item_id, item.quantity, item.price);
    }
    return orderId;
  });

  insertOrder(req.body, items);
  
  // Real-time notification to kitchen
  io.emit('new_order', { id: orderId, table_number, items, total_amount, status: 'pending' });
  
  res.json({ id: orderId });
});

app.get('/api/orders/table/:tableNumber', (req, res) => {
  const orders = db.prepare(`
    SELECT * FROM orders 
    WHERE table_number = ? AND status NOT IN ('completed', 'cancelled')
    ORDER BY created_at DESC
  `).all(req.params.tableNumber);
  res.json(orders);
});

app.get('/api/orders/:id/items', (req, res) => {
  const items = db.prepare(`
    SELECT oi.*, m.name as item_name 
    FROM order_items oi 
    JOIN menu m ON oi.menu_item_id = m.id 
    WHERE oi.order_id = ?
  `).all(req.params.id);
  res.json(items);
});

app.patch('/api/orders/:id/status', (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(status, req.params.id);
  
  if (status === 'completed') {
    io.emit('order_finished', { id: req.params.id });
  }
  
  io.emit('order_status_updated', { id: req.params.id, status });
  res.json({ success: true });
});

app.patch('/api/orders/:id/payment', (req, res) => {
  const { payment_method, payment_status } = req.body;
  db.prepare('UPDATE orders SET payment_method = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(payment_method, payment_status, req.params.id);
  res.json({ success: true });
});

app.get('/api/tables', (req, res) => {
  const tables = db.prepare(`
    SELECT t.*, 
    CASE WHEN EXISTS (
      SELECT 1 FROM orders o 
      WHERE o.table_number = t.number AND o.status IN ('pending', 'preparing')
    ) THEN 0 ELSE 1 END as is_available
    FROM tables t
  `).all();
  res.json(tables);
});

app.post('/api/tables', (req, res) => {
  const { number, qr_code } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO tables (id, number, qr_code) VALUES (?, ?, ?)')
    .run(id, number, qr_code);
  res.json({ id });
});

app.get('/api/waste', (req, res) => {
  const waste = db.prepare('SELECT * FROM waste').all();
  res.json(waste);
});

app.post('/api/waste', (req, res) => {
  const { item_name, quantity, unit, reason } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO waste (id, item_name, quantity, unit, reason) VALUES (?, ?, ?, ?, ?)')
    .run(id, item_name, quantity, unit, reason);
  res.json({ id });
});

// Analytics
app.get('/api/analytics/finance', (req, res) => {
  const revenue = db.prepare(`
    SELECT date(created_at) as date, SUM(total_amount) as total 
    FROM orders 
    WHERE payment_status = 'paid' 
    GROUP BY date(created_at)
    LIMIT 30
  `).all();
  res.json(revenue);
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(3000, '0.0.0.0', () => {
    console.log('Server running on http://localhost:3000');
  });
}

startServer();
