import { api } from "@/lib/api";
import { useAuthStore, useCartStore, useFavoritesStore } from "@/lib/store";

function mapCartFromServer(data: any[]) {
  return data.map((i) => ({
    productId: String(i.product_id || i.productId),
    name: i.name || "",
    price: Number(i.price) || 0,
    quantity: Number(i.quantity) || 1,
    image: i.image || undefined,
  }));
}

function mapFavFromServer(data: any[]) {
  return data.map((i) => ({
    productId: String(i.product_id || i.productId),
    name: i.name || "",
    slug: i.slug || "",
    brand: i.brand || "",
    price: Number(i.price) || 0,
    image: i.image || undefined,
  }));
}

function cartToServer(items: ReturnType<typeof useCartStore.getState>["items"]) {
  return items.map((i) => ({
    product_id: i.productId,
    name: i.name,
    price: i.price,
    quantity: i.quantity,
    image: i.image || "",
  }));
}

function favToServer(items: ReturnType<typeof useFavoritesStore.getState>["items"]) {
  return items.map((i) => ({
    product_id: i.productId,
    name: i.name,
    slug: i.slug || "",
    brand: i.brand || "",
    price: i.price,
    image: i.image || "",
  }));
}

/**
 * Apres login :
 * - charge panier + favoris du COMPTE (serveur) = multi-navigateur
 * - si serveur vide et navigateur a un panier invite, on l'envoie une fois
 */
export async function syncAccountState() {
  if (!useAuthStore.getState().accessToken) return;

  try {
    const [cRes, fRes] = await Promise.all([
      api.getCartServer(),
      api.getFavoritesServer(),
    ]);

    const localCart = useCartStore.getState().items;
    const localFavs = useFavoritesStore.getState().items;

    let serverCart: any[] = [];
    let serverFavs: any[] = [];
    if (cRes.success && Array.isArray(cRes.data)) serverCart = cRes.data as any[];
    if (fRes.success && Array.isArray(fRes.data)) serverFavs = fRes.data as any[];

    if (serverCart.length > 0) {
      useCartStore.setState({ items: mapCartFromServer(serverCart) });
    } else if (localCart.length > 0) {
      await api.saveCartServer(cartToServer(localCart));
    } else {
      useCartStore.setState({ items: [] });
    }

    if (serverFavs.length > 0) {
      useFavoritesStore.setState({ items: mapFavFromServer(serverFavs) });
    } else if (localFavs.length > 0) {
      await api.saveFavoritesServer(favToServer(localFavs));
    } else {
      useFavoritesStore.setState({ items: [] });
    }
  } catch {
    // hors ligne : garde le local
  }
}

let cartTimer: ReturnType<typeof setTimeout> | null = null;
let favTimer: ReturnType<typeof setTimeout> | null = null;

export function schedulePushCart() {
  if (!useAuthStore.getState().accessToken) return;
  if (cartTimer) clearTimeout(cartTimer);
  cartTimer = setTimeout(() => {
    void pushCartToServer();
  }, 400);
}

export function schedulePushFavorites() {
  if (!useAuthStore.getState().accessToken) return;
  if (favTimer) clearTimeout(favTimer);
  favTimer = setTimeout(() => {
    void pushFavoritesToServer();
  }, 400);
}

export async function pushCartToServer() {
  if (!useAuthStore.getState().accessToken) return;
  const items = useCartStore.getState().items;
  try {
    await api.saveCartServer(cartToServer(items));
  } catch {
    /* ignore */
  }
}

export async function pushFavoritesToServer() {
  if (!useAuthStore.getState().accessToken) return;
  const items = useFavoritesStore.getState().items;
  try {
    await api.saveFavoritesServer(favToServer(items));
  } catch {
    /* ignore */
  }
}

export function clearLocalCartAndFavorites() {
  useCartStore.getState().clear();
  useFavoritesStore.getState().clear();
}
