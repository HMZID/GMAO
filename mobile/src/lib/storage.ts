import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import type { Operation, QueueStorage } from "./sync";

/**
 * Stockage local (MOB-13) :
 * - le jeton de session est dans le trousseau chiffré du système (Keychain, Keystore) ;
 * - la file des saisies et le cache de consultation sont dans le stockage de l'application, effacés à la déconnexion.
 */
const TOKEN_KEY = "gmao.token";
const QUEUE_KEY = "gmao.queue";
const CACHE_PREFIX = "gmao.cache.";

export const tokenStore = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};

export const queueStorage: QueueStorage = {
  async load() {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as Operation[]) : [];
  },
  async save(operations) {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(operations));
  },
};

export type Cached<T> = { data: T; savedAt: string };

export const cacheStore = {
  async get<T>(key: string): Promise<Cached<T> | null> {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    return raw ? (JSON.parse(raw) as Cached<T>) : null;
  },
  async set<T>(key: string, data: T) {
    await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, savedAt: new Date().toISOString() }));
  },
  /** Effacement des données de consultation (déconnexion, §10.5). */
  async clear() {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(CACHE_PREFIX));
    await AsyncStorage.multiRemove(keys);
  },
};
