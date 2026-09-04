/* =========================================================
   INITIALISATION & CLIENT SUPABASE
========================================================= */

// Utilisation du client Supabase initialisé dans le HTML
const supabase = window.supabaseClient;

let inventory = [];
let salesHistory = [];
let cart = [];

window.addEventListener("DOMContentLoaded", async () => {
    const dateEl = document.getElementById("current-date");
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString(
            "fr-FR",
            { weekday: "long", year: "numeric", month: "long", day: "numeric" }
        );
    }

    // Chargement initial des données depuis Supabase
    await loadInventoryFromSupabase();
    await loadSalesFromSupabase();

    updateCartUI();
});

/* =========================================================
   CHARGEMENT & SYNCHRONISATION SUPABASE
========================================================= */

// Charger la liste des produits depuis Supabase
async function loadInventoryFromSupabase() {
    if (!supabase) {
        console.error("Client Supabase introuvable sur window.supabaseClient");
        return;
    }

    const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name", { ascending: true });

    if (error) {
        console.error("Erreur de chargement du stock :", error);
        showNotification("Erreur lors de la récupération des produits.", "error");
        return;
    }

    inventory = (data || []).map(item => ({
        id: item.id,
        name: item.name,
        cat: item.category || item.cat || "Épicerie",
        price: item.price,
        stock: item.stock
    }));

    renderStockTable();
    updateDatalists();
    updateAnalytics();
}

// Charger l'historique des ventes depuis Supabase
async function loadSalesFromSupabase() {
    if (!supabase) return;

    const { data, error } = await supabase
        .from("sales")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erreur de chargement des ventes :", error);
        showNotification("Erreur lors de la récupération de l'historique.", "error");
        return;
    }

    salesHistory = (data || []).map(sale => {
        const dateObj = new Date(sale.created_at || sale.date);
        return {
            id: sale.id,
            date: dateObj.toISOString().split("T")[0],
            time: dateObj.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
            items: typeof sale.items === "string" ? JSON.parse(sale.items) : (sale.items || []),
            total: sale.total,
            received: sale.received || sale.total,
            change: sale.change_amount || sale.change || 0
        };
    });

    renderSalesHistory();
    updateDashboard();
}

/* =========================================================
   MENU & NAVIGATION
========================================================= */

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
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

    const target = document.getElementById(tabId);
    if (target) target.classList.add("active");
    if (element) element.classList.add("active");

    const titles = {
        dashboard: "Tableau de bord",
        caisse: "Caisse Enregistreuse",
        stock: "Gestion des Stocks",
        analytique: "Analyses & Rapports",
        historique: "Historique des Ventes"
    };

    const headerTitle = document.getElementById("header-title");
    if (headerTitle && titles[tabId]) {
        headerTitle.textContent = titles[tabId];
    }

    const sidebar = document.getElementById("sidebar");
    if (sidebar) {
        sidebar.classList.remove("sidebar-visible");
        sidebar.classList.add("sidebar-hidden");
    }

    if (tabId === 'analytique') {
        updateAnalytics();
    }
}

/* =========================================================
   UTILITAIRES & NOTIFICATIONS
========================================================= */

function formatMoney(value) {
    return Number(value || 0).toLocaleString(
        "fr-FR",
        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    ) + " Ar";
}

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

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/* =========================================================
   PRODUIT / CAISSE
========================================================= */

function autofillPrice() {
    const input = document.getElementById("product-name-input");
    const price = document.getElementById("product-price-input");
    if (!input || !price) return;

    const name = input.value.trim().toLowerCase();

    const product = inventory.find(
        item => item.name.toLowerCase() === name
    );

    price.value = product ? product.price : "";
}

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

function addToCart() {
    const nameInput = document.getElementById("product-name-input");
    const qtyInput = document.getElementById("quantity");

    const name = nameInput ? nameInput.value.trim() : "";
    const qty = parseInt(qtyInput ? qtyInput.value : 1);

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
            id: product.id,
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
    const nameInput = document.getElementById("product-name-input");
    const priceInput = document.getElementById("product-price-input");
    const qtyInput = document.getElementById("quantity");

    if (nameInput) nameInput.value = "";
    if (priceInput) priceInput.value = "";
    if (qtyInput) qtyInput.value = 1;
}

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

    const totalEl = document.getElementById("cart-total");
    if (totalEl) totalEl.textContent = formatMoney(total).replace(" Ar", "");

    calculateChange();
}

function getCartTotal() {
    return cart.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);
}

function changeCartQuantity(index, amount) {
    const item = cart[index];
    if (!item) return;

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

function calculateChange() {
    const total = getCartTotal();
    const receivedEl = document.getElementById("amount-received");
    const changeEl = document.getElementById("amount-change");

    const received = parseFloat(receivedEl ? receivedEl.value : 0) || 0;
    const change = received - total;

    if (changeEl) {
        changeEl.textContent = formatMoney(change >= 0 ? change : 0).replace(" Ar", "");
    }
}

function cancelCart() {
    if (cart.length === 0) return;

    if (confirm("Voulez-vous vraiment annuler le panier en cours ?")) {
        cart = [];
        const receivedEl = document.getElementById("amount-received");
        if (receivedEl) receivedEl.value = "";
        
        updateCartUI();
        showNotification("Panier annulé", "info");
    }
}

/* =========================================================
   ENCAISSEMENT AVEC SUPABASE
========================================================= */

async function checkout() {
    if (cart.length === 0) {
        showNotification("Le panier est vide.", "error");
        return;
    }

    const total = getCartTotal();
    const receivedEl = document.getElementById("amount-received");
    const received = parseFloat(receivedEl ? receivedEl.value : 0) || 0;

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

    for (const cartItem of cart) {
        const product = inventory.find(p => p.name.toLowerCase() === cartItem.name.toLowerCase());
        const newStock = product.stock - cartItem.qty;

        if (product.id) {
            const { error: stockError } = await supabase
                .from("products")
                .update({ stock: newStock })
                .eq("id", product.id);

            if (stockError) {
                console.error("Erreur de mise à jour du stock :", stockError);
            }
        }
    }

    const salePayload = {
        total: total,
        received: received,
        change_amount: received - total,
        items: JSON.stringify(cart.map(item => ({ name: item.name, qty: item.qty, unitPrice: item.unitPrice }))),
        created_at: new Date().toISOString()
    };

    const { error: saleError } = await supabase
        .from("sales")
        .insert([salePayload]);

    if (saleError) {
        console.error("Erreur enregistrement vente :", saleError);
        showNotification("Erreur lors de la sauvegarde de la vente sur Supabase.", "error");
        return;
    }

    showNotification("Vente validée avec succès !", "success");

    cart = [];
    if (receivedEl) receivedEl.value = "";

    await loadInventoryFromSupabase();
    await loadSalesFromSupabase();
}

/* =========================================================
   GESTION DES STOCKS AVEC SUPABASE
========================================================= */

function renderStockTable() {
    const list = document.getElementById("stock-list");
    if (!list) return;

    const searchInput = document.getElementById("stock-search");
    const search = (searchInput ? searchInput.value : "").trim().toLowerCase();

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

async function saveProduct() {
    const nameInput = document.getElementById("new-name");
    const catInput = document.getElementById("new-cat");
    const priceInput = document.getElementById("new-price");
    const stockInput = document.getElementById("new-stock");
    const editIndexInput = document.getElementById("edit-index");

    if (!nameInput || !catInput || !priceInput || !stockInput) return;

    const name = nameInput.value.trim();
    const cat = catInput.value.trim();
    const price = parseFloat(priceInput.value);
    const stock = parseInt(stockInput.value);
    const editIndex = parseInt(editIndexInput ? editIndexInput.value : -1);

    if (!name || !cat) {
        showNotification("Le nom et la catégorie sont obligatoires.", "error");
        return;
    }

    if (Number.isNaN(price) || price < 0 || Number.isNaN(stock) || stock < 0) {
        showNotification("Prix ou stock invalide.", "error");
        return;
    }

    if (editIndex === -1) {
        const { error } = await supabase
            .from("products")
            .insert([{ name, category: cat, price, stock }]);

        if (error) {
            console.error("Erreur d'ajout Supabase :", error);
            showNotification("Erreur lors de l'ajout du produit.", "error");
            return;
        }
        showNotification("Produit ajouté avec succès", "success");
    } else {
        const existingProduct = inventory[editIndex];
        const { error } = await supabase
            .from("products")
            .update({ name, category: cat, price, stock })
            .eq("id", existingProduct.id);

        if (error) {
            console.error("Erreur de modification Supabase :", error);
            showNotification("Erreur lors de la mise à jour.", "error");
            return;
        }
        showNotification("Produit mis à jour", "success");
    }

    resetStockForm();
    await loadInventoryFromSupabase();
}

function editProduct(index) {
    const item = inventory[index];
    if (!item) return;

    document.getElementById("new-name").value = item.name;
    document.getElementById("new-cat").value = item.cat;
    document.getElementById("new-price").value = item.price;
    document.getElementById("new-stock").value = item.stock;
    document.getElementById("edit-index").value = index;

    const title = document.getElementById("stock-form-title");
    const saveBtn = document.getElementById("save-btn");
    const cancelBtn = document.getElementById("cancel-btn");

    if (title) title.innerHTML = "✏️ Modifier le produit";
    if (saveBtn) saveBtn.textContent = "Mettre à jour";
    if (cancelBtn) cancelBtn.style.display = "inline-block";
}

function resetStockForm() {
    const name = document.getElementById("new-name");
    const cat = document.getElementById("new-cat");
    const price = document.getElementById("new-price");
    const stock = document.getElementById("new-stock");
    const editIdx = document.getElementById("edit-index");

    if (name) name.value = "";
    if (cat) cat.value = "";
    if (price) price.value = "";
    if (stock) stock.value = "";
    if (editIdx) editIdx.value = -1;

    const title = document.getElementById("stock-form-title");
    const saveBtn = document.getElementById("save-btn");
    const cancelBtn = document.getElementById("cancel-btn");

    if (title) title.innerHTML = "➕ Ajouter un produit";
    if (saveBtn) saveBtn.textContent = "Enregistrer";
    if (cancelBtn) cancelBtn.style.display = "none";
}

async function deleteProduct(index) {
    const product = inventory[index];
    if (!product) return;

    if (!confirm(`Supprimer définitivement "${product.name}" ?`)) return;

    const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", product.id);

    if (error) {
        console.error("Erreur de suppression :", error);
        showNotification("Erreur lors de la suppression.", "error");
        return;
    }

    showNotification("Produit supprimé", "info");
    await loadInventoryFromSupabase();
}

async function restockProduct() {
    const selectEl = document.getElementById("restock-select");
    const qtyEl = document.getElementById("restock-qty");

    if (!selectEl || !qtyEl) return;

    const index = parseInt(selectEl.value);
    const quantity = parseInt(qtyEl.value);

    if (Number.isNaN(index) || Number.isNaN(quantity) || quantity <= 0 || !inventory[index]) {
        showNotification("Veuillez saisir une quantité valide.", "error");
        return;
    }

    const product = inventory[index];
    const updatedStock = product.stock + quantity;

    const { error } = await supabase
        .from("products")
        .update({ stock: updatedStock })
        .eq("id", product.id);

    if (error) {
        console.error("Erreur réapprovisionnement :", error);
        showNotification("Erreur lors du réapprovisionnement.", "error");
        return;
    }

    qtyEl.value = "";
    showNotification("Approvisionnement effectué avec succès", "success");
    await loadInventoryFromSupabase();
}

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
   ANALYTIQUES ET RAPPORTS
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
   ATTACHEMENT GLOBAL DÉFINITIF POUR LES BOUTONS (window)
========================================================= */

window.toggleSidebar = toggleSidebar;
window.switchTab = switchTab;
window.autofillPrice = autofillPrice;
window.addToCart = addToCart;
window.changeCartQuantity = changeCartQuantity;
window.removeFromCart = removeFromCart;
window.calculateChange = calculateChange;
window.checkout = checkout;
window.cancelCart = cancelCart;
window.saveProduct = saveProduct;
window.editProduct = editProduct;
window.resetStockForm = resetStockForm;
window.deleteProduct = deleteProduct;
window.restockProduct = restockProduct;
window.renderStockTable = renderStockTable;

window.logout = async function() {
    if (supabase && supabase.auth) {
        await supabase.auth.signOut();
    }
    window.location.href = 'index.html';
};
