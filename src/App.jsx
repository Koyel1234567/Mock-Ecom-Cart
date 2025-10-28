import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, collection, query, setDoc, deleteDoc, runTransaction, getDocs, addDoc } from 'firebase/firestore';
import { ShoppingCart, X, Plus, Minus, CheckCircle, Package } from 'lucide-react';

// ====================================================================
// !!! CRITICAL STEP: REPLACE PLACEHOLDERS WITH YOUR FIREBASE CONFIG !!!
// ====================================================================
const firebaseConfig = {
  apiKey: "AIzaSyDSXkMGrOezWyGEYFVbX2j3ttnSbOmEfWA",
  authDomain: "vibe-commerce-cart.firebaseapp.com",
  projectId: "vibe-commerce-cart",
  storageBucket: "vibe-commerce-cart.firebasestorage.app",
  messagingSenderId: "887996791210",
  appId: "1:887996791210:web:36c042cb0f0745a925d3d3"
};
// Use null for the token to trigger anonymous sign-in in a local dev environment
const initialAuthToken = null;
const appId = firebaseConfig.projectId || 'default-app-id'; // Use projectId as a reliable identifier

// Mock Product Data (Simulates GET /api/products)
const MOCK_PRODUCTS = [
  { id: 'v1', name: 'Vintage Vibe Tee', price: 29.99, description: 'Soft organic cotton, throwback design.' },
  { id: 'v2', name: 'Solaris Sunglasses', price: 49.50, description: 'Polarized lenses for max sun protection.' },
  { id: 'v3', name: 'Aura Candle Set', price: 35.00, description: 'Lavender, Sandalwood, and Amber scent.' },
  { id: 'v4', name: 'Zenith Water Bottle', price: 19.99, description: 'Insulated steel, keeps drinks cold for 24h.' },
  { id: 'v5', name: 'Echo Bluetooth Speaker', price: 79.99, description: 'Compact sound, 10-hour battery life.' },
];

// Utility function to safely set paths
const getCartCollectionPath = (userId) => `artifacts/${appId}/users/${userId}/cart_items`;
const getOrdersCollectionPath = (userId) => `artifacts/${appId}/users/${userId}/orders`;

// Helper to format currency
const formatCurrency = (amount) => `$${amount.toFixed(2)}`;

// Main Application Component
const App = () => {
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [products] = useState(MOCK_PRODUCTS);
  const [checkoutModal, setCheckoutModal] = useState({ isOpen: false, receipt: null });
  const [error, setError] = useState(null);

  // 1. FIREBASE INITIALIZATION AND AUTHENTICATION
  useEffect(() => {
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes('YOUR_API_KEY')) {
        console.error("Firebase API Key is missing or placeholder. Database will not work.");
        setError("Firebase not configured. Please update App.jsx with your keys.");
        setIsAuthReady(true);
        return;
    }

    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const authInstance = getAuth(app);
      setDb(firestore);
      // Sign in or Listen for Auth State
      const handleAuth = async (auth) => {
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
          } else {
            // Fallback for local development or environments without a custom token (uses anonymous sign-in)
            await signInAnonymously(auth);
          }
        } catch (e) {
          console.error("Firebase Auth Error:", e);
          // If custom token fails, attempt anonymous sign-in
          await signInAnonymously(auth);
        }
      };

      const unsubscribe = onAuthStateChanged(authInstance, (user) => {
        if (user) {
          setUserId(user.uid);
        } else {
          // Fallback user ID if something goes wrong, though sign-in should ensure a user exists
          setUserId(crypto.randomUUID());
        }
        setIsAuthReady(true);
      });

      handleAuth(authInstance);

      return () => unsubscribe();
    } catch (e) {
      console.error("Firebase Initialization Failed:", e);
      setError("Firebase Initialization Failed. Check your console for details.");
      setIsAuthReady(true);
    }
  }, []);

  // 2. FIRESTORE CART LISTENER (Simulates GET /api/cart)
  useEffect(() => {
    if (!db || !userId || !isAuthReady) return;

    setError(null);

    const cartCollectionRef = collection(db, getCartCollectionPath(userId));
    // Use onSnapshot for real-time updates of the cart
    const unsubscribe = onSnapshot(cartCollectionRef, (snapshot) => {
      try {
        const items = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id, // Firestore document ID is the cart item ID
          quantity: doc.data().quantity || 1 // Ensure quantity is a number
        }));
        setCartItems(items);
      } catch (e) {
        console.error("Error fetching cart data:", e);
        setError("Could not load cart data.");
      }
    }, (e) => {
      console.error("Firestore Listener Error:", e);
      setError("Real-time cart updates failed.");
    });

    // Clean up listener on component unmount or dependency change
    return () => unsubscribe();
  }, [db, userId, isAuthReady, error]); // Dependencies for re-running the effect

  // Computed Values (Cart Totals)
  const cartTotal = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  }, [cartItems]);

  const cartCount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [cartItems]);

  // --- API SIMULATION: CART OPERATIONS ---

  // POST /api/cart: Add or Update Item
  const handleAddToCart = useCallback(async (productId, quantity = 1) => {
    if (!db || !userId) return;
    setError(null);

    const product = products.find(p => p.id === productId);
    if (!product) {
      setError("Product not found.");
      return;
    }

    try {
      const cartRef = collection(db, getCartCollectionPath(userId));
      // First, check if the item already exists in the cart to merge quantities
      const q = query(cartRef);
      const snapshot = await getDocs(q);
      const existingDoc = snapshot.docs.find(doc => doc.data().productId === productId);

      if (existingDoc) {
        // Item exists, update quantity
        const existingQty = existingDoc.data().quantity || 0;
        const newQty = Math.max(1, existingQty + quantity); // Quantity must be at least 1
        await setDoc(doc(db, getCartCollectionPath(userId), existingDoc.id), { quantity: newQty }, { merge: true });
      } else {
        // Item does not exist, add new document
        const newCartItem = {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: quantity,
          addedAt: new Date().toISOString()
        };
        // The Firestore Document ID will serve as the Cart Item ID
        await addDoc(cartRef, newCartItem);
      }
    } catch (e) {
      console.error("Error adding/updating cart item:", e);
      setError("Failed to add item to cart. Please try again.");
    }
  }, [db, userId, products]);

  // DELETE /api/cart/:id: Remove Item
  const handleRemoveItem = useCallback(async (cartItemId) => {
    if (!db || !userId) return;
    setError(null);
    try {
      await deleteDoc(doc(db, getCartCollectionPath(userId), cartItemId));
    } catch (e) {
      console.error("Error removing cart item:", e);
      setError("Failed to remove item from cart.");
    }
  }, [db, userId]);

  // PUT/PATCH /api/cart/:id (Simulated by updating quantity)
  const handleUpdateQuantity = useCallback(async (cartItemId, newQuantity) => {
    if (!db || !userId) return;
    setError(null);

    const quantity = Math.max(0, newQuantity); // Allow 0 to trigger removal

    try {
      if (quantity === 0) {
        await handleRemoveItem(cartItemId);
        return;
      }
      await setDoc(doc(db, getCartCollectionPath(userId), cartItemId), { quantity: quantity }, { merge: true });
    } catch (e) {
      console.error("Error updating cart quantity:", e);
      setError("Failed to update item quantity.");
    }
  }, [db, userId, handleRemoveItem]);

  // POST /api/checkout: Process Checkout
  const handleCheckout = async (formData) => {
    if (!db || !userId || cartItems.length === 0) return;
    setError(null);

    const orderData = {
      ...formData,
      userId: userId,
      items: cartItems.map(({ id, ...rest }) => ({ cartId: id, ...rest })),
      total: cartTotal,
      timestamp: new Date().toISOString(),
      status: 'Processed'
    };

    // Use a Firestore Transaction to ensure the order is saved AND the cart is cleared atomically.
    try {
      await runTransaction(db, async (transaction) => {
        // 1. Save the Order (Simulates mock receipt generation)
        const orderRef = collection(db, getOrdersCollectionPath(userId));
        const newOrderRef = await addDoc(orderRef, orderData);

        // 2. Clear the Cart
        const cartCollectionRef = collection(db, getCartCollectionPath(userId));
        const cartSnapshot = await getDocs(cartCollectionRef);
        cartSnapshot.docs.forEach(cartDoc => {
          transaction.delete(cartDoc.ref);
        });

        // 3. Set the receipt for the modal display
        setCheckoutModal(prev => ({
          ...prev,
          receipt: {
            ...orderData,
            orderId: newOrderRef.id
          }
        }));
      });
      // The state change will be reflected via the onSnapshot listener, which is cleared by the transaction.
    } catch (e) {
      console.error("Transaction failed during checkout:", e);
      setError("Checkout failed due to a database error. Please try again.");
    }
  };


  // --- UI COMPONENTS ---

  const LoadingSpinner = () => (
    <div className="flex justify-center items-center p-8">
      <div className="w-8 h-8 border-4 border-t-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin"></div>
      <p className="ml-3 text-indigo-600 font-medium">Loading application...</p>
    </div>
  );

  const ProductCard = ({ product }) => (
    <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition duration-300 flex flex-col justify-between">
      <div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">{product.name}</h3>
        <p className="text-sm text-gray-500 mb-4">{product.description}</p>
      </div>
      <div className="flex items-center justify-between mt-4">
        <span className="text-2xl font-bold text-indigo-600">{formatCurrency(product.price)}</span>
        <button
          onClick={() => handleAddToCart(product.id, 1)}
          className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg shadow-md hover:bg-indigo-700 transition duration-150 transform hover:scale-105"
        >
          <Plus size={16} className="inline-block mr-1" /> Add to Cart
        </button>
      </div>
    </div>
  );

  const CartItem = ({ item }) => (
    <div className="flex items-center justify-between py-4 border-b border-gray-200 last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 truncate">{item.name}</p>
        <p className="text-sm text-indigo-600 font-semibold">{formatCurrency(item.price)} each</p>
      </div>
      <div className="flex items-center space-x-3 ml-4">
        {/* Quantity Controls */}
        <div className="flex items-center border border-gray-300 rounded-lg">
          <button
            onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-l-lg transition"
            aria-label="Decrease quantity"
          >
            <Minus size={16} />
          </button>
          <span className="w-8 text-center text-sm font-medium text-gray-800">{item.quantity}</span>
          <button
            onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-r-lg transition"
            aria-label="Increase quantity"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Subtotal */}
        <div className="w-20 text-right hidden sm:block">
            <p className="font-bold text-gray-900">{formatCurrency(item.price * item.quantity)}</p>
        </div>

        {/* Remove Button */}
        <button
          onClick={() => handleRemoveItem(item.id)}
          className="p-1.5 text-red-500 hover:bg-red-50 rounded-full transition"
          aria-label="Remove item"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );

  const CheckoutModal = ({ receipt, cartTotal, closeModal }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [localError, setLocalError] = useState(null);

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!name || !email) {
        setLocalError("Please enter your name and email.");
        return;
      }
      setIsProcessing(true);
      setLocalError(null);
      await handleCheckout({ name, email });
      setIsProcessing(false);
    };

    if (receipt) {
      // Receipt View
      return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-xl shadow-2xl max-w-lg w-full transform transition-all duration-300 scale-100">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-3xl font-extrabold text-green-600 flex items-center">
                <CheckCircle size={32} className="mr-2" /> Order Confirmed!
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition">
                <X size={24} />
              </button>
            </div>
            <div className="border-t border-b border-gray-200 py-6 space-y-3">
              <p className="text-gray-700"><strong>Order ID:</strong> <span className="text-indigo-600 font-mono text-sm">{receipt.orderId.substring(0, 10)}...</span></p>
              <p className="text-gray-700"><strong>Date:</strong> {new Date(receipt.timestamp).toLocaleDateString()}</p>
              <p className="text-gray-700"><strong>Customer:</strong> {receipt.name}</p>
              <p className="text-gray-700"><strong>Email:</strong> {receipt.email}</p>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-300">
              <p className="text-xl font-bold text-gray-800">Total Paid: <span className="text-green-600">{formatCurrency(receipt.total)}</span></p>
            </div>
            <div className="mt-6 text-center">
                <button onClick={closeModal} className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition">
                    Continue Shopping
                </button>
            </div>
          </div>
        </div>
      );
    }

    // Checkout Form View
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white p-8 rounded-xl shadow-2xl max-w-lg w-full transform transition-all duration-300 scale-100">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-3xl font-bold text-gray-800">Complete Order</h2>
            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition">
              <X size={24} />
            </button>
          </div>
          {localError && (
            <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm font-medium">{localError}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm p-3 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm p-3 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="border-t border-gray-200 pt-4">
              <p className="text-xl font-bold text-gray-800 flex justify-between">
                <span>Cart Total:</span>
                <span className="text-indigo-600">{formatCurrency(cartTotal)}</span>
              </p>
            </div>

            <button
              type="submit"
              disabled={isProcessing || cartTotal === 0}
              className={`w-full py-3 font-semibold rounded-lg transition ${
                isProcessing || cartTotal === 0
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700 transform hover:scale-[1.01]'
              }`}
            >
              {isProcessing ? 'Processing...' : 'Place Order'}
            </button>
          </form>
        </div>
      </div>
    );
  };


  if (!isAuthReady) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-4 md:p-8">
      {/* Tailwind and Font Setup (Typically handled by the build process, but included for single-file environments) */}
      <script src="https://cdn.tailwindcss.com"></script>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');
        .font-sans {
          font-family: 'Inter', sans-serif;
        }
      `}</style>

      <header className="mb-8 border-b pb-4">
        <h1 className="text-4xl font-extrabold text-gray-900">Vibe Commerce <span className="text-indigo-600 text-xl font-medium block sm:inline-block">Mock Cart App</span></h1>
        <p className="text-sm text-gray-500 mt-1">User ID: <span className="font-mono text-xs">{userId}</span></p>
      </header>

      {/* Global Error Banner */}
      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6 flex justify-between items-center shadow-md">
          <p className="font-medium">{error}</p>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-800">
            <X size={20} />
          </button>
        </div>
      )}

      {/* Main Content Layout */}
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Product Grid (Column 1 & 2 on Desktop) */}
        <section className="lg:col-span-2">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center"><Package size={24} className="mr-2 text-indigo-500"/> Featured Products</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>

        {/* Cart View (Column 3 on Desktop) */}
        <aside className="lg:col-span-1">
          <div className="sticky top-8 bg-white p-6 rounded-xl shadow-2xl border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
              <ShoppingCart size={24} className="mr-2 text-indigo-500"/> Shopping Cart ({cartCount})
            </h2>

            {cartItems.length === 0 ? (
              <div className="text-center py-10 text-gray-500 italic">Your cart is empty. Start adding some Vibe products!</div>
            ) : (
              <div className="space-y-4">
                {cartItems.map(item => (
                  <CartItem key={item.id} item={item} />
                ))}

                {/* Cart Summary */}
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center text-xl font-bold text-gray-900">
                    <span>Cart Total:</span>
                    <span className="text-indigo-600">{formatCurrency(cartTotal)}</span>
                  </div>
                  <button
                    onClick={() => setCheckoutModal({ isOpen: true, receipt: null })}
                    className="mt-4 w-full py-3 bg-green-600 text-white font-semibold rounded-lg shadow-lg hover:bg-green-700 transition duration-150 transform hover:scale-[1.01]"
                  >
                    Proceed to Checkout
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* Checkout Modal */}
      {checkoutModal.isOpen && (
        <CheckoutModal
          receipt={checkoutModal.receipt}
          cartTotal={cartTotal}
          closeModal={() => setCheckoutModal({ isOpen: false, receipt: null })}
        />
      )}
    </div>
  );
};

export default App;