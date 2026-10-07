/* ================= API HELPER ================= */

// Errors carry the HTTP status (0 plus `network` when the request never got
// through), so callers can tell "your cart is empty" from a server/network failure.
async function api(url, options = {}) {
    let res;

    try {
        res = await fetch(url, {
            method: options.method || 'GET',
            headers: { 'Content-Type': 'application/json' },
            body: options.body ? JSON.stringify(options.body) : undefined
        });
    } catch {
        const err = new Error('Looks like your connection went for a walk. Check it and try again.');
        err.status = 0;
        err.network = true;
        throw err;
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        const err = new Error(data.error || 'Something went wrong.');
        err.status = res.status;
        throw err;
    }

    return data;
}

function isServerOrNetworkError(err) {
    return Boolean(err.network) || err.status >= 500;
}

/* ================= TOAST ================= */

let toastTimer = null;

function showToast(message) {
    const toast = document.getElementById('toast');

    if (!toast) {
        return;
    }

    toast.textContent = message;
    toast.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

/* ================= CART BADGE ================= */

function updateCartBadge() {
    const badge = document.getElementById('cartCount');

    if (!badge) {
        return;
    }

    api('/api/cart/count')
        .then((data) => {
            badge.textContent = data.count;
            badge.hidden = data.count === 0;
        })
        .catch(() => {
            badge.hidden = true;
        });
}

/* ================= PRICE ALERTS: BADGES + "TARGET REACHED" POP-UP ================= */

// Prices update about once a minute, so that's how often we look for reached targets.
const ALERT_CHECK_MS = 60 * 1000;

function formatRupees(n) {
    return '₹' + Math.round(n).toLocaleString('en-IN');
}

// Updates the alert count in the header and the dock, and pops up a notice
// when a product the user is watching has reached their target price.
function updateAlertBadge() {
    const badges = document.querySelectorAll('[data-alert-badge]');

    if (!badges.length) {
        return;
    }

    api('/api/price-alerts/count')
        .then((data) => {
            badges.forEach((badge) => {
                badge.textContent = data.count;
                badge.hidden = data.count === 0;
            });

            if (data.count > 0) {
                notifyReachedAlerts();
            }
        })
        .catch(() => {
            badges.forEach((badge) => {
                badge.hidden = true;
            });
        });
}

// Reached alerts already announced in this tab, so the pop-up doesn't repeat
// on every page (the badge keeps counting them until the alerts page is opened).
// Keyed by target too, so editing a target makes it announce again when reached.
function alertKey(alert) {
    return alert.id + ':' + alert.target_price;
}

function announcedAlertKeys() {
    try {
        return JSON.parse(sessionStorage.getItem('announcedAlerts') || '[]');
    } catch {
        return [];
    }
}

function rememberAnnounced(keys) {
    try {
        sessionStorage.setItem('announcedAlerts', JSON.stringify(keys));
    } catch {
        // Storage unavailable (e.g. private mode): the badge still shows the count.
    }
}

function notifyReachedAlerts() {
    // The alerts page lists reached alerts itself, and another pop-up shouldn't be interrupted.
    if (window.location.pathname === '/price-alerts' || stateModalKind) {
        return;
    }

    api('/api/price-alerts/reached')
        .then(({ alerts }) => {
            const announced = announcedAlertKeys();
            const fresh = alerts.filter((alert) => !announced.includes(alertKey(alert)));

            if (fresh.length === 0 || stateModalKind) {
                return;
            }

            rememberAnnounced(announced.concat(fresh.map(alertKey)));

            const first = fresh[0];
            const single = fresh.length === 1;

            showStateModal({
                kind: 'target',
                mood: 'excited',
                title: 'Target Price Reached!',
                text: single
                    ? first.name + ' is now ' + formatRupees(first.current_price) +
                      ', at or below your target of ' + formatRupees(first.target_price) + '.'
                    : fresh.length + ' products you’re watching just hit your target price.',
                actions: single
                    ? [{ label: 'View Deal', href: '/product/' + first.product_id }, { label: 'My Alerts', href: '/price-alerts' }]
                    : [{ label: 'View Alerts', href: '/price-alerts' }, { label: 'Later', onClick: closeStateModal }]
            });
        })
        .catch(() => {});
}

/* ================= LOCATION ================= */

// textContent, not innerHTML: the location is free text typed by the user.
function setLocationText(place) {
    const city = document.querySelector('#locationText .city');

    if (city) {
        city.textContent = place;
    }
}

function changeLocation() {
    let place = prompt('Enter your delivery location:');

    if (place && place.trim() !== '') {
        place = place.trim();
        setLocationText(place);
        localStorage.setItem('userLocation', place);
    }
}

function loadLocation() {
    const saved = localStorage.getItem('userLocation');

    if (saved) {
        setLocationText(saved);
    }
}

/* ================= LANGUAGE ================= */

function changeLanguage() {
    let language = prompt('Enter language: ENG / HIN / TEL');

    if (!language) {
        return;
    }

    language = language.trim().toUpperCase();

    if (!['ENG', 'HIN', 'TEL'].includes(language)) {
        showToast('Please enter ENG, HIN or TEL.');
        return;
    }

    document.getElementById('language').innerText = language;
    localStorage.setItem('userLanguage', language);
}

function loadLanguage() {
    const saved = localStorage.getItem('userLanguage');
    const el = document.getElementById('language');

    if (saved && el) {
        el.innerText = saved;
    }
}

/* ================= LOGIN NAV ================= */

function logout() {
    api('/api/auth/logout', { method: 'POST' })
        .catch(() => {})
        .then(() => {
            window.location.href = '/login';
        });
}

/* ================= ADD TO CART (category pages) ================= */

function handleAuthError(err) {
    if (err.message === 'Login required') {
        window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname);
        return true;
    }

    return false;
}

function initAddToCartButtons() {
    document.querySelectorAll('[data-add-to-cart]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const productId = btn.getAttribute('data-product-id');
            const name = btn.getAttribute('data-product-name');

            api('/api/cart', { method: 'POST', body: { productId: Number(productId), quantity: 1 } })
                .then(() => {
                    showToast(name + ' added to cart');
                    updateCartBadge();
                })
                .catch((err) => {
                    if (!handleAuthError(err)) {
                        showToast(err.message);
                    }
                });
        });
    });
}

/* ================= BUY NOW (category pages) ================= */

function initBuyNowButtons() {
    document.querySelectorAll('[data-buy-now]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const productId = btn.getAttribute('data-product-id');
            const name = btn.getAttribute('data-product-name');

            btn.disabled = true;

            api('/api/buy-now', { method: 'POST', body: { productId: Number(productId), quantity: 1 } })
                .then((data) => {
                    btn.disabled = false;
                    showOrderPlaced(data.orderId, name);
                })
                .catch((err) => {
                    btn.disabled = false;

                    if (handleAuthError(err)) {
                        return;
                    }

                    if (isServerOrNetworkError(err)) {
                        showPaymentFailed(() => btn.click());
                    } else {
                        showToast(err.message);
                    }
                });
        });
    });
}

/* ================= PRICE ALERT MODAL ================= */

let priceAlertContext = null;

const PRICE_ALERT_HINT = 'We’ll notify you the moment the price drops to this amount or below.';

function openPriceAlertModal({ productId, name, currentPrice, prefillTarget }) {
    const overlay = document.getElementById('priceAlertModal');

    if (!overlay) {
        return;
    }

    priceAlertContext = { productId, name, currentPrice };

    document.getElementById('priceAlertModalTitle').textContent = 'Alert for ' + name;
    document.getElementById('priceAlertModalCurrentPrice').textContent =
        '₹' + currentPrice.toLocaleString('en-IN');
    document.getElementById('priceAlertModalSubmit').textContent = prefillTarget ? 'Update Alert' : 'Set Alert';

    const input = document.getElementById('priceAlertModalInput');
    input.value = prefillTarget || '';
    input.max = '';
    updatePriceAlertHint();

    overlay.classList.add('show');
    setTimeout(() => input.focus(), 50);
}

// Says how far below today's price the target is, or that it would fire at once.
function updatePriceAlertHint() {
    const hint = document.getElementById('priceAlertModalHint');
    const target = Number(document.getElementById('priceAlertModalInput').value);
    const current = priceAlertContext ? priceAlertContext.currentPrice : 0;

    if (!hint) {
        return;
    }

    if (!target || !current) {
        hint.textContent = PRICE_ALERT_HINT;
        hint.classList.remove('warn');
    } else if (target >= current) {
        hint.textContent = 'That’s at or above today’s price, so you’ll be alerted right away.';
        hint.classList.add('warn');
    } else {
        const pct = (((current - target) / current) * 100).toFixed(1);
        hint.textContent = formatRupees(current - target) + ' (' + pct + '%) below today’s price. ' + PRICE_ALERT_HINT;
        hint.classList.remove('warn');
    }
}

// Keeps every "Set Price Alert" button for a product in step with its alert
// (same labels as views/partials/productCard.ejs).
function markAlertButtons(productId, targetPrice) {
    document.querySelectorAll('[data-price-alert][data-product-id="' + productId + '"]').forEach((btn) => {
        const reached = Number(btn.getAttribute('data-current-price')) <= targetPrice;
        const label = btn.querySelector('[data-alert-label]');

        btn.setAttribute('data-target-price', targetPrice);
        btn.classList.toggle('is-set', !reached);
        btn.classList.toggle('is-reached', reached);

        if (label) {
            label.textContent = reached
                ? 'Target reached · ' + formatRupees(targetPrice)
                : 'Alert at ' + formatRupees(targetPrice) + ' · Edit';
        }
    });
}

function closePriceAlertModal() {
    const overlay = document.getElementById('priceAlertModal');

    if (overlay) {
        overlay.classList.remove('show');
    }

    priceAlertContext = null;
}

function submitPriceAlertModal() {
    if (!priceAlertContext) {
        return;
    }

    const input = document.getElementById('priceAlertModalInput');
    const targetPrice = Number(input.value);

    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
        showToast('Please enter a valid price.');
        return;
    }

    const { productId, name } = priceAlertContext;

    api('/api/price-alerts', {
        method: 'POST',
        body: { productId: Number(productId), targetPrice }
    })
        .then((data) => {
            showToast('Price alert set for ' + name + ' at ' + formatRupees(targetPrice));
            closePriceAlertModal();
            markAlertButtons(productId, targetPrice);
            updateAlertBadge();

            if (typeof onPriceAlertsUpdated === 'function') {
                onPriceAlertsUpdated(data.alerts);
            }
        })
        .catch((err) => {
            if (!handleAuthError(err)) {
                showToast(err.message);
            }
        });
}

function initPriceAlertModal() {
    const overlay = document.getElementById('priceAlertModal');

    if (!overlay) {
        return;
    }

    document.getElementById('priceAlertModalClose').addEventListener('click', closePriceAlertModal);
    document.getElementById('priceAlertModalCancel').addEventListener('click', closePriceAlertModal);
    document.getElementById('priceAlertModalSubmit').addEventListener('click', submitPriceAlertModal);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closePriceAlertModal();
        }
    });

    document.getElementById('priceAlertModalInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            submitPriceAlertModal();
        }
    });

    document.getElementById('priceAlertModalInput').addEventListener('input', updatePriceAlertHint);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('show')) {
            closePriceAlertModal();
        }
    });
}

/* ================= PRICE ALERT BUTTONS (category pages) ================= */

function initPriceAlertButtons() {
    document.querySelectorAll('[data-price-alert]').forEach((btn) => {
        btn.addEventListener('click', () => {
            openPriceAlertModal({
                productId: btn.getAttribute('data-product-id'),
                name: btn.getAttribute('data-product-name'),
                currentPrice: Number(btn.getAttribute('data-current-price')),
                prefillTarget: btn.getAttribute('data-target-price')
            });
        });
    });
}

/* ================= SORT (category + search pages) ================= */

function initSortSelect() {
    const select = document.getElementById('sortSelect');

    if (!select) {
        return;
    }

    select.addEventListener('change', () => {
        const url = new URL(window.location.href);
        url.searchParams.set('sort', select.value);
        window.location.href = url.pathname + url.search;
    });
}

/* ================= SEARCH SHORTCUTS ================= */

// The header search box is on every signed-in page, so the dock's search
// button and "Try a different search" links jump to it instead of loading a page.
function initSearchShortcuts() {
    const input = document.getElementById('search');

    if (!input) {
        return;
    }

    document.querySelectorAll('[data-dock-search], [data-focus-search]').forEach((link) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            input.focus({ preventScroll: true });
            input.select();
        });
    });
}

/* ================= MASCOT ================= */

// Sets the expression (and optionally the speech bubble) of every mascot inside root.
function setMascot(root, mood, says) {
    root.querySelectorAll('.mascot').forEach((m) => m.setAttribute('data-mood', mood));

    if (says) {
        root.querySelectorAll('[data-mascot-says]').forEach((el) => {
            el.textContent = says;
        });
    }
}

// How the mascot on the login / sign-up pages reacts to each server error.
const AUTH_REACTIONS = [
    [/invalid or expired otp/i, 'angry', 'Hmm… that doesn’t look right.'],
    [/valid email/i, 'confused', 'That email doesn’t seem to be valid.'],
    [/10 digits/i, 'confused', 'That number needs exactly 10 digits.'],
    [/required/i, 'thinking', 'Looks like something’s missing.'],
    [/username is already taken/i, 'sad', 'That username’s taken. Try another!'],
    [/already exists/i, 'surprised', 'We’ve met before! Try logging in.'],
    [/no account/i, 'thinking', 'I don’t know that number yet. Sign up?'],
    [/connection/i, 'sad', 'Looks like your connection went for a walk.']
];

function reactToAuthError(root, message) {
    const match = AUTH_REACTIONS.find(([pattern]) => pattern.test(message));

    setMascot(root, match ? match[1] : 'sad', match ? match[2] : 'Oops, something went wrong.');
}

/* ================= STATE POP-UP (network error, payment failed, success) ================= */

let stateModalKind = null;

// actions: [{ label, href }] or [{ label, onClick }]; the first one is the main button.
function showStateModal({ kind, mood, title, text, actions = [] }) {
    const overlay = document.getElementById('stateModal');

    if (!overlay) {
        return;
    }

    stateModalKind = kind || null;
    setMascot(overlay, mood);
    document.getElementById('stateModalTitle').textContent = title;
    document.getElementById('stateModalText').textContent = text;

    const actionsEl = document.getElementById('stateModalActions');
    actionsEl.innerHTML = '';

    actions.forEach((action, i) => {
        const el = document.createElement(action.href ? 'a' : 'button');
        el.className = 'btn ' + (i === 0 ? 'btn-primary' : 'btn-outline');
        el.textContent = action.label;

        if (action.href) {
            el.href = action.href;
        } else {
            el.type = 'button';
            el.addEventListener('click', action.onClick);
        }

        actionsEl.appendChild(el);
    });

    overlay.classList.add('show');

    if (actionsEl.firstElementChild) {
        setTimeout(() => actionsEl.firstElementChild.focus(), 50);
    }
}

function closeStateModal() {
    const overlay = document.getElementById('stateModal');

    if (overlay) {
        overlay.classList.remove('show');
    }

    stateModalKind = null;
}

function showOrderPlaced(orderId) {
    showStateModal({
        kind: 'success',
        mood: 'excited',
        title: 'Success',
        text: 'Nice! You’re all set. Order #' + orderId + ' is confirmed.',
        actions: [
            {
                label: 'Continue Shopping',
                onClick: () => {
                    // From the (now empty) cart, carry on at home; elsewhere, just stay put.
                    if (window.location.pathname === '/cart') {
                        window.location.href = '/';
                    } else {
                        closeStateModal();
                    }
                }
            },
            { label: 'View Order', href: '/orders' }
        ]
    });
}

function showPaymentFailed(retry) {
    showStateModal({
        kind: 'payment',
        mood: 'sad',
        title: 'Payment Failed',
        text: 'Something went wrong with your payment. Try again.',
        actions: [
            {
                label: 'Retry Payment',
                onClick: () => {
                    closeStateModal();
                    retry();
                }
            },
            { label: 'Cancel', onClick: closeStateModal }
        ]
    });
}

function showNetworkError() {
    showStateModal({
        kind: 'network',
        mood: 'angry',
        title: 'Network Error',
        text: 'Looks like your connection went for a walk.',
        actions: [
            {
                label: 'Check Connection',
                onClick: () => {
                    if (navigator.onLine) {
                        closeStateModal();
                    } else {
                        showToast('Still offline. We’ll keep checking.');
                    }
                }
            }
        ]
    });
}

function initStateModal() {
    const overlay = document.getElementById('stateModal');

    if (!overlay) {
        return;
    }

    document.getElementById('stateModalClose').addEventListener('click', closeStateModal);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeStateModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('show')) {
            closeStateModal();
        }
    });

    window.addEventListener('offline', showNetworkError);
    window.addEventListener('online', () => {
        if (stateModalKind === 'network') {
            closeStateModal();
            showToast('You’re back online.');
        }
    });
}

/* ================= PAGE INIT ================= */

document.addEventListener('DOMContentLoaded', () => {
    loadLocation();
    loadLanguage();
    updateCartBadge();
    updateAlertBadge();
    initSearchShortcuts();
    initStateModal();
    initSortSelect();
    initAddToCartButtons();
    initBuyNowButtons();
    initPriceAlertButtons();
    initPriceAlertModal();

    // Keep checking while the page is open, so a target hit shows up without a reload.
    setInterval(updateAlertBadge, ALERT_CHECK_MS);
});
