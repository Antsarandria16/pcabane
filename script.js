/* =========================================================
   DONNÉES
========================================================= */

const STORAGE_INVENTORY = "grocery_inventory";
const STORAGE_SALES = "grocery_sales";

let inventory =
    JSON.parse(localStorage.getItem(STORAGE_INVENTORY)) ||
    [
        { name: "Lait", cat: "Produits Laitiers", price: 4000, stock: 45 },
        { name: "Pain", cat: "Boulangerie", price: 1000, stock: 12 },
        { name: "Café", cat: "Épicerie Sèche", price: 800, stock: 20 },
        { name: "Œufs x6", cat: "Frais", price: 750, stock: 3 }
    ];

let salesHistory =
    JSON.parse(localStorage.getItem(STORAGE_SALES)) ||
    [];

let cart = [];

/* =========================================================
   INITIALISATION
========================================================= */

window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("current-date").textContent =
        new Date().toLocaleDateString(
            "fr-FR",
            { weekday: "long", year: "numeric", month: "long", day: "numeric" }
        );

    renderStockTable();
    updateDatalists();
    updateCartUI();
    renderSalesHistory();
    updateDashboard();
    updateAnalytics();
});

/* =========================================================
   SAUVEGARDE
========================================================= */

function saveToStorage() {
    localStorage.setItem(STORAGE_INVENTORY, JSON.stringify(inventory));
    localStorage.setItem(STORAGE_SALES, JSON.stringify(salesHistory));
}

/* =========================================================
   MENU & NAVIGATION
========================================================= */

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.toggle("sidebar-hidden");
    sidebar.classList.toggle("sidebar-visible");
}

function switchTab(tabId, element) {
    document.querySelectorAll(".content").forEach(section => {
        section.classList.remove("active");
    });

    document.querySelectorAll(".menu li").forEach(item => {
        item.classList.remove("active");
    });

    document.getElementById(tabId).classList.add("active");
    element.classList.add("active");

    const titles = {
        dashboard: "Tableau de bord",
        caisse: "Caisse Enregistreuse",
        stock: "Gestion des Stocks",
        analytique: "Analyses & Rapports",
        historique: "Historique des Ventes"
    };

    document.getElementById("header-title").textContent = titles[tabId];

    const sidebar = document.getElementById("sidebar");
    sidebar.classList.remove("sidebar-visible");
    sidebar.classList.add("sidebar-hidden");

    if (tabId === 'analytique') {
        updateAnalytics();
    }
}

/* =========================================================
   UTILITAIRES & FORMATAGE
========================================================= */

function formatMoney(value) {
    return Number(value || 0).toLocaleString(
        "fr-FR",
        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    ) + " Ar";
}

// Système de notification élégant intégré au header
function showNotification(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.style.cssText = `
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#0ea5e9'};
        color: white;
        padding: 8px 14px;
        border-radius: 6px;
        font-size: 0.85rem;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: fadeIn 0.3s ease;
        margin-left: 10px;
        display: inline-block;
    `;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

/* =========================================================
   PRODUIT / PRIX
========================================================= */

function autofillPrice() {
    const input = document.getElementById("product-name-input");
    const price = document.getElementById("product-price-input");
    const name = input.value.trim().toLowerCase();

    const product = inventory.find(
        item => item.name.toLowerCase() === name
    );

    if (product) {
        price.value = product.price;
    } else {
        price.value = "";
    }
}

/* =========================================================
   DATALIST
========================================================= */

function updateDatalists() {
    const datalist = document.getElementById("products-datalist");
    const select = document.getElementById("restock-select");

    if (!datalist || !select) return;

    datalist.innerHTML = "";
    select.innerHTML = "";

    inventory.forEach((item, index) => {
        datalist.innerHTML += `<option value="${escapeHtml(item.name)}">`;
        select.innerHTML += `
            <option value="${index}">
                ${escapeHtml(item.name)} (Stock: ${item.stock})
            </option>
        `;
    });
}

/* =========================================================
   PANIER
========================================================= */

function addToCart() {
    const name = document.getElementById("product-name-input").value.trim();
    const qty = parseInt(document.getElementById("quantity").value);

    if (!name) {
        showNotification("Veuillez sélectionner un produit.", "error");
        return;
    }

    if (Number.isNaN(qty) || qty <= 0) {
        showNotification("La quantité doit être supérieure à 0.", "error");
        return;
    }

    const product = inventory.find(
        item => item.name.toLowerCase() === name.toLowerCase()
    );

    if (!product) {
        showNotification("Produit introuvable.", "error");
        return;
    }

    const existing = cart.find(
        item => item.name.toLowerCase() === product.name.toLowerCase()
    );

    const quantityAlreadyInCart = existing ? existing.qty : 0;

    if (quantityAlreadyInCart + qty > product.stock) {
        showNotification(`Stock insuffisant. Disponible : ${product.stock}`, "error");
        return;
    }

    if (existing) {
        existing.qty += qty;
    } else {
        cart.push({
            name: product.name,
            qty: qty,
            unitPrice: product.price
        });
    }

    clearProductForm();
    updateCartUI();
    showNotification("Produit ajouté au panier", "success");
}

function clearProductForm() {
    document.getElementById("product-name-input").value = "";
    document.getElementById("product-price-input").value = "";
    document.getElementById("quantity").value = 1;
}

/* =========================================================
   AFFICHAGE PANIER
========================================================= */

function updateCartUI() {
    const list = document.getElementById("cart-list");
    if (!list) return;

    list.innerHTML = "";
    let total = 0;

    cart.forEach((item, index) => {
        const itemTotal = item.qty * item.unitPrice;
        total += itemTotal;

        list.innerHTML += `
            <tr>
                <td>${escapeHtml(item.name)}</td>
                <td>
                    <button class="btn-sm" onclick="changeCartQuantity(${index}, -1)">−</button>
                    <span style="margin: 0 6px; font-weight:600;">${item.qty}</span>
                    <button class="btn-sm" onclick="changeCartQuantity(${index}, 1)">+</button>
                </td>
                <td>${formatMoney(itemTotal)}</td>
                <td>
                    <button class="btn-sm danger" onclick="removeFromCart(${index})">🗑️</button>
                </td>
            </tr>
        `;
    });

    document.getElementById("cart-total").textContent = formatMoney(total).replace(" Ar", "");
    calculateChange();
}

function getCartTotal() {
    return cart.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);
}

/* =========================================================
   QUANTITÉ PANIER
========================================================= */

function changeCartQuantity(index, amount) {
    const item = cart[index];
    const product = inventory.find(p => p.name.toLowerCase() === item.name.toLowerCase());

    if (!product) return;

    const newQty = item.qty + amount;

    if (newQty <= 0) {
        removeFromCart(index);
        return;
    }

    if (newQty > product.stock) {
        showNotification(`Stock disponible atteint : ${product.stock}`, "error");
        return;
    }

    item.qty = newQty;
    updateCartUI();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartUI();
}

/* =========================================================
   MONNAIE
========================================================= */

function calculateChange() {
    const total = getCartTotal();
    const received = parseFloat(document.getElementById("amount-received").value) || 0;
    const change = received - total;

    document.getElementById("amount-change").textContent = formatMoney(change >= 0 ? change : 0).replace(" Ar", "");
}

/* =========================================================
   ENCAISSEMENT
========================================================= */

function checkout() {
    if (cart.length === 0) {
        showNotification("Le panier est vide.", "error");
        return;
    }

    const total = getCartTotal();
    const received = parseFloat(document.getElementById("amount-received").value) || 0;

    if (received < total) {
        showNotification("Montant reçu insuffisant.", "error");
        return;
    }

    for (const cartItem of cart) {
        const product = inventory.find(p => p.name.toLowerCase() === cartItem.name.toLowerCase());
        if (!product || product.stock < cartItem.qty) {
            showNotification(`Stock insuffisant pour ${cartItem.name}.`, "error");
            return;
        }
    }

    cart.forEach(cartItem => {
        const product = inventory.find(p => p.name.toLowerCase() === cartItem.name.toLowerCase());
        product.stock -= cartItem.qty;
    });

    const now = new Date();
    const sale = {
        id: Date.now(),
        date: now.toISOString().split("T")[0],
        time: now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        items: cart.map(item => ({ name: item.name, qty: item.qty, unitPrice: item.unitPrice })),
        total: total,
        received: received,
        change: received - total
    };

    salesHistory.unshift(sale);
    saveToStorage();

    showNotification("Vente validée avec succès !", "success");

    cart = [];
    document.getElementById("amount-received").value = "";

    updateCartUI();
    renderStockTable();
    updateDatalists();
    renderSalesHistory();
    updateDashboard();
    updateAnalytics();
}

/* =========================================================
   ANNULATION PANIER
========================================================= */

function cancelCart() {
    if (cart.length === 0) return;

    if (confirm("Voulez-vous vraiment annuler le panier en cours ?")) {
        cart = [];
        document.getElementById("amount-received").value = "";
        updateCartUI();
        showNotification("Panier annulé", "info");
    }
}

/* =========================================================
   STOCK
========================================================= */

function renderStockTable() {
    const list = document.getElementById("stock-list");
    if (!list) return;

    const search = (document.getElementById("stock-search")?.value || "").trim().toLowerCase();

    list.innerHTML = "";

    inventory
        .filter(item => item.name.toLowerCase().includes(search))
        .forEach((item, index) => {
            const lowStock = item.stock < 5;

            list.innerHTML += `
                <tr class="${lowStock ? "low-stock" : ""}">
                    <td><strong>${escapeHtml(item.name)}</strong></td>
                    <td>${escapeHtml(item.cat)}</td>
                    <td>${formatMoney(item.price)}</td>
                    <td>
                        ${item.stock} ${lowStock ? "⚠️" : ""}
                    </td>
                    <td>
                        <button class="btn-sm" onclick="editProduct(${index})" title="Modifier">✏️</button>
                        <button class="btn-sm danger" onclick="deleteProduct(${index})" title="Supprimer">🗑️</button>
                    </td>
                </tr>
            `;
        });

    updateLowStock();
}

/* =========================================================
   AJOUT / MODIFICATION PRODUIT
========================================================= */

function saveProduct() {
    const name = document.getElementById("new-name").value.trim();
    const cat = document.getElementById("new-cat").value.trim();
    const price = parseFloat(document.getElementById("new-price").value);
    const stock = parseInt(document.getElementById("new-stock").value);
    const editIndex = parseInt(document.getElementById("edit-index").value);

    if (!name || !cat) {
        showNotification("Le nom et la catégorie sont obligatoires.", "error");
        return;
    }

    if (Number.isNaN(price) || price < 0) {
        showNotification("Prix invalide.", "error");
        return;
    }

    if (Number.isNaN(stock) || stock < 0) {
        showNotification("Stock invalide.", "error");
        return;
    }

    const duplicate = inventory.findIndex(
        (item, index) => index !== editIndex && item.name.toLowerCase() === name.toLowerCase()
    );

    if (duplicate !== -1) {
        showNotification("Ce produit existe déjà.", "error");
        return;
    }

    const product = { name, cat, price, stock };

    if (editIndex === -1) {
        inventory.push(product);
        showNotification("Produit ajouté avec succès", "success");
    } else {
        inventory[editIndex] = product;
        showNotification("Produit mis à jour", "success");
    }

    saveToStorage();
    resetStockForm();
    renderStockTable();
    updateDatalists();
    updateDashboard();
    updateAnalytics();
}

function editProduct(index) {
    const item = inventory[index];

    document.getElementById("new-name").value = item.name;
    document.getElementById("new-cat").value = item.cat;
    document.getElementById("new-price").value = item.price;
    document.getElementById("new-stock").value = item.stock;
    document.getElementById("edit-index").value = index;

    document.getElementById("stock-form-title").innerHTML = "✏️ Modifier le produit";
    document.getElementById("save-btn").textContent = "Mettre à jour";
    document.getElementById("cancel-btn").style.display = "block";
}

function resetStockForm() {
    document.getElementById("new-name").value = "";
    document.getElementById("new-cat").value = "";
    document.getElementById("new-price").value = "";
    document.getElementById("new-stock").value = "";
    document.getElementById("edit-index").value = -1;

    document.getElementById("stock-form-title").innerHTML = "➕ Ajouter un produit";
    document.getElementById("save-btn").textContent = "Enregistrer";
    document.getElementById("cancel-btn").style.display = "none";
}

/* =========================================================
   SUPPRESSION PRODUIT
========================================================= */

function deleteProduct(index) {
    const product = inventory[index];
    const usedInCart = cart.some(item => item.name.toLowerCase() === product.name.toLowerCase());

    if (usedInCart) {
        showNotification("Impossible : le produit est dans le panier.", "error");
        return;
    }

    if (!confirm(`Supprimer définitivement "${product.name}" ?`)) return;

    inventory.splice(index, 1);
    saveToStorage();
    renderStockTable();
    updateDatalists();
    updateDashboard();
    updateAnalytics();
    showNotification("Produit supprimé", "info");
}

/* =========================================================
   APPROVISIONNEMENT
========================================================= */

function restockProduct() {
    const index = parseInt(document.getElementById("restock-select").value);
    const quantity = parseInt(document.getElementById("restock-qty").value);

    if (Number.isNaN(index) || Number.isNaN(quantity) || quantity <= 0) {
        showNotification("Veuillez saisir une quantité valide.", "error");
        return;
    }

    inventory[index].stock += quantity;
    document.getElementById("restock-qty").value = "";

    saveToStorage();
    renderStockTable();
    updateDatalists();
    updateDashboard();
    updateAnalytics();
    showNotification("Approvisionnement effectué avec succès", "success");
}

/* =========================================================
   STOCK FAIBLE
========================================================= */

function updateLowStock() {
    const container = document.getElementById("low-stock-list");
    if (!container) return;

    const products = inventory.filter(item => item.stock < 5);

    if (products.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">Aucun produit en stock faible.</p>`;
        return;
    }

    container.innerHTML = products.map(item => `
        <div class="low-stock-item">
            ⚠️ <strong>${escapeHtml(item.name)}</strong> — ${item.stock} restant(s)
        </div>
    `).join("");
}

/* =========================================================
   IMPORT CSV
========================================================= */

function handleBulkUpload() {
    const input = document.getElementById("csv-file-input");
    const file = input.files[0];

    if (!file) {
        showNotification("Veuillez sélectionner un fichier CSV.", "error");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        const text = event.target.result;
        const lines = text.replace(/\r/g, "").split("\n");
        let imported = 0;
        let rejected = 0;

        lines.forEach((line, index) => {
            if (!line.trim()) return;
            if (index === 0 && line.toLowerCase().includes("nom")) return;

            const columns = parseCSVLine(line);
            if (columns.length < 4) {
                rejected++;
                return;
            }

            const name = columns[0].trim();
            const cat = columns[1].trim();
            const price = parseFloat(columns[2].replace(",", "."));
            const stock = parseInt(columns[3]);

            if (!name || !cat || Number.isNaN(price) || Number.isNaN(stock) || price < 0 || stock < 0) {
                rejected++;
                return;
            }

            const existing = inventory.find(item => item.name.toLowerCase() === name.toLowerCase());

            if (existing) {
                existing.price = price;
                existing.cat = cat;
                existing.stock += stock;
            } else {
                inventory.push({ name, cat, price, stock });
            }
            imported++;
        });

        saveToStorage();
        renderStockTable();
        updateDatalists();
        updateDashboard();
        updateAnalytics();

        showNotification(`Import terminé : ${imported} traités, ${rejected} rejetés.`, "success");
        input.value = "";
    };

    reader.readAsText(file);
}

function parseCSVLine(line) {
    const result = [];
    let current = "";
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            insideQuotes = !insideQuotes;
            continue;
        }
        if (char === "," && !insideQuotes) {
            result.push(current);
            current = "";
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

/* =========================================================
   HISTORIQUE & ANALYTIQUE
========================================================= */

function renderSalesHistory() {
    const list = document.getElementById("sales-history-list");
    if (!list) return;

    list.innerHTML = "";

    if (salesHistory.length === 0) {
        list.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Aucune vente enregistrée.</td></tr>`;
        updateDailyCash();
        return;
    }

    salesHistory.forEach(sale => {
        const articleDetails = sale.items
            .map(item => `${item.qty}x ${escapeHtml(item.name)}`)
            .join(", ");

        list.innerHTML += `
            <tr>
                <td>${formatDate(sale.date)}</td>
                <td><span style="font-weight: 500; color: var(--text-muted);">${sale.time}</span></td>
                <td>${articleDetails}</td>
                <td><strong>${formatMoney(sale.total)}</strong></td>
                <td>${formatMoney(sale.received)}</td>
                <td>${formatMoney(sale.change)}</td>
            </tr>
        `;
    });

    updateDailyCash();
}

function getTodaySales() {
    const today = new Date().toISOString().split("T")[0];
    return salesHistory.filter(sale => sale.date === today);
}

function updateDailyCash() {
    const todaySales = getTodaySales();
    let revenue = 0, received = 0, change = 0, itemCount = 0;

    todaySales.forEach(sale => {
        revenue += Number(sale.total) || 0;
        received += Number(sale.received) || 0;
        change += Number(sale.change) || 0;
        sale.items.forEach(item => { itemCount += Number(item.qty) || 0; });
    });

    const average = todaySales.length > 0 ? revenue / todaySales.length : 0;

    const elements = {
        "day-revenue": formatMoney(revenue),
        "day-received": formatMoney(received),
        "day-change": formatMoney(change),
        "day-sales": todaySales.length,
        "dashboard-revenue": formatMoney(revenue),
        "dashboard-sales": todaySales.length,
        "dashboard-items": itemCount,
        "dashboard-average": formatMoney(average),
        "total-revenue": formatMoney(revenue).replace(" Ar", "")
    };

    for (const [id, val] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }
}

function updateAnalytics() {
    let totalStockValue = 0;
    inventory.forEach(item => {
        totalStockValue += (Number(item.price) || 0) * (Number(item.stock) || 0);
    });

    const lowStockCount = inventory.filter(item => item.stock < 5).length;

    const elVal = document.getElementById("analytics-stock-value");
    const elRefs = document.getElementById("analytics-total-refs");
    const elLow = document.getElementById("analytics-low-stock-count");

    if (elVal) elVal.textContent = formatMoney(totalStockValue);
    if (elRefs) elRefs.textContent = inventory.length;
    if (elLow) elLow.textContent = lowStockCount;
}

function updateDashboard() {
    updateDailyCash();
    updateLowStock();
}

function formatDate(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("fr-FR");
}

/* =========================================================
   SÉCURITÉ HTML
========================================================= */

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


window.cancelCart = function() {
    cart = [];
    document.getElementById('amount-received').value = '';
    renderCart();
};