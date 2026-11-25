/* ============================================================
   Mari Order — Cloudflare Worker (API + D1)
   ============================================================ */

let dbReady = false;

// ── helpers ────────────────────────────────────────────────────
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

function checkAuth(req, env) {
  if (!env.ADMIN_PASSWORD) return json({ error: 'ADMIN_PASSWORD belum diset di server' }, 503);
  const h = req.headers.get('Authorization');
  if (!h || h !== `Bearer ${env.ADMIN_PASSWORD}`) return json({ error: 'Tidak dibenarkan' }, 401);
  return null;
}

// ── ensureDb (cached with dbReady flag) ───────────────────────
async function ensureDb(db) {
  if (dbReady) return;

  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      emoji TEXT DEFAULT '📁',
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price REAL NOT NULL,
      image_id INTEGER,
      emoji TEXT DEFAULT '🍽️',
      active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      queue_number INTEGER,
      order_type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      total_price REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      menu_item_id INTEGER,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data BLOB,
      content_type TEXT DEFAULT 'image/jpeg',
      created_at TEXT DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`),
  ]);

  const { count } = await db.prepare('SELECT COUNT(*) as count FROM categories').first();
  if (count === 0) await seedData(db);

  dbReady = true;
}

// ── seed 4 kategori + 15 item contoh + tetapan ───────────────
async function seedData(db) {
  await db.batch([
    db.prepare("INSERT INTO categories (name,emoji,sort_order) VALUES (?,?,?)").bind('Nasi','🍚',1),
    db.prepare("INSERT INTO categories (name,emoji,sort_order) VALUES (?,?,?)").bind('Mi & Sup','🍜',2),
    db.prepare("INSERT INTO categories (name,emoji,sort_order) VALUES (?,?,?)").bind('Lauk & Goreng','🍗',3),
    db.prepare("INSERT INTO categories (name,emoji,sort_order) VALUES (?,?,?)").bind('Minuman','🥤',4),
  ]);

  await db.batch([
    // Nasi
    db.prepare("INSERT INTO menu_items (category_id,name,description,price,emoji,sort_order) VALUES (?,?,?,?,?,?)").bind(1,'Nasi Lemak','Nasi lemak dengan sambal, ikan bilis, kacang & telur',6.00,'🍛',1),
    db.prepare("INSERT INTO menu_items (category_id,name,description,price,emoji,sort_order) VALUES (?,?,?,?,?,?)").bind(1,'Nasi Goreng Kampung','Nasi goreng tradisional dengan ikan bilis & sayur',7.00,'🍚',2),
    db.prepare("INSERT INTO menu_items (category_id,name,description,price,emoji,sort_order) VALUES (?,?,?,?,?,?)").bind(1,'Nasi Ayam','Nasi putih dengan ayam goreng berempah',8.00,'🐔',3),
    db.prepare("INSERT INTO menu_items (category_id,name,description,price,emoji,sort_order) VALUES (?,?,?,?,?,?)").bind(1,'Nasi Kerabu','Nasi kerabu Kelantan dengan ulam segar',8.50,'🥗',4),
    // Mi & Sup
    db.prepare("INSERT INTO menu_items (category_id,name,description,price,emoji,sort_order) VALUES (?,?,?,?,?,?)").bind(2,'Mee Goreng Mamak','Mee goreng mamak pedas dengan telur',6.50,'🍝',1),
    db.prepare("INSERT INTO menu_items (category_id,name,description,price,emoji,sort_order) VALUES (?,?,?,?,?,?)").bind(2,'Laksa Penang','Laksa asam ikan tradisional Penang',7.50,'🍜',2),
    db.prepare("INSERT INTO menu_items (category_id,name,description,price,emoji,sort_order) VALUES (?,?,?,?,?,?)").bind(2,'Mee Rebus','Mee rebus dengan kuah pekat & telur',6.50,'🍲',3),
    db.prepare("INSERT INTO menu_items (category_id,name,description,price,emoji,sort_order) VALUES (?,?,?,?,?,?)").bind(2,'Kuey Teow Goreng','Kuey teow goreng dengan udang & kerang',7.00,'🍝',4),
    // Lauk & Goreng
    db.prepare("INSERT INTO menu_items (category_id,name,description,price,emoji,sort_order) VALUES (?,?,?,?,?,?)").bind(3,'Ayam Goreng Berempah','Ayam goreng rempah rangup',5.00,'🍗',1),
    db.prepare("INSERT INTO menu_items (category_id,name,description,price,emoji,sort_order) VALUES (?,?,?,?,?,?)").bind(3,'Rendang Daging','Rendang daging lembu kering',9.00,'🍖',2),
    db.prepare("INSERT INTO menu_items (category_id,name,description,price,emoji,sort_order) VALUES (?,?,?,?,?,?)").bind(3,'Sambal Udang Petai','Udang segar masak sambal dengan petai',10.00,'🦐',3),
    db.prepare("INSERT INTO menu_items (category_id,name,description,price,emoji,sort_order) VALUES (?,?,?,?,?,?)").bind(3,'Roti Canai','Roti canai lembut dengan kuah dhal',2.50,'🫓',4),
    // Minuman
    db.prepare("INSERT INTO menu_items (category_id,name,description,price,emoji,sort_order) VALUES (?,?,?,?,?,?)").bind(4,'Teh Tarik','Teh tarik susu pekat manis',3.00,'🍵',1),
    db.prepare("INSERT INTO menu_items (category_id,name,description,price,emoji,sort_order) VALUES (?,?,?,?,?,?)").bind(4,'Kopi O','Kopi hitam tradisional',2.50,'☕',2),
    db.prepare("INSERT INTO menu_items (category_id,name,description,price,emoji,sort_order) VALUES (?,?,?,?,?,?)").bind(4,'Air Sirap Limau','Sirap limau ais segar',3.50,'🍹',3),
  ]);

  await db.batch([
    db.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)").bind('store_name','Mari Order'),
    db.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)").bind('banner','Selamat datang! Sila buat pesanan anda.'),
    db.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)").bind('is_open','1'),
  ]);
}

// ── route handler ─────────────────────────────────────────────
async function handleApi(req, env, url) {
  const path = url.pathname;
  const method = req.method;
  const db = env.DB;

  /* ---------- AUTH ---------- */
  if (path === '/api/admin/login' && method === 'POST') {
    if (!env.ADMIN_PASSWORD) return json({ error: 'ADMIN_PASSWORD belum diset di server' }, 503);
    const { password } = await req.json();
    if (password !== env.ADMIN_PASSWORD) return json({ error: 'Kata laluan salah' }, 401);
    return json({ token: env.ADMIN_PASSWORD });
  }

  /* ---------- SETTINGS ---------- */
  if (path === '/api/settings' && method === 'GET') {
    const rows = await db.prepare('SELECT key, value FROM settings').all();
    const s = {};
    for (const r of rows.results) s[r.key] = r.value;
    return json(s);
  }
  if (path === '/api/settings' && method === 'PUT') {
    const err = checkAuth(req, env); if (err) return err;
    const body = await req.json();
    const stmts = [];
    for (const [k, v] of Object.entries(body)) {
      stmts.push(db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').bind(k, String(v)));
    }
    if (stmts.length) await db.batch(stmts);
    return json({ ok: true });
  }

  /* ---------- CATEGORIES ---------- */
  if (path === '/api/categories' && method === 'GET') {
    const all = url.searchParams.get('all') === '1';
    const q = all
      ? 'SELECT * FROM categories ORDER BY sort_order'
      : 'SELECT * FROM categories WHERE active=1 ORDER BY sort_order';
    const rows = await db.prepare(q).all();
    return json(rows.results);
  }
  if (path === '/api/categories' && method === 'POST') {
    const err = checkAuth(req, env); if (err) return err;
    const { name, emoji } = await req.json();
    const r = await db.prepare('INSERT INTO categories (name,emoji) VALUES (?,?)').bind(name, emoji || '📁').run();
    return json({ id: r.meta.last_row_id }, 201);
  }

  // /api/categories/:id  &  /api/categories/:id/toggle
  const catToggle = path.match(/^\/api\/categories\/(\d+)\/toggle$/);
  if (catToggle && method === 'PATCH') {
    const err = checkAuth(req, env); if (err) return err;
    const id = +catToggle[1];
    await db.prepare('UPDATE categories SET active = CASE WHEN active=1 THEN 0 ELSE 1 END WHERE id=?').bind(id).run();
    return json({ ok: true });
  }

  const catId = path.match(/^\/api\/categories\/(\d+)$/);
  if (catId && method === 'PUT') {
    const err = checkAuth(req, env); if (err) return err;
    const { name, emoji, sort_order } = await req.json();
    await db.prepare('UPDATE categories SET name=COALESCE(?,name), emoji=COALESCE(?,emoji), sort_order=COALESCE(?,sort_order) WHERE id=?')
      .bind(name??null, emoji??null, sort_order??null, +catId[1]).run();
    return json({ ok: true });
  }
  if (catId && method === 'DELETE') {
    const err = checkAuth(req, env); if (err) return err;
    const id = +catId[1];
    const { count } = await db.prepare('SELECT COUNT(*) as count FROM menu_items WHERE category_id=?').bind(id).first();
    if (count > 0) return json({ error: 'Kategori masih mempunyai item. Padam atau pindahkan item dahulu.' }, 409);
    await db.prepare('DELETE FROM categories WHERE id=?').bind(id).run();
    return json({ ok: true });
  }

  /* ---------- MENU ---------- */
  if (path === '/api/menu' && method === 'GET') {
    const all = url.searchParams.get('all') === '1';
    const q = all
      ? 'SELECT * FROM menu_items ORDER BY sort_order'
      : 'SELECT * FROM menu_items WHERE active=1 ORDER BY sort_order';
    const rows = await db.prepare(q).all();
    return json(rows.results);
  }
  if (path === '/api/menu' && method === 'POST') {
    const err = checkAuth(req, env); if (err) return err;
    const b = await req.json();
    const r = await db.prepare(
      'INSERT INTO menu_items (category_id,name,description,price,emoji,image_id,sort_order) VALUES (?,?,?,?,?,?,?)'
    ).bind(b.category_id, b.name, b.description||'', b.price, b.emoji||'🍽️', b.image_id||null, b.sort_order||0).run();
    return json({ id: r.meta.last_row_id }, 201);
  }

  // /api/menu/:id/copy
  const menuCopy = path.match(/^\/api\/menu\/(\d+)\/copy$/);
  if (menuCopy && method === 'POST') {
    const err = checkAuth(req, env); if (err) return err;
    const orig = await db.prepare('SELECT * FROM menu_items WHERE id=?').bind(+menuCopy[1]).first();
    if (!orig) return json({ error: 'Item tidak ditemui' }, 404);
    const r = await db.prepare(
      'INSERT INTO menu_items (category_id,name,description,price,emoji,image_id,sort_order) VALUES (?,?,?,?,?,?,?)'
    ).bind(orig.category_id, orig.name + ' (Salinan)', orig.description, orig.price, orig.emoji, orig.image_id, orig.sort_order).run();
    return json({ id: r.meta.last_row_id }, 201);
  }

  // /api/menu/:id/toggle
  const menuToggle = path.match(/^\/api\/menu\/(\d+)\/toggle$/);
  if (menuToggle && method === 'PATCH') {
    const err = checkAuth(req, env); if (err) return err;
    await db.prepare('UPDATE menu_items SET active = CASE WHEN active=1 THEN 0 ELSE 1 END WHERE id=?').bind(+menuToggle[1]).run();
    return json({ ok: true });
  }

  // /api/menu/:id/price
  const menuPrice = path.match(/^\/api\/menu\/(\d+)\/price$/);
  if (menuPrice && method === 'PATCH') {
    const err = checkAuth(req, env); if (err) return err;
    const { price } = await req.json();
    await db.prepare('UPDATE menu_items SET price=? WHERE id=?').bind(price, +menuPrice[1]).run();
    return json({ ok: true });
  }

  // /api/menu/:id
  const menuId = path.match(/^\/api\/menu\/(\d+)$/);
  if (menuId && method === 'PUT') {
    const err = checkAuth(req, env); if (err) return err;
    const b = await req.json();
    await db.prepare(
      'UPDATE menu_items SET category_id=COALESCE(?,category_id),name=COALESCE(?,name),description=COALESCE(?,description),price=COALESCE(?,price),emoji=COALESCE(?,emoji),image_id=COALESCE(?,image_id),sort_order=COALESCE(?,sort_order) WHERE id=?'
    ).bind(b.category_id??null, b.name??null, b.description??null, b.price??null, b.emoji??null, b.image_id!==undefined?b.image_id:null, b.sort_order??null, +menuId[1]).run();
    return json({ ok: true });
  }
  if (menuId && method === 'DELETE') {
    const err = checkAuth(req, env); if (err) return err;
    await db.prepare('DELETE FROM menu_items WHERE id=?').bind(+menuId[1]).run();
    return json({ ok: true });
  }

  /* ---------- IMAGES ---------- */
  if (path === '/api/images' && method === 'POST') {
    const err = checkAuth(req, env); if (err) return err;
    const ct = req.headers.get('Content-Type') || 'image/jpeg';
    const buffer = await req.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const r = await db.prepare('INSERT INTO images (data,content_type) VALUES (?,?)').bind(bytes.buffer, ct).run();
    return json({ id: r.meta.last_row_id }, 201);
  }

  const imgId = path.match(/^\/api\/images\/(\d+)$/);
  if (imgId && method === 'GET') {
    const row = await db.prepare('SELECT data,content_type FROM images WHERE id=?').bind(+imgId[1]).first();
    if (!row) return new Response('Not found', { status: 404 });
    const bytes = Uint8Array.from(row.data || []);
    return new Response(bytes.buffer, {
      headers: {
        'Content-Type': row.content_type || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
        ...cors,
      },
    });
  }

  /* ---------- ORDERS ---------- */
  if (path === '/api/orders' && method === 'POST') {
    // Semak kedai dibuka
    const isOpen = await db.prepare("SELECT value FROM settings WHERE key='is_open'").first();
    if (!isOpen || isOpen.value !== '1') return json({ error: 'Kedai sedang tutup' }, 400);

    const body = await req.json();
    const items = body.items; // [{ id, quantity }]
    const orderType = body.order_type; // dine_in | takeaway

    if (!items || !items.length) return json({ error: 'Troli kosong' }, 400);
    if (!orderType) return json({ error: 'Sila pilih jenis pesanan' }, 400);

    // Ambil harga dari DB (kira di server)
    const placeholders = items.map(() => '?').join(',');
    const menuRows = await db.prepare(
      `SELECT id,name,price FROM menu_items WHERE id IN (${placeholders}) AND active=1`
    ).bind(...items.map(i => i.id)).all();

    const menuMap = {};
    for (const m of menuRows.results) menuMap[m.id] = m;

    let totalPrice = 0;
    const orderItems = [];
    for (const ci of items) {
      const mi = menuMap[ci.id];
      if (!mi) return json({ error: `Item id ${ci.id} tidak ditemui atau tidak aktif` }, 400);
      const qty = Math.max(1, Math.floor(ci.quantity));
      totalPrice += mi.price * qty;
      orderItems.push({ id: mi.id, name: mi.name, price: mi.price, quantity: qty });
    }
    totalPrice = Math.round(totalPrice * 100) / 100;

    // Cipta pesanan
    const orderRes = await db.prepare(
      'INSERT INTO orders (order_type, total_price, status, queue_number) VALUES (?,?,?,0)'
    ).bind(orderType, totalPrice, 'pending').run();
    const orderId = orderRes.meta.last_row_id;

    // Kemas kini queue_number = orderId
    const updateQ = db.prepare('UPDATE orders SET queue_number=? WHERE id=?').bind(orderId, orderId);

    // Simpan order_items guna db.batch()
    const itemStmts = orderItems.map(oi =>
      db.prepare('INSERT INTO order_items (order_id,menu_item_id,name,price,quantity) VALUES (?,?,?,?,?)')
        .bind(orderId, oi.id, oi.name, oi.price, oi.quantity)
    );
    await db.batch([updateQ, ...itemStmts]);

    return json({ id: orderId, queue_number: orderId, status: 'pending', total_price: totalPrice }, 201);
  }

  if (path === '/api/orders' && method === 'GET') {
    const err = checkAuth(req, env); if (err) return err;
    const status = url.searchParams.get('status');
    let q = 'SELECT * FROM orders ORDER BY id DESC LIMIT 100';
    let rows;
    if (status) {
      rows = await db.prepare('SELECT * FROM orders WHERE status=? ORDER BY id DESC LIMIT 100').bind(status).all();
    } else {
      rows = await db.prepare(q).all();
    }
    // Attach items
    const orders = [];
    for (const o of rows.results) {
      const oi = await db.prepare('SELECT * FROM order_items WHERE order_id=?').bind(o.id).all();
      orders.push({ ...o, items: oi.results });
    }
    return json(orders);
  }

  const orderId = path.match(/^\/api\/orders\/(\d+)$/);
  if (orderId && method === 'GET') {
    const o = await db.prepare('SELECT * FROM orders WHERE id=?').bind(+orderId[1]).first();
    if (!o) return json({ error: 'Pesanan tidak ditemui' }, 404);
    const oi = await db.prepare('SELECT * FROM order_items WHERE order_id=?').bind(o.id).all();
    return json({ ...o, items: oi.results });
  }
  if (orderId && method === 'PATCH') {
    const err = checkAuth(req, env); if (err) return err;
    const { status } = await req.json();
    await db.prepare('UPDATE orders SET status=? WHERE id=?').bind(status, +orderId[1]).run();
    return json({ ok: true });
  }

  return json({ error: 'Route tidak ditemui' }, 404);
}

// ── main fetch ────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }
    try {
      await ensureDb(env.DB);
      const url = new URL(request.url);
      if (url.pathname.startsWith('/api/')) {
        return handleApi(request, env, url);
      }
      // Bukan /api — biar [assets] uruskan fail statik
      return new Response('Not found', { status: 404, headers: cors });
    } catch (e) {
      console.error(e);
      return json({ error: e.message }, 500);
    }
  },
};
