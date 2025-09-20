const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ordersFile = path.join(__dirname, 'orders.json');

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.set('layout', 'layout'); 

//products
const productsFile = path.join(__dirname, 'data', 'products.json');
let products = [];
if (fs.existsSync(productsFile)) {
    products = JSON.parse(fs.readFileSync(productsFile));
}

// Make sure file exists
if (!fs.existsSync(ordersFile)) {
    fs.writeFileSync(ordersFile, '[]', 'utf-8');
}

// Routes
app.get('/', (req, res) => {
    res.redirect('/marketplace');
});

// Artisan Dashboard
app.get('/artisan', (req, res) => {
    res.render('artisanDashboard', { products });
});

app.post('/artisan/add-product', (req, res) => {
    const { name, price, description } = req.body;
    const newProduct = {
        id: uuidv4(),
        name,
        price,
        description,
        image: '/images/placeholder.png'
    };
    products.push(newProduct);
    fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));
    res.redirect('/artisan');
});

// Buyer Marketplace
app.get('/marketplace', (req, res) => {
    res.render('marketplace', { products });
});

// Order History (mocked)
let orders = [];
app.post('/marketplace/order/:id', (req, res) => {
    const product = products.find(p => p.id === req.params.id);
    if (product) {
        orders.push({ ...product, orderId: uuidv4(), status: 'success' });
    }
    res.redirect('/order-history');
});

app.get('/order-history', (req, res) => {
    res.render('orderHistory', { orders });
});

// POST route to cancel order
app.post('/order-history/cancel/:orderId', (req, res) => {
    const orderId = req.params.orderId;

    // Read orders.json
    let orders = JSON.parse(fs.readFileSync(ordersFile));

    // Find order and mark as cancelled
    orders = orders.map(o => {
        if(o.orderId === orderId) {
            o.status = 'cancelled';
        }
        return o;
    });

    // Save back to file
    fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));

    // Redirect back to order history
    res.redirect('/order-history');
});

app.get('/iot-showcase', (req, res) => {
    res.render('iotShowcase', { latestOrder: orders[orders.length - 1] || null });
});



app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
