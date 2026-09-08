/* =========================================================
   INITIALISATION & CLIENT SUPABASE
========================================================= */

var supabase = window.supabaseClient || window.supabase;

let inventory = [];
let salesHistory = [];
let cart = [];

window.addEventListener("DOMContentLoaded", async () => {
    if (!supabase && window.supabaseClient) {
        supabase = window.supabaseClient;
    }

    const dateEl = document.getElementById("current-date");
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString(
            "fr-FR",
            { weekday: "long", year: "numeric", month: "long", day: "numeric" }
        );
    }

    await loadInventoryFromSupabase();
    await loadSalesFromSupabase();

    updateCartUI();
});

/* =========================================================
   CHARGEMENT DE LA TABLE PRODUITS DEPUIS SUPABASE
========================================================= */

async function loadInventoryFromSupabase() {
    if (!supabase) {
        console.error("Client Supabase introuvable.");
        return;
    }

    // Récupération des colonnes id, nom, category_id, prix, stock
    const { data, error } = await supabase
        .from("produits")
        .select("*")
        .order("nom", { ascending: true });

    if (error) {
        console.error("Erreur de chargement des produits :", error);
        showNotification("Erreur lors de la récupération des produits.", "error");
        return;
    }

    // Mapping incluant le stock réel de Supabase
    inventory = (data || []).map(item => ({
        id: item.id,
        name: item.nom,                             // Colonne 'nom'
        cat: item.category_id || "Général",         // Colonne 'category_id'
        price: item.prix,                           // Colonne 'prix'
        stock: item.stock !== null && item.stock !== undefined ? item.stock : 0 // Colonne 'stock'
    }));

    renderStockTable();
    updateDatalists();
    updateAnalytics();
}

// Charger l'historique des ventes depuis Supabase
async function loadSalesFromSupabase() {
    if (!supabase) return;

    const { data, error } = await supabase
        .from("ventes")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erreur de chargement des ventes :", error);
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
   NAVIGATION & UTILITAIRES
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
        stock: "Gestion des Produits",
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

    if (!datalist) return;
    datalist.innerHTML = "";

    if (select) select.innerHTML = "";

    inventory.forEach((item, index) => {
        datalist.innerHTML += `<option value="${escapeHtml(item.name)}">`;
        if (select) {
            select.innerHTML += `<option value="${index}">${escapeHtml(item.name)}</option>`;
        }
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

    // Vérification de la réserve en stock
    const existingInCart = cart.find(item => item.id === product.id);
    const totalRequested = (existingInCart ? existingInCart.qty : 0) + qty;

    if (totalRequested > product.stock) {
        showNotification(`Stock insuffisant ! Disponible: ${product.stock}`, "error");
        return;
    }

    if (existingInCart) {
        existingInCart.qty += qty;
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

    const product = inventory.find(p => p.id === item.id);
    const newQty = item.qty + amount;

    if (newQty <= 0) {
        removeFromCart(index);
        return;
    }

    if (product && newQty > product.stock) {
        showNotification(`Stock max atteint (${product.stock})`, "error");
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
   ENCAISSEMENT AVEC DECREMENTATION DU STOCK SUR SUPABASE
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

    // 1. Enregistrement de la vente globale dans 'ventes'
    const salePayload = {
        total: total,
        received: received,
        change_amount: received - total,
        items: JSON.stringify(cart.map(item => ({ name: item.name, qty: item.qty, unitPrice: item.unitPrice }))),
        created_at: new Date().toISOString()
    };

    const { data: insertedSale, error: saleError } = await supabase
        .from("ventes")
        .insert([salePayload])
        .select();

    if (saleError) {
        console.error("Erreur enregistrement vente :", saleError);
        showNotification("Erreur lors de la sauvegarde de la vente.", "error");
        return;
    }

    // 2. Enregistrement des lignes détaillées dans 'ligne_ventes'
    if (insertedSale && insertedSale.length > 0) {
        const venteId = insertedSale[0].id;
        const ligneVentesPayload = cart.map(item => ({
            vente_id: venteId,
            produit_id: item.id,
            quantite: item.qty,
            prix_unitaire: item.unitPrice
        }));

        await supabase.from("ligne_ventes").insert(ligneVentesPayload);
    }

    // 3. Décrémentation du stock pour chaque produit dans 'produits'
    for (const item of cart) {
        const product = inventory.find(p => p.id === item.id);
        if (product) {
            const newStock = Math.max(0, product.stock - item.qty);

            await supabase
                .from("produits")
                .update({ stock: newStock })
                .eq("id", item.id);
        }
    }

    showNotification("Vente validée et stock mis à jour !", "success");

    cart = [];
    if (receivedEl) receivedEl.value = "";

    // Rechargement des données fraîches
    await loadInventoryFromSupabase();
    await loadSalesFromSupabase();
}

/* =========================================================
   GESTION DES PRODUITS ET STOCK AVEC SUPABASE
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
            const isLowStock = item.stock <= 5;
            list.innerHTML += `
                <tr>
                    <td><strong>${escapeHtml(item.name)}</strong></td>
                    <td>${escapeHtml(item.cat)}</td>
                    <td>${formatMoney(item.price)}</td>
                    <td>
                        <span style="font-weight: bold; color: ${isLowStock ? '#ef4444' : '#10b981'};">
                            ${item.stock}
                        </span>
                    </td>
                    <td>
                        <button class="btn-sm" onclick="editProduct(${index})" title="Modifier">✏️</button>
                        <button class="btn-sm danger" onclick="deleteProduct(${index})" title="Supprimer">🗑️</button>
                    </td>
                </tr>
            `;
        });
}

async function saveProduct() {
    const nameInput = document.getElementById("new-name");
    const catInput = document.getElementById("new-cat");
    const priceInput = document.getElementById("new-price");
    const stockInput = document.getElementById("new-stock");
    const editIndexInput = document.getElementById("edit-index");

    if (!nameInput || !priceInput) return;

    const name = nameInput.value.trim();
    const cat = catInput ? parseInt(catInput.value.trim()) || null : null;
    const price = parseFloat(priceInput.value);
    const stock = stockInput ? parseInt(stockInput.value) || 0 : 0;
    const editIndex = parseInt(editIndexInput ? editIndexInput.value : -1);

    if (!name) {
        showNotification("Le nom du produit est obligatoire.", "error");
        return;
    }

    if (Number.isNaN(price) || price < 0) {
        showNotification("Prix invalide.", "error");
        return;
    }

    if (editIndex === -1) {
        // Ajout dans 'produits'
        const { error } = await supabase
            .from("produits")
            .insert([{ nom: name, category_id: cat, prix: price, stock: stock }]);

        if (error) {
            console.error("Erreur d'ajout Supabase :", error);
            showNotification("Erreur lors de l'ajout du produit.", "error");
            return;
        }
        showNotification("Produit ajouté avec succès", "success");
    } else {
        // Modification dans 'produits'
        const existingProduct = inventory[editIndex];
        const { error } = await supabase
            .from("produits")
            .update({ nom: name, category_id: cat, prix: price, stock: stock })
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
    if (document.getElementById("new-cat")) document.getElementById("new-cat").value = item.cat;
    document.getElementById("new-price").value = item.price;
    if (document.getElementById("new-stock")) document.getElementById("new-stock").value = item.stock;
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
        .from("produits")
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

/* =========================================================
   ANALYTIQUES ET HISTORIQUE
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
    const elRefs = document.getElementById("analytics-total-refs");
    if (elRefs) elRefs.textContent = inventory.length;
}

function updateDashboard() {
    updateDailyCash();
}

function formatDate(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("fr-FR");
}

/* =========================================================
   ATTACHEMENT GLOBAL
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
window.renderStockTable = renderStockTable;

window.logout = async function() {
    if (supabase && supabase.auth) {
        await supabase.auth.signOut();
    }
    window.location.href = 'index.html';
};